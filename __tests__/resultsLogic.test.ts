import { describe, expect, it } from 'vitest';
import { getResultStatusKey, getResultsHeadlineKey, shouldShowTechnicalResults } from '../src/screens/resultsLogic';
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

    expect(getResultStatusKey(failed)).toBe('results.status.failedWithReason');
    expect(getResultStatusKey(fixed)).toBe('results.status.dateFixed');
  });

  it('keeps technical details out of production mode', () => {
    expect(shouldShowTechnicalResults(false)).toBe(false);
    expect(shouldShowTechnicalResults(true)).toBe(true);
  });
});
