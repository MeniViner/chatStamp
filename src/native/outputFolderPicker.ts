import type { PickedFolderResult, PickedFolderTimestampSupportResult } from '../types/media';
import { getChatStampNativeModule } from './chatStampNativeModule';

export async function openOutputFolderPicker(): Promise<PickedFolderResult> {
  return getChatStampNativeModule().openOutputFolderPickerAsync();
}

export async function testPickedFolderTimestampSupport(treeUri: string): Promise<PickedFolderTimestampSupportResult> {
  return getChatStampNativeModule().testPickedFolderTimestampSupportAsync(treeUri);
}

