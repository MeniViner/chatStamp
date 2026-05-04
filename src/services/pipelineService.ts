import type { AppSettings, CompletionSummary, ExtractedMediaFile, MediaTypeSelection, ProcessingProgress } from '../types/media';
import { logger } from '../lib/logger';
import { getMimeTypeForMedia } from '../lib/mediaClassifier';
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
  const senderSet = new Set(selectedSenders);
  const selectedFileSet = new Set(selectedFileIds);
  logger.debug('Selected senders', selectedSenders);
  logger.debug('Selected media types', selectedMediaTypes);
  const selected = files.filter((file) => {
    const sender = file.matchedRecord?.sender;
    return Boolean(
      sender &&
        senderSet.has(sender) &&
        selectedMediaTypes[file.mediaType] &&
        selectedFileSet.has(file.id)
    );
  });

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

  const nativeItems = selected.map((file) => ({
      sourceUri: file.uri,
      filename: file.filename,
      mediaType: file.mediaType,
      mimeType: getMimeTypeForMedia(file.filename, file.mediaType),
      originalTimestampMillis: new Date(file.matchedRecord?.messageDateIso ?? '').getTime(),
      sender: file.matchedRecord?.sender ?? 'Unknown',
      albumName: 'WhatsApp TimeFixer',
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
  const mayShowImportTime = nativeResult.dateCorrectionFailed;
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
    dateCorrected: nativeResult.dateCorrected,
    dateCorrectionFailed: nativeResult.dateCorrectionFailed,
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
    dateCorrected: nativeResult.filesystemTimestampFixed ?? nativeResult.dateCorrected,
    cacheCleared,
    results: nativeResult.results.map((result) => ({
      filename: result.filename,
      ok: result.ok,
      insertedUri: result.insertedUri,
      outputPath: result.outputPath,
      displayName: result.displayName,
      mediaType: result.mediaType ?? selected.find((file) => file.filename === result.filename)?.mediaType,
      dateCorrectionVerified: result.dateCorrectionVerified,
      galleryMaySortByImportTime: result.galleryMaySortByImportTime,
      failureReason: result.failureReason ?? result.error,
      originalTimestampMillis: result.originalTimestampMillis,
      whatsAppDateIso: result.whatsAppDateIso,
      copied: result.copied,
      setLastModifiedReturned: result.setLastModifiedReturned,
      actualLastModifiedMillis: result.actualLastModifiedMillis,
      filesystemTimestampFixed: result.filesystemTimestampFixed,
      mediaScannerCompleted: result.mediaScannerCompleted,
      scannedUri: result.scannedUri,
      exifWritten: result.exifWritten,
      mp4MetadataFixed: result.mp4MetadataFixed,
      mediaStoreIndexedExpectedDate: result.mediaStoreIndexedExpectedDate,
      retrieverDateBefore: result.retrieverDateBefore,
      retrieverDateAfterRewrite: result.retrieverDateAfterRewrite,
      retrieverDateAfterInsert: result.retrieverDateAfterInsert,
      mediaStoreDateTaken: result.mediaStoreDateTaken,
      mediaStoreDateModified: result.mediaStoreDateModified,
      mediaStoreDateAdded: result.mediaStoreDateAdded,
      mediaStoreValues: result.mediaStoreValues,
      boxesVerified: result.boxesVerified,
      sourcePath: result.sourcePath,
      insertedSourcePath: result.insertedSourcePath,
      mp4RewriteFailureCode: result.mp4RewriteFailureCode,
      debugOriginalPath: result.debugOriginalPath,
      debugRewrittenPath: result.debugRewrittenPath
    }))
  });
}
