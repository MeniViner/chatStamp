import { requireOptionalNativeModule } from 'expo-modules-core';
import type { MediaType } from '../types/media';

export type NativeExtractedMediaFile = {
  filename: string;
  uri: string;
  sourcePath: string;
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

export type NativeDateWriteResult = {
  mediaStoreRowsUpdated: number;
  fileModified: boolean;
  exifWritten: boolean;
  dateCorrectionVerified: boolean;
  collection: string;
  contentUri?: string | null;
  originalTimestampMillis: number;
  before?: Record<string, number | string | null> | null;
  after?: Record<string, number | string | null> | null;
  warning?: string | null;
};

export type NativeSaveMediaItem = {
  sourceUri: string;
  filename: string;
  mediaType: MediaType;
  mimeType: string;
  originalTimestampMillis: number;
  sender: string;
  albumName?: string;
};

export type NativeSavedMediaFileResult = {
  filename: string;
  ok: boolean;
  insertedUri?: string | null;
  collection?: string | null;
  mimeType?: string | null;
  originalTimestampMillis: number;
  dateCorrectionSupported: boolean;
  dateCorrectionVerified: boolean;
  galleryMaySortByImportTime: boolean;
  metadataWritten: boolean;
  exifWritten?: boolean;
  metadataRewriteAttempted?: boolean;
  metadataRewriteSucceeded?: boolean;
  boxesVerified?: boolean;
  sourcePath?: string | null;
  insertedSourcePath?: string | null;
  retrieverDateBefore?: string | null;
  retrieverDateAfterRewrite?: string | null;
  retrieverDateAfterInsert?: string | null;
  mediaStoreDateTaken?: number | null;
  mediaStoreDateModified?: number | null;
  mediaStoreValues?: Record<string, number | string | null> | null;
  mp4InspectionBefore?: Record<string, unknown> | null;
  mp4InspectionAfterRewrite?: Record<string, unknown> | null;
  mp4RewriteFailureCode?: string | null;
  debugOriginalPath?: string | null;
  debugRewrittenPath?: string | null;
  failureReason?: string | null;
  error?: string | null;
};

export type NativeSaveMediaResult = {
  saved: number;
  failed: number;
  dateCorrected: number;
  dateCorrectionFailed: number;
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
export type NativeMp4DebugResult = Record<string, unknown>;

type WhatsAppTimeFixerNativeModule = {
  extractSupportedZipEntriesAsync: (
    zipUri: string,
    outputDirectoryUri: string
  ) => Promise<NativeZipExtractionResult>;
  getPendingSharedZipAsync: () => Promise<NativeSharedZipResult>;
  consumePendingSharedZipAsync: () => Promise<NativeSharedZipResult>;
  getShareIntentDebugStatusAsync: () => Promise<NativeShareIntentDebugStatus>;
  debugInspectMp4DatesAsync: (
    fileUriOrPath: string,
    targetTimestampMillis?: number | null
  ) => Promise<NativeMp4DebugResult>;
  debugRewriteMp4DateAsync: (
    inputUriOrPath: string,
    targetTimestampMillis: number
  ) => Promise<NativeMp4DebugResult>;
  saveMediaWithOriginalDatesAsync: (
    items: NativeSaveMediaItem[],
    options?: { albumName?: string; keepFailedDebugFiles?: boolean } | null
  ) => Promise<NativeSaveMediaResult>;
  setMediaStoreDatesAsync: (
    assetId: string,
    localUri: string,
    mediaType: MediaType,
    takenAtMillis: number,
    displayName?: string | null
  ) => Promise<NativeDateWriteResult>;
};

const nativeModule = requireOptionalNativeModule<WhatsAppTimeFixerNativeModule>('WhatsAppTimeFixerNative');

export function getTimeFixerNativeModule(): WhatsAppTimeFixerNativeModule {
  if (!nativeModule) {
    throw new Error(
      'WhatsAppTimeFixerNative is not available. Build and run an Android development build so selective ZIP extraction and Gallery date writes can use the native module.'
    );
  }

  return nativeModule;
}
