import type { ExtractedMediaFile, MediaType, SaveFileResult } from '../types/media';

export const saveableMediaTypes: MediaType[] = ['photo', 'video', 'voice', 'sticker', 'document', 'unknown'];
export const visibleMediaTypes: MediaType[] = ['photo', 'video', 'voice', 'sticker', 'document', 'unknown'];

export function isSaveableMediaType(mediaType: MediaType): boolean {
  return saveableMediaTypes.includes(mediaType);
}

export function getMediaTypeLabel(mediaType: MediaType): string {
  const labels: Record<MediaType, string> = {
    photo: 'Photos',
    video: 'Videos',
    voice: 'Voice notes',
    audio: 'Audio',
    sticker: 'Stickers',
    gif: 'GIFs',
    document: 'Documents',
    unknown: 'Unknown'
  };
  return labels[mediaType];
}

export function getSingularMediaTypeLabel(mediaType?: MediaType): string {
  const labels: Record<MediaType, string> = {
    photo: 'Photo',
    video: 'Video',
    voice: 'Voice note',
    audio: 'Audio',
    sticker: 'Sticker',
    gif: 'GIF',
    document: 'Document',
    unknown: 'File'
  };
  return mediaType ? labels[mediaType] : 'File';
}

export function getDateFixCapabilityLabel(file: Pick<ExtractedMediaFile, 'mediaType'>): string {
  if (file.mediaType === 'photo' || file.mediaType === 'video') return 'Gallery date verified';
  return 'Saved to folder with file date';
}

export function getResultStatusLabel(result: SaveFileResult): string {
  if (!result.ok) return `Failed${result.failureReason ? `: ${result.failureReason}` : ''}`;
  if (result.filesystemTimestampFixed && result.mediaScannerCompleted && !result.galleryMaySortByImportTime) {
    return 'Date fixed';
  }
  if (result.filesystemTimestampFixed) return 'Saved, scan pending';
  if (result.galleryMaySortByImportTime) return 'Saved, may show import time';
  return 'Saved';
}

export function getSavedHeadline(completion?: { saved: number; dateCorrected: number; failed: number }): string {
  if (!completion) return 'Results';
  if (completion.saved > 0 && completion.dateCorrected === completion.saved && completion.failed === 0) {
    return 'Done - media saved with original WhatsApp dates.';
  }
  if (completion.saved > 0) return 'Saved with some items needing attention.';
  return 'No media was saved.';
}

export function shortenPath(path?: string | null, maxLength = 48): string {
  if (!path) return 'Not copied';
  if (path.length <= maxLength) return path;
  const tail = path.slice(Math.max(0, path.length - maxLength + 3));
  return `...${tail}`;
}
