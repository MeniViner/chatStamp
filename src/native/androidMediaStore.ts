import type { MediaType } from '../types/media';
import { getChatStampNativeModule, type NativeDateWriteResult } from './chatStampNativeModule';

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
  return getChatStampNativeModule().setMediaStoreDatesAsync(
    params.assetId,
    params.localUri,
    params.mediaType,
    params.takenAtMillis,
    params.displayName ?? null
  );
}
