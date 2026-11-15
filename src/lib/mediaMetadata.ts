import type { ExtractedMediaFile } from '../types/media';

export const UNKNOWN_SENDER = '\u0000unknown';
export const CHAT_TRANSCRIPT_SENDER = 'Chat transcript';

export function getMediaSender(file: Pick<ExtractedMediaFile, 'sourceKind' | 'matchedRecord'>): string {
  if (file.sourceKind === 'chat-transcript') return CHAT_TRANSCRIPT_SENDER;
  return file.matchedRecord?.sender ?? UNKNOWN_SENDER;
}

export function getMediaDateIso(file: ExtractedMediaFile): string | undefined {
  return file.dateIso ?? file.matchedRecord?.messageDateIso;
}

export function getMediaSaveTime(file: ExtractedMediaFile): number | undefined {
  const value = Date.parse(file.saveDateIso ?? getMediaDateIso(file) ?? '');
  return Number.isFinite(value) ? value : undefined;
}

export function isApproximateDate(file: ExtractedMediaFile): boolean {
  return file.dateAmbiguous === true || file.dateSource === 'filename' || file.dateSource === 'zip-entry';
}
