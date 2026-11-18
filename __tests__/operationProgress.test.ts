import { describe, expect, it } from 'vitest';
import {
  progressFraction,
  reduceProgress,
  startOperation,
  type OperationProgress
} from '../src/lib/operationProgress';

function progress(overrides: Partial<OperationProgress> = {}): OperationProgress {
  return {
    operationId: 'import-one',
    kind: 'import',
    phase: 'extracting',
    filesDone: 0,
    totalFiles: null,
    bytesDone: 0,
    totalBytes: null,
    currentFileName: null,
    ...overrides
  };
}

describe('real native operation progress', () => {
  it('starts an explicit operation with unknown totals and no invented work', () => {
    expect(startOperation('import-one')).toEqual(progress({ phase: 'preparing' }));
    expect(startOperation('save-one', 'save')).toEqual(progress({
      operationId: 'save-one', kind: 'save', phase: 'preparing'
    }));
  });

  it('accepts the first native event and preserves unknown totals', () => {
    const event = progress({ filesDone: 2, bytesDone: 4096, currentFileName: 'video.mp4' });
    expect(reduceProgress(null, event)).toEqual(event);
    expect(progressFraction(event)).toBeNull();
  });

  it('uses actual counts when a total becomes known', () => {
    const next = reduceProgress(startOperation('import-one'), progress({
      filesDone: 2, totalFiles: 8, bytesDone: 250, totalBytes: 1000
    }));
    expect(next.filesDone).toBe(2);
    expect(next.bytesDone).toBe(250);
    expect(progressFraction(next)).toBe(0.25);
  });

  it('can show real file progress when only the file total is known', () => {
    expect(progressFraction(progress({ filesDone: 3, totalFiles: 12, bytesDone: 200 }))).toBe(0.25);
    expect(progressFraction(progress({ filesDone: 0, totalFiles: 0, bytesDone: 0, totalBytes: 0 }))).toBeNull();
  });

  it('ignores events from another operation until an explicit reset', () => {
    const current = progress({ filesDone: 3, bytesDone: 900 });
    const other = progress({ operationId: 'other-import', filesDone: 50, bytesDone: 50_000 });
    expect(reduceProgress(current, other)).toEqual(current);
    expect(reduceProgress(startOperation('other-import'), other)).toEqual(other);
  });

  it('does not regress counters when an older event arrives', () => {
    const current = progress({ filesDone: 4, totalFiles: 10, bytesDone: 800, totalBytes: 2000 });
    const next = reduceProgress(current, progress({
      filesDone: 2, totalFiles: 10, bytesDone: 300, totalBytes: 2000
    }));
    expect(next.filesDone).toBe(4);
    expect(next.bytesDone).toBe(800);
    expect(progressFraction(next)).toBe(0.4);
  });

  it('keeps established totals if a later event has unknown totals', () => {
    const current = progress({ filesDone: 1, totalFiles: 5, bytesDone: 100, totalBytes: 1000 });
    const next = reduceProgress(current, progress({ filesDone: 2, bytesDone: 200 }));
    expect(next).toMatchObject({ filesDone: 2, bytesDone: 200, totalFiles: 5, totalBytes: 1000 });
    expect(progressFraction(next)).toBe(0.2);
  });

  it.each(['completed', 'cancelled', 'failed'] as const)('never reopens a %s operation', (phase) => {
    const terminal = progress({ phase, filesDone: 4, totalFiles: 5, bytesDone: 800, totalBytes: 1000 });
    expect(reduceProgress(terminal, progress({ filesDone: 5, bytesDone: 1000 }))).toEqual(terminal);
    expect(reduceProgress(terminal, progress({ phase: 'completed', filesDone: 5 }))).toEqual(terminal);
  });

  it('retains the terminal event even when no previous progress was observed', () => {
    const terminal = progress({ phase: 'cancelled', filesDone: 2, totalFiles: 8, bytesDone: 512 });
    expect(reduceProgress(null, terminal)).toEqual(terminal);
  });

  it('keeps cancelled and failed counts separate from completed files', () => {
    const current = progress({ kind: 'save', operationId: 'save-one', phase: 'saving', filesDone: 2, totalFiles: 5 });
    expect(reduceProgress(current, { ...current, phase: 'cancelled' })).toMatchObject({
      phase: 'cancelled', filesDone: 2, totalFiles: 5
    });
    expect(progressFraction(current)).toBe(0.4);
  });
});
