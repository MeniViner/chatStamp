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
import { displayOutputChatName, localizedOutputFolderLabels, outputChatName, type OutputFolderLabels } from '../lib/outputOrganization';
import type { AppSettings, CompletionSummary } from '../types/media';
import i18n from '../i18n';
import { logger } from '../lib/logger';
import { getSelectedSaveCandidates } from '../store/selectionLogic';

let importTask: Promise<void> | null = null;
let importId: string | null = null;
let startingImport = false;
let saveTask: Promise<void> | null = null;
let restoreTask: Promise<void> | null = null;
let drainingShare = false;
let shareSignalPending = false;
let startupTask: Promise<void> | null = null;
let incomingShare: NativeSharedZipResult | null = null;
let restartingApp = false;
let drainIdle: Promise<void> = Promise.resolve();
let importRevision = 0;
let importTransition: Promise<void> = Promise.resolve();
let pendingImportTransitions = 0;
const shareListeners = new Set<() => void>();
const retainedImportSources = new Set<string>();

/** Serialize ownership changes, without holding the queue during extraction. */
function transitionImport<T>(action: () => Promise<T>): Promise<T> {
  pendingImportTransitions++;
  startingImport = true;
  const transition = importTransition.then(action);
  importTransition = transition.then(() => undefined, () => undefined);
  return transition.finally(() => {
    pendingImportTransitions--;
    startingImport = pendingImportTransitions > 0;
  });
}

export type SaveIntent = Readonly<{
  revision: number; importOperationId?: string; workingDirectory: string; archiveFingerprint: string;
  policy: SavePolicy;
}>;

type SavePolicy = Readonly<{
  settings: AppSettings; folderLabels: OutputFolderLabels; chatFolderName: string;
  notificationTitle: string; notificationCancelLabel: string;
}>;

function captureSavePolicy(zipName?: string): SavePolicy {
  const current = useSettingsStore.getState().settings;
  const folderLabels = localizedOutputFolderLabels((key) => i18n.t(key));
  return {
    settings: { ...current, outputOrganization: { ...current.outputOrganization },
      customFolder: current.customFolder ? { ...current.customFolder } : current.customFolder },
    folderLabels, chatFolderName: displayOutputChatName(zipName, folderLabels),
    notificationTitle: i18n.t('operation.notificationTitle'), notificationCancelLabel: i18n.t('operation.cancel')
  };
}

export function captureSaveIntent(): SaveIntent | null {
  if (restartingApp || startingImport || importTask || saveTask) return null;
  const state = usePipelineStore.getState();
  return state.stage === 'selectFiles' && state.workingDirectory && state.archiveFingerprint
    ? { revision: importRevision, importOperationId: state.importOperationId,
      workingDirectory: state.workingDirectory, archiveFingerprint: state.archiveFingerprint,
      policy: captureSavePolicy(state.zipName) } : null;
}

/** Hold share intake in native storage until the next JS runtime starts. */
export async function reserveAppRestart(): Promise<() => void> {
  if (restartingApp) throw new PipelineError('IO_ERROR', 'A restart is already pending.');
  restartingApp = true;
  let released = false;
  const release = () => { if (released) return; released = true; restartingApp = false; void drainSharedZip(); };
  try {
    await drainIdle;
    if (startingImport || importTask || saveTask || restoreTask || incomingShare) {
      throw new PipelineError('IO_ERROR', 'Finish the current operation or shared import first.');
    }
    return release;
  } catch (error) { release(); throw error; }
}

export function pendingSharedZip(): NativeSharedZipResult | null { return incomingShare; }
export function observePendingShare(listener: () => void): () => void {
  shareListeners.add(listener);
  return () => { shareListeners.delete(listener); };
}
function changedShare() { shareListeners.forEach((listener) => listener()); }

export async function chooseZip(): Promise<void> {
  if (restartingApp) return;
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/zip', 'application/x-zip-compressed'], copyToCacheDirectory: false, multiple: false
    });
    if (!result.canceled) await beginImport(result.assets[0].uri, result.assets[0].name);
  } catch (error) { usePipelineStore.getState().setError(error); }
}

export async function beginImport(uri: string, name: string): Promise<void> {
  if (restartingApp || saveTask || usePipelineStore.getState().stage === 'saving') return;
  const started = await transitionImport(async () => {
    try {
      if (restartingApp || saveTask || usePipelineStore.getState().stage === 'saving') return null;
      await discardImportLocked(uri === usePipelineStore.getState().zipUri);
      if (saveTask || usePipelineStore.getState().stage === 'saving') return null;
      const id = createOperationId('import');
      importId = id;
      const state = usePipelineStore.getState();
      state.setZip({ uri, name });
      state.startProgress(id, 'import');
      state.setStage('analyzing');
      const task = (async () => {
        let cleaningStaleResult = false;
        let staleWorkingDirectory: string | undefined;
        try {
          const result = await importWhatsAppZip({ zipUri: uri, zipName: name, operationId: id,
            onProgress: (event) => { if (importId === id) usePipelineStore.getState().setProgress(event); } });
          if (importId === id) usePipelineStore.getState().setImportResult(result);
          else {
            cleaningStaleResult = true;
            staleWorkingDirectory = result.workingDirectory;
            await getChatStampNativeModule().releaseImportAsync(id, result.workingDirectory,
              retainedImportSources.has(id) ? '' : uri);
          }
        } catch (error) {
          if (cleaningStaleResult) {
            usePipelineStore.setState({ workingDirectory: staleWorkingDirectory, importOperationId: id });
            throw error;
          }
          if (importId !== id) return;
          if (asPipelineError(error).code === 'CANCELLED') usePipelineStore.getState().reset();
          else usePipelineStore.getState().setError(error);
        }
      })();
      importTask = task;
      return { id, task };
    } catch (error) {
      usePipelineStore.getState().setError(error);
      return null;
    }
  });
  if (!started) return;
  const { id, task } = started;
  try { await task; }
  catch (error) {
    if (importId === id || usePipelineStore.getState().importOperationId === id) usePipelineStore.getState().setError(error);
  }
  finally { if (importTask === task) importTask = null; }
}

export async function discardImport(keepSource = false): Promise<void> {
  return transitionImport(() => discardImportLocked(keepSource));
}

/** Called only inside transitionImport so cleanup cannot reset a replacement. */
async function discardImportLocked(keepSource = false): Promise<void> {
  const native = getChatStampNativeModule();
  if (usePipelineStore.getState().stage === 'saving' || saveTask) return;
  importRevision++;
  const retained = await native.getOperationSnapshotAsync();
  if (retained?.progress.kind === 'save' && retained.result) {
    await restoreSave();
    const remaining = await native.getOperationSnapshotAsync();
    if (remaining?.progress.kind === 'save' && remaining.result) {
      throw new PipelineError('IO_ERROR', 'The completed save must be stored in history before replacing it.');
    }
  }
  // Parsing may have published a completed import while the native snapshot or
  // history gate was awaited. Read its actual directory before invalidating it.
  const state = usePipelineStore.getState();
  if (state.stage === 'saving' || saveTask) return;
  const previousId = importId ?? state.importOperationId ?? state.progress?.operationId;
  const previousTask = importTask;
  importId = null;
  if (previousTask && previousId) {
    if (keepSource) retainedImportSources.add(previousId);
    try {
      await native.cancelOperationAsync(previousId);
      await previousTask;
    } finally { retainedImportSources.delete(previousId); }
  }
  if (state.workingDirectory) {
    if (keepSource) {
      if (!await clearWorkingDirectory(state.workingDirectory)) {
        throw new PipelineError('IO_ERROR', 'The previous import working files could not be removed.');
      }
    }
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
  if (state.stage !== 'analyzing') {
    if (state.progress) await getChatStampNativeModule().cancelOperationAsync(state.progress.operationId);
    return;
  }
  const cancelledId = state.progress?.operationId ?? importId ?? state.importOperationId;
  const pendingImport = importTask;
  await transitionImport(async () => {
    const current = usePipelineStore.getState();
    if (!cancelledId || (importId ?? current.importOperationId ?? current.progress?.operationId) !== cancelledId) return;
    try {
      importId = null;
      await getChatStampNativeModule().cancelOperationAsync(cancelledId);
      await pendingImport;
      await discardImportLocked();
    } catch (error) { usePipelineStore.getState().setError(error); }
  });
}

export async function startSaving(intent?: SaveIntent): Promise<void> {
  if (restartingApp || startingImport || importTask) return;
  if (saveTask) return saveTask;
  const initial = usePipelineStore.getState();
  if (intent && (incomingShare || initial.stage !== 'selectFiles' || intent.revision !== importRevision
    || intent.importOperationId !== initial.importOperationId || intent.workingDirectory !== initial.workingDirectory
    || intent.archiveFingerprint !== initial.archiveFingerprint)) return;
  if (!initial.archiveFingerprint || !initial.workingDirectory) {
    initial.setError(new PipelineError('IO_ERROR'));
    return;
  }
  if (getSelectedSaveCandidates(initial.mediaFiles, initial.selectedSenders, initial.selectedMediaTypes,
    initial.pendingSaveIds ?? initial.selectedFileIds).length === 0) {
    initial.setError(new PipelineError('IO_ERROR', 'Reimport the export before saving when no retry inputs remain.'));
    return;
  }
  const operationId = createOperationId('save');
  const policy = intent?.policy ?? captureSavePolicy(initial.zipName);
  initial.startProgress(operationId, 'save');
  initial.setStage('saving');
  const task = (async () => {
    try {
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
      const completion = await runSavePipeline({
        files: initial.mediaFiles, selectedSenders: initial.selectedSenders,
        selectedMediaTypes: initial.selectedMediaTypes, selectedFileIds: initial.pendingSaveIds ?? initial.selectedFileIds,
        archiveFingerprint: initial.archiveFingerprint!, workingDirectory: initial.workingDirectory,
        sourceUri: initial.zipUri, operationId, chatName: outputChatName(initial.zipName),
        ...policy,
        onProgress: (event) => usePipelineStore.getState().setProgress(event)
      });
      await finishSave(completion, { archiveFingerprint: initial.archiveFingerprint!, chatName: outputChatName(initial.zipName),
        workingDirectory: initial.workingDirectory, sourceUri: initial.zipUri, operationId,
        folderTreeUri: policy.settings.saveDestinationMode === 'custom-folder' ? policy.settings.customFolder?.treeUri : null });
    } catch (error) { usePipelineStore.getState().setError(error); }
  })();
  saveTask = task;
  try { await task; } finally { if (saveTask === task) saveTask = null; void drainSharedZip(); }
}

async function finishSave(completion: CompletionSummary, context: {
  archiveFingerprint: string; chatName: string; operationId: string; workingDirectory?: string; sourceUri?: string;
  folderTreeUri?: string | null;
}) {
  const settings = useSettingsStore.getState();
  const state = usePipelineStore.getState();
  const folder = completion.outputDirectory ?? '';
  await useHistoryStore.getState().addHistoryItem(createExportHistoryItem({
    completion, files: state.mediaFiles, selectedFileIds: state.pendingSaveIds ?? state.selectedFileIds,
    selectedMediaTypes: state.selectedMediaTypes, selectedSenders: state.selectedSenders,
    chatName: context.chatName, outputFolderPath: folder, archiveFingerprint: context.archiveFingerprint,
    folderTreeUri: completion.saveMethod === 'saf-custom-folder' ? context.folderTreeUri ?? null : null
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
  if (state.workingDirectory !== snapshot.workingDirectory || state.archiveFingerprint !== snapshot.archiveFingerprint) {
    usePipelineStore.setState({ mediaFiles: [], selectedSenders: [], selectedFileIds: new Set(), pendingSaveIds: undefined,
      importOperationId: undefined });
  }
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
  if (restartingApp) { shareSignalPending = true; return; }
  if (drainingShare) { shareSignalPending = true; return; }
  if (incomingShare || saveTask || usePipelineStore.getState().stage === 'saving') return;
  drainingShare = true;
  let resolveIdle: () => void = () => undefined;
  drainIdle = new Promise<void>((resolve) => { resolveIdle = resolve; });
  try {
    const share = await getChatStampNativeModule().consumePendingSharedZipAsync();
    if (!share.received) return;
    if (share.errorCode || !share.sourceUri) throw new PipelineError(share.errorCode ?? 'PERMISSION_LOST');
    if (restartingApp) {
      incomingShare = share; changedShare(); return;
    }
    const state = usePipelineStore.getState();
    if (startingImport || importTask || state.stage === 'selectFiles'
      || (state.workingDirectory && (state.stage === 'settings' || state.stage === 'history'))) {
      incomingShare = share;
      changedShare();
    } else {
      void beginImport(share.sourceUri, share.filename ?? 'WhatsApp.zip').finally(() => { void drainSharedZip(); });
    }
  } catch (error) { usePipelineStore.getState().setError(error); }
  finally {
    drainingShare = false;
    resolveIdle();
    if (shareSignalPending && !restartingApp) { shareSignalPending = false; void drainSharedZip(); }
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
    if (value === 'active' && !restartingApp) void restoreSave().then(drainSharedZip);
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
