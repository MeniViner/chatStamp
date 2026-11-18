import type { CompletionSummary, ExportHistoryItem, ExtractedMediaFile, MediaTypeSelection, SaveFileResult } from '../types/media';
import { getSelectedSaveCandidates } from './selectionLogic';

export function createExportHistoryItem(params: {
  completion: CompletionSummary;
  files: ExtractedMediaFile[];
  selectedFileIds: string[];
  selectedMediaTypes: MediaTypeSelection;
  selectedSenders: string[];
  chatName: string;
  outputFolderPath: string;
  folderTreeUri?: string | null;
  now?: Date;
  archiveFingerprint?: string;
}): ExportHistoryItem {
  const selectedFiles = getSelectedSaveCandidates(
    params.files, params.selectedSenders, params.selectedMediaTypes, params.selectedFileIds
  ).map(({ file }) => file);
  const savedFiles = params.completion.results
    ?.filter((file) => file.ok && (file.outcome === 'saved' || file.outcome === undefined));
  const cancelled = params.completion.results?.length
    ? params.completion.results.filter((file) => file.outcome === 'cancelled').length
    : params.completion.cancelled ?? 0;
  const count = (type: string) => (savedFiles ?? selectedFiles).filter((file) => file.mediaType === type).length;
  const timestamp = params.now ?? new Date();
  const fixed = params.completion.dateCorrected;

  return {
    id: params.archiveFingerprint ? `export-${params.archiveFingerprint}` : `${timestamp.toISOString()}-${Math.random().toString(36).slice(2, 8)}`,
    exportFingerprint: params.archiveFingerprint,
    exportTimestampIso: timestamp.toISOString(),
    chatName: params.chatName,
    outputFolderPath: params.outputFolderPath,
    selectedSenders: params.selectedSenders,
    counts: {
      totalSaved: params.completion.saved,
      photos: count('photo'),
      videos: count('video'),
      voice: count('voice'),
      stickers: count('sticker'),
      documents: count('document'),
      failed: params.completion.failed,
      cancelled
    },
    saveMethod: params.completion.saveMethod ?? 'termux-parity',
    outputDirectory: params.completion.outputDirectory,
    folderTreeUri: params.folderTreeUri,
    allFilesHadTimestampsFixed: params.completion.saved > 0 && fixed >= params.completion.saved
      && params.completion.failed === 0 && cancelled === 0
      && (params.completion.results === undefined || historyDatesVerified(params.completion.results)),
    savedFiles: params.completion.results
  };
}

export function normalizeHistoryItem(item: ExportHistoryItem): ExportHistoryItem {
  const savedFiles: ExportHistoryItem['savedFiles'] = item.savedFiles?.map((result) => {
    if (result.outcome) return result;
    const insertedUri = result.insertedUri ?? result.scannedUri
      ?? (result.outputPath?.startsWith('content://') ? result.outputPath : null);
    return {
      ...result,
      insertedUri,
      destinationKind: insertedUri?.startsWith('content://media/') ? 'media-store'
        : insertedUri ? 'document-provider' : 'legacy-path',
      outcome: result.ok ? 'saved' : 'failed'
    };
  });
  const cancelled = savedFiles?.length ? savedFiles.filter((result) => result.outcome === 'cancelled').length
    : item.counts.cancelled;
  return {
    ...item,
    counts: { ...item.counts, cancelled },
    outputDirectory: item.outputDirectory || item.outputFolderPath,
    allFilesHadTimestampsFixed: item.allFilesHadTimestampsFixed && item.counts.failed === 0 && cancelled === 0
      && (savedFiles === undefined || historyDatesVerified(savedFiles)),
    savedFiles
  };
}

export function historyPresentation(item: ExportHistoryItem): {
  status: 'completed' | 'partial' | 'cancelled' | 'failed' | 'unknown';
  statusKey: string;
  descriptionKey: string;
  values: { saved: number; cancelled: number; failed: number };
} {
  const cancelled = item.savedFiles?.length ? item.savedFiles.filter((result) => result.outcome === 'cancelled').length
    : item.counts.cancelled;
  const values = { saved: item.counts.totalSaved, cancelled: cancelled ?? 0, failed: item.counts.failed };
  const descriptionKey = values.cancelled > 0 ? 'history.summaryCancelledCounts' : 'history.summaryCounts';
  if (values.cancelled > 0) return { status: values.saved > 0 ? 'partial' : 'cancelled',
    statusKey: values.saved > 0 ? 'history.partial' : 'history.cancelled', descriptionKey, values };
  if (values.failed > 0) return { status: values.saved > 0 ? 'partial' : 'failed',
    statusKey: values.saved > 0 ? 'history.partial' : 'history.needsCheck', descriptionKey, values };
  if (cancelled === undefined) return { status: 'unknown', statusKey: 'history.needsCheck', descriptionKey, values };
  return { status: 'completed', statusKey: 'history.completed', descriptionKey, values };
}

export function historyDatesVerified(results: SaveFileResult[]): boolean {
  return results.length > 0 && results.every((result) => result.ok && result.dateCorrectionVerified
    && result.dateAmbiguous !== true && result.dateVerification !== 'unverified' && result.dateVerification !== 'mtime-only'
    && result.verificationReason !== 'date-unavailable');
}
