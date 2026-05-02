export function normalizeFilename(filename: string): string {
  return filename
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .trim()
    .split(/[\\/]/)
    .pop()!
    .toLowerCase();
}

export function getExtension(filename: string): string {
  const clean = normalizeFilename(filename);
  const lastDot = clean.lastIndexOf('.');
  return lastDot === -1 ? '' : clean.slice(lastDot + 1);
}
