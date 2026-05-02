import type { ChatMediaRecord, ExtractedMediaFile } from '../types/media';

export function attachChatRecordsToMedia(
  mediaFiles: ExtractedMediaFile[],
  chatRecords: ChatMediaRecord[]
): ExtractedMediaFile[] {
  const recordsByFilename = new Map<string, ChatMediaRecord[]>();

  for (const record of chatRecords) {
    const bucket = recordsByFilename.get(record.normalizedFilename) ?? [];
    bucket.push(record);
    recordsByFilename.set(record.normalizedFilename, bucket);
  }

  const nextMatchIndexByFilename = new Map<string, number>();

  return mediaFiles.map((file) => {
    const matches = recordsByFilename.get(file.normalizedFilename) ?? [];
    const nextMatchIndex = nextMatchIndexByFilename.get(file.normalizedFilename) ?? 0;
    nextMatchIndexByFilename.set(file.normalizedFilename, nextMatchIndex + 1);

    return {
      ...file,
      matchedRecord: matches[nextMatchIndex]
    };
  });
}
