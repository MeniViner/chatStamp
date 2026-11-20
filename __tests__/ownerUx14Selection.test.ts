import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileSelectionScreen } from '../src/screens/FileSelectionScreen';
import { CompactMediaRow, type MediaCellItem } from '../src/components/MediaSelectionList';
import { usePipelineStore } from '../src/store/pipelineStore';
import type { ExtractedMediaFile } from '../src/types/media';
import en from '../src/i18n/locales/en.json';
import he from '../src/i18n/locales/he.json';

const control = vi.hoisted(() => ({
  language: 'en', listeners: [] as (() => boolean)[],
  audio: { stop: vi.fn(), release: vi.fn(async () => undefined), play: vi.fn(), status: { playing: false }, activeId: undefined },
  video: { request: vi.fn(), failClosed: vi.fn() }, start: vi.fn(), capture: vi.fn(),
}));
vi.mock('react-native', () => ({
  View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', FlatList: 'FlatList', SectionList: 'SectionList', StatusBar: 'StatusBar',
  I18nManager: { isRTL: false }, Keyboard: { dismiss: vi.fn() },
  PanResponder: { create: (handlers: object) => ({ panHandlers: handlers }) },
  useWindowDimensions: () => ({ width: 411, height: 891, scale: 1, fontScale: 1 }),
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  BackHandler: { addEventListener: (_name: string, callback: () => boolean) => {
    control.listeners.push(callback); return { remove: () => { control.listeners.splice(control.listeners.indexOf(callback), 1); } };
  } },
}));
vi.mock('react-native-paper', () => ({
  Appbar: { Header: 'AppbarHeader', BackAction: 'AppbarBackAction' },
  Button: 'Button', Chip: 'Chip', IconButton: 'IconButton', Searchbar: 'Searchbar', Text: 'Text', TextInput: 'TextInput',
  Surface: 'Surface', ActivityIndicator: 'ActivityIndicator', ProgressBar: 'ProgressBar', RadioButton: 'RadioButton', Switch: 'Switch',
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'Icon' }));
vi.mock('expo-image', () => ({ Image: 'Image' }));
vi.mock('../src/components/MediaSelectionList', async (original) => ({
  ...await original<typeof import('../src/components/MediaSelectionList')>(), MediaSelectionList: 'MediaSelectionList', SelectionFooter: 'SelectionFooter',
}));
vi.mock('../src/components/MediaViewer', () => ({ MediaViewer: 'MediaViewer', useSharedMediaAudio: () => control.audio, useViewerVideoController: () => control.video }));
vi.mock('../src/components/useMediaThumbnails', () => ({ useMediaThumbnails: () => ({ thumbnails: new Map(), onViewableIds: vi.fn(), onThumbnailError: vi.fn() }) }));
vi.mock('../src/components/BottomSheet', async () => {
  const { createElement } = await import('react');
  return { PremiumBottomSheet: ({ children, footer, ...props }: { visible: boolean; children?: React.ReactNode; footer?: React.ReactNode }) =>
    createElement('PremiumBottomSheet', props, props.visible ? children : null, props.visible ? footer : null) };
});
vi.mock('../src/components/ConfirmDialog', () => ({ ConfirmDialog: 'ConfirmDialog' }));
vi.mock('../src/services/operationCoordinator', () => ({ startSaving: control.start, captureSaveIntent: control.capture, discardImport: vi.fn() }));
vi.mock('../src/native/mediaPreviews', () => ({ getThumbnail: vi.fn(), invalidateThumbnail: vi.fn() }));
vi.mock('../src/theme/useAppTheme', () => ({ useAppTheme: () => ({ dark: false, colors: {
  background: '#fff', surface: '#fff', primary: '#123456', primaryContainer: '#c1ddff', onPrimaryContainer: '#123456',
  secondaryContainer: '#d2e3ff', onSecondaryContainer: '#112233',
  onSurfaceVariant: '#456789', outlineVariant: '#ccc',
} }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({
  t: (key: string, values?: Record<string, unknown>) => key === 'picker.transcript'
    ? (control.language === 'he' ? he : en).picker.transcript
    : values ? `${key}|${JSON.stringify(values)}` : key,
  i18n: { get resolvedLanguage() { return control.language; } },
}) }));

const host = (name: string) => name as React.ElementType;
const renderers: ReactTestRenderer[] = [];
const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousActEnvironment = environment.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { environment.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => {
  if (previousActEnvironment === undefined) delete environment.IS_REACT_ACT_ENVIRONMENT;
  else environment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});
afterEach(async () => { await act(async () => renderers.splice(0).forEach((renderer) => renderer.unmount())); });

const makeFile = (id: string, mediaType: ExtractedMediaFile['mediaType'], day: string, filename = `${id}.txt`): ExtractedMediaFile => ({
  id, filename, normalizedFilename: filename.toLowerCase(), uri: `file:///synthetic/${id}/${filename}`, mediaType,
  sourceKind: 'zip-media', dateSource: 'chat', dateIso: `${day}T10:00:00Z`, saveDateIso: `${day}T10:00:00Z`, sizeBytes: 200,
  matchedRecord: { id, filename, normalizedFilename: filename.toLowerCase(), sender: 'QA Dana', messageDateIso: `${day}T10:00:00Z`, rawLine: '' },
});
const transcript: ExtractedMediaFile = { ...makeFile('actual-transcript', 'document', '2019-02-24', 'chosen-year-first.txt'), sourceKind: 'chat-transcript' };
const files = [makeFile('ordinary-chat-named-document', 'document', '2019-02-28', '_chat.txt'), makeFile('photo', 'photo', '2019-02-27', 'photo.jpg'), transcript,
  makeFile('ordinary-document', 'document', '2019-02-26', 'notes.txt')];
beforeEach(() => {
  control.language = 'en'; control.listeners.length = 0; vi.clearAllMocks();
  usePipelineStore.getState().reset();
  usePipelineStore.setState({ stage: 'selectFiles', zipName: 'Synthetic.zip', mediaFiles: files, selectedFileIds: new Set(files.map((file) => file.id)),
    workingDirectory: 'file:///cache/chatstamp/synthetic/', importOperationId: 'synthetic', archiveFingerprint: 'a'.repeat(64) });
});
async function mount(element: React.ReactElement = React.createElement(FileSelectionScreen)) {
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(element); renderers.push(renderer); });
  return renderer;
}
const find = (renderer: ReactTestRenderer, name: string, match: (node: ReactTestInstance) => boolean = () => true) => renderer.root.findAllByType(host(name)).find(match)!;
const contains = (value: string) => (node: ReactTestInstance) => JSON.stringify(node.props.children).includes(value);
async function press(node: ReactTestInstance) { await act(async () => node.props.onPress()); }
const ids = (renderer: ReactTestRenderer) => (find(renderer, 'MediaSelectionList').props.items as readonly MediaCellItem[]).map((item) => item.id);
const category = (renderer: ReactTestRenderer, name: string) => find(renderer, 'Chip', contains(`picker.tabs.${name}`));

describe('owner UX14 actual Select header and category surfaces', () => {
  it('keeps a very long Hebrew chat name accessible while limiting its actual header Text to one line', async () => {
    const fullName = 'השיחה המשפחתית הארוכה מאוד עם כל החברים והקרובים '.repeat(12).trim();
    usePipelineStore.setState({ zipName: `${fullName}.zip` });
    const renderer = await mount();
    const heading = find(renderer, 'Text', (node) => node.props.children === fullName);
    expect(heading).toBeDefined();
    expect(heading.props).toMatchObject({ numberOfLines: 1, ellipsizeMode: 'tail', accessibilityLabel: fullName });
    expect(find(renderer, 'AppbarHeader').findAllByType(host('IconButton'))).toHaveLength(3);
  });

  it('fills/checks only the active category and preserves all selected IDs across All/Photos/Documents', async () => {
    const renderer = await mount();
    for (const [tab, selected, total] of [['all', 4, 4], ['photos', 1, 1], ['documents', 3, 3], ['all', 4, 4]] as const) {
      await press(category(renderer, tab));
      for (const kind of ['all', 'photos', 'documents']) {
        const props = category(renderer, kind).props;
        expect(props).toMatchObject({ selected: kind === tab, mode: kind === tab ? 'flat' : 'outlined', accessibilityState: { selected: kind === tab } });
        expect(props.selected && props.showSelectedCheck !== false).toBe(kind === tab);
        expect(props.style.backgroundColor).toBe(kind === tab ? '#c1ddff' : 'transparent');
      }
      expect(find(renderer, 'SelectionFooter').props).toMatchObject({ selected, total });
      expect(usePipelineStore.getState().selectedFileIds).toEqual(new Set(files.map((file) => file.id)));
    }
    await press(category(renderer, 'photos'));
    await act(async () => find(renderer, 'MediaSelectionList').props.onToggle('photo'));
    await press(category(renderer, 'documents'));
    expect(find(renderer, 'SelectionFooter').props).toMatchObject({ selected: 3, total: 3 });
    await press(category(renderer, 'all'));
    expect(find(renderer, 'SelectionFooter').props).toMatchObject({ selected: 3, total: 4 });
    expect(usePipelineStore.getState().selectedFileIds).toEqual(new Set(['actual-transcript', 'ordinary-document', 'ordinary-chat-named-document']));
  });
});

describe('owner UX14 actual transcript identity and eligible ordering', () => {
  it('pins only the chosen transcript first in All/Documents for both date sorts, retaining original save facts', async () => {
    const original = structuredClone(files);
    const renderer = await mount();
    for (const sort of ['picker.newest', 'picker.oldest']) {
      await press(find(renderer, 'IconButton', (node) => node.props.accessibilityLabel === 'picker.filters'));
      await press(find(renderer, 'Chip', contains(sort)));
      await press(find(renderer, 'Button', contains('picker.apply')));
      for (const tab of ['all', 'documents']) {
        await press(category(renderer, tab));
        expect(ids(renderer)[0]).toBe('actual-transcript');
        const item = (find(renderer, 'MediaSelectionList').props.items as readonly MediaCellItem[])[0];
        expect(item).toMatchObject({ filename: transcript.filename, uri: transcript.uri, sourceKind: 'chat-transcript' });
        expect(ids(renderer)).toContain('ordinary-chat-named-document');
      }
    }
    expect(usePipelineStore.getState().mediaFiles).toEqual(original);
    expect(usePipelineStore.getState().selectedFileIds).toEqual(new Set(files.map((file) => file.id)));
  });

  it('preserves search, sender and date exclusions instead of forcing a filtered-out transcript back in', async () => {
    const renderer = await mount();
    await press(find(renderer, 'IconButton', (node) => node.props.accessibilityLabel === 'picker.search'));
    await act(async () => find(renderer, 'Searchbar').props.onChangeText('notes'));
    expect(ids(renderer)).toEqual(['ordinary-document']);
    await act(async () => find(renderer, 'Searchbar').props.onChangeText(''));
    await press(find(renderer, 'IconButton', (node) => node.props.accessibilityLabel === 'picker.filters'));
    await press(find(renderer, 'Chip', (node) => node.props.children === 'Chat transcript'));
    expect(ids(renderer)).not.toContain('actual-transcript');
    await press(find(renderer, 'Button', contains('picker.reset')));
    await act(async () => find(renderer, 'TextInput', (node) => node.props.accessibilityLabel === 'picker.from').props.onChangeText('2019-02-26'));
    expect(ids(renderer)).toEqual(['ordinary-chat-named-document', 'photo', 'ordinary-document']);
    expect(usePipelineStore.getState().selectedFileIds.has('actual-transcript')).toBe(true);
  });

  it.each([['en', 'Chat transcript'], ['he', 'תמליל השיחה']] as const)('labels the actual transcript row in %s while retaining its original accessible filename', async (language, label) => {
    control.language = language;
    const item = { id: transcript.id, filename: transcript.filename, uri: transcript.uri, mediaType: 'document' as const, sourceKind: 'chat-transcript' as const,
      sender: label, dateLabel: '24 Feb 2019', dateBadge: 'known' as const, dayKey: '2019-02-24' };
    const onOpen = vi.fn();
    const renderer = await mount(React.createElement(CompactMediaRow, { item, selected: true, thumbnailUri: null, thumbnailStatus: 'unavailable', width: 360,
      onOpen, onToggle: vi.fn(), onStartRange: vi.fn(), onRegisterCell: vi.fn() }));
    expect(renderer.root.findAllByType(host('Text')).some((node) => node.props.children === label)).toBe(true);
    const open = find(renderer, 'Pressable', (node) => node.props.accessibilityRole === 'button' && typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('picker.openItem'));
    expect(open.props.accessibilityLabel).toContain(transcript.filename);
    await press(open);
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(transcript.id);
    expect(item.filename).toBe('chosen-year-first.txt');
  });
});
