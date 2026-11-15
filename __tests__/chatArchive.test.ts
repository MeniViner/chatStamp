import { describe, expect, it } from 'vitest';
import { parseWhatsAppChatText } from '../src/lib/chatParser';
import { normalizeFilename } from '../src/lib/filename';
import { attachChatRecordsToMedia } from '../src/lib/matcher';
import { classifyMedia } from '../src/lib/mediaClassifier';
import type { ExtractedMediaFile } from '../src/types/media';
import { UNKNOWN_SENDER } from '../src/lib/mediaMetadata';
import { filterVisibleFiles } from '../src/store/fileFiltering';
import { getSelectedSaveCandidates } from '../src/store/selectionLogic';
import { chatFixtures } from './chatFixtures';

function makeFile(path: string, index: number, modificationTime?: string): ExtractedMediaFile {
  const filename = path.split('/').at(-1) ?? path;
  return {
    id: `${path}:${index}`,
    filename,
    sourcePath: path,
    normalizedFilename: normalizeFilename(filename),
    uri: `file:///fixtures/${path}`,
    mediaType: classifyMedia(filename),
    modificationTime
  };
}

describe('chat archive matching', () => {
  it.each(chatFixtures)('accounts for all fixture entries in $name', (fixture) => {
    const archiveFiles = fixture.entries.map((entry, index) => makeFile(entry.path, index, entry.modificationTime));
    const supported = archiveFiles.filter((file) => file.mediaType !== 'unknown');
    const parsed = parseWhatsAppChatText(fixture.text, supported, { timeZone: fixture.zone });
    const attached = attachChatRecordsToMedia(supported, parsed.records, parsed.timeZone);

    expect(parsed.dateOrder).toBe(fixture.order);
    expect(attached.length + archiveFiles.filter((file) => file.mediaType === 'unknown').length).toBe(archiveFiles.length);
    fixture.entries.forEach((entry, index) => {
      const file = attached.find((item) => item.id === archiveFiles[index].id);
      if (entry.skip) {
        expect(archiveFiles[index].mediaType).toBe('unknown');
        expect(file).toBeUndefined();
        return;
      }
      expect(file).toBeDefined();
      expect(file?.matchedRecord?.sender ?? 'unknown').toBe(entry.expected.sender);
      expect(file?.dateSource).toBe(entry.expected.dateSource);
      expect(file?.dateIso ?? null).toBe(entry.expected.date);
      expect(file?.saveDateIso ?? file?.dateIso ?? null).toBe(entry.expected.saveDate ?? entry.expected.date);
    });
    for (const caption of fixture.captions ?? []) {
      expect(parsed.preview.messages.some((message) => message.body.includes(caption))).toBe(true);
    }
  });

  it('keeps times inside the minute and the chat order over 60 attachments', () => {
    const files = Array.from({ length: 61 }, (_, index) => makeFile(`photo-${index}.jpg`, index));
    const transcript = files.map((file) => `15/01/2024, 10:30 - Dana: ${file.filename} (file attached)`).join('\n');
    const parsed = parseWhatsAppChatText(transcript, files, { timeZone: 'UTC' });
    const matched = attachChatRecordsToMedia([...files].reverse(), parsed.records, parsed.timeZone);

    expect(matched).toHaveLength(61);
    expect(new Set(matched.map((file) => file.dateIso))).toEqual(new Set(['2024-01-15T10:30:00.000Z']));
    expect(matched.every((file) => !file.saveDateIso || file.saveDateIso === file.dateIso)).toBe(true);
    expect(matched.map((file) => file.matchedRecord?.messageIndex)).toEqual(files.map((_, index) => 60 - index));
  });

  it('keeps unmatched supported files visible and only passes dated files to the legacy saver', () => {
    const files = [makeFile('IMG-20240205-WA0001.jpg', 0), makeFile('unmatched.m4a', 1)];
    const attached = attachChatRecordsToMedia(files, [], 'UTC');
    const selectedSenders = [UNKNOWN_SENDER];
    const selectedMediaTypes = {
      photo: true, video: true, audio: true, gif: true, voice: true, sticker: true, document: true, unknown: false
    };
    const visible = filterVisibleFiles({ files: attached, selectedSenders, selectedMediaTypes, saveableOnly: true });
    expect(visible.map((file) => file.id)).toEqual(files.map((file) => file.id));

    const eligible = getSelectedSaveCandidates(visible, selectedSenders, selectedMediaTypes, files.map((file) => file.id));
    expect(eligible).toEqual([{ file: visible[0], timestampMillis: Date.parse('2024-02-05T12:00:00Z') }]);
  });
});
