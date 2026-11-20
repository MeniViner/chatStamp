import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const policyCall = 'com.chatstamp.nativebridge.NativeLanguagePolicy.apply';
const template = `package com.menis10tec.chatstamp

import android.app.Application
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import expo.modules.ApplicationLifecycleDispatcher

class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }
}
`;

/** Execute the public plugin's real MainApplication/manifest mods, without prebuild. */
function applyPlugin(contents: string, language = 'kt', applicationId = 'com.menis10tec.chatstamp') {
  let generated: string | undefined;
  const application = { $: { 'android:supportsRtl': 'false' } as Record<string, string> };
  const plugins = {
    AndroidConfig: { Manifest: { getMainApplicationOrThrow: () => application } },
    withAndroidManifest: (config: object, action: (value: { modResults: object }) => unknown) => {
      action({ ...config, modResults: { manifest: { $: { package: applicationId } } } }); return config;
    },
    withMainApplication: (config: object, action: (value: { modResults: { language: string; contents: string } }) => { modResults: { contents: string } }) => {
      generated = action({ ...config, modResults: { language, contents } }).modResults.contents;
      return config;
    },
    withGradleProperties: (config: object) => config,
    withMainActivity: (config: object) => config,
    withProjectBuildGradle: (config: object) => config,
    withAppBuildGradle: (config: object) => config
  };
  const pluginModule = { exports: undefined as unknown };
  runInNewContext(readFileSync('plugins/withChatStampAndroidRelease.js', 'utf8'), {
    module: pluginModule,
    require: (name: string) => {
      if (name !== 'expo/config-plugins') throw new Error(`Unexpected plugin dependency: ${name}`);
      return plugins;
    }
  }, { timeout: 1_000 });
  (pluginModule.exports as (config: object) => unknown)({});
  if (generated === undefined) throw new Error('MainApplication mod was not registered');
  return { contents: generated, application };
}

/** Read generated Kotlin calls, excluding comment/string decoys. */
function tokens(contents: string): string[] {
  const result: string[] = [];
  let offset = 0;
  while (offset < contents.length) {
    const rest = contents.slice(offset);
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) { offset += whitespace[0].length; continue; }
    if (rest.startsWith('//')) {
      const end = contents.indexOf('\n', offset); offset = end < 0 ? contents.length : end + 1; continue;
    }
    if (rest.startsWith('/*')) {
      const end = contents.indexOf('*/', offset + 2);
      if (end < 0) throw new Error('Unterminated Kotlin comment');
      offset = end + 2; continue;
    }
    const quote = contents[offset];
    if (quote === '"' || quote === "'") {
      offset++;
      while (offset < contents.length && contents[offset] !== quote) {
        offset += contents[offset] === '\\' ? 2 : 1;
      }
      if (offset >= contents.length) throw new Error('Unterminated Kotlin string');
      offset++; continue;
    }
    const identifier = /^[A-Za-z_$][A-Za-z0-9_.$]*/.exec(rest);
    if (identifier) { result.push(identifier[0]); offset += identifier[0].length; }
    else { result.push(contents[offset]); offset++; }
  }
  return result;
}

function closing(input: string[], start: number, open: string, close: string) {
  let depth = 0;
  for (let index = start; index < input.length; index++) {
    if (input[index] === open) depth++;
    if (input[index] === close && --depth === 0) return index;
  }
  throw new Error(`Unbalanced generated Kotlin ${open}`);
}

function assertStartupPolicy(contents: string) {
  const all = tokens(contents);
  const declaration = all.findIndex((value, index) => value === 'fun' && all[index + 1] === 'onCreate');
  expect(declaration).toBeGreaterThanOrEqual(0);
  const bodyStart = all.indexOf('{', declaration);
  const body = all.slice(bodyStart + 1, closing(all, bodyStart, '{', '}'));
  const calls = body.filter((value, index) => body[index + 1] === '(' && ['super.onCreate', policyCall, 'loadReactNative'].includes(value));
  expect(calls).toEqual(['super.onCreate', policyCall, 'loadReactNative']);
  expect(all.filter((value, index) => value === policyCall && all[index + 1] === '(')).toHaveLength(1);
  const call = body.indexOf(policyCall);
  expect(body.slice(call + 2, closing(body, call + 1, '(', ')'))).toEqual(['this']);
}

describe('durable native language policy before the first React surface', () => {
  it('generates one real native policy call after Application super and before React Native loading', () => {
    const generated = applyPlugin(template);
    assertStartupPolicy(generated.contents);
    expect(generated.application.$['android:supportsRtl']).toBe('true');
  });

  it('preserves Expo font/configuration startup while installing the policy before runtime initialization', () => {
    const currentExpo = template.replace('    loadReactNative(this)', `    // @generated begin xml-fonts-init - expo prebuild
    // @generated end xml-fonts-init
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (error: IllegalArgumentException) { ReleaseLevel.STABLE }
    loadReactNative(this)`);
    const generated = applyPlugin(currentExpo).contents;
    assertStartupPolicy(generated);
    expect(tokens(generated)).toContain('DefaultNewArchitectureEntryPoint.releaseLevel');
  });

  it('is byte-identical across repeated clean-prebuild plugin applications', () => {
    const first = applyPlugin(template).contents;
    expect(applyPlugin(first).contents).toBe(first);
    expect(applyPlugin(applyPlugin(first).contents).contents).toBe(first);
    assertStartupPolicy(first);
  });

  it('uses the same native startup policy for the side-by-side QA application', () => {
    const generated = applyPlugin(template, 'kt', 'com.menis10tec.chatstamp.qa').contents;
    assertStartupPolicy(generated);
    expect(generated.startsWith('package com.menis10tec.chatstamp\n')).toBe(true);
  });

  it('cannot mistake a commented-out policy call for an installed executable hook', () => {
    const commented = template.replace('    super.onCreate()', `    super.onCreate()\n    // ${policyCall}(this)`);
    let generated: string;
    try { generated = applyPlugin(commented).contents; }
    catch { return; } // Rejecting an ambiguous template is an acceptable closed failure.
    assertStartupPolicy(generated);
  });

  it.each([
    ['missing onCreate', template.replace('override fun onCreate()', 'override fun initializeApplication()')],
    ['missing Application super', template.replace('    super.onCreate()\n', '')],
    ['missing React runtime anchor', template.replace('    loadReactNative(this)\n', '')],
    ['ambiguous onCreate', template + '\nclass Other { override fun onCreate() { super.onCreate() } }'],
    ['ambiguous React runtime anchor', template.replace('    loadReactNative(this)', '    loadReactNative(this)\n    loadReactNative(this)')],
    ['misplaced native hook', template.replace('    loadReactNative(this)', `    loadReactNative(this)\n    ${policyCall}(this)`) ],
    ['duplicate native hooks', template.replace('    super.onCreate()', `    super.onCreate()\n    ${policyCall}(this)\n    ${policyCall}(this)`)]
  ])('fails closed for %s rather than silently shipping a late or missing policy', (_name, contents) => {
    expect(() => applyPlugin(contents)).toThrow();
  });

  it('rejects an unreviewed Java template instead of silently skipping the policy', () => {
    expect(() => applyPlugin('class MainApplication {}', 'java')).toThrow();
  });
});
