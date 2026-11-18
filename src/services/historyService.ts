import type { ExportHistoryItem, SaveFileResult } from '../types/media';
import { normalizeHistoryItem } from '../store/historyLogic';

export type HistoryStorage = {
  read: (name: string) => Promise<string | null>;
  writeAtomic: (name: string, contents: string) => Promise<void>;
  list: (prefix: string) => Promise<string[]>;
  remove: (name: string) => Promise<void>;
};

export const HISTORY_INDEX_FILE = 'export-history.v2.json';
export const HISTORY_LEGACY_FILE = 'export-history.v1.json';
const detailPrefix = 'export-history-detail-';
const historyLimit = 50;

type Detail = { version: 2; summary: ExportHistoryItem; results: SaveFileResult[]; deleted?: boolean };

export function historyDetailFileName(id: string): string {
  const safe = encodeURIComponent(id).replace(/_/g, '%5F').replace(/%/g, '_');
  return `${detailPrefix}${safe}.json`;
}

export class HistoryRepository {
  private pending: Promise<unknown> = Promise.resolve();

  constructor(private readonly storage: HistoryStorage) {}

  load(): Promise<ExportHistoryItem[]> {
    return this.serial(() => this.reconcile());
  }

  save(item: ExportHistoryItem): Promise<void> {
    return this.serial(async () => {
      const items = await this.reconcile();
      const previous = await this.detail(item.id);
      const results = mergeResults(previous?.results ?? [], item.savedFiles ?? []);
      const summary = historySummary(item, results);
      const detail: Detail = { version: 2, summary, results };
      await this.storage.writeAtomic(historyDetailFileName(item.id), JSON.stringify(detail));
      const next = [summary, ...items.filter((entry) => entry.id !== item.id)].slice(0, historyLimit);
      await this.writeIndex(next);
      for (const removed of items.filter((entry) => !next.some((value) => value.id === entry.id))) {
        await this.storage.remove(historyDetailFileName(removed.id));
      }
    });
  }

  readDetails(id: string): Promise<SaveFileResult[] | null> {
    return this.serial(async () => (await this.detail(id))?.results ?? null);
  }

  remove(id: string): Promise<void> {
    return this.serial(async () => {
      const items = await this.reconcile();
      const item = items.find((entry) => entry.id === id);
      if (item) await this.storage.writeAtomic(historyDetailFileName(id), JSON.stringify({ version: 2, summary: item, results: [], deleted: true }));
      await this.writeIndex(items.filter((entry) => entry.id !== id));
      await this.storage.remove(historyDetailFileName(id));
    });
  }

  clear(): Promise<void> {
    return this.serial(async () => {
      const items = await this.reconcile();
      for (const item of items) {
        await this.storage.writeAtomic(historyDetailFileName(item.id), JSON.stringify({ version: 2, summary: item, results: [], deleted: true }));
      }
      await this.writeIndex([]);
      for (const item of items) await this.storage.remove(historyDetailFileName(item.id));
    });
  }

  private serial<T>(action: () => Promise<T>): Promise<T> {
    const result = this.pending.then(action, action);
    this.pending = result.catch(() => undefined);
    return result;
  }

  private async reconcile(): Promise<ExportHistoryItem[]> {
    const index = parse(await this.storage.read(HISTORY_INDEX_FILE));
    const indexed = isObject(index) && index.version === 2 && Array.isArray(index.items) ? index.items.filter(isSummary) : [];
    const summaries = new Map<string, ExportHistoryItem>(indexed.map((item) => [item.id, withoutDetails(item)]));
    const files = await this.storage.list('');
    const deleted = new Set<string>();
    for (const name of files) {
      if ((name.startsWith('export-history') || name.startsWith('.export-history')) && name.endsWith('.tmp')) {
        await this.storage.remove(name);
      } else if (name.startsWith(detailPrefix) && name.endsWith('.json')) {
        const detail = parseDetail(await this.storage.read(name));
        if (!detail || name !== historyDetailFileName(detail.summary.id)) continue;
        if (detail.deleted) deleted.add(detail.summary.id);
        else summaries.set(detail.summary.id, withoutDetails(detail.summary));
      }
    }
    const legacyValue = parse(await this.storage.read(HISTORY_LEGACY_FILE));
    const legacy = Array.isArray(legacyValue) ? legacyValue.filter(isSummary) : [];
    for (const old of legacy) {
      if (summaries.has(old.id) || deleted.has(old.id)) continue;
      const normalized = normalizeHistoryItem(old);
      const summary = withoutDetails(normalized);
      await this.storage.writeAtomic(historyDetailFileName(old.id), JSON.stringify({ version: 2, summary, results: normalized.savedFiles ?? [] }));
      summaries.set(old.id, summary);
    }
    for (const id of deleted) summaries.delete(id);
    const items = [...summaries.values()].sort((a, b) => b.exportTimestampIso.localeCompare(a.exportTimestampIso)).slice(0, historyLimit);
    for (const item of items) {
      delete item.detailsMissing;
      if (!await this.detail(item.id)) item.detailsMissing = true;
    }
    if ((index !== null || items.length > 0 || legacy.length > 0 || deleted.size > 0)
      && JSON.stringify(index) !== JSON.stringify({ version: 2, items })) await this.writeIndex(items);
    if (Array.isArray(legacyValue)) await this.storage.remove(HISTORY_LEGACY_FILE);
    for (const id of deleted) await this.storage.remove(historyDetailFileName(id));
    return items;
  }

  private async detail(id: string): Promise<Detail | null> {
    const detail = parseDetail(await this.storage.read(historyDetailFileName(id)));
    return detail && detail.summary.id === id && !detail.deleted ? detail : null;
  }

  private writeIndex(items: ExportHistoryItem[]): Promise<void> {
    return this.storage.writeAtomic(HISTORY_INDEX_FILE, JSON.stringify({ version: 2, items: items.map(withoutDetails) }));
  }
}

function withoutDetails(item: ExportHistoryItem): ExportHistoryItem {
  const { savedFiles: _savedFiles, ...summary } = item;
  return summary;
}

function parse(text: string | null): unknown {
  try { return text === null ? null : JSON.parse(text) as unknown; } catch { return null; }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSummary(value: unknown): value is ExportHistoryItem {
  return isObject(value) && typeof value.id === 'string' && value.id.length > 0
    && typeof value.exportTimestampIso === 'string' && typeof value.chatName === 'string' && isObject(value.counts);
}

function parseDetail(text: string | null): Detail | null {
  const value = parse(text);
  if (!isObject(value) || value.version !== 2 || !isSummary(value.summary) || !Array.isArray(value.results)) return null;
  if (!value.results.every((result: unknown) => isObject(result) && typeof result.filename === 'string' && typeof result.ok === 'boolean')) return null;
  return { version: 2, summary: value.summary, results: value.results as SaveFileResult[], deleted: value.deleted === true };
}

function historySummary(item: ExportHistoryItem, results: SaveFileResult[]): ExportHistoryItem {
  const summary = withoutDetails(item);
  const saved = results.filter((result) => result.outcome === 'saved' || (!result.outcome && result.ok));
  if (results.length === 0) return summary;
  const count = (type: string) => saved.filter((result) => result.mediaType === type).length;
  return { ...summary, counts: { totalSaved: saved.length, photos: count('photo'), videos: count('video'),
    voice: count('voice'), stickers: count('sticker'), documents: count('document'),
    failed: results.filter((result) => result.outcome === 'failed' || (!result.outcome && !result.ok)).length },
    allFilesHadTimestampsFixed: saved.length > 0 && saved.every((result) => result.dateCorrectionVerified === true) };
}

function mergeResults(previous: SaveFileResult[], current: SaveFileResult[]): SaveFileResult[] {
  const key = (result: SaveFileResult) => result.entryId ?? result.insertedUri ?? result.filename;
  const merged = new Map(previous.map((result) => [key(result), result]));
  for (const result of current) {
    const old = merged.get(key(result));
    if (result.outcome === 'skipped' && old?.outcome === 'saved' && old.insertedUri === result.insertedUri) continue;
    merged.set(key(result), result);
  }
  return [...merged.values()];
}
