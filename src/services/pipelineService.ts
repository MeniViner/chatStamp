import type { AppSettings, CompletionSummary, ExtractedMediaFile, MediaTypeSelection, ProcessingProgress, SaveFileResult } from '../types/media';
import { logger } from '../lib/logger';
import { getMimeTypeForMedia } from '../lib/mediaClassifier';
import { getMediaSender, UNKNOWN_SENDER } from '../lib/mediaMetadata';
import { getSelectedSaveCandidates } from '../store/selectionLogic';
import { buildTermuxParityOutputPath, defaultOutputOrganization, formatExportTimestamp, relativeOutputFolderForFile, sanitizePathSegment } from '../lib/termuxParityOutput';
import { clearWorkingDirectory } from './importService';
import { buildSaveSummary } from './saveSummary';
import { saveMediaTermuxParityNative, saveMediaToSafFolderNative } from '../native/nativeMediaSaver';

export type RunSavePipelineParams = {
  files: ExtractedMediaFile[];
  selectedSenders: string[];
  selectedMediaTypes: MediaTypeSelection;
  selectedFileIds: string[];
  workingDirectory?: string;
  chatName?: string;
  settings?: AppSettings;
  onProgress?: (progress: ProcessingProgress) => void;
};

export async function runSavePipeline({
  files,
  selectedSenders,
  selectedMediaTypes,
  selectedFileIds,
  workingDirectory,
  chatName,
  settings,
  onProgress
}: RunSavePipelineParams): Promise<CompletionSummary> {
  logger.debug('Selected senders', selectedSenders);
  logger.debug('Selected media types', selectedMediaTypes);
  const selected = getSelectedSaveCandidates(files, selectedSenders, selectedMediaTypes, selectedFileIds);

  const safeChatName = sanitizePathSegment(chatName ?? 'Imported Chat');
  const exportTimestamp = formatExportTimestamp();
  const accurateOutputFolder = buildTermuxParityOutputPath(safeChatName, {
    baseFolder: settings?.baseFolder,
    exportTimestamp,
    organization: settings?.outputOrganization
  });
  const destinationMode = settings?.saveDestinationMode ?? 'default-accurate-folder';
  const outputFolder = destinationMode === 'custom-folder'
    ? `${settings?.customFolder?.readablePathLabel ?? settings?.customFolder?.displayName ?? 'Selected folder'}/${safeChatName}`
    : accurateOutputFolder;
  logger.info('Save started', {
    selectedCount: selected.length,
    outputFolder
  });
  onProgress?.({ stageLabel: 'Copying files, setting filesystem timestamps, then scanning', processed: 0, total: selected.length, failed: 0 });

  const nativeItems = selected.map(({ file, timestampMillis }) => ({
      sourceUri: file.uri,
      filename: file.filename,
      mediaType: file.mediaType,
      mimeType: getMimeTypeForMedia(file.filename, file.mediaType),
      originalTimestampMillis: timestampMillis,
      sender: getMediaSender(file) === UNKNOWN_SENDER ? 'Unknown sender' : getMediaSender(file),
      albumName: 'chatStamp',
      relativeFolder: relativeOutputFolderForFile(file, settings?.outputOrganization ?? defaultOutputOrganization)
    }));
  const nativeResult = destinationMode === 'custom-folder' && settings?.customFolder?.treeUri
    ? await saveMediaToSafFolderNative(nativeItems, {
      treeUri: settings.customFolder.treeUri,
      chatName: safeChatName,
      exportTimestamp,
      organization: settings.outputOrganization,
      duplicateHandling: settings.outputOrganization.duplicateHandling
    })
    : await saveMediaTermuxParityNative(nativeItems, {
      chatName: safeChatName,
      baseFolder: settings?.baseFolder,
      exportTimestamp,
      organization: settings?.outputOrganization,
      duplicateHandling: settings?.outputOrganization.duplicateHandling
    });

  for (const result of nativeResult.results) {
    if (!result.ok) {
      logger.warn('Save failure counted', { filename: result.filename, reason: result.error });
    }
    logger.debug('Native save result', {
      filename: result.filename,
      filesystemTimestampFixed: result.filesystemTimestampFixed,
      mediaScannerCompleted: result.mediaScannerCompleted,
      galleryMaySortByImportTime: result.galleryMaySortByImportTime,
      outputPath: result.outputPath,
      scannedUri: result.scannedUri
    });
  }

  onProgress?.({
    stageLabel: 'Done',
    processed: selected.length,
    total: selected.length,
    failed: nativeResult.failed
  });

  const cacheCleared = await clearWorkingDirectory(workingDirectory);
  const results = nativeResult.results.map<SaveFileResult>((result, index) => {
    const candidate = selected[index];
    const mediaType = result.mediaType ?? candidate?.file.mediaType;
    const chatDateIso = candidate?.file.matchedRecord?.messageDateIso ?? null;
    const indexedDate = result.mediaStoreValues?.dateTaken;
    const dateCorrectionVerified = result.ok && chatDateIso !== null && candidate !== undefined && !candidate.file.dateAmbiguous
      && typeof indexedDate === 'number' && Math.abs(indexedDate - candidate.timestampMillis) <= 2000;
    const galleryMaySortByImportTime = result.ok && !dateCorrectionVerified
      && (mediaType === 'photo' || mediaType === 'video' || mediaType === 'sticker' || mediaType === 'gif');
    return {
      ...result,
      mediaType,
      dateCorrectionVerified,
      galleryMaySortByImportTime,
      whatsAppDateIso: chatDateIso,
      failureReason: result.failureReason ?? result.error
    };
  });
  const dateCorrected = results.filter((result) => result.dateCorrectionVerified).length;
  const mayShowImportTime = results.filter((result) => result.galleryMaySortByImportTime).length;
  logger.info('Save completed', {
    saved: nativeResult.saved,
    copied: nativeResult.copied,
    filesystemTimestampFixed: nativeResult.filesystemTimestampFixed,
    scanned: nativeResult.scanned,
    fallbackImportTimeRisk: nativeResult.fallbackImportTimeRisk,
    mayShowImportTime
  });
  logger.debug('Save pipeline complete', {
    saved: nativeResult.saved,
    failed: nativeResult.failed,
    skipped: files.length - selected.length,
    dateCorrected,
    dateCorrectionFailed: nativeResult.saved - dateCorrected,
    mayShowImportTime,
    cacheCleared
  });

  return buildSaveSummary({
    totalFiles: files.length,
    selectedFiles: selected.length,
    saved: nativeResult.saved,
    copied: nativeResult.copied,
    failed: nativeResult.failed,
    filesystemTimestampFixed: nativeResult.filesystemTimestampFixed,
    exifFixed: nativeResult.exifFixed,
    mp4MetadataFixed: nativeResult.mp4MetadataFixed,
    scanned: nativeResult.scanned,
    dateCorrected,
    cacheCleared,
    saveMethod: destinationMode === 'custom-folder' && settings?.customFolder?.treeUri ? 'saf-custom-folder' : 'termux-parity',
    outputDirectory: nativeResult.outputDirectory ?? outputFolder,
    results
  });
}
