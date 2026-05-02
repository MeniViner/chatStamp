import { describe, expect, it } from 'vitest';
import { parseWhatsAppChatText } from '../src/lib/chatParser';
import { classifyMedia } from '../src/lib/mediaClassifier';
import { attachChatRecordsToMedia } from '../src/lib/matcher';
import type { ExtractedMediaFile } from '../src/types/media';

const sample = `31/12/2024, 18:42 - Avi Cohen: <attached: IMG-20241231-WA0001.jpg>
01/01/2025, 09:15 - משה לוי: VID-20250101-WA0002.mp4
02/01/2025, 10:00 - System message without media`;

describe('parseWhatsAppChatText', () => {
  it('extracts media records from common WhatsApp lines', () => {
    const result = parseWhatsAppChatText(sample);

    expect(result.records).toHaveLength(2);
    expect(result.records[0].filename).toBe('IMG-20241231-WA0001.jpg');
    expect(result.records[0].sender).toBe('Avi Cohen');
    expect(result.records[1].filename).toBe('VID-20250101-WA0002.mp4');
    expect(result.records[1].sender).toBe('משה לוי');
  });

  it('normalizes filename lookup casing', () => {
    const result = parseWhatsAppChatText('31/12/2024, 18:42 - Sender: <attached: IMG-ABC.JPG>');
    expect(result.records[0].normalizedFilename).toBe('img-abc.jpg');
  });

  it('ignores Unicode direction marks in dates, senders, and filenames', () => {
    const result = parseWhatsAppChatText(
      '\u200f31/12/2024, 18:42 - \u200fמשה לוי: <attached: \u200eIMG-ABC.JPG>'
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0].sender).toBe('משה לוי');
    expect(result.records[0].normalizedFilename).toBe('img-abc.jpg');
  });

  it('supports bracketed exports with seconds', () => {
    const result = parseWhatsAppChatText(
      '[31/12/2024, 18:42:01] Avi Cohen: IMG-20241231-WA0001.jpg (file attached)'
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0].filename).toBe('IMG-20241231-WA0001.jpg');
  });

  it('supports 12-hour timestamps', () => {
    const result = parseWhatsAppChatText(
      '12/31/2024, 6:42 PM - Sender: <attached: VID-20241231-WA0002.mp4>'
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0].messageDateIso).toContain('2024-12-31');
  });

  it('treats multiline messages as one WhatsApp entry', () => {
    const result = parseWhatsAppChatText(
      `31/12/2024, 18:42 - Sender: Album note
IMG-20241231-WA0001.jpg attached below
01/01/2025, 09:15 - Sender: no media here`
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0].filename).toBe('IMG-20241231-WA0001.jpg');
    expect(result.skippedLines).toHaveLength(1);
  });

  it('skips media omitted lines without throwing', () => {
    const result = parseWhatsAppChatText('31/12/2024, 18:42 - Sender: image omitted');

    expect(result.records).toHaveLength(0);
    expect(result.skippedLines).toHaveLength(1);
  });
});

describe('classifyMedia', () => {
  it('classifies MVP media types', () => {
    expect(classifyMedia('IMG-20250101-WA0001.JPG')).toBe('photo');
    expect(classifyMedia('VID-20250101-WA0001.mp4')).toBe('video');
    expect(classifyMedia('PTT-20250101-WA0001.opus')).toBe('voice');
    expect(classifyMedia('AUD-20250101-WA0001.opus')).toBe('voice');
    expect(classifyMedia('STK-20250101-WA0001.webp')).toBe('sticker');
    expect(classifyMedia('contact.vcf')).toBe('document');
  });
});

describe('attachChatRecordsToMedia', () => {
  it('matches duplicate filenames in sequence', () => {
    const parsed = parseWhatsAppChatText(`31/12/2024, 18:42 - Sender A: <attached: IMG-0001.jpg>
01/01/2025, 09:15 - Sender B: <attached: IMG-0001.jpg>`);
    const files: ExtractedMediaFile[] = [
      {
        id: '1',
        filename: 'IMG-0001.jpg',
        normalizedFilename: 'img-0001.jpg',
        uri: 'file:///cache/IMG-0001.jpg',
        mediaType: 'photo'
      },
      {
        id: '2',
        filename: 'IMG-0001.jpg',
        normalizedFilename: 'img-0001.jpg',
        uri: 'file:///cache/duplicate/IMG-0001.jpg',
        mediaType: 'photo'
      }
    ];

    const matched = attachChatRecordsToMedia(files, parsed.records);

    expect(matched[0].matchedRecord?.sender).toBe('Sender A');
    expect(matched[1].matchedRecord?.sender).toBe('Sender B');
  });
});
