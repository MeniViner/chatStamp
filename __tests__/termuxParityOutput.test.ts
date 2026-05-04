import { describe, expect, it } from 'vitest';
import {
  buildCollisionFilename,
  buildTermuxParityOutputPath,
  folderNameForMediaType,
  getFallbackModeWarning,
  relativeOutputFolderForFile,
  sanitizeOutputFilename,
  sanitizePathSegment
} from '../src/lib/termuxParityOutput';

describe('Termux Parity output helpers', () => {
  it('preserves Hebrew chat names while removing path separators', () => {
    expect(sanitizePathSegment('משפחה / חברים: 2026')).toBe('משפחה _ חברים_ 2026');
    expect(buildTermuxParityOutputPath('צ׳אט משפחתי', { organization: { mode: 'all-in-one', createExportTimestampFolder: false, duplicateHandling: 'keep-both' } })).toBe(
      '/storage/emulated/0/Pictures/WhatsApp Media TimeFixer/צ׳אט משפחתי'
    );
  });

  it('builds export timestamp folders and organizes categories by type', () => {
    const organization = { mode: 'by-sender-and-type' as const, createExportTimestampFolder: true, duplicateHandling: 'keep-both' as const };
    expect(buildTermuxParityOutputPath('Chat', { exportTimestamp: '2026-05-02 14-30', organization })).toBe(
      '/storage/emulated/0/Pictures/WhatsApp Media TimeFixer/Chat/Export 2026-05-02 14-30'
    );
    expect(folderNameForMediaType('voice', organization)).toBe('Voice notes');
    expect(relativeOutputFolderForFile({
      mediaType: 'sticker',
      matchedRecord: { id: '1', filename: 'a.webp', normalizedFilename: 'a.webp', sender: 'Avi', messageDateIso: '2026-05-02T00:00:00.000Z', rawLine: '' }
    }, organization)).toBe('Avi/Stickers');
  });

  it('preserves Hebrew filenames and removes unsafe separators', () => {
    expect(sanitizeOutputFilename('Media/תמונה:01.jpg')).toBe('תמונה_01.jpg');
  });

  it('adds numeric suffixes for duplicate filenames', () => {
    expect(buildCollisionFilename('IMG-1.jpg', ['IMG-1.jpg'])).toBe('IMG-1-1.jpg');
    expect(buildCollisionFilename('IMG-1.jpg', ['IMG-1.jpg', 'IMG-1-1.jpg'])).toBe('IMG-1-2.jpg');
  });

  it('warns that MediaStore fallback may show import time', () => {
    expect(getFallbackModeWarning('termux-parity')).toBeNull();
    expect(getFallbackModeWarning('mediastore-fallback')).toContain('import time');
  });
});
