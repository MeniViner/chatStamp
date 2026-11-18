import { describe, expect, it } from 'vitest';
import {
  collapseAllResultRows,
  expandAllResultRows,
  getResultRowKey,
  getResultStatusKey,
  getResultsHeadlineKey,
  setResultRowExpanded,
  shouldShowTechnicalResults
} from '../src/screens/resultsLogic';
import type { CompletionSummary, SaveFileResult } from '../src/types/media';

describe('resultsLogic', () => {
  it('chooses the correct completion headline key', () => {
    const allGood: CompletionSummary = {
      saved: 2,
      skipped: 0,
      failed: 0,
      dateCorrected: 2,
      dateCorrectionFailed: 0,
      mayShowImportTime: 0,
      cacheCleared: true
    };
    const partial: CompletionSummary = {
      saved: 1,
      skipped: 0,
      failed: 1,
      dateCorrected: 0,
      dateCorrectionFailed: 1,
      mayShowImportTime: 1,
      cacheCleared: true
    };

    expect(getResultsHeadlineKey(allGood)).toBe('results.headlineAllGood');
    expect(getResultsHeadlineKey(partial)).toBe('results.headlineIssues');
    expect(getResultsHeadlineKey()).toBe('results.title');
  });

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

  it('keeps technical details out of production mode', () => {
    expect(shouldShowTechnicalResults(false)).toBe(false);
    expect(shouldShowTechnicalResults(true)).toBe(true);
  });

  it('builds stable saved-row expansion state for expand and collapse all', () => {
    const rows: SaveFileResult[] = [
      { filename: 'a.jpg', ok: true, outputPath: '/Pictures/chat/a.jpg', dateCorrectionVerified: true, galleryMaySortByImportTime: false },
      { filename: 'b.mp4', ok: true, insertedUri: 'content://media/video/1', dateCorrectionVerified: true, galleryMaySortByImportTime: false }
    ];
    const keys = rows.map(getResultRowKey);

    expect(expandAllResultRows(keys)).toEqual(keys);
    expect(collapseAllResultRows()).toEqual([]);
    expect(setResultRowExpanded([], keys[0], true)).toEqual([keys[0]]);
    expect(setResultRowExpanded(keys, keys[0], false)).toEqual([keys[1]]);
  });
});
