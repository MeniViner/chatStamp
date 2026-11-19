import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatParseResult } from '../src/lib/chatParser';
import type { NativeSaveMediaItem, NativeZipExtractionResult, OperationSnapshot } from '../src/native/chatStampNativeModule';
import type { AppSettings } from '../src/types/media';
import { defaultSettings } from '../src/store/settingsLogic';

const control = vi.hoisted(() => ({
  listeners: new Map<string, Set<(event: unknown) => void>>(),
  appListeners: new Set<(value: string) => void>(),
  snapshot: vi.fn(), consume: vi.fn(), cancel: vi.fn(), acknowledge: vi.fn(), cleanup: vi.fn(),
  releaseImport: vi.fn(), releaseSource: vi.fn(), extract: vi.fn(), save: vi.fn(),
  parse: vi.fn<typeof import('../src/lib/chatParser').parseWhatsAppChatTextAsync>(),
  picker: vi.fn(), makeDirectory: vi.fn(), read: vi.fn(), addHistory: vi.fn(), updateSettings: vi.fn(),
  settings: {} as AppSettings
}));

vi.mock('react-native', async () => {
  const { createElement } = await import('react');
  return {
    View: 'View', StyleSheet: { create: <T,>(value: T) => value, hairlineWidth: 1 },
    Platform: { OS: 'android', Version: 30 },
    PermissionsAndroid: { PERMISSIONS: { POST_NOTIFICATIONS: 'notifications' }, request: vi.fn() },
    BackHandler: { addEventListener: () => ({ remove: vi.fn() }) },
    AppState: { addEventListener: (_name: string, listener: (value: string) => void) => {
      control.appListeners.add(listener); return { remove: () => control.appListeners.delete(listener) };
    } },
    FlatList: ({ data, renderItem, ListHeaderComponent }: { data: unknown[]; renderItem: (value: { item: unknown; index: number }) => React.ReactNode; ListHeaderComponent?: React.ReactElement }) =>
      createElement('FlatList', {}, ListHeaderComponent, data.map((item, index) => createElement(React.Fragment, { key: index }, renderItem({ item, index }))))
  };
});
vi.mock('react-native-paper', () => ({ Text: 'Text', Snackbar: 'Snackbar' }));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: control.picker }));
vi.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', makeDirectoryAsync: control.makeDirectory, readAsStringAsync: control.read }));
vi.mock('../src/lib/chatParser', async (original) => ({
  ...await original<typeof import('../src/lib/chatParser')>(), parseWhatsAppChatTextAsync: control.parse
}));
vi.mock('../src/native/chatStampNativeModule', () => ({ getChatStampNativeModule: () => ({
  addListener: (name: string, listener: (event: unknown) => void) => {
    const listeners = control.listeners.get(name) ?? new Set<(event: unknown) => void>();
    listeners.add(listener); control.listeners.set(name, listeners);
    return { remove: () => listeners.delete(listener) };
  },
  getOperationSnapshotAsync: control.snapshot, consumePendingSharedZipAsync: control.consume,
  cancelOperationAsync: control.cancel, acknowledgeOperationAsync: control.acknowledge,
  cleanupStaleJobsAsync: control.cleanup, releaseImportAsync: control.releaseImport,
  releaseSourceAsync: control.releaseSource, extractSupportedZipEntriesAsync: control.extract, saveMediaAsync: control.save
}) }));
vi.mock('../src/store/settingsStore', () => ({ useSettingsStore: Object.assign(
  (select: (state: { settings: AppSettings }) => unknown) => select({ settings: control.settings }),
  { getState: () => ({ settings: control.settings, updateSettings: control.updateSettings }) }
) }));
vi.mock('../src/store/historyStore', () => ({ useHistoryStore: { getState: () => ({ addHistoryItem: control.addHistory }) }, createExportHistoryItem: () => ({ id: 'recovery-history' }) }));
vi.mock('../src/i18n', () => ({ default: { t: (key: string) => key } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en' } }) }));
vi.mock('../src/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../src/components/AppUi', () => ({ textStyles: { start: {} }, MediaThumbnail: 'MediaThumbnail', PrimaryButton: 'PrimaryButton', SecondaryButton: 'SecondaryButton', ExpandableTechnicalDetails: 'ExpandableTechnicalDetails', FilePathText: 'FilePathText' }));
vi.mock('../src/components/ConfirmDialog', () => ({ ConfirmDialog: 'ConfirmDialog' }));
vi.mock('../src/components/FolderFallbackSheet', () => ({ FolderFallbackSheet: 'FolderFallbackSheet' }));
vi.mock('../src/components/ShareOutputSheet', () => ({ ShareOutputSheet: 'ShareOutputSheet' }));
vi.mock('../src/screens/WizardScreen', async () => {
  const { createElement } = await import('react');
  return { FooterActions: 'FooterActions', WizardScreen: ({ children, footer }: { children?: React.ReactNode; footer?: React.ReactNode }) => createElement('WizardScreen', {}, children, footer) };
});
vi.mock('../src/native/androidIntents', () => ({ openFolderBestEffort: vi.fn(), openGalleryBestEffort: vi.fn(), openSavedFileBestEffort: vi.fn(), shouldShowOpenGallery: () => true }));
vi.mock('../src/theme/useAppTheme', () => ({ useAppTheme: () => ({ colors: { outlineVariant: '#aaa', onSurface: '#000', error: '#b00' } }) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const source = 'content://synthetic/first.zip';
const conversation = '2025-01-02, 10:00 - QA Dana: photo.jpg (file attached)';
const host = (name: string) => name as React.ElementType;
const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousAct = environment.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { environment.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { if (previousAct === undefined) delete environment.IS_REACT_ACT_ENVIRONMENT; else environment.IS_REACT_ACT_ENVIRONMENT = previousAct; });

describe('actual runtime recovery, retry UI and asynchronous import ownership', () => {
  let coordinator: typeof import('../src/services/operationCoordinator');
  let store: typeof import('../src/store/pipelineStore').usePipelineStore;
  let parser: typeof import('../src/lib/chatParser');
  const detach: (() => void)[] = [];
  const renderers: ReactTestRenderer[] = [];

  beforeEach(async () => {
    vi.resetModules(); vi.clearAllMocks();
    control.listeners.clear(); control.appListeners.clear();
    control.settings = structuredClone(defaultSettings);
    control.snapshot.mockReset().mockResolvedValue(null);
    control.consume.mockReset().mockResolvedValue({ received: false });
    for (const action of [control.cancel, control.acknowledge, control.cleanup, control.releaseImport,
      control.releaseSource, control.makeDirectory, control.addHistory, control.updateSettings]) action.mockReset().mockResolvedValue(undefined);
    control.picker.mockReset().mockResolvedValue({ canceled: true, assets: null });
    control.read.mockReset().mockResolvedValue(conversation);
    parser = await vi.importActual<typeof import('../src/lib/chatParser')>('../src/lib/chatParser');
    control.parse.mockReset().mockImplementation(async (text, files, options) => parser.parseWhatsAppChatText(text, files, options));
    control.extract.mockReset().mockImplementation(async (_uri: string, directory: string, operationId: string): Promise<NativeZipExtractionResult> => ({
      operationId, archiveFingerprint: 'a'.repeat(64), extractionMode: 'native-selective', extractedCount: 2, skippedCount: 0, skippedEntries: [],
      transcriptCandidates: [{ filename: '_chat.txt', sourcePath: '_chat.txt', uri: `${directory}_chat.txt`, sample: conversation, sizeBytes: conversation.length }],
      mediaFiles: [{ filename: 'photo.jpg', sourcePath: 'photo.jpg', uri: `${directory}photo.jpg`, sizeBytes: 1024 }]
    }));
    control.save.mockReset().mockImplementation(async (items: NativeSaveMediaItem[]) => ({ mode: 'scoped-media-store', results: items.map((item) => ({
      entryId: item.entryId, filename: item.filename, mediaType: item.mediaType, ok: true, outcome: 'saved', dateVerification: 'unverified',
      insertedUri: `content://media/${encodeURIComponent(item.entryId)}`, outputDirectory: '/Pictures/chatStamp/QA'
    })) }));
    coordinator = await import('../src/services/operationCoordinator');
    store = (await import('../src/store/pipelineStore')).usePipelineStore;
    store.getState().reset();
  });
  afterEach(async () => {
    detach.splice(0).forEach((remove) => remove());
    await act(async () => { renderers.splice(0).forEach((renderer) => renderer.unmount()); });
  });

  function emit(name: string, event?: unknown) { control.listeners.get(name)?.forEach((listener) => listener(event)); }
  async function attach() {
    detach.push(coordinator.attachPipelineRuntime());
    await vi.waitFor(() => expect(control.cleanup).toHaveBeenCalledOnce());
    await flush();
  }
  async function mountDone() {
    const { DoneScreen } = await import('../src/screens/DoneScreen');
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(React.createElement(DoneScreen)); renderers.push(renderer); });
    return renderer;
  }
  function button(renderer: ReactTestRenderer, label: string): ReactTestInstance {
    const found = renderer.root.findAllByType(host('SecondaryButton')).find((node) => node.props.children === label);
    expect(found, `Expected actionable ${label}`).toBeDefined();
    return found!;
  }
  function finishParse(gate: ReturnType<typeof deferred<ChatParseResult>>) {
    const args = control.parse.mock.calls[0];
    gate.resolve(parser.parseWhatsAppChatText(...args));
  }

  it.each(['failed', 'cancelled'] as const)('reattaches an active save, then offers explicit reimport for %s results with no JS inputs', async (outcome) => {
    let snapshot: OperationSnapshot | null = {
      progress: { operationId: 'save-survived-js', kind: 'save', phase: 'saving', filesDone: 1, totalFiles: 2, bytesDone: 1024, totalBytes: 2048, currentFileName: 'remaining.jpg' },
      archiveFingerprint: 'a'.repeat(64), chatName: 'QA', sourceUri: source, workingDirectory: 'file:///cache/chatstamp/retained-job/'
    };
    control.snapshot.mockImplementation(async () => snapshot);
    control.acknowledge.mockImplementation(async () => { snapshot = null; });
    await attach();
    expect(store.getState()).toMatchObject({ stage: 'saving', mediaFiles: [], progress: { filesDone: 1 } });
    expect(control.save).not.toHaveBeenCalled();
    snapshot = { ...snapshot!, progress: { ...snapshot!.progress, phase: outcome === 'cancelled' ? 'cancelled' : 'completed', filesDone: 2 }, result: {
      mode: 'scoped-media-store', results: [
        { entryId: 'saved', filename: 'saved.jpg', mediaType: 'photo', outcome: 'saved', ok: true, dateVerification: 'unverified', insertedUri: 'content://media/saved', outputDirectory: '/Pictures/chatStamp/QA' },
        { entryId: 'remaining', filename: 'remaining.jpg', mediaType: 'photo', outcome, ok: false, dateVerification: 'unverified', failureCode: outcome === 'failed' ? 'IO_ERROR' : 'CANCELLED' }
      ]
    } };
    emit('onSaveProgress', snapshot.progress);
    await vi.waitFor(() => expect(store.getState().stage).toBe('results'));
    const renderer = await mountDone();
    expect(store.getState()).toMatchObject({ workingDirectory: 'file:///cache/chatstamp/retained-job/', completion: { saved: 1, cacheCleared: false } });
    expect(renderer.root.findAllByType(host('Text')).some((node) => node.props.children === 'results.reimportRequired')).toBe(true);
    expect(renderer.root.findAllByType(host('SecondaryButton')).some((node) => ['results.retryRemainingFiles', 'results.retryFailedFiles'].includes(node.props.children))).toBe(false);
    const pendingPicker = deferred<{ canceled: true; assets: null }>();
    control.picker.mockReturnValueOnce(pendingPicker.promise);
    await act(async () => { button(renderer, 'results.reimportRemainingFiles').props.onPress(); await flush(); });
    expect(control.picker).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ copyToCacheDirectory: false }));
    expect(store.getState().stage).toBe('results');
    await act(async () => { pendingPicker.resolve({ canceled: true, assets: null }); await flush(); });
    expect(store.getState()).toMatchObject({ stage: 'results', workingDirectory: 'file:///cache/chatstamp/retained-job/', completion: { cacheCleared: false, saved: 1 } });
    expect(control.save).not.toHaveBeenCalled();
    expect(control.releaseImport).not.toHaveBeenCalled();
    expect(control.releaseSource).not.toHaveBeenCalled();
  });

  it('blocks an empty recovered Save before native submission, preserving the retained job and completion', async () => {
    store.setState({ stage: 'results', workingDirectory: 'file:///cache/chatstamp/retained-job/', archiveFingerprint: 'a'.repeat(64), zipUri: source,
      completion: { saved: 0, skipped: 0, failed: 1, dateCorrected: 0, dateCorrectionFailed: 0, mayShowImportTime: 0, cacheCleared: false } });
    const completion = store.getState().completion;
    await coordinator.startSaving();
    expect(control.save).not.toHaveBeenCalled();
    expect(control.releaseImport).not.toHaveBeenCalled();
    expect(control.releaseSource).not.toHaveBeenCalled();
    expect(store.getState().workingDirectory).toBe('file:///cache/chatstamp/retained-job/');
    expect(store.getState().completion).toBe(completion);
    expect(store.getState().progress).toBeUndefined();
  });

  it('keeps real in-session retry inputs and submits only the failed attachment', async () => {
    await coordinator.beginImport(source, 'first.zip');
    control.save.mockImplementationOnce(async (items: NativeSaveMediaItem[]) => ({ mode: 'scoped-media-store', results: items.map((item) => ({
      entryId: item.entryId, filename: item.filename, mediaType: item.mediaType,
      ok: item.filename !== 'photo.jpg', outcome: item.filename === 'photo.jpg' ? 'failed' : 'saved', dateVerification: 'unverified',
      failureCode: item.filename === 'photo.jpg' ? 'IO_ERROR' : undefined
    })) }));
    await coordinator.startSaving();
    expect(store.getState().completion).toMatchObject({ failed: 1, cacheCleared: false });
    const renderer = await mountDone();
    await act(async () => { button(renderer, 'results.retryFailedFiles').props.onPress(); await flush(); });
    expect(control.save).toHaveBeenCalledTimes(2);
    expect(control.save.mock.calls[1][0]).toEqual([expect.objectContaining({ filename: 'photo.jpg', sourceUri: expect.stringContaining('/extracted/photo.jpg') })]);
    expect(store.getState().completion).toMatchObject({ saved: 1, failed: 0 });
  });

  it.each(['discard', 'replacement-share'] as const)('releases a completed native import after deferred TS parsing before %s finishes', async (action) => {
    const parseGate = deferred<ChatParseResult>(), releaseGate = deferred<void>();
    control.parse.mockReturnValueOnce(parseGate.promise);
    control.releaseImport.mockReturnValueOnce(releaseGate.promise);
    if (action === 'replacement-share') await attach();
    const importing = coordinator.beginImport(source, 'first.zip');
    await vi.waitFor(() => expect(control.parse).toHaveBeenCalledOnce());
    const operationId = control.extract.mock.calls[0][2] as string;
    const workingDirectory = `file:///cache/chatstamp/${operationId}/`;
    expect(store.getState().workingDirectory).toBeUndefined();
    let replacement: Promise<void>;
    if (action === 'replacement-share') {
      control.consume.mockResolvedValueOnce({ received: true, id: 'next-share', sourceUri: 'content://synthetic/next.zip', filename: 'next.zip' });
      emit('onSharedZip');
      await vi.waitFor(() => expect(coordinator.pendingSharedZip()?.id).toBe('next-share'));
      replacement = coordinator.acceptSharedZip();
    } else replacement = coordinator.discardImport();
    await vi.waitFor(() => expect(control.cancel).toHaveBeenCalledWith(operationId));
    finishParse(parseGate);
    await vi.waitFor(() => expect(control.releaseImport).toHaveBeenCalledWith(operationId, workingDirectory, source));
    expect(control.extract).toHaveBeenCalledOnce();
    releaseGate.resolve();
    await Promise.all([importing, replacement]);
    if (action === 'replacement-share') {
      expect(control.extract).toHaveBeenCalledTimes(2);
      expect(control.extract.mock.calls[1][0]).toBe('content://synthetic/next.zip');
      expect(store.getState()).toMatchObject({ stage: 'selectFiles', zipUri: 'content://synthetic/next.zip' });
    } else expect(store.getState()).toMatchObject({ stage: 'welcome', workingDirectory: undefined });
  });

  it('retains the source grant while replacing a parse-pending import from the exact same URI', async () => {
    const gate = deferred<ChatParseResult>(); control.parse.mockReturnValueOnce(gate.promise);
    const first = coordinator.beginImport(source, 'first.zip');
    await vi.waitFor(() => expect(control.parse).toHaveBeenCalledOnce());
    const oldId = control.extract.mock.calls[0][2] as string;
    const next = coordinator.beginImport(source, 'first.zip');
    await vi.waitFor(() => expect(control.cancel).toHaveBeenCalledWith(oldId));
    finishParse(gate); await Promise.all([first, next]);
    expect(control.releaseImport).toHaveBeenCalledWith(oldId, `file:///cache/chatstamp/${oldId}/`, '');
    expect(control.releaseSource).not.toHaveBeenCalled();
    expect(control.extract).toHaveBeenCalledTimes(2);
    expect(store.getState()).toMatchObject({ stage: 'selectFiles', zipUri: source });
  });

  it.each([false, true])('refreshes the imported job after a snapshot await before replacement (same source: %s)', async (sameSource) => {
    const parseGate = deferred<ChatParseResult>(), snapshotGate = deferred<OperationSnapshot | null>(), releaseGate = deferred<void>();
    control.parse.mockReturnValueOnce(parseGate.promise);
    const first = coordinator.beginImport(source, 'first.zip');
    await vi.waitFor(() => expect(control.parse).toHaveBeenCalledOnce());
    const oldId = control.extract.mock.calls[0][2] as string;
    const workingDirectory = `file:///cache/chatstamp/${oldId}/`;
    control.snapshot.mockReturnValueOnce(snapshotGate.promise);
    control.releaseImport.mockReturnValueOnce(releaseGate.promise);
    const replacement = coordinator.beginImport(sameSource ? source : 'content://synthetic/next.zip', 'next.zip');
    await flush();
    finishParse(parseGate);
    await first;
    expect(store.getState()).toMatchObject({ stage: 'selectFiles', workingDirectory });
    snapshotGate.resolve(null);
    await vi.waitFor(() => expect(control.releaseImport).toHaveBeenCalledWith(expect.any(String), workingDirectory, sameSource ? '' : source));
    expect(control.extract).toHaveBeenCalledOnce();
    releaseGate.resolve();
    await replacement;
    expect(control.extract).toHaveBeenCalledTimes(2);
    if (sameSource) expect(control.releaseSource).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ stage: 'selectFiles', zipUri: sameSource ? source : 'content://synthetic/next.zip' });
  });

  it('blocks replacement and retains the stale job for cleanup retry if releasing its completed result fails', async () => {
    const gate = deferred<ChatParseResult>(); control.parse.mockReturnValueOnce(gate.promise);
    const first = coordinator.beginImport(source, 'first.zip');
    await vi.waitFor(() => expect(control.parse).toHaveBeenCalledOnce());
    const oldId = control.extract.mock.calls[0][2] as string;
    control.releaseImport.mockRejectedValueOnce(new Error('Synthetic cleanup failure'));
    const next = coordinator.beginImport('content://synthetic/next.zip', 'next.zip');
    await vi.waitFor(() => expect(control.cancel).toHaveBeenCalledWith(oldId));
    finishParse(gate); await Promise.all([first, next]);
    expect(control.extract).toHaveBeenCalledOnce();
    expect(store.getState()).toMatchObject({ stage: 'error', workingDirectory: `file:///cache/chatstamp/${oldId}/`, zipUri: source });
    control.releaseImport.mockResolvedValue(undefined);
    await coordinator.discardImport();
    expect(control.releaseImport).toHaveBeenLastCalledWith(oldId, `file:///cache/chatstamp/${oldId}/`, source);
    expect(store.getState()).toMatchObject({ stage: 'welcome', workingDirectory: undefined });
  });

  function expectReplacementOwnedByB() {
    const nextUri = 'content://synthetic/next.zip';
    expect(control.extract).toHaveBeenCalledTimes(2);
    const nextId = control.extract.mock.calls[1][2] as string;
    const nextDirectory = `file:///cache/chatstamp/${nextId}/`;
    expect(store.getState()).toMatchObject({ stage: 'selectFiles', zipUri: nextUri, workingDirectory: nextDirectory, importOperationId: nextId });
    expect(store.getState().mediaFiles).toHaveLength(2);
    expect(store.getState().selectedFileIds.size).toBe(2);
    expect(control.releaseImport.mock.calls.some((args) => args[1] === nextDirectory || args[2] === nextUri)).toBe(false);
    expect(control.releaseSource.mock.calls.some((args) => args[0] === nextUri)).toBe(false);
  }

  it('an old cancellation cannot discard an accepted replacement share after its native cancel finally returns', async () => {
    await attach();
    const parseGate = deferred<ChatParseResult>(), cancelGate = deferred<void>();
    control.parse.mockReturnValueOnce(parseGate.promise);
    const first = coordinator.beginImport(source, 'first.zip');
    await vi.waitFor(() => expect(control.parse).toHaveBeenCalledOnce());
    const oldId = control.extract.mock.calls[0][2] as string;
    control.cancel.mockReturnValueOnce(cancelGate.promise);
    const cancellingA = coordinator.cancelCurrentOperation();
    await vi.waitFor(() => expect(control.cancel).toHaveBeenCalledWith(oldId));
    control.consume.mockResolvedValueOnce({ received: true, id: 'replacement-during-cancel', sourceUri: 'content://synthetic/next.zip', filename: 'next.zip' });
    emit('onSharedZip');
    await vi.waitFor(() => expect(coordinator.pendingSharedZip()?.id).toBe('replacement-during-cancel'));
    const replacingWithB = coordinator.acceptSharedZip();
    finishParse(parseGate);
    await first; await flush();
    // A valid implementation may serialize B behind the pending cancel. If B
    // already completed, the old continuation must preserve that exact owner.
    if (control.extract.mock.calls.length === 2) expectReplacementOwnedByB();
    else expect(control.extract).toHaveBeenCalledOnce();
    cancelGate.resolve();
    await Promise.all([cancellingA, replacingWithB]);
    expectReplacementOwnedByB();
  });

  it.each(['source grant', 'import job'] as const)('a discarded import awaiting %s release cannot reset replacement B', async (releaseKind) => {
    if (releaseKind === 'source grant') control.extract.mockRejectedValueOnce(new Error('Synthetic invalid archive'));
    await coordinator.beginImport(source, 'first.zip');
    expect(store.getState()).toMatchObject({ stage: releaseKind === 'source grant' ? 'error' : 'selectFiles', zipUri: source });
    const gate = deferred<void>();
    const release = releaseKind === 'source grant' ? control.releaseSource : control.releaseImport;
    const previousReleases = release.mock.calls.length;
    release.mockReturnValueOnce(gate.promise);
    const discardingA = coordinator.discardImport();
    await vi.waitFor(() => expect(release).toHaveBeenCalledTimes(previousReleases + 1));
    const replacingWithB = coordinator.beginImport('content://synthetic/next.zip', 'next.zip');
    await flush();
    if (control.extract.mock.calls.length === 2) expectReplacementOwnedByB();
    else expect(control.extract).toHaveBeenCalledOnce();
    gate.resolve();
    await Promise.all([discardingA, replacingWithB]);
    expectReplacementOwnedByB();
  });
});
