import type { SaveFileResult } from '../types/media';

export function shouldShowOpenGallery(results?: SaveFileResult[]): boolean {
  return Boolean(results?.some((result) => result.ok && result.scannedUri && (result.mediaType === 'photo' || result.mediaType === 'video' || result.mediaType === 'sticker')));
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
