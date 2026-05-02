import type { CompletionSummary, ExtractedMediaFile, MediaTypeSelection, ProcessingProgress } from '../types/media';
import { logger } from '../lib/logger';
import { getMimeTypeForMedia } from '../lib/mediaClassifier';
import { clearWorkingDirectory } from './importService';
import { buildSaveSummary } from './saveSummary';
import { saveMediaWithOriginalDatesNative } from '../native/nativeMediaSaver';

export type RunSavePipelineParams = {
  files: ExtractedMediaFile[];
  selectedSenders: string[];
  selectedMediaTypes: MediaTypeSelection;
  selectedFileIds: string[];
  workingDirectory?: string;
  onProgress?: (progress: ProcessingProgress) => void;
};

export async function runSavePipeline({
  files,
  selectedSenders,
  selectedMediaTypes,
  selectedFileIds,
  workingDirectory,
  onProgress
}: RunSavePipelineParams): Promise<CompletionSummary> {
  const senderSet = new Set(selectedSenders);
  const selectedFileSet = new Set(selectedFileIds);
  logger.debug('Selected senders', selectedSenders);
  logger.debug('Selected media types', selectedMediaTypes);
  const selected = files.filter((file) => {
    const sender = file.matchedRecord?.sender;
    const canSaveToGallery = file.mediaType === 'photo' || file.mediaType === 'video';
    return Boolean(
      sender &&
        senderSet.has(sender) &&
        selectedMediaTypes[file.mediaType] &&
        selectedFileSet.has(file.id) &&
        canSaveToGallery
    );
  });

  logger.debug('Save started', { selectedCount: selected.length });
  onProgress?.({ stageLabel: 'Saving selected media', processed: 0, total: selected.length, failed: 0 });

  const nativeResult = await saveMediaWithOriginalDatesNative(
    selected.map((file) => ({
      sourceUri: file.uri,
      filename: file.filename,
      mediaType: file.mediaType,
      mimeType: getMimeTypeForMedia(file.filename, file.mediaType),
      originalTimestampMillis: new Date(file.matchedRecord?.messageDateIso ?? '').getTime(),
      sender: file.matchedRecord?.sender ?? 'Unknown',
      albumName: 'WhatsApp TimeFixer'
    })),
    { albumName: 'WhatsApp TimeFixer', keepFailedDebugFiles: __DEV__ }
  );

  for (const result of nativeResult.results) {
    if (!result.ok) {
      logger.warn('Save failure counted', { filename: result.filename, reason: result.error });
    }
    logger.debug('Native save result', {
      filename: result.filename,
      dateCorrectionSupported: result.dateCorrectionSupported,
      dateCorrectionVerified: result.dateCorrectionVerified,
      galleryMaySortByImportTime: result.galleryMaySortByImportTime,
      insertedUri: result.insertedUri
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
  logger.debug('Date correction summary', {
    saved: nativeResult.saved,
    dateCorrected: nativeResult.dateCorrected,
    dateCorrectionFailed: nativeResult.dateCorrectionFailed,
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
    failed: nativeResult.failed,
    dateCorrected: nativeResult.dateCorrected,
    cacheCleared,
    results: nativeResult.results.map((result) => ({
      filename: result.filename,
      ok: result.ok,
      insertedUri: result.insertedUri,
      mediaType: selected.find((file) => file.filename === result.filename)?.mediaType,
      dateCorrectionVerified: result.dateCorrectionVerified,
      galleryMaySortByImportTime: result.galleryMaySortByImportTime,
      failureReason: result.failureReason ?? result.error,
      originalTimestampMillis: result.originalTimestampMillis,
      retrieverDateBefore: result.retrieverDateBefore,
      retrieverDateAfterRewrite: result.retrieverDateAfterRewrite,
      retrieverDateAfterInsert: result.retrieverDateAfterInsert,
      mediaStoreDateTaken: result.mediaStoreDateTaken,
      mediaStoreDateModified: result.mediaStoreDateModified,
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
