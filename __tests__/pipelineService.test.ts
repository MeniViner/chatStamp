import { describe, expect, it, vi } from 'vitest';
import { runSavePipeline, summarizeNativeSave } from '../src/services/pipelineService';
import { saveMediaNative } from '../src/native/nativeMediaSaver';
import type { ExtractedMediaFile, MediaTypeSelection } from '../src/types/media';

vi.mock('../src/native/nativeMediaSaver', () => ({ saveMediaNative: vi.fn() }));
vi.mock('../src/services/importService', () => ({ clearWorkingDirectory: vi.fn(async () => true) }));

const photo: ExtractedMediaFile = {
  id: 'Photo/IMG.jpg:0', filename: 'IMG.jpg', normalizedFilename: 'img.jpg',
  uri: 'file:///cache/photo.jpg', mediaType: 'photo', dateSource: 'chat',
  timeZone: 'Asia/Jerusalem',
  matchedRecord: {
    id: '1', filename: 'IMG.jpg', normalizedFilename: 'img.jpg', sender: 'Dana',
    messageDateIso: '2019-02-15T08:30:00.000Z', rawLine: ''
  }
};
const selectedMediaTypes: MediaTypeSelection = {
  photo: true, video: true, voice: false, audio: false, sticker: false, gif: false, document: true, unknown: false
};
const archiveFingerprint = 'a'.repeat(64);
const photoSelection = {
  files: [photo], selectedSenders: ['Dana'], selectedMediaTypes, selectedFileIds: [photo.id], archiveFingerprint
};
const saved = {
  entryId: photo.id, filename: photo.filename, ok: true, mediaType: 'photo' as const,
  outcome: 'saved' as const, targetTimestampMillis: Date.parse('2019-02-15T08:30:00Z')
};

describe('scoped save pipeline', () => {
  it('does not count a modification-time match as restoration of the message date', async () => {
    vi.mocked(saveMediaNative).mockResolvedValue({
      mode: 'scoped-media-store',
      results: [{ ...saved, dateVerification: 'mtime-only', timestampSource: 'chat', filesystemTimestampFixed: true }]
    });
    const summary = await runSavePipeline(photoSelection);
    expect(summary).toMatchObject({ saved: 1, dateCorrected: 0, mayShowImportTime: 1 });
    expect(summary.results?.[0]).toMatchObject({ dateCorrectionVerified: false, galleryMaySortByImportTime: true });
  });

  it('preserves and distinguishes a verified capture date from the requested chat date', async () => {
    vi.mocked(saveMediaNative).mockResolvedValue({
      mode: 'scoped-media-store',
      results: [{ ...saved, dateVerification: 'verified', timestampSource: 'capture', targetTimestampMillis: saved.targetTimestampMillis + 86_400_000 }]
    });
    const summary = await runSavePipeline(photoSelection);
    expect(summary).toMatchObject({ saved: 1, dateCorrected: 0, dateCorrectionFailed: 0, mayShowImportTime: 0 });
  });

  it('keeps the selected same-minute ordering offset verified in the live save and native snapshot', async () => {
    const adjusted = { ...photo, saveDateIso: '2019-02-15T08:30:03.000Z' };
    const readback = { ...saved, targetTimestampMillis: saved.targetTimestampMillis + 3000,
      originalTimestampMillis: saved.targetTimestampMillis + 3000, whatsAppDateIso: photo.matchedRecord!.messageDateIso,
      timestampSource: 'chat' as const, dateVerification: 'verified' as const };
    vi.mocked(saveMediaNative).mockResolvedValue({ mode: 'scoped-media-store', results: [readback] });
    const live = await runSavePipeline({ ...photoSelection, files: [adjusted] });
    const restored = await summarizeNativeSave({ mode: 'scoped-media-store', results: [readback] });
    expect(live.dateCorrected).toBe(1);
    expect(restored.dateCorrected).toBe(1);
  });

  it('never upgrades an ambiguous chat date after restoring native completion', async () => {
    const summary = await summarizeNativeSave({ mode: 'scoped-media-store', results: [{ ...saved,
      timestampSource: 'chat', dateVerification: 'verified', originalTimestampMillis: saved.targetTimestampMillis,
      whatsAppDateIso: photo.matchedRecord!.messageDateIso, dateAmbiguous: true }] });
    expect(summary.dateCorrected).toBe(0);
  });

  it('sends undated selected documents to the native saver with a stable archive and entry identity', async () => {
    const document: ExtractedMediaFile = { ...photo, id: 'note', filename: 'notes.txt', mediaType: 'document',
      matchedRecord: { ...photo.matchedRecord!, messageDateIso: 'invalid' }, dateSource: 'none' };
    vi.mocked(saveMediaNative).mockResolvedValue({
      mode: 'scoped-media-store',
      results: [{ ...saved, entryId: document.id, mediaType: 'document', dateVerification: 'unverified', targetTimestampMillis: null }]
    });
    const summary = await runSavePipeline({ ...photoSelection, files: [document], selectedFileIds: [document.id] });
    expect(saveMediaNative).toHaveBeenLastCalledWith(
      [expect.objectContaining({ entryId: document.id, timestampMillis: undefined, mimeType: 'text/plain' })],
      expect.objectContaining({ archiveFingerprint, alwaysUseMessageDate: false, duplicateHandling: 'skip-existing' }),
      undefined
    );
    expect(summary).toMatchObject({ saved: 1, failed: 0, dateCorrected: 0 });
  });
});
