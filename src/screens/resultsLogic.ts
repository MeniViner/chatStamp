import type { CompletionSummary, SaveFileResult } from '../types/media';

export function isMessageDateVerified(result: SaveFileResult): boolean {
  return result.ok && result.dateCorrectionVerified && result.dateAmbiguous !== true
    && result.dateVerification !== 'unverified' && result.dateVerification !== 'mtime-only'
    && result.verificationReason !== 'date-unavailable';
}

export type CompletionPresentation = {
  status: 'success' | 'cancelled' | 'partial' | 'failed' | 'skipped' | 'empty';
  savedCount: number;
  cancelledCount: number;
  failedCount: number;
  resultCount: number;
  dateVerifiedCount: number;
  titleKey: string;
  summaryKey: string;
  summaryValues: Record<string, number>;
};

export function completionPresentation(completion?: CompletionSummary): CompletionPresentation {
  const rows = completion?.results ?? [];
  const savedRows = rows.filter((result) => result.ok && (result.outcome === 'saved' || result.outcome === undefined));
  const savedCount = rows.length > 0 ? savedRows.length : completion?.saved ?? 0;
  const cancelledCount = Math.max(completion?.cancelled ?? 0, rows.filter((result) => result.outcome === 'cancelled').length);
  const failedCount = Math.max(completion?.failed ?? 0, rows.filter((result) =>
    result.outcome === 'failed' || (!result.ok && result.outcome !== 'cancelled' && result.outcome !== 'skipped')
  ).length);
  const dateVerifiedCount = rows.length > 0
    ? savedRows.filter(isMessageDateVerified).length
    : Math.min(savedCount, completion?.dateCorrected ?? 0);
  const resultCount = rows.length > 0 ? rows.length : savedCount + cancelledCount + failedCount;
  const counts = { savedCount, cancelledCount, failedCount, resultCount, dateVerifiedCount,
    summaryValues: { saved: savedCount, cancelled: cancelledCount, failed: failedCount, verified: dateVerifiedCount } };

  const summaryKey = 'results.summaryCounts';
  if (!completion) return { ...counts, status: 'empty', titleKey: 'results.title', summaryKey };
  if (cancelledCount > 0) return { ...counts, status: savedCount > 0 ? 'partial' : 'cancelled',
    titleKey: savedCount > 0 ? 'results.partialSaveTitle' : 'results.cancelledTitle', summaryKey };
  if (failedCount > 0) return { ...counts, status: savedCount > 0 ? 'partial' : 'failed',
    titleKey: savedCount > 0 ? 'results.savedWithIssues' : 'results.headlineNoneSaved', summaryKey };
  if (rows.length > 0 && rows.every((result) => result.outcome === 'skipped')) {
    return { ...counts, status: 'skipped', titleKey: 'results.headlineAlreadySaved', summaryKey };
  }
  return { ...counts, status: savedCount > 0 ? 'success' : 'empty',
    titleKey: savedCount > 0 ? 'results.successTitle' : 'results.headlineNoneSaved', summaryKey };
}

export function getResultStatusKey(result: SaveFileResult): string {
  if (result.outcome === 'skipped') return 'results.status.alreadySaved';
  if (result.outcome === 'cancelled') return 'results.status.cancelled';
  if (!result.ok) return 'results.status.failed';
  if (isMessageDateVerified(result)) return 'results.status.dateFixed';
  if (result.verificationReason === 'date-unavailable') return 'results.status.dateUnavailable';
  if (result.timestampSource === 'capture' && result.dateVerification === 'verified' && !result.dateAmbiguous) return 'results.status.capturePreserved';
  if (result.dateAmbiguous || result.timestampSource === 'filename' || result.timestampSource === 'zip-entry') return 'results.status.approximateDate';
  if (result.dateVerification === 'mtime-only') return 'results.status.modificationTime';
  if (result.dateVerification === 'verified') return 'results.status.dateUnverified';
  if (result.dateVerification === 'unverified') return 'results.status.dateUnverified';
  if (result.filesystemTimestampFixed && !result.mediaScannerCompleted) return 'results.status.scanPending';
  if (result.galleryMaySortByImportTime) return 'results.status.mayShowImportTime';
  return 'results.status.saved';
}

export function getResultRowKey(result: Pick<SaveFileResult, 'filename' | 'outputPath' | 'insertedUri' | 'failureReason'>, index: number): string {
  return `${result.filename}-${result.outputPath ?? result.insertedUri ?? result.failureReason ?? index}`;
}
