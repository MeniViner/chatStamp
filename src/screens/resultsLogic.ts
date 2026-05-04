import type { CompletionSummary, SaveFileResult } from '../types/media';

export function getResultsHeadlineKey(completion?: CompletionSummary): string {
  if (!completion) return 'results.title';
  if (completion.saved > 0 && completion.dateCorrected === completion.saved && completion.failed === 0) {
    return 'results.headlineAllGood';
  }
  if (completion.saved > 0) return 'results.headlineIssues';
  return 'results.headlineNoneSaved';
}

export function getResultStatusKey(result: SaveFileResult): string {
  if (!result.ok) return result.failureReason ? 'results.status.failedWithReason' : 'results.status.failed';
  if (result.filesystemTimestampFixed && result.mediaScannerCompleted && !result.galleryMaySortByImportTime) {
    return 'results.status.dateFixed';
  }
  if (result.filesystemTimestampFixed) return 'results.status.scanPending';
  if (result.galleryMaySortByImportTime) return 'results.status.mayShowImportTime';
  return 'results.status.saved';
}

export function shouldShowTechnicalResults(developerMode: boolean): boolean {
  return developerMode;
}
