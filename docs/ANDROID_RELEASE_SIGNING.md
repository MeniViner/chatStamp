# Android Release Signing

Release signing for chatStamp is local-only. Do not commit keystores, passwords,
or generated signing property files.

The Android release build reads signing values from environment variables first:

```bash
export CHATSTAMP_RELEASE_STORE_FILE="$HOME/.chatstamp/keystores/chatstamp-release.keystore"
export CHATSTAMP_RELEASE_STORE_PASSWORD="..."
export CHATSTAMP_RELEASE_KEY_ALIAS="chatstamp-release"
export CHATSTAMP_RELEASE_KEY_PASSWORD="..."
```

Alternatively, create this local file outside the repository:

```text
~/.chatstamp/android-release-signing.properties
```

with the same property names:

```properties
CHATSTAMP_RELEASE_STORE_FILE=/absolute/path/to/chatstamp-release.keystore
CHATSTAMP_RELEASE_STORE_PASSWORD=...
CHATSTAMP_RELEASE_KEY_ALIAS=chatstamp-release
CHATSTAMP_RELEASE_KEY_PASSWORD=...
```

The repository `.gitignore` excludes `*.jks`, `*.keystore`, and `.env` files,
but the preferred location is still outside the repo.

If no release signing values are present, Gradle produces an unsigned release
APK. Do not distribute that APK as a production release.

Local release build environment used for v0.1.1:

```bash
export JAVA_HOME="$HOME/.chatstamp/jdks/temurin-17/Contents/Home"
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/36.0.0:$PATH"
```
