import { getChatStampNativeModule } from './chatStampNativeModule';

export async function hasAllFilesAccess(): Promise<boolean> {
  return getChatStampNativeModule().isExternalStorageManagerAsync();
}

export async function openAllFilesAccessSettings(): Promise<Record<string, unknown>> {
  return getChatStampNativeModule().openAllFilesAccessSettingsAsync();
}
