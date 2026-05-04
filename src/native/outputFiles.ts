import type { MediaType, SaveFileResult } from '../types/media';
import { getTimeFixerNativeModule } from './timeFixerNativeModule';

export type ShareableOutputFile = {
  uri?: string | null;
  path?: string | null;
  mimeType?: string | null;
  mediaType?: MediaType | null;
  filename?: string | null;
};

export function outputFileToShareTarget(result: SaveFileResult): ShareableOutputFile {
  return {
    uri: result.scannedUri ?? result.insertedUri ?? (result.outputPath?.startsWith('content://') ? result.outputPath : null),
    path: result.outputPath?.startsWith('content://') ? null : result.outputPath,
    mimeType: mimeTypeForResult(result),
    mediaType: result.mediaType,
    filename: result.displayName ?? result.filename
  };
}

export async function shareOutputFiles(results: SaveFileResult[], categories: MediaType[]) {
  const selected = new Set(categories);
  const files = results
    .filter((result) => result.ok && result.mediaType && selected.has(result.mediaType))
    .map(outputFileToShareTarget);
  return getTimeFixerNativeModule().shareOutputFilesAsync(files);
}

export async function deleteOutputFiles(results: SaveFileResult[]) {
  return getTimeFixerNativeModule().deleteOutputFilesAsync(
    results
      .filter((result) => result.outputPath || result.scannedUri || result.insertedUri)
      .map((result) => ({
        uri: result.scannedUri ?? result.insertedUri ?? (result.outputPath?.startsWith('content://') ? result.outputPath : null),
        path: result.outputPath?.startsWith('content://') ? null : result.outputPath
      }))
  );
}

function mimeTypeForResult(result: SaveFileResult): string {
  if (result.mediaType === 'photo') return 'image/*';
  if (result.mediaType === 'video') return 'video/*';
  if (result.mediaType === 'sticker' || result.mediaType === 'gif') return 'image/*';
  if (result.mediaType === 'voice' || result.mediaType === 'audio') return 'audio/*';
  if (result.mediaType === 'document') return 'application/octet-stream';
  return '*/*';
}

