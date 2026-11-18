const { AndroidConfig, withAndroidManifest, withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

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

const withChatStampAndroidRelease = (config) => {
  config = withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    application.$['android:allowBackup'] = 'false';
    application.$['android:fullBackupContent'] = 'false';
    application.$['android:dataExtractionRules'] = '@xml/chatstamp_data_extraction_rules';
    return config;
  });
  config = withGradleProperties(config, (config) => {
    ensureProperty(config.modResults, 'android.minSdkVersion', '30');
    ensureProperty(config.modResults, 'android.enableMinifyInReleaseBuilds', 'true');
    ensureProperty(config.modResults, 'android.enableShrinkResourcesInReleaseBuilds', 'true');
    ensureProperty(config.modResults, 'android.enablePngCrunchInReleaseBuilds', 'true');
    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = applyReleaseSigning(config.modResults.contents);
    }
    return config;
  });

  return config;
};

module.exports = withChatStampAndroidRelease;
