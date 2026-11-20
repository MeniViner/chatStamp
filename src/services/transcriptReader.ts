import { File } from 'expo-file-system';

const pageBytes = 32 * 1024;
const utf8Lookahead = 3;

export type TranscriptPage = Readonly<{
  text: string;
  offset: number;
  nextOffset: number | null;
  totalBytes: number;
}>;

/** Read only one bounded page from the already extracted local transcript. */
export async function readTranscriptPage(uri: string, offset = 0): Promise<TranscriptPage> {
  if (!uri.startsWith('file://') || !Number.isSafeInteger(offset) || offset < 0) {
    throw new RangeError('Invalid transcript location or offset.');
  }
  const file = new File(uri);
  if (!file.exists) throw new Error('Transcript is unavailable.');
  const handle = file.open();
  try {
    const totalBytes = handle.size;
    if (totalBytes === null || !Number.isSafeInteger(totalBytes) || totalBytes < 0 || offset > totalBytes) {
      throw new RangeError('Invalid transcript size or offset.');
    }
    handle.offset = offset;
    const wanted = Math.min(pageBytes + utf8Lookahead, totalBytes - offset);
    const bytes = new Uint8Array(wanted);
    let filled = 0;
    while (filled < wanted) {
      const part = handle.readBytes(wanted - filled);
      if (part.length === 0 || part.length > wanted - filled) throw new Error('Transcript changed during reading.');
      bytes.set(part, filled);
      filled += part.length;
    }
    // Include the remainder of the current UTF-8 code point, never half a Hebrew
    // letter or emoji. The next page starts at the first unconsumed byte.
    let end = Math.min(pageBytes, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end++;
    const next = offset + end;
    const text = new TextDecoder('utf-8', { ignoreBOM: offset > 0 }).decode(bytes.subarray(0, end));
    return { text, offset, nextOffset: next < totalBytes ? next : null, totalBytes };
  } finally {
    handle.close();
  }
}
