import type { ExtractedMediaFile, MediaType, MediaTypeSelection } from '../types/media';

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
  const senderSet = new Set(selectedSenders.filter(Boolean));
  const fileSet = selectedFileIds ? new Set(selectedFileIds) : undefined;
  return files.filter((file) => {
    const sender = file.matchedRecord?.sender;
    const canSaveToGallery = file.mediaType === 'photo' || file.mediaType === 'video';
    return Boolean(
      sender &&
        senderSet.has(sender) &&
        selectedMediaTypes[file.mediaType] &&
        canSaveToGallery &&
        (!fileSet || fileSet.has(file.id))
    );
  }).length;
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
