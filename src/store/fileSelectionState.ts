export type FileSelection = ReadonlySet<string>;
export type SelectionState = 'none' | 'some' | 'all';
export type SelectionFile = Readonly<{ id: string; sizeBytes?: number }>;
export type DayFile = Readonly<{
  id: string;
  resolvedDateMillis?: number;
  dateCertainty: 'known' | 'approximate' | 'ambiguous' | 'missing';
}>;
export type DayGroup = Readonly<{ key: string; dayKey: string | null; ids: readonly string[] }>;

export function selectionFromIds(ids: readonly string[]): FileSelection { return new Set(ids); }
export function toggleId(selection: FileSelection, id: string): FileSelection {
  if (!id) return selection;
  return setIdsSelected(selection, [id], !selection.has(id));
}
export function setIdsSelected(selection: FileSelection, ids: readonly string[], selected: boolean): FileSelection {
  const result = new Set(selection);
  for (const id of ids) { if (id) { if (selected) result.add(id); else result.delete(id); } }
  return result.size === selection.size && [...result].every((id) => selection.has(id)) ? selection : result;
}
export function selectionState(selection: FileSelection, ids: readonly string[]): SelectionState {
  const unique = new Set(ids);
  if (!unique.size) return 'none';
  const count = [...unique].filter((id) => selection.has(id)).length;
  return count === 0 ? 'none' : count === unique.size ? 'all' : 'some';
}
export function rangeIds(ids: readonly string[], anchorId: string, targetId: string): readonly string[] {
  const start = ids.indexOf(anchorId), end = ids.indexOf(targetId);
  return start < 0 || end < 0 ? [] : ids.slice(Math.min(start, end), Math.max(start, end) + 1);
}
export function selectedIdsInOrder(ids: readonly string[], selection: FileSelection): readonly string[] {
  return [...new Set(ids)].filter((id) => selection.has(id));
}
export function selectionTotals(files: readonly SelectionFile[], selection: FileSelection) {
  const seen = new Set<string>();
  let selected = 0, selectedBytes = 0, unknownSizeCount = 0;
  for (const file of files) {
    if (seen.has(file.id)) continue;
    seen.add(file.id);
    if (!selection.has(file.id)) continue;
    selected++;
    if (file.sizeBytes !== undefined && Number.isFinite(file.sizeBytes) && file.sizeBytes >= 0) selectedBytes += file.sizeBytes;
    else unknownSizeCount++;
  }
  return { selected, total: seen.size, selectedBytes, unknownSizeCount };
}
export function dayKeyAt(millis: number | undefined, timeZone: string): string | null {
  if (millis === undefined || !Number.isFinite(millis) || !Number.isFinite(new Date(millis).getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(millis);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function groupVisibleDays(files: readonly DayFile[], timeZone: string): readonly DayGroup[] {
  const groups: { key: string; dayKey: string | null; ids: string[] }[] = [];
  for (const file of files) {
    const dayKey = file.dateCertainty === 'missing' ? null : dayKeyAt(file.resolvedDateMillis, timeZone);
    const last = groups[groups.length - 1];
    if (last && last.dayKey === dayKey) last.ids.push(file.id);
    else groups.push({ key: `${dayKey ?? 'missing'}:${file.id}`, dayKey, ids: [file.id] });
  }
  return groups;
}
export function adjacentViewerId(ids: readonly string[], currentId: string, direction: -1 | 1): string | null {
  const index = ids.indexOf(currentId);
  return index < 0 ? null : ids[index + direction] ?? null;
}
