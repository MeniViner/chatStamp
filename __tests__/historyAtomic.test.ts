import { describe, expect, it } from 'vitest';
import {
  HISTORY_INDEX_FILE,
  HISTORY_LEGACY_FILE,
  HistoryRepository,
  historyDetailFileName
} from '../src/services/historyService';
import type { ExportHistoryItem, SaveFileResult } from '../src/types/media';

class MemoryStorage {
  readonly files = new Map<string, string>();
  readonly writes: string[] = [];
  failNextWriteFor: string | null = null;
  failIndexAfterNextDetail = false;

  async read(name: string): Promise<string | null> {
    return this.files.get(name) ?? null;
  }

  async writeAtomic(name: string, contents: string): Promise<void> {
    this.writes.push(name);
    const temporary = `${name}.tmp`;
    this.files.set(temporary, contents);
    if (this.failNextWriteFor === name) {
      this.failNextWriteFor = null;
      throw new Error(`Interrupted before atomic rename of ${name}`);
    }
    this.files.set(name, contents);
    this.files.delete(temporary);
    if (this.failIndexAfterNextDetail && name.startsWith('export-history-detail-')) {
      this.failIndexAfterNextDetail = false;
      this.failNextWriteFor = HISTORY_INDEX_FILE;
    }
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.files.keys()].filter((name) => name.startsWith(prefix));
  }

  async remove(name: string): Promise<void> {
    this.files.delete(name);
  }
}

function result(overrides: Partial<SaveFileResult> = {}): SaveFileResult {
  return {
    filename: 'photo.jpg',
    entryId: '["photos/photo.jpg",0]',
    ok: true,
    outcome: 'saved',
    insertedUri: 'content://media/external/images/media/11',
    outputPath: '/storage/emulated/0/Pictures/chatStamp/Chat/photo.jpg',
    dateCorrectionVerified: false,
    galleryMaySortByImportTime: true,
    ...overrides
  };
}

function item(id = 'export-one', overrides: Partial<ExportHistoryItem> = {}): ExportHistoryItem {
  return {
    id,
    exportTimestampIso: '2026-11-18T12:00:00.000Z',
    chatName: 'Synthetic chat',
    outputFolderPath: '/storage/emulated/0/Pictures/chatStamp/Chat',
    outputDirectory: '/storage/emulated/0/Pictures/chatStamp/Chat',
    selectedSenders: ['Dana'],
    counts: { totalSaved: 1, photos: 1, videos: 0, voice: 0, stickers: 0, documents: 0, failed: 0 },
    saveMethod: 'scoped-media-store',
    allFilesHadTimestampsFixed: false,
    savedFiles: [result()],
    ...overrides
  };
}

function index(storage: MemoryStorage): { version: number; items: ExportHistoryItem[] } {
  return JSON.parse(storage.files.get(HISTORY_INDEX_FILE) ?? '{"version":2,"items":[]}') as {
    version: number; items: ExportHistoryItem[];
  };
}

describe('atomic per-export history', () => {
  it('writes a self-contained detail file before a summary-only index', async () => {
    const storage = new MemoryStorage();
    const repository = new HistoryRepository(storage);
    const source = item();
    await repository.save(source);

    expect(storage.writes.indexOf(historyDetailFileName(source.id))).toBeLessThan(storage.writes.lastIndexOf(HISTORY_INDEX_FILE));
    const detail = JSON.parse(storage.files.get(historyDetailFileName(source.id)) ?? 'null') as {
      version: number; summary: ExportHistoryItem; results: SaveFileResult[];
    };
    expect(detail).toMatchObject({ version: 2, summary: { id: source.id }, results: source.savedFiles });
    expect(detail.summary.savedFiles).toBeUndefined();
    expect(index(storage).version).toBe(2);
    expect(index(storage).items).toHaveLength(1);
    expect(index(storage).items[0]?.savedFiles).toBeUndefined();
    expect(JSON.stringify(index(storage))).not.toContain('content://media/external/images/media/11');
    expect((await repository.load())[0]?.savedFiles).toBeUndefined();
    expect(await repository.readDetails(source.id)).toEqual(source.savedFiles);
    expect(source.savedFiles).toEqual([result()]);
  });

  it('uses one summary per export ID when a save is repeated', async () => {
    const storage = new MemoryStorage();
    const repository = new HistoryRepository(storage);
    await repository.save(item());
    const updated = item('export-one', { savedFiles: [result({ displayName: 'saved-on-retry.jpg' })] });
    await repository.save(updated);
    expect(await repository.load()).toHaveLength(1);
    expect(await repository.readDetails('export-one')).toEqual(updated.savedFiles);
    expect([...storage.files.keys()].filter((name) => name.startsWith('export-history-detail-'))).toHaveLength(1);
  });

  it('keeps the original saved-file provenance when a duplicate rerun skips it', async () => {
    const storage = new MemoryStorage();
    const repository = new HistoryRepository(storage);
    const original = item();
    await repository.save(original);
    await repository.save(item('export-one', { savedFiles: [result({ outcome: 'skipped' })] }));
    expect(await repository.readDetails('export-one')).toEqual(original.savedFiles);
    expect(await repository.load()).toHaveLength(1);
  });

  it('keeps the previous committed export if writing its replacement detail is interrupted', async () => {
    const storage = new MemoryStorage();
    const repository = new HistoryRepository(storage);
    const original = item();
    await repository.save(original);
    const originalIndex = storage.files.get(HISTORY_INDEX_FILE);
    storage.failNextWriteFor = historyDetailFileName(original.id);

    await expect(repository.save(item('export-one', { chatName: 'New title' }))).rejects.toThrow('Interrupted');
    expect(storage.files.get(HISTORY_INDEX_FILE)).toBe(originalIndex);
    const restarted = new HistoryRepository(storage);
    expect((await restarted.load())[0]?.chatName).toBe(original.chatName);
    expect(await restarted.readDetails(original.id)).toEqual(original.savedFiles);
    expect(storage.files.has(`${historyDetailFileName(original.id)}.tmp`)).toBe(false);
  });

  it('recovers a committed detail after an interruption before the index rename', async () => {
    const storage = new MemoryStorage();
    const repository = new HistoryRepository(storage);
    storage.failNextWriteFor = HISTORY_INDEX_FILE;
    await expect(repository.save(item())).rejects.toThrow('Interrupted');
    expect(storage.files.has(historyDetailFileName('export-one'))).toBe(true);

    const restarted = new HistoryRepository(storage);
    expect(await restarted.load()).toMatchObject([{ id: 'export-one', chatName: 'Synthetic chat' }]);
    expect(await restarted.readDetails('export-one')).toEqual(item().savedFiles);
    expect(index(storage).items).toHaveLength(1);
    expect(storage.files.has(`${HISTORY_INDEX_FILE}.tmp`)).toBe(false);
    expect(await new HistoryRepository(storage).load()).toHaveLength(1);
  });

  it('recovers a valid orphan detail when the index is corrupt', async () => {
    const storage = new MemoryStorage();
    await new HistoryRepository(storage).save(item());
    storage.files.set(HISTORY_INDEX_FILE, '{interrupted-index');
    expect(await new HistoryRepository(storage).load()).toMatchObject([{ id: 'export-one' }]);
    expect(index(storage).items).toHaveLength(1);
  });

  it('discards corrupt history scratch files without touching settings scratch files', async () => {
    const storage = new MemoryStorage();
    const temporary = `${historyDetailFileName('partial')}.tmp`;
    storage.files.set(temporary, '{incomplete');
    storage.files.set('settings.v1.json.tmp', '{pending-settings');
    expect(await new HistoryRepository(storage).load()).toEqual([]);
    expect(storage.files.has(temporary)).toBe(false);
    expect(storage.files.get('settings.v1.json.tmp')).toBe('{pending-settings');
  });

  it('does not turn a corrupt orphan detail into a successful history entry', async () => {
    const storage = new MemoryStorage();
    storage.files.set(historyDetailFileName('bad-export'), '{incomplete');
    expect(await new HistoryRepository(storage).load()).toEqual([]);
  });

  it('reports missing per-file details while preserving a known summary', async () => {
    const storage = new MemoryStorage();
    await new HistoryRepository(storage).save(item());
    storage.files.delete(historyDetailFileName('export-one'));
    const restarted = new HistoryRepository(storage);
    expect(await restarted.load()).toMatchObject([{ id: 'export-one', detailsMissing: true }]);
    expect(await restarted.readDetails('export-one')).toBeNull();
  });

  it('migrates 0.1.1 history without losing IDs, provider URIs, paths, or date uncertainty', async () => {
    const storage = new MemoryStorage();
    const legacy = item('2026-05-02T12:00:00.000Z-old', {
      saveMethod: 'termux-parity',
      savedFiles: [result({
        outcome: undefined,
        insertedUri: undefined,
        scannedUri: 'content://media/external/images/media/11',
        filesystemTimestampFixed: true,
        dateCorrectionVerified: false
      })]
    });
    storage.files.set(HISTORY_LEGACY_FILE, JSON.stringify([legacy]));
    const repository = new HistoryRepository(storage);
    expect(await repository.load()).toMatchObject([{
      id: legacy.id, outputFolderPath: legacy.outputFolderPath, allFilesHadTimestampsFixed: false
    }]);
    expect(await repository.readDetails(legacy.id)).toMatchObject([{
      filename: 'photo.jpg',
      insertedUri: 'content://media/external/images/media/11',
      outputPath: legacy.savedFiles?.[0]?.outputPath,
      outcome: 'saved',
      dateCorrectionVerified: false
    }]);
    expect((await repository.readDetails(legacy.id))?.[0]?.dateVerification).not.toBe('verified');
    expect(storage.files.has(HISTORY_LEGACY_FILE)).toBe(false);
    expect(storage.writes.indexOf(historyDetailFileName(legacy.id))).toBeLessThan(storage.writes.indexOf(HISTORY_INDEX_FILE));
    expect(await new HistoryRepository(storage).load()).toHaveLength(1);
    expect(historyDetailFileName(legacy.id)).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('retains legacy history if migration stops between writing details and the new index', async () => {
    const storage = new MemoryStorage();
    storage.files.set(HISTORY_LEGACY_FILE, JSON.stringify([item('legacy-one'), item('legacy-two')]));
    storage.failNextWriteFor = HISTORY_INDEX_FILE;
    await expect(new HistoryRepository(storage).load()).rejects.toThrow('Interrupted');
    expect(storage.files.has(HISTORY_LEGACY_FILE)).toBe(true);
    expect(storage.files.has(historyDetailFileName('legacy-one'))).toBe(true);
    expect(storage.files.has(historyDetailFileName('legacy-two'))).toBe(true);

    const restarted = new HistoryRepository(storage);
    expect((await restarted.load()).map((entry) => entry.id).sort()).toEqual(['legacy-one', 'legacy-two']);
    expect(storage.files.has(HISTORY_LEGACY_FILE)).toBe(false);
    expect(await new HistoryRepository(storage).load()).toHaveLength(2);
  });

  it('does not resurrect a deleted export during orphan reconciliation', async () => {
    const storage = new MemoryStorage();
    const repository = new HistoryRepository(storage);
    await repository.save(item());
    await repository.remove('export-one');
    expect(await new HistoryRepository(storage).load()).toEqual([]);
    expect(await repository.readDetails('export-one')).toBeNull();
  });

  it('finishes an interrupted deletion without resurrecting its detail', async () => {
    const storage = new MemoryStorage();
    const repository = new HistoryRepository(storage);
    await repository.save(item());
    storage.failIndexAfterNextDetail = true;
    await expect(repository.remove('export-one')).rejects.toThrow('Interrupted');
    const restarted = new HistoryRepository(storage);
    expect(await restarted.load()).toEqual([]);
    expect(await restarted.readDetails('export-one')).toBeNull();
  });

  it('clears history without deleting other local app settings', async () => {
    const storage = new MemoryStorage();
    const repository = new HistoryRepository(storage);
    storage.files.set('settings.v1.json', '{"languagePreference":"he"}');
    await repository.save(item('first'));
    await repository.save(item('second'));
    await repository.clear();
    expect(await new HistoryRepository(storage).load()).toEqual([]);
    expect(await repository.readDetails('first')).toBeNull();
    expect(await repository.readDetails('second')).toBeNull();
    expect(storage.files.get('settings.v1.json')).toBe('{"languagePreference":"he"}');
  });
});
