import {
  getChatStampNativeModule,
  type NativeSaveMediaItem,
  type ScopedSaveOptions,
  type NativeSaveMediaResult
} from './chatStampNativeModule';

export function saveMediaNative(items: NativeSaveMediaItem[], options: ScopedSaveOptions): Promise<NativeSaveMediaResult> {
  return getChatStampNativeModule().saveMediaAsync(items, options);
}
