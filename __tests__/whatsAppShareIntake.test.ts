import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeSharedZipResult, NativeZipExtractionResult } from '../src/native/chatStampNativeModule';
import type { AppSettings } from '../src/types/media';
import { defaultSettings } from '../src/store/settingsLogic';

const control = vi.hoisted(() => ({
  listeners: new Map<string, Set<(value: unknown) => void>>(), appListeners: new Set<(value: string) => void>(),
  consume: vi.fn(), snapshot: vi.fn(), extract: vi.fn(), cancel: vi.fn(), acknowledge: vi.fn(), cleanup: vi.fn(),
  releaseSource: vi.fn(), releaseImport: vi.fn(), read: vi.fn(), copy: vi.fn(), mkdir: vi.fn(), picker: vi.fn(), permission: vi.fn(),
  settings: {} as AppSettings,
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 33 },
  PermissionsAndroid: { PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' }, request: control.permission },
  AppState: { addEventListener: (_name: string, callback: (value: string) => void) => {
    control.appListeners.add(callback); return { remove: () => control.appListeners.delete(callback) };
  } },
}));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: control.picker }));
vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/', makeDirectoryAsync: control.mkdir, readAsStringAsync: control.read, copyAsync: control.copy,
}));
vi.mock('../src/native/chatStampNativeModule', () => ({ getChatStampNativeModule: () => ({
  addListener: (name: string, callback: (value: unknown) => void) => {
    const entries = control.listeners.get(name) ?? new Set<(value: unknown) => void>();
    entries.add(callback); control.listeners.set(name, entries); return { remove: () => entries.delete(callback) };
  },
  consumePendingSharedZipAsync: control.consume, getOperationSnapshotAsync: control.snapshot,
  extractSupportedZipEntriesAsync: control.extract, cancelOperationAsync: control.cancel,
  acknowledgeOperationAsync: control.acknowledge, cleanupStaleJobsAsync: control.cleanup,
  releaseSourceAsync: control.releaseSource, releaseImportAsync: control.releaseImport,
}) }));
vi.mock('../src/services/pipelineService', () => ({ runSavePipeline: vi.fn(), summarizeNativeSave: vi.fn() }));
vi.mock('../src/store/historyStore', () => ({
  useHistoryStore: { getState: () => ({ addHistoryItem: vi.fn() }) }, createExportHistoryItem: vi.fn(),
}));
vi.mock('../src/store/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ settings: control.settings, updateSettings: vi.fn() }) },
}));
vi.mock('../src/i18n', () => ({ default: { t: (key: string) => key } }));
vi.mock('../src/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const conversation = '2019-02-26, 12:34 - QA Dana: photo.jpg (file attached)\nהמשך הודעה בעברית\n2019-02-27, 14:20 - QA Eli: שלום משפחה';
const directUri = 'chatstamp-share://11111111-1111-4111-8111-111111111111';
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
function extraction(directory: string, operationId: string): NativeZipExtractionResult {
  return { operationId, archiveFingerprint: 'a'.repeat(64), extractionMode: 'native-selective', extractedCount: 2, skippedCount: 0, skippedEntries: [],
    transcriptCandidates: [{ filename: '_chat.txt', sourcePath: '_chat.txt', uri: `${directory}_chat.txt`, sample: conversation, sizeBytes: Buffer.byteLength(conversation) }],
    mediaFiles: [{ filename: 'photo.jpg', sourcePath: 'photo.jpg', uri: `${directory}photo.jpg`, sizeBytes: 1024 }] };
}

describe('WhatsApp direct-share actual JS import boundary', () => {
  let coordinator: typeof import('../src/services/operationCoordinator');
  let store: typeof import('../src/store/pipelineStore').usePipelineStore;
  const detach: (() => void)[] = [];
  beforeEach(async () => {
    vi.resetModules(); vi.clearAllMocks(); control.listeners.clear(); control.appListeners.clear();
    control.settings = structuredClone(defaultSettings);
    control.consume.mockReset().mockResolvedValue({ received: false }); control.snapshot.mockReset().mockResolvedValue(null);
    for (const action of [control.cancel, control.acknowledge, control.cleanup, control.releaseSource, control.releaseImport, control.mkdir]) {
      action.mockReset().mockResolvedValue(undefined);
    }
    control.picker.mockReset().mockResolvedValue({ canceled: true, assets: null });
    control.read.mockReset().mockResolvedValue(conversation); control.copy.mockReset(); control.permission.mockReset();
    control.extract.mockReset().mockImplementation(async (_uri: string, directory: string, operationId: string) => extraction(directory, operationId));
    coordinator = await import('../src/services/operationCoordinator');
    store = (await import('../src/store/pipelineStore')).usePipelineStore; store.getState().reset();
  });
  afterEach(() => { detach.splice(0).forEach((remove) => remove()); });
  const emit = () => control.listeners.get('onSharedZip')?.forEach((callback) => callback(undefined));
  async function attach() {
    detach.push(coordinator.attachPipelineRuntime());
    await vi.waitFor(() => expect(control.cleanup).toHaveBeenCalledOnce()); await flush();
  }
  function assertNativeOnlySourceRead(source = directUri) {
    expect(control.extract).toHaveBeenCalledWith(source, expect.stringMatching(/^file:\/\/\/cache\/chatstamp\/.+\/extracted\/$/), expect.any(String));
    expect(control.read).toHaveBeenCalledTimes(1);
    expect(control.read.mock.calls[0][0]).toMatch(/^file:\/\/\/cache\/chatstamp\/.+\/extracted\/_chat\.txt$/);
    expect(control.copy).not.toHaveBeenCalled(); expect(control.picker).not.toHaveBeenCalled(); expect(control.permission).not.toHaveBeenCalled();
  }

  it.each(['cold', 'warm'] as const)('imports a %s native share lease without saving a ZIP or invoking the picker', async (launch) => {
    const delivery: NativeSharedZipResult = { received: true, id: `whatsapp-${launch}`, sourceUri: directUri,
      filename: 'WhatsApp Chat with Synthetic.zip', mimeType: 'application/octet-stream', sourceAction: 'android.intent.action.SEND' };
    if (launch === 'cold') control.consume.mockResolvedValueOnce(delivery);
    await attach();
    if (launch === 'warm') {
      control.appListeners.forEach((callback) => callback('background'));
      control.consume.mockResolvedValueOnce(delivery); emit(); emit();
      control.appListeners.forEach((callback) => callback('active'));
    }
    await vi.waitFor(() => expect(store.getState().stage).toBe('selectFiles'));
    assertNativeOnlySourceRead();
    expect(control.extract).toHaveBeenCalledTimes(1);
    expect(store.getState().zipUri).toBe(directUri);
    expect(store.getState().mediaFiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ filename: '_chat.txt', sourceKind: 'chat-transcript' }),
      expect.objectContaining({ filename: 'photo.jpg', matchedRecord: expect.objectContaining({ sender: 'QA Dana' }) }),
    ]));
    expect(store.getState().selectedFileIds.size).toBe(2);
  });

  it('coalesces notifications while native consume is pending and does not redispatch on runtime reattachment', async () => {
    await attach();
    const pending = deferred<NativeSharedZipResult>(); control.consume.mockReturnValueOnce(pending.promise);
    emit(); emit(); emit();
    pending.resolve({ received: true, id: 'single-delivery', sourceUri: directUri, filename: 'chat.zip' });
    await vi.waitFor(() => expect(store.getState().stage).toBe('selectFiles'));
    detach.pop()?.(); detach.push(coordinator.attachPipelineRuntime()); emit();
    await flush(); await flush();
    expect(control.extract).toHaveBeenCalledTimes(1); assertNativeOnlySourceRead();
    expect(coordinator.pendingSharedZip()).toBeNull();
  });

  it('exposes an expired-source error without requesting broad access or silently opening a picker', async () => {
    control.consume.mockResolvedValueOnce({ received: true, id: 'expired-share', errorCode: 'PERMISSION_LOST' });
    await attach(); await vi.waitFor(() => expect(store.getState().stage).toBe('error'));
    expect(store.getState().error?.code).toBe('PERMISSION_LOST');
    expect(control.extract).not.toHaveBeenCalled(); expect(control.read).not.toHaveBeenCalled();
    expect(control.permission).not.toHaveBeenCalled(); expect(control.picker).not.toHaveBeenCalled();
  });

  it('reports actual invalid ZIP bytes from native extraction and never reads the archive in JS', async () => {
    control.extract.mockRejectedValueOnce({ code: 'ZIP_INVALID' });
    control.consume.mockResolvedValueOnce({ received: true, id: 'invalid-share', sourceUri: directUri, filename: 'looks-valid.zip' });
    await attach(); await vi.waitFor(() => expect(store.getState().stage).toBe('error'));
    expect(store.getState().error?.code).toBe('ZIP_INVALID');
    expect(control.releaseImport).toHaveBeenCalled();
    expect(control.read).not.toHaveBeenCalled(); expect(control.copy).not.toHaveBeenCalled(); expect(control.picker).not.toHaveBeenCalled();
  });

  it('retains a direct second share during native extraction until replacement is explicitly chosen', async () => {
    const pending = deferred<NativeZipExtractionResult>();
    control.extract.mockReturnValueOnce(pending.promise);
    control.consume.mockResolvedValueOnce({ received: true, id: 'first', sourceUri: directUri, filename: 'first.zip' });
    await attach(); await vi.waitFor(() => expect(control.extract).toHaveBeenCalledTimes(1));
    const next = 'chatstamp-share://22222222-2222-4222-8222-222222222222';
    control.consume.mockResolvedValueOnce({ received: true, id: 'second', sourceUri: next, filename: 'second.zip' });
    emit(); await vi.waitFor(() => expect(coordinator.pendingSharedZip()?.id).toBe('second'));
    expect(store.getState().stage).toBe('analyzing'); expect(control.cancel).not.toHaveBeenCalled();
    await coordinator.dismissSharedZip();
    expect(control.releaseSource).toHaveBeenCalledExactlyOnceWith(next);
    const [, directory, operationId] = control.extract.mock.calls[0] as [string, string, string];
    pending.resolve(extraction(directory, operationId));
    await vi.waitFor(() => expect(store.getState().stage).toBe('selectFiles'));
    expect(store.getState().zipUri).toBe(directUri); expect(control.extract).toHaveBeenCalledTimes(1);
    expect(control.releaseSource).not.toHaveBeenCalledWith(directUri);
  });

  it('preserves an active import when a new unsupported share arrives and never accepts that error as replacement', async () => {
    const pending = deferred<NativeZipExtractionResult>(); control.extract.mockReturnValueOnce(pending.promise);
    control.consume.mockResolvedValueOnce({ received: true, id: 'active-valid', sourceUri: directUri, filename: 'first.zip' });
    await attach(); await vi.waitFor(() => expect(control.extract).toHaveBeenCalledTimes(1));
    control.consume.mockResolvedValueOnce({ received: true, id: 'unsupported-next', errorCode: 'SHARE_INVALID' }); emit();
    await vi.waitFor(() => expect(coordinator.pendingSharedZip()?.errorCode).toBe('SHARE_INVALID'));
    expect(store.getState()).toMatchObject({ stage: 'analyzing', zipUri: directUri, error: undefined });
    await coordinator.acceptSharedZip();
    expect(control.extract).toHaveBeenCalledTimes(1); expect(control.cancel).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ stage: 'analyzing', zipUri: directUri, error: undefined });
    const [, directory, operationId] = control.extract.mock.calls[0] as [string, string, string];
    pending.resolve(extraction(directory, operationId));
    await vi.waitFor(() => expect(store.getState().stage).toBe('selectFiles'));
    expect(store.getState().selectedFileIds.size).toBe(2);
  });
});
