import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createInstance } from 'i18next';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../src/i18n/locales/en.json';
import he from '../src/i18n/locales/he.json';
import { DoneScreen } from '../src/screens/DoneScreen';
import { HistoryScreen } from '../src/screens/HistoryScreen';
import { shareOutputFiles } from '../src/native/outputFiles';
import { usePipelineStore } from '../src/store/pipelineStore';
import { defaultSettings } from '../src/store/settingsLogic';
import type { ExportHistoryItem, MediaType, SaveFileResult } from '../src/types/media';

const control = vi.hoisted(() => ({ share: vi.fn(), items: [] as ExportHistoryItem[], details: vi.fn() }));
const translation = createInstance();
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: translation.t.bind(translation), i18n: translation }) }));
vi.mock('react-native', async () => {
  const { createElement } = await import('react');
  return {
    View: 'View', StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
    BackHandler: { addEventListener: () => ({ remove: vi.fn() }) },
    FlatList: ({ data, renderItem, ListHeaderComponent }: { data: unknown[]; renderItem: (item: { item: unknown; index: number }) => React.ReactNode; ListHeaderComponent?: React.ReactElement }) =>
      createElement('FlatList', {}, ListHeaderComponent, data.map((item, index) => createElement(React.Fragment, { key: index }, renderItem({ item, index }))))
  };
});
vi.mock('react-native-paper', async () => {
  const { createElement } = await import('react');
  return { Text: 'Text', Snackbar: 'Snackbar', IconButton: 'IconButton', Menu: Object.assign(
    ({ children, anchor }: { children?: React.ReactNode; anchor?: React.ReactNode }) => createElement('Menu', {}, anchor, children), { Item: 'MenuItem' }
  ) };
});
vi.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'Icon' }));
vi.mock('../src/components/AppUi', () => ({ textStyles: { start: {} }, MediaThumbnail: 'MediaThumbnail', PrimaryButton: 'PrimaryButton', SecondaryButton: 'SecondaryButton', ExpandableTechnicalDetails: 'ExpandableTechnicalDetails', FilePathText: 'FilePathText', PremiumCard: 'PremiumCard', StatusBadge: 'StatusBadge' }));
vi.mock('../src/components/BottomSheet', async () => {
  const { createElement } = await import('react');
  return { PremiumBottomSheet: ({ visible, children, footer, ...props }: { visible: boolean; children?: React.ReactNode; footer?: React.ReactNode }) =>
    visible ? createElement('PremiumBottomSheet', { ...props, visible }, children, footer) : null };
});
vi.mock('../src/components/ConfirmDialog', () => ({ ConfirmDialog: 'ConfirmDialog' }));
vi.mock('../src/components/FolderFallbackSheet', () => ({ FolderFallbackSheet: 'FolderFallbackSheet' }));
vi.mock('../src/screens/WizardScreen', async () => {
  const { createElement } = await import('react');
  return { FooterActions: 'FooterActions', WizardScreen: ({ children, footer }: { children?: React.ReactNode; footer?: React.ReactNode }) => createElement('WizardScreen', {}, children, footer) };
});
vi.mock('../src/store/settingsStore', () => ({ useSettingsStore: (select: (state: { settings: typeof defaultSettings }) => unknown) => select({ settings: defaultSettings }) }));
vi.mock('../src/store/historyStore', () => ({ useHistoryStore: (select: (state: unknown) => unknown) => select({ items: control.items, loadHistoryDetails: control.details, deleteHistoryItem: vi.fn() }) }));
vi.mock('../src/services/operationCoordinator', () => ({ chooseZip: vi.fn(), discardImport: vi.fn(), startSaving: vi.fn() }));
vi.mock('../src/native/chatStampNativeModule', () => ({ getChatStampNativeModule: () => ({ shareOutputFilesAsync: control.share, deleteOutputFilesAsync: vi.fn() }) }));
vi.mock('../src/native/androidIntents', () => ({ openFolderBestEffort: vi.fn(), openGalleryBestEffort: vi.fn(), openSavedFileBestEffort: vi.fn(), shouldShowOpenGallery: () => true }));
vi.mock('../src/theme/useAppTheme', () => ({ useAppTheme: () => ({ colors: new Proxy<Record<string, string>>({}, { get: () => '#123456' }) }) }));
vi.mock('../src/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const host = (name: string) => name as React.ElementType;
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const renderers: ReactTestRenderer[] = [];
const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousAct = environment.IS_REACT_ACT_ENVIRONMENT;
beforeAll(async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  await translation.init({ lng: 'en', fallbackLng: false, resources: { en: { translation: en }, he: { translation: he } }, interpolation: { escapeValue: false } });
});
afterAll(() => { if (previousAct === undefined) delete environment.IS_REACT_ACT_ENVIRONMENT; else environment.IS_REACT_ACT_ENVIRONMENT = previousAct; });
beforeEach(async () => {
  usePipelineStore.getState().reset();
  control.items = [];
  control.details.mockReset().mockResolvedValue(undefined);
  control.share.mockReset().mockResolvedValue({ opened: true });
  await translation.changeLanguage('en');
});
afterEach(async () => { await act(async () => renderers.splice(0).forEach((renderer) => renderer.unmount())); });

function rows(count: number, mediaType: MediaType = 'photo', prefix: string = mediaType): SaveFileResult[] {
  return Array.from({ length: count }, (_, index) => ({
    entryId: `${prefix}-${index + 1}`, filename: `${prefix}-${index + 1}.bin`, mediaType,
    ok: true, outcome: 'saved', dateVerification: 'unverified', dateCorrectionVerified: false,
    galleryMaySortByImportTime: false, insertedUri: `content://synthetic/${prefix}-${index + 1}`,
    outputDirectory: '/Pictures/chatStamp/QA'
  }));
}
function history(results: SaveFileResult[]): ExportHistoryItem {
  return { id: 'share-history', chatName: 'QA', exportTimestampIso: '2025-01-02T10:00:00Z', outputFolderPath: '/Pictures/chatStamp/QA',
    selectedSenders: [], counts: { totalSaved: results.length, photos: results.filter((row) => row.mediaType === 'photo').length,
      videos: results.filter((row) => row.mediaType === 'video').length, voice: results.filter((row) => row.mediaType === 'voice').length,
      stickers: 0, documents: 0, failed: 0, cancelled: 0 }, saveMethod: 'scoped-media-store', allFilesHadTimestampsFixed: false, savedFiles: results };
}
async function mount(screen: 'done' | 'history', results: SaveFileResult[]) {
  usePipelineStore.getState().setCompletion({ saved: results.filter((row) => row.ok).length, skipped: 0, failed: 0,
    dateCorrected: 0, dateCorrectionFailed: 0, mayShowImportTime: 0, cacheCleared: true, results });
  control.items = [history(results)];
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(screen === 'done' ? DoneScreen : HistoryScreen)); renderers.push(renderer); });
  const label = translation.t(screen === 'done' ? 'results.shareOutputFiles' : 'history.shareFiles');
  await press(findButton(renderer.root, label));
  return renderer;
}
function findButton(root: ReactTestInstance, label: string) {
  const button = root.findAll((node) => [host('PrimaryButton'), host('SecondaryButton')].includes(node.type as React.ElementType)
    && node.props.children === label)[0];
  expect(button, `Expected visible action: ${label}`).toBeDefined();
  return button;
}
function sheet(renderer: ReactTestRenderer) { return renderer.root.findByType(host('PremiumBottomSheet')); }
function action(renderer: ReactTestRenderer, key: string) { return findButton(sheet(renderer), translation.t(key)); }
async function press(button: ReactTestInstance) { await act(async () => { button.props.onPress(); await flush(); }); }
function expectRange(renderer: ReactTestRenderer, from: number, to: number, total: number) {
  const label = translation.t('results.shareBatchRange', { from, to, total });
  expect(sheet(renderer).findAllByType(host('Text')).some((node) => node.props.children === label)).toBe(true);
  expect(label).not.toMatch(/\{\{|results\./);
}
function requestedFilenames(call: number) {
  return (control.share.mock.calls[call][0] as { filename: string }[]).map((file) => file.filename);
}

describe('bounded native share boundary without silent truncation', () => {
  it('passes exactly 100 selected files, preserving every file and its order', async () => {
    const files = rows(100);
    await shareOutputFiles(files, ['photo']);
    expect(control.share).toHaveBeenCalledOnce();
    expect(requestedFilenames(0)).toEqual(files.map((file) => file.filename));
  });

  it.each(['one category', 'all categories'] as const)('rejects an oversized %s request before any chooser opens', async (scope) => {
    const files = scope === 'one category' ? rows(101) : [...rows(60), ...rows(50, 'video')];
    await expect(shareOutputFiles(files, scope === 'one category' ? ['photo'] : ['photo', 'video']))
      .rejects.toMatchObject({ name: 'ShareLimitError', count: files.length });
    expect(control.share).not.toHaveBeenCalled();
  });

  it('counts only successful files in the chosen category rather than truncating a larger unrelated result list', async () => {
    const files = [...rows(110), ...rows(10, 'video'), { ...rows(1, 'video', 'failed')[0], ok: false, outcome: 'failed' as const }];
    await shareOutputFiles(files, ['video']);
    expect(control.share).toHaveBeenCalledOnce();
    expect(requestedFilenames(0)).toEqual(files.filter((file) => file.ok && file.mediaType === 'video').map((file) => file.filename));
  });
});

describe.each(['done', 'history'] as const)('actual %s share entry and user-controlled remainder', (screen) => {
  it('makes photo 101 reachable as an explicit second share, with no automatic chooser or delivery claim', async () => {
    const files = rows(101);
    const renderer = await mount(screen, files);
    expectRange(renderer, 1, 100, 101);
    expect(action(renderer, 'results.sharePreviousBatch').props.disabled).toBe(true);
    expect(action(renderer, 'results.shareNextBatch').props.disabled).toBe(false);
    await press(action(renderer, 'results.shareAction'));
    expect(control.share).toHaveBeenCalledOnce();
    expect(requestedFilenames(0)).toEqual(files.slice(0, 100).map((file) => file.filename));
    expectRange(renderer, 1, 100, 101);
    expect(sheet(renderer).findAllByType(host('Text')).some((node) => node.props.children === translation.t('results.shareBatchHint', { limit: 100 }))).toBe(true);
    await flush();
    expect(control.share).toHaveBeenCalledOnce();
    await press(action(renderer, 'results.shareNextBatch'));
    expectRange(renderer, 101, 101, 101);
    expect(control.share).toHaveBeenCalledOnce();
    expect(action(renderer, 'results.shareNextBatch').props.disabled).toBe(true);
    await press(action(renderer, 'results.shareAction'));
    expect(control.share).toHaveBeenCalledTimes(2);
    expect(requestedFilenames(1)).toEqual([files[100].filename]);
    expect(new Set([...requestedFilenames(0), ...requestedFilenames(1)]).size).toBe(101);
    expect(renderer.root.findByType(host('Snackbar')).props.visible).toBe(false);
    expectRange(renderer, 101, 101, 101);
  });

  it.each(['en', 'he'] as const)('shares all mixed categories completely in labelled batches with %s copy', async (language) => {
    await translation.changeLanguage(language);
    const files = [...rows(65), ...rows(60, 'video'), ...rows(55, 'voice')];
    const renderer = await mount(screen, files);
    await press(findButton(sheet(renderer), translation.t('results.shareAll', { count: 180 })));
    expectRange(renderer, 1, 100, 180);
    await press(action(renderer, 'results.shareAction'));
    expect(requestedFilenames(0)).toEqual(files.slice(0, 100).map((file) => file.filename));
    await press(action(renderer, 'results.shareNextBatch'));
    expectRange(renderer, 101, 180, 180);
    await press(action(renderer, 'results.shareAction'));
    expect(control.share).toHaveBeenCalledTimes(2);
    expect(requestedFilenames(1)).toEqual(files.slice(100).map((file) => file.filename));
    expect(requestedFilenames(0).length).toBeLessThanOrEqual(100);
    expect(requestedFilenames(1).length).toBeLessThanOrEqual(100);
    expect([...requestedFilenames(0), ...requestedFilenames(1)]).toEqual(files.map((file) => file.filename));
    expectRange(renderer, 101, 180, 180);
  });

  it('resets the range after category changes and permits revisiting a previous batch', async () => {
    const renderer = await mount(screen, [...rows(101), ...rows(4, 'video')]);
    await press(action(renderer, 'results.shareNextBatch'));
    expectRange(renderer, 101, 105, 105);
    await press(action(renderer, 'results.sharePreviousBatch'));
    expectRange(renderer, 1, 100, 105);
    await press(action(renderer, 'results.shareNextBatch'));
    await press(findButton(sheet(renderer), translation.t('results.shareCategory', { label: translation.t('media.plural.photo'), count: 101 })));
    expectRange(renderer, 1, 4, 4);
    expect(sheet(renderer).findAllByType(host('SecondaryButton')).some((node) => node.props.children === translation.t('results.shareNextBatch'))).toBe(false);
    await press(action(renderer, 'results.shareAction'));
    expect(requestedFilenames(0)).toEqual(rows(4, 'video').map((file) => file.filename));
  });

  it('shows chooser failure without dismissing or advancing the current batch', async () => {
    control.share.mockResolvedValueOnce({ opened: false });
    const renderer = await mount(screen, rows(101));
    await press(action(renderer, 'results.shareAction'));
    expect(renderer.root.findByType(host('Snackbar')).props).toMatchObject({ visible: true, children: translation.t('results.shareFailed') });
    expectRange(renderer, 1, 100, 101);
    expect(control.share).toHaveBeenCalledOnce();
  });
});

it('prevents duplicate chooser requests and batch changes while a real share call is unresolved', async () => {
  let resolve!: (value: { opened: boolean }) => void;
  control.share.mockReturnValueOnce(new Promise<{ opened: boolean }>((accept) => { resolve = accept; }));
  const renderer = await mount('done', rows(101));
  const send = action(renderer, 'results.shareAction');
  await act(async () => { send.props.onPress(); send.props.onPress(); await flush(); });
  expect(control.share).toHaveBeenCalledOnce();
  expect(action(renderer, 'results.shareAction').props.disabled).toBe(true);
  expect(action(renderer, 'results.shareNextBatch').props.disabled).toBe(true);
  await act(async () => { resolve({ opened: true }); await flush(); });
  expect(control.share).toHaveBeenCalledOnce();
  expectRange(renderer, 1, 100, 101);
  expect(action(renderer, 'results.shareNextBatch').props.disabled).toBe(false);
});
