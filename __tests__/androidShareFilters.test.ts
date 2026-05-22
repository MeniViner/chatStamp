import { describe, expect, it } from 'vitest';
import appConfig from '../app.config';

describe('Android share intent filters', () => {
  it('registers only ZIP MIME types so the app is not offered for every file', () => {
    const filters = appConfig.android.intentFilters;
    const mimeTypes = filters.flatMap((filter) => filter.data.map((entry) => entry.mimeType));

    expect(mimeTypes).toContain('application/zip');
    expect(mimeTypes).toContain('application/x-zip-compressed');
    expect(mimeTypes).not.toContain('*/*');
    expect(mimeTypes).not.toContain('application/octet-stream');
  });
});
