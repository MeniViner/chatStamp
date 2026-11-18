import * as FileSystem from 'expo-file-system/legacy';
import { parseWhatsAppChatTextAsync, type ChatParseResult } from '../lib/chatParser';
import { classifyMedia, isSupportedForMvp } from '../lib/mediaClassifier';
import { attachChatRecordsToMedia } from '../lib/matcher';
import { normalizeFilename } from '../lib/filename';
import { CHAT_TRANSCRIPT_SENDER, getMediaSender } from '../lib/mediaMetadata';
import { logger } from '../lib/logger';
import { extractSupportedZipEntries } from '../native/zipExtractor';
import { getChatStampNativeModule } from '../native/chatStampNativeModule';
import { chooseBestTranscriptCandidate } from '../lib/transcriptDetection';
import { PipelineError, asPipelineError } from '../lib/pipelineErrors';
import { createOperationId } from '../lib/operationProgress';
import type { ChatMediaRecord, ExtractedMediaFile, ImportSummary, ProcessingProgress } from '../types/media';

export type ImportPipelineResult = {
  workingDirectory: string;
  operationId: string;
  archiveFingerprint: string;
  chatRecords: ChatMediaRecord[];
  skippedChatLines: string[];
  mediaFiles: ExtractedMediaFile[];
  importSummary: ImportSummary;
  extraction: {
    extractedCount: number;
    skippedCount: number;
    extractionMode: 'native-selective';
  };
};

export type ImportWhatsAppZipParams = {
  zipUri: string;
  zipName: string;
  operationId?: string;
  onProgress?: (progress: ProcessingProgress) => void;
};

export { CHAT_TRANSCRIPT_SENDER };

export async function importWhatsAppZip({
  zipUri,
  zipName,
  operationId = createOperationId('import'),
  onProgress
}: ImportWhatsAppZipParams): Promise<ImportPipelineResult> {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) {
    throw new PipelineError('IO_ERROR', 'App cache directory is not available.');
  }

  const workingDirectory = `${cacheDirectory}chatstamp/${operationId}/`;
  const extractionDirectory = `${workingDirectory}extracted/`;

  try {
    logger.info('Import started', { zipName });
    await FileSystem.makeDirectoryAsync(extractionDirectory, { intermediates: true });
    const extraction = await extractSupportedZipEntries(zipUri, extractionDirectory, operationId, onProgress);
    logger.debug('ZIP entries discovered', {
      extractedCount: extraction.extractedCount,
      skippedCount: extraction.skippedCount,
      mediaFiles: extraction.mediaFiles.length
    });
    const choice = chooseBestTranscriptCandidate(extraction.transcriptCandidates.map((candidate) => ({
      filename: candidate.sourcePath, sample: candidate.sample
    })));
    const transcript = extraction.transcriptCandidates.find((candidate) => candidate.sourcePath === choice?.filename);
    if (!transcript) throw new PipelineError('NO_TRANSCRIPT');
    if (transcript.sizeBytes > MAX_TRANSCRIPT_BYTES) throw new PipelineError('ARCHIVE_LIMIT', 'Transcript exceeds the 16 MiB parsing limit.');
    logger.debug('Selected transcript filename', transcript.filename);

    const occurrences = new Map<string, number>();
    const extractedMediaFiles = [...extraction.mediaFiles, ...extraction.transcriptCandidates.filter((candidate) => candidate !== transcript)]
      .filter((file) => isSupportedForMvp(file.filename))
      .map<ExtractedMediaFile>((file) => {
        const sourcePath = file.sourcePath.replace(/\\/g, '/');
        const occurrence = occurrences.get(sourcePath) ?? 0;
        occurrences.set(sourcePath, occurrence + 1);
        return {
          id: JSON.stringify([sourcePath, occurrence]),
          filename: file.filename,
          normalizedFilename: normalizeFilename(file.filename),
          sourcePath,
          modificationTime: file.modificationTime ?? undefined,
          sizeBytes: file.sizeBytes,
          uri: file.uri,
          mediaType: classifyMedia(file.filename),
          sourceKind: 'zip-media'
        };
      });
    const chatText = await FileSystem.readAsStringAsync(transcript.uri);
    const parsedChat = await parseWhatsAppChatTextAsync(chatText, extractedMediaFiles);
    logger.debug('Number of parsed messages', parsedChat.preview.totalMessages);
    if (extractedMediaFiles.length === 0) {
      logger.warn('No supported media files found in export', {
        txtFiles: extraction.transcriptCandidates.map((candidate) => candidate.filename),
        chatRecords: parsedChat.records.length
      });
    }

    const matchedMediaFiles = attachChatRecordsToMedia(
      extractedMediaFiles, parsedChat.records, parsedChat.timeZone, parsedChat.timeZoneAssumed
    );
    const transcriptFile = { ...buildTranscriptFile(transcript.uri, transcript.filename, parsedChat), sizeBytes: transcript.sizeBytes };
    const mediaFiles = [transcriptFile, ...matchedMediaFiles];
    logger.debug('Number of media references matched', mediaFiles.filter((file) => file.matchedRecord).length);
    const importSummary = buildImportSummary(mediaFiles, parsedChat.records.length, parsedChat.skippedLines.length, {
      extractedCount: extraction.extractedCount,
      skippedCount: extraction.skippedCount,
      skippedEntries: extraction.skippedEntries,
      extractionMode: extraction.extractionMode
    });

    logger.debug('mediaCategorizationSummary', importSummary);
    logger.info('Import completed', {
      matchedMedia: importSummary.matchedMedia,
      photos: importSummary.photos,
      videos: importSummary.videos,
      other: mediaFiles.length - importSummary.photos - importSummary.videos
    });

    return {
      workingDirectory,
      operationId,
      archiveFingerprint: extraction.archiveFingerprint,
      chatRecords: parsedChat.records,
      skippedChatLines: parsedChat.skippedLines,
      mediaFiles,
      importSummary,
      extraction: {
        extractedCount: extraction.extractedCount,
        skippedCount: extraction.skippedCount,
        extractionMode: extraction.extractionMode
      }
    };
  } catch (error) {
    await clearWorkingDirectory(workingDirectory);
    throw asPipelineError(error);
  }
}

function buildTranscriptFile(
  chatFileUri: string, chatFilename: string | null | undefined, parsedChat: ChatParseResult
): ExtractedMediaFile {
  const filename = chatFilename?.trim() || '_chat.txt';
  const normalizedFilename = normalizeFilename(filename);
  const id = `chat-transcript:${normalizedFilename}`;
  const dateIso = parsedChat.latestMessageDateIso ?? undefined;
  const record: ChatMediaRecord | undefined = dateIso ? {
    id,
    filename,
    normalizedFilename,
    sender: CHAT_TRANSCRIPT_SENDER,
    messageDateIso: dateIso,
    rawLine: ''
  } : undefined;

  return {
    id,
    filename,
    normalizedFilename,
    uri: chatFileUri,
    mediaType: 'document',
    sourceKind: 'chat-transcript',
    matchedRecord: record,
    dateSource: dateIso ? 'chat' : 'none',
    dateIso,
    timeZone: parsedChat.timeZone,
    timeZoneAssumed: parsedChat.timeZoneAssumed,
    transcriptPreview: parsedChat.preview
  };
}

function buildImportSummary(
  mediaFiles: ExtractedMediaFile[],
  chatRecords: number,
  skippedChatLines: number,
  extraction: { extractedCount: number; skippedCount: number; skippedEntries: ImportSummary['skippedEntries']; extractionMode: 'native-selective' }
): ImportSummary {
  const exportedMediaFiles = mediaFiles.filter((file) => file.sourceKind !== 'chat-transcript');
  const matchedMedia = exportedMediaFiles.filter((file) => file.matchedRecord).length;
  const senders = new Set(mediaFiles.map(getMediaSender)).size;
  const count = (type: string) => mediaFiles.filter((file) => file.mediaType === type).length;

  return {
    chatRecords,
    skippedChatLines,
    extractedEntries: extraction.extractedCount,
    skippedZipEntries: extraction.skippedCount,
    skippedEntries: extraction.skippedEntries,
    matchedMedia,
    unmatchedMedia: exportedMediaFiles.length - matchedMedia,
    senders,
    photos: count('photo'),
    videos: count('video'),
    voice: count('voice'),
    audio: count('audio'),
    stickers: count('sticker'),
    gifs: count('gif'),
    documents: count('document'),
    unknown: count('unknown'),
    extractionMode: extraction.extractionMode
  };
}

export async function clearWorkingDirectory(workingDirectory?: string): Promise<boolean> {
  if (!workingDirectory) return false;

  try {
    await getChatStampNativeModule().releaseImportAsync('', workingDirectory, '');
    logger.debug('Cache cleanup', { workingDirectory, ok: true });
    return true;
  } catch (error) {
    logger.warn('Cache cleanup failed', { workingDirectory, error });
    return false;
  }
}

export const MAX_TRANSCRIPT_BYTES = 16 * 1024 * 1024;
