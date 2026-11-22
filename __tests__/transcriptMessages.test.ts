import { describe, expect, it } from 'vitest';
import { senderColorIndex, toTranscriptEntries, transcriptSenders, type TranscriptEntry } from '../src/lib/transcriptMessages';

type Message = Extract<TranscriptEntry, { kind: 'message' }>;
const messages = (entries: readonly TranscriptEntry[]) => entries.filter((entry): entry is Message => entry.kind === 'message');
const kinds = (entries: readonly TranscriptEntry[]) => entries.map((entry) => entry.kind);

describe('toTranscriptEntries', () => {
  it('parses an Android header into a day separator and a message', () => {
    const entries = toTranscriptEntries('26.2.2019, 10:00 - Dana: hello there');
    expect(kinds(entries)).toEqual(['day', 'message']);
    expect(entries[0]).toMatchObject({ kind: 'day', date: '26.2.2019' });
    expect(entries[1]).toMatchObject({ kind: 'message', sender: 'Dana', time: '10:00', body: 'hello there', omitted: false, startsRun: true });
    expect((entries[1] as Message).attachment).toBeUndefined();
  });

  it('parses an iOS bracketed header with seconds', () => {
    const entries = toTranscriptEntries('[26/02/2019, 10:00:00] Dana: hello there');
    expect(kinds(entries)).toEqual(['day', 'message']);
    expect(entries[0]).toMatchObject({ kind: 'day', date: '26/02/2019' });
    expect(entries[1]).toMatchObject({ sender: 'Dana', body: 'hello there', startsRun: true });
    expect((entries[1] as Message).time).toMatch(/^10:00/);
  });

  it('keeps continuation lines in the message body', () => {
    const [message] = messages(toTranscriptEntries('26.2.2019, 10:00 - Dana: line one\nline two\n\nline four\n26.2.2019, 10:01 - Ben: next'));
    expect(message.body).toBe('line one\nline two\n\nline four');
  });

  it('turns leading partial text before the first header into a text entry', () => {
    const entries = toTranscriptEntries('end of a previous section\nstill previous\n26.2.2019, 10:00 - Dana: first full message');
    expect(entries[0]).toMatchObject({ kind: 'text' });
    expect(entries[0].kind === 'text' ? entries[0].body : '').toContain('end of a previous section\nstill previous');
    expect(kinds(entries).slice(1)).toEqual(['day', 'message']);
  });

  it('returns no entries for empty text and a single text entry for header-less text', () => {
    expect(toTranscriptEntries('')).toEqual([]);
    expect(kinds(toTranscriptEntries('just some text\nwithout headers'))).toEqual(['text']);
  });

  it('emits a day entry only when the date changes', () => {
    const entries = toTranscriptEntries([
      '26.2.2019, 10:00 - Dana: a', '26.2.2019, 10:05 - Ben: b', '27.2.2019, 09:00 - Ben: c', '27.2.2019, 09:01 - Dana: d',
    ].join('\n'));
    expect(kinds(entries)).toEqual(['day', 'message', 'message', 'day', 'message', 'message']);
    expect(entries.filter((entry) => entry.kind === 'day').map((entry) => entry.kind === 'day' ? entry.date : '')).toEqual(['26.2.2019', '27.2.2019']);
  });

  it('recognizes a system message without a "Name: " part', () => {
    const entries = toTranscriptEntries('26.2.2019, 10:00 - Messages and calls are end-to-end encrypted.\n26.2.2019, 10:01 - Dana created group "Family"');
    expect(kinds(entries)).toEqual(['day', 'system', 'system']);
    expect(entries[1]).toMatchObject({ kind: 'system', time: '10:00', body: 'Messages and calls are end-to-end encrypted.' });
  });

  it('extracts attachment names in Android and iOS forms and flags omitted media', () => {
    const entries = messages(toTranscriptEntries([
      '26.2.2019, 10:00 - Dana: IMG-20190226-WA0001.jpg (file attached)',
      '[26/02/2019, 10:01:00] Ben: <attached: 00000012-PHOTO-2019-02-26.jpg>',
      '26.2.2019, 10:02 - Dana: <Media omitted>',
    ].join('\n')));
    expect(entries.map((entry) => entry.attachment)).toEqual(['IMG-20190226-WA0001.jpg', '00000012-PHOTO-2019-02-26.jpg', undefined]);
    expect(entries.map((entry) => entry.omitted)).toEqual([false, false, true]);
  });

  it('starts a new run on sender change, after a system message and after a day change', () => {
    const entries = messages(toTranscriptEntries([
      '26.2.2019, 10:00 - Dana: 1', '26.2.2019, 10:01 - Dana: 2', '26.2.2019, 10:02 - Ben: 3', '26.2.2019, 10:03 - Ben: 4',
      '26.2.2019, 10:04 - Ben added Dana', '26.2.2019, 10:05 - Ben: 5', '27.2.2019, 10:00 - Ben: 6', '27.2.2019, 10:01 - Ben: 7',
    ].join('\n')));
    expect(entries.map((entry) => [entry.body, entry.startsRun])).toEqual([
      ['1', true], ['2', false], ['3', true], ['4', false], ['5', true], ['6', true], ['7', false],
    ]);
  });

  it('handles Hebrew names and direction marks around headers, names and attachments', () => {
    const entries = toTranscriptEntries([
      '‏26.2.2019, 10:00 - ‏דנה כהן: שלום משפחה',
      '‎[26/02/2019, 10:01:00] ‎אבא: ‎<attached: 00000013-PHOTO-2019-02-26.jpg>',
      '26.2.2019, 10:02 - ‪דנה כהן‬: ‎IMG-1.jpg (file attached)',
    ].join('\n'));
    const parsed = messages(entries);
    expect(parsed.map((entry) => entry.sender)).toEqual(['דנה כהן', 'אבא', 'דנה כהן']);
    expect(parsed[0].body).toBe('שלום משפחה');
    expect(parsed.map((entry) => entry.attachment)).toEqual([undefined, '00000013-PHOTO-2019-02-26.jpg', 'IMG-1.jpg']);
    expect(kinds(entries).filter((kind) => kind === 'text')).toEqual([]);
  });

  it('accepts \\r\\n line endings without leaking carriage returns', () => {
    const entries = toTranscriptEntries('26.2.2019, 10:00 - Dana: one\r\ntwo\r\n26.2.2019, 10:01 - Ben: IMG-1.jpg (file attached)\r\n');
    const parsed = messages(entries);
    expect(parsed.map((entry) => entry.sender)).toEqual(['Dana', 'Ben']);
    expect(parsed[0].body).toBe('one\ntwo');
    expect(parsed[1].attachment).toBe('IMG-1.jpg');
    expect(JSON.stringify(entries)).not.toContain('\\r');
  });

  it('splits lines on \\r\\n, a lone \\r and \\n alike', () => {
    const entries = toTranscriptEntries('26.2.2019, 10:00 - Dana: one\r26.2.2019, 10:01 - Ben: two\r\n26.2.2019, 10:02 - Gil: three\nmore');
    const parsed = messages(entries);
    expect(parsed.map((entry) => [entry.sender, entry.body])).toEqual([['Dana', 'one'], ['Ben', 'two'], ['Gil', 'three\nmore']]);
    expect(JSON.stringify(entries)).not.toContain('\\r');
  });

  it('treats an iOS group notice as a system entry without a sender', () => {
    const entries = toTranscriptEntries([
      '[15/02/2019, 10:30:00] Family: \u200eMessages and calls are end-to-end encrypted.',
      '[15/02/2019, 10:31:00] Dana: hi all',
    ].join('\n'));
    expect(kinds(entries)).toEqual(['day', 'system', 'message']);
    expect(entries[1]).toMatchObject({ kind: 'system', body: expect.stringContaining('Messages and calls are end-to-end encrypted.') });
    expect(transcriptSenders(entries)).toEqual(['Dana']);
    expect(transcriptSenders(entries)).not.toContain('Family');
  });

  it('keeps iOS media, omitted media and deleted messages marked with a direction mark as messages from their sender', () => {
    const entries = toTranscriptEntries([
      '[15/02/2019, 10:30:00] Dana: \u200e<attached: 00000012-PHOTO.jpg>',
      '[15/02/2019, 10:31:00] Dana: \u200eimage omitted',
      '[15/02/2019, 10:32:00] Dana: \u200eThis message was deleted.',
    ].join('\n'));
    expect(kinds(entries)).toEqual(['day', 'message', 'message', 'message']);
    const parsed = messages(entries);
    expect(parsed.map((entry) => entry.sender)).toEqual(['Dana', 'Dana', 'Dana']);
    expect(parsed[0].attachment).toBe('00000012-PHOTO.jpg');
    expect(parsed[1]).toMatchObject({ omitted: true });
    expect(parsed[1].attachment).toBeUndefined();
    expect(transcriptSenders(entries)).toEqual(['Dana']);
  });

  it('flags iOS "image omitted" / "video omitted" and Android <Media omitted> as omitted, but not ordinary text', () => {
    const parsed = messages(toTranscriptEntries([
      '[15/02/2019, 10:30:00] Dana: image omitted',
      '[15/02/2019, 10:31:00] Ben: video omitted',
      '15.2.2019, 10:32 - Gil: <Media omitted>',
      '15.2.2019, 10:33 - Gil: the image was omitted from the album',
    ].join('\n')));
    expect(parsed.map((entry) => entry.omitted)).toEqual([true, true, true, false]);
  });

  it('separates a caption that follows an attachment line', () => {
    const [message] = messages(toTranscriptEntries('26.2.2019, 10:00 - Dana: IMG-1.jpg (file attached)\nLook at this'));
    expect(message).toMatchObject({ attachment: 'IMG-1.jpg', caption: 'Look at this', omitted: false });
    const [plain] = messages(toTranscriptEntries('26.2.2019, 10:00 - Dana: IMG-2.jpg (file attached)'));
    expect(plain.attachment).toBe('IMG-2.jpg');
    expect(plain.caption).toBeUndefined();
  });

  it('gives every entry a unique key', () => {
    const entries = toTranscriptEntries('lead\n' + '26.2.2019, 10:00 - Dana: same\n'.repeat(5) + '27.2.2019, 10:00 - System notice');
    expect(new Set(entries.map((entry) => entry.key)).size).toBe(entries.length);
  });
});

describe('transcriptSenders and senderColorIndex', () => {
  it('lists each message sender once, ignoring system messages', () => {
    const senders = transcriptSenders(toTranscriptEntries([
      '26.2.2019, 10:00 - Dana: a', '26.2.2019, 10:01 - Ben: b', '26.2.2019, 10:02 - Dana: c', '26.2.2019, 10:03 - Ben added Gil',
    ].join('\n')));
    expect([...senders].sort()).toEqual(['Ben', 'Dana']);
  });

  it('maps a sender to a stable palette index', () => {
    for (const sender of ['Dana', 'Ben', 'דנה כהן', '+972 50-000-0000']) {
      const index = senderColorIndex(sender, 8);
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0); expect(index).toBeLessThan(8);
      expect(senderColorIndex(sender, 8)).toBe(index);
    }
  });
});
