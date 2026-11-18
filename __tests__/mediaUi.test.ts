import { describe, expect, it } from 'vitest';
import { isSaveableMediaType } from '../src/lib/mediaUi';

describe('mediaUi', () => {
  it('allows all file categories to be saved to organized folders', () => {
    expect(isSaveableMediaType('photo')).toBe(true);
    expect(isSaveableMediaType('video')).toBe(true);
    expect(isSaveableMediaType('voice')).toBe(true);
    expect(isSaveableMediaType('sticker')).toBe(true);
    expect(isSaveableMediaType('document')).toBe(true);
    expect(isSaveableMediaType('audio')).toBe(true);
    expect(isSaveableMediaType('gif')).toBe(true);
    expect(isSaveableMediaType('unknown')).toBe(false);
  });
});
