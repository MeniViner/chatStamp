import type { CompletionSummary, ExportHistoryItem, ExtractedMediaFile, MediaTypeSelection } from '../types/media';
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
}): ExportHistoryItem {
  const selectedFiles = getSelectedSaveCandidates(
    params.files, params.selectedSenders, params.selectedMediaTypes, params.selectedFileIds
  ).map(({ file }) => file);
  const savedFiles = params.completion.results
    ?.filter((file) => file.outcome === 'saved' || (file.outcome === undefined && file.ok));
  const count = (type: string) => (savedFiles ?? selectedFiles).filter((file) => file.mediaType === type).length;
  const timestamp = params.now ?? new Date();
  const fixed = params.completion.dateCorrected;

  return {
    id: `${timestamp.toISOString()}-${Math.random().toString(36).slice(2, 8)}`,
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
      failed: params.completion.failed
    },
    saveMethod: params.completion.saveMethod ?? 'termux-parity',
    outputDirectory: params.completion.outputDirectory,
    folderTreeUri: params.folderTreeUri,
    allFilesHadTimestampsFixed: params.completion.saved > 0 && fixed >= params.completion.saved,
    savedFiles: params.completion.results
  };
}

export function normalizeHistoryItem(item: ExportHistoryItem): ExportHistoryItem {
  return {
    ...item,
    outputDirectory: item.outputDirectory || item.outputFolderPath,
    savedFiles: item.savedFiles?.map((result) => {
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
    })
  };
}
