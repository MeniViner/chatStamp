import type { AppSettings, CompletionSummary, ExtractedMediaFile, MediaTypeSelection, ProcessingProgress, SaveFileResult } from '../types/media';
import { getMimeTypeForMedia } from '../lib/mediaClassifier';
import { getSelectedSaveCandidates } from '../store/selectionLogic';
import { defaultOutputOrganization, outputChatName, relativeOutputFolderForFile } from '../lib/outputOrganization';
import { clearWorkingDirectory } from './importService';
import { buildSaveSummary } from './saveSummary';
import { saveMediaNative } from '../native/nativeMediaSaver';

export type RunSavePipelineParams = {
  files: ExtractedMediaFile[];
  selectedSenders: string[];
  selectedMediaTypes: MediaTypeSelection;
  selectedFileIds: string[];
  archiveUri: string;
  workingDirectory?: string;
  chatName?: string;
  settings?: AppSettings;
  onProgress?: (progress: ProcessingProgress) => void;
};

export async function runSavePipeline({
  files, selectedSenders, selectedMediaTypes, selectedFileIds,
  archiveUri, workingDirectory, chatName, settings, onProgress
}: RunSavePipelineParams): Promise<CompletionSummary> {
  const selected = getSelectedSaveCandidates(files, selectedSenders, selectedMediaTypes, selectedFileIds);
  const organization = settings?.outputOrganization ?? defaultOutputOrganization;
  const treeUri = settings?.saveDestinationMode === 'custom-folder' ? settings.customFolder?.treeUri : undefined;
  if (settings?.saveDestinationMode === 'custom-folder' && !treeUri) {
    throw new Error('Selected folder access expired. Choose it again in Settings.');
  }

  onProgress?.({ stageLabel: 'Saving selected files', processed: 0, total: selected.length, failed: 0 });
  const nativeResult = await saveMediaNative(selected.map(({ file, timestampMillis }) => ({
    entryId: file.id,
    sourceUri: file.uri,
    filename: file.filename,
    mediaType: file.mediaType,
    mimeType: getMimeTypeForMedia(file.filename, file.mediaType),
    timestampMillis,
    dateSource: file.dateSource ?? (file.matchedRecord ? 'chat' : 'none'),
    timeZone: file.timeZone,
    relativeFolder: relativeOutputFolderForFile(file, organization)
  })), {
    archiveUri,
    chatName: outputChatName(chatName),
    treeUri,
    duplicateHandling: organization.duplicateHandling,
    timestampFolder: organization.createExportTimestampFolder,
    organizationMode: organization.mode,
    alwaysUseMessageDate: settings?.alwaysUseMessageDate ?? false
  });

  const sources = new Map(selected.map((candidate) => [candidate.file.id, candidate]));
  const results = nativeResult.results.map<SaveFileResult>((result) => {
    const candidate = sources.get(result.entryId);
    const chatDate = candidate?.file.matchedRecord?.messageDateIso ?? null;
    const target = result.timestampSource === 'capture'
      ? Date.parse(chatDate ?? '')
      : candidate?.timestampMillis;
    const dateCorrectionVerified = result.ok && result.dateVerification === 'verified' && chatDate !== null
      && candidate?.file.dateAmbiguous !== true
      && typeof target === 'number' && typeof result.targetTimestampMillis === 'number'
      && Math.abs(result.targetTimestampMillis - target) <= 2000;
    return {
      ...result,
      originalTimestampMillis: candidate?.timestampMillis,
      whatsAppDateIso: chatDate,
      dateCorrectionVerified,
      galleryMaySortByImportTime: result.ok && isVisual(result) && result.dateVerification !== 'verified'
    };
  });

  const saved = results.filter((result) => result.outcome === 'saved');
  const failed = results.filter((result) => result.outcome === 'failed').length;
  const cancelled = results.filter((result) => result.outcome === 'cancelled').length;
  const skippedExisting = results.filter((result) => result.outcome === 'skipped').length;
  onProgress?.({ stageLabel: 'Done', processed: selected.length, total: selected.length, failed });

  const cacheCleared = failed === 0 && cancelled === 0 && await clearWorkingDirectory(workingDirectory);
  const firstOutput = results.find((result) => result.ok && isVisual(result)) ?? results.find((result) => result.ok);
  return buildSaveSummary({
    totalFiles: files.length,
    selectedFiles: selected.length,
    saved: saved.length,
    failed,
    skippedExisting,
    cancelled,
    filesystemTimestampFixed: saved.filter((result) => result.filesystemTimestampFixed).length,
    exifFixed: saved.filter((result) => result.exifWritten).length,
    mp4MetadataFixed: saved.filter((result) => result.mp4MetadataFixed).length,
    dateCorrected: saved.filter((result) => result.dateCorrectionVerified).length,
    dateCorrectionFailed: saved.filter((result) => result.dateVerification === 'unverified').length,
    mayShowImportTime: saved.filter((result) => result.galleryMaySortByImportTime).length,
    cacheCleared,
    saveMethod: nativeResult.mode,
    outputDirectory: firstOutput?.outputDirectory,
    results
  });
}

function isVisual(result: Pick<SaveFileResult, 'mediaType'>): boolean {
  return result.mediaType === 'photo' || result.mediaType === 'video'
    || result.mediaType === 'sticker' || result.mediaType === 'gif';
}
