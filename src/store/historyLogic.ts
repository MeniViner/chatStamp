import type { CompletionSummary, ExportHistoryItem, ExtractedMediaFile, MediaTypeSelection } from '../types/media';

export function createExportHistoryItem(params: {
  completion: CompletionSummary;
  files: ExtractedMediaFile[];
  selectedFileIds: string[];
  selectedMediaTypes: MediaTypeSelection;
  selectedSenders: string[];
  chatName: string;
  outputFolderPath: string;
  now?: Date;
}): ExportHistoryItem {
  const selectedIdSet = new Set(params.selectedFileIds);
  const selectedSenderSet = new Set(params.selectedSenders);
  const selectedFiles = params.files.filter((file) => {
    const sender = file.matchedRecord?.sender;
    return Boolean(sender && selectedSenderSet.has(sender) && selectedIdSet.has(file.id) && params.selectedMediaTypes[file.mediaType]);
  });
  const count = (type: string) => selectedFiles.filter((file) => file.mediaType === type).length;
  const timestamp = params.now ?? new Date();
  const fixed = params.completion.filesystemTimestampFixed ?? 0;

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
    saveMethod: 'termux-parity',
    allFilesHadTimestampsFixed: params.completion.saved > 0 && fixed >= params.completion.saved,
    savedFiles: params.completion.results
  };
}
