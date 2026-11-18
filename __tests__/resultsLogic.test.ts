import { describe, expect, it } from 'vitest';
import {
  getResultRowKey,
  getResultStatusKey
} from '../src/screens/resultsLogic';
import type { SaveFileResult } from '../src/types/media';

describe('resultsLogic', () => {
  it('maps result rows to stable status keys', () => {
    const failed: SaveFileResult = {
      filename: 'bad.mp4',
      ok: false,
      failureReason: 'copy failed',
      dateCorrectionVerified: false,
      galleryMaySortByImportTime: true
    };
    const fixed: SaveFileResult = {
      filename: 'good.jpg',
      ok: true,
      filesystemTimestampFixed: true,
      mediaScannerCompleted: true,
      dateCorrectionVerified: true,
      galleryMaySortByImportTime: false
    };

    expect(getResultStatusKey(failed)).toBe('results.status.failed');
    expect(getResultStatusKey(fixed)).toBe('results.status.dateFixed');
  });

  it('keeps stable distinct keys for actual virtualized saved rows', () => {
    const rows: SaveFileResult[] = [
      { filename: 'a.jpg', ok: true, outputPath: '/Pictures/chat/a.jpg', dateCorrectionVerified: true, galleryMaySortByImportTime: false },
      { filename: 'b.mp4', ok: true, insertedUri: 'content://media/video/1', dateCorrectionVerified: true, galleryMaySortByImportTime: false }
    ];
    const keys = rows.map(getResultRowKey);

    expect(new Set(keys).size).toBe(2);
    expect(rows.map(getResultRowKey)).toEqual(keys);
  });
});
