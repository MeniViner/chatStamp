import type { SaveFileResult } from '../types/media';

export function shouldShowOpenGallery(results?: SaveFileResult[]): boolean {
  return Boolean(findGalleryItem(results));
}

export function findGalleryItem(results?: SaveFileResult[]): SaveFileResult | undefined {
  return results?.find((result) => result.ok && (result.insertedUri ?? result.scannedUri)
    && (result.mediaType === 'photo' || result.mediaType === 'video' || result.mediaType === 'sticker' || result.mediaType === 'gif'));
}

export function shouldShowOpenFolder(): boolean {
  return true;
}

export function getFolderFallbackCapabilities(results?: SaveFileResult[]) {
  return {
    canRetryOpenFolder: true,
    canOpenFirstSavedItem: shouldShowOpenGallery(results),
    canCopyPath: true
  };
}
