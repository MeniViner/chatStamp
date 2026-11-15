import type { ExtractedMediaFile, MediaType, MediaTypeSelection } from '../types/media';
import { getDateCorrectionCapability } from '../lib/mediaClassifier';
import { getMediaDateIso, getMediaSender, UNKNOWN_SENDER } from '../lib/mediaMetadata';
import { getSelectedSaveCandidates } from './selectionLogic';

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
  const matchedFiles = files.filter((file) => file.matchedRecord).length;
  const selectedFiles: SelectedFilePreview[] = getSelectedSaveCandidates(files, selectedSenders, selectedMediaTypes, selectedFileIds)
    .map(({ file, timestampMillis }) => ({
      id: file.id,
      filename: file.filename,
      sender: getMediaSender(file) === UNKNOWN_SENDER ? 'Unknown sender' : getMediaSender(file),
      mediaType: file.mediaType,
      originalDateIso: getMediaDateIso(file) ?? new Date(timestampMillis).toISOString(),
      dateCorrectionCapability: getDateCorrectionCapability(file.mediaType, file.filename)
    }));

  return {
    matchedFiles,
    selectedFiles,
    selectedPhotos: selectedFiles.filter((file) => file.mediaType === 'photo').length,
    selectedVideos: selectedFiles.filter((file) => file.mediaType === 'video').length,
    selectedOther: selectedFiles.filter((file) => file.mediaType !== 'photo' && file.mediaType !== 'video').length
  };
}
