import type { MediaType, SaveFileResult } from '../types/media';

export const MAX_SHARE_FILES = 100;

export class ShareLimitError extends Error {
  constructor(readonly count: number) {
    super('The selected files exceed the share request limit.');
    this.name = 'ShareLimitError';
  }
}

export function selectShareableOutputFiles(results: readonly SaveFileResult[], categories: readonly MediaType[]): SaveFileResult[] {
  const selected = new Set(categories);
  return results.filter((result) => result.ok && result.mediaType && selected.has(result.mediaType));
}
