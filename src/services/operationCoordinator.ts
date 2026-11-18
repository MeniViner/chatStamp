import { AppState, PermissionsAndroid, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { getChatStampNativeModule, type NativeSharedZipResult, type OperationSnapshot } from '../native/chatStampNativeModule';
import { usePipelineStore } from '../store/pipelineStore';
import { useHistoryStore, createExportHistoryItem } from '../store/historyStore';
import { useSettingsStore } from '../store/settingsStore';
import { clearWorkingDirectory, importWhatsAppZip } from './importService';
import { runSavePipeline, summarizeNativeSave } from './pipelineService';
import { asPipelineError, PipelineError } from '../lib/pipelineErrors';
import { createOperationId, isTerminalProgress } from '../lib/operationProgress';
import { outputChatName } from '../lib/outputOrganization';
import type { CompletionSummary } from '../types/media';
import i18n from '../i18n';
import { logger } from '../lib/logger';

let importTask: Promise<void> | null = null;
let importId: string | null = null;
let startingImport = false;
let saveTask: Promise<void> | null = null;
let restoreTask: Promise<void> | null = null;
let drainingShare = false;
let shareSignalPending = false;
let startupTask: Promise<void> | null = null;
let incomingShare: NativeSharedZipResult | null = null;
const shareListeners = new Set<() => void>();

export function pendingSharedZip(): NativeSharedZipResult | null { return incomingShare; }
export function observePendingShare(listener: () => void): () => void {
  shareListeners.add(listener);
  return () => { shareListeners.delete(listener); };
}
function changedShare() { shareListeners.forEach((listener) => listener()); }

export async function chooseZip(): Promise<void> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/zip', 'application/x-zip-compressed'], copyToCacheDirectory: false, multiple: false
    });
    if (!result.canceled) await beginImport(result.assets[0].uri, result.assets[0].name);
  } catch (error) { usePipelineStore.getState().setError(error); }
}

export async function beginImport(uri: string, name: string): Promise<void> {
  if (startingImport || saveTask || usePipelineStore.getState().stage === 'saving') return;
  startingImport = true;
  try { await discardImport(uri === usePipelineStore.getState().zipUri); }
  catch (error) { startingImport = false; usePipelineStore.getState().setError(error); return; }
  const id = createOperationId('import');
  importId = id;
  const state = usePipelineStore.getState();
  state.setZip({ uri, name });
  state.startProgress(id, 'import');
  state.setStage('analyzing');
  const task = (async () => {
    try {
      const result = await importWhatsAppZip({ zipUri: uri, zipName: name, operationId: id,
        onProgress: (event) => { if (importId === id) usePipelineStore.getState().setProgress(event); } });
      if (importId === id) usePipelineStore.getState().setImportResult(result);
    } catch (error) {
      if (importId !== id) return;
      if (asPipelineError(error).code === 'CANCELLED') usePipelineStore.getState().reset();
      else usePipelineStore.getState().setError(error);
    }
  })();
  importTask = task;
  startingImport = false;
  try { await task; } finally { if (importTask === task) importTask = null; }
}

export async function discardImport(keepSource = false): Promise<void> {
  const state = usePipelineStore.getState();
  const native = getChatStampNativeModule();
  if (state.stage === 'saving' || saveTask) return;
  const retained = await native.getOperationSnapshotAsync();
  if (retained?.progress.kind === 'save' && retained.result) {
    await restoreSave();
    const remaining = await native.getOperationSnapshotAsync();
    if (remaining?.progress.kind === 'save' && remaining.result) {
      throw new PipelineError('IO_ERROR', 'The completed save must be stored in history before replacing it.');
    }
  }
  const previousId = importId ?? state.importOperationId ?? state.progress?.operationId;
  importId = null;
  if (importTask && previousId) {
    await native.cancelOperationAsync(previousId);
    await importTask;
  }
  if (state.workingDirectory) {
    if (keepSource) await clearWorkingDirectory(state.workingDirectory);
    else await native.releaseImportAsync(previousId ?? '', state.workingDirectory, state.zipUri ?? '');
  } else if (!keepSource && state.zipUri) {
    await native.releaseSourceAsync(state.zipUri);
  }
  if (state.progress?.kind === 'import' && isTerminalProgress(state.progress)) {
    await native.acknowledgeOperationAsync(state.progress.operationId);
  }
  state.reset();
}

export async function cancelCurrentOperation(): Promise<void> {
  const state = usePipelineStore.getState();
  if (state.stage === 'analyzing') importId = null;
  if (state.progress) await getChatStampNativeModule().cancelOperationAsync(state.progress.operationId);
  if (state.stage === 'analyzing') {
    await importTask;
    await discardImport();
  }
}

export async function startSaving(): Promise<void> {
  if (saveTask) return saveTask;
  const initial = usePipelineStore.getState();
  if (!initial.archiveFingerprint || !initial.workingDirectory) {
    initial.setError(new PipelineError('IO_ERROR'));
    return;
  }
  const operationId = createOperationId('save');
  initial.startProgress(operationId, 'save');
  initial.setStage('saving');
  const task = (async () => {
    try {
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
      const completion = await runSavePipeline({
        files: initial.mediaFiles, selectedSenders: initial.selectedSenders,
        selectedMediaTypes: initial.selectedMediaTypes, selectedFileIds: initial.selectedFileIds,
        archiveFingerprint: initial.archiveFingerprint!, workingDirectory: initial.workingDirectory,
        sourceUri: initial.zipUri, operationId, chatName: outputChatName(initial.zipName),
        settings: useSettingsStore.getState().settings,
        notificationTitle: i18n.t('operation.notificationTitle'), notificationCancelLabel: i18n.t('operation.cancel'),
        onProgress: (event) => usePipelineStore.getState().setProgress(event)
      });
      await finishSave(completion, { archiveFingerprint: initial.archiveFingerprint!, chatName: outputChatName(initial.zipName),
        workingDirectory: initial.workingDirectory, sourceUri: initial.zipUri, operationId });
    } catch (error) { usePipelineStore.getState().setError(error); }
  })();
  saveTask = task;
  try { await task; } finally { if (saveTask === task) saveTask = null; void drainSharedZip(); }
}

async function finishSave(completion: CompletionSummary, context: {
  archiveFingerprint: string; chatName: string; operationId: string; workingDirectory?: string; sourceUri?: string;
}) {
  const settings = useSettingsStore.getState();
  const state = usePipelineStore.getState();
  const folder = completion.outputDirectory ?? '';
  await useHistoryStore.getState().addHistoryItem(createExportHistoryItem({
    completion, files: state.mediaFiles, selectedFileIds: state.selectedFileIds,
    selectedMediaTypes: state.selectedMediaTypes, selectedSenders: state.selectedSenders,
    chatName: context.chatName, outputFolderPath: folder, archiveFingerprint: context.archiveFingerprint,
    folderTreeUri: completion.saveMethod === 'saf-custom-folder' ? settings.settings.customFolder?.treeUri : null
  }));
  if (folder) await settings.updateSettings({ lastOutputFolder: folder });
  if (completion.cacheCleared && context.workingDirectory) {
    await getChatStampNativeModule().releaseImportAsync(
      state.importOperationId ?? context.operationId, context.workingDirectory, context.sourceUri ?? '');
  }
  usePipelineStore.getState().setCompletion(completion);
  await getChatStampNativeModule().acknowledgeOperationAsync(context.operationId);
}

async function restoreSave(): Promise<void> {
  if (saveTask || restoreTask) return;
  const task = (async () => {
    const snapshot = await getChatStampNativeModule().getOperationSnapshotAsync();
    if (!snapshot || snapshot.progress.kind !== 'save') return;
    applySnapshot(snapshot);
    if (snapshot.result && isTerminalProgress(snapshot.progress)) {
      const completion = await summarizeNativeSave(snapshot.result, snapshot.workingDirectory);
      await finishSave(completion, { archiveFingerprint: snapshot.archiveFingerprint ?? '',
        chatName: snapshot.chatName ?? outputChatName(), operationId: snapshot.progress.operationId,
        workingDirectory: snapshot.workingDirectory, sourceUri: snapshot.sourceUri });
    } else if (snapshot.error) {
      usePipelineStore.getState().setError(new PipelineError(snapshot.error.code, snapshot.error.message, snapshot.error.missingBytes));
    }
  })();
  restoreTask = task;
  try { await task; } catch (error) { usePipelineStore.getState().setError(error); }
  finally { if (restoreTask === task) restoreTask = null; }
}

function applySnapshot(snapshot: OperationSnapshot) {
  const state = usePipelineStore.getState();
  if (state.progress?.operationId !== snapshot.progress.operationId) state.startProgress(snapshot.progress.operationId, 'save');
  usePipelineStore.setState({ workingDirectory: snapshot.workingDirectory, archiveFingerprint: snapshot.archiveFingerprint,
    zipUri: snapshot.sourceUri, zipName: snapshot.chatName, stage: 'saving' });
  usePipelineStore.getState().setProgress(snapshot.progress);
}

export async function acceptSharedZip(): Promise<void> {
  const share = incomingShare;
  incomingShare = null;
  changedShare();
  if (share?.sourceUri) await beginImport(share.sourceUri, share.filename ?? 'WhatsApp.zip');
  void drainSharedZip();
}

export async function dismissSharedZip(): Promise<void> {
  const share = incomingShare;
  incomingShare = null;
  changedShare();
  if (share?.sourceUri && share.sourceUri !== usePipelineStore.getState().zipUri) {
    await getChatStampNativeModule().releaseSourceAsync(share.sourceUri);
  }
  void drainSharedZip();
}

async function drainSharedZip(): Promise<void> {
  if (drainingShare) { shareSignalPending = true; return; }
  if (incomingShare || saveTask || usePipelineStore.getState().stage === 'saving') return;
  drainingShare = true;
  try {
    const share = await getChatStampNativeModule().consumePendingSharedZipAsync();
    if (!share.received) return;
    if (share.errorCode || !share.sourceUri) throw new PipelineError(share.errorCode ?? 'PERMISSION_LOST');
    const state = usePipelineStore.getState();
    if (startingImport || importTask || state.stage === 'selectFiles' || state.stage === 'outputOptions'
      || (state.workingDirectory && (state.stage === 'settings' || state.stage === 'history'))) {
      incomingShare = share;
      changedShare();
    } else {
      void beginImport(share.sourceUri, share.filename ?? 'WhatsApp.zip').finally(() => { void drainSharedZip(); });
    }
  } catch (error) { usePipelineStore.getState().setError(error); }
  finally {
    drainingShare = false;
    if (shareSignalPending) { shareSignalPending = false; void drainSharedZip(); }
  }
}

export function attachPipelineRuntime(): () => void {
  const native = getChatStampNativeModule();
  let initializing = true;
  const shared = native.addListener('onSharedZip', () => { if (!initializing) void drainSharedZip(); });
  const progress = native.addListener('onSaveProgress', (event) => {
    if (saveTask) return;
    const state = usePipelineStore.getState();
    if (state.progress?.operationId !== event.operationId) state.startProgress(event.operationId, 'save');
    state.setProgress(event);
    if (isTerminalProgress(event)) void restoreSave().then(drainSharedZip);
    else state.setStage('saving');
  });
  const active = AppState.addEventListener('change', (value) => {
    if (value === 'active') void restoreSave().then(drainSharedZip);
  });
  if (!startupTask) startupTask = (async () => {
      await restoreSave();
      const snapshot = await native.getOperationSnapshotAsync();
      if (snapshot?.progress.kind === 'import' && !importTask && !isTerminalProgress(snapshot.progress)) {
        await native.cancelOperationAsync(snapshot.progress.operationId);
      }
      await native.cleanupStaleJobsAsync();
    })();
  void startupTask.catch((error: unknown) => logger.warn('Runtime recovery failed', error)).finally(() => {
    initializing = false;
    void drainSharedZip();
  });
  return () => { shared.remove(); progress.remove(); active.remove(); };
}
