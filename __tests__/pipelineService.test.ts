import { describe, expect, it, vi } from 'vitest';
import type { NativeSaveMediaResult } from '../src/native/chatStampNativeModule';
import { saveMediaTermuxParityNative } from '../src/native/nativeMediaSaver';
import { runSavePipeline } from '../src/services/pipelineService';
import type { ExtractedMediaFile } from '../src/types/media';

vi.mock('../src/native/nativeMediaSaver', () => ({
  saveMediaTermuxParityNative: vi.fn(),
  saveMediaToSafFolderNative: vi.fn()
}));

vi.mock('../src/services/importService', () => ({ clearWorkingDirectory: async () => true }));

describe('legacy save bridge readback', () => {
  it('does not count an MP4 with only its filesystem time corrected', async () => {
    const dateIso = '2019-02-16T09:30:00.000Z';
    const timestamp = Date.parse(dateIso);
    const file: ExtractedMediaFile = {
      id: 'video',
      filename: 'video.mp4',
      normalizedFilename: 'video.mp4',
      uri: 'file:///cache/video.mp4',
      mediaType: 'video',
      dateSource: 'chat',
      dateIso,
      matchedRecord: {
        id: 'message', filename: 'video.mp4', normalizedFilename: 'video.mp4',
        sender: 'Dana', messageDateIso: dateIso, rawLine: ''
      }
    };
    const native: NativeSaveMediaResult = {
      saved: 1, failed: 0, dateCorrected: 1, dateCorrectionFailed: 0, filesystemTimestampFixed: 1,
      results: [{
        ok: true, filename: file.filename, mediaType: 'video', originalTimestampMillis: timestamp,
        dateCorrectionSupported: true, dateCorrectionVerified: true, filesystemTimestampFixed: true,
        mediaScannerCompleted: true, galleryMaySortByImportTime: false, metadataWritten: true,
        mediaStoreValues: { dateTaken: Date.parse('2022-07-08T09:10:11Z'), dateModifiedMillis: timestamp }
      }]
    };
    vi.mocked(saveMediaTermuxParityNative).mockResolvedValue(native);

    const completion = await runSavePipeline({
      files: [file],
      selectedSenders: ['Dana'],
      selectedMediaTypes: { photo: true, video: true, voice: false, audio: false, sticker: false, gif: false, document: false, unknown: false },
      selectedFileIds: [file.id]
    });

    expect(completion).toMatchObject({ saved: 1, dateCorrected: 0, dateCorrectionFailed: 1 });
    expect(completion.results?.[0]).toMatchObject({ dateCorrectionVerified: false, galleryMaySortByImportTime: true });
  });
});
