import type { MediaType, SaveFileResult } from '../types/media';
import { getMimeTypeForMedia } from '../lib/mediaClassifier';
import { getChatStampNativeModule } from './chatStampNativeModule';
import { MAX_SHARE_FILES, selectShareableOutputFiles, ShareLimitError } from '../lib/outputSharing';

type ShareableOutputFile = {
  uri?: string | null;
  path?: string | null;
  mimeType?: string | null;
  mediaType?: MediaType | null;
  filename?: string | null;
};

function outputFileToShareTarget(result: SaveFileResult): ShareableOutputFile {
  return {
    uri: result.insertedUri ?? result.scannedUri ?? (result.outputPath?.startsWith('content://') ? result.outputPath : null),
    path: result.outputPath?.startsWith('content://') ? null : result.outputPath,
    mimeType: mimeTypeForResult(result),
    mediaType: result.mediaType,
    filename: result.displayName ?? result.filename
  };
}

export async function shareOutputFiles(results: readonly SaveFileResult[], categories: readonly MediaType[]) {
  const selected = selectShareableOutputFiles(results, categories);
  if (selected.length > MAX_SHARE_FILES) throw new ShareLimitError(selected.length);
  const files = selected.map(outputFileToShareTarget);
  return getChatStampNativeModule().shareOutputFilesAsync(files);
}

export async function deleteOutputFiles(results: SaveFileResult[]) {
  return getChatStampNativeModule().deleteOutputFilesAsync(
    results
      .filter((result) => result.outputPath || result.scannedUri || result.insertedUri)
      .map((result) => ({
        uri: result.insertedUri ?? result.scannedUri ?? (result.outputPath?.startsWith('content://') ? result.outputPath : null),
        path: result.outputPath?.startsWith('content://') ? null : result.outputPath
      }))
  );
}

function mimeTypeForResult(result: SaveFileResult): string {
  if (result.mimeType) return result.mimeType;
  if (result.mediaType === 'photo') return 'image/*';
  if (result.mediaType === 'video') return 'video/*';
  if (result.mediaType === 'sticker' || result.mediaType === 'gif') return 'image/*';
  if (result.mediaType === 'voice' || result.mediaType === 'audio') return 'audio/*';
  if (result.mediaType === 'document') return getMimeTypeForMedia(result.filename, 'document');
  return '*/*';
}
