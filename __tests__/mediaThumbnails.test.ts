import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMediaThumbnails } from '../src/components/useMediaThumbnails';
import type { MediaCellItem } from '../src/components/MediaSelectionList';

const native = vi.hoisted(() => ({ getThumbnail: vi.fn(), invalidateThumbnail: vi.fn() }));
vi.mock('../src/native/mediaPreviews', () => native);
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const ready = (uri: string) => ({ available: true as const, uri, width: 256, height: 256,
  cacheKey: uri, cacheHit: false, kind: 'image' as const });
const unavailable = { available: false as const, reason: 'decode-failed' as const };
const item = (id: string, uri = `file:///source/${id}.jpg`): MediaCellItem => ({
  id, uri, filename: `${id}.jpg`, mediaType: 'photo', sender: 'Synthetic', dateLabel: '2020-03-17',
  dateBadge: 'known', dayKey: '2020-03-17',
});

describe('actual thumbnail hook coordination', () => {
  const renderers: ReactTestRenderer[] = [];
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  beforeAll(() => { environment.IS_REACT_ACT_ENVIRONMENT = true; });
  afterAll(() => { if (previous === undefined) delete environment.IS_REACT_ACT_ENVIRONMENT; else environment.IS_REACT_ACT_ENVIRONMENT = previous; });
  beforeEach(() => { native.getThumbnail.mockReset(); native.invalidateThumbnail.mockReset().mockResolvedValue(undefined); });
  afterEach(async () => { await act(async () => renderers.splice(0).forEach((renderer) => renderer.unmount())); });

  async function mount(items: readonly MediaCellItem[]) {
    let current: ReturnType<typeof useMediaThumbnails>;
    function Probe({ files }: { files: readonly MediaCellItem[] }) { current = useMediaThumbnails(files); return null; }
    let renderer: ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(React.createElement(Probe, { files: items })); renderers.push(renderer); await flush(); });
    return {
      get value() { return current!; },
      async visible(ids: readonly string[]) { await act(async () => { current.onViewableIds(ids); await flush(); }); },
      async failed(id: string) { await act(async () => { current.onThumbnailError(id); await flush(); }); },
      async replace(files: readonly MediaCellItem[]) { await act(async () => { renderer.update(React.createElement(Probe, { files })); await flush(); }); },
      async unmount() { await act(async () => renderer.unmount()); renderers.splice(renderers.indexOf(renderer), 1); },
    };
  }

  it('requests one initial JPEG per file and keeps request callbacks stable across state updates', async () => {
    native.getThumbnail.mockResolvedValue(ready('file:///cache/a.jpg'));
    const hook = await mount([item('A')]);
    expect(native.getThumbnail).toHaveBeenCalledExactlyOnceWith('file:///source/A.jpg', 256);
    expect(hook.value.thumbnails.get('A')).toMatchObject({ uri: 'file:///cache/a.jpg', status: 'ready' });
    const callback = hook.value.onThumbnailError;
    await hook.visible(['A']);
    await hook.visible(['A']);
    expect(hook.value.onThumbnailError).toBe(callback);
    expect(native.invalidateThumbnail).not.toHaveBeenCalled();
  });

  it('invalidates a failed JPEG and allows only one failed retry within its visible visit', async () => {
    native.getThumbnail.mockResolvedValueOnce(ready('file:///cache/broken.jpg')).mockResolvedValue(unavailable);
    const hook = await mount([item('A')]);
    await hook.failed('A');
    expect(native.invalidateThumbnail).toHaveBeenCalledExactlyOnceWith('file:///cache/broken.jpg');
    expect(native.getThumbnail).toHaveBeenCalledTimes(2);
    expect(hook.value.thumbnails.get('A')).toEqual({ uri: null, status: 'unavailable' });
    for (let index = 0; index < 10; index += 1) await hook.failed('A');
    expect(native.getThumbnail).toHaveBeenCalledTimes(2);
    expect(native.invalidateThumbnail).toHaveBeenCalledTimes(1);
  });

  it('does not loop or request another JPEG when invalidation itself fails', async () => {
    native.getThumbnail.mockResolvedValue(ready('file:///cache/broken.jpg'));
    native.invalidateThumbnail.mockRejectedValue(new Error('Synthetic cache invalidation failure'));
    const hook = await mount([item('A')]);
    const initialCalls = native.getThumbnail.mock.calls.length;
    await hook.failed('A'); await hook.failed('A');
    expect(hook.value.thumbnails.get('A')).toEqual({ uri: null, status: 'unavailable' });
    expect(native.getThumbnail).toHaveBeenCalledTimes(initialCalls);
    expect(native.invalidateThumbnail).toHaveBeenCalledTimes(1);
  });

  it('resets the single-retry budget only after a file leaves and re-enters the visible window', async () => {
    native.getThumbnail.mockResolvedValueOnce(ready('file:///cache/first.jpg')).mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce(ready('file:///cache/second.jpg')).mockResolvedValue(unavailable);
    const voice = { ...item('voice'), filename: 'voice.opus', mediaType: 'voice' as const };
    const hook = await mount([item('A'), voice]);
    await hook.failed('A'); await hook.failed('A');
    expect(native.getThumbnail).toHaveBeenCalledTimes(2);
    await hook.visible(['voice']);
    await hook.visible(['A']);
    expect(hook.value.thumbnails.get('A')?.uri).toBe('file:///cache/second.jpg');
    await hook.failed('A'); await hook.failed('A');
    expect(native.getThumbnail).toHaveBeenCalledTimes(4);
    expect(native.invalidateThumbnail).toHaveBeenCalledTimes(2);
  });

  it('does not publish a late completion from replaced items even when the file ID is reused', async () => {
    const old = deferred<ReturnType<typeof ready>>(), fresh = deferred<ReturnType<typeof ready>>();
    native.getThumbnail.mockImplementation((uri: string) => uri.includes('/old/') ? old.promise : fresh.promise);
    const hook = await mount([item('A', 'file:///old/A.jpg')]);
    const errorCallback = hook.value.onThumbnailError;
    await hook.replace([item('A', 'file:///new/A.jpg')]);
    await act(async () => { fresh.resolve(ready('file:///cache/new.jpg')); await flush(); });
    expect(hook.value.thumbnails.get('A')?.uri).toBe('file:///cache/new.jpg');
    await act(async () => { old.resolve(ready('file:///cache/stale-old.jpg')); await flush(); });
    expect(hook.value.thumbnails.get('A')?.uri).toBe('file:///cache/new.jpg');
    expect(hook.value.onThumbnailError).toBe(errorCallback);
  });

  it('bounds pending work and stops starting queued thumbnails after unmount', async () => {
    const pending = deferred<ReturnType<typeof ready>>();
    native.getThumbnail.mockReturnValue(pending.promise);
    const hook = await mount(Array.from({ length: 8 }, (_, index) => item(`file-${index}`)));
    expect(native.getThumbnail).toHaveBeenCalledTimes(2);
    await hook.unmount();
    await act(async () => { pending.resolve(ready('file:///cache/unused.jpg')); await flush(); });
    expect(native.getThumbnail).toHaveBeenCalledTimes(2);
  });
});
