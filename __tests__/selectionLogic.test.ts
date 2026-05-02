import { describe, expect, it } from 'vitest';
import {
  clearVisibleFiles,
  countSelectedSaveableFiles,
  selectAllVisibleFiles,
  toggleFileSelection,
  toggleMediaTypeSelection,
  toggleSenderSelection
} from '../src/store/selectionLogic';
import type { ExtractedMediaFile, MediaTypeSelection } from '../src/types/media';

const defaultTypes: MediaTypeSelection = {
  photo: true,
  video: true,
  voice: false,
  audio: false,
  sticker: false,
  gif: false,
  document: false,
  unknown: false
};

describe('selectionLogic', () => {
  it('toggles senders immutably', () => {
    const selected = ['Avi'];
    const added = toggleSenderSelection(selected, 'Dana');
    const removed = toggleSenderSelection(added, 'Avi');

    expect(selected).toEqual(['Avi']);
    expect(added).toEqual(['Avi', 'Dana']);
    expect(removed).toEqual(['Dana']);
  });

  it('toggles media types immutably', () => {
    const toggled = toggleMediaTypeSelection(defaultTypes, 'photo');

    expect(defaultTypes.photo).toBe(true);
    expect(toggled.photo).toBe(false);
  });

  it('counts only selected saveable photo and video files', () => {
    const files: ExtractedMediaFile[] = [
      {
        id: '1',
        filename: 'a.jpg',
        normalizedFilename: 'a.jpg',
        uri: 'file:///a.jpg',
        mediaType: 'photo',
        matchedRecord: {
          id: 'r1',
          filename: 'a.jpg',
          normalizedFilename: 'a.jpg',
          sender: 'Avi',
          messageDateIso: '2025-01-01T00:00:00.000Z',
          rawLine: ''
        }
      },
      {
        id: '2',
        filename: 'b.opus',
        normalizedFilename: 'b.opus',
        uri: 'file:///b.opus',
        mediaType: 'voice',
        matchedRecord: {
          id: 'r2',
          filename: 'b.opus',
          normalizedFilename: 'b.opus',
          sender: 'Avi',
          messageDateIso: '2025-01-01T00:00:00.000Z',
          rawLine: ''
        }
      }
    ];

    expect(countSelectedSaveableFiles(files, ['Avi'], defaultTypes)).toBe(1);
  });

  it('toggles individual file selection', () => {
    expect(toggleFileSelection(['1'], '2')).toEqual(['1', '2']);
    expect(toggleFileSelection(['1', '2'], '1')).toEqual(['2']);
  });

  it('selects and clears visible files', () => {
    expect(selectAllVisibleFiles(['1'], ['1', '2', '3'])).toEqual(['1', '2', '3']);
    expect(clearVisibleFiles(['1', '2', '3'], ['2', '3'])).toEqual(['1']);
  });
});
