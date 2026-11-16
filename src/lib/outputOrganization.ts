import type { ExtractedMediaFile, MediaType, OutputOrganizationSettings } from '../types/media';

export const DEFAULT_GALLERY_ROOT = '/storage/emulated/0/Pictures/chatStamp';

export const defaultOutputOrganization: OutputOrganizationSettings = {
  mode: 'all-in-one',
  createExportTimestampFolder: false,
  duplicateHandling: 'skip-existing'
};

export function outputChatName(zipName?: string): string {
  return sanitizePathSegment(zipName?.replace(/\.zip$/i, '') ?? 'Imported Chat');
}

export function sanitizePathSegment(value: string): string {
  const safe = value
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '');
  return safe.length > 0 ? safe : 'Imported Chat';
}

export function folderNameForMediaType(mediaType: MediaType, organization: OutputOrganizationSettings = defaultOutputOrganization): string {
  if (organization.mode === 'all-in-one' || organization.mode === 'by-sender') return '';
  if (mediaType === 'photo' || mediaType === 'video') return 'Media';
  if (mediaType === 'voice' || mediaType === 'audio') return 'Voice notes';
  if (mediaType === 'sticker' || mediaType === 'gif') return 'Stickers';
  if (mediaType === 'document') return 'Documents';
  return 'Other';
}

export function relativeOutputFolderForFile(file: Pick<ExtractedMediaFile, 'mediaType' | 'matchedRecord'>, organization: OutputOrganizationSettings): string {
  const typeFolder = folderNameForMediaType(file.mediaType, organization);
  const parts = typeFolder ? [typeFolder] : [];
  if (organization.mode === 'by-sender' || organization.mode === 'by-sender-and-type') {
    parts.unshift(sanitizePathSegment(file.matchedRecord?.sender ?? 'Unknown sender'));
  }
  return parts.join('/');
}
