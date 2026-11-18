import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoLeaseController } from '../src/lib/videoLease';
import type { SharedMediaAudio } from '../src/components/MediaViewer';
import type { MediaCellItem } from '../src/components/MediaSelectionList';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
// Drain the current microtask chain without a timer delay or assumptions about
// how many promise-adoption steps the release adapter needs.
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const A = { fileId: 'A', uri: 'file:///A.mp4' };
const B = { fileId: 'B', uri: 'file:///B.mp4' };
const C = { fileId: 'C', uri: 'file:///C.mp4' };

describe('video lease retirement state machine', () => {
  it('holds replacement until the matching unmount acknowledgement and deferred native barrier finish', async () => {
    let blocked: ReturnType<typeof deferred> | undefined;
    const barrier = vi.fn(() => blocked?.promise ?? Promise.resolve());
    const owner = new VideoLeaseController(barrier);
    owner.request(A); await flush();
    const first = owner.snapshot().mounted!;
    expect(first).toMatchObject(A);
    expect(owner.claim(first.id)).toBe(true);
    blocked = deferred();
    const callsBefore = barrier.mock.calls.length;
    owner.request(B);
    expect(owner.snapshot().mounted).toBeNull();
    expect(barrier.mock.calls.length).toBe(callsBefore);
    owner.didUnmount(first.id + 100);
    expect(barrier.mock.calls.length).toBe(callsBefore);
    owner.didUnmount(first.id);
    owner.didUnmount(first.id);
    await flush();
    expect(barrier.mock.calls.length).toBe(callsBefore + 1);
    expect(owner.snapshot().mounted).toBeNull();
    blocked.resolve(); await flush();
    expect(owner.snapshot().mounted).toMatchObject(B);
    expect(owner.snapshot().mounted!.id).toBeGreaterThan(first.id);
    owner.dispose();
  });

  it('mounts only the latest rapid request across the acknowledgement and native retirement window', async () => {
    let blocked: ReturnType<typeof deferred> | undefined;
    const owner = new VideoLeaseController(() => blocked?.promise ?? Promise.resolve());
    const mounted: string[] = [];
    const unsubscribe = owner.subscribe(() => { const lease = owner.snapshot().mounted; if (lease) mounted.push(lease.fileId); });
    owner.request(A); await flush();
    const first = owner.snapshot().mounted!;
    expect(owner.claim(first.id)).toBe(true);
    blocked = deferred();
    owner.request(B); owner.request(C);
    owner.didUnmount(first.id);
    owner.request({ fileId: 'D', uri: 'file:///D.mp4' });
    owner.request({ fileId: 'E', uri: 'file:///E.mp4' });
    expect(mounted).toEqual(['A']);
    blocked.resolve(); await flush();
    expect(mounted).toEqual(['A', 'E']);
    unsubscribe(); owner.dispose();
  });

  it('reuses a repeated exact target but retires the same file ID when its source URI changes', async () => {
    let blocked: ReturnType<typeof deferred> | undefined;
    const barrier = vi.fn(() => blocked?.promise ?? Promise.resolve());
    const owner = new VideoLeaseController(barrier);
    owner.request(A); await flush();
    const first = owner.snapshot().mounted!;
    expect(owner.claim(first.id)).toBe(true);
    const snapshot = owner.snapshot();
    const calls = barrier.mock.calls.length;
    owner.request({ ...A }); owner.request({ ...A });
    expect(owner.snapshot()).toBe(snapshot);
    expect(barrier.mock.calls.length).toBe(calls);
    blocked = deferred();
    owner.request({ ...A, uri: 'file:///replacement-A.mp4' });
    expect(owner.snapshot().mounted).toBeNull();
    owner.didUnmount(first.id);
    blocked.resolve(); await flush();
    expect(owner.snapshot().mounted).toMatchObject({ fileId: 'A', uri: 'file:///replacement-A.mp4' });
    expect(owner.snapshot().mounted!.id).not.toBe(first.id);
    owner.dispose();
  });

  it('serializes close followed by immediate reopen, and ignores stale cleanup after the new lease mounts', async () => {
    let blocked: ReturnType<typeof deferred> | undefined;
    const barrier = vi.fn(() => blocked?.promise ?? Promise.resolve());
    const owner = new VideoLeaseController(barrier);
    owner.request(A); await flush();
    const first = owner.snapshot().mounted!;
    expect(owner.claim(first.id)).toBe(true);
    blocked = deferred();
    owner.request(null); owner.didUnmount(first.id); owner.request(A);
    expect(owner.snapshot().mounted).toBeNull();
    blocked.resolve(); await flush();
    const reopened = owner.snapshot().mounted!;
    expect(reopened.fileId).toBe('A');
    expect(reopened.id).toBeGreaterThan(first.id);
    const calls = barrier.mock.calls.length;
    owner.didUnmount(first.id);
    expect(owner.snapshot().mounted).toBe(reopened);
    expect(barrier.mock.calls.length).toBe(calls);
    owner.dispose();
  });

  it('does not remount after close or disposal before a delayed retirement settles', async () => {
    for (const dispose of [false, true]) {
      let blocked: ReturnType<typeof deferred> | undefined;
      const owner = new VideoLeaseController(() => blocked?.promise ?? Promise.resolve());
      owner.request(A); await flush();
      const first = owner.snapshot().mounted!;
      expect(owner.claim(first.id)).toBe(true);
      blocked = deferred();
      owner.request(B); owner.didUnmount(first.id);
      if (dispose) owner.dispose(); else owner.request(null);
      blocked.resolve(); await flush();
      expect(owner.snapshot().mounted).toBeNull();
      if (dispose) { owner.request(C); expect(owner.snapshot().mounted).toBeNull(); }
      owner.dispose();
    }
  });

  it('fails closed on native-barrier rejection and cannot create a replacement through another request', async () => {
    let blocked: ReturnType<typeof deferred> | undefined;
    const owner = new VideoLeaseController(() => blocked?.promise ?? Promise.resolve());
    owner.request(A); await flush();
    const first = owner.snapshot().mounted!;
    expect(owner.claim(first.id)).toBe(true);
    blocked = deferred();
    owner.request(B); owner.didUnmount(first.id);
    blocked.reject(new Error('Native retirement could not be verified')); await flush();
    expect(owner.snapshot()).toEqual({ mounted: null, failed: true });
    owner.request(C); await flush();
    expect(owner.snapshot()).toEqual({ mounted: null, failed: true });
    owner.dispose();
  });

  it('replaces an uncommitted offer immediately and rejects a stale claim', async () => {
    const barrier = vi.fn(async () => undefined);
    const owner = new VideoLeaseController(barrier);
    owner.request(A);
    const offeredA = owner.snapshot().mounted!;
    owner.request(B);
    const offeredB = owner.snapshot().mounted!;
    expect(offeredB).toMatchObject(B);
    expect(offeredB.id).toBeGreaterThan(offeredA.id);
    expect(owner.claim(offeredA.id)).toBe(false);
    expect(owner.claim(offeredB.id)).toBe(true);
    owner.didUnmount(offeredA.id);
    expect(owner.snapshot().mounted).toBe(offeredB);
    expect(barrier).not.toHaveBeenCalled();
    owner.dispose(); owner.didUnmount(offeredB.id); await flush();
  });
});

const native = vi.hoisted(() => ({
  next: 0, live: new Set<number>(), released: new Set<number>(),
  created: [] as { id: number; source: string }[], events: [] as string[],
  attempts: [] as string[], failSource: undefined as string | undefined,
  overlap: [] as string[], barrier: vi.fn<() => Promise<void>>(),
}));
vi.mock('expo-video', () => ({ VideoView: 'VideoView',
  useVideoPlayer: () => { throw new Error('Render-time player allocation is forbidden in the committed lease host'); },
  createVideoPlayer: (source: string) => {
    native.attempts.push(source);
    if (source === native.failSource) throw new Error('Synthetic constructor failure');
    if (native.live.size) native.overlap.push(source);
    const id = ++native.next;
    native.live.add(id); native.created.push({ id, source }); native.events.push(`create:${source}`);
    return { id, loop: false, status: 'readyToPlay', pause: vi.fn(),
      addListener: () => ({ remove: () => undefined }),
      release: () => { native.released.add(id); native.events.push(`js-release:${id}`); } };
  },
}));
vi.mock('expo-audio', () => ({ useAudioPlayer: () => { throw new Error('Video host must not create audio players'); }, useAudioPlayerStatus: vi.fn() }));
vi.mock('expo-image', () => ({ Image: 'Image' }));
vi.mock('expo-file-system', () => ({ File: class {} }));
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable', Modal: 'Modal',
  PanResponder: { create: (handlers: object) => ({ panHandlers: handlers }) },
  StyleSheet: { create: <T,>(styles: T) => styles, absoluteFillObject: {} } }));
vi.mock('react-native-paper', () => ({ Text: 'Text', Button: 'Button', IconButton: 'IconButton', ActivityIndicator: 'ActivityIndicator' }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('../src/theme/useAppTheme', () => {
  const theme = { colors: { background: '#fff', primary: '#123', surfaceVariant: '#eee' } };
  return { useAppTheme: () => theme };
});
vi.mock('../src/components/MediaSelectionList', () => ({ formatSelectionBytes: (bytes: number) => `${bytes} B` }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../src/native/mediaPreviews', () => ({ awaitMediaRelease: native.barrier, getThumbnail: vi.fn(), openFileInOtherApp: vi.fn() }));

describe('actual committed viewer owner and deferred native release ordering', () => {
  const renderers: ReactTestRenderer[] = [];
  let waiting: { ids: number[]; done: ReturnType<typeof deferred> }[] = [];
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  let viewer: typeof import('../src/components/MediaViewer');
  beforeAll(() => { environment.IS_REACT_ACT_ENVIRONMENT = true; });
  afterAll(() => { if (previous === undefined) delete environment.IS_REACT_ACT_ENVIRONMENT; else environment.IS_REACT_ACT_ENVIRONMENT = previous; });
  beforeEach(async () => {
    // A rejected FIFO fence deliberately seals its production module lifetime.
    // Isolate module instances between host cases instead of adding a reset API.
    vi.resetModules();
    viewer = await import('../src/components/MediaViewer');
    native.next = 0; native.live.clear(); native.released.clear(); native.created.length = 0;
    native.events.length = 0; native.overlap.length = 0; waiting = [];
    native.attempts.length = 0; native.failSource = undefined;
    native.barrier.mockReset().mockImplementation(() => {
      const ids = [...native.released].filter((id) => native.live.has(id));
      native.events.push('barrier');
      if (!ids.length) return Promise.resolve();
      const done = deferred(); waiting.push({ ids, done }); return done.promise;
    });
  });
  afterEach(async () => {
    await act(async () => { renderers.splice(0).forEach((renderer) => renderer.unmount()); });
    await settleNative();
  });
  async function settleNative() {
    await act(async () => {
      const pending = waiting.splice(0);
      for (const operation of pending) {
        for (const id of operation.ids) { native.live.delete(id); native.events.push(`native-release:${id}`); }
        operation.done.resolve();
      }
      await flush();
    });
  }
  const items: readonly MediaCellItem[] = [A, B, C].map((item) => ({
    id: item.fileId, filename: `${item.fileId}.mp4`, uri: item.uri, mediaType: 'video',
    sender: 'Synthetic', dateLabel: '2020-03-17', dateBadge: 'known', dayKey: '2020-03-17',
  }));
  const audio = { player: null, stop: vi.fn(), play: vi.fn(), release: vi.fn(async () => undefined), status: {}, error: false } as unknown as SharedMediaAudio;
  const noop = () => undefined;
  let currentOwner: VideoLeaseController;
  function Owner({ currentId }: { currentId: string | null }) {
    const controller = viewer.useViewerVideoController();
    currentOwner = controller;
    return React.createElement(viewer.MediaViewer, { items, currentId, selectedIds: new Set(['A', 'B', 'C']),
      onPage: noop, onDismiss: noop, onToggle: noop, video: controller, audio });
  }
  async function mountOwner(id = 'A', offer = true) {
    let renderer: ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(React.createElement(Owner, { currentId: id })); renderers.push(renderer); });
    if (offer) await act(async () => {
      currentOwner.request({ fileId: id, uri: items.find((item) => item.id === id)!.uri });
      await flush();
    });
    return renderer!;
  }
  async function page(renderer: ReactTestRenderer, id: string | null, key?: string) {
    await act(async () => {
      // Retire synchronously before changing visible content, as the real picker
      // page/dismiss handlers do; passive-effect retirement would be too late.
      currentOwner.request(null);
      renderer.update(React.createElement(Owner, { key, currentId: id }));
      const item = items.find((file) => file.id === id);
      if (item) currentOwner.request({ fileId: item.id, uri: item.uri });
    });
  }

  it('uses actual manual-player cleanup before the native barrier and mounts only the latest rapid page', async () => {
    const renderer = await mountOwner();
    expect(native.created.map((player) => player.source)).toEqual([A.uri]);
    await page(renderer, 'B');
    expect(native.events).toContain('js-release:1');
    expect(native.events.slice(native.events.indexOf('js-release:1') + 1)).toContain('barrier');
    expect(native.live.size).toBe(1);
    await page(renderer, 'C');
    expect(native.created).toHaveLength(1);
    await settleNative();
    expect(native.created.map((player) => player.source)).toEqual([A.uri, C.uri]);
    expect(native.live.size).toBe(1);
    expect(native.overlap).toEqual([]);
  });

  it('does not create a second player on modal close and immediate reopen while native cleanup is pending', async () => {
    const renderer = await mountOwner();
    await page(renderer, null);
    await page(renderer, 'B');
    expect(native.created).toHaveLength(1);
    await settleNative();
    expect(native.created.map((player) => player.source)).toEqual([A.uri, B.uri]);
    expect(native.overlap).toEqual([]);
  });

  it('does not bypass queued native release when the real owner hook unmounts and remounts', async () => {
    const renderer = await mountOwner();
    await act(async () => renderer.update(React.createElement(Owner, { key: 'replacement-owner', currentId: 'B' })));
    await act(async () => currentOwner.request(B));
    expect(native.events).toContain('js-release:1');
    expect(native.created).toHaveLength(1);
    await settleNative();
    expect(native.created.map((player) => player.source)).toEqual([A.uri, B.uri]);
    expect(native.overlap).toEqual([]);
  });

  it('constructs only B when A and B are requested before the next React commit', async () => {
    await mountOwner('B', false);
    await act(async () => { currentOwner.request(A); currentOwner.request(B); await flush(); });
    expect(native.created.map((player) => player.source)).toEqual([B.uri]);
    expect(native.events.some((event) => event.startsWith('js-release:'))).toBe(false);
    expect(native.overlap).toEqual([]);
  });

  it('drops a stale queued acquisition and constructs only the latest owner target after retirement', async () => {
    const renderer = await mountOwner();
    await act(async () => renderer.update(React.createElement(Owner, { key: 'queued-owner', currentId: 'B' })));
    await act(async () => { currentOwner.request(B); await flush(); });
    expect(native.created.map((player) => player.source)).toEqual([A.uri]);
    await page(renderer, 'C', 'queued-owner');
    await settleNative();
    expect(native.created.map((player) => player.source)).toEqual([A.uri, C.uri]);
    expect(native.attempts).toEqual([A.uri, C.uri]);
    expect(native.overlap).toEqual([]);
  });

  it('shows a fallback and does not repeatedly construct players after a constructor failure', async () => {
    native.failSource = A.uri;
    const renderer = await mountOwner();
    expect(native.attempts).toEqual([A.uri]);
    expect(native.created).toEqual([]);
    expect(native.live.size).toBe(0);
    const unavailable = renderer.root.findAll((node) => node.type === ('Text' as React.ElementType)
      && node.children.includes('viewer.previewUnavailable'));
    expect(unavailable.length).toBeGreaterThan(0);
    await page(renderer, 'B');
    await flush();
    expect(native.created).toEqual([]);
    expect(native.attempts).toEqual([A.uri]);
    expect(native.overlap).toEqual([]);
  });

  it('fails closed across owner remounts when the native release fence rejects', async () => {
    const renderer = await mountOwner();
    await page(renderer, 'B');
    expect(waiting.length).toBeGreaterThan(0);
    await act(async () => {
      waiting.splice(0).forEach((operation) => operation.done.reject(new Error('Native release unverified')));
      await flush();
    });
    expect(native.created.map((player) => player.source)).toEqual([A.uri]);
    expect(native.live.size).toBe(1);
    await act(async () => renderer.update(React.createElement(Owner, { key: 'after-failed-fence', currentId: 'C' })));
    await act(async () => { currentOwner.request(C); await flush(); });
    expect(native.created.map((player) => player.source)).toEqual([A.uri]);
    expect(native.overlap).toEqual([]);
    const unavailable = renderer.root.findAll((node) => node.type === ('Text' as React.ElementType)
      && node.children.includes('viewer.previewUnavailable'));
    expect(unavailable.length).toBeGreaterThan(0);
  });
});
