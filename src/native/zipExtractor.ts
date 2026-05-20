import { getChatStampNativeModule, type NativeZipExtractionResult } from './chatStampNativeModule';

export async function extractSupportedZipEntries(
  zipUri: string,
  outputDirectoryUri: string
): Promise<NativeZipExtractionResult> {
  return getChatStampNativeModule().extractSupportedZipEntriesAsync(zipUri, outputDirectoryUri);
}
