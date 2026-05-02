import type { MediaType } from '../types/media';
import { getTimeFixerNativeModule, type NativeDateWriteResult } from './timeFixerNativeModule';

export type SetAndroidMediaStoreDatesParams = {
  assetId: string;
  localUri: string;
  mediaType: MediaType;
  takenAtMillis: number;
  displayName?: string;
};

export async function setAndroidMediaStoreDates(
  params: SetAndroidMediaStoreDatesParams
): Promise<NativeDateWriteResult> {
  return getTimeFixerNativeModule().setMediaStoreDatesAsync(
    params.assetId,
    params.localUri,
    params.mediaType,
    params.takenAtMillis,
    params.displayName ?? null
  );
}
