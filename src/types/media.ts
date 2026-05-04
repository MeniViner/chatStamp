export type MediaType = 'photo' | 'video' | 'voice' | 'audio' | 'sticker' | 'gif' | 'document' | 'unknown';

export type PipelineStage =
  | 'welcome'
  | 'analyzing'
  | 'selectFiles'
  | 'outputOptions'
  | 'reviewSave'
  | 'saving'
  | 'results'
  | 'settings'
  | 'history'
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
  copied?: number;
  skipped: number;
  failed: number;
  filesystemTimestampFixed?: number;
  exifFixed?: number;
  mp4MetadataFixed?: number;
  scanned?: number;
  dateCorrected: number;
  dateCorrectionFailed: number;
  mayShowImportTime: number;
  cacheCleared: boolean;
  results?: SaveFileResult[];
};

export type SaveMethod = 'termux-parity' | 'saf-custom-folder';

export type SaveDestinationMode = 'default-accurate-folder' | 'custom-folder';
export type OutputOrganizationMode = 'all-in-one' | 'by-type' | 'by-sender' | 'by-sender-and-type';
export type DuplicateHandlingMode = 'keep-both' | 'skip-existing' | 'replace-existing';
export type AppAppearance = 'system' | 'light' | 'dark';
export type AppLanguagePreference = 'system' | 'en' | 'he';

export type OutputOrganizationSettings = {
  mode: OutputOrganizationMode;
  createExportTimestampFolder: boolean;
  duplicateHandling: DuplicateHandlingMode;
};

export type PickedFolderResult = {
  treeUri: string;
  displayName?: string | null;
  persistedPermission: boolean;
  readablePathLabel?: string | null;
};

export type PickedFolderTimestampSupportResult = {
  treeUri: string;
  canWriteFile: boolean;
  canCreateSubfolders: boolean;
  canSetFilesystemTimestamp: boolean;
  timestampVerified: boolean;
  cleanupSucceeded: boolean;
  displayName?: string | null;
  readablePathLabel?: string | null;
  reason?: string | null;
};

export type AppSettings = {
  baseFolder: string;
  useDefaultFolder: boolean;
  saveDestinationMode: SaveDestinationMode;
  customFolder?: PickedFolderResult | null;
  customFolderTimestampSupport?: PickedFolderTimestampSupportResult | null;
  outputOrganization: OutputOrganizationSettings;
  onboardingCompleted: boolean;
  languagePreference: AppLanguagePreference;
  appearance: AppAppearance;
  useDynamicColors: boolean;
  developerMode: boolean;
  showTechnicalLogs: boolean;
  keepCacheAfterFailedRun: boolean;
  lastOutputFolder?: string | null;
};

export type ExportHistoryItem = {
  id: string;
  exportTimestampIso: string;
  chatName: string;
  outputFolderPath: string;
  selectedSenders: string[];
  counts: {
    totalSaved: number;
    photos: number;
    videos: number;
    voice: number;
    stickers: number;
    documents: number;
    failed: number;
  };
  saveMethod: SaveMethod;
  allFilesHadTimestampsFixed: boolean;
  savedFiles?: SaveFileResult[];
};

export type SaveFileResult = {
  filename: string;
  ok: boolean;
  insertedUri?: string | null;
  outputPath?: string | null;
  displayName?: string | null;
  mediaType?: MediaType;
  originalTimestampMillis?: number;
  whatsAppDateIso?: string | null;
  copied?: boolean;
  setLastModifiedReturned?: boolean;
  actualLastModifiedMillis?: number | null;
  filesystemTimestampFixed?: boolean;
  mediaScannerCompleted?: boolean;
  scannedUri?: string | null;
  dateCorrectionVerified: boolean;
  galleryMaySortByImportTime: boolean;
  exifWritten?: boolean;
  mp4MetadataFixed?: boolean;
  mediaStoreIndexedExpectedDate?: boolean;
  retrieverDateBefore?: string | null;
  retrieverDateAfterRewrite?: string | null;
  retrieverDateAfterInsert?: string | null;
  mediaStoreDateTaken?: number | null;
  mediaStoreDateModified?: number | null;
  mediaStoreDateAdded?: number | null;
  mediaStoreValues?: Record<string, number | string | null> | null;
  boxesVerified?: boolean;
  sourcePath?: string | null;
  insertedSourcePath?: string | null;
  mp4RewriteFailureCode?: string | null;
  debugOriginalPath?: string | null;
  debugRewrittenPath?: string | null;
  failureReason?: string | null;
};
