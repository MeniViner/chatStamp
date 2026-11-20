const { AndroidConfig, withAndroidManifest, withAppBuildGradle, withGradleProperties, withMainActivity, withMainApplication, withProjectBuildGradle } = require('expo/config-plugins');

const propsBlock = `
def chatstampReleaseProps = new Properties()
def chatstampReleasePropsFile = file(System.getenv("CHATSTAMP_RELEASE_PROPERTIES_FILE") ?: "\${System.getProperty('user.home')}/.chatstamp/android-release-signing.properties")
if (chatstampReleasePropsFile.exists()) {
    chatstampReleasePropsFile.withInputStream { stream -> chatstampReleaseProps.load(stream) }
}

def chatstampReleaseStoreFile = System.getenv("CHATSTAMP_RELEASE_STORE_FILE") ?: chatstampReleaseProps.getProperty("CHATSTAMP_RELEASE_STORE_FILE")
def chatstampReleaseStorePassword = System.getenv("CHATSTAMP_RELEASE_STORE_PASSWORD") ?: chatstampReleaseProps.getProperty("CHATSTAMP_RELEASE_STORE_PASSWORD")
def chatstampReleaseKeyAlias = System.getenv("CHATSTAMP_RELEASE_KEY_ALIAS") ?: chatstampReleaseProps.getProperty("CHATSTAMP_RELEASE_KEY_ALIAS")
def chatstampReleaseKeyPassword = System.getenv("CHATSTAMP_RELEASE_KEY_PASSWORD") ?: chatstampReleaseProps.getProperty("CHATSTAMP_RELEASE_KEY_PASSWORD")
def chatstampReleaseSigningConfigured = [chatstampReleaseStoreFile, chatstampReleaseStorePassword, chatstampReleaseKeyAlias, chatstampReleaseKeyPassword].every { it != null && it.toString().trim().length() > 0 }
`;

function ensureProperty(properties, key, value) {
  const existing = properties.find((item) => item.type === 'property' && item.key === key);
  if (existing) {
    existing.value = value;
  } else {
    properties.push({ type: 'property', key, value });
  }
}

function applyReleaseSigning(buildGradle) {
  let contents = buildGradle;

  if (!contents.includes('chatstampReleaseSigningConfigured')) {
    contents = contents.replace(
      'def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()\n',
      `def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()\n${propsBlock}`
    );
  }
  if (!contents.includes('def chatstampReleaseSigningConfigured =') || !contents.includes('def chatstampReleaseStoreFile =')) {
    throw new Error('chatStamp could not install the release signing inputs; refusing an unknown Gradle template.');
  }

  if (!contents.includes('if (chatstampReleaseSigningConfigured) {\n            release {')) {
    contents = contents.replace(
      /signingConfigs \{\n\s+debug \{\n\s+storeFile file\('debug\.keystore'\)\n\s+storePassword 'android'\n\s+keyAlias 'androiddebugkey'\n\s+keyPassword 'android'\n\s+\}\n\s+\}/,
      `signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        if (chatstampReleaseSigningConfigured) {
            release {
                storeFile file(chatstampReleaseStoreFile)
                storePassword chatstampReleaseStorePassword
                keyAlias chatstampReleaseKeyAlias
                keyPassword chatstampReleaseKeyPassword
            }
        }
    }`
    );
  }
  if (!contents.includes('if (chatstampReleaseSigningConfigured) {\n            release {')) {
    throw new Error('chatStamp could not install the existing release signing configuration.');
  }

  const buildTypesStart = contents.indexOf('buildTypes {');
  const releaseStart = contents.indexOf('release {', buildTypesStart);
  const releaseEnd = contents.indexOf('\n        }', releaseStart);
  if (buildTypesStart < 0 || releaseStart < 0 || releaseEnd < 0) {
    throw new Error('chatStamp could not locate the release build type; refusing unknown signing configuration.');
  }
  const release = contents.slice(releaseStart, releaseEnd);
  const signedRelease = release.replace(
    /^[ \t]*signingConfig signingConfigs\.debug[ \t]*$/m,
    `            if (chatstampReleaseSigningConfigured) {
                signingConfig signingConfigs.release
            }`
  );
  if (!signedRelease.includes('signingConfig signingConfigs.release') || signedRelease.includes('signingConfigs.debug')) {
    throw new Error('chatStamp could not select the existing release signing configuration.');
  }
  contents = contents.slice(0, releaseStart) + signedRelease + contents.slice(releaseEnd);

  return contents;
}

function executableKotlin(contents) {
  const code = contents.split('');
  let offset = 0;
  while (offset < contents.length) {
    const start = offset;
    if (contents.startsWith('//', offset)) {
      const end = contents.indexOf('\n', offset + 2);
      offset = end < 0 ? contents.length : end;
    } else if (contents.startsWith('/*', offset)) {
      let depth = 1;
      offset += 2;
      while (offset < contents.length && depth > 0) {
        if (contents.startsWith('/*', offset)) { depth++; offset += 2; }
        else if (contents.startsWith('*/', offset)) { depth--; offset += 2; }
        else offset++;
      }
      if (depth !== 0) throw new Error('chatStamp found an unterminated Kotlin comment.');
    } else if (contents.startsWith('"""', offset)) {
      const end = contents.indexOf('"""', offset + 3);
      if (end < 0) throw new Error('chatStamp found an unterminated Kotlin string.');
      offset = end + 3;
    } else if ('"\'`'.includes(contents[offset])) {
      const quote = contents[offset++];
      while (offset < contents.length && contents[offset] !== quote) {
        offset += contents[offset] === '\\' ? 2 : 1;
      }
      if (offset >= contents.length) throw new Error('chatStamp found an unterminated Kotlin literal.');
      offset++;
    } else { offset++; continue; }
    for (let index = start; index < offset; index++) {
      if (code[index] !== '\n' && code[index] !== '\r') code[index] = ' ';
    }
  }
  return code.join('');
}

function applyLaunchLanguagePolicy(contents) {
  const hook = 'com.chatstamp.nativebridge.NativeLanguagePolicy.apply(this)';
  const code = executableKotlin(contents);
  const starts = [...code.matchAll(/\boverride\s+fun\s+onCreate\s*\(\s*\)\s*\{\s*super\.onCreate\(\s*\)/g)];
  const loads = [...code.matchAll(/\bloadReactNative\(\s*this\s*\)/g)];
  if (starts.length !== 1 || loads.length !== 1) {
    throw new Error('chatStamp requires a reviewed MainApplication startup template for language direction.');
  }
  const insertion = starts[0].index + starts[0][0].length;
  const load = loads[0].index;
  if (load <= insertion) throw new Error('chatStamp language direction must be installed before React Native startup.');
  const installed = [...code.matchAll(/\bcom\.chatstamp\.nativebridge\.NativeLanguagePolicy\.apply\s*\(\s*this\s*\)/g)];
  if (installed.length > 0) {
    const position = installed[0].index;
    if (installed.length !== 1 || position < insertion || position >= load || code.slice(insertion, position).trim()) {
      throw new Error('chatStamp found an unsafe or duplicate language startup hook.');
    }
    return contents;
  }
  return `${contents.slice(0, insertion)}\n    ${hook}${contents.slice(insertion)}`;
}

function activityMethod(contents, signature) {
  const code = executableKotlin(contents);
  const matches = [...code.matchAll(signature)];
  if (matches.length !== 1) throw new Error('chatStamp requires one reviewed Activity lifecycle method.');
  const start = matches[0].index;
  const open = code.indexOf('{', start);
  let depth = 1;
  let end = open + 1;
  while (end < code.length && depth > 0) {
    if (code[end] === '{') depth++;
    if (code[end] === '}') depth--;
    end++;
  }
  if (depth !== 0) throw new Error('chatStamp found an incomplete MainActivity lifecycle method.');
  return { code, start, open, end, body: code.slice(open + 1, end - 1) };
}

function applyShareIntentCapture(contents) {
  const hook = 'com.chatstamp.nativebridge.SharedExportReceiver.capture(this, intent)';
  const createSignature = /\boverride\s+fun\s+onCreate\s*\(\s*savedInstanceState\s*:\s*(?:android\.os\.)?Bundle\?\s*\)\s*\{/g;
  const created = activityMethod(contents, createSignature);
  const supers = [...created.body.matchAll(/\bsuper\.onCreate\s*\(\s*(?:null|savedInstanceState)\s*\)/g)];
  if (supers.length !== 1) throw new Error('chatStamp requires a reviewed Activity startup anchor.');
  const superPosition = created.open + 1 + supers[0].index;
  const beforeSuper = created.body.slice(0, supers[0].index);
  let nesting = 0;
  for (const character of beforeSuper) {
    if (character === '{') nesting++;
    if (character === '}') nesting--;
  }
  if (nesting !== 0 || /\b(?:return|throw)\b/.test(beforeSuper)) {
    throw new Error('chatStamp requires unconditional capture before Activity startup.');
  }
  const reviewedPrefix = beforeSuper
    .replace(/\bcom\.chatstamp\.nativebridge\.SharedExportReceiver\.capture\s*\(\s*this\s*,\s*intent\s*\)/g, '')
    .replace(/[\s;]/g, '');
  if (reviewedPrefix !== '' && reviewedPrefix !== 'setTheme(R.style.AppTheme)') {
    throw new Error('chatStamp requires the reviewed unconditional Activity startup prefix.');
  }
  const createHooks = [...created.body.matchAll(/\bcom\.chatstamp\.nativebridge\.SharedExportReceiver\.capture\s*\(\s*this\s*,\s*intent\s*\)/g)];
  if (createHooks.length) {
    const hookStart = created.open + 1 + createHooks[0].index;
    const hookLine = contents.lastIndexOf('\n', hookStart) + 1;
    if (createHooks.length !== 1 || hookStart > superPosition || contents.slice(hookLine, hookStart).trim()
      || created.body.slice(createHooks[0].index + createHooks[0][0].length, supers[0].index).trim()) {
      throw new Error('chatStamp must capture the launch share before React startup.');
    }
  } else {
    const line = contents.lastIndexOf('\n', superPosition) + 1;
    const indent = contents.slice(line, superPosition);
    if (indent.trim()) throw new Error('chatStamp requires an unconditional Activity startup anchor.');
    contents = `${contents.slice(0, line)}${indent}${hook}\n${contents.slice(line)}`;
  }
  const updated = activityMethod(contents, createSignature);
  const newSignatures = [...updated.code.matchAll(/\boverride\s+fun\s+onNewIntent\b/g)];
  if (newSignatures.length === 0) {
    const method = `\n\n  override fun onNewIntent(intent: android.content.Intent) {\n    ${hook}\n    setIntent(intent)\n    super.onNewIntent(intent)\n  }`;
    contents = `${contents.slice(0, updated.end)}${method}${contents.slice(updated.end)}`;
  } else {
    const incoming = activityMethod(contents, /\boverride\s+fun\s+onNewIntent\s*\(\s*intent\s*:\s*(?:android\.content\.)?Intent\s*\)\s*\{/g);
    const expected = `${hook} setIntent(intent) super.onNewIntent(intent)`.replace(/\s+/g, '');
    if (incoming.body.replace(/\s+/g, '') !== expected) {
      throw new Error('chatStamp found an unreviewed new-intent handler.');
    }
  }
  if ([...executableKotlin(contents).matchAll(/\bcom\.chatstamp\.nativebridge\.SharedExportReceiver\.capture\s*\(/g)].length !== 2) {
    throw new Error('chatStamp found unexpected share-capture hooks.');
  }
  return contents;
}

const withChatStampAndroidRelease = (config) => {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const portraitName = 'android.hardware.screen.portrait';
    const features = manifest['uses-feature'] ?? [];
    const portraitIndex = features.findIndex((feature) => feature.$?.['android:name'] === portraitName);
    const portrait = portraitIndex < 0 ? { $: { 'android:name': portraitName } } : features[portraitIndex];
    const replaced = new Set((portrait.$['tools:replace'] ?? '').split(',').map((name) => name.trim()).filter(Boolean));
    replaced.add('android:required');
    portrait.$ = { ...portrait.$, 'android:required': 'false', 'tools:replace': [...replaced].join(',') };
    manifest.$ = { ...manifest.$, 'xmlns:tools': 'http://schemas.android.com/tools' };
    manifest['uses-feature'] = portraitIndex < 0 ? [...features, portrait]
      : features.filter((feature, index) => feature.$?.['android:name'] !== portraitName || index === portraitIndex);
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    application.$['android:allowBackup'] = 'false';
    application.$['android:fullBackupContent'] = 'false';
    application.$['android:dataExtractionRules'] = '@xml/chatstamp_data_extraction_rules';
    application.$['android:supportsRtl'] = 'true';
    return config;
  });
  config = withMainApplication(config, (config) => {
    if (config.modResults.language !== 'kt') throw new Error('chatStamp requires a reviewed Kotlin MainApplication template.');
    config.modResults.contents = applyLaunchLanguagePolicy(config.modResults.contents);
    return config;
  });
  config = withMainActivity(config, (config) => {
    if (config.modResults.language !== 'kt') throw new Error('chatStamp requires a reviewed Kotlin MainActivity template.');
    config.modResults.contents = applyShareIntentCapture(config.modResults.contents);
    return config;
  });
  config = withGradleProperties(config, (config) => {
    ensureProperty(config.modResults, 'android.minSdkVersion', '30');
    ensureProperty(config.modResults, 'android.compileSdkVersion', '36');
    ensureProperty(config.modResults, 'android.targetSdkVersion', '36');
    ensureProperty(config.modResults, 'android.buildToolsVersion', '36.0.0');
    ensureProperty(config.modResults, 'android.enableMinifyInReleaseBuilds', 'true');
    ensureProperty(config.modResults, 'android.enableShrinkResourcesInReleaseBuilds', 'true');
    ensureProperty(config.modResults, 'android.enablePngCrunchInReleaseBuilds', 'true');
    return config;
  });

  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') throw new Error('chatStamp requires a reviewed Groovy root Gradle template.');
    const anchor = 'apply plugin: "expo-root-project"';
    const pin = "ext.ndkVersion = '27.1.12297006'";
    if (!config.modResults.contents.includes(pin)) {
      if (!config.modResults.contents.includes(anchor)) throw new Error('chatStamp could not pin the NDK before Expo defaults.');
      config.modResults.contents = config.modResults.contents.replace(anchor, `${pin}\n${anchor}`);
    }
    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') throw new Error('chatStamp requires a reviewed Groovy release signing template.');
    config.modResults.contents = applyReleaseSigning(config.modResults.contents);
    return config;
  });

  return config;
};

module.exports = withChatStampAndroidRelease;
