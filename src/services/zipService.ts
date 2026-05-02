import { extractSupportedZipEntries } from '../native/zipExtractor';
import type { NativeZipExtractionResult } from '../native/timeFixerNativeModule';

export type ZipExtractionResult = NativeZipExtractionResult;

export async function extractZipToDirectory(zipUri: string, targetDirectory: string): Promise<ZipExtractionResult> {
  return extractSupportedZipEntries(zipUri, targetDirectory);
}
