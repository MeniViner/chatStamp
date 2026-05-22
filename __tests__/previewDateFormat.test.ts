import { describe, expect, it } from 'vitest';
import { formatShortChatTimestamp } from '../src/lib/previewDateFormat';

describe('formatShortChatTimestamp', () => {
  it('formats chat preview dates without seconds', () => {
    const dateIso = new Date(2026, 7, 18, 17, 29, 42).toISOString();

    expect(formatShortChatTimestamp(dateIso)).toBe('18/8/26 17:29');
  });

  it('returns an empty string for invalid dates', () => {
    expect(formatShortChatTimestamp('not-a-date')).toBe('');
  });
});
