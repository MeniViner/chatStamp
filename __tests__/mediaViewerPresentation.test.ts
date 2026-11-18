import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MediaViewer, type SharedMediaAudio } from '../src/components/MediaViewer';
import type { MediaCellItem } from '../src/components/MediaSelectionList';
import { VideoLeaseController } from '../src/lib/videoLease';

const resources = vi.hoisted(() => ({ video: vi.fn(), audio: vi.fn() }));
vi.mock('expo-video', () => ({ VideoView: 'VideoView', createVideoPlayer: resources.video }));
vi.mock('expo-audio', () => ({ createAudioPlayer: resources.audio }));
vi.mock('expo-image', () => ({ Image: 'Image' }));
vi.mock('expo-file-system', () => ({ File: class {} }));
vi.mock('react-native', () => ({ Modal: 'Modal', Pressable: 'Pressable', View: 'View', PanResponder: { create: (handlers: object) => ({ panHandlers: handlers }) }, StyleSheet: { create: <T,>(styles: T) => styles } }));
vi.mock('react-native-paper', () => ({ Text: 'Text', Button: 'Button', IconButton: 'IconButton', ActivityIndicator: 'ActivityIndicator' }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('../src/theme/useAppTheme', () => ({ useAppTheme: () => ({ colors: { background: '#fff', surfaceVariant: '#eee', primary: '#123' } }) }));
vi.mock('../src/native/mediaPreviews', () => ({ awaitMediaRelease: async () => undefined, getThumbnail: vi.fn(), openFileInOtherApp: vi.fn() }));
vi.mock('../src/components/MediaSelectionList', () => ({ formatSelectionBytes: (value: number) => `${value} B` }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const host = (name: string) => name as React.ElementType;
const item = (id: string, mediaType: MediaCellItem['mediaType'] = 'document'): MediaCellItem => ({ id, filename: `${id}.${mediaType === 'voice' ? 'opus' : 'txt'}`, uri: `file:///synthetic/${id}`, mediaType, sender: 'QA Dana', dateLabel: '2019-02-26', dateBadge: 'known', dayKey: '2019-02-26' });
function audio(currentTime = 15, duration = 60, error = false) {
  const seek = vi.fn();
  const value: SharedMediaAudio = { activeId: 'voice', player: { seekTo: seek } as unknown as NonNullable<SharedMediaAudio['player']>,
    status: { currentTime, duration, playing: !error, isLoaded: true, playbackState: error ? 'error' : 'readyToPlay', isBuffering: false },
    error, play: vi.fn(async () => undefined), stop: vi.fn(), release: vi.fn(async () => undefined) };
  return { value, seek };
}
const renderers: ReactTestRenderer[] = [];
const env = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previous = env.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { env.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { if (previous === undefined) delete env.IS_REACT_ACT_ENVIRONMENT; else env.IS_REACT_ACT_ENVIRONMENT = previous; });
afterEach(async () => { await act(async () => renderers.splice(0).forEach((renderer) => renderer.unmount())); expect(resources.video).not.toHaveBeenCalled(); expect(resources.audio).not.toHaveBeenCalled(); });
async function mount(items: readonly MediaCellItem[], currentId: string | null, sharedAudio = audio().value) {
  const controller = new VideoLeaseController(async () => undefined);
  const onPage = vi.fn((id: string) => { currentId = id; renderer.update(tree()); });
  const tree = () => React.createElement(MediaViewer, { items, currentId, selectedIds: new Set(['newest', 'oldest', 'hidden']), onPage,
    onDismiss: () => undefined, onToggle: () => undefined, video: controller, audio: sharedAudio });
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(tree()); renderers.push(renderer); });
  return { renderer, onPage,
    button: (name: string) => renderer.root.findAllByType(host('IconButton')).find((node) => node.props.accessibilityLabel === `viewer.${name}`)!,
    async reorder(value: readonly MediaCellItem[], id: string) { items = value; currentId = id; await act(async () => renderer.update(tree())); } };
}

describe('actual voice viewer presentation and controls', () => {
  it('shows real15/60 progress and forwards bounded accessible seek actions', async () => {
    const shared = audio(), ui = await mount([item('voice', 'voice')], 'voice', shared.value);
    const seek = ui.renderer.root.findAllByType(host('Pressable')).find((node) => node.props.accessibilityLabel === 'viewer.seek')!;
    expect(seek.props.accessibilityValue).toEqual({ min: 0, max: 60, now: 15 });
    expect(Object.assign({}, ...seek.findByType(host('View')).props.style).width).toBe('25%');
    expect(ui.renderer.root.findAllByType(host('Text')).some((node) => Array.isArray(node.props.children) && node.props.children.join('') === '0:15 / 1:00')).toBe(true);
    await act(async () => seek.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
    expect(shared.seek).toHaveBeenLastCalledWith(25);
    await act(async () => seek.props.onPress({ nativeEvent: { locationX: 520 } }));
    expect(shared.seek).toHaveBeenLastCalledWith(60);
  });

  it('keeps zero-duration progress finite instead of producing a NaN width or seek value', async () => {
    const shared = audio(0, 0), ui = await mount([item('voice', 'voice')], 'voice', shared.value);
    const seek = ui.renderer.root.findAllByType(host('Pressable')).find((node) => node.props.accessibilityLabel === 'viewer.seek')!;
    expect(Object.assign({}, ...seek.findByType(host('View')).props.style).width).toBe('0%');
    await act(async () => seek.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
    expect(shared.seek).toHaveBeenLastCalledWith(0);
  });

  it('shows a real playback failure and preserves the external-open fallback', async () => {
    const ui = await mount([item('voice', 'voice')], 'voice', audio(0, 0, true).value);
    expect(ui.renderer.root.findAllByType(host('Text')).some((node) => node.props.accessibilityRole === 'alert' && node.props.children === 'viewer.audioError')).toBe(true);
    expect(ui.renderer.root.findAllByType(host('Button')).some((node) => node.props.children === 'viewer.openExternal')).toBe(true);
  });
});

describe('actual viewer paging uses visible order independently of selected IDs', () => {
  it('includes unchecked visible pages, respects boundaries, and follows a new filtered sort order', async () => {
    const items = [item('newest'), item('unchecked-middle'), item('oldest')];
    const ui = await mount(items, 'newest');
    expect(ui.button('previous').props.disabled).toBe(true);
    await act(async () => ui.button('next').props.onPress());
    expect(ui.onPage).toHaveBeenLastCalledWith('unchecked-middle');
    await act(async () => ui.button('next').props.onPress());
    expect(ui.onPage).toHaveBeenLastCalledWith('oldest'); expect(ui.button('next').props.disabled).toBe(true);
    await act(async () => ui.button('previous').props.onPress());
    expect(ui.onPage).toHaveBeenLastCalledWith('unchecked-middle');
    await ui.reorder([...items].reverse(), 'oldest');
    await act(async () => ui.button('next').props.onPress());
    expect(ui.onPage).toHaveBeenLastCalledWith('unchecked-middle');
    expect(ui.onPage.mock.calls.flat()).not.toContain('hidden');
  });

  it.each([{ items: [] }, { items: [item('visible')] }])('keeps an absent current item out of the actual native modal for $items', async ({ items }) => {
    const ui = await mount(items, 'hidden');
    expect(ui.renderer.root.findByType(host('Modal')).props.visible).toBe(false);
    expect(ui.renderer.root.findAllByType(host('IconButton'))).toHaveLength(0);
  });

  it('disables both directions for a single visible page and never emits an out-of-bounds ID', async () => {
    const ui = await mount([item('only')], 'only');
    expect(ui.button('previous').props.disabled).toBe(true); expect(ui.button('next').props.disabled).toBe(true);
    await act(async () => { ui.button('previous').props.onPress(); ui.button('next').props.onPress(); });
    expect(ui.onPage).not.toHaveBeenCalled();
  });
});
