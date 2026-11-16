import type { ExtractedMediaFile, MediaType, MediaTypeSelection } from '../types/media';
import { getMediaSaveTime, getMediaSender } from '../lib/mediaMetadata';
import { isSaveableMediaType } from '../lib/mediaUi';

export function toggleSenderSelection(selectedSenders: string[], sender: string): string[] {
  if (!sender) return selectedSenders;
  return selectedSenders.includes(sender)
    ? selectedSenders.filter((item) => item !== sender)
    : [...selectedSenders, sender];
}

export function toggleMediaTypeSelection(
  selectedMediaTypes: MediaTypeSelection,
  mediaType: MediaType
): MediaTypeSelection {
  return {
    ...selectedMediaTypes,
    [mediaType]: !selectedMediaTypes[mediaType]
  };
}

export function countSelectedSaveableFiles(
  files: ExtractedMediaFile[],
  selectedSenders: string[],
  selectedMediaTypes: MediaTypeSelection,
  selectedFileIds?: string[]
): number {
  return getSelectedSaveCandidates(files, selectedSenders, selectedMediaTypes, selectedFileIds).length;
}

export function getSelectedSaveCandidates(
  files: ExtractedMediaFile[],
  selectedSenders: string[],
  selectedMediaTypes: MediaTypeSelection,
  selectedFileIds?: string[]
): { file: ExtractedMediaFile; timestampMillis?: number }[] {
  const senderSet = new Set(selectedSenders);
  const fileSet = selectedFileIds ? new Set(selectedFileIds) : undefined;
  const selected: { file: ExtractedMediaFile; timestampMillis?: number }[] = [];
  for (const file of files) {
    if (!senderSet.has(getMediaSender(file)) || !selectedMediaTypes[file.mediaType] || !isSaveableMediaType(file.mediaType)) continue;
    if (fileSet && !fileSet.has(file.id)) continue;
    selected.push({ file, timestampMillis: getMediaSaveTime(file) });
  }
  return selected;
}

export function toggleFileSelection(selectedFileIds: string[], fileId: string): string[] {
  if (!fileId) return selectedFileIds;
  return selectedFileIds.includes(fileId)
    ? selectedFileIds.filter((id) => id !== fileId)
    : [...selectedFileIds, fileId];
}

export function selectAllVisibleFiles(selectedFileIds: string[], visibleFileIds: string[]): string[] {
  return Array.from(new Set([...selectedFileIds, ...visibleFileIds]));
}

export function clearVisibleFiles(selectedFileIds: string[], visibleFileIds: string[]): string[] {
  const visibleSet = new Set(visibleFileIds);
  return selectedFileIds.filter((id) => !visibleSet.has(id));
}
