import { describe, expect, it } from 'vitest';
import {
  getResultStatusLabel,
  getSavedHeadline,
  getSingularMediaTypeLabel,
  isSaveableMediaType,
  shortenPath
} from '../src/lib/mediaUi';
import type { SaveFileResult } from '../src/types/media';

describe('mediaUi', () => {
  it('maps JPG results to photo wording, never video wording', () => {
    const result: SaveFileResult = {
      filename: 'IMG-20250101-WA0001.jpg',
      ok: true,
      mediaType: 'photo',
      filesystemTimestampFixed: true,
      mediaScannerCompleted: true,
      dateCorrectionVerified: true,
      galleryMaySortByImportTime: false
    };

    expect(getSingularMediaTypeLabel(result.mediaType)).toBe('Photo');
    expect(getResultStatusLabel(result)).toBe('Date fixed');
    expect(`${getSingularMediaTypeLabel(result.mediaType)} ${getResultStatusLabel(result)}`).not.toContain('Video saved');
  });

  it('allows all file categories to be saved to organized folders', () => {
    expect(isSaveableMediaType('photo')).toBe(true);
    expect(isSaveableMediaType('video')).toBe(true);
    expect(isSaveableMediaType('voice')).toBe(true);
    expect(isSaveableMediaType('sticker')).toBe(true);
    expect(isSaveableMediaType('document')).toBe(true);
  });

  it('uses concise result headlines and shortened paths', () => {
    expect(getSavedHeadline({ saved: 2, dateCorrected: 2, failed: 0 })).toContain('original WhatsApp dates');
    expect(shortenPath('/storage/emulated/0/Pictures/chatStamp/Chat/IMG-1.jpg', 24)).toBe('...tStamp/Chat/IMG-1.jpg');
  });
});
