import type { CompletionSummary, SaveFileResult } from '../types/media';

export function getResultsHeadlineKey(completion?: CompletionSummary): string {
  if (!completion) return 'results.title';
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
