import { getChatStampNativeModule } from '../native/chatStampNativeModule';
import type { HistoryStorage } from '../services/historyService';

export const atomicStore: HistoryStorage = {
  read: (name) => getChatStampNativeModule().readStoreFileAsync(name),
  writeAtomic: (name, contents) => getChatStampNativeModule().writeStoreFileAtomicAsync(name, contents),
  list: (prefix) => getChatStampNativeModule().listStoreFilesAsync(prefix),
  remove: (name) => getChatStampNativeModule().deleteStoreFileAsync(name)
};

export async function readJsonFile<T>(name: string): Promise<T | null> {
  const text = await atomicStore.read(name);
  return text === null ? null : JSON.parse(text) as T;
}

export async function writeJsonFile(name: string, value: unknown): Promise<void> {
  await atomicStore.writeAtomic(name, JSON.stringify(value));
}

export async function deleteJsonFile(name: string): Promise<void> {
  await atomicStore.remove(name);
}
