import {
  getChatStampNativeModule,
  type NativeShareIntentDebugStatus,
  type NativeSharedZipResult
} from './chatStampNativeModule';

export async function getPendingSharedZip(): Promise<NativeSharedZipResult> {
  return getChatStampNativeModule().consumePendingSharedZipAsync();
}

export async function getShareIntentDebugStatus(): Promise<NativeShareIntentDebugStatus> {
  return getChatStampNativeModule().getShareIntentDebugStatusAsync();
}
