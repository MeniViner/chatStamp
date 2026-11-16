import type { PickedFolderResult } from '../types/media';
import { getChatStampNativeModule } from './chatStampNativeModule';

export function openOutputFolderPicker(): Promise<PickedFolderResult | null> {
  return getChatStampNativeModule().openOutputFolderPickerAsync();
}
