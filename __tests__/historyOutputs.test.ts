import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HISTORY_INDEX_FILE, HistoryRepository, historyDetailFileName, type HistoryStorage } from '../src/services/historyService';
import { createExportHistoryItem, historyPresentation } from '../src/store/historyLogic';
import { deleteOutputFiles, shareOutputFiles } from '../src/native/outputFiles';
import type { ExportHistoryItem, ExtractedMediaFile, SaveFileResult } from '../src/types/media';

const native = vi.hoisted(() => ({ share: vi.fn(), remove: vi.fn() }));
vi.mock('../src/native/chatStampNativeModule', () => ({ getChatStampNativeModule: () => ({ shareOutputFilesAsync: native.share, deleteOutputFilesAsync: native.remove }) }));

class MemoryStorage implements HistoryStorage {
  readonly files = new Map<string, string>();
  failIndexAfterDetail = false;
  private failNextIndex = false;
  async read(name: string) { return this.files.get(name) ?? null; }
  async writeAtomic(name: string, contents: string) {
    if (name === HISTORY_INDEX_FILE && this.failNextIndex) {
      this.failNextIndex = false;
      throw new Error('Synthetic interruption before index publication');
    }
    this.files.set(name, contents);
    if (this.failIndexAfterDetail && name.startsWith('export-history-detail-')) {
      this.failIndexAfterDetail = false; this.failNextIndex = true;
    }
  }
  async list(prefix: string) { return [...this.files.keys()].filter((name) => name.startsWith(prefix)); }
  async remove(name: string) { this.files.delete(name); }
}

const fingerprint = 'a'.repeat(64);
const entryId = '["photos/photo.jpg",0]';
const directory = '/storage/emulated/0/Pictures/chatStamp/QA';
const firstUri = 'content://media/external/images/media/11';
const secondUri = 'content://media/external/images/media/12';
const timestamp = Date.parse('2019-02-26T10:30:00Z');

function output(overrides: Partial<SaveFileResult> = {}): SaveFileResult {
  return { entryId, filename: 'photo.jpg', mediaType: 'photo', ok: true, outcome: 'saved', insertedUri: firstUri,
    outputPath: `${directory}/photo.jpg`, outputDirectory: directory, sourcePath: 'photos/photo.jpg',
    dateCorrectionVerified: true, galleryMaySortByImportTime: false, dateVerification: 'verified',
    timestampSource: 'chat', whatsAppDateIso: '2019-02-26T10:30:00Z', originalTimestampMillis: timestamp,
    targetTimestampMillis: timestamp, mediaStoreDateTaken: timestamp, filesystemTimestampFixed: true,
    ...overrides };
}

function uncertain(overrides: Partial<SaveFileResult> = {}): SaveFileResult {
  return output({ dateVerification: 'unverified', dateCorrectionVerified: false, galleryMaySortByImportTime: true,
    mediaStoreDateTaken: Date.parse('2026-11-19T10:30:00Z'), verificationReason: 'date-mismatch', ...overrides });
}

function attempt(outcome: 'failed' | 'cancelled', overrides: Partial<SaveFileResult> = {}): SaveFileResult {
  return { entryId, filename: 'photo.jpg', mediaType: 'photo', outcome, ok: false,
    dateVerification: 'unverified', dateCorrectionVerified: false, galleryMaySortByImportTime: false,
    failureCode: outcome === 'failed' ? 'IO_ERROR' : 'CANCELLED', ...overrides };
}

function item(results: SaveFileResult[], session = 'import-session-A', options: {
  destination?: string; folderTreeUri?: string | null; saveMethod?: ExportHistoryItem['saveMethod']; now?: string; workingDirectory?: string;
} = {}): ExportHistoryItem {
  const target = options.destination ?? directory;
  const files: ExtractedMediaFile[] = [...new Map(results.map((row) => [row.entryId ?? row.filename, row])).entries()]
    .map(([id, row]) => ({ id, filename: row.filename, normalizedFilename: row.filename.toLowerCase(),
      mediaType: row.mediaType ?? 'photo', sourceKind: 'zip-media', uri: `file:///cache/chatstamp/${session}/extracted/${row.filename}`,
      sourcePath: row.sourcePath ?? row.filename, dateSource: 'chat', dateIso: '2019-02-26T10:30:00Z', matchedRecord: {
        id: `record-${id}`, filename: row.filename, normalizedFilename: row.filename.toLowerCase(), sender: 'QA Dana',
        messageDateIso: '2019-02-26T10:30:00Z', rawLine: `2019-02-26, 10:30 - QA Dana: ${row.filename} (file attached)`
      } }));
  const saved = results.filter((row) => row.ok && (row.outcome === 'saved' || row.outcome === undefined));
  const params = {
    archiveFingerprint: fingerprint, workingDirectory: options.workingDirectory ?? `file:///cache/chatstamp/${session}/`,
    chatName: 'QA', outputFolderPath: target, folderTreeUri: options.folderTreeUri,
    now: new Date(options.now ?? '2026-11-19T10:00:00Z'), files, selectedFileIds: new Set(files.map((file) => file.id)), selectedSenders: ['QA Dana'],
    selectedMediaTypes: { photo: true, video: true, voice: true, audio: true, sticker: true, gif: true, document: true, unknown: false },
    completion: {
      saved: saved.length, skipped: results.filter((row) => row.outcome === 'skipped').length,
      failed: results.filter((row) => row.outcome === 'failed').length,
      cancelled: results.filter((row) => row.outcome === 'cancelled').length,
      dateCorrected: saved.filter((row) => row.dateCorrectionVerified).length, dateCorrectionFailed: saved.filter((row) => !row.dateCorrectionVerified).length,
      mayShowImportTime: saved.filter((row) => row.galleryMaySortByImportTime).length,
      cacheCleared: results.every((row) => row.ok),
      saveMethod: options.saveMethod ?? (options.folderTreeUri ? 'saf-custom-folder' as const : 'scoped-media-store' as const),
      outputDirectory: target, results
    }
  };
  return createExportHistoryItem(params);
}

async function reload(storage: MemoryStorage) {
  const repository = new HistoryRepository(storage);
  const summaries = await repository.load();
  const records = await Promise.all(summaries.map(async (summary) => ({ ...summary, savedFiles: await repository.readDetails(summary.id) ?? [] })));
  return { repository, records, rows: records.flatMap((record) => record.savedFiles), saved: records.reduce((sum, record) => sum + record.counts.totalSaved, 0) };
}

function actualSaved(rows: SaveFileResult[]) { return rows.filter((row) => row.ok && (row.outcome === 'saved' || row.outcome === undefined)); }

async function expectReachable(rows: SaveFileResult[], uris: string[]) {
  await shareOutputFiles(actualSaved(rows), ['photo', 'video', 'document']);
  await deleteOutputFiles(actualSaved(rows));
  const shared = native.share.mock.lastCall?.[0] as { uri?: string; path?: string }[];
  const removed = native.remove.mock.lastCall?.[0] as { uri?: string; path?: string }[];
  expect(shared.map((file) => file.uri).sort()).toEqual([...uris].sort());
  expect(removed.map((file) => file.uri).sort()).toEqual([...uris].sort());
}

beforeEach(() => { native.share.mockReset().mockResolvedValue({ opened: true }); native.remove.mockReset().mockResolvedValue({ deleted: 0 }); });

describe('history retains real outputs and isolates import sessions', () => {
  it('preserves both keep-both copies for the same archive/entry across independent imports', async () => {
    const storage = new MemoryStorage(), repository = new HistoryRepository(storage);
    const first = item([output()]);
    const secondCopy = uncertain({ insertedUri: secondUri, outputPath: `${directory}/photo (2).jpg`, displayName: 'photo (2).jpg' });
    const second = item([secondCopy], 'import-session-B', { now: '2026-11-19T11:00:00Z' });
    await repository.save(first); await repository.save(second);
    const loaded = await reload(storage);
    expect(loaded.saved).toBe(2);
    expect(actualSaved(loaded.rows).map((row) => row.insertedUri).sort()).toEqual([firstUri, secondUri]);
    expect(first.id).not.toBe(second.id);
    expect(loaded.records.find((record) => record.id === first.id)?.allFilesHadTimestampsFixed).toBe(true);
    expect(loaded.records.find((record) => record.id === second.id)?.allFilesHadTimestampsFixed).toBe(false);
    expect(loaded.rows.find((row) => row.insertedUri === firstUri)).toMatchObject(output());
    expect(loaded.rows.find((row) => row.insertedUri === secondUri)).toMatchObject(secondCopy);
    await expectReachable(loaded.rows, [firstUri, secondUri]);
  });

  it('retains destination paths/tree handles and both outputs when the same ZIP is saved elsewhere', async () => {
    const storage = new MemoryStorage(), repository = new HistoryRepository(storage);
    const custom = '/storage/emulated/0/Documents/QA-selected';
    const tree = 'content://synthetic.documents/tree/QA-selected';
    const customUri = 'content://synthetic.documents/document/QA-selected/photo.jpg';
    const first = item([output()]);
    const second = item([uncertain({ insertedUri: customUri, outputDirectory: custom, outputPath: `${custom}/photo.jpg`, destinationKind: 'document-provider' })],
      'import-session-B', { destination: custom, folderTreeUri: tree });
    await repository.save(first); await repository.save(second);
    const loaded = await reload(storage);
    expect(loaded.saved).toBe(2);
    expect(new Set(loaded.records.map((record) => record.outputFolderPath))).toEqual(new Set([directory, custom]));
    expect(loaded.records.find((record) => record.id === second.id)).toMatchObject({ folderTreeUri: tree, saveMethod: 'saf-custom-folder', allFilesHadTimestampsFixed: false });
    expect(loaded.records.find((record) => record.id === first.id)).toMatchObject({ outputDirectory: directory, allFilesHadTimestampsFixed: true });
    await expectReachable(loaded.rows, [firstUri, customUri]);
  });

  it.each(['failed', 'cancelled'] as const)('a later independent %s import cannot erase an earlier verified saved output', async (outcome) => {
    const storage = new MemoryStorage(), repository = new HistoryRepository(storage);
    const original = item([output()]);
    const later = item([attempt(outcome)], 'import-session-B');
    await repository.save(original); await repository.save(later);
    const loaded = await reload(storage);
    expect(loaded.saved).toBe(1);
    const previous = loaded.records.find((record) => record.id === original.id)!;
    const pending = loaded.records.find((record) => record.id === later.id)!;
    expect(previous).toMatchObject({ allFilesHadTimestampsFixed: true, counts: { totalSaved: 1, failed: 0, cancelled: 0 } });
    expect(historyPresentation(previous).status).toBe('completed');
    expect(pending).toMatchObject({ allFilesHadTimestampsFixed: false, counts: { totalSaved: 0, failed: outcome === 'failed' ? 1 : 0, cancelled: outcome === 'cancelled' ? 1 : 0 } });
    expect(historyPresentation(pending).status).toBe(outcome === 'failed' ? 'failed' : 'cancelled');
    expect(actualSaved(loaded.rows)).toEqual([output()]);
    await expectReachable(loaded.rows, [firstUri]);
  });

  it.each(['failed', 'cancelled'] as const)('same-session retry clears only the resolved %s outcome while preserving older sessions', async (outcome) => {
    const storage = new MemoryStorage(), repository = new HistoryRepository(storage);
    await repository.save(item([output()]));
    const videoId = '["videos/video.mp4",0]';
    await repository.save(item([attempt(outcome), attempt(outcome, { entryId: videoId, filename: 'video.mp4', mediaType: 'video' })], 'import-session-B'));
    const resolved = output({ insertedUri: secondUri, outputPath: `${directory}/photo (2).jpg` });
    const retry = item([resolved], 'import-session-B', { now: '2026-11-19T12:00:00Z' });
    await repository.save(retry);
    let loaded = await reload(storage);
    const pending = loaded.records.find((record) => record.id === retry.id)!;
    expect(pending.counts).toMatchObject({ totalSaved: 1, failed: outcome === 'failed' ? 1 : 0, cancelled: outcome === 'cancelled' ? 1 : 0 });
    expect(loaded.saved).toBe(2);
    expect(pending.savedFiles.filter((row) => !row.ok).map((row) => row.entryId)).toEqual([videoId]);
    const videoUri = 'content://media/external/video/media/13';
    await loaded.repository.save(item([output({ entryId: videoId, filename: 'video.mp4', mediaType: 'video', insertedUri: videoUri, outputPath: `${directory}/video.mp4` })], 'import-session-B'));
    loaded = await reload(storage);
    expect(loaded.saved).toBe(3);
    expect(loaded.records.find((record) => record.id === retry.id)?.counts).toMatchObject({ totalSaved: 2, failed: 0, cancelled: 0 });
    expect(loaded.rows.filter((row) => !row.ok)).toEqual([]);
    await expectReachable(loaded.rows, [firstUri, secondUri, videoUri]);
  });

  it('preserves different real output handles even within one retry session', async () => {
    const storage = new MemoryStorage(), repository = new HistoryRepository(storage);
    await repository.save(item([output()]));
    await repository.save(item([uncertain({ insertedUri: secondUri, outputPath: `${directory}/photo (2).jpg` })]));
    const loaded = await reload(storage);
    expect(loaded.records).toHaveLength(1);
    expect(loaded.saved).toBe(2);
    expect(loaded.records[0].allFilesHadTimestampsFixed).toBe(false);
    await expectReachable(loaded.rows, [firstUri, secondUri]);
  });

  it('retains path-only legacy copies with the same entry and forwards both paths to share/delete', async () => {
    const storage = new MemoryStorage(), repository = new HistoryRepository(storage);
    const paths = [`${directory}/photo.jpg`, `${directory}/photo (2).jpg`];
    for (const path of paths) {
      await repository.save(item([uncertain({ insertedUri: undefined, scannedUri: undefined, outputPath: path,
        destinationKind: 'legacy-path', dateVerification: 'mtime-only', mediaStoreDateTaken: null })]));
    }
    const loaded = await reload(storage);
    expect(loaded.saved).toBe(2);
    expect(loaded.records).toHaveLength(1);
    expect(loaded.records[0].allFilesHadTimestampsFixed).toBe(false);
    await shareOutputFiles(loaded.rows, ['photo']);
    await deleteOutputFiles(loaded.rows);
    expect((native.share.mock.lastCall?.[0] as { uri: string | null; path: string }[]).map((file) => [file.uri, file.path]))
      .toEqual(paths.map((path) => [null, path]));
    expect((native.remove.mock.lastCall?.[0] as { uri: string | null; path: string }[]).map((file) => [file.uri, file.path]))
      .toEqual(paths.map((path) => [null, path]));
  });

  it.each(['failed', 'cancelled'] as const)('a same-session %s row carrying an old handle cannot overwrite that successful copy', async (outcome) => {
    const storage = new MemoryStorage(), repository = new HistoryRepository(storage);
    await repository.save(item([output()]));
    await repository.save(item([attempt(outcome, { insertedUri: firstUri, outputPath: `${directory}/photo.jpg` })]));
    let loaded = await reload(storage);
    expect(loaded.saved).toBe(1);
    expect(actualSaved(loaded.rows)).toEqual([output()]);
    expect(loaded.rows.some((row) => row.outcome === outcome)).toBe(true);
    await loaded.repository.save(item([output()]));
    loaded = await reload(storage);
    expect(loaded.saved).toBe(1);
    expect(loaded.rows).toEqual([output()]);
    expect(loaded.records[0].counts).toMatchObject({ failed: 0, cancelled: 0 });
    expect(loaded.records[0].allFilesHadTimestampsFixed).toBe(true);
  });

  it('replays the same successful output idempotently after cold repository reconstruction', async () => {
    const storage = new MemoryStorage();
    const initial = item([output()]);
    for (let replay = 0; replay < 3; replay++) await new HistoryRepository(storage).save(item([output()], 'import-session-A', { now: `2026-11-19T1${replay}:00:00Z` }));
    const loaded = await reload(storage);
    expect(loaded.records).toHaveLength(1);
    expect(loaded.records[0].id).toBe(initial.id);
    expect(loaded.saved).toBe(1);
    expect(loaded.rows).toEqual([output()]);
  });

  it('recovers detail-before-index interruption then replays the same session without duplicating or losing older outputs', async () => {
    const storage = new MemoryStorage(), repository = new HistoryRepository(storage);
    await repository.save(item([output()]));
    const next = item([output({ insertedUri: secondUri, outputPath: `${directory}/photo (2).jpg` })], 'import-session-B');
    storage.failIndexAfterDetail = true;
    await expect(repository.save(next)).rejects.toThrow('Synthetic interruption');
    await new HistoryRepository(storage).save(next);
    const loaded = await reload(storage);
    expect(loaded.records).toHaveLength(2);
    expect(loaded.saved).toBe(2);
    await expectReachable(loaded.rows, [firstUri, secondUri]);
  });

  it('skipping the same URI in the same session preserves the successful date provenance without duplicate rows', async () => {
    const storage = new MemoryStorage(), repository = new HistoryRepository(storage);
    await repository.save(item([output()]));
    await repository.save(item([uncertain({ outcome: 'skipped', failureReason: 'Synthetic skip metadata must not replace readback' })]));
    const loaded = await reload(storage);
    expect(loaded.saved).toBe(1);
    expect(loaded.rows).toEqual([output()]);
    expect(loaded.records[0].allFilesHadTimestampsFixed).toBe(true);
  });

  it('a skip in a new import is a separate zero-new-files record and cannot degrade the old verified session', async () => {
    const storage = new MemoryStorage(), repository = new HistoryRepository(storage);
    const original = item([output()]), skipped = item([uncertain({ outcome: 'skipped' })], 'import-session-B');
    await repository.save(original); await repository.save(skipped);
    const loaded = await reload(storage);
    expect(loaded.saved).toBe(1);
    expect(loaded.records.find((record) => record.id === original.id)).toMatchObject({ allFilesHadTimestampsFixed: true, counts: { totalSaved: 1 } });
    expect(loaded.records.find((record) => record.id === skipped.id)).toMatchObject({ allFilesHadTimestampsFixed: false, counts: { totalSaved: 0 } });
    expect(actualSaved(loaded.rows)).toEqual([output()]);
  });

  it('can upgrade one same-output record only from an actual later successful verified result', async () => {
    const storage = new MemoryStorage(), repository = new HistoryRepository(storage);
    await repository.save(item([uncertain()]));
    await repository.save(item([uncertain({ outcome: 'skipped' })]));
    expect((await reload(storage)).records[0].allFilesHadTimestampsFixed).toBe(false);
    await repository.save(item([output()]));
    const loaded = await reload(storage);
    expect(loaded.saved).toBe(1);
    expect(loaded.rows).toEqual([output()]);
    expect(loaded.records[0].allFilesHadTimestampsFixed).toBe(true);
  });

  it('retains legacy IDs/output URIs during migration alongside a new same-archive session', async () => {
    const storage = new MemoryStorage();
    const legacy = { ...item([uncertain({ insertedUri: undefined, scannedUri: firstUri, outcome: undefined })]), id: '2026-05-02T12:00:00Z-legacy', saveMethod: 'termux-parity' as const };
    storage.files.set('export-history.v1.json', JSON.stringify([legacy]));
    const repository = new HistoryRepository(storage);
    await repository.load();
    await repository.save(item([output({ insertedUri: secondUri, outputPath: `${directory}/photo (2).jpg` })], 'import-session-B'));
    const loaded = await reload(storage);
    expect(loaded.records.find((record) => record.id === legacy.id)).toMatchObject({ allFilesHadTimestampsFixed: false, saveMethod: 'termux-parity' });
    expect(loaded.saved).toBe(2);
    await expectReachable(loaded.rows, [firstUri, secondUri]);
  });

  it('uses a bounded safe stable session identity and rejects invalid supplied basenames without altering history', async () => {
    const storage = new MemoryStorage(), repository = new HistoryRepository(storage);
    const session = `import-${'x'.repeat(39)}-A`;
    const first = item([output()], session), distinct = item([output()], session.slice(0, -1) + 'B');
    expect(first.id).not.toBe(distinct.id);
    expect(item([output()], session, { now: '2026-11-20T12:00:00Z' }).id).toBe(first.id);
    const filename = historyDetailFileName(first.id);
    expect(filename).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(filename.length).toBeLessThanOrEqual(180);
    await repository.save(first);
    const before = new Map(storage.files);
    for (const invalid of ['import?unsafe', 'x'.repeat(49), '.', '..']) {
      expect(() => item([output()], invalid)).toThrow();
    }
    expect(storage.files).toEqual(before);
  });
});

describe('custom destination metadata survives only a matching cold terminal replay', () => {
  const customDirectory = '/storage/emulated/0/Documents/QA-custom';
  const knownA = 'content://synthetic.documents/tree/QA-custom-A';
  const knownB = 'content://synthetic.documents/tree/QA-custom-B';

  function terminal(tree: string | null | undefined, options: {
    destination?: string; session?: string; method?: ExportHistoryItem['saveMethod'];
  } = {}) {
    const target = options.destination ?? customDirectory;
    const method = options.method ?? 'saf-custom-folder';
    const row = uncertain({ insertedUri: method === 'saf-custom-folder'
      ? `content://synthetic.documents/document/${encodeURIComponent(target)}/photo.jpg`
      : 'content://media/external/images/media/13', outputDirectory: target, outputPath: `${target}/photo.jpg`,
    destinationKind: method === 'saf-custom-folder' ? 'document-provider' : 'media-store' });
    return item([row], options.session ?? 'import-session-A', { destination: target, saveMethod: method, folderTreeUri: tree });
  }

  function expectDurableTree(storage: MemoryStorage, id: string, tree: string | null) {
    const detail = JSON.parse(storage.files.get(historyDetailFileName(id)) ?? 'null') as { summary: ExportHistoryItem };
    const index = JSON.parse(storage.files.get(HISTORY_INDEX_FILE) ?? 'null') as { items: ExportHistoryItem[] };
    expect(detail.summary.folderTreeUri).toBe(tree);
    expect(index.items.find((record) => record.id === id)?.folderTreeUri).toBe(tree);
  }

  it.each([{ label: 'null', tree: null }, { label: 'undefined', tree: undefined }])('retains a committed known tree when same-session cold acknowledgement replay has $label', async ({ tree }) => {
    const storage = new MemoryStorage();
    const original = terminal(knownA);
    await new HistoryRepository(storage).save(original);
    expectDurableTree(storage, original.id, knownA);
    // History committed before acknowledgement failed; the recreated runtime
    // knows the native destination/method/session but has no mutable tree grant.
    await new HistoryRepository(storage).save(terminal(tree));
    const loaded = await reload(storage);
    expect(loaded.records).toHaveLength(1);
    expect(loaded.saved).toBe(1);
    expect(loaded.records[0]).toMatchObject({ id: original.id, folderTreeUri: knownA, saveMethod: 'saf-custom-folder', outputDirectory: customDirectory });
    expectDurableTree(storage, original.id, knownA);
  });

  it('matches the effective output-folder fallback when a replay has no outputDirectory field', async () => {
    const storage = new MemoryStorage();
    const original = terminal(knownA), replay = terminal(undefined);
    delete replay.outputDirectory;
    await new HistoryRepository(storage).save(original);
    await new HistoryRepository(storage).save(replay);
    expect((await reload(storage)).records[0]).toMatchObject({ folderTreeUri: knownA, outputFolderPath: customDirectory });
    expectDurableTree(storage, original.id, knownA);
  });

  it('recovers a known tree from committed detail after index interruption before cold terminal replay', async () => {
    const storage = new MemoryStorage();
    const original = terminal(knownA);
    storage.failIndexAfterDetail = true;
    await expect(new HistoryRepository(storage).save(original)).rejects.toThrow('Synthetic interruption');
    const detail = JSON.parse(storage.files.get(historyDetailFileName(original.id)) ?? 'null') as { summary: ExportHistoryItem };
    expect(detail.summary.folderTreeUri).toBe(knownA);
    expect(storage.files.has(HISTORY_INDEX_FILE)).toBe(false);
    await new HistoryRepository(storage).save(terminal(null));
    const loaded = await reload(storage);
    expect(loaded.records).toHaveLength(1);
    expect(loaded.saved).toBe(1);
    expectDurableTree(storage, original.id, knownA);
  });

  it.each(['destination', 'session', 'method'] as const)('never inherits the old grant across a different %s', async (changed) => {
    const storage = new MemoryStorage();
    const original = terminal(knownA);
    const next = terminal(null, changed === 'destination' ? { destination: '/storage/emulated/0/Documents/QA-other' }
      : changed === 'session' ? { session: 'import-session-B' } : { method: 'scoped-media-store' });
    await new HistoryRepository(storage).save(original);
    await new HistoryRepository(storage).save(next);
    const loaded = await reload(storage);
    expect(loaded.records.find((record) => record.id === next.id)).toMatchObject({
      folderTreeUri: null, saveMethod: next.saveMethod, outputDirectory: next.outputDirectory
    });
    expectDurableTree(storage, next.id, null);
    if (changed === 'session') expectDurableTree(storage, original.id, knownA);
  });

  it('keeps an explicitly supplied new tree instead of replacing it with the old known grant', async () => {
    const storage = new MemoryStorage();
    const original = terminal(knownA), updated = terminal(knownB);
    await new HistoryRepository(storage).save(original);
    await new HistoryRepository(storage).save(updated);
    expect((await reload(storage)).records[0].folderTreeUri).toBe(knownB);
    expectDurableTree(storage, updated.id, knownB);
  });
});
