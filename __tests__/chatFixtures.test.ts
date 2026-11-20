import { describe, expect, it } from 'vitest';
import { chatFixtures } from './chatFixtures';

describe('chat fixture inventory', () => {
  it.each(chatFixtures)('describes the entries in $name', (fixture) => {
    expect(fixture.text.trim()).not.toBe('');
    expect(fixture.entries.length).toBeGreaterThan(0);
    expect(['dmy', 'mdy', 'ymd']).toContain(fixture.order);
    expect(() => new Intl.DateTimeFormat('en', { timeZone: fixture.zone })).not.toThrow();
    for (const entry of fixture.entries) {
      expect(entry.path.trim()).not.toBe('');
      expect(entry.expected ?? entry.skip).toBeDefined();
    }
  });
});
