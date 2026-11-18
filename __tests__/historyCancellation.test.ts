import { describe, expect, it } from 'vitest';
import { createInstance } from 'i18next';
import { createExportHistoryItem, historyPresentation, normalizeHistoryItem } from '../src/store/historyLogic';
import {
  HISTORY_INDEX_FILE,
  HISTORY_LEGACY_FILE,
  HistoryRepository,
  historyDetailFileName,
  type HistoryStorage
} from '../src/services/historyService';
import type { CompletionSummary, ExportHistoryItem, MediaTypeSelection, SaveFileResult } from '../src/types/media';
import en from '../src/i18n/locales/en.json';
import he from '../src/i18n/locales/he.json';

function file(id: string, outcome: NonNullable<SaveFileResult['outcome']>, verified = true): SaveFileResult {
  const ok = outcome === 'saved' || outcome === 'skipped';
  return {
    filename: `${id}.mp4`, entryId: id, outcome, ok, mediaType: 'video',
    insertedUri: ok ? `content://media/external/video/media/${id.replace(/\D/g, '') || '1'}` : null,
    dateCorrectionVerified: ok && verified, dateVerification: ok && verified ? 'verified' : 'unverified',
    galleryMaySortByImportTime: ok && !verified
  };
}

function results(): SaveFileResult[] {
  return [
    file('entry-0', 'saved'), file('entry-1', 'saved'),
    ...Array.from({ length: 14 }, (_, index) => file(`entry-${index + 2}`, 'cancelled'))
  ];
}

function item(overrides: Partial<ExportHistoryItem> = {}): ExportHistoryItem {
  return {
    id: 'export-synthetic', exportFingerprint: 'a'.repeat(64), exportTimestampIso: '2026-11-18T16:00:00.000Z',
    chatName: 'Synthetic cancellation export', outputFolderPath: '/storage/emulated/0/Pictures/chatStamp/Synthetic',
    selectedSenders: ['Dana'], saveMethod: 'scoped-media-store', allFilesHadTimestampsFixed: false,
    counts: { totalSaved: 2, photos: 0, videos: 2, voice: 0, stickers: 0, documents: 0, failed: 0, cancelled: 14 },
    savedFiles: results(), ...overrides
  };
}

function oldSummary() {
  const source = item();
  const { savedFiles: _files, ...summary } = source;
  delete summary.counts.cancelled;
  summary.allFilesHadTimestampsFixed = true;
  return summary;
}

function memoryStorage() {
  const files = new Map<string, string>();
  const storage: HistoryStorage = {
    read: async (name) => files.get(name) ?? null,
    writeAtomic: async (name, contents) => { files.set(name, contents); },
    list: async (prefix) => [...files.keys()].filter((name) => name.startsWith(prefix)),
    remove: async (name) => { files.delete(name); }
  };
  return { files, storage };
}

function persistedItems(files: Map<string, string>): ExportHistoryItem[] {
  return (JSON.parse(files.get(HISTORY_INDEX_FILE) ?? '{"version":2,"items":[]}') as { items: ExportHistoryItem[] }).items;
}

describe('history retains cancellation outcomes', () => {
  it('creates a summary with two saved and fourteen cancelled without claiming every date was fixed', () => {
    const selectedMediaTypes: MediaTypeSelection = {
      photo: true, video: true, voice: true, audio: true, sticker: true, gif: true, document: true, unknown: false
    };
    const completion: CompletionSummary = {
      saved: 2, cancelled: 14, skipped: 0, failed: 0, dateCorrected: 2, dateCorrectionFailed: 0,
      mayShowImportTime: 0, cacheCleared: false, saveMethod: 'scoped-media-store', results: results()
    };
    const history = createExportHistoryItem({
      completion, files: [], selectedFileIds: [], selectedMediaTypes, selectedSenders: ['Dana'],
      chatName: 'Synthetic cancellation export', outputFolderPath: '/storage/emulated/0/Pictures/chatStamp/Synthetic',
      archiveFingerprint: 'a'.repeat(64), now: new Date('2026-11-18T16:00:00.000Z')
    });
    expect(history.counts).toMatchObject({ totalSaved: 2, videos: 2, failed: 0, cancelled: 14 });
    expect(history.savedFiles).toHaveLength(16);
    expect(history.allFilesHadTimestampsFixed).toBe(false);
  });

  it('normalizes older per-file history whose summary omitted cancelled entries', () => {
    const normalized = normalizeHistoryItem({ ...oldSummary(), savedFiles: results() });
    expect(normalized.counts).toMatchObject({ totalSaved: 2, cancelled: 14, failed: 0 });
    expect(normalized.allFilesHadTimestampsFixed).toBe(false);
    expect(normalized.savedFiles?.filter((entry) => entry.outcome === 'cancelled')).toHaveLength(14);
  });

  it('persists the cancelled count in the summary-only index and self-contained detail', async () => {
    const { files, storage } = memoryStorage();
    const repository = new HistoryRepository(storage);
    await repository.save(item());
    expect(persistedItems(files)[0]?.counts).toMatchObject({ totalSaved: 2, cancelled: 14 });
    expect(persistedItems(files)[0]?.savedFiles).toBeUndefined();
    const detail = JSON.parse(files.get(historyDetailFileName('export-synthetic')) ?? 'null') as { summary: ExportHistoryItem };
    expect(detail.summary.counts.cancelled).toBe(14);
    expect((await repository.load())[0]?.allFilesHadTimestampsFixed).toBe(false);
  });

  it('derives the missing cancelled count from an older v2 detail before rendering history', async () => {
    const { files, storage } = memoryStorage();
    const old = oldSummary();
    files.set(HISTORY_INDEX_FILE, JSON.stringify({ version: 2, items: [old] }));
    files.set(historyDetailFileName(old.id), JSON.stringify({ version: 2, summary: old, results: results() }));
    const loaded = await new HistoryRepository(storage).load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.counts).toMatchObject({ totalSaved: 2, cancelled: 14, failed: 0 });
    expect(loaded[0]?.allFilesHadTimestampsFixed).toBe(false);
    expect(persistedItems(files)[0]?.counts.cancelled).toBe(14);
    expect(historyPresentation(loaded[0])).toMatchObject({ status: 'partial', statusKey: 'history.partial' });
    expect((await new HistoryRepository(storage).load())[0]?.counts.cancelled).toBe(14);
  });

  it('migrates an older monolithic record without losing its cancelled outcomes', async () => {
    const { files, storage } = memoryStorage();
    files.set(HISTORY_LEGACY_FILE, JSON.stringify([{ ...oldSummary(), savedFiles: results() }]));
    const repository = new HistoryRepository(storage);
    expect((await repository.load())[0]?.counts).toMatchObject({ totalSaved: 2, cancelled: 14 });
    expect((await repository.readDetails('export-synthetic'))?.filter((entry) => entry.outcome === 'cancelled')).toHaveLength(14);
    expect(files.has(HISTORY_LEGACY_FILE)).toBe(false);
  });

  it('clears the old cancelled count after a retry actually saves the remaining entries', async () => {
    const { storage } = memoryStorage();
    const repository = new HistoryRepository(storage);
    await repository.save(item());
    await repository.save(item({
      counts: { totalSaved: 14, photos: 0, videos: 14, voice: 0, stickers: 0, documents: 0, failed: 0, cancelled: 0 },
      savedFiles: Array.from({ length: 14 }, (_, index) => file(`entry-${index + 2}`, 'saved')),
      allFilesHadTimestampsFixed: true
    }));
    const loaded = await repository.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.counts).toMatchObject({ totalSaved: 16, cancelled: 0, failed: 0, videos: 16 });
    expect(loaded[0]?.allFilesHadTimestampsFixed).toBe(true);
    expect(historyPresentation(loaded[0])).toMatchObject({ status: 'completed', statusKey: 'history.completed' });
  });

  it('does not infer cancellation from uncoded legacy error text', () => {
    const legacy = file('entry-0', 'failed');
    legacy.outcome = undefined;
    legacy.failureReason = 'CANCELLED text inside a provider diagnostic';
    const normalized = normalizeHistoryItem(item({
      counts: { totalSaved: 0, photos: 0, videos: 0, voice: 0, stickers: 0, documents: 0, failed: 1 },
      savedFiles: [legacy]
    }));
    expect(normalized.counts).toMatchObject({ totalSaved: 0, cancelled: 0, failed: 1 });
    expect(normalized.allFilesHadTimestampsFixed).toBe(false);
  });

  it('does not preserve a total date-success claim when one saved file has an unverified date', () => {
    const normalized = normalizeHistoryItem(item({
      counts: { totalSaved: 2, photos: 0, videos: 2, voice: 0, stickers: 0, documents: 0, failed: 0, cancelled: 0 },
      savedFiles: [file('entry-0', 'saved'), file('entry-1', 'saved', false)],
      allFilesHadTimestampsFixed: true
    }));
    expect(normalized.allFilesHadTimestampsFixed).toBe(false);
  });
});

describe('truthful history status and copy', () => {
  it('shows partial rather than completed for the physical two-saved/fourteen-cancelled result', () => {
    expect(historyPresentation(item())).toMatchObject({
      status: 'partial', statusKey: 'history.partial', descriptionKey: 'history.summaryCancelledCounts',
      values: { saved: 2, cancelled: 14, failed: 0 }
    });
  });

  it('does not label an entirely cancelled operation completed', () => {
    expect(historyPresentation(item({
      counts: { totalSaved: 0, photos: 0, videos: 0, voice: 0, stickers: 0, documents: 0, failed: 0, cancelled: 16 },
      savedFiles: Array.from({ length: 16 }, (_, index) => file(`entry-${index}`, 'cancelled'))
    }))).toMatchObject({
      status: 'cancelled', statusKey: 'history.cancelled', values: { saved: 0, cancelled: 16, failed: 0 }
    });
  });

  it('requires known zero cancellation and failure counts before showing completed', () => {
    expect(historyPresentation({ ...oldSummary(), savedFiles: undefined })).toMatchObject({
      status: 'unknown', statusKey: 'history.needsCheck'
    });
    expect(historyPresentation(item({
      counts: { totalSaved: 2, photos: 0, videos: 2, voice: 0, stickers: 0, documents: 0, failed: 0, cancelled: 0 },
      savedFiles: [file('entry-0', 'saved'), file('entry-1', 'saved')]
    }))).toMatchObject({ status: 'completed', statusKey: 'history.completed' });
  });

  it('keeps an older summary with no per-file detail unknown instead of inferring a completed save', () => {
    const normalized = normalizeHistoryItem({ ...oldSummary(), savedFiles: [] });
    expect(historyPresentation(normalized)).toMatchObject({ status: 'unknown', statusKey: 'history.needsCheck' });
  });

  it.each(['en', 'he'] as const)('renders the actual saved/cancelled counts without a total-date claim in %s', async (language) => {
    const presentation = historyPresentation(item());
    const i18n = createInstance();
    await i18n.init({ lng: language, fallbackLng: 'en', resources: { en: { translation: en }, he: { translation: he } },
      interpolation: { escapeValue: false } });
    const label = i18n.t(presentation.statusKey);
    const description = i18n.t(presentation.descriptionKey, presentation.values);
    expect(description).toContain('2');
    expect(description).toContain('14');
    expect(description).not.toContain('16');
    expect(description).toMatch(language === 'en' ? /cancel/i : /בוטל/);
    expect(description).not.toMatch(/dates?|תאריכ|\{\{|\}\}/i);
    expect(label).not.toBe(language === 'en' ? en.history.completed : he.history.completed);
    expect(label).not.toBe(presentation.statusKey);
  });
});
