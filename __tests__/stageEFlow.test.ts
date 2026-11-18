import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileSelectionScreen } from '../src/screens/FileSelectionScreen';
import { AppNavigator } from '../src/screens/AppNavigator';
import { usePipelineStore } from '../src/store/pipelineStore';
import type { ExtractedMediaFile } from '../src/types/media';

const control = vi.hoisted(() => ({
  listeners: [] as (() => boolean)[], width: 411, start: vi.fn(), capture: vi.fn(), discard: vi.fn(), cancel: vi.fn(),
  audio: { stop: vi.fn(), release: vi.fn(), play: vi.fn(), status: { playing: false }, activeId: undefined },
  video: { request: vi.fn(), failClosed: vi.fn() },
}));
vi.mock('react-native', () => ({ View: 'View', ScrollView: 'ScrollView', FlatList: 'FlatList',
  useWindowDimensions: () => ({ width: control.width, height: 891, scale: 1, fontScale: 1 }), Keyboard: { dismiss: vi.fn() },
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  BackHandler: { addEventListener: (_name: string, listener: () => boolean) => { control.listeners.push(listener); return { remove: () => { control.listeners.splice(control.listeners.indexOf(listener), 1); } }; } },
}));
vi.mock('react-native-paper', () => ({ Button: 'Button', Chip: 'Chip', IconButton: 'IconButton', Searchbar: 'Searchbar', Text: 'Text', TextInput: 'TextInput', Surface: 'Surface', ActivityIndicator: 'ActivityIndicator', ProgressBar: 'ProgressBar' }));
vi.mock('../src/components/MediaSelectionList', () => ({ MediaSelectionList: 'MediaSelectionList', SelectionFooter: 'SelectionFooter' }));
vi.mock('../src/components/MediaViewer', () => ({ MediaViewer: 'MediaViewer', useSharedMediaAudio: () => control.audio, useViewerVideoController: () => control.video }));
vi.mock('../src/components/useMediaThumbnails', () => ({ useMediaThumbnails: () => ({ thumbnails: new Map(), onViewableIds: () => undefined, onThumbnailError: () => undefined }) }));
vi.mock('../src/components/BottomSheet', () => ({ PremiumBottomSheet: 'PremiumBottomSheet' }));
vi.mock('../src/components/ConfirmDialog', () => ({ ConfirmDialog: 'ConfirmDialog' }));
vi.mock('../src/components/AppUi', async () => {
  const { createElement } = await import('react');
  return { textStyles: { start: {} }, PrimaryButton: 'PrimaryButton', SecondaryButton: 'SecondaryButton', PremiumCard: 'PremiumCard',
    AppScreenScaffold: ({ children, footer, actions, ...props }: { children?: React.ReactNode; footer?: React.ReactNode; actions?: React.ReactNode }) => createElement('AppScreenScaffold', props, actions, children, footer) };
});
vi.mock('../src/theme/useAppTheme', () => ({ useAppTheme: () => ({ colors: { onSurfaceVariant: '#456' } }) }));
vi.mock('react-i18next', () => {
  const t = (key: string, values?: Record<string, unknown>) => values ? `${key}|${JSON.stringify(values)}` : key;
  const value = { t, i18n: { resolvedLanguage: 'en' } }; return { useTranslation: () => value };
});
vi.mock('../src/services/operationCoordinator', () => ({ startSaving: control.start, captureSaveIntent: control.capture, discardImport: control.discard, cancelCurrentOperation: control.cancel,
  attachPipelineRuntime: () => () => undefined, observePendingShare: () => () => undefined, pendingSharedZip: () => null,
  acceptSharedZip: vi.fn(), dismissSharedZip: vi.fn() }));
vi.mock('../src/screens/ImportScreen', () => ({ ImportScreen: 'ImportScreen' }));
vi.mock('../src/screens/SettingsScreen', () => ({ SettingsScreen: 'SettingsScreen' }));
vi.mock('../src/screens/HistoryScreen', () => ({ HistoryScreen: 'HistoryScreen' }));
vi.mock('../src/screens/ErrorScreen', () => ({ ErrorScreen: 'ErrorScreen' }));
vi.mock('../src/screens/DoneScreen', () => ({ DoneScreen: 'DoneScreen' }));

const host = (name: string) => name as React.ElementType;
const renderers: ReactTestRenderer[] = [];
const env = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previous = env.IS_REACT_ACT_ENVIRONMENT;
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
beforeAll(() => { env.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { if (previous === undefined) delete env.IS_REACT_ACT_ENVIRONMENT; else env.IS_REACT_ACT_ENVIRONMENT = previous; });
const file = (id: string, mediaType: ExtractedMediaFile['mediaType'], sender: string, minute: number): ExtractedMediaFile => ({
  id, filename: `${id}.${mediaType === 'photo' ? 'jpg' : mediaType === 'video' ? 'mp4' : mediaType === 'voice' ? 'opus' : 'txt'}`, uri: `file:///synthetic/${id}`, normalizedFilename: id,
  mediaType, sizeBytes: 100, dateSource: 'chat', matchedRecord: { id, filename: id, normalizedFilename: id, sender,
    messageDateIso: `2019-02-26T10:${String(minute).padStart(2, '0')}:00Z`, rawLine: '' },
});
const files = [file('dana-photo', 'photo', 'QA Dana', 0), file('eli-photo', 'photo', 'QA Eli', 1), file('dana-voice', 'voice', 'QA Dana', 2), file('transcript', 'document', 'Chat transcript', 3)];
beforeEach(() => {
  usePipelineStore.getState().reset();
  usePipelineStore.setState({ stage: 'selectFiles', zipName: 'Synthetic.zip', workingDirectory: 'file:///cache/chatstamp/synthetic/', archiveFingerprint: 'a'.repeat(64), importOperationId: 'import-A', mediaFiles: files, selectedFileIds: new Set(files.map((entry) => entry.id)) });
  control.width = 411; control.listeners.length = 0;
  control.audio.stop.mockReset(); control.audio.play.mockReset(); control.audio.release.mockReset().mockResolvedValue(undefined);
  control.video.request.mockReset(); control.video.failClosed.mockReset();
  control.start.mockReset().mockImplementation(async () => usePipelineStore.getState().setStage('saving'));
  control.capture.mockReset().mockImplementation(() => {
    const current = usePipelineStore.getState();
    return { revision: 0, workingDirectory: current.workingDirectory, archiveFingerprint: current.archiveFingerprint, importOperationId: current.importOperationId };
  });
  control.discard.mockReset().mockImplementation(async () => usePipelineStore.getState().reset());
});
afterEach(async () => { await act(async () => renderers.splice(0).forEach((renderer) => renderer.unmount())); });
async function mount(navigator = false) {
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(navigator ? AppNavigator : FileSelectionScreen)); renderers.push(renderer); });
  return renderer;
}
const find = (renderer: ReactTestRenderer, name: string, predicate: (node: ReactTestInstance) => boolean = () => true) => renderer.root.findAllByType(host(name)).find(predicate)!;
const textIs = (text: string) => (node: ReactTestInstance) => JSON.stringify(node.props.children).includes(text);
async function press(node: ReactTestInstance) { await act(async () => { node.props.onPress(); await flush(); }); }
async function back() { await act(async () => { expect([...control.listeners].reverse().some((listener) => listener())).toBe(true); }); }

describe('actual Stage E Select and navigator integration', () => {
  it('starts with search and filter surfaces closed and newest dates first', async () => {
    const renderer = await mount();
    expect(renderer.root.findAllByType(host('Searchbar'))).toHaveLength(0);
    expect(renderer.root.findAllByType(host('PremiumBottomSheet')).every((node) => !node.props.visible)).toBe(true);
    expect(find(renderer, 'Chip', textIs('picker.newest')).props.selected).toBe(true);
    expect(find(renderer, 'MediaSelectionList').props.items.map((item: { id: string }) => item.id)).toEqual(['transcript', 'dana-voice', 'eli-photo', 'dana-photo']);
  });

  it('applies real case-insensitive search and visible-only clear/select without changing hidden choices', async () => {
    const renderer = await mount();
    await act(async () => find(renderer, 'MediaSelectionList').props.onToggle('dana-voice'));
    await press(find(renderer, 'IconButton', (node) => node.props.accessibilityLabel === 'picker.search'));
    await act(async () => find(renderer, 'Searchbar').props.onChangeText('  DANA  '));
    expect(find(renderer, 'MediaSelectionList').props.items.map((item: { id: string }) => item.id)).toEqual(['dana-voice', 'dana-photo']);
    expect(find(renderer, 'SelectionFooter').props).toMatchObject({ selected: 1, total: 2 });
    await act(async () => find(renderer, 'SelectionFooter').props.onToggleAll());
    expect(usePipelineStore.getState().selectedFileIds).toEqual(new Set(files.map((entry) => entry.id)));
    await act(async () => find(renderer, 'SelectionFooter').props.onToggleAll());
    expect(usePipelineStore.getState().selectedFileIds).toEqual(new Set(['eli-photo', 'transcript']));
    await act(async () => find(renderer, 'Searchbar').props.onChangeText('ELI-PHOTO'));
    expect(find(renderer, 'MediaSelectionList').props.items.map((item: { id: string }) => item.id)).toEqual(['eli-photo']);
    expect(find(renderer, 'SelectionFooter').props).toMatchObject({ selected: 1, total: 1 });
    await act(async () => find(renderer, 'Searchbar').props.onChangeText('no match'));
    expect(find(renderer, 'SelectionFooter').props).toMatchObject({ selected: 0, total: 0 });
  });

  it('keeps unknown-sender and undated supported files visible and formats known dates without seconds', async () => {
    const dated = file('known', 'photo', 'QA Dana', 29);
    dated.matchedRecord = { ...dated.matchedRecord!, messageDateIso: '2026-08-18T14:29:42Z' };
    const undated: ExtractedMediaFile = { id: 'undated', filename: 'undated.vcf', normalizedFilename: 'undated.vcf', uri: 'file:///synthetic/undated.vcf', mediaType: 'document', dateSource: 'none' };
    const estimate = Object.freeze({ id: 'estimate', filename: 'IMG-20190226-WA0001.jpg', normalizedFilename: 'img-20190226-wa0001.jpg', uri: 'file:///synthetic/estimate.jpg',
      mediaType: 'photo' as const, dateSource: 'filename' as const, dateIso: '2019-02-26T12:00:00Z', dateAmbiguous: true });
    usePipelineStore.setState({ mediaFiles: [undated, dated, estimate], selectedFileIds: new Set(['known', 'estimate', 'undated']) });
    const renderer = await mount();
    const shown = find(renderer, 'MediaSelectionList').props.items;
    expect(shown.map((item: { id: string }) => item.id)).toEqual(['known', 'estimate', 'undated']);
    expect(shown[2]).toMatchObject({ sender: 'fileSelection.unknownSender', dateLabel: 'picker.date.missing', dateBadge: 'missing', dayKey: null });
    expect(shown[1]).toMatchObject({ dateBadge: 'approximate', dayKey: '2019-02-26' });
    expect(estimate).toMatchObject({ dateSource: 'filename', dateAmbiguous: true });
    expect(shown[0].dateLabel).toBe(new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).format(new Date('2026-08-18T14:29:42Z')));
    expect(shown[0].dateLabel).not.toContain(':42');
    expect(find(renderer, 'SelectionFooter').props).toMatchObject({ selected: 3, total: 3 });
  });

  it('shows sender-scoped type counts and preserves all selected categories across real tab changes', async () => {
    const mixed = [file('A-photo', 'photo', 'Avi', 0), file('A-video', 'video', 'Avi', 1), file('A-voice', 'voice', 'Avi', 2), file('D-photo', 'photo', 'Dana', 3)];
    usePipelineStore.setState({ mediaFiles: mixed, selectedFileIds: new Set(mixed.map((entry) => entry.id)) });
    const renderer = await mount();
    await press(find(renderer, 'IconButton', (node) => node.props.accessibilityLabel === 'picker.filters'));
    await press(find(renderer, 'Chip', (node) => node.props.children === 'Dana'));
    expect(find(renderer, 'SelectionFooter').props).toMatchObject({ selected: 3, total: 3 });
    for (const [tab, id] of [['photos', 'A-photo'], ['videos', 'A-video'], ['voice', 'A-voice']] as const) {
      await press(find(renderer, 'Chip', textIs(`picker.tabs.${tab}`)));
      expect(find(renderer, 'MediaSelectionList').props.items.map((item: { id: string }) => item.id)).toEqual([id]);
      expect(find(renderer, 'SelectionFooter').props).toMatchObject({ selected: 1, total: 1 });
    }
    expect(usePipelineStore.getState().selectedFileIds).toEqual(new Set(mixed.map((entry) => entry.id)));
    await press(find(renderer, 'Chip', textIs('picker.tabs.all')));
    expect(find(renderer, 'SelectionFooter').props).toMatchObject({ selected: 3, total: 3 });
  });

  it('directly saves the active sender+Photos scope once after native release, retaining hidden choices', async () => {
    let release!: () => void; control.audio.release.mockReturnValueOnce(new Promise<void>((accept) => { release = accept; }));
    const renderer = await mount(true);
    await act(async () => find(renderer, 'MediaSelectionList').props.onToggle('dana-voice'));
    await press(find(renderer, 'IconButton', (node) => node.props.accessibilityLabel === 'picker.filters'));
    await press(find(renderer, 'Chip', textIs('QA Eli')));
    await press(find(renderer, 'Chip', textIs('picker.tabs.photos')));
    const footer = find(renderer, 'SelectionFooter');
    expect(footer.props).toMatchObject({ selected: 1, total: 1 });
    await act(async () => { footer.props.onSave(); footer.props.onSave(); await flush(); });
    expect(usePipelineStore.getState().pendingSaveIds).toEqual(['dana-photo']);
    expect(usePipelineStore.getState().stage).toBe('selectFiles');
    expect(usePipelineStore.getState().selectedFileIds).toEqual(new Set(['dana-photo', 'eli-photo', 'transcript']));
    expect(control.start).not.toHaveBeenCalled();
    await act(async () => { usePipelineStore.getState().toggleFile('dana-photo'); release(); await flush(); });
    expect(control.start).toHaveBeenCalledOnce();
    expect(usePipelineStore.getState().pendingSaveIds).toEqual(['dana-photo']);
    expect(usePipelineStore.getState().stage).toBe('saving');
    expect(find(renderer, 'AppScreenScaffold').props.stepLabel).toContain('"total":3');
    expect(find(renderer, 'AppScreenScaffold').props.stepLabel).toContain('"current":3');
    expect(renderer.root.findAllByType(host('MediaSelectionList'))).toEqual([]);
  });

  it('ignores a zero-selection save attempt without starting native release or Save', async () => {
    usePipelineStore.setState({ selectedFileIds: new Set() }); const renderer = await mount();
    await act(async () => find(renderer, 'SelectionFooter').props.onSave());
    expect(control.audio.release).not.toHaveBeenCalled(); expect(control.start).not.toHaveBeenCalled();
    expect(usePipelineStore.getState().pendingSaveIds).toBeUndefined();
  });

  it('shows a typed error if player release fails and never starts a save', async () => {
    control.audio.release.mockRejectedValueOnce(new Error('release failed')); const renderer = await mount();
    await act(async () => { find(renderer, 'SelectionFooter').props.onSave(); await flush(); });
    expect(control.start).not.toHaveBeenCalled(); expect(usePipelineStore.getState().stage).toBe('error');
    expect(usePipelineStore.getState().workingDirectory).toContain('/synthetic/');
  });

  it('resets real filter/date/tab state while retaining a deliberately cleared hidden selection', async () => {
    const renderer = await mount();
    await act(async () => find(renderer, 'MediaSelectionList').props.onToggle('dana-voice'));
    await press(find(renderer, 'IconButton', (node) => node.props.accessibilityLabel === 'picker.filters'));
    await press(find(renderer, 'Chip', textIs('QA Eli')));
    await press(find(renderer, 'Chip', textIs('picker.tabs.photos')));
    await act(async () => find(renderer, 'TextInput', (node) => node.props.accessibilityLabel === 'picker.from').props.onChangeText('2019-02-27'));
    expect(find(renderer, 'SelectionFooter').props.total).toBe(0);
    await press(find(renderer, 'Button', textIs('picker.reset')));
    expect(find(renderer, 'SelectionFooter').props).toMatchObject({ total: 4, selected: 3 });
    expect(usePipelineStore.getState().selectedFileIds.has('dana-voice')).toBe(false);
    expect(find(renderer, 'TextInput', (node) => node.props.accessibilityLabel === 'picker.from').props.value).toBe('');
  });

  it('Back closes viewer, then filters, then asks before discarding; dialog dismissal keeps import intact', async () => {
    const renderer = await mount();
    await act(async () => find(renderer, 'MediaSelectionList').props.onOpen('dana-photo'));
    expect(find(renderer, 'MediaViewer').props.currentId).toBe('dana-photo');
    await back(); expect(find(renderer, 'MediaViewer').props.currentId).toBeNull();
    expect(find(renderer, 'ConfirmDialog').props.visible).toBe(false);
    await press(find(renderer, 'IconButton', (node) => node.props.accessibilityLabel === 'picker.filters'));
    await back(); expect(find(renderer, 'PremiumBottomSheet', (node) => node.props.title === 'picker.filters').props.visible).toBe(false);
    await back(); expect(find(renderer, 'ConfirmDialog').props.visible).toBe(true);
    await act(async () => find(renderer, 'ConfirmDialog').props.onDismiss());
    expect(find(renderer, 'ConfirmDialog').props.visible).toBe(false); expect(control.discard).not.toHaveBeenCalled();
    expect(usePipelineStore.getState().selectedFileIds.size).toBe(4);
    await back(); await act(async () => { find(renderer, 'ConfirmDialog').props.onConfirm(); await flush(); });
    expect(control.discard).toHaveBeenCalledOnce(); expect(usePipelineStore.getState().stage).toBe('welcome');
  });

  it('supplies the real wide-layout grid boundary at600dp without changing selection', async () => {
    control.width = 600; const renderer = await mount();
    expect(find(renderer, 'MediaSelectionList').props.columns).toBe(5);
    expect(find(renderer, 'SelectionFooter').props).toMatchObject({ selected: 4, total: 4 });
  });

  it.each(['hardware Back', 'toolbar Back', 'Settings', 'unmount'] as const)('invalidates deferred Save A across %s and replacement import B', async (leave) => {
    let release!: () => void; control.audio.release.mockReturnValueOnce(new Promise<void>((accept) => { release = accept; }));
    const renderer = await mount();
    await act(async () => find(renderer, 'SelectionFooter').props.onSave());
    if (leave === 'hardware Back') await back();
    else if (leave === 'toolbar Back') await act(async () => find(renderer, 'AppScreenScaffold').props.onBack());
    else if (leave === 'Settings') await press(find(renderer, 'IconButton', (node) => node.props.accessibilityLabel === 'settings.title'));
    else { await act(async () => renderer.unmount()); renderers.splice(renderers.indexOf(renderer), 1); }
    if (leave === 'hardware Back' || leave === 'toolbar Back') await act(async () => { find(renderer, 'ConfirmDialog').props.onConfirm(); await flush(); });
    const next = file('B-only', 'photo', 'QA Next', 5);
    await act(async () => usePipelineStore.setState({ stage: 'selectFiles', workingDirectory: 'file:///cache/chatstamp/B/', archiveFingerprint: 'b'.repeat(64), importOperationId: 'import-B', mediaFiles: [next], selectedFileIds: new Set([next.id]), pendingSaveIds: undefined, error: undefined }));
    await act(async () => { release(); await flush(); });
    expect(control.start).not.toHaveBeenCalled();
    expect(usePipelineStore.getState()).toMatchObject({ stage: 'selectFiles', importOperationId: 'import-B', workingDirectory: 'file:///cache/chatstamp/B/', error: undefined });
    expect(usePipelineStore.getState().pendingSaveIds).toBeUndefined();
  });

  it('ignores a stale native-release rejection after its screen unmounted instead of setting an error on B', async () => {
    let reject!: (reason: Error) => void;
    control.audio.release.mockReturnValueOnce(new Promise<void>((_accept, fail) => { reject = fail; }));
    const renderer = await mount(); await act(async () => find(renderer, 'SelectionFooter').props.onSave());
    await act(async () => renderer.unmount()); renderers.splice(renderers.indexOf(renderer), 1);
    usePipelineStore.setState({ stage: 'selectFiles', importOperationId: 'import-B', workingDirectory: 'file:///cache/chatstamp/B/', error: undefined });
    await act(async () => { reject(new Error('old A release failed')); await flush(); });
    expect(control.start).not.toHaveBeenCalled(); expect(usePipelineStore.getState()).toMatchObject({ stage: 'selectFiles', importOperationId: 'import-B', error: undefined });
  });
});
