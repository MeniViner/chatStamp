import {
  getTimeFixerNativeModule,
  type NativeMp4DebugResult,
  type NativeSaveMediaItem,
  type NativeSaveMediaResult
} from './timeFixerNativeModule';

export async function saveMediaWithOriginalDatesNative(
  items: NativeSaveMediaItem[],
  options?: { albumName?: string; keepFailedDebugFiles?: boolean }
): Promise<NativeSaveMediaResult> {
  return getTimeFixerNativeModule().saveMediaWithOriginalDatesAsync(items, options ?? null);
}

export async function runMp4RewriteDiagnosticsNative(
  sourceUri: string,
  targetTimestampMillis: number
): Promise<NativeMp4DebugResult> {
  return getTimeFixerNativeModule().debugRewriteMp4DateAsync(sourceUri, targetTimestampMillis);
}
