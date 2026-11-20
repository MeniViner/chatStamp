import { describe, expect, it } from 'vitest';
import appConfig from '../app.config';

type Filter = { action: string | string[]; category?: readonly string[]; data: readonly { scheme?: string; mimeType?: string }[] };
const filters: readonly Filter[] = appConfig.android.intentFilters;
function accepts(action: string, mime: string, scheme: string): boolean {
  return filters.some((filter) => (Array.isArray(filter.action) ? filter.action.includes(action) : filter.action === action)
    && filter.data.some((data) => (!data.scheme || data.scheme === scheme)
      && (data.mimeType === mime || data.mimeType === '*/*'
        || data.mimeType === `${mime.split('/')[0]}/*`)));
}

describe('Android direct WhatsApp export share filters', () => {
  it.each(['SEND', 'SEND_MULTIPLE'])('accepts %s ZIP, generic and separate transcript/media batches without assuming ZIP MIME', (action) => {
    for (const mime of ['application/zip', 'application/x-zip-compressed', 'application/octet-stream', '*/*', 'text/plain', 'image/jpeg', 'video/mp4', 'audio/opus']) {
      expect(accepts(action, mime, 'content'), `${action} ${mime}`).toBe(true);
    }
    expect(filters.filter((filter) => filter.action === action).every((filter) => filter.category?.includes('DEFAULT'))).toBe(true);
  });

  it('preserves narrow ZIP-only VIEW routing for local content/file sources', () => {
    for (const scheme of ['content', 'file']) {
      for (const mime of ['application/zip', 'application/x-zip-compressed']) expect(accepts('VIEW', mime, scheme)).toBe(true);
      for (const mime of ['*/*', 'application/octet-stream', 'text/plain', 'image/jpeg', 'video/mp4']) {
        expect(accepts('VIEW', mime, scheme), `VIEW ${scheme} ${mime}`).toBe(false);
      }
    }
    for (const scheme of ['http', 'https', 'exp', 'chatstamp']) expect(accepts('VIEW', 'application/zip', scheme)).toBe(false);
  });
});
