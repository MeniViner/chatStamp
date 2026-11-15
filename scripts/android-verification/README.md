# Android verification

The helpers use Python 3.10+, FFmpeg, FFprobe, and Android SDK platform-tools. Set `ANDROID_HOME` for ADB discovery. Set `ANDROID_SERIAL` when several devices are connected. Choose a fresh `CHATSTAMP_QA_RUN_ID` for each run. The default is `fixture`, and generated files go under `dist/android-verification/<run-id>/`. Use `CHATSTAMP_QA_MEDIA_ROOT` to query a run under Pictures, DCIM, or Movies.

Build a standalone debug APK from the repository root.

```powershell
npx expo prebuild --platform android --clean
.\android\gradlew.bat -p android --console=plain --max-workers=2 -I "$PWD\scripts\android-verification\device-test.init.gradle" :app:assembleDebug '-PreactNativeArchitectures=arm64-v8a'
```

Check `android/app/build/outputs/apk/debug/output-metadata.json` for the QA application ID `com.menis.chatstamp.qa` before installing. Use the SDK's ADB for installation and the scripts.

```powershell
$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
& $adb install -r android/app/build/outputs/apk/debug/app-debug.apk
$env:CHATSTAMP_QA_RUN_ID = 'stage-a'
python scripts/android-verification/fixtures.py
$zip = python scripts/android-verification/device.py prepare mixed
& $adb shell am force-stop com.menis.chatstamp.qa
python scripts/android-verification/device.py share $zip
python scripts/android-verification/device.py dump qa-selection
```

Use `prepare` with `text-only`, `no-transcript`, `invalid`, or `large` for the other generated ZIPs. `fixtures.py --skip-large` omits the 128 MiB fixture. A baseline app requires a cold share or the system ZIP picker. Complete or skip onboarding before verifying the selection screen.

Run `media-evidence.py` after saving the mixed fixture to read back the dates for the five baseline media files. Run `large-import.py` while the system picker shows the large ZIP to record sampled memory. Run `cleanup-device.py` after collecting evidence from the synthetic run.

After prebuild, prefetch the current AGP connected runner dependencies without a device.

```powershell
.\android\gradlew.bat -p android --console=plain --max-workers=2 '-Dorg.gradle.internal.http.connectionTimeout=12000' '-Dorg.gradle.internal.http.socketTimeout=12000' -I "$PWD\scripts\android-verification\connected-runner.init.gradle" :chatstamp-native:prepareChatStampConnectedRunner
```
