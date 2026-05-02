import type { NativeSavedMediaFileResult } from '../native/timeFixerNativeModule';

export type DateCorrectionStatus =
  | 'verified'
  | 'unsupported'
  | 'mp4_boxes_not_rewritten'
  | 'mp4_boxes_updated_retriever_missing'
  | 'mp4_retriever_ok_mediastore_missing'
  | 'failed'
  | 'may_show_import_time';

export function mapDateCorrectionStatus(result: NativeSavedMediaFileResult): DateCorrectionStatus {
  if (result.dateCorrectionVerified) return 'verified';
  if (result.failureReason === 'MP4 boxes were not rewritten' || result.failureReason === 'mp4BoxRewriteFailed' || result.mp4RewriteFailureCode === 'mp4BoxRewriteFailed') {
    return 'mp4_boxes_not_rewritten';
  }
  if (result.failureReason === 'MP4 boxes were rewritten, but Android MediaMetadataRetriever did not expose a date' || result.failureReason === 'mp4BoxesUpdatedButRetrieverDateMissing') {
    return 'mp4_boxes_updated_retriever_missing';
  }
  if (result.failureReason === 'MP4 boxes were rewritten and retriever date was correct, but MediaStore did not index the date') {
    return 'mp4_retriever_ok_mediastore_missing';
  }
  if (!result.dateCorrectionSupported) return 'unsupported';
  if (result.galleryMaySortByImportTime) return 'may_show_import_time';
  return 'failed';
}
