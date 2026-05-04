import { getTimeFixerNativeModule } from './timeFixerNativeModule';

export async function hasAllFilesAccess(): Promise<boolean> {
  return getTimeFixerNativeModule().isExternalStorageManagerAsync();
}

export async function openAllFilesAccessSettings(): Promise<Record<string, unknown>> {
  return getTimeFixerNativeModule().openAllFilesAccessSettingsAsync();
}
