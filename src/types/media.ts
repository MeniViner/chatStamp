export type MediaType = 'photo' | 'video' | 'voice' | 'audio' | 'sticker' | 'gif' | 'document' | 'unknown';

export type PipelineStage =
  | 'welcome'
  | 'analyzing'
  | 'summary'
  | 'selectFiles'
  | 'reviewSave'
  | 'saving'
  | 'results'
  | 'error';

export type ChatMediaRecord = {
  id: string;
  filename: string;
  normalizedFilename: string;
  sender: string;
  messageDateIso: string;
  rawLine: string;
};

export type ExtractedMediaFile = {
  id: string;
  filename: string;
  normalizedFilename: string;
  uri: string;
  mediaType: MediaType;
  thumbnailUri?: string;
  matchedRecord?: ChatMediaRecord;
};

export type SenderSummary = {
  sender: string;
  total: number;
  photos: number;
  videos: number;
  voice: number;
  other: number;
};

export type ImportSummary = {
  chatRecords: number;
  skippedChatLines: number;
  extractedEntries: number;
  skippedZipEntries: number;
  matchedMedia: number;
  unmatchedMedia: number;
  senders: number;
  photos: number;
  videos: number;
  voice: number;
  stickers: number;
  documents: number;
  unknown: number;
  extractionMode: 'native-selective';
};

export type MediaTypeSelection = Record<MediaType, boolean>;

export type ProcessingProgress = {
  stageLabel: string;
  processed: number;
  total: number;
  failed: number;
};

export type CompletionSummary = {
  saved: number;
  skipped: number;
  failed: number;
  dateCorrected: number;
  dateCorrectionFailed: number;
  mayShowImportTime: number;
  cacheCleared: boolean;
  results?: SaveFileResult[];
};

export type SaveFileResult = {
  filename: string;
  ok: boolean;
  insertedUri?: string | null;
  mediaType?: MediaType;
  originalTimestampMillis?: number;
  dateCorrectionVerified: boolean;
  galleryMaySortByImportTime: boolean;
  retrieverDateBefore?: string | null;
  retrieverDateAfterRewrite?: string | null;
  retrieverDateAfterInsert?: string | null;
  mediaStoreDateTaken?: number | null;
  mediaStoreDateModified?: number | null;
  mediaStoreValues?: Record<string, number | string | null> | null;
  boxesVerified?: boolean;
  sourcePath?: string | null;
  insertedSourcePath?: string | null;
  mp4RewriteFailureCode?: string | null;
  debugOriginalPath?: string | null;
  debugRewrittenPath?: string | null;
  failureReason?: string | null;
};
