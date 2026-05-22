import * as FileSystem from 'expo-file-system/legacy';
import { getLatestWhatsAppMessageDateIso, parseWhatsAppChatText } from '../lib/chatParser';
import { classifyMedia, isSupportedForMvp } from '../lib/mediaClassifier';
import { attachChatRecordsToMedia } from '../lib/matcher';
import { normalizeFilename } from '../lib/filename';
import { logger } from '../lib/logger';
import { extractSupportedZipEntries } from '../native/zipExtractor';
import type { ChatMediaRecord, ExtractedMediaFile, ImportSummary, ProcessingProgress } from '../types/media';

export const CHAT_TRANSCRIPT_SENDER = 'Chat transcript';

export type ImportPipelineResult = {
  workingDirectory: string;
  copiedZipUri: string;
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
  onProgress?: (progress: ProcessingProgress) => void;
};

export async function importWhatsAppZip({
  zipUri,
  zipName,
  onProgress
}: ImportWhatsAppZipParams): Promise<ImportPipelineResult> {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) {
    throw new Error('App cache directory is not available.');
  }

  const workingDirectory = `${cacheDirectory}chatstamp/${Date.now()}/`;
  const extractionDirectory = `${workingDirectory}extracted/`;
  const copiedZipUri = `${workingDirectory}${sanitizeFileName(zipName || 'whatsapp-export.zip')}`;

  try {
    logger.info('Import started', { zipName });
    onProgress?.({ stageLabel: 'Preparing cache', processed: 0, total: 7, failed: 0 });
    await FileSystem.makeDirectoryAsync(extractionDirectory, { intermediates: true });

    onProgress?.({ stageLabel: 'Copying ZIP', processed: 1, total: 7, failed: 0 });
    await FileSystem.copyAsync({ from: zipUri, to: copiedZipUri });
    logger.debug('ZIP copied to cache', { from: zipUri, to: copiedZipUri });

    onProgress?.({ stageLabel: 'Validating ZIP and reading entries', processed: 2, total: 7, failed: 0 });
    const extraction = await extractSupportedZipEntries(copiedZipUri, extractionDirectory);
    logger.debug('ZIP entries discovered', {
      extractedCount: extraction.extractedCount,
      skippedCount: extraction.skippedCount,
      mediaFiles: extraction.mediaFiles.length,
      txtFiles: extraction.txtFiles
    });
    logger.debug('TXT transcript candidates discovered', extraction.transcriptCandidates);
    if (!extraction.chatFileUri) {
      const txtDetails =
        extraction.txtFiles.length > 0 ? ` TXT files found: ${extraction.txtFiles.join(', ')}` : ' No TXT files were found.';
      throw new Error(`No WhatsApp chat transcript TXT file was found in this export.${txtDetails}`);
    }
    logger.debug('Selected transcript filename', extraction.chatFilename ?? extraction.chatFileUri);

    onProgress?.({ stageLabel: 'Finding transcript and parsing messages', processed: 4, total: 7, failed: 0 });
    const chatText = await FileSystem.readAsStringAsync(extraction.chatFileUri);
    const parsedChat = parseWhatsAppChatText(chatText);
    const transcriptDateIso = getLatestWhatsAppMessageDateIso(chatText);
    logger.debug('Number of parsed messages', parsedChat.records.length);

    const extractedMediaFiles = extraction.mediaFiles
      .filter((file) => isSupportedForMvp(file.filename))
      .map<ExtractedMediaFile>((file, index) => ({
        id: `${file.sourcePath}:${index}`,
        filename: file.filename,
        normalizedFilename: normalizeFilename(file.filename),
        uri: file.uri,
        mediaType: classifyMedia(file.filename),
        sourceKind: 'zip-media',
        matchedRecord: undefined
      }));
    if (extractedMediaFiles.length === 0) {
      logger.warn('No supported media files found in export', {
        txtFiles: extraction.txtFiles,
        chatRecords: parsedChat.records.length
      });
    }

    onProgress?.({ stageLabel: 'Matching and classifying media', processed: 5, total: 7, failed: 0 });
    const matchedMediaFiles = attachChatRecordsToMedia(extractedMediaFiles, parsedChat.records);
    const transcriptFile = buildTranscriptFile({
      chatFileUri: extraction.chatFileUri,
      chatFilename: extraction.chatFilename,
      transcriptDateIso,
      chatRecords: parsedChat.records
    });
    const mediaFiles = transcriptFile ? [transcriptFile, ...matchedMediaFiles] : matchedMediaFiles;
    logger.debug('Number of media references matched', mediaFiles.filter((file) => file.matchedRecord).length);
    const importSummary = buildImportSummary(mediaFiles, parsedChat.records.length, parsedChat.skippedLines.length, {
      extractedCount: extraction.extractedCount,
      skippedCount: extraction.skippedCount,
      extractionMode: extraction.extractionMode
    });

    logger.debug('mediaCategorizationSummary', importSummary);
    logger.info('Import completed', {
      matchedMedia: importSummary.matchedMedia,
      photos: importSummary.photos,
      videos: importSummary.videos,
      other: importSummary.voice + importSummary.stickers + importSummary.documents + importSummary.unknown
    });
    onProgress?.({ stageLabel: 'Import ready', processed: 7, total: 7, failed: 0 });

    return {
      workingDirectory,
      copiedZipUri,
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
    throw error;
  }
}

function buildTranscriptFile({
  chatFileUri,
  chatFilename,
  transcriptDateIso,
  chatRecords
}: {
  chatFileUri: string;
  chatFilename?: string | null;
  transcriptDateIso?: string | null;
  chatRecords: ChatMediaRecord[];
}): ExtractedMediaFile {
  const filename = chatFilename?.trim() || '_chat.txt';
  const timestampIso = transcriptDateIso ?? getTranscriptTimestampIso(chatRecords);
  const record: ChatMediaRecord = {
    id: `chat-transcript:${normalizeFilename(filename)}`,
    filename,
    normalizedFilename: normalizeFilename(filename),
    sender: CHAT_TRANSCRIPT_SENDER,
    messageDateIso: timestampIso,
    rawLine: ''
  };

  return {
    id: `chat-transcript:${normalizeFilename(filename)}`,
    filename,
    normalizedFilename: normalizeFilename(filename),
    uri: chatFileUri,
    mediaType: 'document',
    sourceKind: 'chat-transcript',
    matchedRecord: record
  };
}

function getTranscriptTimestampIso(chatRecords: ChatMediaRecord[], now = new Date()): string {
  const timestamps = chatRecords
    .map((record) => new Date(record.messageDateIso).getTime())
    .filter(Number.isFinite);
  if (timestamps.length === 0) return now.toISOString();
  return new Date(Math.max(...timestamps)).toISOString();
}

function buildImportSummary(
  mediaFiles: ExtractedMediaFile[],
  chatRecords: number,
  skippedChatLines: number,
  extraction: { extractedCount: number; skippedCount: number; extractionMode: 'native-selective' }
): ImportSummary {
  const exportedMediaFiles = mediaFiles.filter((file) => file.sourceKind !== 'chat-transcript');
  const matchedMedia = exportedMediaFiles.filter((file) => file.matchedRecord).length;
  const senders = new Set(mediaFiles.map((file) => file.matchedRecord?.sender).filter(Boolean)).size;
  const count = (type: string) => mediaFiles.filter((file) => file.mediaType === type).length;

  return {
    chatRecords,
    skippedChatLines,
    extractedEntries: extraction.extractedCount,
    skippedZipEntries: extraction.skippedCount,
    matchedMedia,
    unmatchedMedia: exportedMediaFiles.length - matchedMedia,
    senders,
    photos: count('photo'),
    videos: count('video'),
    voice: count('voice'),
    stickers: count('sticker'),
    documents: count('document'),
    unknown: count('unknown'),
    extractionMode: extraction.extractionMode
  };
}

export async function clearWorkingDirectory(workingDirectory?: string): Promise<boolean> {
  if (!workingDirectory) return false;

  try {
    await FileSystem.deleteAsync(workingDirectory, { idempotent: true });
    logger.debug('Cache cleanup', { workingDirectory, ok: true });
    return true;
  } catch (error) {
    logger.warn('Cache cleanup failed', { workingDirectory, error });
    return false;
  }
}

function sanitizeFileName(filename: string): string {
  const baseName = filename.split(/[\\/]/).pop() ?? 'whatsapp-export.zip';
  const safeName = baseName.replace(/[^a-zA-Z0-9_.() -]/g, '_').trim();
  return safeName || 'whatsapp-export.zip';
}
