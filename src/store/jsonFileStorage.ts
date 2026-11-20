import { getChatStampNativeModule } from '../native/chatStampNativeModule';
import type { HistoryStorage } from '../services/historyService';

export const atomicStore: HistoryStorage = {
  read: (name) => getChatStampNativeModule().readStoreFileAsync(name),
  writeAtomic: (name, contents) => getChatStampNativeModule().writeStoreFileAtomicAsync(name, contents),
  list: (prefix) => getChatStampNativeModule().listStoreFilesAsync(prefix),
  remove: (name) => getChatStampNativeModule().deleteStoreFileAsync(name)
};

export async function writeJsonFile(name: string, value: unknown): Promise<void> {
  await atomicStore.writeAtomic(name, JSON.stringify(value));
}
