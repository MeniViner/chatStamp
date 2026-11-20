import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readTranscriptPage } from '../src/services/transcriptReader';

const io = vi.hoisted(() => ({
  bytes: new Uint8Array(), exists: true, maxRead: Infinity, declaredSize: undefined as number | undefined,
  fail: false, emptyRead: false, reads: [] as number[], closed: vi.fn(), opened: vi.fn(),
}));
vi.mock('expo-file-system', () => ({ File: class {
  get exists() { return io.exists; }
  open() {
    io.opened();
    let offset = 0;
    return {
      get size() { return io.declaredSize ?? io.bytes.length; },
      set offset(value: number) { offset = value; },
      readBytes(length: number) {
        io.reads.push(length);
        if (io.fail) throw new Error('Synthetic read failure');
        if (io.emptyRead) return new Uint8Array();
        const result = io.bytes.slice(offset, offset + Math.min(length, io.maxRead));
        offset += result.length;
        return result;
      },
      close: io.closed,
    };
  }
} }));
const uri = 'file:///synthetic/chatstamp/reader14/extracted/_chat.txt';
const bytes = (text: string) => { io.bytes = new TextEncoder().encode(text); };
beforeEach(() => {
  io.bytes = new Uint8Array(); io.exists = true; io.maxRead = Infinity; io.declaredSize = undefined;
  io.fail = false; io.emptyRead = false; io.reads = []; io.closed.mockClear(); io.opened.mockClear();
});

describe('bounded local transcript reads', () => {
  it('preserves Hebrew, emoji and multiline contents without parsing or reformatting the transcript', async () => {
    const text = '20/11/26, 12:30 - דנה: שלום 👋\r\nשורה נוספת\n20/11/26, 12:31 - Alex: Hello';
    bytes(text);
    expect(await readTranscriptPage(uri)).toEqual({ text, offset: 0, nextOffset: null, totalBytes: io.bytes.length });
    expect(io.closed).toHaveBeenCalledOnce();
  });

  it.each(['א', '€', '🙂'])('never splits the UTF-8 code point %s between adjacent pages', async (character) => {
    const prefix = 'x'.repeat(32 * 1024 - 1), suffix = '\nסוף השיחה';
    bytes(prefix + character + suffix);
    const first = await readTranscriptPage(uri);
    expect(first.text).toBe(prefix + character);
    expect(first.nextOffset).toBe(new TextEncoder().encode(prefix + character).length);
    const second = await readTranscriptPage(uri, first.nextOffset!);
    expect(second.text).toBe(suffix);
    expect(second.nextOffset).toBeNull();
    expect(first.text + second.text).toBe(prefix + character + suffix);
    expect(io.closed).toHaveBeenCalledTimes(2);
  });

  it('reads at most 32 KiB plus three lookahead bytes for one request, independently of total size', async () => {
    bytes('a'.repeat(2 * 1024 * 1024));
    const first = await readTranscriptPage(uri);
    expect(first.text).toHaveLength(32 * 1024);
    expect(first.nextOffset).toBe(32 * 1024);
    expect(io.reads).toEqual([32 * 1024 + 3]);
    expect(io.closed).toHaveBeenCalledOnce();
  });

  it('reassembles consecutive bounded pages without dropping CRLF or interior BOM characters', async () => {
    const text = 'a'.repeat(32767) + '\r\n' + '\ufeff' + 'שורה בעברית 🙂\n'.repeat(7000);
    bytes('\ufeff' + text);
    const pages: string[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page = await readTranscriptPage(uri, offset);
      pages.push(page.text);
      if (page.nextOffset !== null) expect(page.nextOffset).toBeGreaterThan(offset);
      offset = page.nextOffset;
    }
    expect(pages.join('')).toBe(text);
    expect(Math.max(...io.reads)).toBeLessThanOrEqual(32771);
    expect(io.closed).toHaveBeenCalledTimes(pages.length);
  });

  it('fills short reads only up to the same page budget', async () => {
    const text = 'א🙂\n'.repeat(7000); bytes(text); io.maxRead = 127;
    const first = await readTranscriptPage(uri);
    const second = await readTranscriptPage(uri, first.nextOffset!);
    expect(first.text + second.text).toBe(text);
    expect(Math.max(...io.reads)).toBeLessThanOrEqual(32771);
    expect(io.closed).toHaveBeenCalledTimes(2);
  });

  it('represents an empty transcript and exact EOF without making a byte read', async () => {
    expect(await readTranscriptPage(uri)).toEqual({ text: '', offset: 0, nextOffset: null, totalBytes: 0 });
    expect(io.reads).toEqual([]);
    expect(io.closed).toHaveBeenCalledOnce();
  });

  it.each([-1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])('rejects invalid offset %s before opening a file', async (offset) => {
    await expect(readTranscriptPage(uri, offset)).rejects.toThrow(RangeError);
    expect(io.opened).not.toHaveBeenCalled();
  });

  it('closes the handle when a requested offset is beyond EOF', async () => {
    bytes('hello');
    await expect(readTranscriptPage(uri, 6)).rejects.toThrow(RangeError);
    expect(io.closed).toHaveBeenCalledOnce();
  });

  it('closes on native I/O failure and refuses an unexpected premature EOF', async () => {
    bytes('hello'); io.fail = true;
    await expect(readTranscriptPage(uri)).rejects.toThrow('Synthetic read failure');
    expect(io.closed).toHaveBeenCalledOnce();
    io.fail = false; io.emptyRead = true;
    await expect(readTranscriptPage(uri)).rejects.toThrow('changed');
    expect(io.closed).toHaveBeenCalledTimes(2);
  });

  it('does not open remote/provider URIs or an absent extracted file', async () => {
    for (const value of ['https://example.invalid/chat.txt', 'content://synthetic/chat.txt', '']) {
      await expect(readTranscriptPage(value)).rejects.toThrow(RangeError);
    }
    io.exists = false;
    await expect(readTranscriptPage(uri)).rejects.toThrow('unavailable');
    expect(io.opened).not.toHaveBeenCalled();
  });
});
