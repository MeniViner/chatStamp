import type { CompletionSummary, SaveFileResult } from '../types/media';

export type SaveSummaryInput = {
  totalFiles: number;
  selectedFiles: number;
  saved: number;
  failed: number;
  dateCorrected: number;
  cacheCleared: boolean;
  results?: SaveFileResult[];
};

export function buildSaveSummary(input: SaveSummaryInput): CompletionSummary {
  const dateCorrectionFailed = Math.max(0, input.saved - input.dateCorrected);
  return {
    saved: input.saved,
    skipped: Math.max(0, input.totalFiles - input.selectedFiles),
    failed: input.failed,
    dateCorrected: input.dateCorrected,
    dateCorrectionFailed,
    mayShowImportTime: dateCorrectionFailed,
    cacheCleared: input.cacheCleared,
    results: input.results
  };
}
