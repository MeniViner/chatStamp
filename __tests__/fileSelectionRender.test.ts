import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MediaCellItem, MediaCellProps, DaySelectionHeaderProps, SelectionFooterProps, ThumbnailState } from '../src/components/MediaSelectionList';
import { CompactMediaRow, DaySelectionHeader, MediaGridCell, MediaSelectionList, SelectionFooter } from '../src/components/MediaSelectionList';
import { selectionState, selectionTotals, setIdsSelected, toggleId } from '../src/store/fileSelectionState';

const forbidden = vi.hoisted(() => ({ videoPlayer: vi.fn(), audioPlayer: vi.fn() }));
vi.mock('expo-video', () => ({ useVideoPlayer: forbidden.videoPlayer, VideoView: 'VideoView' }));
vi.mock('expo-audio', () => ({ useAudioPlayer: forbidden.audioPlayer }));
vi.mock('expo-image', () => ({ Image: 'Image' }));
vi.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'Icon' }));
vi.mock('react-native-paper', () => ({ Text: 'Text' }));
vi.mock('../src/components/AppUi', () => ({ PrimaryButton: 'PrimaryButton' }));
vi.mock('../src/theme/useAppTheme', () => {
  const theme = { colors: { primary: '#123', onSurface: '#123', surfaceVariant: '#eee', onSurfaceVariant: '#456', outlineVariant: '#ccc', surface: '#fff' } };
  return { useAppTheme: () => theme };
});
vi.mock('react-i18next', () => {
  const t = (key: string, values?: Record<string, unknown>) => `${key}${values ? `|${Object.entries(values).map(([name, value]) => `${name}=${value}`).join('|')}` : ''}`;
  const result = { t, i18n: { resolvedLanguage: 'en' } };
  return { useTranslation: () => result };
});
vi.mock('react-native', async () => {
  const { createElement, Fragment } = await import('react');
  type Row = { key: string; items: readonly { id: string }[] };
  type Section = { key: string; data: readonly Row[] };
  type SectionProps = {
    sections: readonly Section[];
    keyExtractor: (row: Row, index: number) => string;
    renderItem: (value: { item: Row; index: number; section: Section }) => React.ReactNode;
    renderSectionHeader: (value: { section: Section }) => React.ReactNode;
    ListEmptyComponent?: React.ReactNode;
  };
  return {
    View: 'View', Pressable: 'Pressable',
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1, absoluteFill: {} },
    PanResponder: { create: (handlers: object) => ({ panHandlers: handlers }) },
    // The adapter mounts every production row/header, with no added memoization.
    // Production renderItem and actual memoized cell bodies remain in control.
    SectionList: (props: SectionProps) => createElement('SectionList', props,
      props.sections.length ? props.sections.map((section) => createElement(Fragment, { key: section.key },
        props.renderSectionHeader({ section }),
        ...section.data.map((item, index) => createElement(Fragment, { key: props.keyExtractor(item, index) },
          props.renderItem({ item, index, section }))),
      )) : props.ListEmptyComponent),
  };
});

type MemoRender<P> = { $$typeof: symbol; type: (props: P) => React.ReactNode };
const renderers: ReactTestRenderer[] = [];
const actGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const originalActEnvironment = actGlobal.IS_REACT_ACT_ENVIRONMENT;

beforeAll(() => { actGlobal.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => {
  if (originalActEnvironment === undefined) delete actGlobal.IS_REACT_ACT_ENVIRONMENT;
  else actGlobal.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
});
afterEach(async () => {
  await act(async () => { renderers.splice(0).forEach((renderer) => renderer.unmount()); });
  vi.restoreAllMocks();
  forbidden.videoPlayer.mockClear();
  forbidden.audioPlayer.mockClear();
});

function observe<P>(component: unknown) {
  const memo = component as MemoRender<P>;
  expect(memo.$$typeof).toBe(Symbol.for('react.memo'));
  // Delegate to the actual component body, retaining its production memo object
  // and comparator. A fake cell or extra test-only memo wrapper cannot pass this.
  return vi.spyOn(memo, 'type');
}

function counters() {
  const grid = observe<MediaCellProps>(MediaGridCell);
  const compact = observe<MediaCellProps>(CompactMediaRow);
  const day = observe<DaySelectionHeaderProps>(DaySelectionHeader);
  const footer = observe<SelectionFooterProps>(SelectionFooter);
  return {
    grid, compact, day, footer,
    cellIds: () => [...grid.mock.calls, ...compact.mock.calls].map(([props]) => props.item.id),
    clear: () => { grid.mockClear(); compact.mockClear(); day.mockClear(); footer.mockClear(); },
  };
}

function fixture(count: number): readonly MediaCellItem[] {
  const kinds = ['photo', 'video', 'voice', 'document'] as const;
  return Object.freeze(Array.from({ length: count }, (_, index) => {
    const id = `file-${String(index).padStart(5, '0')}`;
    const dayKey = new Date(Date.UTC(2020, 2, 17) - Math.floor(index / 50) * 86_400_000).toISOString().slice(0, 10);
    return Object.freeze({ id, filename: `fixture-${String(index).padStart(5, '0')}.${['jpg', 'mp4', 'opus', 'pdf'][index % 4]}`,
      uri: `file:///synthetic/${id}`, mediaType: kinds[index % 4], sender: index % 2 ? 'Eli' : 'Dana',
      dateLabel: dayKey, dateBadge: 'known' as const, dayKey, sizeBytes: (index + 1) * 100,
      ...(index % 4 === 1 ? { durationLabel: '0:20' } : {}) });
  }));
}

// React Native's test host names are intentionally outside DOM JSX tag typings.
const hostType = (name: string) => name as React.ElementType;
const isHost = (node: ReactTestInstance, name: string) => node.type === hostType(name);

function pressable(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const matches = renderer.root.findAll((node) => isHost(node, 'Pressable') && node.props.accessibilityLabel === label);
  expect(matches).toHaveLength(1);
  return matches[0];
}

async function mount(items: readonly MediaCellItem[], options: { columns?: 3 | 5; width?: number } = {}) {
  let visible = items;
  let selected: ReadonlySet<string> = new Set(items.map((item) => item.id));
  let renderer: ReactTestRenderer;
  const thumbnails = new Map<string, ThumbnailState>(items.map((item) => [item.id,
    Object.freeze({ uri: ['photo', 'video'].includes(item.mediaType) ? `file:///thumbs/${item.id}.jpg` : null,
      status: ['photo', 'video'].includes(item.mediaType) ? 'ready' : 'unavailable' })]));
  const onOpen = vi.fn();
  const onViewableIds = vi.fn();
  const onPlayAudio = vi.fn();
  const onSave = vi.fn();
  const onToggle = (id: string) => { selected = toggleId(selected, id); update(); };
  const onSetSelection = (value: ReadonlySet<string>) => { selected = value; update(); };
  const onToggleAll = () => {
    const scope = visible.map((item) => item.id);
    selected = setIdsSelected(selected, scope, selectionState(selected, scope) !== 'all');
    update();
  };
  const tree = () => React.createElement(React.Fragment, null,
    React.createElement(MediaSelectionList, { items: visible, selectedIds: selected, thumbnails, columns: options.columns ?? 3, width: options.width ?? 411,
      onOpen, onToggle, onSetSelection, onViewableIds, onPlayAudio }),
    React.createElement(SelectionFooter, { ...selectionTotals(visible, selected),
      state: selectionState(selected, visible.map((item) => item.id)), onSave, onToggleAll }));
  function update() { renderer.update(tree()); }
  await act(async () => {
    renderer = TestRenderer.create(tree(), { createNodeMock: (element) => {
      if (element.type === 'View') return { measureInWindow: (done: (x: number, y: number, width: number, height: number) => void) => {
        const props = element.props as { children?: unknown };
        const serialized = JSON.stringify(props.children, (key, value: unknown) => key === '_owner' ? undefined : value) ?? '';
        const index = Number(/fixture-(\d+)/.exec(serialized)?.[1] ?? 0);
        done(0, index * 100, 100, 90);
      } };
      return null;
    } });
    renderers.push(renderer);
  });
  return {
    renderer: renderer!, onOpen, onViewableIds, onPlayAudio, onSave,
    get selected() { return selected; },
    async toggle(id: string) {
      const item = items.find((file) => file.id === id)!;
      await act(async () => pressable(renderer, `picker.selectItem|name=${item.filename}`).props.onPress());
    },
    async change(value: ReadonlySet<string>) { await act(async () => { selected = value; update(); }); },
    async filter(next: readonly MediaCellItem[]) { await act(async () => { visible = next; update(); }); },
    async toggleAll() { await act(async () => pressable(renderer, 'picker.selectFilter').props.onPress()); },
  };
}

describe('actual selection cell render budgets', () => {
  it.each([500, 5_000])('renders only changed cells and affected aggregates with %i actual mounted files', async (count) => {
    const observed = counters();
    const items = fixture(count);
    const harness = await mount(items);
    expect(observed.cellIds()).toHaveLength(count);
    expect(new Set(observed.cellIds()).size).toBe(count);
    expect(observed.grid.mock.calls.every(([props]) => props.selected)).toBe(true);
    expect(observed.compact.mock.calls.every(([props]) => props.selected)).toBe(true);
    expect(observed.footer.mock.lastCall?.[0]).toMatchObject({ selected: count, total: count, state: 'all' });
    const nativeList = harness.renderer.root.findByType(hostType('SectionList'));
    expect(nativeList.props.stickySectionHeadersEnabled).toBe(true);
    const openOrder = harness.renderer.root.findAll((node) => isHost(node, 'Pressable')
      && String(node.props.accessibilityLabel).startsWith('picker.openItem|'))
      .map((node) => /name=([^|]+)/.exec(node.props.accessibilityLabel)?.[1]);
    expect(openOrder).toEqual(items.map((item) => item.filename));
    const viewability = nativeList.props.onViewableItemsChanged;
    const firstVisibleRow = nativeList.props.sections[0].data[0];
    await act(async () => viewability({ viewableItems: [{ item: firstVisibleRow, index: 0, isViewable: true }] }));
    expect(harness.onViewableIds).toHaveBeenCalledWith(firstVisibleRow.items.map((item: MediaCellItem) => item.id));
    harness.onViewableIds.mockClear();

    for (const target of [items[0], items[Math.floor(count / 2)], items[count - 1]]) {
      for (const selected of [false, true]) {
        observed.clear();
        await harness.toggle(target.id);
        expect(observed.cellIds()).toEqual([target.id]);
        expect(harness.selected.has(target.id)).toBe(selected);
        expect(observed.day).toHaveBeenCalledTimes(1);
        expect(observed.footer).toHaveBeenCalledTimes(1);
      }
    }

    observed.clear();
    await harness.change(new Set([...harness.selected, 'hidden-file']));
    expect(observed.cellIds()).toEqual([]);
    expect(observed.day).not.toHaveBeenCalled();
    expect(observed.footer).not.toHaveBeenCalled();

    const firstDay = items.filter((item) => item.dayKey === items[0].dayKey).map((item) => item.id);
    const headers = harness.renderer.root.findAll((node) => isHost(node, 'Pressable')
      && String(node.props.accessibilityLabel).startsWith('picker.selectDay|'));
    observed.clear();
    await act(async () => headers[0].props.onPress());
    expect(observed.cellIds().sort()).toEqual(firstDay.sort());
    expect(observed.day).toHaveBeenCalledTimes(1);
    expect(observed.footer.mock.lastCall?.[0]).toMatchObject({ selected: count - firstDay.length, total: count, state: 'some' });
    expect(harness.selected.has('hidden-file')).toBe(true);

    observed.clear();
    await harness.toggleAll();
    expect(observed.cellIds().sort()).toEqual(firstDay.sort());
    expect(harness.selected.size).toBe(count + 1);
    observed.clear();
    await harness.toggleAll();
    expect(new Set(observed.cellIds())).toEqual(new Set(items.map((item) => item.id)));
    expect(observed.cellIds()).toHaveLength(count);
    expect([...harness.selected]).toEqual(['hidden-file']);
    expect(observed.footer.mock.lastCall?.[0]).toMatchObject({ selected: 0, total: count, selectedBytes: 0, state: 'none' });
    expect(harness.onViewableIds).not.toHaveBeenCalled();
    expect(harness.renderer.root.findByType(hostType('SectionList')).props.onViewableItemsChanged).toBe(viewability);
    expect(harness.onPlayAudio).not.toHaveBeenCalled();
    expect(forbidden.videoPlayer).not.toHaveBeenCalled();
    expect(forbidden.audioPlayer).not.toHaveBeenCalled();
  }, 60_000);
});

describe('real cell controls and list integration', () => {
  it('isolates a pinned transcript from day controls while Oldest groups each ordinary date once', async () => {
    const original = fixture(4);
    const items: readonly MediaCellItem[] = [
      { ...original[3], id: 'chat-transcript', filename: 'selected-chat.txt', sourceKind: 'chat-transcript', dayKey: '2020-03-17' },
      { ...original[0], id: 'older-photo', dayKey: '2019-02-15' },
      { ...original[1], id: 'latest-video', dayKey: '2020-03-17' },
      { ...original[2], id: 'latest-voice', dayKey: '2020-03-17' },
    ];
    const harness = await mount(items);
    const headers = () => harness.renderer.root.findAll((node) => isHost(node, 'Pressable')
      && String(node.props.accessibilityLabel).startsWith('picker.selectDay|'));
    expect(headers()).toHaveLength(2);
    expect(headers().map((node) => node.props.accessibilityLabel)).toEqual([
      'picker.selectDay|date=February 15, 2019', 'picker.selectDay|date=March 17, 2020',
    ]);
    const sections = harness.renderer.root.findByType(hostType('SectionList')).props.sections as {
      ids: readonly string[]; data: readonly { items: readonly MediaCellItem[] }[];
    }[];
    expect(sections[0].data[0].items[0].id).toBe('chat-transcript');
    expect(sections.flatMap((section) => section.data.flatMap((row) => row.items.map((item) => item.id)))).toEqual(items.map((item) => item.id));
    const latestHeader = () => pressable(harness.renderer, 'picker.selectDay|date=March 17, 2020');
    await act(async () => latestHeader().props.onPress());
    expect(harness.selected).toEqual(new Set(['chat-transcript', 'older-photo']));
    expect(latestHeader().props.accessibilityState.checked).toBe(false);
    await harness.toggle('chat-transcript');
    expect(harness.selected).toEqual(new Set(['older-photo']));
    expect(latestHeader().props.accessibilityState.checked).toBe(false);
    await act(async () => latestHeader().props.onPress());
    expect(harness.selected).toEqual(new Set(['older-photo', 'latest-video', 'latest-voice']));
    expect(latestHeader().props.accessibilityState.checked).toBe(true);
  });

  it('groups the actual SectionList in display order with stable tie order and a separate unavailable-date section', async () => {
    const original = fixture(4);
    const items: readonly MediaCellItem[] = Object.freeze([
      Object.freeze({ ...original[0], dayKey: '2020-03-17' }),
      Object.freeze({ ...original[1], dayKey: '2020-03-17', dateBadge: 'approximate' as const }),
      Object.freeze({ ...original[2], dayKey: '2019-02-15' }),
      Object.freeze({ ...original[3], dayKey: null, dateBadge: 'missing' as const }),
    ]);
    const harness = await mount(items);
    const sections = () => harness.renderer.root.findByType(hostType('SectionList')).props.sections as { key: string; dayKey: string | null; ids: string[]; data: { items: MediaCellItem[] }[] }[];
    expect(sections().map((section) => ({ dayKey: section.dayKey, ids: section.ids }))).toEqual([
      { dayKey: '2020-03-17', ids: [items[0].id, items[1].id] },
      { dayKey: '2019-02-15', ids: [items[2].id] },
      { dayKey: null, ids: [items[3].id] },
    ]);
    expect(sections().flatMap((section) => section.data.flatMap((row) => row.items.map((item) => item.id)))).toEqual(items.map((item) => item.id));
    const keys = sections().map((section) => section.key);
    expect(new Set(keys).size).toBe(3);
    await harness.change(new Set(harness.selected));
    expect(sections().map((section) => section.key)).toEqual(keys);
    expect(items[1].dateBadge).toBe('approximate'); expect(items[3].dateBadge).toBe('missing');
    await harness.filter([items[2], items[0]]);
    expect(sections().map((section) => section.ids)).toEqual([[items[2].id], [items[0].id]]);
    expect(harness.selected.size).toBe(4);
  });

  it('renders the actual list empty state without constructing placeholder day groups or cells', async () => {
    const harness = await mount([]);
    expect(harness.renderer.root.findByType(hostType('SectionList')).props.sections).toEqual([]);
    expect(harness.renderer.root.findAllByType(hostType('Text')).some((node) => node.props.children === 'picker.empty')).toBe(true);
    expect(harness.renderer.root.findAll((node) => isHost(node, 'Pressable') && String(node.props.accessibilityLabel).startsWith('picker.openItem'))).toHaveLength(0);
  });

  it('turns a ready JPEG decode error into a usable placeholder and reports only the file ID', async () => {
    const item = fixture(2)[1];
    const onThumbnailError = vi.fn();
    const props = { item, selected: true, thumbnailUri: 'file:///thumbs/broken.jpg', thumbnailStatus: 'ready' as const,
      width: 130, onOpen: vi.fn(), onToggle: vi.fn(), onStartRange: vi.fn(), onRegisterCell: vi.fn(), onThumbnailError };
    let renderer: ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(React.createElement(MediaGridCell, props)); renderers.push(renderer); });
    await act(async () => renderer!.root.findByType(hostType('Image')).props.onError({ error: 'Synthetic JPEG decode failure' }));
    expect(renderer!.root.findAllByType(hostType('Image'))).toEqual([]);
    expect(renderer!.root.findAll((node) => node.props?.accessibilityLabel === 'picker.thumbnailUnavailable').length).toBeGreaterThan(0);
    expect(onThumbnailError).toHaveBeenCalledExactlyOnceWith(item.id);
    await act(async () => pressable(renderer!, `picker.openItem|name=${item.filename}|sender=${item.sender}|date=${item.dateLabel}`).props.onPress());
    expect(props.onOpen).toHaveBeenCalledWith(item.id);
    expect(props.onToggle).not.toHaveBeenCalled();
    expect(forbidden.videoPlayer).not.toHaveBeenCalled();
    expect(forbidden.audioPlayer).not.toHaveBeenCalled();
    await act(async () => renderer!.update(React.createElement(MediaGridCell, { ...props, thumbnailUri: 'file:///thumbs/recovered.jpg' })));
    expect(renderer!.root.findByType(hostType('Image')).props.source.uri).toBe('file:///thumbs/recovered.jpg');
    expect(onThumbnailError).toHaveBeenCalledTimes(1);
  });

  it('uses five-column visual rows without reordering files on a wider list', async () => {
    const observed = counters();
    const items = fixture(8).map((item, index) => ({ ...item, mediaType: index % 2 ? 'video' as const : 'photo' as const }));
    const harness = await mount(items, { columns: 5, width: 800 });
    const sections = harness.renderer.root.findByType(hostType('SectionList')).props.sections as { data: { items: MediaCellItem[] }[] }[];
    expect(sections.flatMap((section) => section.data.map((row) => row.items.length))).toEqual([5, 3]);
    expect(sections.flatMap((section) => section.data.flatMap((row) => row.items.map((item) => item.id)))).toEqual(items.map((item) => item.id));
    expect(observed.grid).toHaveBeenCalledTimes(8);
    expect(observed.compact).not.toHaveBeenCalled();
    expect(observed.grid.mock.calls.every(([props]) => props.width > 0 && props.width < 800 / 5)).toBe(true);
  });

  it('retains approximate/missing badges and nonfatal thumbnail fallback in the actual cells', async () => {
    const base = fixture(4);
    const props = { item: { ...base[1], dateBadge: 'approximate' as const }, selected: true,
      thumbnailUri: null, thumbnailStatus: 'unavailable' as const, width: 130,
      onOpen: vi.fn(), onToggle: vi.fn(), onStartRange: vi.fn(), onRegisterCell: vi.fn() };
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(React.Fragment, null,
        React.createElement(MediaGridCell, props),
        React.createElement(CompactMediaRow, { ...props, item: { ...base[3], dateBadge: 'missing' } })));
      renderers.push(renderer);
    });
    expect(renderer!.root.findAllByType(hostType('Image'))).toEqual([]);
    expect(renderer!.root.findAll((node) => node.props?.accessibilityLabel === 'picker.thumbnailUnavailable').length).toBeGreaterThan(0);
    expect(renderer!.root.findAll((node) => node.props?.accessibilityLabel === 'picker.date.approximate').length).toBeGreaterThan(0);
    const text = renderer!.root.findAllByType(hostType('Text')).flatMap((node) => node.children).filter((value) => typeof value === 'string').join(' ');
    expect(text).toContain('0:20');
    expect(text).toContain('picker.date.missing');
    expect(props.item.dateBadge).toBe('approximate');
    expect(forbidden.videoPlayer).not.toHaveBeenCalled();
    expect(forbidden.audioPlayer).not.toHaveBeenCalled();
  });

  it('opens a visual item on its body, changes selection only on its labelled checkbox, and keeps compact controls accessible', async () => {
    const items = fixture(4);
    const harness = await mount(items);
    const open = pressable(harness.renderer, `picker.openItem|name=${items[0].filename}|sender=${items[0].sender}|date=${items[0].dateLabel}`);
    await act(async () => open.props.onPress());
    expect(harness.onOpen).toHaveBeenCalledWith(items[0].id);
    expect(harness.selected.size).toBe(4);
    harness.onOpen.mockClear();
    await harness.toggle(items[0].id);
    expect(harness.onOpen).not.toHaveBeenCalled();
    expect(pressable(harness.renderer, `picker.selectItem|name=${items[0].filename}`).props.accessibilityState.checked).toBe(false);
    expect(pressable(harness.renderer, `picker.selectItem|name=${items[3].filename}`).props.accessibilityState.checked).toBe(true);
    const audio = pressable(harness.renderer, `picker.playAudio|name=${items[2].filename}`);
    await act(async () => audio.props.onPress());
    expect(harness.onPlayAudio).toHaveBeenCalledWith(items[2].id);
    expect(harness.onOpen).not.toHaveBeenCalled();
    expect(forbidden.videoPlayer).not.toHaveBeenCalled();
    expect(forbidden.audioPlayer).not.toHaveBeenCalled();
  });

  it('shows active-filter footer values and preserves filtered-out selections', async () => {
    const observed = counters();
    const items = fixture(8);
    const harness = await mount(items);
    await harness.filter([items[0], items[4]]);
    expect(observed.footer.mock.lastCall?.[0]).toMatchObject({ selected: 2, total: 2, selectedBytes: 600, state: 'all' });
    await harness.toggleAll();
    expect(observed.footer.mock.lastCall?.[0]).toMatchObject({ selected: 0, total: 2, selectedBytes: 0, state: 'none' });
    expect([...harness.selected]).toEqual(items.filter((item) => ![items[0].id, items[4].id].includes(item.id)).map((item) => item.id));
    await harness.filter(items);
    expect(observed.footer.mock.lastCall?.[0]).toMatchObject({ selected: 6, total: 8, state: 'some' });
    expect(pressable(harness.renderer, `picker.selectItem|name=${items[0].filename}`).props.accessibilityState.checked).toBe(false);
  });

  it('uses measured long-drag ranges, restores a shrunk range, and cancels the gesture when filtering hides its anchor', async () => {
    const items = fixture(6);
    const harness = await mount(items);
    const open = pressable(harness.renderer, `picker.openItem|name=${items[0].filename}|sender=${items[0].sender}|date=${items[0].dateLabel}`);
    await act(async () => { open.props.onPressIn(); open.props.onLongPress(); open.props.onPress(); });
    expect(harness.onOpen).not.toHaveBeenCalled();
    expect([...harness.selected]).toEqual(items.slice(1).map((item) => item.id));
    const gesture = () => harness.renderer.root.findAll((node) => isHost(node, 'View') && typeof node.props.onPanResponderMove === 'function')[0];
    expect(harness.renderer.root.findByType(hostType('SectionList')).props.scrollEnabled).toBe(false);
    await act(async () => gesture().props.onPanResponderMove({ nativeEvent: { pageX: 50, pageY: 350 } }));
    expect([...harness.selected]).toEqual(items.slice(4).map((item) => item.id));
    await act(async () => gesture().props.onPanResponderMove({ nativeEvent: { pageX: 50, pageY: 150 } }));
    expect([...harness.selected]).toEqual(items.slice(2).map((item) => item.id));
    await harness.filter(items.slice(2));
    const before = harness.selected;
    await act(async () => gesture().props.onPanResponderMove({ nativeEvent: { pageX: 50, pageY: 450 } }));
    expect(harness.selected).toBe(before);
    expect(harness.renderer.root.findByType(hostType('SectionList')).props.scrollEnabled).toBe(true);
  });

  it('ends a long press with no move on the bubbled touch end and leaves no stale range gesture', async () => {
    const items = fixture(4);
    const harness = await mount(items);
    const open = pressable(harness.renderer, `picker.openItem|name=${items[0].filename}|sender=${items[0].sender}|date=${items[0].dateLabel}`);
    await act(async () => open.props.onLongPress());
    expect(harness.renderer.root.findByType(hostType('SectionList')).props.scrollEnabled).toBe(false);
    const surface = harness.renderer.root.findAll((node) => isHost(node, 'View') && typeof node.props.onPanResponderMove === 'function')[0];
    expect(typeof surface.props.onTouchEnd).toBe('function');
    await act(async () => surface.props.onTouchEnd({ nativeEvent: {} }));
    expect(harness.renderer.root.findByType(hostType('SectionList')).props.scrollEnabled).toBe(true);
    const before = harness.selected;
    await act(async () => surface.props.onPanResponderMove({ nativeEvent: { pageX: 50, pageY: 350 } }));
    expect(harness.selected).toBe(before);
    expect(harness.onOpen).not.toHaveBeenCalled();
  });

  it('disables empty-scope controls and reports unknown selected sizes explicitly', async () => {
    const observed = counters();
    const sample = fixture(1)[0];
    const harness = await mount([{ ...sample, sizeBytes: undefined }]);
    expect(observed.footer.mock.lastCall?.[0]).toMatchObject({ selected: 1, total: 1, selectedBytes: 0, unknownSizeCount: 1 });
    const text = harness.renderer.root.findAllByType(hostType('Text')).flatMap((node) => node.children).filter((value) => typeof value === 'string').join(' ');
    expect(text).toContain('picker.unknownSize|count=1');
    await harness.filter([]);
    expect(pressable(harness.renderer, 'picker.selectFilter').props.accessibilityState).toEqual({ checked: false, disabled: true, busy: false });
    expect(harness.renderer.root.findByType(hostType('PrimaryButton')).props.disabled).toBe(true);
    expect(harness.selected.has(sample.id)).toBe(true);
  });
});
