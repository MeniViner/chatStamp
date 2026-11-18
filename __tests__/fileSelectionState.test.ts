import { beforeEach, describe, expect, it } from 'vitest';
import { usePipelineStore } from '../src/store/pipelineStore';
import type { ExtractedMediaFile, ImportSummary } from '../src/types/media';
import {
  adjacentViewerId,
  groupVisibleDays,
  rangeIds,
  selectedIdsInOrder,
  selectionFromIds,
  selectionState,
  selectionTotals,
  setIdsSelected,
  toggleId,
} from '../src/store/fileSelectionState';

const ids = (selection: ReadonlySet<string>) => [...selection].sort();
const date = (value: string) => Date.parse(value);

describe('default and individual ID selection', () => {
  it('selects all eligible IDs, including voice, documents, transcript and unavailable dates', () => {
    const eligible = Object.freeze(['photo', 'video', 'voice', 'document', 'transcript', 'undated']);
    const selected = selectionFromIds(eligible);
    expect(selected).toBeInstanceOf(Set);
    expect(ids(selected)).toEqual([...eligible].sort());
    expect(eligible).toEqual(['photo', 'video', 'voice', 'document', 'transcript', 'undated']);
  });

  it('creates an empty selection for an empty import and does not inherit previous import IDs', () => {
    const previous = selectionFromIds(['old-photo', 'old-voice']);
    expect(ids(selectionFromIds([]))).toEqual([]);
    expect(ids(selectionFromIds(['new-document']))).toEqual(['new-document']);
    expect(ids(previous)).toEqual(['old-photo', 'old-voice']);
  });

  it('deduplicates import IDs and changes only the requested stable ID without mutation', () => {
    const original = selectionFromIds(['A', 'B', 'A', 'hidden']);
    const removed = toggleId(original, 'B');
    const restored = toggleId(removed, 'B');
    expect(ids(original)).toEqual(['A', 'B', 'hidden']);
    expect(ids(removed)).toEqual(['A', 'hidden']);
    expect(ids(restored)).toEqual(['A', 'B', 'hidden']);
    expect(removed).not.toBe(original);
  });

  it('targets an ID after sorting rather than toggling the old row index', () => {
    const selected = selectionFromIds(['photo-old', 'photo-new', 'voice']);
    const display = ['voice', 'photo-new', 'photo-old'];
    const next = toggleId(selected, display[0]);
    expect(ids(next)).toEqual(['photo-new', 'photo-old']);
    expect(display).toEqual(['voice', 'photo-new', 'photo-old']);
  });
});

describe('scoped bulk selection and tri-state', () => {
  it.each([
    [[], [], 'none'],
    [['hidden'], [], 'none'],
    [['hidden'], ['A', 'B'], 'none'],
    [['A', 'hidden'], ['A', 'B'], 'some'],
    [['A', 'B', 'hidden'], ['A', 'B'], 'all'],
    [['A'], ['A', 'A'], 'all'],
  ] as const)('calculates only scope members: selected %j, scope %j -> %s', (selected, scope, expected) => {
    expect(selectionState(new Set(selected), scope)).toBe(expected);
  });

  it('fills a partial scope, clears an all-selected scope, and preserves hidden selections', () => {
    const original = selectionFromIds(['A', 'hidden']);
    const scope = Object.freeze(['A', 'B', 'A']);
    const filled = setIdsSelected(original, scope, selectionState(original, scope) !== 'all');
    expect(ids(filled)).toEqual(['A', 'B', 'hidden']);
    const cleared = setIdsSelected(filled, scope, selectionState(filled, scope) !== 'all');
    expect(ids(cleared)).toEqual(['hidden']);
    expect(ids(original)).toEqual(['A', 'hidden']);
    expect(scope).toEqual(['A', 'B', 'A']);
  });

  it('treats an empty bulk scope as a no-op regardless of hidden selections', () => {
    const original = selectionFromIds(['hidden']);
    expect(ids(setIdsSelected(original, [], true))).toEqual(['hidden']);
    expect(ids(setIdsSelected(original, [], false))).toEqual(['hidden']);
    expect(selectionState(original, [])).toBe('none');
  });

  it('changes only visible members of a day across media kinds and senders', () => {
    const selected = selectionFromIds(['Dana-photo', 'Eli-video', 'hidden-same-day', 'other-day']);
    const currentDay = ['Dana-photo', 'Eli-video'];
    const next = setIdsSelected(selected, currentDay, false);
    expect(selectionState(next, currentDay)).toBe('none');
    expect(selectionState(next, ['hidden-same-day'])).toBe('all');
    expect(selectionState(next, ['other-day'])).toBe('all');
    expect(ids(next)).toEqual(['hidden-same-day', 'other-day']);
  });
});

describe('range selection in the active display order', () => {
  const ordered = Object.freeze(['newest', 'middle-9', 'older-2', 'oldest']);

  it.each([
    ['newest', 'older-2', ['newest', 'middle-9', 'older-2']],
    ['older-2', 'newest', ['newest', 'middle-9', 'older-2']],
    ['middle-9', 'middle-9', ['middle-9']],
    ['newest', 'oldest', ['newest', 'middle-9', 'older-2', 'oldest']],
    ['hidden', 'oldest', []],
    ['newest', 'missing', []],
  ] as const)('returns the inclusive visible interval %s -> %s', (anchor, target, expected) => {
    expect(rangeIds(ordered, anchor, target)).toEqual(expected);
    expect(ordered).toEqual(['newest', 'middle-9', 'older-2', 'oldest']);
  });

  it('returns no range for an empty list', () => {
    expect(rangeIds([], 'A', 'B')).toEqual([]);
  });

  it.each([true, false])('supports captured select=%s intent, expansion and shrink without a toggle trail', (shouldSelect) => {
    const before = selectionFromIds(shouldSelect ? ['middle-9', 'hidden'] : [...ordered, 'hidden']);
    const expanded = setIdsSelected(before, rangeIds(ordered, 'newest', 'oldest'), shouldSelect);
    const shrunk = setIdsSelected(before, rangeIds(ordered, 'newest', 'middle-9'), shouldSelect);
    expect(ids(expanded)).toEqual(shouldSelect ? [...ordered, 'hidden'].sort() : ['hidden']);
    expect(ids(shrunk)).toEqual(shouldSelect ? ['hidden', 'middle-9', 'newest'] : ['hidden', 'older-2', 'oldest']);
    expect(ids(before)).toEqual(shouldSelect ? ['hidden', 'middle-9'] : [...ordered, 'hidden'].sort());
  });
});

describe('active-filter counts and prepared save IDs', () => {
  const files = Object.freeze([
    Object.freeze({ id: 'A', sender: 'Dana', kind: 'photo', sizeBytes: 10, filename: 'trip-a.jpg', day: '2020-03-16' }),
    Object.freeze({ id: 'B', sender: 'Eli', kind: 'photo', sizeBytes: 20, filename: 'trip-b.jpg', day: '2020-03-16' }),
    Object.freeze({ id: 'C', sender: 'Dana', kind: 'video', sizeBytes: 30, filename: 'trip-c.mp4', day: '2020-03-16' }),
    Object.freeze({ id: 'D', sender: 'Dana', kind: 'voice', sizeBytes: 40, filename: 'voice.opus', day: '2020-03-17' }),
    Object.freeze({ id: 'E', sender: 'Eli', kind: 'document', sizeBytes: 50, filename: 'undated.pdf', day: null }),
    Object.freeze({ id: 'F', sender: 'Dana', kind: 'photo', sizeBytes: 60, filename: 'trip-f.jpg', day: '2020-03-16' }),
  ]);

  it('uses sender + Photos + search + date intersection for footer and save, preserving hidden IDs', () => {
    const selected = selectionFromIds(files.map((file) => file.id));
    const visible = files.filter((file) => file.sender === 'Dana' && file.kind === 'photo'
      && file.filename.includes('trip') && file.day === '2020-03-16').reverse();
    const ordered = visible.map((file) => file.id);
    expect(ordered).toEqual(['F', 'A']);
    expect(selectionTotals(visible, selected)).toEqual({ selected: 2, total: 2, selectedBytes: 70, unknownSizeCount: 0 });
    expect(selectedIdsInOrder(ordered, selected)).toEqual(['F', 'A']);
    const cleared = setIdsSelected(selected, ordered, false);
    expect(selectionTotals(visible, cleared)).toEqual({ selected: 0, total: 2, selectedBytes: 0, unknownSizeCount: 0 });
    expect(selectedIdsInOrder(ordered, cleared)).toEqual([]);
    expect(ids(cleared)).toEqual(['B', 'C', 'D', 'E']);
    expect(selectedIdsInOrder(files.map((file) => file.id), cleared)).toEqual(['B', 'C', 'D', 'E']);
    expect(ids(selected)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('does not reset selections when viewing another tab or sorting', () => {
    const chosen = toggleId(selectionFromIds(files.map((file) => file.id)), 'A');
    expect(selectedIdsInOrder(['D'], chosen)).toEqual(['D']);
    expect(selectedIdsInOrder(['F', 'B', 'A'], chosen)).toEqual(['F', 'B']);
    expect(ids(chosen)).toEqual(['B', 'C', 'D', 'E', 'F']);
  });

  it('does not inflate active counts or bytes from hidden large files or repeated visible IDs', () => {
    const visible = [{ id: 'A', sizeBytes: 10 }, { id: 'A', sizeBytes: 10 }, { id: 'B', sizeBytes: 20 }];
    const selected = selectionFromIds(['A', 'hidden-8GiB']);
    expect(selectionTotals(visible, selected)).toEqual({ selected: 1, total: 2, selectedBytes: 10, unknownSizeCount: 0 });
    expect(selectedIdsInOrder(['B', 'A', 'A'], selected)).toEqual(['A']);
  });

  it('counts known zero and separates missing or invalid selected sizes', () => {
    const visible = [{ id: 'zero', sizeBytes: 0 }, { id: 'known', sizeBytes: 42 }, { id: 'missing' },
      { id: 'negative', sizeBytes: -1 }, { id: 'nan', sizeBytes: Number.NaN }, { id: 'infinite', sizeBytes: Infinity },
      { id: 'unselected-unknown' }];
    const selected = selectionFromIds(visible.slice(0, -1).map((file) => file.id));
    expect(selectionTotals(visible, selected)).toEqual({ selected: 6, total: 7, selectedBytes: 42, unknownSizeCount: 4 });
    expect(selectionTotals([], selected)).toEqual({ selected: 0, total: 0, selectedBytes: 0, unknownSizeCount: 0 });
  });
});

describe('day grouping uses the displayed resolved date without upgrading provenance', () => {
  it('groups chronological items while preserving tie order and stable group keys', () => {
    const input = Object.freeze([
      Object.freeze({ id: 'new-video', resolvedDateMillis: date('2020-03-17T10:00:00Z'), dateCertainty: 'known' as const }),
      Object.freeze({ id: 'same-time-photo', resolvedDateMillis: date('2020-03-17T10:00:00Z'), dateCertainty: 'known' as const }),
      Object.freeze({ id: 'older', resolvedDateMillis: date('2019-02-15T08:30:00Z'), dateCertainty: 'known' as const }),
      Object.freeze({ id: 'undated', dateCertainty: 'missing' as const }),
    ]);
    const groups = groupVisibleDays(input, 'Asia/Jerusalem');
    expect(groups.map((group) => ({ dayKey: group.dayKey, ids: group.ids }))).toEqual([
      { dayKey: '2020-03-17', ids: ['new-video', 'same-time-photo'] },
      { dayKey: '2019-02-15', ids: ['older'] },
      { dayKey: null, ids: ['undated'] },
    ]);
    expect(groups.flatMap((group) => group.ids)).toEqual(input.map((file) => file.id));
    expect(new Set(groups.map((group) => group.key)).size).toBe(groups.length);
    expect(groupVisibleDays(input, 'Asia/Jerusalem')).toEqual(groups);
  });

  it('uses the explicit display time zone near midnight instead of the host time zone', () => {
    const files = [{ id: 'near-midnight', resolvedDateMillis: date('2020-03-16T22:30:00Z'), dateCertainty: 'known' as const }];
    expect(groupVisibleDays(files, 'Asia/Jerusalem')[0].dayKey).toBe('2020-03-17');
    expect(groupVisibleDays(files, 'UTC')[0].dayKey).toBe('2020-03-16');
  });

  it('retains calendar-day boundaries across the Jerusalem spring DST transition', () => {
    const files = [
      { id: 'after-clock-change', resolvedDateMillis: date('2020-03-27T00:30:00Z'), dateCertainty: 'known' as const },
      { id: 'before-clock-change', resolvedDateMillis: date('2020-03-26T22:30:00Z'), dateCertainty: 'known' as const },
      { id: 'previous-local-day', resolvedDateMillis: date('2020-03-26T21:30:00Z'), dateCertainty: 'known' as const },
    ];
    expect(groupVisibleDays(files, 'Asia/Jerusalem').map((group) => ({ dayKey: group.dayKey, ids: group.ids }))).toEqual([
      { dayKey: '2020-03-27', ids: ['after-clock-change', 'before-clock-change'] },
      { dayKey: '2020-03-26', ids: ['previous-local-day'] },
    ]);
  });

  it('keeps missing/invalid dates unavailable and preserves a valid epoch-zero date', () => {
    const files = [
      { id: 'epoch', resolvedDateMillis: 0, dateCertainty: 'known' as const },
      { id: 'absent', dateCertainty: 'missing' as const },
      { id: 'nan', resolvedDateMillis: Number.NaN, dateCertainty: 'known' as const },
      { id: 'infinite', resolvedDateMillis: Infinity, dateCertainty: 'known' as const },
    ];
    const groups = groupVisibleDays(files, 'UTC');
    expect(groups[0].dayKey).toBe('1970-01-01');
    expect(groups.filter((group) => group.dayKey === null).flatMap((group) => group.ids)).toEqual(['absent', 'nan', 'infinite']);
    expect(groupVisibleDays([], 'UTC')).toEqual([]);
  });

  it('does not mutate approximate/ambiguous metadata when placing chosen dates in a group', () => {
    const approximate = Object.freeze({ id: 'estimate', resolvedDateMillis: date('2020-03-16T13:15:00Z'), dateCertainty: 'approximate' as const });
    const ambiguous = Object.freeze({ id: 'ambiguous', resolvedDateMillis: date('2020-03-16T13:15:00Z'), dateCertainty: 'ambiguous' as const });
    expect(groupVisibleDays([approximate, ambiguous], 'UTC')[0].ids).toEqual(['estimate', 'ambiguous']);
    expect(approximate.dateCertainty).toBe('approximate');
    expect(ambiguous.dateCertainty).toBe('ambiguous');
  });
});

describe('viewer paging stays in filtered sort order independently of checkboxes', () => {
  it('moves in either direction, retaining unchecked visible pages and excluding hidden IDs', () => {
    const ordered = Object.freeze(['newest', 'unchecked-middle', 'oldest']);
    const selected = selectionFromIds(['newest', 'oldest', 'hidden-photo', 'hidden-voice']);
    expect(adjacentViewerId(ordered, 'newest', 1)).toBe('unchecked-middle');
    expect(adjacentViewerId(ordered, 'unchecked-middle', 1)).toBe('oldest');
    expect(adjacentViewerId(ordered, 'oldest', -1)).toBe('unchecked-middle');
    toggleId(selected, 'oldest');
    expect(adjacentViewerId(ordered, 'unchecked-middle', 1)).toBe('oldest');
    expect(ordered).toEqual(['newest', 'unchecked-middle', 'oldest']);
    expect(adjacentViewerId([...ordered].reverse(), 'oldest', 1)).toBe('unchecked-middle');
  });

  it.each([
    [[], 'A', 1],
    [['A'], 'A', 1],
    [['A'], 'A', -1],
    [['A', 'B'], 'A', -1],
    [['A', 'B'], 'B', 1],
    [['A', 'B'], 'hidden', 1],
  ] as const)('returns no out-of-bounds or hidden page for %j, %s, %s', (ordered, current, direction) => {
    expect(adjacentViewerId(ordered, current, direction)).toBeNull();
  });
});

describe('pipeline selection integration and durable save-scope snapshot', () => {
  beforeEach(() => usePipelineStore.getState().reset());

  const files: ExtractedMediaFile[] = [
    { id: 'photo', filename: 'image.jpg', normalizedFilename: 'image.jpg', uri: 'file:///cache/image.jpg', mediaType: 'photo' },
    { id: 'video', filename: 'video.mp4', normalizedFilename: 'video.mp4', uri: 'file:///cache/video.mp4', mediaType: 'video' },
    { id: 'voice', filename: 'voice.opus', normalizedFilename: 'voice.opus', uri: 'file:///cache/voice.opus', mediaType: 'voice' },
    { id: 'audio', filename: 'audio.m4a', normalizedFilename: 'audio.m4a', uri: 'file:///cache/audio.m4a', mediaType: 'audio' },
    { id: 'sticker', filename: 'sticker.webp', normalizedFilename: 'sticker.webp', uri: 'file:///cache/sticker.webp', mediaType: 'sticker' },
    { id: 'gif', filename: 'motion.gif', normalizedFilename: 'motion.gif', uri: 'file:///cache/motion.gif', mediaType: 'gif' },
    { id: 'document', filename: 'document.pdf', normalizedFilename: 'document.pdf', uri: 'file:///cache/document.pdf', mediaType: 'document' },
    { id: 'transcript', filename: '_chat.txt', normalizedFilename: '_chat.txt', uri: 'file:///cache/_chat.txt', mediaType: 'document', sourceKind: 'chat-transcript' },
    { id: 'undated', filename: 'undated.vcf', normalizedFilename: 'undated.vcf', uri: 'file:///cache/undated.vcf', mediaType: 'document', dateSource: 'none' },
  ];
  const summary: ImportSummary = {
    chatRecords: 8, skippedChatLines: 0, extractedEntries: 9, skippedZipEntries: 0,
    matchedMedia: 8, unmatchedMedia: 1, senders: 1, photos: 1, videos: 1,
    voice: 1, audio: 1, stickers: 1, gifs: 1, documents: 3, unknown: 0, extractionMode: 'native-selective',
  };
  const importFiles = (mediaFiles = files) => usePipelineStore.getState().setImportResult({
    workingDirectory: 'file:///cache/selection-acceptance/', archiveFingerprint: 'a'.repeat(64),
    operationId: 'import-selection-acceptance', mediaFiles, importSummary: summary,
  });

  it('uses a real Set and selects all saveable imported types, transcript and undated documents', () => {
    importFiles();
    const state = usePipelineStore.getState();
    expect(state.stage).toBe('selectFiles');
    expect(state.selectedFileIds).toBeInstanceOf(Set);
    expect(ids(state.selectedFileIds)).toEqual(files.map((file) => file.id).sort());
    expect(state.selectedMediaTypes).toMatchObject({ voice: true, audio: true, document: true, gif: true, sticker: true });
  });

  it('preserves hidden choices through sender/type filters and scopes clear/select to the requested IDs', () => {
    importFiles();
    usePipelineStore.getState().toggleFile('photo');
    const previous = usePipelineStore.getState().selectedFileIds;
    usePipelineStore.getState().toggleSender('Dana');
    usePipelineStore.getState().toggleMediaType('photo');
    expect(usePipelineStore.getState().selectedFileIds).toBe(previous);
    usePipelineStore.getState().clearFiles(['document', 'undated']);
    expect(ids(usePipelineStore.getState().selectedFileIds)).toEqual(['audio', 'gif', 'sticker', 'transcript', 'video', 'voice']);
    expect(previous.has('document')).toBe(true);
    usePipelineStore.getState().selectFiles(['photo']);
    expect(usePipelineStore.getState().selectedFileIds.has('photo')).toBe(true);
    expect(usePipelineStore.getState().selectedFileIds.has('undated')).toBe(false);
  });

  it('snapshots only the active ordered save IDs before output options without discarding hidden Set members', () => {
    importFiles();
    const activeOrder = ['document', 'photo', 'document'];
    usePipelineStore.getState().prepareSave(activeOrder);
    const prepared = usePipelineStore.getState();
    expect(prepared.stage).toBe('outputOptions');
    expect(prepared.pendingSaveIds).toEqual(['document', 'photo']);
    expect(prepared.selectedFileIds.size).toBe(files.length);
    activeOrder.reverse();
    activeOrder.push('voice');
    usePipelineStore.getState().toggleFile('photo');
    usePipelineStore.getState().toggleMediaType('document');
    expect(usePipelineStore.getState().pendingSaveIds).toEqual(['document', 'photo']);
    expect(prepared.selectedFileIds.has('photo')).toBe(true);
    expect(usePipelineStore.getState().selectedFileIds.has('voice')).toBe(true);
  });

  it('clears obsolete save scope and selected IDs on a different import and on reset', () => {
    importFiles();
    usePipelineStore.getState().prepareSave(['photo']);
    importFiles([{ ...files[0], id: 'next-import-photo' }]);
    expect(ids(usePipelineStore.getState().selectedFileIds)).toEqual(['next-import-photo']);
    expect(usePipelineStore.getState().pendingSaveIds).toBeUndefined();
    usePipelineStore.getState().prepareSave(['next-import-photo']);
    usePipelineStore.getState().reset();
    expect(usePipelineStore.getState().selectedFileIds.size).toBe(0);
    expect(usePipelineStore.getState().pendingSaveIds).toBeUndefined();
  });
});
