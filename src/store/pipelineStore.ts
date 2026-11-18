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
import { getMediaSender } from '../lib/mediaMetadata';
import { toggleMediaTypeSelection, toggleSenderSelection } from './selectionLogic';
import { reduceProgress, startOperation } from '../lib/operationProgress';
import { asPipelineError, type PipelineError } from '../lib/pipelineErrors';
import { isSaveableMediaType } from '../lib/mediaUi';
import { setIdsSelected, toggleId } from './fileSelectionState';

export type PipelineState = {
  stage: PipelineStage;
  overlayReturnStage?: PipelineStage;
  zipUri?: string;
  zipName?: string;
  workingDirectory?: string;
  archiveFingerprint?: string;
  importOperationId?: string;
  mediaFiles: ExtractedMediaFile[];
  importSummary?: ImportSummary;
  selectedSenders: string[];
  selectedMediaTypes: MediaTypeSelection;
  selectedFileIds: ReadonlySet<string>;
  pendingSaveIds?: readonly string[];
  progress?: ProcessingProgress;
  completion?: CompletionSummary;
  error?: PipelineError;
  setStage: (stage: PipelineStage) => void;
  openOverlayStage: (stage: 'settings' | 'history') => void;
  closeOverlayStage: (fallback?: PipelineStage) => void;
  setZip: (zip: { uri: string; name: string }) => void;
  setImportResult: (result: {
    workingDirectory: string;
    archiveFingerprint: string;
    operationId: string;
    mediaFiles: ExtractedMediaFile[];
    importSummary: ImportSummary;
  }) => void;
  toggleSender: (sender: string) => void;
  toggleMediaType: (mediaType: MediaType) => void;
  toggleFile: (fileId: string) => void;
  selectFiles: (fileIds: string[]) => void;
  clearFiles: (fileIds: string[]) => void;
  setSelectedFiles: (selection: ReadonlySet<string>) => void;
  prepareSave: (fileIds: readonly string[]) => void;
  setProgress: (progress: ProcessingProgress) => void;
  startProgress: (operationId: string, kind: 'import' | 'save') => void;
  setCompletion: (completion: CompletionSummary) => void;
  setError: (error: unknown) => void;
  clearError: () => void;
  reset: () => void;
};

const defaultMediaTypeSelection: MediaTypeSelection = {
  photo: true,
  video: true,
  voice: true,
  audio: true,
  sticker: true,
  gif: true,
  document: true,
  unknown: false
};

export const usePipelineStore = create<PipelineState>((set) => ({
  stage: 'welcome',
  mediaFiles: [],
  selectedSenders: [],
  selectedMediaTypes: defaultMediaTypeSelection,
  selectedFileIds: new Set(),
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
  setImportResult: ({ workingDirectory, archiveFingerprint, operationId, mediaFiles, importSummary }) =>
    set(() => {
      return {
        workingDirectory,
        archiveFingerprint,
        importOperationId: operationId,
        mediaFiles,
        importSummary,
        selectedSenders: Array.from(new Set(mediaFiles.map(getMediaSender))),
        selectedMediaTypes: { ...defaultMediaTypeSelection },
        selectedFileIds: new Set(mediaFiles.filter((file) => isSaveableMediaType(file.mediaType)).map((file) => file.id)),
        pendingSaveIds: undefined,
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
      const selectedFileIds = toggleId(state.selectedFileIds, fileId);
      logger.debug('fileSelectionChanged', { fileId, selected: selectedFileIds.has(fileId) });
      return { selectedFileIds };
    }),
  selectFiles: (fileIds) =>
    set((state) => {
      const selectedFileIds = setIdsSelected(state.selectedFileIds, fileIds, true);
      logger.debug('Select all visible files', { added: fileIds.length, selectedCount: selectedFileIds.size });
      return { selectedFileIds };
    }),
  clearFiles: (fileIds) =>
    set((state) => {
      const selectedFileIds = setIdsSelected(state.selectedFileIds, fileIds, false);
      logger.debug('Clear visible files', { cleared: fileIds.length, selectedCount: selectedFileIds.size });
      return { selectedFileIds };
    }),
  setSelectedFiles: (selection) => set((state) => ({ selectedFileIds: selection.size === state.selectedFileIds.size && [...selection].every((id) => state.selectedFileIds.has(id)) ? state.selectedFileIds : new Set(selection) })),
  prepareSave: (fileIds) => set((state) => {
    const eligible = new Set(state.mediaFiles.filter((file) => isSaveableMediaType(file.mediaType)).map((file) => file.id));
    return { pendingSaveIds: [...new Set(fileIds)].filter((id) => state.selectedFileIds.has(id) && eligible.has(id)), stage: 'outputOptions' };
  }),
  setProgress: (progress) => set((state) => ({ progress: reduceProgress(state.progress ?? null, progress) })),
  startProgress: (operationId, kind) => set({ progress: startOperation(operationId, kind) }),
  setCompletion: (completion) => set({ completion, stage: 'results' }),
  setError: (error) => set({ error: asPipelineError(error), stage: 'error' }),
  clearError: () => set({ error: undefined }),
  reset: () =>
    set({
      stage: 'welcome',
      overlayReturnStage: undefined,
      zipUri: undefined,
      zipName: undefined,
      workingDirectory: undefined,
      archiveFingerprint: undefined,
      importOperationId: undefined,
      mediaFiles: [],
      importSummary: undefined,
      selectedSenders: [],
      selectedMediaTypes: defaultMediaTypeSelection,
      selectedFileIds: new Set(),
      pendingSaveIds: undefined,
      progress: undefined,
      completion: undefined,
      error: undefined
    })
}));

function isOverlayStage(stage: PipelineStage): stage is 'settings' | 'history' {
  return stage === 'settings' || stage === 'history';
}
