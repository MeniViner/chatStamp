import type { ChatMediaRecord, ExtractedMediaFile } from '../types/media';
import { normalizeFilename } from './filename';
import { createLocalDateResolver, getWallTime, readLocalChatTime } from './whatsappDate';

const iosFilename = /^\d{8}-[a-z]+-(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})-(\d{2})\.[^.]+$/i;
const androidFilename = /^(?:IMG|VID|PTT|AUD|DOC|STK)-(\d{4})(\d{2})(\d{2})-WA\d+\.[^.]+$/i;

export function attachChatRecordsToMedia(
  mediaFiles: ExtractedMediaFile[],
  chatRecords: ChatMediaRecord[],
  timeZone: string,
  timeZoneAssumed = false
): ExtractedMediaFile[] {
  const recordsByFile = new Map<string, ChatMediaRecord>();
  const minuteGroups = new Map<string, ChatMediaRecord[]>();
  for (const record of chatRecords) {
    if (!record.archiveEntryId || recordsByFile.has(record.archiveEntryId)) continue;
    recordsByFile.set(record.archiveEntryId, record);
    const minute = record.messageDateIso.slice(0, 16);
    const group = minuteGroups.get(minute) ?? [];
    group.push(record);
    minuteGroups.set(minute, group);
  }

  const saveDates = new Map<string, string>();
  for (const group of minuteGroups.values()) {
    if (group.length < 2 || group.length > 60 || group.some((record) => record.datePrecision !== 'minute')) continue;
    const first = Date.parse(group[0].messageDateIso);
    group.forEach((record, index) => {
      saveDates.set(record.id, new Date(first + index * 1000).toISOString());
    });
  }

  const resolveDate = createLocalDateResolver(timeZone);
  return mediaFiles.map((file) => {
    const record = recordsByFile.get(file.id);
    const base = {
      ...file, timeZone, timeZoneAssumed, matchedRecord: undefined, dateIso: undefined,
      saveDateIso: undefined, datePrecision: undefined, dateAmbiguous: undefined
    };
    if (record) {
      return {
        ...base,
        matchedRecord: record,
        dateSource: 'chat',
        dateIso: record.messageDateIso,
        saveDateIso: saveDates.get(record.id),
        datePrecision: record.datePrecision,
        dateAmbiguous: record.dateAmbiguous
      };
    }

    const filename = normalizeFilename(file.filename);
    const ios = iosFilename.exec(filename);
    const android = androidFilename.exec(filename);
    const local = ios
      ? readLocalChatTime(ios[1], `${ios[2]}:${ios[3]}:${ios[4]}`)
      : android ? readLocalChatTime(`${android[1]}-${android[2]}-${android[3]}`, '12:00') : undefined;
    const wallTime = local ? getWallTime(local, 'ymd') : undefined;
    const named = wallTime === undefined ? undefined : resolveDate(wallTime);
    if (named) {
      return {
        ...base,
        dateSource: 'filename',
        dateIso: named.iso,
        datePrecision: ios ? 'second' : 'day',
        dateAmbiguous: named.ambiguous
      };
    }

    const modified = Date.parse(file.modificationTime ?? '');
    return Number.isFinite(modified)
      ? { ...base, dateSource: 'zip-entry', dateIso: new Date(modified).toISOString(), datePrecision: 'second' }
      : { ...base, dateSource: 'none' };
  });
}
