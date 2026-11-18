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

export function getSelectedSaveCandidates(
  files: ExtractedMediaFile[],
  selectedSenders: string[],
  selectedMediaTypes: MediaTypeSelection,
  selectedFileIds?: ReadonlySet<string> | readonly string[]
): { file: ExtractedMediaFile; timestampMillis?: number }[] {
  const senderSet = new Set(selectedSenders);
  const fileSet = selectedFileIds ? new Set(selectedFileIds) : undefined;
  const selected: { file: ExtractedMediaFile; timestampMillis?: number }[] = [];
  for (const file of files) {
    if (!senderSet.has(getMediaSender(file)) || !selectedMediaTypes[file.mediaType] || !isSaveableMediaType(file.mediaType)) continue;
    if (fileSet && !fileSet.has(file.id)) continue;
    selected.push({ file, timestampMillis: getMediaSaveTime(file) });
  }
  if (selectedFileIds) {
    const order = new Map(Array.from(selectedFileIds, (id, index) => [id, index]));
    selected.sort((a, b) => (order.get(a.file.id) ?? 0) - (order.get(b.file.id) ?? 0));
  }
  return selected;
}
