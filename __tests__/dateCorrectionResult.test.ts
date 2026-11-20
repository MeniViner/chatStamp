import { describe, expect, it } from 'vitest';
import { getResultStatusKey } from '../src/screens/resultsLogic';
import type { SaveFileResult } from '../src/types/media';

function row(overrides: Partial<SaveFileResult>): SaveFileResult {
  return { filename: 'photo.jpg', ok: true, dateCorrectionVerified: false, galleryMaySortByImportTime: false, ...overrides };
}

describe('save outcome and date verification', () => {
  it('does not show a skipped item as failed or as a new date fix', () => {
    expect(getResultStatusKey(row({ outcome: 'skipped', dateCorrectionVerified: true }))).toBe('results.status.alreadySaved');
  });

  it('distinguishes preserved capture dates from restored message dates', () => {
    expect(getResultStatusKey(row({ timestampSource: 'capture', dateVerification: 'verified' }))).toBe('results.status.capturePreserved');
    expect(getResultStatusKey(row({ timestampSource: 'chat', dateCorrectionVerified: true, dateVerification: 'verified' }))).toBe('results.status.dateFixed');
  });

  it('reports index verification limits even when the file was saved', () => {
    expect(getResultStatusKey(row({ dateVerification: 'mtime-only' }))).toBe('results.status.modificationTime');
    expect(getResultStatusKey(row({ dateVerification: 'unverified' }))).toBe('results.status.dateUnverified');
    expect(getResultStatusKey(row({ verificationReason: 'date-unavailable' }))).toBe('results.status.dateUnavailable');
  });
});
