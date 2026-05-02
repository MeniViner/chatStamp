import { stripDirectionMarks } from './whatsappDate';

export type TranscriptCandidateInput = {
  filename: string;
  sample: string;
};

export type TranscriptCandidateScore = TranscriptCandidateInput & {
  score: number;
  messageLineCount: number;
  reason: string;
};

const EXACT_CHAT_FILENAME = '_chat.txt';

const OBVIOUS_NON_CHAT_PATTERNS = [
  /readme/i,
  /license/i,
  /terms/i,
  /privacy/i,
  /metadata/i,
  /manifest/i
];

const WHATSAPP_MESSAGE_LINE_PATTERNS = [
  /^\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?\s+-\s+.+?:\s+.+/i,
  /^\s*\[\d{1,2}[./-]\d{1,2}[./-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?\]\s+(?:-\s*)?.+?:\s+.+/i
];

export function chooseBestTranscriptCandidate(
  candidates: TranscriptCandidateInput[]
): TranscriptCandidateScore | null {
  const scored = scoreTranscriptCandidates(candidates);
  const exact = scored.find((candidate) => isExactChatFilename(candidate.filename) && candidate.messageLineCount > 0);
  if (exact) return exact;

  const viable = scored.filter((candidate) => candidate.messageLineCount > 0);
  viable.sort((left, right) => right.score - left.score);
  return viable[0] ?? null;
}

export function scoreTranscriptCandidates(candidates: TranscriptCandidateInput[]): TranscriptCandidateScore[] {
  return candidates.map((candidate) => {
    const filename = normalizeZipTextFilename(candidate.filename);
    const messageLineCount = countWhatsAppMessageLines(candidate.sample);
    const exactNameBonus = isExactChatFilename(filename) ? 100 : 0;
    const whatsappNameBonus = /whatsapp/i.test(filename) || filename.includes('WhatsApp') ? 15 : 0;
    const chatNameBonus = /\bchat\b/i.test(filename) || filename.includes('צ׳אט') || filename.includes("צ'אט") ? 8 : 0;
    const nonChatPenalty = OBVIOUS_NON_CHAT_PATTERNS.some((pattern) => pattern.test(filename)) ? 25 : 0;
    const score = messageLineCount * 20 + exactNameBonus + whatsappNameBonus + chatNameBonus - nonChatPenalty;

    return {
      filename: candidate.filename,
      sample: candidate.sample,
      score,
      messageLineCount,
      reason: messageLineCount > 0 ? 'contains WhatsApp-style message lines' : 'no WhatsApp-style message lines found'
    };
  });
}

export function countWhatsAppMessageLines(sample: string): number {
  return sample
    .split(/\r?\n/)
    .map((line) => stripDirectionMarks(line).trim())
    .filter((line) => WHATSAPP_MESSAGE_LINE_PATTERNS.some((pattern) => pattern.test(line))).length;
}

export function normalizeZipTextFilename(filename: string): string {
  const basename = filename.replace(/\\/g, '/').split('/').pop() ?? filename;
  try {
    return decodeURIComponent(basename);
  } catch {
    return basename;
  }
}

function isExactChatFilename(filename: string): boolean {
  return normalizeZipTextFilename(filename).toLowerCase() === EXACT_CHAT_FILENAME;
}
