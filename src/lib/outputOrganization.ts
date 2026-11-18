import type { ExtractedMediaFile, MediaType, OutputOrganizationSettings } from '../types/media';

export const DEFAULT_GALLERY_ROOT = '/storage/emulated/0/Pictures/chatStamp';

export type OutputFolderLabels = Readonly<{
  importedChat: string;
  unknownSender: string;
  media: string;
  voice: string;
  stickers: string;
  documents: string;
  other: string;
  export: string;
}>;

export const legacyOutputFolderLabels: OutputFolderLabels = {
  importedChat: 'Imported Chat', unknownSender: 'Unknown sender', media: 'Media', voice: 'Voice notes',
  stickers: 'Stickers', documents: 'Documents', other: 'Other', export: 'Export'
};

export type OutputFolderTranslationKey = `outputFolders.${keyof OutputFolderLabels}`;

export function localizedOutputFolderLabels(translate: (key: OutputFolderTranslationKey) => string): OutputFolderLabels {
  const label = (key: OutputFolderTranslationKey, fallback: string) => {
    const value = translate(key);
    return value === key ? fallback : sanitizePathSegment(value, fallback);
  };
  return {
    importedChat: label('outputFolders.importedChat', legacyOutputFolderLabels.importedChat),
    unknownSender: label('outputFolders.unknownSender', legacyOutputFolderLabels.unknownSender),
    media: label('outputFolders.media', legacyOutputFolderLabels.media),
    voice: label('outputFolders.voice', legacyOutputFolderLabels.voice),
    stickers: label('outputFolders.stickers', legacyOutputFolderLabels.stickers),
    documents: label('outputFolders.documents', legacyOutputFolderLabels.documents),
    other: label('outputFolders.other', legacyOutputFolderLabels.other),
    export: label('outputFolders.export', legacyOutputFolderLabels.export)
  };
}

export const defaultOutputOrganization: OutputOrganizationSettings = {
  mode: 'all-in-one',
  createExportTimestampFolder: false,
  duplicateHandling: 'skip-existing'
};

export function outputChatName(zipName?: string): string {
  return sanitizePathSegment(zipName?.replace(/\.zip$/i, '') ?? legacyOutputFolderLabels.importedChat);
}

export function displayOutputChatName(zipName: string | undefined, labels: OutputFolderLabels = legacyOutputFolderLabels): string {
  return sanitizePathSegment(zipName?.replace(/\.zip$/i, '') ?? '', labels.importedChat);
}

function sanitizePathSegment(value: string, fallback = legacyOutputFolderLabels.importedChat): string {
  const safe = value
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '');
  return safe.length > 0 ? safe : fallback;
}

export function folderNameForMediaType(mediaType: MediaType, organization: OutputOrganizationSettings = defaultOutputOrganization,
  labels: OutputFolderLabels = legacyOutputFolderLabels): string {
  if (organization.mode === 'all-in-one' || organization.mode === 'by-sender') return '';
  if (mediaType === 'photo' || mediaType === 'video') return labels.media;
  if (mediaType === 'voice' || mediaType === 'audio') return labels.voice;
  if (mediaType === 'sticker' || mediaType === 'gif') return labels.stickers;
  if (mediaType === 'document') return labels.documents;
  return labels.other;
}

export function relativeOutputFolderForFile(file: Pick<ExtractedMediaFile, 'mediaType' | 'matchedRecord'>, organization: OutputOrganizationSettings,
  labels: OutputFolderLabels = legacyOutputFolderLabels): string {
  const typeFolder = folderNameForMediaType(file.mediaType, organization, labels);
  const parts = typeFolder ? [typeFolder] : [];
  if (organization.mode === 'by-sender' || organization.mode === 'by-sender-and-type') {
    parts.unshift(sanitizePathSegment(file.matchedRecord?.sender ?? labels.unknownSender, labels.importedChat));
  }
  return parts.join('/');
}
