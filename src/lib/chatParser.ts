import type { ChatMediaRecord } from '../types/media';
import { normalizeFilename } from './filename';
import { parseWhatsAppDateToIso, stripDirectionMarks } from './whatsappDate';

export type ChatParseResult = {
  records: ChatMediaRecord[];
  skippedLines: string[];
};

export type ChatPreviewMessage = {
  id: string;
  sender: string;
  messageDateIso: string;
  body: string;
  rawText: string;
};

export type ChatPreviewParseResult = {
  messages: ChatPreviewMessage[];
  totalMessages: number;
  skippedLines: string[];
  truncated: boolean;
};

type ParsedChatMessage = {
  date: string;
  time: string;
  sender: string;
  message: string;
  rawText: string;
};

const HEADER_PATTERNS = [
  // Example: 31/12/2024, 18:42 - Sender Name: <attached: IMG-20241231-WA0001.jpg>
  /^(?<date>\d{1,2}[./-]\d{1,2}[./-]\d{2,4}),?\s*(?<time>\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s*-\s*(?<sender>.*?):\s*(?<message>.*)$/i,
  // Example: [31/12/2024, 18:42:01] Sender Name: IMG-20241231-WA0001.jpg (file attached)
  /^\[(?<date>\d{1,2}[./-]\d{1,2}[./-]\d{2,4}),?\s*(?<time>\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s*(?:-\s*)?(?<sender>.*?):\s*(?<message>.*)$/i
];

const MEDIA_EXTENSION_PATTERN = 'jpe?g|png|heic|webp|mp4|mov|m4v|3gp|opus|ogg';
const FILENAME_PATTERNS = [
  /<attached:\s*(?<filename>[^>]+)>/i,
  new RegExp(`(?<filename>[\\p{L}\\p{N}_ .()[\\]-]+\\.(?:${MEDIA_EXTENSION_PATTERN}))`, 'iu')
];

export function parseWhatsAppChatText(text: string): ChatParseResult {
  const records: ChatMediaRecord[] = [];
  const skippedLines: string[] = [];
  const messages = groupLinesIntoMessages(text, skippedLines);

  for (const message of messages) {
    const parsed = parseMessage(message);
    if (!parsed) {
      skippedLines.push(message.rawText);
      continue;
    }

    records.push(parsed);
  }

  return { records, skippedLines };
}

export function getLatestWhatsAppMessageDateIso(text: string): string | null {
  const messages = groupLinesIntoMessages(text, []);
  const timestamps = messages
    .map((message) => parseWhatsAppDateToIso(message.date, message.time))
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);

  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

export function parseWhatsAppChatPreview(text: string, maxMessages = 160): ChatPreviewParseResult {
  const skippedLines: string[] = [];
  const groupedMessages = groupLinesIntoMessages(text, skippedLines);
  const messages = groupedMessages
    .map((message, index) => {
      const messageDateIso = parseWhatsAppDateToIso(message.date, message.time);
      const sender = message.sender.trim();
      if (!messageDateIso || !sender) return null;

      return {
        id: `${messageDateIso}:${sender}:${index}`,
        sender,
        messageDateIso,
        body: message.message.trim(),
        rawText: message.rawText
      };
    })
    .filter((message): message is ChatPreviewMessage => Boolean(message));

  return {
    messages: messages.slice(0, maxMessages),
    totalMessages: messages.length,
    skippedLines,
    truncated: messages.length > maxMessages
  };
}

function groupLinesIntoMessages(text: string, skippedLines: string[]): ParsedChatMessage[] {
  const messages: ParsedChatMessage[] = [];
  const lines = text.split(/\r?\n/);
  let current:
    | {
        date: string;
        time: string;
        sender: string;
        messageLines: string[];
        rawLines: string[];
      }
    | undefined;

  function flushCurrent() {
    if (!current) return;
    messages.push({
      date: current.date,
      time: current.time,
      sender: current.sender,
      message: current.messageLines.join('\n'),
      rawText: current.rawLines.join('\n')
    });
    current = undefined;
  }

  for (const rawLine of lines) {
    const line = stripDirectionMarks(rawLine).trim();
    if (!line) continue;

    const header = parseHeader(line);
    if (header) {
      flushCurrent();
      current = {
        date: header.date,
        time: header.time,
        sender: header.sender,
        messageLines: [header.message],
        rawLines: [rawLine]
      };
      continue;
    }

    if (current) {
      current.messageLines.push(line);
      current.rawLines.push(rawLine);
    } else {
      skippedLines.push(rawLine);
    }
  }

  flushCurrent();
  return messages;
}

function parseHeader(line: string): ParsedChatMessage | null {
  for (const pattern of HEADER_PATTERNS) {
    const match = line.match(pattern);
    const groups = match?.groups;
    if (!groups) continue;

    return {
      date: groups.date,
      time: groups.time,
      sender: groups.sender,
      message: groups.message,
      rawText: line
    };
  }

  return null;
}

function parseMessage(message: ParsedChatMessage): ChatMediaRecord | null {
  const messageDateIso = parseWhatsAppDateToIso(message.date, message.time);
  if (!messageDateIso) return null;

  const filename = extractFilename(message.message);
  if (!filename) return null;

  const sender = message.sender.trim();
  if (!sender) return null;

  const normalizedFilename = normalizeFilename(filename);

  return {
    id: `${messageDateIso}:${sender}:${normalizedFilename}`,
    filename,
    normalizedFilename,
    sender,
    messageDateIso,
    rawLine: message.rawText
  };
}

function extractFilename(message: string): string | null {
  for (const pattern of FILENAME_PATTERNS) {
    const match = message.match(pattern);
    const filename = match?.groups?.filename?.trim();
    if (filename) return filename;
  }
  return null;
}
