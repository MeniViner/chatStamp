const pipelineErrorCodes = [
  'NO_TRANSCRIPT', 'ZIP_INVALID', 'NO_SPACE', 'ARCHIVE_LIMIT', 'CANCELLED', 'PERMISSION_LOST', 'IO_ERROR'
] as const;

export type PipelineErrorCode = typeof pipelineErrorCodes[number];

export class PipelineError extends Error {
  constructor(readonly code: PipelineErrorCode, message?: string, readonly missingBytes?: number) {
    super(message ?? code);
    this.name = 'PipelineError';
  }
}

export function pipelineErrorCode(error: unknown): PipelineErrorCode {
  const value = typeof error === 'string' ? error
    : error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (typeof value !== 'string') return 'IO_ERROR';
  const code = value.replace(/^ERR_/, '');
  return pipelineErrorCodes.find((candidate) => candidate === code) ?? 'IO_ERROR';
}

export function asPipelineError(error: unknown): PipelineError {
  if (error instanceof PipelineError) return error;
  const missing = error && typeof error === 'object' && 'missingBytes' in error ? error.missingBytes : undefined;
  return new PipelineError(pipelineErrorCode(error), error instanceof Error ? error.message : undefined,
    typeof missing === 'number' && Number.isFinite(missing) && missing > 0 ? missing : undefined);
}

export function errorMessageKey(code: PipelineErrorCode): string {
  return `error.codes.${code}`;
}

export function isRetryAllowed(code: PipelineErrorCode, sourceReadable: boolean): boolean {
  return sourceReadable && code !== 'CANCELLED';
}
