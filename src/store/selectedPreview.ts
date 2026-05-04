import type { ExtractedMediaFile, MediaType, MediaTypeSelection } from '../types/media';
import { getDateCorrectionCapability } from '../lib/mediaClassifier';

export type SelectedFilePreview = {
  id: string;
  filename: string;
  sender: string;
  mediaType: MediaType;
  originalDateIso: string;
  dateCorrectionCapability: string;
};

export type SelectedPreviewSummary = {
  matchedFiles: number;
  selectedFiles: SelectedFilePreview[];
  selectedPhotos: number;
  selectedVideos: number;
  selectedOther: number;
};

export function buildSelectedPreview(
  files: ExtractedMediaFile[],
  selectedSenders: string[],
  selectedMediaTypes: MediaTypeSelection,
  selectedFileIds?: string[]
): SelectedPreviewSummary {
  const senderSet = new Set(selectedSenders.filter(Boolean));
  const fileSet = selectedFileIds ? new Set(selectedFileIds) : undefined;
  const matchedFiles = files.filter((file) => file.matchedRecord).length;
  const selectedFiles: SelectedFilePreview[] = [];

  for (const file of files) {
    const record = file.matchedRecord;
    if (!record || !senderSet.has(record.sender) || !selectedMediaTypes[file.mediaType]) continue;
    if (fileSet && !fileSet.has(file.id)) continue;

    selectedFiles.push({
      id: file.id,
      filename: file.filename,
      sender: record.sender,
      mediaType: file.mediaType,
      originalDateIso: record.messageDateIso,
      dateCorrectionCapability: getDateCorrectionCapability(file.mediaType, file.filename)
    });
  }

  return {
    matchedFiles,
    selectedFiles,
    selectedPhotos: selectedFiles.filter((file) => file.mediaType === 'photo').length,
    selectedVideos: selectedFiles.filter((file) => file.mediaType === 'video').length,
    selectedOther: selectedFiles.filter((file) => file.mediaType !== 'photo' && file.mediaType !== 'video').length
  };
}
