import type { AppSettings, CompletionSummary, ExtractedMediaFile, MediaTypeSelection, ProcessingProgress, SaveFileResult } from '../types/media';
import { getMimeTypeForMedia } from '../lib/mediaClassifier';
import { getSelectedSaveCandidates } from '../store/selectionLogic';
import { defaultOutputOrganization, outputChatName, relativeOutputFolderForFile } from '../lib/outputOrganization';
import { clearWorkingDirectory } from './importService';
import { buildSaveSummary } from './saveSummary';
import { saveMediaNative } from '../native/nativeMediaSaver';
import { createOperationId } from '../lib/operationProgress';
import type { NativeSaveMediaResult } from '../native/chatStampNativeModule';
import { PipelineError } from '../lib/pipelineErrors';

export type RunSavePipelineParams = {
  files: ExtractedMediaFile[];
  selectedSenders: string[];
  selectedMediaTypes: MediaTypeSelection;
  selectedFileIds: string[];
  archiveFingerprint: string;
  sourceUri?: string;
  operationId?: string;
  notificationTitle?: string;
  notificationCancelLabel?: string;
  workingDirectory?: string;
  chatName?: string;
  settings?: AppSettings;
  onProgress?: (progress: ProcessingProgress) => void;
};

export async function runSavePipeline({
  files, selectedSenders, selectedMediaTypes, selectedFileIds,
  archiveFingerprint, sourceUri, operationId = createOperationId('save'), workingDirectory, chatName, settings, onProgress,
  notificationTitle = 'chatStamp', notificationCancelLabel = ''
}: RunSavePipelineParams): Promise<CompletionSummary> {
  const selected = getSelectedSaveCandidates(files, selectedSenders, selectedMediaTypes, selectedFileIds);
  const organization = settings?.outputOrganization ?? defaultOutputOrganization;
  const treeUri = settings?.saveDestinationMode === 'custom-folder' ? settings.customFolder?.treeUri : undefined;
  if (settings?.saveDestinationMode === 'custom-folder' && !treeUri) {
    throw new PipelineError('PERMISSION_LOST');
  }

  const nativeResult = await saveMediaNative(selected.map(({ file, timestampMillis }) => ({
    entryId: file.id,
    sourceUri: file.uri,
    filename: file.filename,
    mediaType: file.mediaType,
    mimeType: getMimeTypeForMedia(file.filename, file.mediaType),
    timestampMillis,
    dateSource: file.dateSource ?? (file.matchedRecord ? 'chat' : 'none'),
    timeZone: file.timeZone,
    whatsAppDateIso: file.matchedRecord?.messageDateIso,
    dateAmbiguous: file.dateAmbiguous ?? false,
    relativeFolder: relativeOutputFolderForFile(file, organization)
  })), {
    archiveFingerprint,
    operationId,
    workingDirectory: workingDirectory ?? '',
    sourceUri,
    notificationTitle,
    notificationCancelLabel,
    chatName: outputChatName(chatName),
    treeUri,
    duplicateHandling: organization.duplicateHandling,
    timestampFolder: organization.createExportTimestampFolder,
    organizationMode: organization.mode,
    alwaysUseMessageDate: settings?.alwaysUseMessageDate ?? false
  }, onProgress);

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
      originalTimestampMillis: candidate?.timestampMillis ?? result.originalTimestampMillis,
      whatsAppDateIso: chatDate,
      dateAmbiguous: candidate?.file.dateAmbiguous ?? result.dateAmbiguous,
      dateCorrectionVerified,
      galleryMaySortByImportTime: result.ok && isVisual(result) && result.dateVerification !== 'verified'
    };
  });

  return summarizeNativeSave({ ...nativeResult, results }, workingDirectory, files.length, selected.length);
}

export async function summarizeNativeSave(
  nativeResult: Pick<NativeSaveMediaResult, 'mode'> & { results: Omit<SaveFileResult, 'dateCorrectionVerified' | 'galleryMaySortByImportTime'>[] },
  workingDirectory?: string, totalFiles = nativeResult.results.length,
  selectedFiles = nativeResult.results.length
): Promise<CompletionSummary> {
  const results = nativeResult.results.map<SaveFileResult>((result) => {
    const chatTime = Date.parse(result.whatsAppDateIso ?? '');
    const target = result.timestampSource === 'capture' ? chatTime : result.originalTimestampMillis;
    const verified = result.ok && result.dateVerification === 'verified' && result.dateAmbiguous !== true
      && Number.isFinite(chatTime) && typeof target === 'number' && Number.isFinite(target)
      && typeof result.targetTimestampMillis === 'number' && Math.abs(result.targetTimestampMillis - target) <= 2000;
    return { ...result, dateCorrectionVerified: verified,
      galleryMaySortByImportTime: result.ok && isVisual(result) && result.dateVerification !== 'verified' };
  });
  const saved = results.filter((result) => result.outcome === 'saved');
  const failed = results.filter((result) => result.outcome === 'failed').length;
  const cancelled = results.filter((result) => result.outcome === 'cancelled').length;
  const skippedExisting = results.filter((result) => result.outcome === 'skipped').length;

  const cacheCleared = failed === 0 && cancelled === 0 && await clearWorkingDirectory(workingDirectory);
  const firstOutput = results.find((result) => result.ok && isVisual(result)) ?? results.find((result) => result.ok);
  return buildSaveSummary({
    totalFiles,
    selectedFiles,
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
