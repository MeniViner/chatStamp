import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type Element = { $: Record<string, string> };
type Manifest = {
  $: Record<string, string>;
  'uses-feature'?: Element[];
  'uses-permission': Element[];
  application: (Element & { activity: Element[] })[];
};
const portrait = 'android.hardware.screen.portrait';
const feature = (required?: string, extra: Record<string, string> = {}): Element => ({ $: {
  'android:name': portrait, ...(required === undefined ? {} : { 'android:required': required }), ...extra
} });

function manifest(features?: Element[]): Manifest {
  return {
    $: { package: 'com.menis10tec.chatstamp', 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
    ...(features === undefined ? {} : { 'uses-feature': features }),
    'uses-permission': ['FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_DATA_SYNC', 'POST_NOTIFICATIONS']
      .map((name) => ({ $: { 'android:name': `android.permission.${name}` } })),
    application: [{ $: { 'android:allowBackup': 'false', 'android:fullBackupContent': 'false',
      'android:dataExtractionRules': '@xml/chatstamp_data_extraction_rules', 'android:supportsRtl': 'true' },
    activity: [{ $: { 'android:name': '.MainActivity', 'android:screenOrientation': 'portrait', 'android:exported': 'true', 'android:launchMode': 'singleTask' } }] }]
  };
}

/** Drive the real public manifest mod; signing/Gradle/startup mods are separate suites. */
function applyPlugin(input: Manifest): Manifest {
  const output = structuredClone(input);
  const plugins = {
    AndroidConfig: { Manifest: { getMainApplicationOrThrow: () => output.application[0] } },
    withAndroidManifest: (config: object, action: (value: { modResults: { manifest: Manifest } }) => unknown) => {
      action({ ...config, modResults: { manifest: output } }); return config;
    },
    withMainApplication: (config: object) => config,
    withMainActivity: (config: object) => config,
    withGradleProperties: (config: object) => config,
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
  return output;
}

function portraitEntries(output: Manifest) { return (output['uses-feature'] ?? []).filter((entry) => entry.$['android:name'] === portrait); }
function assertOptional(output: Manifest) {
  expect(portraitEntries(output)).toHaveLength(1);
  expect(portraitEntries(output)[0].$['android:required']).toBe('false');
  expect(portraitEntries(output)[0].$['tools:replace'].split(',').map((name) => name.trim())).toContain('android:required');
  expect(output.$['xmlns:tools']).toBe('http://schemas.android.com/tools');
}

describe('portrait Play filtering stays optional while the activity stays portrait', () => {
  it.each([undefined, []] as (Element[] | undefined)[])('adds a missing optional declaration without changing activity or permissions (%s)', (features) => {
    const original = manifest(features), output = applyPlugin(original);
    assertOptional(output);
    expect(output.application).toEqual(original.application);
    expect(output['uses-permission']).toEqual(original['uses-permission']);
    expect(output.$.package).toBe(original.$.package);
  });

  it.each([undefined, 'true'])('overrides a default/explicit required portrait feature without discarding its metadata (%s)', (required) => {
    const output = applyPlugin(manifest([feature(required, { 'android:version': '1' })]));
    assertOptional(output);
    expect(portraitEntries(output)[0].$['android:version']).toBe('1');
  });

  it('merges the required-attribute override without losing existing merger instructions', () => {
    const output = applyPlugin(manifest([feature('false', { 'tools:replace': 'android:version, android:required' })]));
    assertOptional(output);
    expect(portraitEntries(output)[0].$['tools:replace'].split(',').map((name) => name.trim()))
      .toEqual(['android:version', 'android:required']);
  });

  it('deduplicates only the exact portrait feature and preserves unrelated declarations and first metadata', () => {
    const unrelated = { $: { 'android:name': 'android.hardware.touchscreen', 'android:required': 'false' } };
    const output = applyPlugin(manifest([unrelated, feature('true', { 'android:version': '1' }), feature('false', { 'android:version': '2' })]));
    assertOptional(output);
    expect(output['uses-feature']?.filter((entry) => entry.$['android:name'] !== portrait)).toEqual([unrelated]);
    expect(portraitEntries(output)[0].$['android:version']).toBe('1');
  });

  it('is idempotent across repeated prebuild generation and retains portrait activity behavior', () => {
    const first = applyPlugin(manifest([feature('true')]));
    expect(applyPlugin(first)).toEqual(first);
    expect(applyPlugin(applyPlugin(first))).toEqual(first);
    assertOptional(first);
    expect(first.application[0].activity[0].$['android:screenOrientation']).toBe('portrait');
  });
});
