import { describe, expect, it } from 'vitest';
import { buildSaveSummary } from '../src/services/saveSummary';

describe('buildSaveSummary', () => {
  it('counts saved and date-corrected files', () => {
    expect(
      buildSaveSummary({
        totalFiles: 10,
        selectedFiles: 3,
        saved: 3,
        failed: 0,
        dateCorrected: 3,
        cacheCleared: true
      })
    ).toMatchObject({
      saved: 3,
      skipped: 7,
      dateCorrected: 3,
      dateCorrectionFailed: 0,
      mayShowImportTime: 0
    });
  });

  it('counts saved files whose date correction failed', () => {
    expect(
      buildSaveSummary({
        totalFiles: 5,
        selectedFiles: 2,
        saved: 2,
        failed: 0,
        dateCorrected: 1,
        cacheCleared: true
      })
    ).toMatchObject({
      saved: 2,
      dateCorrected: 1,
      dateCorrectionFailed: 1,
      mayShowImportTime: 1
    });
  });

  it('counts Termux Parity diagnostics separately from MP4 metadata', () => {
    expect(
      buildSaveSummary({
        totalFiles: 4,
        selectedFiles: 2,
        saved: 2,
        copied: 2,
        failed: 0,
        filesystemTimestampFixed: 2,
        exifFixed: 1,
        mp4MetadataFixed: 0,
        scanned: 2,
        dateCorrected: 2,
        cacheCleared: true
      })
    ).toMatchObject({
      copied: 2,
      filesystemTimestampFixed: 2,
      exifFixed: 1,
      mp4MetadataFixed: 0,
      scanned: 2,
      dateCorrectionFailed: 0
    });
  });
});
