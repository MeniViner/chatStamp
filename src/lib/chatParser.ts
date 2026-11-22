import type { ChatMediaRecord, ChatPreview, ExtractedMediaFile } from '../types/media';
import { normalizeArchivePath, normalizeFilename } from './filename';
import {
  chooseDateOrder, createLocalDateResolver, DATE_PART_PATTERN, getWallTime, normalizeChatText,
  readLocalChatTime, TIME_PART_PATTERN, type DateOrder, type LocalChatTime
} from './whatsappDate';

type ArchiveEntry = Pick<ExtractedMediaFile, 'id' | 'filename' | 'sourcePath'>;
type ParseOptions = { timeZone?: string; previewLimit?: number };

export type ChatParseResult = {
  records: ChatMediaRecord[];
  skippedLines: string[];
  dateOrder: DateOrder;
  timeZone: string;
  timeZoneAssumed: boolean;
  latestMessageDateIso: string | null;
  preview: ChatPreview;
};

type Header = { date: string; time: string; body: string };
type Group = { header: Header; local?: LocalChatTime; rawLines: string[]; continuation: string[] };

const headerDate = `(?<date>${DATE_PART_PATTERN}),?\\s*(?<time>${TIME_PART_PATTERN})`;
const headers = [
  new RegExp(`^${headerDate}\\s*-\\s*(?<body>.*)$`, 'i'),
  new RegExp(`^\\[${headerDate}\\]\\s*(?:-\\s*)?(?<body>.*)$`, 'i')
];
const iosAttachment = /^<attached:\s*([^>]+)>\s*$/i;
const androidAttachment = /\s+\((?:file attached|הקובץ מצורף|מצורף קובץ)\)\s*$/i;
const linesPerSlice = 512;

export function parseWhatsAppChatText(
  text: string, files: readonly ArchiveEntry[] = [], options: ParseOptions = {}
): ChatParseResult {
  const work = parseChat(text, files, options);
  let result = work.next();
  while (!result.done) result = work.next();
  return result.value;
}

export async function parseWhatsAppChatTextAsync(
  text: string, files: readonly ArchiveEntry[], options: ParseOptions = {}
): Promise<ChatParseResult> {
  const work = parseChat(text, files, options);
  let result = work.next();
  while (!result.done) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    result = work.next();
  }
  return result.value;
}

export function isWhatsAppMessageLine(line: string): boolean {
  const header = parseHeader(normalizeChatText(line).trim());
  return !!header && header.body.indexOf(':') > 0;
}

/** Date, time and remaining text of a WhatsApp message header line, after removing direction marks. */
export function parseWhatsAppLineHeader(line: string): Readonly<Header> | undefined {
  return parseHeader(normalizeChatText(line).trim());
}

/** The attached file name in a message body, in either the Android or the iOS export form. */
export function attachedFileName(body: string): string | undefined {
  const tagged = iosAttachment.exec(body)?.[1];
  if (tagged) return tagged.trim();
  const suffix = androidAttachment.exec(body);
  return suffix ? body.slice(0, suffix.index).trim() : undefined;
}

function parseHeader(line: string): Header | undefined {
  for (const pattern of headers) {
    const groups = pattern.exec(line)?.groups;
    if (groups) return { date: groups.date, time: groups.time, body: groups.body };
  }
  return undefined;
}

function indexArchive(files: readonly ArchiveEntry[]) {
  const paths = new Map<string, ArchiveEntry | null>();
  const names = new Map<string, ArchiveEntry | null>();
  for (const file of files) {
    const path = normalizeArchivePath(file.sourcePath ?? file.filename);
    const name = normalizeFilename(file.filename);
    paths.set(path, paths.has(path) ? null : file);
    names.set(name, names.has(name) ? null : file);
  }
  return (body: string, allowBare: boolean): ArchiveEntry | undefined => {
    const tagged = iosAttachment.exec(body)?.[1];
    const suffix = androidAttachment.exec(body);
    const name = tagged ?? (suffix ? body.slice(0, suffix.index) : allowBare ? body : '');
    if (!name) return undefined;
    const path = normalizeArchivePath(name);
    return (path.includes('/') ? paths.get(path) : names.get(path)) ?? undefined;
  };
}

function readMessage(group: Group, findFile: ReturnType<typeof indexArchive>) {
  const line = group.header.body;
  const firstColon = line.indexOf(':');
  if (firstColon < 1) return undefined;

  let separator = firstColon;
  let file: ArchiveEntry | undefined;
  for (let colon = firstColon; colon >= 0; colon = line.indexOf(':', colon + 1)) {
    file = findFile(line.slice(colon + 1).trim(), true);
    if (file) {
      separator = colon;
      break;
    }
  }

  const sender = line.slice(0, separator).trim();
  if (!sender) return undefined;
  for (const continuation of group.continuation) {
    file ??= findFile(continuation, false);
  }
  const body = [line.slice(separator + 1).trim(), ...group.continuation].join('\n').trim();
  return { sender, body, file };
}

function* parseChat(text: string, files: readonly ArchiveEntry[], options: ParseOptions): Generator<void, ChatParseResult> {
  const skippedLines: string[] = [];
  const groups: Group[] = [];
  const dateFields: LocalChatTime[] = [];
  let current: Group | undefined;
  const lines = text.split(/\r\n?|\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (index > 0 && index % linesPerSlice === 0) yield;
    const rawLine = lines[index];
    const line = normalizeChatText(rawLine).trim();
    if (!line) continue;
    const header = parseHeader(line);
    if (header) {
      const local = readLocalChatTime(header.date, header.time);
      current = { header, local, rawLines: [rawLine], continuation: [] };
      groups.push(current);
      if (local && header.body.indexOf(':') > 0) dateFields.push(local);
    } else if (current) {
      current.rawLines.push(rawLine);
      current.continuation.push(line);
    } else {
      skippedLines.push(rawLine);
    }
  }

  const { order, ambiguous } = chooseDateOrder(dateFields);
  const timeZone = options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const resolveDate = createLocalDateResolver(timeZone);
  const findFile = indexArchive(files);
  const matchedIds = new Set<string>();
  const records: ChatMediaRecord[] = [];
  const preview: ChatPreview = { messages: [], totalMessages: 0, truncated: false };
  let latestMessageDateIso: string | null = null;
  for (let index = 0; index < groups.length; index += 1) {
    if (index > 0 && index % linesPerSlice === 0) yield;
    const group = groups[index];
    const message = readMessage(group, findFile);
    const local = group.local;
    const wallTime = local ? getWallTime(local, order) : undefined;
    const date = wallTime === undefined ? undefined : resolveDate(wallTime);
    if (!message || !date || !local) {
      skippedLines.push(group.rawLines.join('\n'));
      continue;
    }
    if (latestMessageDateIso === null || date.iso > latestMessageDateIso) latestMessageDateIso = date.iso;
    preview.totalMessages += 1;
    if (preview.messages.length < (options.previewLimit ?? 160)) {
      preview.messages.push({
        id: `${date.iso}:${index}`,
        sender: message.sender,
        messageDateIso: date.iso,
        body: message.body
      });
    }

    const file = message.file;
    if (!file || matchedIds.has(file.id)) {
      skippedLines.push(group.rawLines.join('\n'));
      continue;
    }
    matchedIds.add(file.id);
    records.push({
      id: `${date.iso}:${file.id}`,
      archiveEntryId: file.id,
      messageIndex: index,
      filename: file.filename,
      normalizedFilename: normalizeFilename(file.filename),
      sender: message.sender,
      messageDateIso: date.iso,
      datePrecision: local.precision,
      dateAmbiguous: date.ambiguous || (ambiguous && !local.yearFirst && local.parts[0] !== local.parts[1]),
      rawLine: group.rawLines.join('\n')
    });
  }
  preview.truncated = preview.messages.length < preview.totalMessages;
  if (preview.totalMessages === 0) preview.rawFallback = text.slice(0, 12_000);
  return { records, skippedLines, dateOrder: order, timeZone, timeZoneAssumed: !options.timeZone, latestMessageDateIso, preview };
}
