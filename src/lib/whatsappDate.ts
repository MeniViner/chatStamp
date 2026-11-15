import type { DatePrecision } from '../types/media';

export const DATE_PART_PATTERN = String.raw`(?:\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})`;
export const TIME_PART_PATTERN = String.raw`\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s*[AP]\.?\s*M\.?)?`;

export type DateOrder = 'dmy' | 'mdy' | 'ymd';
type DayMonthOrder = Exclude<DateOrder, 'ymd'>;

export type LocalChatTime = {
  parts: [number, number, number];
  yearFirst: boolean;
  hour: number;
  minute: number;
  second: number;
  precision: Exclude<DatePrecision, 'day'>;
};

const dayMillis = 86_400_000;
const clockPattern = /^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?(?:\s*([AP])\.?\s*M\.?)?$/i;

export function normalizeChatText(input: string): string {
  return input.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').replace(/[\u202f\u00a0]/g, ' ');
}

export function readLocalChatTime(date: string, clock: string): LocalChatTime | undefined {
  const match = clockPattern.exec(clock);
  if (!match) return undefined;
  const [, hours, minutes, seconds, period] = match;
  const dateFields = date.split(/[./-]/);
  const parts: LocalChatTime['parts'] = [Number(dateFields[0]), Number(dateFields[1]), Number(dateFields[2])];
  const clockHour = Number(hours);
  const minute = Number(minutes);
  const second = Number(seconds ?? 0);
  if (minute > 59 || second > 59) return undefined;
  if (period ? clockHour < 1 || clockHour > 12 : clockHour > 23) return undefined;
  const hour = period ? (clockHour % 12) + (period.toUpperCase() === 'P' ? 12 : 0) : clockHour;
  return { parts, yearFirst: dateFields[0].length === 4, hour, minute, second, precision: seconds === undefined ? 'minute' : 'second' };
}

export function getWallTime(local: LocalChatTime, order: DateOrder): number | undefined {
  const [first, second, third] = local.parts;
  let year = local.yearFirst ? first : third;
  if (!local.yearFirst && year < 100) year += year >= 70 ? 1900 : 2000;
  const month = local.yearFirst ? second : order === 'mdy' ? first : second;
  const day = local.yearFirst ? third : order === 'mdy' ? second : first;
  const millis = Date.UTC(year, month - 1, day, local.hour, local.minute, local.second);
  const date = new Date(millis);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? millis
    : undefined;
}

export function chooseDateOrder(times: Iterable<LocalChatTime>): { order: DateOrder; ambiguous: boolean } {
  const evidence = new Set<DayMonthOrder>();
  let hasDayMonth = false;
  let differsByOrder = false;
  let previousDmy = -Infinity;
  let previousMdy = -Infinity;
  let chronologicalDmy = true;
  let chronologicalMdy = true;

  for (const time of times) {
    hasDayMonth ||= !time.yearFirst;
    const dmy = getWallTime(time, 'dmy');
    const mdy = getWallTime(time, 'mdy');
    if (dmy === undefined && mdy === undefined) continue;
    if (dmy === undefined) evidence.add('mdy');
    if (mdy === undefined) evidence.add('dmy');
    if (dmy !== undefined && mdy !== undefined) differsByOrder ||= dmy !== mdy;
    if (dmy !== undefined) {
      chronologicalDmy &&= dmy >= previousDmy;
      previousDmy = dmy;
    }
    if (mdy !== undefined) {
      chronologicalMdy &&= mdy >= previousMdy;
      previousMdy = mdy;
    }
  }

  if (!hasDayMonth) return { order: 'ymd', ambiguous: false };
  if (evidence.size === 1) return { order: evidence.has('dmy') ? 'dmy' : 'mdy', ambiguous: false };
  if (evidence.size === 0 && chronologicalDmy !== chronologicalMdy) {
    return { order: chronologicalMdy ? 'mdy' : 'dmy', ambiguous: false };
  }
  return { order: 'dmy', ambiguous: evidence.size > 1 || differsByOrder };
}

export function createLocalDateResolver(timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const offsetsByDay = new Map<number, Set<number>>();

  function wallTimeAt(instant: number): number {
    const parts = new Map(formatter.formatToParts(new Date(instant)).map(({ type, value }) => [type, Number(value)]));
    const [year, month, day, hour, minute, second] = ['year', 'month', 'day', 'hour', 'minute', 'second']
      .map((field) => parts.get(field as Intl.DateTimeFormatPartTypes) ?? Number.NaN);
    return Date.UTC(year, month - 1, day, hour, minute, second);
  }

  return (wallTime: number): { iso: string; ambiguous: boolean } | undefined => {
    const day = Math.floor(wallTime / dayMillis) * dayMillis;
    let offsets = offsetsByDay.get(day);
    if (!offsets) {
      // Sample both sides of the day to recognize gaps and overlaps during offset changes.
      offsets = new Set([day - dayMillis, day, day + dayMillis, day + 2 * dayMillis]
        .map((instant) => wallTimeAt(instant) - instant));
      offsetsByDay.set(day, offsets);
    }

    const matches = [...offsets].map((offset) => wallTime - offset)
      .filter((instant) => wallTimeAt(instant) === wallTime)
      .sort((a, b) => a - b);
    if (matches.length === 0) return undefined;
    return { iso: new Date(matches[0]).toISOString(), ambiguous: matches.length > 1 };
  };
}
