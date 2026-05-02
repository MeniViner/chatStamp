import {
  getTimeFixerNativeModule,
  type NativeShareIntentDebugStatus,
  type NativeSharedZipResult
} from './timeFixerNativeModule';

export async function getPendingSharedZip(): Promise<NativeSharedZipResult> {
  return getTimeFixerNativeModule().consumePendingSharedZipAsync();
}

export async function getShareIntentDebugStatus(): Promise<NativeShareIntentDebugStatus> {
  return getTimeFixerNativeModule().getShareIntentDebugStatusAsync();
}
