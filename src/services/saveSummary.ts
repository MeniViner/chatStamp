import type { CompletionSummary, SaveFileResult } from '../types/media';

export type SaveSummaryInput = {
  totalFiles: number;
  selectedFiles: number;
  saved: number;
  copied?: number;
  failed: number;
  filesystemTimestampFixed?: number;
  exifFixed?: number;
  mp4MetadataFixed?: number;
  scanned?: number;
  dateCorrected: number;
  cacheCleared: boolean;
  results?: SaveFileResult[];
};

export function buildSaveSummary(input: SaveSummaryInput): CompletionSummary {
  const dateCorrectionFailed = Math.max(0, input.saved - input.dateCorrected);
  return {
    saved: input.saved,
    copied: input.copied ?? input.saved,
    skipped: Math.max(0, input.totalFiles - input.selectedFiles),
    failed: input.failed,
    filesystemTimestampFixed: input.filesystemTimestampFixed ?? input.dateCorrected,
    exifFixed: input.exifFixed ?? 0,
    mp4MetadataFixed: input.mp4MetadataFixed ?? 0,
    scanned: input.scanned ?? 0,
    dateCorrected: input.dateCorrected,
    dateCorrectionFailed,
    mayShowImportTime: dateCorrectionFailed,
    cacheCleared: input.cacheCleared,
    results: input.results
  };
}
