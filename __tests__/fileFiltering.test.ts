import { describe, expect, it } from 'vitest';
import { filterVisibleFiles, getVisibleSaveableFileIds } from '../src/store/fileFiltering';
import { clearVisibleFiles, selectAllVisibleFiles } from '../src/store/selectionLogic';
import type { ExtractedMediaFile, MediaType, MediaTypeSelection } from '../src/types/media';

const selectedTypes: MediaTypeSelection = {
  photo: true,
  video: true,
  voice: true,
  audio: false,
  sticker: false,
  gif: false,
  document: true,
  unknown: false
};

function file(id: string, filename: string, mediaType: MediaType, sender: string): ExtractedMediaFile {
  return {
    id,
    filename,
    normalizedFilename: filename.toLowerCase(),
    uri: `file:///${filename}`,
    mediaType,
    matchedRecord: {
      id: `record-${id}`,
      filename,
      normalizedFilename: filename.toLowerCase(),
      sender,
      messageDateIso: '2025-01-01T12:00:00.000Z',
      rawLine: ''
    }
  };
}

describe('fileFiltering', () => {
  const files = [
    file('1', 'IMG-1.jpg', 'photo', 'Avi'),
    file('2', 'VID-1.mp4', 'video', 'Avi'),
    file('3', 'PTT-1.opus', 'voice', 'Avi'),
    file('4', 'DOC-1.pdf', 'document', 'Dana')
  ];

  it('selects and clears only currently visible saveable files', () => {
    const visible = filterVisibleFiles({
      files,
      selectedSenders: ['Avi', 'Dana'],
      selectedMediaTypes: selectedTypes,
      query: '1',
      category: 'all'
    });

    expect(visible.map((item) => item.id)).toEqual(['1', '2', '3', '4']);
    expect(getVisibleSaveableFileIds(visible)).toEqual(['1', '2', '3', '4']);
    expect(selectAllVisibleFiles(['existing'], getVisibleSaveableFileIds(visible))).toEqual(['existing', '1', '2', '3', '4']);
    expect(clearVisibleFiles(['existing', '1', '2', 'hidden'], ['1', '2'])).toEqual(['existing', 'hidden']);
  });

  it('keeps manual selections stable when filters change', () => {
    const selected = ['1', '2'];
    const visibleAfterSearch = filterVisibleFiles({
      files,
      selectedSenders: ['Avi', 'Dana'],
      selectedMediaTypes: selectedTypes,
      query: 'DOC',
      category: 'all'
    });

    expect(visibleAfterSearch.map((item) => item.id)).toEqual(['4']);
    expect(selected).toEqual(['1', '2']);
  });

  it('keeps categories visible even when they are not selected for saving by default', () => {
    const visible = filterVisibleFiles({
      files,
      selectedSenders: ['Avi', 'Dana'],
      selectedMediaTypes: { ...selectedTypes, voice: false, document: false },
      query: '',
      category: 'all'
    });

    expect(visible.map((item) => item.id)).toEqual(['1', '2', '3', '4']);
  });
});
