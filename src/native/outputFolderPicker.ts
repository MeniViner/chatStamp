import type { PickedFolderResult, PickedFolderTimestampSupportResult } from '../types/media';
import { getTimeFixerNativeModule } from './timeFixerNativeModule';

export async function openOutputFolderPicker(): Promise<PickedFolderResult> {
  return getTimeFixerNativeModule().openOutputFolderPickerAsync();
}

export async function testPickedFolderTimestampSupport(treeUri: string): Promise<PickedFolderTimestampSupportResult> {
  return getTimeFixerNativeModule().testPickedFolderTimestampSupportAsync(treeUri);
}

