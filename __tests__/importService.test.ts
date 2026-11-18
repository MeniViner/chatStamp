import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as FileSystem from 'expo-file-system/legacy';
import { importWhatsAppZip, CHAT_TRANSCRIPT_SENDER, MAX_TRANSCRIPT_BYTES } from '../src/services/importService';
import { extractSupportedZipEntries } from '../src/native/zipExtractor';
import type { NativeTranscriptCandidate, NativeZipExtractionResult } from '../src/native/chatStampNativeModule';

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

const conversation = '01/01/2025, 10:00 - Avi: hello without media';
const operationId = 'import-test';
const sourceUri = 'content://exports/chat.zip';
const workingDirectory = `file:///cache/chatstamp/${operationId}/`;

function candidate(overrides: Partial<NativeTranscriptCandidate> = {}): NativeTranscriptCandidate {
  return {
    filename: '_chat.txt', sourcePath: '_chat.txt', uri: `${workingDirectory}extracted/transcript.txt`,
    sample: conversation, modificationTime: null, sizeBytes: conversation.length, ...overrides
  };
}

function extraction(overrides: Partial<NativeZipExtractionResult> = {}): NativeZipExtractionResult {
  return {
    operationId, archiveFingerprint: 'a'.repeat(64), transcriptCandidates: [candidate()], mediaFiles: [],
    extractedCount: 1, skippedCount: 0, skippedEntries: [], extractionMode: 'native-selective', ...overrides
  };
}

function runImport() {
  return importWhatsAppZip({ zipUri: sourceUri, zipName: 'chat.zip', operationId });
}

describe('streamed WhatsApp import orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(FileSystem.makeDirectoryAsync).mockResolvedValue(undefined);
    vi.mocked(FileSystem.copyAsync).mockResolvedValue(undefined);
    vi.mocked(FileSystem.deleteAsync).mockResolvedValue(undefined);
    vi.mocked(FileSystem.readAsStringAsync).mockResolvedValue(conversation);
    vi.mocked(extractSupportedZipEntries).mockResolvedValue(extraction());
  });

  it('accepts a WhatsApp export ZIP that contains only the chat transcript', async () => {
    const result = await runImport();

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

  it('passes the original granted source URI and operation ID straight to native extraction', async () => {
    const onProgress = vi.fn();
    const result = await importWhatsAppZip({ zipUri: sourceUri, zipName: 'chat.zip', operationId, onProgress });
    expect(extractSupportedZipEntries).toHaveBeenCalledExactlyOnceWith(
      sourceUri, `${workingDirectory}extracted/`, operationId, onProgress
    );
    expect(FileSystem.copyAsync).not.toHaveBeenCalled();
    expect(result.archiveFingerprint).toBe('a'.repeat(64));
    expect(result.operationId).toBe(operationId);
    expect(result).not.toHaveProperty('copiedZipUri');
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('chooses a year-first transcript in TypeScript even when another TXT is named _chat.txt', async () => {
    const yearFirst = '2025-01-02, 10:00 - Avi: photo.jpg (file attached)';
    const chosen = candidate({ filename: 'WhatsApp chat.txt', sourcePath: 'nested/WhatsApp chat.txt',
      uri: `${workingDirectory}extracted/year-first.txt`, sample: yearFirst, sizeBytes: yearFirst.length });
    vi.mocked(extractSupportedZipEntries).mockResolvedValue(extraction({
      transcriptCandidates: [candidate({ sample: 'A README, not a WhatsApp conversation.' }), chosen],
      mediaFiles: [{ filename: 'photo.jpg', sourcePath: 'photos/photo.jpg',
        uri: `${workingDirectory}extracted/photo.jpg`, sizeBytes: 123, modificationTime: null }],
      extractedCount: 3
    }));
    vi.mocked(FileSystem.readAsStringAsync).mockResolvedValue(yearFirst);
    const result = await runImport();
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledExactlyOnceWith(chosen.uri);
    expect(result.mediaFiles[0]).toMatchObject({ filename: 'WhatsApp chat.txt', sourceKind: 'chat-transcript' });
    expect(result.mediaFiles.find((file) => file.filename === 'photo.jpg')).toMatchObject({
      dateSource: 'chat', dateIso: expect.stringContaining('2025-01-02'), matchedRecord: { sender: 'Avi' }
    });
  });

  it('retains non-chat TXT candidates as supported documents with their own entry metadata', async () => {
    const notes = candidate({ filename: 'notes.txt', sourcePath: 'documents/notes.txt',
      uri: `${workingDirectory}extracted/notes.txt`, sample: 'Notes unrelated to the chat.',
      modificationTime: '2020-04-15T10:00:00.000Z', sizeBytes: 29 });
    vi.mocked(extractSupportedZipEntries).mockResolvedValue(extraction({
      transcriptCandidates: [candidate(), notes], extractedCount: 2
    }));
    const result = await runImport();
    expect(result.mediaFiles).toHaveLength(2);
    expect(result.mediaFiles.find((file) => file.filename === 'notes.txt')).toMatchObject({
      id: JSON.stringify(['documents/notes.txt', 0]), sourceKind: 'zip-media', mediaType: 'document',
      uri: notes.uri, sourcePath: notes.sourcePath, sizeBytes: 29, dateSource: 'zip-entry',
      modificationTime: notes.modificationTime, dateIso: notes.modificationTime
    });
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledTimes(1);
    expect(result.importSummary.documents).toBe(2);
  });

  it('keeps an unmatched undated document available without inventing the current date', async () => {
    vi.mocked(extractSupportedZipEntries).mockResolvedValue(extraction({
      mediaFiles: [{ filename: 'undated.vcf', sourcePath: 'undated.vcf',
        uri: `${workingDirectory}extracted/undated.vcf`, modificationTime: null, sizeBytes: 50 }],
      extractedCount: 2
    }));
    const result = await runImport();
    const undated = result.mediaFiles.find((file) => file.filename === 'undated.vcf');
    expect(undated).toMatchObject({ mediaType: 'document', dateSource: 'none', sourceKind: 'zip-media' });
    expect(undated?.dateIso).toBeUndefined();
    expect(undated?.matchedRecord).toBeUndefined();
  });

  it('rejects a raw non-WhatsApp TXT with a coded error and removes partial job output', async () => {
    vi.mocked(extractSupportedZipEntries).mockResolvedValue(extraction({
      transcriptCandidates: [candidate({ sample: 'Raw transcript with no timestamp' })]
    }));
    await expect(runImport()).rejects.toMatchObject({ code: 'NO_TRANSCRIPT' });
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
    expect(FileSystem.deleteAsync).toHaveBeenCalledExactlyOnceWith(workingDirectory, { idempotent: true });
  });

  it('rejects an archive with no TXT candidates and cleans only its own job directory', async () => {
    vi.mocked(extractSupportedZipEntries).mockResolvedValue(extraction({ transcriptCandidates: [], extractedCount: 0 }));
    await expect(runImport()).rejects.toMatchObject({ code: 'NO_TRANSCRIPT' });
    expect(FileSystem.deleteAsync).toHaveBeenCalledExactlyOnceWith(workingDirectory, { idempotent: true });
  });

  it('rejects a selected transcript larger than 16 MiB before reading it into JavaScript', async () => {
    vi.mocked(extractSupportedZipEntries).mockResolvedValue(extraction({
      transcriptCandidates: [candidate({ sizeBytes: MAX_TRANSCRIPT_BYTES + 1 })]
    }));
    await expect(runImport()).rejects.toMatchObject({ code: 'ARCHIVE_LIMIT' });
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(workingDirectory, { idempotent: true });
  });

  it('accepts the documented transcript limit exactly', async () => {
    vi.mocked(extractSupportedZipEntries).mockResolvedValue(extraction({
      transcriptCandidates: [candidate({ sizeBytes: MAX_TRANSCRIPT_BYTES })]
    }));
    await expect(runImport()).resolves.toMatchObject({ operationId });
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledTimes(1);
  });

  it('carries skipped unsafe and unsupported entry reasons into the import summary', async () => {
    const skippedEntries = [
      { sourcePath: '../unsafe.jpg', reason: 'unsafe-path' as const },
      { sourcePath: 'unsupported.bin', reason: 'unsupported-type' as const }
    ];
    vi.mocked(extractSupportedZipEntries).mockResolvedValue(extraction({ skippedCount: 2, skippedEntries }));
    expect((await runImport()).importSummary).toMatchObject({ skippedZipEntries: 2, skippedEntries });
  });

  it('preserves coded native failures including computable space shortage and cleans partial output', async () => {
    vi.mocked(extractSupportedZipEntries).mockRejectedValue({ code: 'NO_SPACE', missingBytes: 4096 });
    await expect(runImport()).rejects.toMatchObject({ code: 'NO_SPACE', missingBytes: 4096 });
    expect(FileSystem.deleteAsync).toHaveBeenCalledExactlyOnceWith(workingDirectory, { idempotent: true });
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
  });
});
