import type { ExtractedMediaFile, MediaType, OutputOrganizationMode, OutputOrganizationSettings } from '../types/media';

export const TERMUX_PARITY_BASE_FOLDER = '/storage/emulated/0/Pictures/WhatsApp Media TimeFixer';

export const defaultOutputOrganization: OutputOrganizationSettings = {
  mode: 'by-type',
  createExportTimestampFolder: true,
  duplicateHandling: 'keep-both'
};

export function sanitizePathSegment(value: string): string {
  const safe = value
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '');
  return safe.length > 0 ? safe : 'Imported Chat';
}

export function sanitizeOutputFilename(filename: string): string {
  const basename = filename.replace(/\\/g, '/').split('/').pop()?.trim() ?? '';
  const safe = basename.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').trim().replace(/^\.+|\.+$/g, '');
  return safe.length > 0 ? safe : 'whatsapp-media';
}

export function formatExportTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

export function buildTermuxParityOutputPath(
  chatName: string,
  options?: {
    baseFolder?: string;
    exportTimestamp?: string | null;
    organization?: OutputOrganizationSettings;
  }
): string {
  const baseFolder = options?.baseFolder?.trim() || TERMUX_PARITY_BASE_FOLDER;
  const organization = options?.organization ?? defaultOutputOrganization;
  const chatFolder = `${baseFolder}/${sanitizePathSegment(chatName)}`;
  if (!organization.createExportTimestampFolder) return chatFolder;
  return `${chatFolder}/Export ${sanitizePathSegment(options?.exportTimestamp ?? formatExportTimestamp())}`;
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

export function getOutputOrganizationModeLabel(mode: OutputOrganizationMode): string {
  if (mode === 'all-in-one') return 'Everything in one folder';
  if (mode === 'by-type') return 'All people together, file types separated';
  if (mode === 'by-sender') return 'Separate by sender, everything together per sender';
  return 'Separate by sender, and by type inside each sender';
}

export function describeOutputOrganization(organization: OutputOrganizationSettings): string {
  const parts = [getOutputOrganizationModeLabel(organization.mode)];
  parts.push(organization.createExportTimestampFolder ? 'Creates an export timestamp folder' : 'No export timestamp folder');
  if (organization.duplicateHandling === 'skip-existing') {
    parts.push('Skips existing files');
  } else if (organization.duplicateHandling === 'replace-existing') {
    parts.push('Replaces existing files when safe');
  } else {
    parts.push('Keeps both duplicates');
  }
  return parts.join(' • ');
}

export function buildOutputPathPreview(params: {
  chatName: string;
  filename: string;
  mediaType: MediaType;
  sender?: string | null;
  baseFolder?: string;
  exportTimestamp?: string | null;
  organization?: OutputOrganizationSettings;
}): string {
  const root = buildTermuxParityOutputPath(params.chatName, {
    baseFolder: params.baseFolder,
    exportTimestamp: params.exportTimestamp,
    organization: params.organization
  });
  const relativeFolder = relativeOutputFolderForFile(
    {
      mediaType: params.mediaType,
      matchedRecord: params.sender
        ? {
            id: 'preview',
            filename: params.filename,
            normalizedFilename: params.filename,
            sender: params.sender,
            messageDateIso: '',
            rawLine: ''
          }
        : undefined
    },
    params.organization ?? defaultOutputOrganization
  );

  const base = relativeFolder ? `${root}/${relativeFolder}` : root;
  return `${base}/${sanitizeOutputFilename(params.filename)}`;
}

export function buildCollisionFilename(filename: string, existingFilenames: Iterable<string>): string {
  const safe = sanitizeOutputFilename(filename);
  const existing = new Set(Array.from(existingFilenames));
  if (!existing.has(safe)) return safe;

  const dotIndex = safe.lastIndexOf('.');
  const base = dotIndex > 0 ? safe.slice(0, dotIndex) : safe;
  const extension = dotIndex > 0 ? safe.slice(dotIndex) : '';
  let suffix = 1;
  let candidate = `${base}-${suffix}${extension}`;
  while (existing.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}${extension}`;
  }
  return candidate;
}

export function getFallbackModeWarning(mode: 'termux-parity' | 'mediastore-fallback'): string | null {
  if (mode === 'termux-parity') return null;
  return 'MediaStore fallback may show import time because it cannot mimic the Termux copy, touch, scan workflow.';
}
