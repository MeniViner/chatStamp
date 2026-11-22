import { attachedFileName, parseWhatsAppLineHeader } from './chatParser';
import { normalizeChatText } from './whatsappDate';

export type TranscriptEntry =
  | Readonly<{ kind: 'day'; key: string; date: string }>
  | Readonly<{ kind: 'message'; key: string; sender: string; time: string; body: string; attachment?: string; caption?: string; omitted: boolean; startsRun: boolean }>
  | Readonly<{ kind: 'system'; key: string; time: string; body: string }>
  | Readonly<{ kind: 'text'; key: string; body: string }>;

type Draft =
  | { kind: 'message'; sender: string; time: string; date: string; lines: string[] }
  | { kind: 'system'; time: string; date: string; lines: string[] }
  | { kind: 'text'; lines: string[] };

/** Android writes `<Media omitted>`; iOS writes `image omitted`, `video omitted` and similar. */
const omittedMedia = /^(?:<[^<>]+>|(?:image|video|audio|sticker|GIF|document|Contact card) omitted)$/i;
/** iOS marks deleted messages like system notices, but they still belong to their sender. */
const deletedMessage = /^(?:This message was deleted|You deleted this message)\.?$/i;

/**
 * iOS group exports write system notices as `Group name: \u200e<notice>`. A left-to-right mark right
 * after the first `: ` therefore means a notice, unless the rest is media or a deleted message,
 * which iOS marks the same way.
 */
function isIosNotice(rawLine: string, body: string): boolean {
  const separator = rawLine.indexOf(': ');
  if (separator < 0 || rawLine[separator + 2] !== '\u200e') return false;
  const text = body.trim();
  return !attachedFileName(text) && !omittedMedia.test(text) && !deletedMessage.test(text);
}

/**
 * Splits one bounded transcript section into display entries. A section may
 * start in the middle of a message; those leading lines stay plain text.
 * The original wording is kept; only direction marks and line endings change.
 */
export function toTranscriptEntries(text: string): readonly TranscriptEntry[] {
  const drafts: Draft[] = [];
  // Same line split as the chat parser, so both read the same messages.
  for (const rawLine of text.split(/\r\n?|\n/)) {
    const header = parseWhatsAppLineHeader(rawLine);
    if (header) {
      const separator = header.body.indexOf(': ');
      const message = separator > 0 ? header.body.slice(separator + 2) : undefined;
      if (message === undefined) drafts.push({ kind: 'system', time: header.time, date: header.date, lines: [header.body] });
      else if (isIosNotice(rawLine, message)) drafts.push({ kind: 'system', time: header.time, date: header.date, lines: [message] });
      else drafts.push({ kind: 'message', sender: header.body.slice(0, separator).trim(), time: header.time, date: header.date, lines: [message] });
      continue;
    }
    const line = normalizeChatText(rawLine);
    const last = drafts[drafts.length - 1];
    if (last) last.lines.push(line);
    else drafts.push({ kind: 'text', lines: [line] });
  }

  const entries: TranscriptEntry[] = [];
  let day: string | undefined;
  let previousSender: string | undefined;
  drafts.forEach((draft, index) => {
    const body = draft.lines.join('\n').replace(/\n+$/, '');
    if (draft.kind === 'text') {
      if (body.trim()) entries.push({ kind: 'text', key: `text:${index}`, body });
      return;
    }
    if (draft.date !== day) {
      day = draft.date;
      previousSender = undefined;
      entries.push({ kind: 'day', key: `day:${index}`, date: draft.date });
    }
    if (draft.kind === 'system') {
      previousSender = undefined;
      entries.push({ kind: 'system', key: `system:${index}`, time: draft.time, body });
      return;
    }
    // An attachment line may be followed by a caption on the next lines.
    const [firstLine = '', ...rest] = body.split('\n');
    const attachment = attachedFileName(firstLine.trim());
    const caption = attachment ? rest.join('\n').trim() || undefined : undefined;
    const text = body.trim();
    entries.push({
      kind: 'message', key: `message:${index}`, sender: draft.sender, time: draft.time, body,
      attachment, caption, omitted: !attachment && (omittedMedia.test(text) || deletedMessage.test(text)), startsRun: previousSender !== draft.sender
    });
    previousSender = draft.sender;
  });
  return entries;
}

/** Distinct senders in order of first appearance. */
export function transcriptSenders(entries: readonly TranscriptEntry[]): readonly string[] {
  return [...new Set(entries.flatMap((entry) => entry.kind === 'message' ? [entry.sender] : []))];
}

/** Stable small index per sender name, used to pick a name color. */
export function senderColorIndex(sender: string, paletteSize: number): number {
  let hash = 0;
  for (const char of sender) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return hash % paletteSize;
}
