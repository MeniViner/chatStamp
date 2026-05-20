import { Directory, File, Paths } from 'expo-file-system';

const storageDirectoryName = 'chatstamp-store';

function storageFile(name: string): File {
  const directory = new Directory(Paths.document, storageDirectoryName);
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return new File(directory, name);
}

export async function readJsonFile<T>(name: string): Promise<T | null> {
  const file = storageFile(name);
  if (!file.exists) return null;
  return JSON.parse(await file.text()) as T;
}

export async function writeJsonFile(name: string, value: unknown): Promise<void> {
  const file = storageFile(name);
  if (!file.exists) file.create({ intermediates: true, overwrite: true });
  file.write(JSON.stringify(value));
}

export async function deleteJsonFile(name: string): Promise<void> {
  const file = storageFile(name);
  if (file.exists) file.delete();
}
