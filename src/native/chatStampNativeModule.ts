import { requireOptionalNativeModule } from 'expo-modules-core';
import type { DateSource, DuplicateHandlingMode, MediaType, OutputOrganizationMode, PickedFolderResult, SaveFileResult } from '../types/media';
import type { OperationProgress } from '../lib/operationProgress';
import type { PipelineErrorCode } from '../lib/pipelineErrors';
import type { OutputFolderLabels } from '../lib/outputOrganization';

type NativeExtractedMediaFile = {
  filename: string;
  uri: string;
  sourcePath: string;
  modificationTime?: string | null;
  sizeBytes: number;
};

export type NativeTranscriptCandidate = {
  filename: string;
  sourcePath: string;
  uri: string;
  sample: string;
  modificationTime?: string | null;
  sizeBytes: number;
};

export type NativeZipExtractionResult = {
  operationId: string;
  archiveFingerprint: string;
  transcriptCandidates: NativeTranscriptCandidate[];
  mediaFiles: NativeExtractedMediaFile[];
  extractedCount: number;
  skippedCount: number;
  skippedEntries: { sourcePath: string; reason: 'unsafe-path' | 'unsupported-type' }[];
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
  senderName?: string;
  whatsAppDateIso?: string;
  dateAmbiguous?: boolean;
};

export type ScopedSaveOptions = {
  archiveFingerprint: string;
  operationId: string;
  workingDirectory: string;
  sourceUri?: string;
  notificationTitle: string;
  notificationCancelLabel: string;
  chatName: string;
  treeUri?: string;
  duplicateHandling: DuplicateHandlingMode;
  timestampFolder: boolean;
  organizationMode: OutputOrganizationMode;
  alwaysUseMessageDate: boolean;
  folderLabels?: OutputFolderLabels;
  chatFolderName?: string;
};

type NativeSavedMediaFileResult = Omit<SaveFileResult, 'dateCorrectionVerified' | 'galleryMaySortByImportTime'> & {
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
  id?: string;
  filename?: string;
  mimeType?: string;
  sourceAction?: string;
  sourceCount?: number;
  sourceUri?: string;
  errorCode?: PipelineErrorCode;
};

export type OperationSnapshot = {
  progress: OperationProgress;
  workingDirectory?: string;
  sourceUri?: string;
  archiveFingerprint?: string;
  chatName?: string;
  result?: NativeSaveMediaResult;
  error?: { code: PipelineErrorCode; message: string; missingBytes?: number };
};

export type ThumbnailResult =
  | {
      available: true;
      uri: string;
      width: number;
      height: number;
      cacheKey: string;
      cacheHit: boolean;
      kind: 'image' | 'video' | 'pdf';
      durationMillis?: number;
    }
  | { available: false; reason: 'unsupported' | 'unreadable' | 'decode-failed' | 'busy' };

export type ExternalOpenResult =
  | { opened: true }
  | { opened: false; reason: 'invalid-uri' | 'unreadable' | 'permission-lost' | 'no-handler' | 'launch-failed' };

export type ExternalOpenFile = { uri: string; mimeType?: string | null; filename?: string | null };

type ChatStampNativeModule = {
  extractSupportedZipEntriesAsync: (
    zipUri: string,
    outputDirectoryUri: string,
    operationId: string
  ) => Promise<NativeZipExtractionResult>;
  consumePendingSharedZipAsync: () => Promise<NativeSharedZipResult>;
  cancelOperationAsync: (operationId: string) => Promise<void>;
  acknowledgeOperationAsync: (operationId: string) => Promise<void>;
  getOperationSnapshotAsync: () => Promise<OperationSnapshot | null>;
  canReadSourceAsync: (sourceUri: string) => Promise<boolean>;
  releaseImportAsync: (operationId: string, workingDirectory: string, sourceUri: string) => Promise<void>;
  releaseSourceAsync: (sourceUri: string) => Promise<void>;
  cleanupStaleJobsAsync: () => Promise<void>;
  readStoreFileAsync: (name: string) => Promise<string | null>;
  writeStoreFileAtomicAsync: (name: string, contents: string) => Promise<void>;
  listStoreFilesAsync: (prefix: string) => Promise<string[]>;
  deleteStoreFileAsync: (name: string) => Promise<void>;
  addListener(event: 'onImportProgress' | 'onSaveProgress', listener: (progress: OperationProgress) => void): { remove: () => void };
  addListener(event: 'onSharedZip', listener: () => void): { remove: () => void };
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
  getThumbnailAsync: (uri: string, sizePx: number) => Promise<ThumbnailResult>;
  invalidateThumbnailAsync: (thumbnailUri: string) => Promise<void>;
  openFileInOtherAppAsync: (file: ExternalOpenFile) => Promise<ExternalOpenResult>;
  awaitMediaReleaseAsync: () => Promise<void>;

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
