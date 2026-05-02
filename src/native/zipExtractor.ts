import { getTimeFixerNativeModule, type NativeZipExtractionResult } from './timeFixerNativeModule';

export async function extractSupportedZipEntries(
  zipUri: string,
  outputDirectoryUri: string
): Promise<NativeZipExtractionResult> {
  return getTimeFixerNativeModule().extractSupportedZipEntriesAsync(zipUri, outputDirectoryUri);
}
