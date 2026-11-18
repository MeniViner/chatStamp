import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportPipelineResult, ImportWhatsAppZipParams } from '../src/services/importService';
import type { AppSettings, CompletionSummary } from '../src/types/media';
import type { OperationSnapshot } from '../src/native/chatStampNativeModule';
import type { RunSavePipelineParams } from '../src/services/pipelineService';
import { defaultSettings } from '../src/store/settingsLogic';

const mocks = vi.hoisted(() => {
  const listeners = new Map<string, Set<(value: unknown) => void>>();
  const appListeners = new Set<(value: string) => void>();
  return {
    listeners, appListeners,
    native: {
      addListener: vi.fn((name: string, listener: (value: unknown) => void) => {
        const entries = listeners.get(name) ?? new Set<(value: unknown) => void>();
        entries.add(listener);
        listeners.set(name, entries);
        return { remove: () => { entries.delete(listener); } };
      }),
      consumePendingSharedZipAsync: vi.fn(),
      cancelOperationAsync: vi.fn(),
      acknowledgeOperationAsync: vi.fn(),
      getOperationSnapshotAsync: vi.fn(),
      cleanupStaleJobsAsync: vi.fn(),
      releaseImportAsync: vi.fn(),
      releaseSourceAsync: vi.fn()
    },
    importZip: vi.fn(), clearWorkingDirectory: vi.fn(), runSave: vi.fn(), summarizeSave: vi.fn(),
    addHistory: vi.fn(), createHistory: vi.fn(), updateSettings: vi.fn(), pick: vi.fn(), requestPermission: vi.fn(),
    settings: {} as AppSettings, translate: vi.fn()
  };
});

vi.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 33 },
  PermissionsAndroid: { PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' }, request: mocks.requestPermission },
  AppState: { addEventListener: (_name: string, listener: (value: string) => void) => {
    mocks.appListeners.add(listener);
    return { remove: () => { mocks.appListeners.delete(listener); } };
  } }
}));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: mocks.pick }));
vi.mock('../src/native/chatStampNativeModule', () => ({ getChatStampNativeModule: () => mocks.native }));
vi.mock('../src/services/importService', () => ({ importWhatsAppZip: mocks.importZip, clearWorkingDirectory: mocks.clearWorkingDirectory }));
vi.mock('../src/services/pipelineService', () => ({ runSavePipeline: mocks.runSave, summarizeNativeSave: mocks.summarizeSave }));
vi.mock('../src/store/historyStore', () => ({
  useHistoryStore: { getState: () => ({ addHistoryItem: mocks.addHistory }) }, createExportHistoryItem: mocks.createHistory
}));
vi.mock('../src/store/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ settings: mocks.settings, updateSettings: mocks.updateSettings }) }
}));
vi.mock('../src/i18n', () => ({ default: { t: mocks.translate } }));
vi.mock('../src/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

function imported(params: Partial<ImportPipelineResult> = {}): ImportPipelineResult {
  const workingDirectory = params.workingDirectory ?? 'file:///cache/chatstamp/import-fixture/';
  const record = { id: 'record-photo', filename: 'photo.jpg', normalizedFilename: 'photo.jpg', sender: 'QA Dana',
    messageDateIso: '2025-01-02T10:00:00Z', rawLine: '2025-01-02, 10:00 - QA Dana: photo.jpg (file attached)' };
  return {
    operationId: 'import-fixture', workingDirectory, archiveFingerprint: 'a'.repeat(64),
    chatRecords: [record], skippedChatLines: [], mediaFiles: [{ id: 'photo-entry', filename: 'photo.jpg', normalizedFilename: 'photo.jpg',
      uri: `${workingDirectory}extracted/photo.jpg`, sourcePath: 'photo.jpg', mediaType: 'photo', sourceKind: 'zip-media',
      sizeBytes: 4096, dateSource: 'chat', dateIso: record.messageDateIso, matchedRecord: record }],
    importSummary: {
      chatRecords: 1, skippedChatLines: 0, extractedEntries: 2, skippedZipEntries: 0, matchedMedia: 1, unmatchedMedia: 0,
      senders: 1, photos: 1, videos: 0, voice: 0, stickers: 0, documents: 0, unknown: 0, extractionMode: 'native-selective'
    },
    extraction: { extractedCount: 2, skippedCount: 0, extractionMode: 'native-selective' }, ...params
  };
}

const completion: CompletionSummary = {
  saved: 1, skipped: 0, failed: 0, dateCorrected: 1, dateCorrectionFailed: 0, mayShowImportTime: 0,
  cacheCleared: true, saveMethod: 'scoped-media-store', outputDirectory: '/storage/emulated/0/Pictures/chatStamp/Synthetic', results: []
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
}

function emit(name: string, value: unknown = undefined) {
  mocks.listeners.get(name)?.forEach((listener) => listener(value));
}

describe('pipeline runtime share and foreground-service coordination', () => {
  let coordinator: typeof import('../src/services/operationCoordinator');
  let store: typeof import('../src/store/pipelineStore').usePipelineStore;
  const detach: (() => void)[] = [];

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.listeners.clear();
    mocks.appListeners.clear();
    mocks.native.consumePendingSharedZipAsync.mockReset().mockResolvedValue({ received: false });
    mocks.native.cancelOperationAsync.mockReset().mockResolvedValue(undefined);
    mocks.native.acknowledgeOperationAsync.mockReset().mockResolvedValue(undefined);
    mocks.native.getOperationSnapshotAsync.mockReset().mockResolvedValue(null);
    mocks.native.cleanupStaleJobsAsync.mockReset().mockResolvedValue(undefined);
    mocks.native.releaseImportAsync.mockReset().mockResolvedValue(undefined);
    mocks.native.releaseSourceAsync.mockReset().mockResolvedValue(undefined);
    mocks.importZip.mockReset().mockImplementation(async (params: ImportWhatsAppZipParams) => imported({
      operationId: params.operationId, workingDirectory: `file:///cache/chatstamp/${params.operationId}/`
    }));
    mocks.clearWorkingDirectory.mockReset().mockResolvedValue(true);
    mocks.runSave.mockReset().mockResolvedValue(completion);
    mocks.summarizeSave.mockReset().mockResolvedValue(completion);
    mocks.addHistory.mockReset().mockResolvedValue(undefined);
    mocks.updateSettings.mockReset().mockResolvedValue(undefined);
    mocks.settings = structuredClone(defaultSettings);
    mocks.translate.mockReset().mockImplementation((key: string) => key);
    mocks.createHistory.mockReset().mockReturnValue({ id: 'a'.repeat(64) });
    mocks.requestPermission.mockReset().mockResolvedValue('denied');
    mocks.pick.mockReset().mockResolvedValue({ canceled: true, assets: null });
    coordinator = await import('../src/services/operationCoordinator');
    store = (await import('../src/store/pipelineStore')).usePipelineStore;
    store.getState().reset();
  });

  afterEach(() => {
    detach.splice(0).forEach((remove) => remove());
  });

  async function attach() {
    detach.push(coordinator.attachPipelineRuntime());
    await vi.waitFor(() => expect(mocks.native.cleanupStaleJobsAsync).toHaveBeenCalledOnce());
  }

  function retainCompletedNativeSave() {
    let retained: OperationSnapshot | null = null;
    mocks.native.getOperationSnapshotAsync.mockImplementation(async () => retained);
    mocks.native.acknowledgeOperationAsync.mockImplementation(async (operationId: string) => {
      if (retained?.progress.operationId === operationId) retained = null;
    });
    mocks.runSave.mockImplementationOnce(async (params: {
      operationId: string; onProgress?: (progress: OperationSnapshot['progress']) => void;
    }) => {
      retained = {
        progress: { operationId: params.operationId, kind: 'save', phase: 'completed', filesDone: 1, totalFiles: 1,
          bytesDone: 4096, totalBytes: 4096, currentFileName: 'photo.jpg' },
        archiveFingerprint: 'a'.repeat(64), chatName: 'Synthetic', workingDirectory: 'file:///cache/chatstamp/import-fixture/',
        sourceUri: 'content://provider/first.zip', result: { mode: 'scoped-media-store', results: [] }
      };
      params.onProgress?.(retained.progress);
      return completion;
    });
    store.getState().setZip({ uri: 'content://provider/first.zip', name: 'first.zip' });
    store.getState().setImportResult(imported());
    return () => retained;
  }

  it('uses the system picker URI without asking Expo to copy the ZIP', async () => {
    mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: 'content://documents/export.zip', name: 'export.zip' }] });
    await coordinator.chooseZip();
    expect(mocks.pick).toHaveBeenCalledWith(expect.objectContaining({ copyToCacheDirectory: false, multiple: false }));
    expect(mocks.importZip).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ zipUri: 'content://documents/export.zip' }));
    expect(store.getState().stage).toBe('selectFiles');
  });

  it('imports a cold-launch share once across duplicate events and runtime remount', async () => {
    mocks.native.consumePendingSharedZipAsync.mockResolvedValueOnce({
      received: true, id: 'share-cold', sourceUri: 'content://provider/cold.zip', filename: 'cold.zip'
    });
    await attach();
    await vi.waitFor(() => expect(mocks.importZip).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(store.getState().stage).toBe('selectFiles'));
    detach.pop()?.();
    await attach();
    emit('onSharedZip');
    emit('onSharedZip');
    await vi.waitFor(() => expect(mocks.native.consumePendingSharedZipAsync.mock.calls.length).toBeGreaterThan(1));
    expect(mocks.importZip).toHaveBeenCalledOnce();
    expect(coordinator.pendingSharedZip()).toBeNull();
  });

  it('coalesces concurrent warm-share notifications into one import', async () => {
    await attach();
    await vi.waitFor(() => expect(mocks.native.consumePendingSharedZipAsync).toHaveBeenCalledOnce());
    const received = deferred<{ received: boolean; id: string; sourceUri: string; filename: string }>();
    mocks.native.consumePendingSharedZipAsync.mockReturnValueOnce(received.promise);
    emit('onSharedZip');
    emit('onSharedZip');
    emit('onSharedZip');
    received.resolve({ received: true, id: 'share-warm', sourceUri: 'content://provider/warm.zip', filename: 'warm.zip' });
    await vi.waitFor(() => expect(mocks.importZip).toHaveBeenCalledOnce());
    expect(mocks.importZip).toHaveBeenCalledWith(expect.objectContaining({ zipUri: 'content://provider/warm.zip' }));
  });

  it('holds a share during import for confirmation and dismissal preserves the active import', async () => {
    await attach();
    const importing = deferred<ImportPipelineResult>();
    mocks.importZip.mockReturnValueOnce(importing.promise);
    const activeImport = coordinator.beginImport('content://provider/first.zip', 'first.zip');
    await vi.waitFor(() => expect(store.getState().stage).toBe('analyzing'));
    mocks.native.consumePendingSharedZipAsync.mockResolvedValueOnce({
      received: true, id: 'share-second', sourceUri: 'content://provider/second.zip', filename: 'second.zip'
    });
    emit('onSharedZip');
    await vi.waitFor(() => expect(coordinator.pendingSharedZip()?.id).toBe('share-second'));
    expect(mocks.importZip).toHaveBeenCalledOnce();
    expect(mocks.native.cancelOperationAsync).not.toHaveBeenCalled();
    await coordinator.dismissSharedZip();
    expect(mocks.native.releaseSourceAsync).toHaveBeenCalledWith('content://provider/second.zip');
    importing.resolve(imported());
    await activeImport;
    expect(store.getState().stage).toBe('selectFiles');
    expect(store.getState().zipUri).toBe('content://provider/first.zip');
  });

  it('prompts immediately for a second share while the first share-started import is unresolved', async () => {
    const importing = deferred<ImportPipelineResult>();
    mocks.importZip.mockReturnValueOnce(importing.promise);
    mocks.native.consumePendingSharedZipAsync.mockResolvedValueOnce({
      received: true, id: 'share-first', sourceUri: 'content://provider/first.zip', filename: 'first.zip'
    });
    await attach();
    await vi.waitFor(() => expect(store.getState().stage).toBe('analyzing'));
    mocks.native.consumePendingSharedZipAsync.mockResolvedValueOnce({
      received: true, id: 'share-second', sourceUri: 'content://provider/second.zip', filename: 'second.zip'
    });
    emit('onSharedZip');
    try {
      await vi.waitFor(() => expect(coordinator.pendingSharedZip()?.id).toBe('share-second'));
      expect(mocks.importZip).toHaveBeenCalledOnce();
      expect(mocks.native.cancelOperationAsync).not.toHaveBeenCalled();
      await coordinator.dismissSharedZip();
    } finally {
      importing.resolve(imported());
      await vi.waitFor(() => expect(store.getState().stage).toBe('selectFiles'));
    }
  });

  it('cancels the old import only after the owner accepts the replacement share', async () => {
    await attach();
    const importing = deferred<ImportPipelineResult>();
    mocks.importZip.mockReturnValueOnce(importing.promise);
    const oldImport = coordinator.beginImport('content://provider/first.zip', 'first.zip');
    await vi.waitFor(() => expect(store.getState().stage).toBe('analyzing'));
    mocks.native.consumePendingSharedZipAsync.mockResolvedValueOnce({
      received: true, id: 'share-second', sourceUri: 'content://provider/second.zip', filename: 'second.zip'
    });
    emit('onSharedZip');
    await vi.waitFor(() => expect(coordinator.pendingSharedZip()?.id).toBe('share-second'));
    expect(mocks.native.cancelOperationAsync).not.toHaveBeenCalled();
    mocks.native.cancelOperationAsync.mockImplementationOnce(async () => { importing.resolve(imported()); });
    await coordinator.acceptSharedZip();
    await oldImport;
    expect(mocks.native.cancelOperationAsync).toHaveBeenCalledOnce();
    expect(mocks.importZip).toHaveBeenCalledTimes(2);
    expect(store.getState().zipUri).toBe('content://provider/second.zip');
    expect(store.getState().stage).toBe('selectFiles');
  });

  it('keeps a share queued until a background save finishes even when notifications are denied', async () => {
    await attach();
    await vi.waitFor(() => expect(mocks.native.consumePendingSharedZipAsync).toHaveBeenCalledOnce());
    store.getState().setZip({ uri: 'content://provider/first.zip', name: 'first.zip' });
    store.getState().setImportResult(imported());
    const saving = deferred<CompletionSummary>();
    mocks.runSave.mockReturnValueOnce(saving.promise);
    const save = coordinator.startSaving();
    await vi.waitFor(() => expect(mocks.runSave).toHaveBeenCalledOnce());
    expect(mocks.requestPermission).toHaveBeenCalledExactlyOnceWith('android.permission.POST_NOTIFICATIONS');
    mocks.appListeners.forEach((listener) => listener('background'));
    mocks.native.consumePendingSharedZipAsync.mockResolvedValueOnce({
      received: true, id: 'share-after-save', sourceUri: 'content://provider/second.zip', filename: 'second.zip'
    });
    emit('onSharedZip');
    expect(mocks.native.consumePendingSharedZipAsync).toHaveBeenCalledOnce();
    expect(mocks.importZip).not.toHaveBeenCalled();
    saving.resolve(completion);
    await save;
    await vi.waitFor(() => expect(mocks.importZip).toHaveBeenCalledOnce());
    expect(mocks.addHistory).toHaveBeenCalledOnce();
    expect(mocks.native.acknowledgeOperationAsync).toHaveBeenCalledOnce();
    expect(mocks.importZip).toHaveBeenCalledWith(expect.objectContaining({ zipUri: 'content://provider/second.zip' }));
  });

  it('snapshots committed date, destination and organization settings before awaiting notification permission', async () => {
    const settingsAtSave: AppSettings = {
      ...structuredClone(defaultSettings), languagePreference: 'en', alwaysUseMessageDate: false,
      saveDestinationMode: 'custom-folder', useDefaultFolder: false,
      customFolder: { treeUri: 'content://tree/synthetic-A', displayName: 'Synthetic A', persistedPermission: true },
      outputOrganization: { mode: 'by-sender', duplicateHandling: 'skip-existing', createExportTimestampFolder: true }
    };
    mocks.settings = settingsAtSave;
    store.getState().setZip({ uri: 'content://provider/first.zip', name: 'first.zip' });
    store.getState().setImportResult(imported());
    const permission = deferred<string>();
    mocks.requestPermission.mockReturnValueOnce(permission.promise);
    const save = coordinator.startSaving(coordinator.captureSaveIntent()!);
    await vi.waitFor(() => expect(mocks.requestPermission).toHaveBeenCalledExactlyOnceWith('android.permission.POST_NOTIFICATIONS'));
    expect(mocks.runSave).not.toHaveBeenCalled();
    // A queued Settings write publishes a new immutable committed snapshot while
    // Android's permission dialog is still open. It belongs to the next save.
    mocks.settings = {
      ...structuredClone(defaultSettings), languagePreference: 'he', alwaysUseMessageDate: true,
      saveDestinationMode: 'default-accurate-folder', useDefaultFolder: true, customFolder: null,
      outputOrganization: { mode: 'by-type', duplicateHandling: 'replace-existing', createExportTimestampFolder: false }
    };
    permission.resolve('denied');
    await save;
    expect(mocks.runSave).toHaveBeenCalledOnce();
    const received = mocks.runSave.mock.calls[0][0] as RunSavePipelineParams;
    expect(received.settings).toEqual(settingsAtSave);
    expect(mocks.settings.alwaysUseMessageDate).toBe(true);
    expect(mocks.addHistory).toHaveBeenCalledOnce();
  });

  it('freezes translated notification copy together with folder labels before the permission dialog', async () => {
    const translate = (suffix: 'A' | 'B') => (key: string) => ({
      'operation.notificationTitle': `Saving ${suffix}`,
      'operation.cancel': `Cancel ${suffix}`,
      'outputFolders.importedChat': `Imported ${suffix}`,
      'outputFolders.media': `Media ${suffix}`
    }[key] ?? key);
    mocks.translate.mockImplementation(translate('A'));
    store.getState().setZip({ uri: 'content://provider/first.zip', name: 'first.zip' });
    store.getState().setImportResult(imported());
    const permission = deferred<string>(); mocks.requestPermission.mockReturnValueOnce(permission.promise);
    const save = coordinator.startSaving(coordinator.captureSaveIntent()!);
    await vi.waitFor(() => expect(mocks.requestPermission).toHaveBeenCalledOnce());
    expect(mocks.runSave).not.toHaveBeenCalled();
    mocks.translate.mockImplementation(translate('B'));
    permission.resolve('granted'); await save;
    expect(mocks.runSave).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      notificationTitle: 'Saving A', notificationCancelLabel: 'Cancel A',
      folderLabels: expect.objectContaining({ importedChat: 'Imported A', media: 'Media A' })
    }));
  });

  it('keeps the click-time policy when settings publish B before the captured intent starts saving', async () => {
    mocks.runSave.mockResolvedValueOnce({ ...completion, saveMethod: 'saf-custom-folder', outputDirectory: 'content://tree/click-A' });
    const settingsAtClick: AppSettings = {
      ...structuredClone(defaultSettings), alwaysUseMessageDate: false, languagePreference: 'en',
      saveDestinationMode: 'custom-folder', useDefaultFolder: false,
      customFolder: { treeUri: 'content://tree/click-A', displayName: 'Click A', persistedPermission: true },
      outputOrganization: { mode: 'by-sender', duplicateHandling: 'keep-both', createExportTimestampFolder: true }
    };
    const translate = (suffix: 'A' | 'B') => (key: string) => ({
      'operation.notificationTitle': `Saving ${suffix}`, 'operation.cancel': `Cancel ${suffix}`,
      'outputFolders.media': `Media ${suffix}`
    }[key] ?? key);
    mocks.settings = settingsAtClick; mocks.translate.mockImplementation(translate('A'));
    store.getState().setZip({ uri: 'content://provider/first.zip', name: 'first.zip' });
    store.getState().setImportResult(imported());
    const intent = coordinator.captureSaveIntent();
    expect(intent).not.toBeNull();
    expect(mocks.requestPermission).not.toHaveBeenCalled(); expect(mocks.runSave).not.toHaveBeenCalled();
    // Models a settings publication during the UI's audio-release barrier,
    // before startSaving is reached with the already accepted click intent.
    mocks.settings = {
      ...structuredClone(defaultSettings), alwaysUseMessageDate: true, languagePreference: 'he',
      saveDestinationMode: 'default-accurate-folder', customFolder: null,
      outputOrganization: { mode: 'by-type', duplicateHandling: 'replace-existing', createExportTimestampFolder: false }
    };
    mocks.translate.mockImplementation(translate('B'));
    await coordinator.startSaving(intent!);
    expect(mocks.runSave).toHaveBeenCalledOnce();
    const received = mocks.runSave.mock.calls[0][0] as RunSavePipelineParams;
    expect(received.settings).toEqual(settingsAtClick);
    expect(received.settings).not.toBe(settingsAtClick);
    expect(received.settings?.outputOrganization).not.toBe(settingsAtClick.outputOrganization);
    expect(received.settings?.customFolder).not.toBe(settingsAtClick.customFolder);
    expect(received).toMatchObject({ notificationTitle: 'Saving A', notificationCancelLabel: 'Cancel A', folderLabels: { media: 'Media A' } });
    expect(mocks.createHistory).toHaveBeenCalledWith(expect.objectContaining({ folderTreeUri: 'content://tree/click-A' }));
    expect(mocks.settings).toMatchObject({ alwaysUseMessageDate: true, languagePreference: 'he' });
  });

  it('reattaches to a background save and consumes its completion without starting a second save', async () => {
    let snapshot: OperationSnapshot | null = {
      progress: { operationId: 'save-restored', kind: 'save', phase: 'saving', filesDone: 2, totalFiles: 5,
        bytesDone: 4096, totalBytes: null, currentFileName: 'video.mp4' },
      archiveFingerprint: 'a'.repeat(64), chatName: 'Synthetic', workingDirectory: 'file:///cache/chatstamp/import-fixture/',
      sourceUri: 'content://provider/first.zip'
    };
    mocks.native.getOperationSnapshotAsync.mockImplementation(async () => snapshot);
    mocks.native.acknowledgeOperationAsync.mockImplementation(async () => { snapshot = null; });
    await attach();
    expect(store.getState()).toMatchObject({ stage: 'saving', progress: { operationId: 'save-restored', filesDone: 2 } });
    expect(mocks.runSave).not.toHaveBeenCalled();
    snapshot = { ...snapshot, progress: { ...snapshot.progress, phase: 'completed', filesDone: 5 },
      result: { mode: 'scoped-media-store', results: [] } };
    emit('onSaveProgress', snapshot.progress);
    await vi.waitFor(() => expect(store.getState().stage).toBe('results'));
    expect(mocks.summarizeSave).toHaveBeenCalledOnce();
    expect(mocks.addHistory).toHaveBeenCalledOnce();
    expect(mocks.native.acknowledgeOperationAsync).toHaveBeenCalledExactlyOnceWith('save-restored');
    const beforeActive = mocks.native.getOperationSnapshotAsync.mock.calls.length;
    mocks.appListeners.forEach((listener) => listener('active'));
    await vi.waitFor(() => expect(mocks.native.getOperationSnapshotAsync.mock.calls.length).toBeGreaterThan(beforeActive));
    expect(mocks.addHistory).toHaveBeenCalledOnce();
    expect(mocks.runSave).not.toHaveBeenCalled();
  });

  it('durably retries a completed save before acknowledging it or replacing its import', async () => {
    const retained = retainCompletedNativeSave();
    mocks.addHistory.mockRejectedValueOnce({ code: 'NO_SPACE', missingBytes: 4096 });
    await coordinator.startSaving();
    expect(store.getState()).toMatchObject({ stage: 'error', error: { code: 'NO_SPACE' } });
    const completedOperationId = retained()?.progress.operationId;
    expect(completedOperationId).toBeTruthy();
    expect(mocks.native.acknowledgeOperationAsync).not.toHaveBeenCalled();
    expect(mocks.native.releaseImportAsync).not.toHaveBeenCalled();

    await coordinator.beginImport('content://provider/second.zip', 'second.zip');
    expect(mocks.addHistory).toHaveBeenCalledTimes(2);
    expect(mocks.native.acknowledgeOperationAsync).toHaveBeenCalledExactlyOnceWith(completedOperationId);
    expect(retained()).toBeNull();
    expect(mocks.importZip).toHaveBeenCalledOnce();
    expect(store.getState()).toMatchObject({ stage: 'selectFiles', zipUri: 'content://provider/second.zip' });
    expect(mocks.addHistory.mock.invocationCallOrder[1]).toBeLessThan(mocks.native.acknowledgeOperationAsync.mock.invocationCallOrder[0]);
    expect(mocks.native.acknowledgeOperationAsync.mock.invocationCallOrder[0]).toBeLessThan(mocks.importZip.mock.invocationCallOrder[0]);
    expect(mocks.runSave).toHaveBeenCalledOnce();
  });

  it.each(['beginImport', 'chooseZip'] as const)('keeps the completed save and source when history still fails during %s', async (action) => {
    const retained = retainCompletedNativeSave();
    mocks.addHistory.mockRejectedValue({ code: 'IO_ERROR' });
    await coordinator.startSaving();
    expect(store.getState().stage).toBe('error');
    const original = retained();
    expect(original).not.toBeNull();
    if (action === 'chooseZip') {
      mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: 'content://provider/second.zip', name: 'second.zip' }] });
      await coordinator.chooseZip();
    } else {
      await coordinator.beginImport('content://provider/second.zip', 'second.zip');
    }
    expect(mocks.addHistory).toHaveBeenCalledTimes(2);
    expect(mocks.importZip).not.toHaveBeenCalled();
    expect(mocks.runSave).toHaveBeenCalledOnce();
    expect(mocks.native.acknowledgeOperationAsync).not.toHaveBeenCalled();
    expect(mocks.native.releaseImportAsync).not.toHaveBeenCalled();
    expect(mocks.native.releaseSourceAsync).not.toHaveBeenCalled();
    expect(mocks.clearWorkingDirectory).not.toHaveBeenCalled();
    expect(retained()).toEqual(original);
    expect(store.getState()).toMatchObject({
      stage: 'error', zipUri: 'content://provider/first.zip', workingDirectory: 'file:///cache/chatstamp/import-fixture/',
      error: { code: 'IO_ERROR' }
    });
  });

  it('detaches native and app-state subscriptions when the UI runtime unmounts', async () => {
    await attach();
    expect(mocks.appListeners.size).toBe(1);
    detach.pop()?.();
    expect(mocks.appListeners.size).toBe(0);
    expect([...mocks.listeners.values()].every((listeners) => listeners.size === 0)).toBe(true);
  });

  it('rejects restart when an already-consuming native share resolves, preserving that share for replacement', async () => {
    const consuming = deferred<{ received: boolean; id: string; sourceUri: string; filename: string }>();
    mocks.native.consumePendingSharedZipAsync.mockReturnValueOnce(consuming.promise);
    detach.push(coordinator.attachPipelineRuntime());
    await vi.waitFor(() => expect(mocks.native.consumePendingSharedZipAsync).toHaveBeenCalledOnce());
    const reservation = coordinator.reserveAppRestart();
    const rejection = expect(reservation).rejects.toThrow();
    consuming.resolve({ received: true, id: 'arrived-before-reload', sourceUri: 'content://provider/retained.zip', filename: 'retained.zip' });
    await rejection;
    expect(coordinator.pendingSharedZip()).toMatchObject({ id: 'arrived-before-reload', sourceUri: 'content://provider/retained.zip' });
    expect(mocks.importZip).not.toHaveBeenCalled();
    expect(mocks.native.releaseSourceAsync).not.toHaveBeenCalled();
    await coordinator.dismissSharedZip();
    expect(mocks.native.releaseSourceAsync).toHaveBeenCalledExactlyOnceWith('content://provider/retained.zip');
  });

  it('holds native intake and every new user kickoff until its idempotent restart reservation releases', async () => {
    store.getState().setZip({ uri: 'content://provider/first.zip', name: 'first.zip' });
    store.getState().setImportResult(imported());
    const release = await coordinator.reserveAppRestart();
    mocks.native.consumePendingSharedZipAsync.mockResolvedValueOnce({ received: true, id: 'queued-during-reload', sourceUri: 'content://provider/second.zip', filename: 'second.zip' });
    await attach(); emit('onSharedZip');
    await coordinator.chooseZip(); await coordinator.beginImport('content://provider/ignored.zip', 'ignored.zip'); await coordinator.startSaving();
    expect(mocks.pick).not.toHaveBeenCalled(); expect(mocks.importZip).not.toHaveBeenCalled(); expect(mocks.runSave).not.toHaveBeenCalled();
    expect(mocks.native.consumePendingSharedZipAsync).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ stage: 'selectFiles', zipUri: 'content://provider/first.zip' });
    release(); release();
    await vi.waitFor(() => expect(coordinator.pendingSharedZip()?.id).toBe('queued-during-reload'));
    expect(mocks.native.consumePendingSharedZipAsync).toHaveBeenCalledOnce();
    expect(mocks.importZip).not.toHaveBeenCalled();
  });

  it('cannot reserve a restart over a live import or cancel/drop its source', async () => {
    const importing = deferred<ImportPipelineResult>(); mocks.importZip.mockReturnValueOnce(importing.promise);
    const task = coordinator.beginImport('content://provider/live.zip', 'live.zip');
    await vi.waitFor(() => expect(mocks.importZip).toHaveBeenCalledOnce());
    await expect(coordinator.reserveAppRestart()).rejects.toThrow();
    expect(mocks.native.cancelOperationAsync).not.toHaveBeenCalled(); expect(mocks.native.releaseSourceAsync).not.toHaveBeenCalled();
    importing.resolve(imported()); await task;
    expect(store.getState()).toMatchObject({ stage: 'selectFiles', zipUri: 'content://provider/live.zip' });
  });

  it('cannot reserve a restart over a live save and lets the same save finish durably', async () => {
    store.getState().setZip({ uri: 'content://provider/first.zip', name: 'first.zip' }); store.getState().setImportResult(imported());
    const saving = deferred<CompletionSummary>(); mocks.runSave.mockReturnValueOnce(saving.promise);
    const task = coordinator.startSaving();
    await vi.waitFor(() => expect(mocks.runSave).toHaveBeenCalledOnce());
    await expect(coordinator.reserveAppRestart()).rejects.toThrow();
    expect(mocks.native.cancelOperationAsync).not.toHaveBeenCalled();
    saving.resolve(completion); await task;
    expect(mocks.addHistory).toHaveBeenCalledOnce(); expect(mocks.native.acknowledgeOperationAsync).toHaveBeenCalledOnce();
  });

  it('invalidates Save A before discard cleanup awaits, and refuses that intent again after replacement B', async () => {
    store.getState().setZip({ uri: 'content://provider/A.zip', name: 'A.zip' }); store.getState().setImportResult(imported());
    const intent = coordinator.captureSaveIntent(); expect(intent).not.toBeNull();
    const cleanup = deferred<null>(); mocks.native.getOperationSnapshotAsync.mockReturnValueOnce(cleanup.promise);
    const discarding = coordinator.discardImport();
    expect(store.getState().stage).toBe('selectFiles');
    await coordinator.startSaving(intent!);
    expect(mocks.runSave).not.toHaveBeenCalled(); expect(mocks.requestPermission).not.toHaveBeenCalled();
    cleanup.resolve(null); await discarding;
    mocks.importZip.mockImplementationOnce(async (params: ImportWhatsAppZipParams) => imported({ operationId: params.operationId, workingDirectory: 'file:///cache/chatstamp/B/', archiveFingerprint: 'b'.repeat(64) }));
    await coordinator.beginImport('content://provider/B.zip', 'B.zip');
    await coordinator.startSaving(intent!);
    expect(mocks.runSave).not.toHaveBeenCalled(); expect(mocks.requestPermission).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ stage: 'selectFiles', zipUri: 'content://provider/B.zip', workingDirectory: 'file:///cache/chatstamp/B/', error: undefined });
  });

  it('starts only one native save for two simultaneous valid requests from the same import intent', async () => {
    store.getState().setZip({ uri: 'content://provider/A.zip', name: 'A.zip' }); store.getState().setImportResult(imported());
    const intent = coordinator.captureSaveIntent(); expect(intent).not.toBeNull();
    const saving = deferred<CompletionSummary>(); mocks.runSave.mockReturnValueOnce(saving.promise);
    const first = coordinator.startSaving(intent!), second = coordinator.startSaving(intent!);
    await vi.waitFor(() => expect(mocks.runSave).toHaveBeenCalledOnce());
    expect(mocks.requestPermission).toHaveBeenCalledOnce();
    saving.resolve(completion); await Promise.all([first, second]);
    expect(mocks.addHistory).toHaveBeenCalledOnce(); expect(mocks.native.acknowledgeOperationAsync).toHaveBeenCalledOnce();
  });
});
