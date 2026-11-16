import { describe, expect, it } from 'vitest';
import { defaultOutputOrganization, outputChatName, relativeOutputFolderForFile } from '../src/lib/outputOrganization';

describe('scoped output organization', () => {
  it('preserves Hebrew chat names while removing separators', () => {
    expect(outputChatName('משפחה / חברים: 2026.zip')).toBe('משפחה _ חברים_ 2026');
    expect(outputChatName()).toBe('Imported Chat');
  });

  it('groups both photos and videos together by default', () => {
    for (const mediaType of ['photo', 'video'] as const) {
      expect(relativeOutputFolderForFile({ mediaType }, defaultOutputOrganization)).toBe('');
    }
  });

  it('uses stable sender and type segments when both are selected', () => {
    expect(relativeOutputFolderForFile({
      mediaType: 'sticker',
      matchedRecord: { id: '1', filename: 'a.webp', normalizedFilename: 'a.webp', sender: 'Avi', messageDateIso: '2026-05-02T00:00:00.000Z', rawLine: '' }
    }, { ...defaultOutputOrganization, mode: 'by-sender-and-type' })).toBe('Avi/Stickers');
  });
});
