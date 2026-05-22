import { beforeEach, describe, expect, it } from 'vitest';
import { usePipelineStore } from '../src/store/pipelineStore';

describe('pipelineStore overlay navigation', () => {
  beforeEach(() => {
    usePipelineStore.getState().reset();
  });

  it('returns from settings to the previous in-app screen', () => {
    usePipelineStore.getState().setStage('selectFiles');
    usePipelineStore.getState().openOverlayStage('settings');

    expect(usePipelineStore.getState().stage).toBe('settings');

    usePipelineStore.getState().closeOverlayStage('welcome');
    expect(usePipelineStore.getState().stage).toBe('selectFiles');
  });

  it('returns from history to the import root when opened from root', () => {
    usePipelineStore.getState().openOverlayStage('history');
    expect(usePipelineStore.getState().stage).toBe('history');

    usePipelineStore.getState().closeOverlayStage('welcome');
    expect(usePipelineStore.getState().stage).toBe('welcome');
  });

  it('selects the transcript document by default when the ZIP has no media', () => {
    usePipelineStore.getState().setImportResult({
      workingDirectory: 'file:///cache/run/',
      importSummary: {
        chatRecords: 0,
        skippedChatLines: 1,
        extractedEntries: 1,
        skippedZipEntries: 0,
        matchedMedia: 0,
        unmatchedMedia: 0,
        senders: 1,
        photos: 0,
        videos: 0,
        voice: 0,
        stickers: 0,
        documents: 1,
        unknown: 0,
        extractionMode: 'native-selective'
      },
      mediaFiles: [
        {
          id: 'chat-transcript:_chat.txt',
          filename: '_chat.txt',
          normalizedFilename: '_chat.txt',
          uri: 'file:///cache/_chat.txt',
          mediaType: 'document',
          sourceKind: 'chat-transcript',
          matchedRecord: {
            id: 'chat-transcript:_chat.txt',
            filename: '_chat.txt',
            normalizedFilename: '_chat.txt',
            sender: 'Chat transcript',
            messageDateIso: '2026-05-22T00:00:00.000Z',
            rawLine: ''
          }
        }
      ]
    });

    const state = usePipelineStore.getState();
    expect(state.stage).toBe('selectFiles');
    expect(state.selectedFileIds).toEqual(['chat-transcript:_chat.txt']);
    expect(state.selectedMediaTypes.document).toBe(true);
  });
});
