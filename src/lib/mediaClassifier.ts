import type { MediaType } from '../types/media';
import { getExtension } from './filename';

const PHOTO_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'heic']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', '3gp']);
const AUDIO_EXTENSIONS = new Set(['ogg', 'm4a', 'mp3', 'aac']);
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'vcf', 'txt', 'xls', 'xlsx', 'ppt', 'pptx', 'zip']);

export function classifyMedia(filename: string): MediaType {
  const extension = getExtension(filename);
  if (extension === 'opus') return 'voice';
  if (extension === 'webp') return 'sticker';
  if (PHOTO_EXTENSIONS.has(extension)) return 'photo';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (extension === 'gif') return 'gif';
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio';
  if (DOCUMENT_EXTENSIONS.has(extension)) return 'document';

  return 'unknown';
}

export function isSupportedForMvp(filename: string): boolean {
  const mediaType = classifyMedia(filename);
  return mediaType !== 'unknown';
}

export function getMimeTypeForMedia(filename: string, mediaType = classifyMedia(filename)): string {
  const extension = getExtension(filename);

  if (mediaType === 'photo') {
    if (extension === 'png') return 'image/png';
    if (extension === 'heic') return 'image/heic';
    return 'image/jpeg';
  }
  if (mediaType === 'video') {
    if (extension === '3gp') return 'video/3gpp';
    if (extension === 'mov') return 'video/quicktime';
    return 'video/mp4';
  }
  if (mediaType === 'sticker') return 'image/webp';
  if (mediaType === 'gif') return 'image/gif';
  if (mediaType === 'voice' || mediaType === 'audio') {
    if (extension === 'opus') return 'audio/ogg';
    if (extension === 'm4a') return 'audio/mp4';
    if (extension === 'aac') return 'audio/aac';
    return 'audio/mpeg';
  }
  if (mediaType === 'document' && extension === 'txt') return 'text/plain';
  return 'application/octet-stream';
}

export function getDateCorrectionCapability(mediaType: MediaType, filename: string): string {
  const extension = getExtension(filename);
  if (mediaType === 'photo' && (extension === 'jpg' || extension === 'jpeg')) return 'Photo date fix supported';
  if (mediaType === 'photo') return 'Photo date fix limited';
  if (mediaType === 'video') return 'Video date fix supported only when MP4 metadata verification passes';
  if (mediaType === 'sticker') return 'Sticker not saved by default';
  if (mediaType === 'voice') return 'Voice not saved by default';
  if (mediaType === 'audio') return 'Audio not saved by default';
  return 'Not saved by default';
}
