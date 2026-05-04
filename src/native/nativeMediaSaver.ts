import {
  getTimeFixerNativeModule,
  type NativeMp4DebugResult,
  type NativeSaveMediaItem,
  type NativeSaveMediaResult,
  type SafCustomFolderSaveOptions,
  type TermuxParitySaveOptions
} from './timeFixerNativeModule';

export async function saveMediaWithOriginalDatesNative(
  items: NativeSaveMediaItem[],
  options?: { albumName?: string; keepFailedDebugFiles?: boolean }
): Promise<NativeSaveMediaResult> {
  return getTimeFixerNativeModule().saveMediaWithOriginalDatesAsync(items, options ?? null);
}

export async function saveMediaTermuxParityNative(
  items: NativeSaveMediaItem[],
  options?: TermuxParitySaveOptions
): Promise<NativeSaveMediaResult> {
  return getTimeFixerNativeModule().saveMediaTermuxParityAsync(items, options ?? null);
}

export async function saveMediaToSafFolderNative(
  items: NativeSaveMediaItem[],
  options: SafCustomFolderSaveOptions
): Promise<NativeSaveMediaResult> {
  return getTimeFixerNativeModule().saveMediaToSafFolderAsync(items, options);
}

export async function runMp4RewriteDiagnosticsNative(
  sourceUri: string,
  targetTimestampMillis: number
): Promise<NativeMp4DebugResult> {
  return getTimeFixerNativeModule().debugRewriteMp4DateAsync(sourceUri, targetTimestampMillis);
}
