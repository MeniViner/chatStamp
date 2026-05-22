import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as FileSystem from 'expo-file-system/legacy';
import { importWhatsAppZip, CHAT_TRANSCRIPT_SENDER } from '../src/services/importService';
import { extractSupportedZipEntries } from '../src/native/zipExtractor';

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: vi.fn(),
  copyAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  deleteAsync: vi.fn()
}));

vi.mock('../src/native/zipExtractor', () => ({
  extractSupportedZipEntries: vi.fn()
}));

describe('importWhatsAppZip', () => {
  beforeEach(() => {
    vi.mocked(FileSystem.makeDirectoryAsync).mockResolvedValue(undefined);
    vi.mocked(FileSystem.copyAsync).mockResolvedValue(undefined);
    vi.mocked(FileSystem.deleteAsync).mockResolvedValue(undefined);
    vi.mocked(FileSystem.readAsStringAsync).mockResolvedValue('01/01/2025, 10:00 - Avi: hello without media');
    vi.mocked(extractSupportedZipEntries).mockResolvedValue({
      chatFileUri: 'file:///cache/extracted/_chat.txt',
      chatFilename: '_chat.txt',
      txtFiles: ['_chat.txt'],
      transcriptCandidates: [],
      mediaFiles: [],
      extractedCount: 1,
      skippedCount: 0,
      extractionMode: 'native-selective'
    });
  });

  it('accepts a WhatsApp export ZIP that contains only the chat transcript', async () => {
    const result = await importWhatsAppZip({
      zipUri: 'content://exports/chat.zip',
      zipName: 'chat.zip'
    });

    expect(result.mediaFiles).toHaveLength(1);
    expect(result.mediaFiles[0]).toMatchObject({
      filename: '_chat.txt',
      mediaType: 'document',
      sourceKind: 'chat-transcript',
      matchedRecord: {
        sender: CHAT_TRANSCRIPT_SENDER,
        messageDateIso: expect.stringContaining('2025-01-01')
      }
    });
    expect(result.importSummary.documents).toBe(1);
    expect(result.importSummary.matchedMedia).toBe(0);
  });
});
