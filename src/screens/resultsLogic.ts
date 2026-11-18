import type { CompletionSummary, SaveFileResult } from '../types/media';

export function getResultsHeadlineKey(completion?: CompletionSummary): string {
  if (!completion) return 'results.title';
  const cancelled = Math.max(completion.cancelled ?? 0, completion.results?.filter((result) => result.outcome === 'cancelled').length ?? 0);
  if (cancelled > 0) return 'results.headlineCancelled';
  if (completion.results?.length && completion.results.every((result) => result.outcome === 'skipped')) {
    return 'results.headlineAlreadySaved';
  }
  if (completion.saved > 0 && completion.failed === 0 && completion.results?.every((result) => !result.galleryMaySortByImportTime)) {
    return 'results.headlineSaved';
  }
  if (completion.saved > 0 && completion.dateCorrected === completion.saved && completion.failed === 0) {
    return 'results.headlineAllGood';
  }
  if (completion.saved > 0) return 'results.headlineIssues';
  return 'results.headlineNoneSaved';
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
    ? savedRows.filter((result) => result.dateCorrectionVerified && result.dateAmbiguous !== true && result.dateVerification !== 'unverified'
      && result.dateVerification !== 'mtime-only' && result.verificationReason !== 'date-unavailable').length
    : Math.min(savedCount, completion?.dateCorrected ?? 0);
  const resultCount = rows.length > 0 ? rows.length : savedCount + cancelledCount + failedCount;
  const counts = { savedCount, cancelledCount, failedCount, resultCount, dateVerifiedCount,
    summaryValues: { saved: savedCount, cancelled: cancelledCount, failed: failedCount, verified: dateVerifiedCount } };

  if (!completion) return { ...counts, status: 'empty', titleKey: 'results.title', summaryKey: 'results.title' };
  const summaryKey = getResultsHeadlineKey({ ...completion, saved: savedCount, failed: failedCount,
    cancelled: cancelledCount, dateCorrected: dateVerifiedCount });
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
  if (!result.ok) return result.failureReason ? 'results.status.failedWithReason' : 'results.status.failed';
  if (result.timestampSource === 'capture' && result.dateVerification === 'verified') return 'results.status.capturePreserved';
  if (result.dateVerification === 'mtime-only') return 'results.status.modificationTime';
  if (result.verificationReason === 'date-unavailable') return 'results.status.dateUnavailable';
  if (result.dateCorrectionVerified) return 'results.status.dateFixed';
  if (result.dateVerification === 'verified') return 'results.status.dateVerified';
  if (result.dateVerification === 'unverified') return 'results.status.dateUnverified';
  if (result.filesystemTimestampFixed && !result.mediaScannerCompleted) return 'results.status.scanPending';
  if (result.galleryMaySortByImportTime) return 'results.status.mayShowImportTime';
  return 'results.status.saved';
}

export function shouldShowTechnicalResults(developerMode: boolean): boolean {
  return developerMode;
}

export function getResultRowKey(result: Pick<SaveFileResult, 'filename' | 'outputPath' | 'insertedUri' | 'failureReason'>, index: number): string {
  return `${result.filename}-${result.outputPath ?? result.insertedUri ?? result.failureReason ?? index}`;
}

export function expandAllResultRows(rowKeys: string[]): string[] {
  return Array.from(new Set(rowKeys));
}

export function collapseAllResultRows(): string[] {
  return [];
}

export function setResultRowExpanded(currentKeys: string[], rowKey: string, expanded: boolean): string[] {
  const next = new Set(currentKeys);
  if (expanded) next.add(rowKey);
  else next.delete(rowKey);
  return Array.from(next);
}
