import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const signingTemplate = `
def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()
android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            shrinkResources true
            minifyEnabled true
        }
    }
}
`;

/** Execute the public config plugin; no Gradle, signing files or environment is available. */
function applyPlugin(contents: string): string {
  let result: string | undefined;
  const application = { $: {} as Record<string, string> };
  const configPlugins = {
    AndroidConfig: { Manifest: { getMainApplicationOrThrow: () => application } },
    withAndroidManifest: (config: object, action: (value: { modResults: object }) => unknown) => {
      action({ ...config, modResults: {} });
      return config;
    },
    withGradleProperties: (config: object, action: (value: { modResults: object[] }) => unknown) => {
      action({ ...config, modResults: [] });
      return config;
    },
    withMainApplication: (config: object) => config,
    withProjectBuildGradle: (config: object, action: (value: { modResults: { language: string; contents: string } }) => unknown) => {
      action({ ...config, modResults: { language: 'groovy', contents: 'apply plugin: "expo-root-project"\n' } });
      return config;
    },
    withAppBuildGradle: (config: object, action: (value: { modResults: { language: string; contents: string } }) => { modResults: { contents: string } }) => {
      result = action({ ...config, modResults: { language: 'groovy', contents } }).modResults.contents;
      return config;
    },
  };
  const pluginModule = { exports: undefined as unknown };
  runInNewContext(readFileSync('plugins/withChatStampAndroidRelease.js', 'utf8'), {
    module: pluginModule,
    require: (name: string) => {
      if (name !== 'expo/config-plugins') throw new Error(`Unexpected plugin dependency: ${name}`);
      return configPlugins;
    },
  }, { timeout: 1_000 });
  (pluginModule.exports as (config: object) => unknown)({});
  if (result === undefined) throw new Error('Plugin did not generate app build.gradle');
  return result;
}

type Token = { kind: 'identifier' | 'string' | 'punctuation'; value: string };

/** Small Groovy DSL reader for generated signing decisions, not plugin-source matching. */
function tokens(contents: string): Token[] {
  const result: Token[] = [];
  let offset = 0;
  while (offset < contents.length) {
    const rest = contents.slice(offset);
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) { offset += whitespace[0].length; continue; }
    if (rest.startsWith('//')) {
      const end = contents.indexOf('\n', offset);
      offset = end < 0 ? contents.length : end + 1;
      continue;
    }
    if (rest.startsWith('/*')) {
      const end = contents.indexOf('*/', offset + 2);
      if (end < 0) throw new Error('Unterminated Groovy comment');
      offset = end + 2;
      continue;
    }
    const quote = contents[offset];
    if (quote === "'" || quote === '"') {
      let value = '';
      offset += 1;
      while (offset < contents.length && contents[offset] !== quote) {
        if (contents[offset] === '\\') offset += 1;
        value += contents[offset];
        offset += 1;
      }
      if (offset >= contents.length) throw new Error('Unterminated Groovy string');
      offset += 1;
      result.push({ kind: 'string', value });
      continue;
    }
    const identifier = /^[A-Za-z_$][A-Za-z0-9_.$]*/.exec(rest);
    if (identifier) {
      result.push({ kind: 'identifier', value: identifier[0] });
      offset += identifier[0].length;
    } else {
      result.push({ kind: 'punctuation', value: contents[offset] });
      offset += 1;
    }
  }
  return result;
}

function closing(input: Token[], start: number, open = '{', close = '}'): number {
  let depth = 0;
  for (let index = start; index < input.length; index += 1) {
    if (input[index].kind !== 'punctuation') continue;
    if (input[index].value === open) depth += 1;
    if (input[index].value === close && --depth === 0) return index;
  }
  throw new Error('Unbalanced generated Groovy block');
}

function block(input: Token[], name: string): Token[] {
  const start = input.findIndex((value, index) => value.kind === 'identifier' && value.value === name && input[index + 1]?.value === '{');
  if (start < 0) throw new Error(`Missing generated ${name} block`);
  return input.slice(start + 2, closing(input, start + 1));
}

function enabledTokens(input: Token[], configured: boolean): Token[] {
  const output: Token[] = [];
  for (let index = 0; index < input.length; index += 1) {
    if (input[index].value === 'if') {
      const conditionEnd = closing(input, index + 1, '(', ')');
      const condition = input.slice(index + 2, conditionEnd).map((value) => value.value).join('');
      if (condition !== 'chatstampReleaseSigningConfigured') throw new Error(`Unexpected signing guard: ${condition}`);
      const bodyEnd = closing(input, conditionEnd + 1);
      if (configured) output.push(...enabledTokens(input.slice(conditionEnd + 2, bodyEnd), configured));
      index = bodyEnd;
    } else {
      output.push(input[index]);
    }
  }
  return output;
}

function signer(input: Token[]): string | null {
  const assignments = input.flatMap((value, index) => value.value === 'signingConfig' ? [input[index + 1]?.value] : []);
  if (assignments.length > 1) throw new Error('More than one active signingConfig assignment');
  return assignments[0]?.replace(/^signingConfigs\./, '') ?? null;
}

function binding(input: Token[], name: string): object {
  const start = input.findIndex((value) => value.value === name);
  if (start < 0) throw new Error(`Missing signing property: ${name}`);
  const next = input[start + 1];
  return next.value === 'file'
    ? { file: input[start + 3] }
    : { value: next };
}

function signingModel(contents: string, configured: boolean) {
  const android = block(tokens(contents), 'android');
  const declarations = enabledTokens(block(android, 'signingConfigs'), configured);
  const buildTypes = block(android, 'buildTypes');
  const debug = signer(enabledTokens(block(buildTypes, 'debug'), configured));
  const release = signer(enabledTokens(block(buildTypes, 'release'), configured));
  const resolve = (name: string | null) => {
    if (name === null) return null;
    const declaration = block(declarations, name);
    return Object.fromEntries(['storeFile', 'storePassword', 'keyAlias', 'keyPassword'].map((key) => [key, binding(declaration, key)]));
  };
  return { debug, release, debugConfiguration: resolve(debug), releaseConfiguration: resolve(release), declarations };
}

describe('Android release signing generation', () => {
  it('selects the owner signer across Expo Caution comments while preserving the debug signer', () => {
    const result = signingModel(applyPlugin(signingTemplate), true);
    expect(result.debug).toBe('debug');
    expect(result.release).toBe('release');
    expect(result.releaseConfiguration).toEqual({
      storeFile: { file: { kind: 'identifier', value: 'chatstampReleaseStoreFile' } },
      storePassword: { value: { kind: 'identifier', value: 'chatstampReleaseStorePassword' } },
      keyAlias: { value: { kind: 'identifier', value: 'chatstampReleaseKeyAlias' } },
      keyPassword: { value: { kind: 'identifier', value: 'chatstampReleaseKeyPassword' } },
    });
    expect(result.debugConfiguration).toEqual(signingModel(signingTemplate, true).debugConfiguration);
  });

  it('leaves release unsigned when configuration is missing and never falls back to debug', () => {
    const result = signingModel(applyPlugin(signingTemplate), false);
    expect(result.debug).toBe('debug');
    expect(result.release).toBeNull();
    expect(result.releaseConfiguration).toBeNull();
    expect(() => block(result.declarations, 'release')).toThrow('Missing generated release block');
  });

  it('is byte-identical after repeated prebuild application', () => {
    const first = applyPlugin(signingTemplate);
    expect(applyPlugin(first)).toBe(first);
    expect(signingModel(applyPlugin(first), true).release).toBe('release');
    expect(signingModel(applyPlugin(first), false).release).toBeNull();
  });

  it('supports the same Expo template without optional release comments', () => {
    const template = signingTemplate.replace(/^[ \t]*\/\/.*\n/gm, '');
    expect(signingModel(applyPlugin(template), true).release).toBe('release');
  });

  it.each([
    ['unknown build-type signer', signingTemplate.replace('signingConfig signingConfigs.debug\n            shrinkResources', 'signingConfig signingConfigs.unknown\n            shrinkResources')],
    ['missing release build type', signingTemplate.replace('        release {', '        production {')],
    ['unknown signingConfigs template', signingTemplate.replace("file('debug.keystore')", "file('different-debug.keystore')")],
    ['missing property injection anchor', signingTemplate.replace('def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()\n', '')],
  ])('fails closed for %s', (_name, template) => {
    expect(() => applyPlugin(template)).toThrow(/chatstamp|signing|release/i);
  });
});
