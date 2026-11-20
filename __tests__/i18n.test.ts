import { describe, expect, it } from 'vitest';
import en from '../src/i18n/locales/en.json';
import he from '../src/i18n/locales/he.json';
import { createInstance } from 'i18next';
import { auditProject, flattenLocale, interpolationNames } from '../scripts/i18n-audit';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, nested]) => flattenKeys(nested, prefix ? `${prefix}.${key}` : key));
}

describe('i18n locale resources', () => {
  it('keeps Hebrew keys in parity with English keys', () => {
    expect(flattenKeys(he).sort()).toEqual(flattenKeys(en).sort());
  });

  it('has exact reachable production consumers with no unused, missing, unbounded or invalid locale values', () => {
    const result = auditProject();
    expect(result.unresolvedCalls).toEqual([]);
    expect(result.missingKeys).toEqual([]);
    expect(result.unusedKeys).toEqual([]);
    expect(result.missingHebrewKeys).toEqual([]);
    expect(result.extraHebrewKeys).toEqual([]);
    expect(result.interpolationMismatches).toEqual([]);
    expect(result.hebrewViolations).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('renders every Hebrew interpolation without leaking source placeholders or markup', async () => {
    const instance = createInstance();
    await instance.init({ lng: 'he', resources: { he: { translation: he } }, interpolation: { escapeValue: false } });
    for (const [key, value] of Object.entries(flattenLocale(he))) {
      const values = Object.fromEntries(interpolationNames(value).map((name: string) => [name, /count|saved|failed|cancelled|verified|total|done|shown|selected|bytes|current|unsafe|unsupported/.test(name) ? 42 : 'בדיקה']));
      const rendered = instance.t(key, values);
      expect(rendered, key).not.toMatch(/{{|}}|<\/?[A-Za-z][^>]*>|\$\{|%[sdif]|\bSAF\b|timestamp/i);
    }
  });
});
