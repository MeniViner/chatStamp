import { describe, expect, it } from 'vitest';
import { mapDateCorrectionStatus } from '../src/services/dateCorrectionResult';
import type { NativeSavedMediaFileResult } from '../src/native/chatStampNativeModule';

function result(overrides: Partial<NativeSavedMediaFileResult>): NativeSavedMediaFileResult {
  return {
    filename: 'a.jpg',
    ok: true,
    originalTimestampMillis: 1,
    dateCorrectionSupported: true,
    dateCorrectionVerified: false,
    galleryMaySortByImportTime: false,
    metadataWritten: false,
    ...overrides
  };
}

describe('mapDateCorrectionStatus', () => {
  it('maps verified', () => {
    expect(mapDateCorrectionStatus(result({ dateCorrectionVerified: true }))).toBe('verified');
  });

  it('maps unsupported', () => {
    expect(mapDateCorrectionStatus(result({ dateCorrectionSupported: false }))).toBe('unsupported');
  });

  it('maps MP4 box rewrite failure before generic unsupported', () => {
    expect(mapDateCorrectionStatus(result({
      dateCorrectionSupported: false,
      failureReason: 'MP4 boxes were not rewritten'
    }))).toBe('mp4_boxes_not_rewritten');
  });

  it('maps native MP4 box rewrite failure code before generic unsupported', () => {
    expect(mapDateCorrectionStatus(result({
      dateCorrectionSupported: false,
      failureReason: 'mp4BoxRewriteFailed',
      mp4RewriteFailureCode: 'mp4BoxRewriteFailed'
    }))).toBe('mp4_boxes_not_rewritten');
  });

  it('maps MP4 retriever missing after box rewrite', () => {
    expect(mapDateCorrectionStatus(result({
      failureReason: 'MP4 boxes were rewritten, but Android MediaMetadataRetriever did not expose a date'
    }))).toBe('mp4_boxes_updated_retriever_missing');
  });

  it('maps native MP4 retriever missing failure reason', () => {
    expect(mapDateCorrectionStatus(result({
      failureReason: 'mp4BoxesUpdatedButRetrieverDateMissing'
    }))).toBe('mp4_boxes_updated_retriever_missing');
  });

  it('maps MP4 MediaStore indexing failure', () => {
    expect(mapDateCorrectionStatus(result({
      failureReason: 'MP4 boxes were rewritten and retriever date was correct, but MediaStore did not index the date'
    }))).toBe('mp4_retriever_ok_mediastore_missing');
  });

  it('maps may show import time', () => {
    expect(mapDateCorrectionStatus(result({ galleryMaySortByImportTime: true }))).toBe('may_show_import_time');
  });

  it('maps failed', () => {
    expect(mapDateCorrectionStatus(result({}))).toBe('failed');
  });
});
