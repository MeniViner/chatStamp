import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaViewer, type SharedMediaAudio } from '../src/components/MediaViewer';
import type { MediaCellItem } from '../src/components/MediaSelectionList';
import { VideoLeaseController } from '../src/lib/videoLease';
import { TranscriptReader } from '../src/components/TranscriptReader';
import type { TranscriptPage } from '../src/services/transcriptReader';

const control = vi.hoisted(() => ({ rtl: false, language: 'en', video: vi.fn(), audio: vi.fn(), external: vi.fn(), read: vi.fn() }));
vi.mock('expo-video', () => ({ VideoView: 'VideoView', createVideoPlayer: control.video }));
vi.mock('expo-audio', () => ({ createAudioPlayer: control.audio }));
vi.mock('expo-image', () => ({ Image: 'Image' }));
vi.mock('expo-file-system', () => ({ File: class {} }));
vi.mock('react-native', async () => {
  const { createElement, Fragment } = await import('react');
  type ListProps<T> = { data: readonly T[]; keyExtractor: (item: T) => string; renderItem: (info: { item: T; index: number }) => React.ReactNode };
  // Renders every row so assertions see the whole bounded section, as a fully scrolled list would.
  const FlatList = <T,>({ data, keyExtractor, renderItem, ...props }: ListProps<T>) => createElement('FlatList', { ...props, data },
    data.map((item, index) => createElement(Fragment, { key: keyExtractor(item) }, renderItem({ item, index }))));
  return {
    Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', View: 'View', TextInput: 'TextInput', StatusBar: 'StatusBar', FlatList,
    I18nManager: { get isRTL() { return control.rtl; } },
    PanResponder: { create: (handlers: object) => ({ panHandlers: handlers }) },
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  };
});
vi.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'Icon' }));
vi.mock('react-native-paper', () => ({ Text: 'Text', Button: 'Button', IconButton: 'IconButton', ActivityIndicator: 'ActivityIndicator', Chip: 'Chip' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('../src/theme/useAppTheme', () => ({ useAppTheme: () => ({ dark: false, colors: {
  background: '#fff', surfaceVariant: '#eee', primary: '#123', primaryContainer: '#mine', onPrimaryContainer: '#onmine',
  onSurface: '#111', onSurfaceVariant: '#444', secondaryContainer: '#sel', onSecondaryContainer: '#onsel', outlineVariant: '#ccc',
} }) }));
vi.mock('../src/native/mediaPreviews', () => ({ awaitMediaRelease: async () => undefined, getThumbnail: vi.fn(), invalidateThumbnail: vi.fn(), openFileInOtherApp: control.external }));
vi.mock('../src/components/MediaSelectionList', () => ({ formatSelectionBytes: (bytes: number) => `${bytes} B` }));
vi.mock('../src/services/transcriptReader', () => ({ readTranscriptPage: control.read }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({
  t: (key: string, values?: Record<string, unknown>) => values ? `${key}|${JSON.stringify(values)}` : key,
  i18n: { get resolvedLanguage() { return control.language; }, dir: () => control.language === 'he' ? 'rtl' : 'ltr' },
}) }));

const host = (name: string) => name as React.ElementType;
const renderers: ReactTestRenderer[] = [];
const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousActEnvironment = environment.IS_REACT_ACT_ENVIRONMENT;
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
beforeAll(() => { environment.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => {
  if (previousActEnvironment === undefined) delete environment.IS_REACT_ACT_ENVIRONMENT;
  else environment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});
beforeEach(() => {
  control.rtl = false; control.language = 'en'; vi.clearAllMocks(); control.external.mockResolvedValue({ opened: true });
  control.read.mockReset().mockResolvedValue({ text: 'שלום\nשורה שנייה', offset: 0, nextOffset: null, totalBytes: 36 });
});
afterEach(async () => {
  await act(async () => renderers.splice(0).forEach((renderer) => renderer.unmount()));
  expect(control.video).not.toHaveBeenCalled();
  expect(control.audio).not.toHaveBeenCalled();
});

const document = (id: string): MediaCellItem => ({
  id, filename: `${id}.txt`, uri: `file:///synthetic/${id}.txt`, mediaType: 'document',
  sender: 'QA Dana', dateLabel: '26 Feb 2019', dateBadge: 'known', dayKey: '2019-02-26',
});
async function mountViewer(initialId = 'middle', items: readonly MediaCellItem[] = [document('first'), document('middle'), document('last')]) {
  let currentId = initialId;
  let selectedIds: ReadonlySet<string> = new Set(['first', 'hidden']);
  let renderer!: ReactTestRenderer;
  const onPage = vi.fn((id: string) => { currentId = id; renderer.update(tree()); });
  const onToggle = vi.fn((id: string) => {
    const next = new Set(selectedIds); if (next.has(id)) next.delete(id); else next.add(id);
    selectedIds = next; renderer.update(tree());
  });
  const onDismiss = vi.fn();
  const video = new VideoLeaseController(async () => undefined);
  const audio: SharedMediaAudio = {
    player: null, activeId: undefined, error: false,
    status: { currentTime: 0, duration: 0, playing: false, isLoaded: false, playbackState: 'idle', isBuffering: false },
    play: vi.fn(async () => undefined), stop: vi.fn(), release: vi.fn(async () => undefined),
  };
  const tree = () => React.createElement(MediaViewer, { items, currentId, selectedIds,
    onPage, onDismiss, onToggle, video, audio });
  await act(async () => { renderer = TestRenderer.create(tree()); renderers.push(renderer); });
  return {
    renderer, onPage, onToggle, onDismiss, selection: () => selectedIds,
    button: (label: string) => renderer.root.findAllByType(host('IconButton')).find((node) => node.props.accessibilityLabel === label)!,
    page: () => renderer.root.findAllByType(host('Text')).find((node) => typeof node.props.children === 'string' && node.props.children.startsWith('viewer.page|'))!,
  };
}
async function press(node: ReactTestInstance) { await act(async () => { node.props.onPress(); await flush(); }); }

describe('owner UX14 actual media arrow direction and page identity', () => {
  it.each([
    { rtl: false, language: 'en', previous: 'chevron-left', next: 'chevron-right' },
    { rtl: true, language: 'he', previous: 'chevron-right', next: 'chevron-left' },
    { rtl: true, language: 'en', previous: 'chevron-right', next: 'chevron-left' },
    { rtl: false, language: 'he', previous: 'chevron-left', next: 'chevron-right' },
  ])('uses native RTL=$rtl arrows with $language copy without reversing index callbacks', async ({ rtl, language, previous, next }) => {
    control.rtl = rtl; control.language = language;
    const ui = await mountViewer();
    expect(ui.button('viewer.previous').props.icon).toBe(previous);
    expect(ui.button('viewer.next').props.icon).toBe(next);
    expect(ui.page().props.children).toContain('"current":2,"total":3');
    await press(ui.button('viewer.previous'));
    expect(ui.onPage).toHaveBeenLastCalledWith('first');
    await press(ui.button('viewer.next'));
    expect(ui.onPage).toHaveBeenLastCalledWith('middle');
    await press(ui.button('viewer.next'));
    expect(ui.onPage).toHaveBeenLastCalledWith('last');
    expect(ui.selection()).toEqual(new Set(['first', 'hidden']));
  });

  it.each([false, true])('retains boundaries, unchecked pages and checkbox identity with RTL=%s', async (rtl) => {
    control.rtl = rtl; control.language = rtl ? 'he' : 'en';
    const ui = await mountViewer('first');
    expect(ui.button('viewer.previous').props.disabled).toBe(true);
    await press(ui.button('viewer.previous'));
    expect(ui.onPage).not.toHaveBeenCalled();
    await press(ui.button('viewer.next'));
    const checkbox = ui.renderer.root.findAllByType(host('Pressable')).find((node) => node.props.accessibilityRole === 'checkbox')!;
    expect(checkbox.props.accessibilityState.checked).toBe(false);
    expect(checkbox.findByType(host('Icon')).props.name).toBe('checkbox-blank-circle-outline');
    await press(checkbox);
    expect(ui.onToggle).toHaveBeenCalledExactlyOnceWith('middle');
    const toggled = ui.renderer.root.findAllByType(host('Pressable')).find((node) => node.props.accessibilityRole === 'checkbox')!;
    expect(toggled.props.accessibilityState.checked).toBe(true);
    expect(toggled.findByType(host('Icon')).props.name).toBe('check-circle');
    expect(ui.selection()).toEqual(new Set(['first', 'middle', 'hidden']));
    await press(ui.button('viewer.next'));
    expect(ui.button('viewer.next').props.disabled).toBe(true);
    ui.onPage.mockClear();
    await press(ui.button('viewer.next'));
    expect(ui.onPage).not.toHaveBeenCalled();
    await press(ui.button('common.close'));
    expect(ui.onDismiss).toHaveBeenCalledOnce();
    expect(ui.selection()).toEqual(new Set(['first', 'middle', 'hidden']));
  });

  it.each([
    { rtl: false, dx: -80, expected: 'last' }, { rtl: false, dx: 80, expected: 'first' },
    { rtl: true, dx: -80, expected: 'first' }, { rtl: true, dx: 80, expected: 'last' },
  ])('keeps native RTL=$rtl swipe dx=$dx consistent with its arrows', async ({ rtl, dx, expected }) => {
    control.rtl = rtl; control.language = rtl ? 'en' : 'he';
    const ui = await mountViewer();
    const surface = ui.renderer.root.findAllByType(host('View')).find((node) => typeof node.props.onPanResponderRelease === 'function')!;
    await act(async () => surface.props.onPanResponderRelease({}, { dx, dy: 0 }));
    expect(ui.onPage).toHaveBeenCalledExactlyOnceWith(expected);
    expect(ui.selection()).toEqual(new Set(['first', 'hidden']));
  });

  it('keeps an ordinary TXT document on its existing external-open route', async () => {
    const ui = await mountViewer();
    await press(ui.renderer.root.findAllByType(host('Button')).find((node) => node.props.children === 'viewer.openExternal')!);
    expect(control.external).toHaveBeenCalledExactlyOnceWith({ uri: 'file:///synthetic/middle.txt', filename: 'middle.txt' });
    expect(ui.onPage).not.toHaveBeenCalled();
    expect(control.read).not.toHaveBeenCalled();
    expect(ui.selection()).toEqual(new Set(['first', 'hidden']));
  });
});

async function mountReader(uri = 'file:///synthetic/chat.txt') {
  let renderer!: ReactTestRenderer;
  const tree = (source: string) => React.createElement(TranscriptReader, { uri: source, filename: 'תמליל מקורי ארוך.txt' });
  await act(async () => { renderer = TestRenderer.create(tree(uri)); renderers.push(renderer); await flush(); });
  return {
    renderer,
    button: (key: string) => renderer.root.findAllByType(host('Button')).find((node) => node.props.children === key)!,
    selectable: () => renderer.root.findAllByType(host('Text')).find((node) => node.props.selectable)!,
    async changeUri(source: string) { await act(async () => { renderer.update(tree(source)); await flush(); }); },
  };
}
const textNodes = (renderer: ReactTestRenderer) => renderer.root.findAllByType(host('Text')).map((node) => node.props.children);
const flatten = (style: unknown): Record<string, unknown> => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : (style && typeof style === 'object' ? style as Record<string, unknown> : {});
/** Each message bubble is the single accessible View inside a bubble row. */
function bubbleNodes(renderer: ReactTestRenderer) {
  return renderer.root.findAllByType(host('View')).filter((node) => node.props.accessible === true && typeof node.props.accessibilityLabel === 'string'
    && node.parent !== null && flatten(node.parent.props.style).flexDirection === 'row');
}
const bubbleLabels = (renderer: ReactTestRenderer) => bubbleNodes(renderer).map((node) => node.props.accessibilityLabel);
/** Bubble rows are the only row containers that set a main-axis side (start for others, end for "me"). */
function bubbles(renderer: ReactTestRenderer) {
  return renderer.root.findAllByType(host('View')).filter((node) => {
    const style = flatten(node.props.style); return style.flexDirection === 'row' && (style.justifyContent === 'flex-start' || style.justifyContent === 'flex-end');
  }).map((row) => ({ mine: flatten(row.props.style).justifyContent === 'flex-end', texts: row.findAllByType(host('Text')).map((node) => node.props.children) }));
}

describe('owner UX14 actual bounded transcript reader and document distinction', () => {
  it('opens the actual transcript inside the viewer with long Hebrew/multiline selectable content and no external chooser', async () => {
    const text = '26.2.2019, 10:00 - דנה: שלום משפחה\nהמשך ההודעה בשורה חדשה\n\n'.repeat(300);
    control.read.mockResolvedValueOnce({ text, offset: 0, nextOffset: 65536, totalBytes: 2_000_000 });
    const item = { ...document('actual-selected-chat'), sourceKind: 'chat-transcript' as const };
    const ui = await mountViewer(item.id, [item]);
    expect(control.read).toHaveBeenCalledExactlyOnceWith(item.uri, 0);
    const list = ui.renderer.root.findByType(host('FlatList'));
    expect(list.props).toMatchObject({ accessibilityLabel: item.filename, nestedScrollEnabled: true });
    const bodies = list.findAllByType(host('Text')).filter((node) => node.props.selectable && node.props.children === 'שלום משפחה\nהמשך ההודעה בשורה חדשה');
    expect(bodies).toHaveLength(300);
    for (const body of bodies) expect(flatten(body.props.style).writingDirection).toBe('auto');
    expect(list.findAllByType(host('Text')).filter((node) => node.props.children === 'דנה')).toHaveLength(1);
    expect(ui.renderer.root.findAllByType(host('Button')).some((node) => node.props.children === 'viewer.openExternal')).toBe(false);
    expect(control.external).not.toHaveBeenCalled();
    expect(control.read).toHaveBeenCalledTimes(1);
    expect(ui.selection()).toEqual(new Set(['first', 'hidden']));
  });

  it('requests only explicit next/previous byte offsets, keeps one page, and makes duplicate next taps idempotent', async () => {
    const first: TranscriptPage = { text: 'תחילת השיחה\nשורה ראשונה', offset: 0, nextOffset: 4096, totalBytes: 5000 };
    const last: TranscriptPage = { text: 'סיום השיחה\nשורה אחרונה', offset: 4096, nextOffset: null, totalBytes: 5000 };
    control.read.mockImplementation(async (_uri: string, offset: number) => offset === 0 ? first : last);
    const ui = await mountReader();
    expect(ui.button('viewer.transcriptPreviousSection').props.disabled).toBe(true);
    const next = ui.button('viewer.transcriptNextSection');
    await act(async () => { next.props.onPress(); next.props.onPress(); await flush(); });
    expect(control.read.mock.calls).toEqual([['file:///synthetic/chat.txt', 0], ['file:///synthetic/chat.txt', 4096]]);
    expect(ui.selectable().props.children).toBe(last.text);
    expect(textNodes(ui.renderer)).not.toContain(first.text);
    expect(ui.button('viewer.transcriptNextSection').props.disabled).toBe(true);
    expect(textNodes(ui.renderer)).toContain('viewer.transcriptEnd');
    expect(textNodes(ui.renderer)).toContain('viewer.transcriptSection|{"current":2}');
    await press(ui.button('viewer.transcriptPreviousSection'));
    expect(control.read).toHaveBeenLastCalledWith('file:///synthetic/chat.txt', 0);
    expect(ui.selectable().props.children).toBe(first.text);
    expect(textNodes(ui.renderer)).toContain('viewer.transcriptSection|{"current":1}');
  });

  it('resets URI/page ownership and ignores a pending old transcript completion', async () => {
    let completeOld!: (page: TranscriptPage) => void;
    control.read.mockImplementation((uri: string, offset: number) => {
      if (uri.endsWith('/A.txt') && offset === 4096) return new Promise<TranscriptPage>((resolve) => { completeOld = resolve; });
      return Promise.resolve({ text: uri.endsWith('/A.txt') ? 'תמליל א' : 'תמליל ב\nחדש', offset: 0,
        nextOffset: uri.endsWith('/A.txt') ? 4096 : null, totalBytes: 5000 });
    });
    const ui = await mountReader('file:///synthetic/A.txt');
    await press(ui.button('viewer.transcriptNextSection'));
    expect(ui.renderer.root.findByType(host('ActivityIndicator')).props.accessibilityLabel).toBe('viewer.transcriptLoading');
    await ui.changeUri('file:///synthetic/B.txt');
    expect(control.read).toHaveBeenLastCalledWith('file:///synthetic/B.txt', 0);
    expect(ui.selectable().props.children).toBe('תמליל ב\nחדש');
    await act(async () => { completeOld({ text: 'תוכן ישן שלא יוצג', offset: 4096, nextOffset: null, totalBytes: 5000 }); await flush(); });
    expect(ui.selectable().props.children).toBe('תמליל ב\nחדש');
    expect(textNodes(ui.renderer)).not.toContain('תוכן ישן שלא יוצג');
  });

  it('shows a translated read error and retries the same page without exposing a raw native error or opening another app', async () => {
    control.read.mockRejectedValueOnce(new Error('/private/cache/chatstamp/owner-chat.txt: EACCES'));
    const ui = await mountReader();
    expect(ui.renderer.root.findAllByType(host('Text')).some((node) => node.props.accessibilityRole === 'alert' && node.props.children === 'viewer.transcriptError')).toBe(true);
    expect(textNodes(ui.renderer).join(' ')).not.toContain('EACCES');
    await press(ui.button('viewer.transcriptRetry'));
    expect(control.read.mock.calls).toEqual([['file:///synthetic/chat.txt', 0], ['file:///synthetic/chat.txt', 0]]);
    expect(ui.selectable().props.children).toBe('שלום\nשורה שנייה');
    expect(control.external).not.toHaveBeenCalled();
  });

  it('announces an empty complete transcript without suggesting more sections or reading repeatedly', async () => {
    control.read.mockResolvedValueOnce({ text: '', offset: 0, nextOffset: null, totalBytes: 0 });
    const ui = await mountReader();
    expect(ui.selectable().props.children).toBe('viewer.transcriptEmpty');
    expect(textNodes(ui.renderer)).toContain('viewer.transcriptEnd');
    expect(ui.renderer.root.findAllByType(host('Button'))).toHaveLength(0);
    expect(control.read).toHaveBeenCalledTimes(1);
  });
});

const chat = [
  '26.2.2019, 10:00 - Messages and calls are end-to-end encrypted.',
  '26.2.2019, 10:01 - דנה: מי מביא פיצה?',
  '26.2.2019, 10:02 - דנה: ושתייה',
  '26.2.2019, 10:03 - אבא: אני מביא פיצה',
  '27.2.2019, 09:00 - אבא: IMG-20190227-WA0001.jpg (file attached)',
  '27.2.2019, 09:05 - Gil: <Media omitted>',
].join('\n');

describe('owner UX14 transcript bubbles, "me" choice and in-section search', () => {
  beforeEach(() => { control.read.mockResolvedValue({ text: chat, offset: 0, nextOffset: null, totalBytes: chat.length }); });

  it('renders parsed messages as bubbles with day separators, a centered system line and an attachment row', async () => {
    const ui = await mountReader();
    const rows = bubbles(ui.renderer);
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => !row.mine)).toBe(true);
    expect(rows.map((row) => row.texts)).toEqual([
      ['דנה', 'מי מביא פיצה?', '10:01'], ['ושתייה', '10:02'], ['אבא', 'אני מביא פיצה', '10:03'],
      ['אבא', 'IMG-20190227-WA0001.jpg', '09:00'], ['Gil', '<Media omitted>', '09:05'],
    ]);
    const texts = textNodes(ui.renderer);
    expect(texts).toEqual(expect.arrayContaining(['26.2.2019', '27.2.2019', 'Messages and calls are end-to-end encrypted.']));
    // The attachment is announced through its bubble; the paperclip itself is decorative.
    const clip = ui.renderer.root.findAllByType(host('Icon')).filter((node) => node.props.name === 'paperclip');
    expect(clip).toHaveLength(1);
    expect(clip[0].props.importantForAccessibility).toBe('no');
    expect(bubbleLabels(ui.renderer)).toContain('אבא, 09:00: viewer.transcriptAttachment IMG-20190227-WA0001.jpg');
    expect(control.read).toHaveBeenCalledOnce();
    expect(control.external).not.toHaveBeenCalled();
  });

  it('makes every bubble one accessible element labelled sender, time and content, including follow-on and "me" bubbles', async () => {
    const ui = await mountReader();
    const expected = [
      'דנה, 10:01: מי מביא פיצה?', 'דנה, 10:02: ושתייה', 'אבא, 10:03: אני מביא פיצה',
      'אבא, 09:00: viewer.transcriptAttachment IMG-20190227-WA0001.jpg', 'Gil, 09:05: <Media omitted>',
    ];
    expect(bubbleLabels(ui.renderer)).toEqual(expected);
    // The follow-on bubble draws no name, yet its label still names the sender.
    expect(bubbles(ui.renderer)[1].texts).not.toContain('דנה');
    for (const bubble of bubbleNodes(ui.renderer)) {
      expect(bubble.findAll((node) => node !== bubble && node.props.accessible === true)).toHaveLength(0);
    }
    await press(ui.renderer.root.findAllByType(host('Chip')).find((node) => node.props.children === 'אבא')!);
    const rows = bubbles(ui.renderer);
    expect(rows.filter((row) => row.mine).some((row) => row.texts.includes('אבא'))).toBe(false);
    expect(bubbleLabels(ui.renderer)).toEqual(expected);
  });

  it('renders an attachment caption under the attachment row and adds it to the bubble label', async () => {
    const text = '27.2.2019, 09:00 - אבא: IMG-1.jpg (file attached)\nLook at this';
    control.read.mockResolvedValue({ text, offset: 0, nextOffset: null, totalBytes: text.length });
    const ui = await mountReader();
    expect(bubbleLabels(ui.renderer)).toEqual(['אבא, 09:00: viewer.transcriptAttachment IMG-1.jpg, Look at this']);
    const [bubble] = bubbleNodes(ui.renderer);
    const children = bubble.children.filter((node): node is ReactTestInstance => typeof node !== 'string');
    const attachmentIndex = children.findIndex((node) => node.findAllByType(host('Text')).some((textNode) => textNode.props.children === 'IMG-1.jpg'));
    const captionIndex = children.findIndex((node) => node.type === host('Text') && node.props.children === 'Look at this');
    expect(attachmentIndex).toBeGreaterThanOrEqual(0);
    expect(captionIndex).toBeGreaterThan(attachmentIndex);
  });

  it('moves only the chosen sender\'s bubbles to the "me" side and toggles back', async () => {
    const ui = await mountReader();
    expect(textNodes(ui.renderer)).toContain('viewer.transcriptMe');
    const chip = (name: string) => ui.renderer.root.findAllByType(host('Chip')).find((node) => node.props.children === name)!;
    expect(ui.renderer.root.findAllByType(host('Chip')).map((node) => node.props.children).sort()).toEqual(['Gil', 'אבא', 'דנה'].sort());
    await press(chip('אבא'));
    expect(chip('אבא').props.selected).toBe(true); expect(chip('דנה').props.selected).toBe(false);
    const rows = bubbles(ui.renderer);
    expect(rows.map((row) => row.mine)).toEqual([false, false, true, true, false]);
    expect(rows.filter((row) => row.mine).some((row) => row.texts.includes('אבא'))).toBe(false);
    await press(chip('דנה'));
    expect(bubbles(ui.renderer).map((row) => row.mine)).toEqual([true, true, false, false, false]);
    await press(chip('דנה'));
    expect(bubbles(ui.renderer).every((row) => !row.mine)).toBe(true);
    expect(control.read).toHaveBeenCalledOnce();
  });

  it('offers no "me" choice when the section has a single sender', async () => {
    control.read.mockResolvedValue({ text: '26.2.2019, 10:01 - דנה: אחת\n26.2.2019, 10:02 - דנה: שתיים', offset: 0, nextOffset: null, totalBytes: 60 });
    const ui = await mountReader();
    expect(ui.renderer.root.findAllByType(host('Chip'))).toHaveLength(0);
    expect(textNodes(ui.renderer)).not.toContain('viewer.transcriptMe');
    expect(bubbles(ui.renderer)).toHaveLength(2);
  });

  it('filters the current section to matching messages, shows the count and restores everything on close', async () => {
    const ui = await mountReader();
    const search = () => ui.renderer.root.findAllByType(host('IconButton')).find((node) => node.props.accessibilityLabel === 'viewer.transcriptSearch')!;
    await press(search());
    const input = () => ui.renderer.root.findByType(host('TextInput'));
    expect(input().props.accessibilityLabel).toBe('viewer.transcriptSearch');
    await act(async () => input().props.onChangeText('  פיצה '));
    expect(bubbles(ui.renderer).map((row) => row.texts[row.texts.length - 2])).toEqual(['מי מביא פיצה?', 'אני מביא פיצה']);
    expect(textNodes(ui.renderer)).toContain('viewer.transcriptMatches|{"count":2}');
    expect(textNodes(ui.renderer)).not.toContain('26.2.2019');
    await act(async () => input().props.onChangeText('Gil'));
    expect(bubbles(ui.renderer)).toHaveLength(1);
    await act(async () => input().props.onChangeText('לא קיים'));
    expect(bubbles(ui.renderer)).toHaveLength(0);
    expect(textNodes(ui.renderer)).toContain('viewer.transcriptNoMatches|{"count":0}');
    const close = ui.renderer.root.findAllByType(host('IconButton')).find((node) => node.props.accessibilityLabel === 'common.close')!;
    expect(flatten(close.props.style)).toMatchObject({ width: 48, height: 48 });
    await press(close);
    expect(ui.renderer.root.findAllByType(host('TextInput'))).toHaveLength(0);
    expect(bubbles(ui.renderer)).toHaveLength(5);
    expect(textNodes(ui.renderer).some((value) => typeof value === 'string' && value.startsWith('viewer.transcriptMatches'))).toBe(false);
    expect(control.read).toHaveBeenCalledOnce();
  });

  it('keeps bounded paging for parsed sections: only the current section is shown and duplicate next taps read once', async () => {
    const second = '28.2.2019, 08:00 - דנה: חלק שני';
    control.read.mockImplementation(async (_uri: string, offset: number) => offset === 0
      ? { text: chat, offset: 0, nextOffset: 4096, totalBytes: 8000 } : { text: second, offset: 4096, nextOffset: null, totalBytes: 8000 });
    const ui = await mountReader();
    const next = ui.button('viewer.transcriptNextSection');
    await act(async () => { next.props.onPress(); next.props.onPress(); await flush(); });
    expect(control.read.mock.calls).toEqual([['file:///synthetic/chat.txt', 0], ['file:///synthetic/chat.txt', 4096]]);
    expect(bubbles(ui.renderer).map((row) => row.texts)).toEqual([['דנה', 'חלק שני', '08:00']]);
    expect(textNodes(ui.renderer)).toEqual(expect.arrayContaining(['viewer.transcriptEnd', 'viewer.transcriptSection|{"current":2}']));
  });
});
