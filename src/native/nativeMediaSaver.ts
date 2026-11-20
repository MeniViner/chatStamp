import {
  getChatStampNativeModule,
  type NativeSaveMediaItem,
  type ScopedSaveOptions,
  type NativeSaveMediaResult
} from './chatStampNativeModule';
import type { OperationProgress } from '../lib/operationProgress';
import { asPipelineError, PipelineError } from '../lib/pipelineErrors';

export async function saveMediaNative(
  items: NativeSaveMediaItem[], options: ScopedSaveOptions, onProgress?: (progress: OperationProgress) => void
): Promise<NativeSaveMediaResult> {
  const native = getChatStampNativeModule();
  const subscription = native.addListener('onSaveProgress', (event) => {
    if (event.operationId === options.operationId) onProgress?.(event);
  });
  try {
    return await native.saveMediaAsync(items, options);
  } catch (error) {
    const snapshot = await native.getOperationSnapshotAsync().catch(() => null);
    if (snapshot?.progress.operationId === options.operationId && snapshot.error) {
      throw new PipelineError(snapshot.error.code, snapshot.error.message, snapshot.error.missingBytes);
    }
    throw asPipelineError(error);
  } finally {
    subscription.remove();
  }
}
