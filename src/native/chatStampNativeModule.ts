import { requireOptionalNativeModule } from 'expo-modules-core';
import type { DateSource, DuplicateHandlingMode, MediaType, OutputOrganizationMode, PickedFolderResult, SaveFileResult } from '../types/media';

export type NativeExtractedMediaFile = {
  filename: string;
  uri: string;
  sourcePath: string;
  modificationTime?: string;
};

export type NativeTranscriptCandidate = {
  filename: string;
  sourcePath: string;
  score: number;
  messageLineCount: number;
  selected: boolean;
  reason: string;
};

export type NativeZipExtractionResult = {
  chatFileUri?: string | null;
  chatFilename?: string | null;
  txtFiles: string[];
  transcriptCandidates: NativeTranscriptCandidate[];
  mediaFiles: NativeExtractedMediaFile[];
  extractedCount: number;
  skippedCount: number;
  extractionMode: 'native-selective';
};

export type NativeSaveMediaItem = {
  entryId: string;
  sourceUri: string;
  filename: string;
  mediaType: MediaType;
  mimeType: string;
  timestampMillis?: number;
  dateSource: DateSource;
  timeZone?: string;
  relativeFolder?: string;
};

export type ScopedSaveOptions = {
  archiveUri: string;
  chatName: string;
  treeUri?: string;
  duplicateHandling: DuplicateHandlingMode;
  timestampFolder: boolean;
  organizationMode: OutputOrganizationMode;
  alwaysUseMessageDate: boolean;
};

export type NativeSavedMediaFileResult = Omit<SaveFileResult, 'dateCorrectionVerified' | 'galleryMaySortByImportTime'> & {
  entryId: string;
  outcome: NonNullable<SaveFileResult['outcome']>;
  dateVerification: NonNullable<SaveFileResult['dateVerification']>;
};

export type NativeSaveMediaResult = {
  mode: 'scoped-media-store' | 'saf-custom-folder';
  results: NativeSavedMediaFileResult[];
};

export type NativeSharedZipResult = {
  received: boolean;
  copiedUri?: string;
  filename?: string;
  mimeType?: string;
  sourceAction?: string;
  sourceUri?: string;
  sourceSizeBytes?: number | null;
  copiedSizeBytes?: number | null;
  validZip?: boolean;
  zipEntryCount?: number | null;
  firstZipEntries?: string[];
  error?: string;
  debugStatus?: Record<string, unknown>;
};

export type NativeShareIntentDebugStatus = Record<string, unknown>;

type ChatStampNativeModule = {
  extractSupportedZipEntriesAsync: (
    zipUri: string,
    outputDirectoryUri: string
  ) => Promise<NativeZipExtractionResult>;
  getPendingSharedZipAsync: () => Promise<NativeSharedZipResult>;
  consumePendingSharedZipAsync: () => Promise<NativeSharedZipResult>;
  getShareIntentDebugStatusAsync: () => Promise<NativeShareIntentDebugStatus>;
  saveMediaAsync: (items: NativeSaveMediaItem[], options: ScopedSaveOptions) => Promise<NativeSaveMediaResult>;
  openOutputFolderPickerAsync: () => Promise<PickedFolderResult | null>;
  openFolderTargetAsync: (target: {
    treeUri?: string | null;
    documentUri?: string | null;
    documentId?: string | null;
    relativeFolderDocumentId?: string | null;
    path?: string | null;
    displayName?: string | null;
  }) => Promise<{ opened?: boolean; reason?: string; activity?: string | null; attempted?: string; fallbackUsed?: boolean }>;
  shareOutputFilesAsync: (files: { uri?: string | null; path?: string | null; mimeType?: string | null; mediaType?: MediaType | null; filename?: string | null }[]) => Promise<{ opened?: boolean; shared?: number; reason?: string; activity?: string | null }>;
  deleteOutputFilesAsync: (files: { uri?: string | null; path?: string | null }[]) => Promise<{ deleted: number; failed: number; results: { target?: string | null; deleted: boolean; reason?: string | null }[] }>;
  openScannedMediaAsync: (contentUri: string, mimeType?: string | null) => Promise<{ opened?: boolean; reason?: string; uri?: string }>;

};

const nativeModule = requireOptionalNativeModule<ChatStampNativeModule>('ChatStampNative');

export function getChatStampNativeModule(): ChatStampNativeModule {
  if (!nativeModule) {
    throw new Error(
      'ChatStampNative is not available. Build and run an Android development build so selective ZIP extraction and Gallery date writes can use the native module.'
    );
  }

  return nativeModule;
}
