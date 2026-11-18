import { describe, expect, it } from 'vitest';
import { formatAppDate } from '../src/lib/localeDateFormat';

describe('app-language dates retain the same instant and zone', () => {
  it.each(['en', 'he'])('formats %s explicitly in Jerusalem even when the host locale differs', (language) => {
    const value = '2019-02-25T22:30:00.000Z';
    const expected = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(new Date(value));
    expect(formatAppDate(value, language, 'Asia/Jerusalem')).toBe(expected);
    expect(formatAppDate(Date.parse(value), language, 'Asia/Jerusalem')).toBe(expected);
    expect(formatAppDate(value, language, 'UTC')).not.toBe(expected);
  });
  it('changes locale formatting while retaining both sides of the DST instant', () => {
    for (const instant of ['2020-03-27T00:30:00Z', '2020-03-27T01:30:00Z']) {
      const hebrew = formatAppDate(instant, 'he', 'Asia/Jerusalem');
      const english = formatAppDate(instant, 'en', 'Asia/Jerusalem');
      expect(hebrew).not.toBe(english);
      expect(hebrew).toBe(new Intl.DateTimeFormat('he', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(new Date(instant)));
    }
  });
  it.each([undefined, null, '', 'not-a-date', Number.NaN, Number.POSITIVE_INFINITY])('does not invent a date for invalid/missing %s', (value) => {
    expect(formatAppDate(value, 'he', 'Asia/Jerusalem')).toBe('');
  });
  it('accepts the real Unix epoch rather than treating zero as a missing date', () => {
    expect(formatAppDate(0, 'he', 'UTC')).toBe(new Intl.DateTimeFormat('he', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(0)));
  });
});
