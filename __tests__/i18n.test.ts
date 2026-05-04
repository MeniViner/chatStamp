import { describe, expect, it } from 'vitest';
import en from '../src/i18n/locales/en.json';
import he from '../src/i18n/locales/he.json';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, nested]) => flattenKeys(nested, prefix ? `${prefix}.${key}` : key));
}

describe('i18n locale resources', () => {
  it('keeps Hebrew keys in parity with English keys', () => {
    expect(flattenKeys(he).sort()).toEqual(flattenKeys(en).sort());
  });
});
