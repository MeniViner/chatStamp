import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DoneScreen, ResultDetailsList, ResultRow } from '../src/screens/DoneScreen';
import { usePipelineStore } from '../src/store/pipelineStore';
import type { CompletionSummary, SaveFileResult } from '../src/types/media';

const state = vi.hoisted(() => ({ language: 'en', listeners: [] as (() => boolean)[], openGallery: vi.fn(), openFile: vi.fn(), discard: vi.fn() }));
vi.mock('react-native', async () => {
  const { createElement } = await import('react');
  type ListProps = { data: readonly SaveFileResult[]; initialNumToRender: number; ListHeaderComponent?: React.ReactNode;
    keyExtractor: (row: SaveFileResult, index: number) => string;
    renderItem: (value: { item: SaveFileResult; index: number }) => React.ReactNode };
  return { View: 'View', StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
    BackHandler: { addEventListener: (_event: string, listener: () => boolean) => { state.listeners.push(listener); return { remove: () => { state.listeners.splice(state.listeners.indexOf(listener), 1); } }; } },
    // Windowing belongs to RN. This adapter executes the production renderItem
    // for the requested initial window, preserving the real memoized ResultRow.
    FlatList: (props: ListProps) => createElement('FlatList', props, props.ListHeaderComponent,
      ...props.data.slice(0, props.initialNumToRender).map((item, index) => createElement(React.Fragment, { key: props.keyExtractor(item, index) }, props.renderItem({ item, index })))),
  };
});
vi.mock('react-native-paper', () => ({ Text: 'Text', Snackbar: 'Snackbar' }));
vi.mock('../src/components/ConfirmDialog', () => ({ ConfirmDialog: 'ConfirmDialog' }));
vi.mock('../src/components/FolderFallbackSheet', () => ({ FolderFallbackSheet: 'FolderFallbackSheet' }));
vi.mock('../src/components/BottomSheet', () => ({ PremiumBottomSheet: 'PremiumBottomSheet' }));
vi.mock('../src/components/AppUi', () => ({ textStyles: { start: {} }, PrimaryButton: 'PrimaryButton', SecondaryButton: 'SecondaryButton', MediaThumbnail: 'MediaThumbnail', ExpandableTechnicalDetails: 'ExpandableTechnicalDetails', FilePathText: 'FilePathText' }));
vi.mock('../src/screens/WizardScreen', async () => {
  const { createElement } = await import('react');
  return { FooterActions: 'FooterActions', WizardScreen: ({ footer, children, ...props }: { footer?: React.ReactNode; children?: React.ReactNode }) => createElement('WizardScreen', props, children, footer) };
});
vi.mock('../src/store/settingsStore', () => ({ useSettingsStore: (select: (value: unknown) => unknown) => select({ settings: { developerMode: false, customFolder: null } }) }));
vi.mock('../src/services/operationCoordinator', () => ({ discardImport: state.discard, startSaving: vi.fn() }));
vi.mock('../src/native/androidIntents', () => ({ openGalleryBestEffort: state.openGallery, openSavedFileBestEffort: state.openFile,
  openFolderBestEffort: vi.fn(), shouldShowOpenGallery: (rows: SaveFileResult[]) => rows.some((row) => row.ok && row.mediaType === 'photo') }));
vi.mock('../src/native/outputFiles', () => ({ shareOutputFiles: vi.fn() }));
vi.mock('../src/theme/useAppTheme', () => ({ useAppTheme: () => ({ colors: { outlineVariant: '#ccc', onSurface: '#123', error: '#900' } }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => values ? `${key}|${JSON.stringify(values)}` : key, i18n: { resolvedLanguage: state.language } }) }));

const host = (name: string) => name as React.ElementType;
const renderers: ReactTestRenderer[] = [];
const env = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previous = env.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { env.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { if (previous === undefined) delete env.IS_REACT_ACT_ENVIRONMENT; else env.IS_REACT_ACT_ENVIRONMENT = previous; });
beforeEach(() => { state.language = 'en'; state.listeners.length = 0; state.openGallery.mockReset().mockResolvedValue('opened'); state.openFile.mockReset().mockResolvedValue('opened'); state.discard.mockReset().mockResolvedValue(undefined); usePipelineStore.getState().reset(); });
afterEach(async () => { await act(async () => renderers.splice(0).forEach((renderer) => renderer.unmount())); vi.restoreAllMocks(); });
const row = (id: string, patch: Partial<SaveFileResult> = {}): SaveFileResult => ({ filename: `${id}.jpg`, entryId: id, ok: true, outcome: 'saved', mediaType: 'photo', insertedUri: `content://media/external/images/${id}`,
  dateCorrectionVerified: true, galleryMaySortByImportTime: false, dateVerification: 'verified', targetTimestampMillis: Date.parse('2019-02-26T10:00:00Z'), ...patch });
const completion = (results: SaveFileResult[]): CompletionSummary => ({ saved: results.filter((value) => value.ok && value.outcome === 'saved').length, failed: results.filter((value) => value.outcome === 'failed').length,
  cancelled: results.filter((value) => value.outcome === 'cancelled').length, skipped: results.filter((value) => value.outcome === 'skipped').length,
  dateCorrected: results.filter((value) => value.ok && value.dateCorrectionVerified).length, dateCorrectionFailed: 0, mayShowImportTime: 0, cacheCleared: false, results, outputDirectory: '/Pictures/chatStamp/Synthetic' });
async function mount(element: React.ReactElement) { let renderer!: ReactTestRenderer; await act(async () => { renderer = TestRenderer.create(element); renderers.push(renderer); }); return renderer; }
const plain = (value: React.ReactNode): string => Array.isArray(value) ? value.map(plain).join('') : typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const text = (renderer: ReactTestRenderer) => renderer.root.findAllByType(host('Text')).map((node) => plain(node.props.children)).join('\n');

describe('actual result row save/date facts', () => {
  it('keeps a JPEG result on the actual photo thumbnail/status path without old English video wording', async () => {
    const renderer = await mount(React.createElement(ResultRow, { result: row('IMG-synthetic') }));
    expect(renderer.root.findByType(host('MediaThumbnail')).props.mediaType).toBe('photo');
    expect(text(renderer)).toContain('IMG-synthetic.jpg');
    expect(text(renderer)).toContain('results.status.dateFixed');
    expect(text(renderer)).not.toMatch(/Video saved|וידאו נשמר/);
  });

  it.each([
    ['saved/date verified', {}, 'results.fileSaved', 'results.dateVerified'],
    ['saved/date unverified', { dateCorrectionVerified: false, dateVerification: 'unverified' }, 'results.fileSaved', 'results.dateNotVerified'],
    ['saved/date ambiguous', { dateAmbiguous: true }, 'results.fileSaved', 'results.dateNotVerified'],
    ['filename estimate despite native readback', { timestampSource: 'filename', dateCorrectionVerified: false }, 'results.fileSaved', 'results.dateNotVerified'],
    ['ZIP-entry estimate despite native readback', { timestampSource: 'zip-entry', dateCorrectionVerified: false }, 'results.fileSaved', 'results.dateNotVerified'],
    ['saved/date unavailable', { verificationReason: 'date-unavailable' }, 'results.fileSaved', 'results.dateNotVerified'],
    ['cancelled', { ok: false, outcome: 'cancelled', dateCorrectionVerified: false, dateVerification: 'unverified' }, 'results.fileCancelled', 'results.dateNotVerified'],
    ['failed', { ok: false, outcome: 'failed', dateCorrectionVerified: false, dateVerification: 'unverified' }, 'results.fileNotSaved', 'results.dateNotVerified'],
  ] as const)('%s remains separate facts', async (_name, patch, savedKey, dateKey) => {
    const renderer = await mount(React.createElement(ResultRow, { result: row('one', patch) }));
    expect(text(renderer)).toContain(savedKey); expect(text(renderer)).toContain(dateKey);
    if (dateKey === 'results.dateNotVerified') expect(text(renderer)).not.toContain('results.dateVerified');
    if ('dateAmbiguous' in patch || 'timestampSource' in patch) {
      expect(text(renderer)).toContain('results.status.approximateDate');
      expect(text(renderer)).not.toContain('results.status.dateFixed');
    }
  });

  it('uses the app language for the actual row date instead of the host locale', async () => {
    state.language = 'he'; const value = row('one');
    const renderer = await mount(React.createElement(ResultRow, { result: value }));
    expect(text(renderer)).toContain(new Intl.DateTimeFormat('he', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value.targetTimestampMillis!)));
  });

  it('does not describe a skipped existing row as a newly saved file', async () => {
    const renderer = await mount(React.createElement(ResultRow, { result: row('existing', { outcome: 'skipped' }) }));
    expect(text(renderer)).toContain('results.status.alreadySaved');
    expect(text(renderer)).not.toContain('results.fileSaved');
  });

  it('uses a translated typed failure code and keeps raw native English out of the ordinary row', async () => {
    const failure = row('failure', { ok: false, outcome: 'failed', failureCode: 'NO_SPACE', failureReason: 'Native write failed at buffer 42', dateCorrectionVerified: false });
    const renderer = await mount(React.createElement(ResultRow, { result: failure }));
    expect(text(renderer)).toContain('error.codes.NO_SPACE');
    expect(text(renderer)).not.toContain('Native write failed at buffer 42');
    const developer = await mount(React.createElement(ResultRow, { result: failure, developerMode: true }));
    expect(text(developer)).toContain('Native write failed at buffer 42');
  });
});

describe('production Results details virtualization and Back', () => {
  it.each([500, 5_000])('hands %i rows to FlatList but mounts only its initial8 actual ResultRow bodies', async (count) => {
    const body = ResultRow as unknown as { type: (props: { result: SaveFileResult }) => React.ReactNode };
    const observed = vi.spyOn(body, 'type');
    const results = Array.from({ length: count }, (_, index) => row(String(index)));
    const renderer = await mount(React.createElement(ResultDetailsList, { results }));
    const list = renderer.root.findByType(host('FlatList'));
    expect(list.props).toMatchObject({ data: results, initialNumToRender: 8, maxToRenderPerBatch: 8, windowSize: 5 });
    expect(observed).toHaveBeenCalledTimes(8);
    expect(observed.mock.calls.map(([props]) => props.result.entryId)).toEqual(results.slice(0, 8).map((value) => value.entryId));
    expect(new Set(results.map((value, index) => list.props.keyExtractor(value, index))).size).toBe(count);
  });

  it('shows issues by default; Details reveals all; Back closes Details before opening start-over confirmation', async () => {
    const results = [row('good'), row('dateIssue', { dateCorrectionVerified: false, dateVerification: 'unverified' }), row('failed', { ok: false, outcome: 'failed' }), row('cancelled', { ok: false, outcome: 'cancelled' })];
    usePipelineStore.getState().setCompletion(completion(results));
    const renderer = await mount(React.createElement(DoneScreen));
    const ids = () => renderer.root.findByType(host('FlatList')).props.data.map((value: SaveFileResult) => value.entryId);
    expect(ids()).toEqual(['dateIssue', 'failed', 'cancelled']);
    const details = renderer.root.findAllByType(host('SecondaryButton')).find((node) => node.props.children === 'results.details')!;
    await act(async () => details.props.onPress()); expect(ids()).toEqual(results.map((value) => value.entryId));
    await act(async () => { expect([...state.listeners].reverse().some((listener) => listener())).toBe(true); });
    expect(ids()).toEqual(['dateIssue', 'failed', 'cancelled']);
    expect(renderer.root.findByType(host('ConfirmDialog')).props.visible).toBe(false);
    await act(async () => { expect([...state.listeners].reverse().some((listener) => listener())).toBe(true); });
    expect(renderer.root.findByType(host('ConfirmDialog')).props.visible).toBe(true);
    await act(async () => renderer.root.findByType(host('ConfirmDialog')).props.onDismiss());
    expect(state.discard).not.toHaveBeenCalled(); expect(usePipelineStore.getState().completion?.results).toBe(results);
  });

  it('shows the truthful4saved/20cancelled summary and uses Gallery as the working primary action', async () => {
    const results = [...Array.from({ length: 4 }, (_, index) => row(`saved-${index}`)), ...Array.from({ length: 20 }, (_, index) => row(`cancel-${index}`, { ok: false, outcome: 'cancelled', dateCorrectionVerified: false }))];
    usePipelineStore.getState().setCompletion(completion(results));
    const renderer = await mount(React.createElement(DoneScreen));
    expect(text(renderer)).toContain('"saved":4'); expect(text(renderer)).toContain('"cancelled":20');
    const primary = renderer.root.findByType(host('PrimaryButton'));
    expect(primary.props.children).toBe('results.openGallery');
    await act(async () => primary.props.onPress());
    expect(state.openGallery).toHaveBeenCalledExactlyOnceWith('/Pictures/chatStamp/Synthetic', results);
    expect(state.openFile).not.toHaveBeenCalled();
  });
});
