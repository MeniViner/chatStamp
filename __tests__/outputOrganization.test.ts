import { describe, expect, it } from 'vitest';
import { defaultOutputOrganization, displayOutputChatName, folderNameForMediaType, legacyOutputFolderLabels, localizedOutputFolderLabels, outputChatName, relativeOutputFolderForFile } from '../src/lib/outputOrganization';
import he from '../src/i18n/locales/he.json';

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

  const hebrewLabels = () => localizedOutputFolderLabels((key) => he.outputFolders[key.slice('outputFolders.'.length) as keyof typeof he.outputFolders]);

  it('localizes genuinely missing display names while retaining the legacy canonical identity and literal owner text', () => {
    const labels = hebrewLabels();
    expect(outputChatName()).toBe('Imported Chat');
    expect(displayOutputChatName(undefined, labels)).toBe('שיחה מיובאת');
    expect(displayOutputChatName('Imported Chat.zip', labels)).toBe('Imported Chat');
    expect(displayOutputChatName('משפחה.zip', labels)).toBe('משפחה');
  });

  it('uses the actual Hebrew folder profile for new type segments with photo/video sharing one group', () => {
    const labels = hebrewLabels(), organization = { ...defaultOutputOrganization, mode: 'by-type' as const };
    expect(folderNameForMediaType('photo', organization, labels)).toBe('מדיה');
    expect(folderNameForMediaType('video', organization, labels)).toBe('מדיה');
    expect(folderNameForMediaType('voice', organization, labels)).toBe('הודעות קוליות');
    expect(folderNameForMediaType('document', organization, labels)).toBe('מסמכים');
  });

  it('does not translate a real sender that happens to equal a legacy fallback label', () => {
    const labels = hebrewLabels();
    const entry = { mediaType: 'photo' as const, matchedRecord: { id: '1', filename: 'a.jpg', normalizedFilename: 'a.jpg', sender: 'Unknown sender', messageDateIso: '2019-02-26T10:00:00Z', rawLine: '' } };
    expect(relativeOutputFolderForFile(entry, { ...defaultOutputOrganization, mode: 'by-sender-and-type' }, labels)).toBe('Unknown sender/מדיה');
    expect(relativeOutputFolderForFile({ mediaType: 'photo' }, { ...defaultOutputOrganization, mode: 'by-sender-and-type' }, labels)).toBe('שולח לא ידוע/מדיה');
  });

  it('uses safe legacy values for missing translation keys and sanitizes a supplied label at the boundary', () => {
    expect(localizedOutputFolderLabels((key) => key)).toEqual(legacyOutputFolderLabels);
    const labels = localizedOutputFolderLabels(() => ' עברית / קבוצה\u0000 ');
    for (const label of Object.values(labels)) { expect(label).not.toMatch(/[\\/\u0000-\u001f]/); expect(label).toContain('עברית'); }
  });
});
