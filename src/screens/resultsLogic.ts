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
