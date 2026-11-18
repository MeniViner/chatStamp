export type OperationPhase = 'preparing' | 'extracting' | 'saving' | 'completed' | 'cancelled' | 'failed';

export type OperationProgress = {
  operationId: string;
  kind: 'import' | 'save';
  phase: OperationPhase;
  filesDone: number;
  totalFiles: number | null;
  bytesDone: number;
  totalBytes: number | null;
  currentFileName: string | null;
};

export function isTerminalProgress(progress: OperationProgress): boolean {
  return progress.phase === 'completed' || progress.phase === 'cancelled' || progress.phase === 'failed';
}

export function startOperation(operationId: string, kind: OperationProgress['kind'] = 'import'): OperationProgress {
  return { operationId, kind, phase: 'preparing', filesDone: 0, totalFiles: null, bytesDone: 0, totalBytes: null, currentFileName: null };
}

export function createOperationId(kind: 'import' | 'save'): string {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function reduceProgress(current: OperationProgress | null, event: OperationProgress): OperationProgress {
  if (current && (current.operationId !== event.operationId || isTerminalProgress(current))) return current;
  const filesDone = Math.max(current?.filesDone ?? 0, nonnegative(event.filesDone));
  const bytesDone = Math.max(current?.bytesDone ?? 0, nonnegative(event.bytesDone));
  return {
    ...event,
    filesDone,
    bytesDone,
    totalFiles: knownTotal(event.totalFiles, current?.totalFiles, filesDone),
    totalBytes: knownTotal(event.totalBytes, current?.totalBytes, bytesDone)
  };
}

export function progressFraction(progress: OperationProgress): number | null {
  if (progress.phase === 'completed') return 1;
  if (progress.totalBytes !== null && progress.totalBytes > 0) return Math.min(1, progress.bytesDone / progress.totalBytes);
  if (progress.totalFiles !== null && progress.totalFiles > 0) return Math.min(1, progress.filesDone / progress.totalFiles);
  return null;
}

function nonnegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function knownTotal(value: number | null, previous: number | null | undefined, done: number): number | null {
  const total = value ?? previous;
  return typeof total === 'number' && Number.isFinite(total) && total >= done ? total : null;
}
