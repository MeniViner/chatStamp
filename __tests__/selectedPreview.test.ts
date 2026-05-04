import { describe, expect, it } from 'vitest';
import { buildSelectedPreview } from '../src/store/selectedPreview';
import type { ExtractedMediaFile, MediaType, MediaTypeSelection } from '../src/types/media';

const selectedTypes: MediaTypeSelection = {
  photo: true,
  video: true,
  voice: true,
  audio: false,
  sticker: false,
  gif: false,
  document: false,
  unknown: false
};

function file(id: string, mediaType: MediaType, sender = 'Avi'): ExtractedMediaFile {
  return {
    id,
    filename: `${id}.${mediaType === 'video' ? 'mp4' : mediaType === 'voice' ? 'opus' : 'jpg'}`,
    normalizedFilename: id,
    uri: `file:///${id}`,
    mediaType,
    matchedRecord: {
      id: `record-${id}`,
      filename: id,
      normalizedFilename: id,
      sender,
      messageDateIso: '2025-01-01T12:00:00.000Z',
      rawLine: ''
    }
  };
}

describe('buildSelectedPreview', () => {
  it('summarizes selected photos, videos, and other files', () => {
    const summary = buildSelectedPreview(
      [file('photo-1', 'photo'), file('video-1', 'video'), file('voice-1', 'voice'), file('photo-2', 'photo', 'Dana')],
      ['Avi'],
      selectedTypes
    );

    expect(summary.matchedFiles).toBe(4);
    expect(summary.selectedFiles).toHaveLength(3);
    expect(summary.selectedPhotos).toBe(1);
    expect(summary.selectedVideos).toBe(1);
    expect(summary.selectedOther).toBe(1);
  });
});
