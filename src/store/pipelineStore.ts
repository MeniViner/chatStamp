import { create } from 'zustand';
import type {
  CompletionSummary,
  ExtractedMediaFile,
  ImportSummary,
  MediaType,
  MediaTypeSelection,
  PipelineStage,
  ProcessingProgress
} from '../types/media';
import { logger } from '../lib/logger';
import { toggleMediaTypeSelection, toggleSenderSelection } from './selectionLogic';

export type PipelineState = {
  stage: PipelineStage;
  overlayReturnStage?: PipelineStage;
  zipUri?: string;
  zipName?: string;
  workingDirectory?: string;
  mediaFiles: ExtractedMediaFile[];
  importSummary?: ImportSummary;
  selectedSenders: string[];
  selectedMediaTypes: MediaTypeSelection;
  selectedFileIds: string[];
  progress?: ProcessingProgress;
  completion?: CompletionSummary;
  error?: string;
  setStage: (stage: PipelineStage) => void;
  openOverlayStage: (stage: 'settings' | 'history') => void;
  closeOverlayStage: (fallback?: PipelineStage) => void;
  setZip: (zip: { uri: string; name: string }) => void;
  setImportResult: (result: {
    workingDirectory: string;
    mediaFiles: ExtractedMediaFile[];
    importSummary: ImportSummary;
  }) => void;
  toggleSender: (sender: string) => void;
  toggleMediaType: (mediaType: MediaType) => void;
  toggleFile: (fileId: string) => void;
  selectFiles: (fileIds: string[]) => void;
  clearFiles: (fileIds: string[]) => void;
  setProgress: (progress: ProcessingProgress) => void;
  setCompletion: (completion: CompletionSummary) => void;
  setError: (error: string) => void;
  clearError: () => void;
  reset: () => void;
};

const defaultMediaTypeSelection: MediaTypeSelection = {
  photo: true,
  video: true,
  voice: false,
  audio: false,
  sticker: false,
  gif: false,
  document: false,
  unknown: false
};

export const usePipelineStore = create<PipelineState>((set) => ({
  stage: 'welcome',
  mediaFiles: [],
  selectedSenders: [],
  selectedMediaTypes: defaultMediaTypeSelection,
  selectedFileIds: [],
  setStage: (stage) => {
    logger.debug('wizardStepChanged', { stage });
    set((state) => ({
      stage,
      overlayReturnStage: isOverlayStage(stage) ? state.overlayReturnStage : undefined
    }));
  },
  openOverlayStage: (stage) =>
    set((state) => {
      const overlayReturnStage = state.overlayReturnStage ?? (isOverlayStage(state.stage) ? 'welcome' : state.stage);
      logger.debug('overlayStageOpened', { stage, overlayReturnStage });
      return { stage, overlayReturnStage };
    }),
  closeOverlayStage: (fallback = 'welcome') =>
    set((state) => {
      const stage = state.overlayReturnStage ?? fallback;
      logger.debug('overlayStageClosed', { fallback, restoredStage: stage });
      return { stage, overlayReturnStage: undefined };
    }),
  setZip: (zip) => set({ zipUri: zip.uri, zipName: zip.name }),
  setImportResult: ({ workingDirectory, mediaFiles, importSummary }) =>
    set(() => {
      const hasDefaultMediaSelection = mediaFiles.some(
        (file) => file.matchedRecord && (file.mediaType === 'photo' || file.mediaType === 'video')
      );
      const shouldSelectTranscriptOnly =
        !hasDefaultMediaSelection &&
        mediaFiles.length === 1 &&
        mediaFiles[0]?.sourceKind === 'chat-transcript';
      return {
        workingDirectory,
        mediaFiles,
        importSummary,
        selectedSenders: Array.from(new Set(mediaFiles.map((file) => file.matchedRecord?.sender).filter(Boolean))) as string[],
        selectedMediaTypes: shouldSelectTranscriptOnly
          ? { ...defaultMediaTypeSelection, document: true }
          : defaultMediaTypeSelection,
        selectedFileIds: mediaFiles
          .filter((file) =>
            file.matchedRecord &&
            (file.mediaType === 'photo' || file.mediaType === 'video' || (shouldSelectTranscriptOnly && file.sourceKind === 'chat-transcript'))
          )
          .map((file) => file.id),
        stage: 'selectFiles'
      };
    }),
  toggleSender: (sender) =>
    set((state) => {
      const selectedSenders = toggleSenderSelection(state.selectedSenders, sender);
      logger.debug('Sender selection changes', { sender, selected: selectedSenders.includes(sender), selectedSenders });
      return { selectedSenders };
    }),
  toggleMediaType: (mediaType) =>
    set((state) => {
      const selectedMediaTypes = toggleMediaTypeSelection(state.selectedMediaTypes, mediaType);
      logger.debug('Media type selection changes', { mediaType, selected: selectedMediaTypes[mediaType], selectedMediaTypes });
      return { selectedMediaTypes };
    }),
  toggleFile: (fileId) =>
    set((state) => {
      const selectedFileIds = state.selectedFileIds.includes(fileId)
        ? state.selectedFileIds.filter((id) => id !== fileId)
        : [...state.selectedFileIds, fileId];
      logger.debug('fileSelectionChanged', { fileId, selected: selectedFileIds.includes(fileId) });
      return { selectedFileIds };
    }),
  selectFiles: (fileIds) =>
    set((state) => {
      const selectedFileIds = Array.from(new Set([...state.selectedFileIds, ...fileIds]));
      logger.debug('Select all visible files', { added: fileIds.length, selectedCount: selectedFileIds.length });
      return { selectedFileIds };
    }),
  clearFiles: (fileIds) =>
    set((state) => {
      const clearSet = new Set(fileIds);
      const selectedFileIds = state.selectedFileIds.filter((id) => !clearSet.has(id));
      logger.debug('Clear visible files', { cleared: fileIds.length, selectedCount: selectedFileIds.length });
      return { selectedFileIds };
    }),
  setProgress: (progress) => set({ progress }),
  setCompletion: (completion) => set({ completion, stage: 'results' }),
  setError: (error) => set({ error, stage: 'error' }),
  clearError: () => set({ error: undefined }),
  reset: () =>
    set({
      stage: 'welcome',
      overlayReturnStage: undefined,
      zipUri: undefined,
      zipName: undefined,
      workingDirectory: undefined,
      mediaFiles: [],
      importSummary: undefined,
      selectedSenders: [],
      selectedMediaTypes: defaultMediaTypeSelection,
      selectedFileIds: [],
      progress: undefined,
      completion: undefined,
      error: undefined
    })
}));

function isOverlayStage(stage: PipelineStage): stage is 'settings' | 'history' {
  return stage === 'settings' || stage === 'history';
}
