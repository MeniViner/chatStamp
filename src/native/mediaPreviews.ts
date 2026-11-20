import { Platform } from 'react-native';
import { getChatStampNativeModule } from './chatStampNativeModule';
import type { ExternalOpenFile, ExternalOpenResult, ThumbnailResult } from './chatStampNativeModule';

export type { ExternalOpenFile, ExternalOpenResult, ThumbnailResult } from './chatStampNativeModule';

type ThumbnailWork = {
  key: string;
  uri: string;
  sizePx: number;
  promise: Promise<ThumbnailResult>;
  resolve: (result: ThumbnailResult) => void;
};

const maximumActive = 2;
const maximumPending = 64;
const inFlight = new Map<string, ThumbnailWork>();
const pending: ThumbnailWork[] = [];
let active = 0;

/** Coalesce visible-cell work without retaining stale successful descriptors in JS. */
export function getThumbnail(uri: string, sizePx = 256): Promise<ThumbnailResult> {
  if (!Number.isFinite(sizePx) || !Number.isInteger(sizePx) || sizePx <= 0) {
    return Promise.reject(new RangeError('Thumbnail size must be a positive integer.'));
  }
  if (Platform.OS !== 'android') return Promise.resolve({ available: false, reason: 'unsupported' });
  if (!uri) return Promise.resolve({ available: false, reason: 'unreadable' });
  const normalized = Math.max(64, Math.min(512, sizePx));
  const key = `${uri.length}:${uri}:${normalized}`;
  const existing = inFlight.get(key);
  if (existing) return existing.promise;
  if (inFlight.size >= maximumActive + maximumPending) return Promise.resolve({ available: false, reason: 'busy' });
  let resolve: (result: ThumbnailResult) => void = () => undefined;
  const promise = new Promise<ThumbnailResult>((finish) => { resolve = finish; });
  const work: ThumbnailWork = { key, uri, sizePx: normalized, promise, resolve };
  inFlight.set(key, work);
  pending.push(work);
  pumpThumbnails();
  return promise;
}

function pumpThumbnails(): void {
  while (active < maximumActive && pending.length > 0) {
    const work = pending.shift();
    if (!work) return;
    active++;
    void Promise.resolve()
      .then(() => getChatStampNativeModule().getThumbnailAsync(work.uri, work.sizePx))
      .catch((): ThumbnailResult => ({ available: false, reason: 'decode-failed' }))
      .then((result) => {
        active--;
        if (inFlight.get(work.key) === work) inFlight.delete(work.key);
        work.resolve(result);
        pumpThumbnails();
      });
  }
}

export async function openFileInOtherApp(file: ExternalOpenFile): Promise<ExternalOpenResult> {
  if (Platform.OS !== 'android') return { opened: false, reason: 'no-handler' };
  try { return await getChatStampNativeModule().openFileInOtherAppAsync(file); }
  catch { return { opened: false, reason: 'launch-failed' }; }
}

export async function invalidateThumbnail(uri: string): Promise<void> {
  if (Platform.OS === 'android') await getChatStampNativeModule().invalidateThumbnailAsync(uri);
}

/** Call after the prior viewer's shared-object cleanup, before mounting its successor. */
export async function awaitMediaRelease(): Promise<void> {
  if (Platform.OS === 'android') await getChatStampNativeModule().awaitMediaReleaseAsync();
}
