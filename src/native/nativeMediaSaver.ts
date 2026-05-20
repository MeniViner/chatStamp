import {
  getChatStampNativeModule,
  type NativeMp4DebugResult,
  type NativeSaveMediaItem,
  type NativeSaveMediaResult,
  type SafCustomFolderSaveOptions,
  type TermuxParitySaveOptions
} from './chatStampNativeModule';

export async function saveMediaWithOriginalDatesNative(
  items: NativeSaveMediaItem[],
  options?: { albumName?: string; keepFailedDebugFiles?: boolean }
): Promise<NativeSaveMediaResult> {
  return getChatStampNativeModule().saveMediaWithOriginalDatesAsync(items, options ?? null);
}

export async function saveMediaTermuxParityNative(
  items: NativeSaveMediaItem[],
  options?: TermuxParitySaveOptions
): Promise<NativeSaveMediaResult> {
  return getChatStampNativeModule().saveMediaTermuxParityAsync(items, options ?? null);
}

export async function saveMediaToSafFolderNative(
  items: NativeSaveMediaItem[],
  options: SafCustomFolderSaveOptions
): Promise<NativeSaveMediaResult> {
  return getChatStampNativeModule().saveMediaToSafFolderAsync(items, options);
}

export async function runMp4RewriteDiagnosticsNative(
  sourceUri: string,
  targetTimestampMillis: number
): Promise<NativeMp4DebugResult> {
  return getChatStampNativeModule().debugRewriteMp4DateAsync(sourceUri, targetTimestampMillis);
}
