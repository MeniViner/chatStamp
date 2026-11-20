import { describe, expect, it } from 'vitest';
import { asPipelineError, errorMessageKey, isRetryAllowed, PipelineError, pipelineErrorCode } from '../src/lib/pipelineErrors';
import en from '../src/i18n/locales/en.json';
import he from '../src/i18n/locales/he.json';

const codes = [
  'NO_TRANSCRIPT', 'ZIP_INVALID', 'NO_SPACE', 'ARCHIVE_LIMIT', 'CANCELLED', 'PERMISSION_LOST', 'IO_ERROR'
] as const;

function lookup(dictionary: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((value, part) => {
    if (value === null || typeof value !== 'object' || !(part in value)) return undefined;
    return (value as Record<string, unknown>)[part];
  }, dictionary);
}

describe('coded pipeline failures', () => {
  it.each(codes)('recognizes native %s without inspecting its message', (code) => {
    expect(pipelineErrorCode({ code, message: 'Provider-specific diagnostic text.' })).toBe(code);
    expect(pipelineErrorCode({ code, message: 'An unrelated translated message.' })).toBe(code);
  });

  it('does not infer a failure code from message text', () => {
    expect(pipelineErrorCode(new Error('NO_SPACE ZIP_INVALID No transcript permission denied'))).toBe('IO_ERROR');
    expect(pipelineErrorCode({ code: 'UNRECOGNIZED', message: 'NO_TRANSCRIPT' })).toBe('IO_ERROR');
  });

  it.each([null, undefined, 42, 'NO_SPACE inside diagnostic text', { message: 'Archive is invalid' }])('maps an uncoded value to IO_ERROR: %s', (error) => {
    expect(pipelineErrorCode(error)).toBe('IO_ERROR');
  });

  it('accepts an explicit code value and an Expo error code without searching diagnostic text', () => {
    expect(pipelineErrorCode('NO_SPACE')).toBe('NO_SPACE');
    expect(pipelineErrorCode({ code: 'ERR_NO_SPACE', message: 'Unrelated diagnostic' })).toBe('NO_SPACE');
  });

  it('preserves computable missing bytes for the translated storage error', () => {
    const failure = asPipelineError({ code: 'NO_SPACE', missingBytes: 4096 });
    expect(failure.code).toBe('NO_SPACE');
    expect(failure.missingBytes).toBe(4096);
    expect(asPipelineError(new PipelineError('NO_SPACE', 'No cache space', 512)).missingBytes).toBe(512);
  });

  it.each(codes)('maps %s to actual English and Hebrew messages', (code) => {
    const key = errorMessageKey(code);
    expect(lookup(en, key)).toEqual(expect.any(String));
    expect(lookup(he, key)).toEqual(expect.any(String));
    expect(lookup(en, key)).not.toBe('');
    expect(lookup(he, key)).not.toBe('');
  });

  it('keeps specific error messages distinct', () => {
    expect(new Set(codes.map(errorMessageKey)).size).toBe(codes.length);
  });

  it.each(codes)('offers retry for %s only while the same source can be read', (code) => {
    expect(isRetryAllowed(code, false)).toBe(false);
    expect(isRetryAllowed(code, true)).toBe(code !== 'CANCELLED');
  });
});
