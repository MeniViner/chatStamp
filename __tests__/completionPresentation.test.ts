import { describe, expect, it } from 'vitest';
import { createInstance } from 'i18next';
import { completionPresentation, getResultStatusKey } from '../src/screens/resultsLogic';
import type { CompletionSummary, SaveFileResult } from '../src/types/media';
import en from '../src/i18n/locales/en.json';
import he from '../src/i18n/locales/he.json';

function saved(filename: string, verified = true): SaveFileResult {
  return {
    filename, ok: true, outcome: 'saved', mediaType: 'video',
    dateCorrectionVerified: verified, dateVerification: verified ? 'verified' : 'unverified',
    galleryMaySortByImportTime: !verified
  };
}

function cancelled(filename: string): SaveFileResult {
  return {
    filename, ok: false, outcome: 'cancelled', mediaType: 'video', failureReason: 'The operation was cancelled.',
    dateCorrectionVerified: false, galleryMaySortByImportTime: false
  };
}

function completion(overrides: Partial<CompletionSummary> = {}): CompletionSummary {
  return {
    saved: 4, cancelled: 20, skipped: 0, failed: 0, dateCorrected: 4, dateCorrectionFailed: 0,
    mayShowImportTime: 0, cacheCleared: false,
    results: [
      ...Array.from({ length: 4 }, (_, index) => saved(`saved-${index}.mp4`)),
      ...Array.from({ length: 20 }, (_, index) => cancelled(`cancelled-${index}.mp4`))
    ],
    ...overrides
  };
}

async function translated(presentation: ReturnType<typeof completionPresentation>, language: 'en' | 'he') {
  const i18n = createInstance();
  await i18n.init({
    lng: language, fallbackLng: 'en', resources: { en: { translation: en }, he: { translation: he } },
    interpolation: { escapeValue: false }
  });
  return {
    title: i18n.t(presentation.titleKey, presentation.summaryValues),
    summary: i18n.t(presentation.summaryKey, presentation.summaryValues)
  };
}

describe('truthful completion presentation', () => {
  it('reports the observed four saved and twenty cancelled instead of twenty-four saved', () => {
    expect(completionPresentation(completion())).toMatchObject({
      status: 'partial', savedCount: 4, cancelledCount: 20, failedCount: 0, resultCount: 24, dateVerifiedCount: 4,
      titleKey: 'results.partialSaveTitle', summaryKey: 'results.headlineCancelled',
      summaryValues: { saved: 4, cancelled: 20, failed: 0, verified: 4 }
    });
  });

  it('uses actual saved outcomes even if an aggregate incorrectly contains every result', () => {
    const presentation = completionPresentation(completion({ saved: 24, dateCorrected: 24 }));
    expect(presentation.savedCount).toBe(4);
    expect(presentation.dateVerifiedCount).toBe(4);
    expect(presentation.cancelledCount).toBe(20);
  });

  it('keeps already-saved skips separate from newly saved files and verified dates', () => {
    const source = completion();
    source.results?.push({ ...saved('already-saved.mp4'), outcome: 'skipped' });
    source.skipped = 1;
    const presentation = completionPresentation(source);
    expect(presentation).toMatchObject({ savedCount: 4, dateVerifiedCount: 4, cancelledCount: 20, resultCount: 25 });
  });

  it('does not report success when every selected item was cancelled', () => {
    const presentation = completionPresentation(completion({
      saved: 0, cancelled: 24, dateCorrected: 0,
      results: Array.from({ length: 24 }, (_, index) => cancelled(`cancelled-${index}.mp4`))
    }));
    expect(presentation).toMatchObject({
      status: 'cancelled', savedCount: 0, dateVerifiedCount: 0, cancelledCount: 24,
      titleKey: 'results.cancelledTitle', summaryKey: 'results.headlineCancelled'
    });
    expect(presentation.titleKey).not.toBe('results.successTitle');
  });

  it('reports mixed save failures without an all-success headline', () => {
    const failed: SaveFileResult = {
      filename: 'failed.mp4', ok: false, outcome: 'failed', failureReason: 'Output could not be written',
      dateCorrectionVerified: false, galleryMaySortByImportTime: false
    };
    const presentation = completionPresentation(completion({
      saved: 4, cancelled: 0, failed: 1,
      results: [...Array.from({ length: 4 }, (_, index) => saved(`saved-${index}.mp4`)), failed]
    }));
    expect(presentation).toMatchObject({ status: 'partial', savedCount: 4, cancelledCount: 0, failedCount: 1, resultCount: 5 });
    expect(presentation.titleKey).toBe('results.savedWithIssues');
    expect(presentation.summaryKey).toBe('results.headlineIssues');
  });

  it('does not use a saved-success title when every write failed', () => {
    const presentation = completionPresentation(completion({
      saved: 0, cancelled: 0, failed: 2, dateCorrected: 0,
      results: [0, 1].map((index) => ({ ...cancelled(`failed-${index}.mp4`), outcome: 'failed' as const }))
    }));
    expect(presentation).toMatchObject({ status: 'failed', savedCount: 0, failedCount: 2, summaryKey: 'results.headlineNoneSaved' });
    expect(presentation.titleKey).not.toBe('results.successTitle');
  });

  it('keeps an entirely skipped rerun distinct from a new successful save', () => {
    const presentation = completionPresentation(completion({
      saved: 0, cancelled: 0, skipped: 3, dateCorrected: 0,
      results: [0, 1, 2].map((index) => ({ ...saved(`existing-${index}.mp4`), outcome: 'skipped' as const }))
    }));
    expect(presentation).toMatchObject({ status: 'skipped', savedCount: 0, dateVerifiedCount: 0, resultCount: 3 });
    expect(presentation.summaryKey).toBe('results.headlineAlreadySaved');
  });

  it('permits a success presentation when all actual writes completed', () => {
    const presentation = completionPresentation(completion({
      saved: 5, cancelled: 0, dateCorrected: 5,
      results: Array.from({ length: 5 }, (_, index) => saved(`saved-${index}.mp4`))
    }));
    expect(presentation).toMatchObject({
      status: 'success', savedCount: 5, dateVerifiedCount: 5, cancelledCount: 0, failedCount: 0,
      titleKey: 'results.successTitle'
    });
  });

  it('does not turn saved-but-unverified dates into verified dates', () => {
    const presentation = completionPresentation(completion({
      saved: 1, cancelled: 0, dateCorrected: 0, dateCorrectionFailed: 1, mayShowImportTime: 1,
      results: [saved('unverified.mp4', false)]
    }));
    expect(presentation.savedCount).toBe(1);
    expect(presentation.dateVerifiedCount).toBe(0);
    expect(presentation.summaryKey).not.toBe('results.headlineAllGood');
  });

  it('counts legacy successful rows without an outcome as saved without inventing date verification', () => {
    const legacy = { ...saved('legacy.mp4', false), outcome: undefined };
    expect(completionPresentation(completion({ saved: 1, cancelled: 0, dateCorrected: 0, results: [legacy] })))
      .toMatchObject({ savedCount: 1, cancelledCount: 0, dateVerifiedCount: 0, resultCount: 1 });
  });

  it('retains truthful aggregate counts when per-file results are unavailable', () => {
    expect(completionPresentation(completion({ saved: 3, cancelled: 2, failed: 1, dateCorrected: 2, results: undefined })))
      .toMatchObject({ savedCount: 3, cancelledCount: 2, failedCount: 1, dateVerifiedCount: 2 });
  });

  it('does not claim a completed save before any completion exists', () => {
    expect(completionPresentation()).toMatchObject({
      status: 'empty', savedCount: 0, cancelledCount: 0, failedCount: 0, dateVerifiedCount: 0,
      titleKey: 'results.title', summaryKey: 'results.title'
    });
  });

  it('labels cancelled rows as cancelled even when native diagnostic text is present', () => {
    expect(getResultStatusKey(cancelled('cancelled.mp4'))).toBe('results.status.cancelled');
  });

  it.each(['en', 'he'] as const)('renders a one-line partial-cancellation summary with actual counts in %s', async (language) => {
    const presentation = completionPresentation(completion());
    const text = await translated(presentation, language);
    expect(text.summary).toContain('4');
    expect(text.summary).toContain('20');
    expect(text.summary).not.toContain('24');
    expect(text.summary).not.toMatch(/[\r\n]|\{\{|\}\}/);
    expect(text.summary).toMatch(language === 'en' ? /cancel/i : /בוטל/);
    expect(text.title).not.toBe(language === 'en' ? en.results.successTitle : he.results.successTitle);
    expect(text.summary).not.toBe(presentation.summaryKey);
  });

  it.each(['en', 'he'] as const)('renders an entirely cancelled operation without a false success claim in %s', async (language) => {
    const presentation = completionPresentation(completion({ saved: 0, cancelled: 24, dateCorrected: 0,
      results: Array.from({ length: 24 }, (_, index) => cancelled(`cancelled-${index}.mp4`)) }));
    const text = await translated(presentation, language);
    expect(text.summary).toContain('0');
    expect(text.summary).toContain('24');
    expect(text.title).toMatch(language === 'en' ? /cancel/i : /בוטל/);
    expect(text.summary).not.toMatch(/[\r\n]|\{\{|\}\}/);
    expect(text.title).not.toBe(language === 'en' ? en.results.successTitle : he.results.successTitle);
  });
});
