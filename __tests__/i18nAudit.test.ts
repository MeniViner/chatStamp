import { describe, expect, it } from 'vitest';
import { auditI18nSources } from '../scripts/i18n-audit';

function audit(source: string, en: object, he: object = en) {
  return auditI18nSources({ files: { '/virtual/src/App.tsx': source }, en, he, compilerOptions: { noLib: true } });
}

describe('precise translation consumer audit', () => {
  it('recognizes direct, conditional, finite template and runtime map keys without scanning arbitrary strings', () => {
    const result = audit(`
      declare function t(key: string): string;
      declare const condition: boolean;
      declare const kind: 'photo' | 'video';
      const statuses = { ok: 'status.saved', fail: 'status.failed' } as const;
      declare const state: keyof typeof statuses;
      t('common.back'); t(condition ? 'common.yes' : 'common.no');
      t(\`media.\${kind}\`); t(statuses[state]);
      const unrelated = 'dead.key';
    `, { common: { back: 'Back', yes: 'Yes', no: 'No' }, media: { photo: 'Photo', video: 'Video' },
      status: { saved: 'Saved', failed: 'Failed' }, dead: { key: 'Unused' } });
    expect(result.unresolvedCalls).toEqual([]);
    expect(result.missingKeys).toEqual([]);
    expect(result.unusedKeys).toEqual(['dead.key']);
    expect(result.usedKeys).toEqual(['common.back', 'common.no', 'common.yes', 'media.photo', 'media.video', 'status.failed', 'status.saved']);
    expect(result.ok).toBe(false);
  });

  it('follows actual key-returning functions and object properties, including widened return strings', () => {
    const result = audit(`
      declare function t(key: string): string;
      function errorKey(bad: boolean): string { return bad ? 'error.bad' : 'error.other'; }
      function presentation(bad: boolean) { return { titleKey: bad ? 'result.issue' : 'result.done', diagnostic: 'dead.key' }; }
      const shown = presentation(true);
      t(errorKey(true)); t(shown.titleKey);
    `, { error: { bad: 'Bad', other: 'Other' }, result: { issue: 'Issue', done: 'Done' }, dead: { key: 'Diagnostic' } });
    expect(result.unresolvedCalls).toEqual([]);
    expect(result.unusedKeys).toEqual(['dead.key']);
    expect(result.missingKeys).toEqual([]);
  });

  it('resolves the consumed property through useMemo and shorthand returns without consuming unrelated properties', () => {
    const result = audit(`
      declare function t(key:string):string;
      declare function useMemo<T>(factory:()=>T, deps:unknown[]):T;
      function presentation(condition:boolean) {
        const descriptionKey = condition ? 'live.first' : 'live.second';
        return { descriptionKey, internal:'dead.key' };
      }
      const item=useMemo(()=>presentation(true),[]);t(item.descriptionKey);
    `, { live: { first: 'First', second: 'Second' }, dead: { key: 'Unused' } });
    expect(result.unresolvedCalls).toEqual([]);
    expect(result.unusedKeys).toEqual(['dead.key']);
    expect(result.usedKeys).toEqual(['live.first', 'live.second']);
  });

  it('fails an unbounded dynamic key instead of treating its namespace as consumed', () => {
    const result = audit('declare function t(key:string):string; declare const userInput:string; t(`media.${userInput}`);',
      { media: { photo: 'Photo', video: 'Video' } });
    expect(result.unresolvedCalls).toEqual([expect.objectContaining({ line: 1, expression: '`media.${userInput}`' })]);
    expect(result.usedKeys).toEqual([]);
    expect(result.unusedKeys).toEqual(['media.photo', 'media.video']);
    expect(result.ok).toBe(false);
  });

  it('follows a real translator passed to a helper without treating every translate-named function as i18n', () => {
    const result = audit(`
      declare function t(key:string):string;
      function labels(translate:(key:string)=>string) { return translate('folder.media'); }
      function unrelated(translate:(key:string)=>string) { return translate('dead.key'); }
      labels(t);
    `, { folder: { media: 'Media' }, dead: { key: 'Unused' } });
    expect(result.unresolvedCalls).toEqual([]);
    expect(result.usedKeys).toEqual(['folder.media']);
    expect(result.unusedKeys).toEqual(['dead.key']);
  });

  it('reports a missing finite key rather than silently intersecting its values with the locale', () => {
    const result = audit("declare function t(key:string):string; declare const kind:'photo'|'video';t(`media.${kind}`);", { media: { photo: 'Photo' } });
    expect(result.missingKeys).toEqual(['media.video']);
    expect(result.unresolvedCalls).toEqual([]);
    expect(result.ok).toBe(false);
  });

  it('does not count dead files or comments as consumers while following local production imports', () => {
    const result = auditI18nSources({
      files: {
        '/virtual/src/App.tsx': "import './Visible'; import type {Legacy} from './Dead'; // t('dead.key')\n",
        '/virtual/src/Visible.ts': "declare function t(key:string):string;t('live.key');",
        '/virtual/src/Dead.ts': "export type Legacy=string;declare function t(key:string):string;t('dead.key');",
      },
      entryFiles: ['/virtual/src/App.tsx'], compilerOptions: { noLib: true },
      en: { live: { key: 'Live' }, dead: { key: 'Dead' } }, he: { live: { key: 'חי' }, dead: { key: 'ישן' } },
    });
    expect(result.visitedFiles).toEqual(['/virtual/src/App.tsx', '/virtual/src/Visible.ts']);
    expect(result.usedKeys).toEqual(['live.key']);
    expect(result.unusedKeys).toEqual(['dead.key']);
  });

  it('requires exact locale-key and interpolation parity', () => {
    const result = audit("declare function t(key:string):string;t('count');t('onlyEn');",
      { count: '{{saved}} saved, {{failed}} failed', onlyEn: 'Missing' }, { count: '{{saved}} נשמרו', onlyHe: 'עוד' });
    expect(result.interpolationMismatches).toEqual(['count']);
    expect(result.missingHebrewKeys).toEqual(['onlyEn']);
    expect(result.extraHebrewKeys).toEqual(['onlyHe']);
    expect(result.ok).toBe(false);
  });

  it.each(['SAF folder', 'timestamp', '<b>טקסט</b>', '{{count}', '{value}', '%s'])('rejects raw/technical Hebrew copy: %s', (value) => {
    const result = audit("declare function t(key:string):string;t('label');", { label: 'Label' }, { label: value });
    expect(result.hebrewViolations).not.toEqual([]);
    expect(result.ok).toBe(false);
  });

  it('accepts valid consumed Hebrew interpolation without banning its source tokens', () => {
    const result = audit("declare function t(key:string):string;t('label');", { label: '{{count}} saved' }, { label: '{{count}} נשמרו' });
    expect(result.hebrewViolations).toEqual([]);
    expect(result.interpolationMismatches).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
