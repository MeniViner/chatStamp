import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const capture = 'com.chatstamp.nativebridge.SharedExportReceiver.capture';
const template = `package com.menis10tec.chatstamp
import android.os.Bundle
import com.facebook.react.ReactActivity
class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    super.onCreate(null)
  }
  override fun getMainComponentName(): String = "main"
}
`;

function applyPlugin(contents: string, language = 'kt'): string {
  let generated: string | undefined;
  const application = { $: {} as Record<string, string> };
  const plugins = {
    AndroidConfig: { Manifest: { getMainApplicationOrThrow: () => application } },
    withAndroidManifest: (config: object, action: (value: { modResults: object }) => unknown) => {
      action({ ...config, modResults: { manifest: { $: { package: 'com.menis10tec.chatstamp' } } } }); return config;
    },
    withMainActivity: (config: object, action: (value: { modResults: { language: string; contents: string } }) => { modResults: { contents: string } }) => {
      generated = action({ ...config, modResults: { language, contents } }).modResults.contents; return config;
    },
    withMainApplication: (config: object) => config,
    withGradleProperties: (config: object) => config,
    withProjectBuildGradle: (config: object) => config,
    withAppBuildGradle: (config: object) => config,
  };
  const pluginModule = { exports: undefined as unknown };
  runInNewContext(readFileSync('plugins/withChatStampAndroidRelease.js', 'utf8'), {
    module: pluginModule,
    require: (name: string) => {
      if (name !== 'expo/config-plugins') throw new Error(`Unexpected plugin dependency ${name}`);
      return plugins;
    },
  }, { timeout: 1000 });
  (pluginModule.exports as (config: object) => unknown)({});
  if (generated === undefined) throw new Error('MainActivity mod was not applied');
  return generated;
}

/** Read generated executable Kotlin, ignoring comments and literal decoys. */
function tokens(contents: string): string[] {
  const result: string[] = [];
  for (let at = 0; at < contents.length;) {
    const rest = contents.slice(at);
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) { at += whitespace[0].length; continue; }
    if (rest.startsWith('//')) { const end = contents.indexOf('\n', at); at = end < 0 ? contents.length : end + 1; continue; }
    if (rest.startsWith('/*')) {
      let depth = 1; at += 2;
      while (at < contents.length && depth) {
        if (contents.startsWith('/*', at)) { depth++; at += 2; }
        else if (contents.startsWith('*/', at)) { depth--; at += 2; }
        else at++;
      }
      if (depth) throw new Error('Unterminated Kotlin comment');
      continue;
    }
    if (rest.startsWith('"""')) {
      const end = contents.indexOf('"""', at + 3);
      if (end < 0) throw new Error('Unterminated Kotlin raw string');
      at = end + 3; continue;
    }
    if (rest[0] === '"' || rest[0] === "'") {
      const quote = rest[0]; at++;
      while (at < contents.length && contents[at] !== quote) at += contents[at] === '\\' ? 2 : 1;
      if (at >= contents.length) throw new Error('Unterminated Kotlin string');
      at++; continue;
    }
    const name = /^[A-Za-z_$][A-Za-z0-9_.$]*/.exec(rest);
    if (name) { result.push(name[0]); at += name[0].length; }
    else { result.push(contents[at]); at++; }
  }
  return result;
}
function body(contents: string, name: string): string[] {
  const code = tokens(contents);
  const methods = code.flatMap((value, index) => value === 'fun' && code[index + 1] === name ? [index] : []);
  expect(methods).toHaveLength(1);
  const start = code.indexOf('{', methods[0]);
  let depth = 1;
  for (let index = start + 1; index < code.length; index++) {
    if (code[index] === '{') depth++;
    if (code[index] === '}' && --depth === 0) return code.slice(start + 1, index);
  }
  throw new Error(`Unterminated ${name}`);
}
function assertCapturedBeforeReact(contents: string) {
  const created = body(contents, 'onCreate');
  expect(created.filter((value) => value === capture)).toHaveLength(1);
  expect(created.filter((value) => value === 'super.onCreate')).toHaveLength(1);
  expect(created.indexOf(capture)).toBeLessThan(created.indexOf('super.onCreate'));
  expect(body(contents, 'onNewIntent').join('')).toBe(`${capture}(this,intent)setIntent(intent)super.onNewIntent(intent)`);
}

describe('durable WhatsApp Activity intake before React readiness', () => {
  it('captures cold launch before super and warm intent before setIntent/super dispatch', () => {
    const generated = applyPlugin(template);
    assertCapturedBeforeReact(generated);
    expect(tokens(generated)).toContain('setTheme');
  });

  it('keeps repeated clean-prebuild transformation idempotent without duplicate handlers', () => {
    const generated = applyPlugin(template);
    expect(applyPlugin(generated)).toBe(generated);
    assertCapturedBeforeReact(generated);
  });

  it.each([
    `// ${capture}(this, intent)\n`,
    `/* outer /* ${capture}(this, intent) */ still a comment */\n`,
    `val documentation = """${capture}(this, intent) super.onCreate(null)"""\n`,
  ])('does not mistake comment/string documentation for an installed capture hook (%s)', (decoy) => {
    const input = decoy.startsWith('val documentation')
      ? template.replace('  override fun onCreate', `  ${decoy}  override fun onCreate`)
      : template.replace('    super.onCreate(null)', `    ${decoy}    super.onCreate(null)`);
    assertCapturedBeforeReact(applyPlugin(input));
  });

  it.each([
    { name: 'missing lifecycle', contents: template.replace('onCreate', 'oldOnCreate') },
    { name: 'missing super', contents: template.replace('super.onCreate(null)', 'initializeSomethingElse()') },
    { name: 'ambiguous lifecycle', contents: template.replace('  override fun getMainComponentName()', '  override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(null) }\n  override fun getMainComponentName()') },
    { name: 'late capture', contents: template.replace('super.onCreate(null)', `super.onCreate(null)\n    ${capture}(this, intent)`) },
    { name: 'duplicate capture', contents: template.replace('super.onCreate(null)', `${capture}(this, intent)\n    ${capture}(this, intent)\n    super.onCreate(null)`) },
    { name: 'conditional existing capture', contents: template.replace('super.onCreate(null)', `if (intent != null) { ${capture}(this, intent) }\n    super.onCreate(null)`) },
    { name: 'unbraced conditional capture', contents: template.replace('super.onCreate(null)', `if (intent != null)\n      ${capture}(this, intent)\n    super.onCreate(null)`) },
    { name: 'conditional super anchor', contents: template.replace('super.onCreate(null)', 'if (savedInstanceState != null) {\n      super.onCreate(null)\n    }') },
    { name: 'unbraced conditional super anchor', contents: template.replace('super.onCreate(null)', 'if (savedInstanceState != null)\n      super.onCreate(null)') },
    { name: 'unreviewed warm handler', contents: template.replace('  override fun getMainComponentName()', '  override fun onNewIntent(intent: android.content.Intent) { super.onNewIntent(intent) }\n  override fun getMainComponentName()') },
  ])('fails closed for $name instead of silently losing incoming shares', ({ contents }) => {
    expect(() => applyPlugin(contents)).toThrow();
  });

  it('rejects an unreviewed Java template instead of skipping capture', () => {
    expect(() => applyPlugin(template, 'java')).toThrow();
  });
});
