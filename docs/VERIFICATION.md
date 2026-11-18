# chatStamp 0.1.1 verification

2026-11-15 on baseline commit `2a76514` and a Samsung Galaxy Note20 Ultra (SM-N986N, Android 13 / API 33, timezone Asia/Jerusalem). Samsung Gallery was version 14.5.14.0. The tests used synthetic WhatsApp-format ZIPs and an arm64 debug APK with bundled JavaScript and the separate application ID `com.menis.chatstamp.qa`.

## Build and automated checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm ci` | PASS | The lockfile installed successfully. npm reported 39 audit findings, including one critical. |
| `npm run typecheck`, `npm run test`, `npm run lint` | PASS | 111 tests in 27 test files. |
| Clean Android prebuild and debug assembly | PASS | Prebuild regenerated the ignored Android project. The first build stopped when Windows Clang failed to open an installed NDK header. The retry with `--max-workers=2` built the APK. |
| Native Gradle tests | NO-SOURCE / UNVERIFIED | The JVM task reported `NO-SOURCE` and the module has no Android test sources. The connected task stalled downloading its runner dependencies. An offline retry reported missing cached dependencies. The physical device scenarios below ran through ADB and the installed app. |
| Manifest storage permissions | FAIL | The merged manifest declares `MANAGE_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` (max SDK 32). App min SDK is 24 and target SDK is 36. |
| Supplemental parser cases | 2 PASS, 8 FAIL | The Hebrew dotted-date and iOS bracketed examples passed. Android PDF and M4A attachments, year-first dates, dot-separated times, and `p. m.` failed to match. The US example interpreted January 5 as May 1. A filename mentioned in plain text produced a false record. Two attachments in the same minute received equal timestamps. |

## Physical device results

| Scenario | Result | Observation |
| --- | --- | --- |
| Install and cold launch | PASS | ADB installed the APK and reported a cold launch. The onboarding screen rendered and the QA process crash log was empty. At system font scale 1.0, the first onboarding screen placed the Get started button partly under the bottom navigation area. Skip remained usable. |
| Pick a mixed ZIP | PASS | The Android file picker opened a ZIP containing nested folders, an extra TXT and an unsupported file. Native extraction retained the selected transcript and supported files. The transcript preview included its multiline caption, and an MP4 displayed its frame and player controls. |
| Attachment visibility | FAIL | Of 10 extracted items, eight appeared in the selection list. The unmatched JPEG and the VCF were present in the extracted cache and missing from the list. |
| Sender and media type filters | PASS for list filtering | Filtering to Dana and photos showed the expected single JPEG. The footer still showed the unfiltered per-type selection breakdown. |
| Default save and permissions | PASS with permission, FAIL for permission-free save | The Save media button was disabled before All files access. Android opened the All files access list with identically named entries. ADB granted access by package ID to the QA copy. Five selected files were saved and appeared in Samsung Gallery. |
| Gallery sorting by date created | FAIL | The default descending creation-date sort placed the green video first and the purple video last, reversing their chat order. The app displayed five dates fixed. |
| Gallery sorting by date modified | PASS for these fixtures | Switching the test album to descending modification date showed the expected chat order for all five files. The album sort was restored afterward. |
| Share to a stopped process | PASS | An ADB `ACTION_SEND` with a real MediaStore Downloads `content://` URI imported the text-only ZIP and selected its `_chat.txt`. |
| Share to an open process | FAIL | Android delivered the identical intent to the top-most activity. The PID stayed the same, the app stayed on Results and the ZIP generated no import log entry. |
| Invalid inputs | PASS | A ZIP without `_chat.txt` reached the missing-transcript message. A malformed archive reached Unsupported ZIP. The recovery path returned to the ZIP picker. |
| 128 MiB ZIP | PASS for this sample | A 134,221,021-byte ZIP imported from the file picker on the same PID. The selection UI was observed 4.02 s after the tap. Sampled process RSS rose about 25.5 MiB across 22 samples. This is a process measurement for one fixture. |
| Cache and disk use | PARTIAL | Successful save removed its working directory and kept the picker copy. Leaving selection and cold-starting kept the large extracted file, both private copies of its ZIP, and prior share copies. The large picker import used about 384 MiB of app cache in addition to the source ZIP. |

## Timestamp evidence

The table shows UTC instants. All five files had the expected filesystem modification time and MediaStore `DATE_MODIFIED`. Samsung Gallery also displayed the first JPEG's expected local time of 10:30 on 15 February 2019. The PNG had no internal date. The JPEG EXIF writer used UTC and `+00:00`. FFprobe read the two original, deliberately different MP4 creation times from the saved files.

| Fixture | Expected chat instant | Indexed `DATE_TAKEN` |
| --- | --- | --- |
| Red JPEG | 2019-02-15 08:30:00 | 2019-02-15 08:30:00 |
| Green MP4 | 2019-02-16 09:30:00 | 2022-07-08 09:10:11 |
| Blue JPEG | 2020-03-16 13:15:00 | 2020-03-16 13:15:00 |
| Yellow PNG | 2020-03-16 13:16:00 | NULL |
| Purple MP4 | 2020-03-17 10:00:00 | 2018-07-08 09:10:11 |

The creation-date order observed in the test album was green, yellow, blue, red, purple. The expected chat order was purple, yellow, blue, green, red. The album's modification-date sort produced the expected order.

## Evidence and reproduction

The local evidence directory is `dist/android-verification/`. It contains the Gradle and parser logs, fixture generator, device automation, saved metadata in `media-evidence.json`, `large-memory.json`, and the Gallery screenshots `gallery-test-album.png` and `gallery-sort-modified.png`.

After verification, the QA package, the Downloads fixtures, and the five Gallery files were removed. ADB and MediaStore queries confirmed the cleanup.

On the Windows workspace, use `npm ci`, `npm run typecheck`, `npm run test`, `npm run lint`, and `npx expo prebuild --platform android --clean`. Run the isolated build from `android`.

```powershell
.\gradlew.bat --console=plain --max-workers=2 -I ..\dist\android-verification\device-test.init.gradle :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
adb install app\build\outputs\apk\debug\app-debug.apk
.\gradlew.bat --console=plain :chatstamp-native:testDebugUnitTest :chatstamp-native:connectedDebugAndroidTest
```

From the repository root, `python dist/android-verification/fixtures.py` generates the synthetic exports. The supplemental cases can be rerun with `npx vitest run --config dist/android-verification/parser-evidence.config.mts`.

For the ADB share test, place the generated text-only ZIP in Downloads, scan it with `adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/<fixture-name>.zip`, and look up its ID in `adb shell content query --uri content://media/external/downloads --projection _id:_display_name`. Invoke the same command while the app is open and after `adb shell am force-stop com.menis.chatstamp.qa`.

```powershell
adb shell am start -W -a android.intent.action.SEND -t application/zip --grant-read-uri-permission --eu android.intent.extra.STREAM content://media/external/downloads/<id> -n com.menis.chatstamp.qa/com.menis.chatstamp.MainActivity
```

## Unverified cases

- Real WhatsApp export and share sheet. Export a test conversation with known photo and video message dates, use WhatsApp's share sheet to pass the archive to chatStamp, then save and compare the album's default creation-date order and file details with the conversation.
- Other Android versions and the larger-font and RTL layout matrix. Use the same fixtures on the target Android version, set the phone's font scale to 130%, and walk through onboarding, import, selection, save and results in English and Hebrew.
- Custom-folder timestamp capability, history deletion, duplicate policies, and decoder behavior under a large thumbnail list. These paths need separate device runs.

## Rebuild tooling

Use the [tracked verification helpers](../scripts/android-verification/README.md) for later rebuild stages. The commands and artifact paths above document the historical baseline run.

## Stage A · Samsung import smoke · 2026-11-16

The arm64 build of `com.menis.chatstamp.qa` cold-launched on the Galaxy Note20 Ultra SM-N986N, Android 13 / API 33. The Android picker imported the mixed synthetic ZIP without All Files Access. Selection showed the unmatched JPEG under Unknown sender with the approximate 17 April 2021 noon date and `contact.vcf` under Dana. The QA crash buffer for the process was empty and cleanup removed the QA package and synthetic Downloads item.

The cold ADB share of a shell-created `content://media/external/downloads/...` URI reached the app and failed provider access. The physical picker result satisfies the Stage A selection smoke. Stage C will verify source URI grants with actual Android shares. The screen captures, UI tree, app-scoped logs, and cleanup output are under `dist/android-verification/stage-a/`.

## Stage P — Scoped-storage feasibility

### Host preparation · 2026-11-16

The standalone probe and AndroidJUnitRunner test APK build with min SDK 30 and target SDK 36. The APK check confirms the QA package and runner identities and the absence of broad storage permissions. The six JVM tests pass. FFmpeg decodes all 11 source media assets and both rewritten MP4s. FFprobe independently reads both target MP4 creation times. Host logs and the fixture manifest are under `dist/android-verification/stage-p-host/`.

### Samsung Galaxy Note20 Ultra · API 33 · PASS · 2026-11-16

The [Stage P procedure](../scripts/android-verification/README.md#stage-p-storage-probe) ran on the SM-N986N with Samsung Gallery 14.5.14.0 and Asia/Jerusalem. Gradle `connectedDebugAndroidTest` passed one `ProbeIdentityTest`. The isolated `com.menis.chatstamp.qa.probe` and `com.menis.chatstamp.qa.probe.test` target API 36. The storage process UID and app UID were both 10628. The app requested zero permissions and runtime checks confirmed zero broad grants, no All Files Access and scoped storage. `ProbeStorageTest` passed one test covering all 13 files.

MediaStore `DATE_TAKEN` is expressed in milliseconds and `DATE_MODIFIED` in seconds. The probe set each file's mtime through its app-owned path while pending. The descriptor before and after publication and the indexed modification time matched the target for all 13 files. Reopened content matched the written bytes in every case. [MediaStore date columns](https://developer.android.com/reference/android/provider/MediaStore.MediaColumns)

| Fixture | Expected instant (UTC) | Reopened metadata | MediaStore `DATE_TAKEN` (ms) | MediaStore `DATE_MODIFIED` (s) | Destination and Gallery result |
| --- | --- | --- | --- | --- | --- |
| Red JPEG | 2019-02-15 08:30:00Z | `2019:02:15 10:30:00 +02:00` | 1550219400000 | 1550219400 | Shared Pictures album, fifth. Details showed 15 February 2019, 10:30. |
| Green MP4 | 2019-02-16 09:30:00Z | Retriever and FFprobe both 09:30:00Z | 1550309400000 | 1550309400 | Shared Pictures album, fourth |
| Blue JPEG | 2020-03-16 13:15:00Z | `2020:03:16 15:15:00 +02:00` | 1584364500000 | 1584364500 | Shared Pictures album, third |
| Yellow PNG | 2020-03-16 13:16:00Z | `2020:03:16 15:16:00 +02:00` | 1584364560000 | 1584364560 | Shared Pictures album, second |
| Purple MP4 | 2020-03-17 10:00:00Z | Retriever and FFprobe both 10:00:00Z | 1584439200000 | 1584439200 | Shared Pictures album, first |
| PNG control, cyan and orange | 2020-03-20 10:00:00Z and 2019-02-20 10:00:00Z | Both matched `12:00:00 +02:00` on their respective dates | 1584698400000 and 1550656800000 | 1584698400 and 1550656800 | Pictures control, indexed dates verified with opposing insert order |
| WebP control, white and magenta | 2020-03-21 10:00:00Z and 2019-02-21 10:00:00Z | Both matched `12:00:00 +02:00` on their respective dates | 1584784800000 and 1550743200000 | 1584784800 and 1550743200 | Pictures control, indexed dates verified with opposing insert order |
| OPUS and M4A | 2020-03-18 10:00:00Z and 10:01:00Z | Both reopened byte-for-byte | Null | 1584525600 and 1584525660 | Audio collection in Music |
| VCF and TXT | 2020-03-19 10:00:00Z and 10:01:00Z | Both reopened byte-for-byte | Null | 1584612000 and 1584612060 | Files collection in Documents |

The album under `Pictures/chatStamp/chatstamp-qa-stage-p-samsung-01/` accepted both image and video collections. Gallery was set to Date created (descending) and showed purple, yellow, blue, green, red. PNG and WebP used indexed capture dates. Modification-only Gallery sorting and other Gallery apps remain unverified. The music and document cases established byte readback and modification time.

Evidence is under `dist/android-verification/stage-p-samsung-01/`. It includes the connected XML, APK manifests, Android event log, FFprobe output on the reopened MP4s, and the Gallery order, sort preference, and red JPEG detail screen. `ProbeCleanupTest` passed with zero remaining owned rows; the host confirmed that the run directories, on-device UI captures, and both probe packages were removed. Use the paths and readback policy selected in the ExecPlan for Stage B.

## Stage B — App-owned saves · 2026-11-16

The QA APK passed package and permission inspection. It targets API 36, supports API 30 and later, and requests none of the broad external storage or media read permissions. TypeScript, Vitest (112 tests), ESLint, clean prebuild, and arm64 assembly passed.

The Galaxy Note20 Ultra (SM-N986N, API 33) ran three connected tests with zero failures or skips. The connected tests used the app save service and verified original and rewritten JPEG, PNG, and WebP dates in the winter and summer offsets, an undated document, stable resumable entries and colliding names, and retention of a previous MP4 when a replacement date could not be verified. Five JVM tests verified both MP4 header widths, multiple tracks, extended size, the movie after media data, truncated headers, and replacement eligibility.

The [Stage B app regression](../scripts/android-verification/README.md#stage-b-app-save-regression) uses the verified `com.menis.chatstamp.qa` APK. Expo installed it on the connected Samsung and ADB confirmed the QA activity. The handset then locked. The interactive app save, duplicate rerun, and Samsung Gallery order are `UNVERIFIED` until the fixture is imported and saved from the unlocked UI. The APK, manifest, Gradle logs, and fixture are under `dist/android-verification/stage-b/`.

## Stage R · current physical baseline · 2026-11-18

Recovered parent: `811a27561fc7733a7ccccbad25bab286013916e3`. Current device:
Samsung Galaxy A30 SM-A305F, Android 11 / API 30, arm64, Gallery 12.1.09.1,
Asia/Jerusalem. These results do not repeat or establish API 33 coverage.

| Current command/check | Result |
| --- | --- |
| `npm ci` | PASS; 901 packages installed; audit reports 59 findings, triage deferred to F |
| `npm run typecheck` | PASS |
| `npm run test` | PASS; 112 tests / 28 files |
| `npm run lint` | PASS |
| `npx expo prebuild --platform android --clean` | PASS |
| `./android/gradlew -p android --console=plain --max-workers=2 -I "$PWD/scripts/android-verification/device-test.init.gradle" :app:assembleDebug -PreactNativeArchitectures=arm64-v8a` | PASS; 252 executed tasks |
| SDK `aapt dump badging android/app/build/outputs/apk/debug/app-debug.apk` | PASS; QA ID, min 30, target 36, no broad storage/media-read permission |
| `./android/gradlew -p android --console=plain --max-workers=2 :chatstamp-native:testDebugUnitTest :chatstamp-native:connectedDebugAndroidTest -PreactNativeArchitectures=arm64-v8a` | PASS; XML: 5 JVM + 3 device tests; 0 failures/errors/skips |
| QA install, cold `am start -W`, UI dump and process crash buffer | PASS; rendered onboarding; 2.919 s; no QA crash entries |
| Baseline cleanup | PASS; QA uninstalled; stay-awake restored to 7 |

Toolchain: Node 26.7.0, local Temurin 17, Android SDK/build-tools 36 and NDK
27.1.12297006. Generated Android files and complete build logs are development
intermediates, not evidence deliverables. New compact results use
`dist/android-verification/rebuild-20261118/` across this continuation.

B-close app save, Gallery, duplicate and undated-file acceptance remain
`UNVERIFIED` until the next physical run. A passing connected storage test does
not stand in for those app/Gallery cases.

Verification tooling also passes 18 Python host tests (`python3 -m unittest discover -s scripts/android-verification -p 'test_*.py' -v`). The five-media and undated fixture generation passed using the installed cwebp fallback.
