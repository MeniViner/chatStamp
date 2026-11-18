import {
  getChatStampNativeModule,
  type NativeSharedZipResult
} from './chatStampNativeModule';

export async function getPendingSharedZip(): Promise<NativeSharedZipResult> {
  return getChatStampNativeModule().consumePendingSharedZipAsync();
}
