import { getChatStampNativeModule, type NativeZipExtractionResult } from './chatStampNativeModule';
import type { OperationProgress } from '../lib/operationProgress';
import { asPipelineError, PipelineError } from '../lib/pipelineErrors';

export async function extractSupportedZipEntries(
  zipUri: string,
  outputDirectoryUri: string,
  operationId: string,
  onProgress?: (progress: OperationProgress) => void
): Promise<NativeZipExtractionResult> {
  const native = getChatStampNativeModule();
  const subscription = native.addListener('onImportProgress', (event) => {
    if (event.operationId === operationId) onProgress?.(event);
  });
  try {
    return await native.extractSupportedZipEntriesAsync(zipUri, outputDirectoryUri, operationId);
  } catch (error) {
    const snapshot = await native.getOperationSnapshotAsync().catch(() => null);
    if (snapshot?.progress.operationId === operationId && snapshot.error) {
      throw new PipelineError(snapshot.error.code, snapshot.error.message, snapshot.error.missingBytes);
    }
    throw asPipelineError(error);
  } finally {
    subscription.remove();
  }
}
