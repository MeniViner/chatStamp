import { normalizeChatText } from './whatsappDate';

export function normalizeArchivePath(path: string): string {
  return normalizeChatText(path).trim().replace(/\\/g, '/').normalize('NFC').toLowerCase();
}

export function normalizeFilename(filename: string): string {
  return normalizeArchivePath(filename).split('/').pop() ?? '';
}

export function getExtension(filename: string): string {
  const clean = normalizeFilename(filename);
  const lastDot = clean.lastIndexOf('.');
  return lastDot === -1 ? '' : clean.slice(lastDot + 1);
}
