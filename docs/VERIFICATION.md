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


## B-close continuation · 2026-11-18

Smoke steps 1–8 pass again at application head `fe7be66` (112 Vitest, 5 JVM,
3 connected tests). The physical UI acceptance is **UNVERIFIED — owner unlock
required**. Wake alone leaves the secure keyguard showing. Unlock the A30,
install the isolated QA APK, skip onboarding, enable Always use message date,
import the five-file ZIP through the picker, save, run the tracked readback
assertions, and inspect Samsung Gallery. Then rerun duplicates in both languages
and save the undated VCF. The corresponding exact procedure is in
scripts/android-verification/README.md; no Gallery result is inferred from tests.


## Stage C · current implementation smoke · 2026-11-18

The final fresh cycle (`stage-c-final`) passes npm ci, strict TypeScript,
191 Vitest tests in 32 files, ESLint, clean Android prebuild and two-worker arm64
QA assembly. APK/merged-manifest inspection confirms QA identity, min SDK 30,
target SDK 36, no broad storage/media-read permission, an exported=false dataSync
service and the three foreground-service/notification declarations.

JUnit XML records 23 passing JVM tests (11 archive policy,5 MP4,7 cancellation/error
classification) and 10 passing connected tests on each of Galaxy A30/API 30 and
Android16/API 36 emulator. No failures, errors or skips. The controls include
unsafe-entry skipping, stream fingerprint/no-copy behavior, candidate retention,
malformed/truncated archives, STORED CRC corruption, DEFLATED descriptor CRC
corruption, scoped date writes and atomic store/path safety.

On the API 36 emulator the app UI imported the 128 MiB synthetic ZIP through the
system picker. Its private cache contained only the 66-byte transcript and the
134,220,717-byte extracted MP4, with no complete ZIP or DocumentPicker cache.
After confirming Back→Discard and a cold launch, the job had zero remaining
files (8 KiB empty directory allocation). This is API 36 app/cache evidence, not
physical Gallery acceptance. Small readback/screenshot files are under the
single `dist/android-verification/rebuild-20261118/` curated output set.

Physical B-close and the C warm/cold share, background save, notification denial,
mid-save cancel and API 36 dataSync timeout UI cases are still being executed.
No Play release or Gallery acceptance is inferred from the automated checks.


## B-close · physical app and Gallery acceptance · PASS · 2026-11-18

The system-picker-to-Gallery regression passed on Samsung Galaxy A30 SM-A305F,
Android 11 / API 30, Samsung Gallery 12.1.09.1, timezone Asia/Jerusalem. The
installed side-by-side package was `com.menis.chatstamp.qa`, using the retained
APK from `fe7be660d69c2a1fd26a57983fd06fa375afc999`, SHA-256
`0065af3cab31781d83c90682da839d58fae1d5bd17f963fdbd833a53d351386c`.
No Stage B product-code changes were needed. This acceptance is scoped to that
APK and handset. The branch's subsequent Stage C source `25a9abc` has separate
runtime acceptance in progress.

The baseline's complete smoke passed with 112 Vitest tests, five JVM tests and
three API 30 connected tests, plus typecheck, lint, clean prebuild, arm64 QA build
and min30/target36/no-broad-storage-permission inspection. With Always use message
date enabled, the app imported the synthetic ZIP through the picker and saved
all five selected media files without special storage access.

| Fixture / saved row | Chat instant (UTC) | DATE_TAKEN (ms) | DATE_MODIFIED (s) | Reopened metadata |
| --- | --- | --- | --- | --- |
| Red JPEG / 121 | 2019-02-15 08:30:00Z | 1550219400000 | 1550219400 | EXIF 2019:02:15 10:30:00, +02:00 |
| Green MP4 / 124 | 2019-02-16 09:30:00Z | 1550309400000 | 1550309400 | FFprobe creation_time 2019-02-16T09:30:00Z |
| Blue JPEG / 122 | 2020-03-16 13:15:00Z | 1584364500000 | 1584364500 | EXIF 2020:03:16 15:15:00, +02:00 |
| Yellow PNG / 123 | 2020-03-16 13:16:00Z | 1584364560000 | 1584364560 | EXIF 2020:03:16 15:16:00, +02:00 |
| Purple MP4 / 125 | 2020-03-17 10:00:00Z | 1584439200000 | 1584439200 | FFprobe creation_time 2020-03-17T10:00:00Z |

All indexed values matched exactly, satisfying the two-second tolerance. The
[app results](../dist/android-verification/rebuild-20261118/stage-b-five-results-api30.png)
show five saved, five dates verified and zero failures. The saved videos carry
the chat instants despite their deliberately wrong source creation dates.

Samsung Gallery's default
[Date created, descending setting](../dist/android-verification/rebuild-20261118/stage-b-gallery-sort-api30.png)
produced [purple, yellow, blue, green, red](../dist/android-verification/rebuild-20261118/stage-b-gallery-order-api30.png).
The Hebrew grid reads right-to-left: purple through green occupy the first row,
then red is first on the next row. The
[red JPEG detail view](../dist/android-verification/rebuild-20261118/stage-b-red-details-api30.png)
shows 15 February 2019, 10:30.

The [first inventory](../dist/android-verification/rebuild-20261118/stage-b-first.json),
[Hebrew rerun](../dist/android-verification/rebuild-20261118/stage-b-second.json), and
[English language rerun](../dist/android-verification/rebuild-20261118/stage-b-language-rerun.json)
retain exactly IDs 121–125 and one destination,
`Pictures/chatStamp/chatstamp-qa-b-20261118-mixed/`. Skip existing created neither
another media copy nor another folder after the language change.

The unmatched `undated.vcf` saved as published row 128 (`IS_PENDING=0`) under
`Documents/chatStamp/chatstamp-qa-b-20261118-undated/`. The
[undated results screen](../dist/android-verification/rebuild-20261118/stage-b-undated-result-api30.png)
reports one saved, zero dates verified, zero failures, Date unavailable and
Saved without a date. Its
[URI/path record](../dist/android-verification/rebuild-20261118/stage-b-undated.json)
keeps successful publication distinct from unavailable date verification.

The [acceptance and cleanup record](../dist/android-verification/rebuild-20261118/stage-b-acceptance.json)
confirms QA/helper uninstallation, source-fixture removal, no remaining saved run
rows, stay-awake restored to 7 and screen timeout restored to 600000 ms.
Independent review found no remaining B-close findings. Earlier pending-unlock
entries remain as run history. Stage C physical/runtime acceptance and the
minified release's five-file regression remain required before G1 acceptance.


## Stage C accepted · physical API30 and emulator API36 · 2026-11-18

- Real Google Files Share to the open QA process retained its PID and started
  exactly one import; force-stop plus the same real share launched a new process
  and started exactly one import. The granted content URI was used directly.
- Physical128MiB extraction held only the134220717-byte video and66-byte transcript,
  with no private ZIP/DocumentPicker/shared ZIP copy. Confirmed Back/discard and
  cold launch left zero job files. Independent five-file MediaStore/EXIF/FFprobe
  readback also passed after the new save implementation.
- Fresh physical background saves completed while Launcher remained foreground,
  both with notifications allowed and with API30 POST_NOTIFICATION blocked.
  Each published a new full128MiB file (rows133 and142), not an already-saved skip.
  API36 separately tested the Android13+ runtime notification-denial path.
- First physical cancel sampling waited for a published and pending row together;
  its brief insertion window was missed and all eight files completed. This was
  inconclusive, not a cancellation pass. **try another way**: use16videos and tap
  the visible Cancel footer as soon as one file is published while the FGS is
  active. Result:2saved,14cancelled; no pending/partial row; both completed32MiB
  files remain intact and FFprobe matches2019-02-21T09:00/09:01Z.
- Emulator API36 also passed real warm/cold share,128MiB cache/discard, fresh
  allowed/denied background writes,4saved/20cancelled with full files, and the
  official dataSync timeout controls. System timeout was followed by clean
  service stop about40ms later, with no pending/partial output or crash.
- Runtime testing found misleading cancellation summary copy. Results now counts
  newly saved outcomes separately from cancelled/failed/skipped rows and verified
  dates. History persists cancelled counts and reconciles older details; retries
  clear cancelled outcomes only when they actually save them. A new installed QA
  cold start visibly shows Partial save:2saved,14cancelled,0failed.
- Independent test author added17completion and14history regressions. Final
  complete smoke passed npm ci, strict TypeScript,222Vitest tests/34files, ESLint,
  clean prebuild, two-worker arm64 QA assembly, min30/target36/permission/service
  inspection,23JVM tests and10connected tests on each API30/API36; zero failures,
  errors or skips. Final reviewer found no actionable findings.
- Final QA APK SHA256:acfe5fd889feb63525b4162d3e5559f1bd74cf08ed6a9458564b046a1eed1558.
  It cold-launched in2.926s and its process crash buffer was empty.
- Physical cleanup removed17owned output rows and five source ZIPs, uninstalled
  QA/UI helper and restored stay-awake7 and screen timeout600000. Emulator cleanup
  removed its QA/run files and restored stay-awake1 and platform test defaults.
  Production package was absent and unchanged. Curated proof remains in the one
  ignored rebuild-20261118 evidence folder, currently below1MB.
- Provider-revocation simulation and crash recovery beyond cleanup of this
  operation's own orphaned pending rows remain explicitly deferred. API33
  physical coverage and a real owner WhatsApp export remain UNVERIFIED.


## Stage G1 preparation checkpoint · 2026-11-18

Version0.2.0/code3 is synchronized across Expo, root/module package metadata,
lockfile and module Gradle. Release policy removes unnecessary Internet/network,
overlay/audio/vibration/referrer capabilities, disables background media playback,
and excludes private data from backup/transfers. Actual minified AAB manifest
confirms exactly the three required platform permissions plus AndroidX's own
signature receiver permission, nondebuggable, min30/target36, backup disabled
and all nine-domain exclusion rules. Bilingual policy/listings/upload/tester
materials and in-app privacy/support actions are prepared; public website,
phone screenshots/demo and upload remain pending.

The first R8 pass found Commons Compress's optional Zstd class. A suppression
alone was rejected by review: its factory can run before the entry-method guard.
**try another way**: SupportedZipInputStream rejects Zstd in the protected factory.
Two known-size method20/93 JVM controls prove rejection before returning an entry.
The initial descriptor fixture did not enter that factory; the fixture was fixed,
not the assertion. Complete retry passes222Vitest/25JVM/10connected perAPI30/API36.
The minified bundle then builds successfully and bundletool validates it.

Artifact acceptance remains OPEN. Independent certificate comparison caught that
the old config-plugin regex missed Expo's commented release block, leaving the
DEBUG signingConfig selected. Fix the durable plugin, regression-test selection,
rebuild and require an exact established-upload-certificate match; never distribute
this preflight artifact. No new upload key was generated. All72native libraries
were inspected: all36ELF64 LOAD/RELRO results pass16KiB. Genuine ELF32 libraries
include4KiB segments; Android/AOSP policy scopes the16KiB requirement to64-bit
ABIs, so preserve their raw results and correct verifier applicability rather than
omit ABIs or claim ELF32 compatibility. The public policy page/Play upload are
not established by this checkpoint. Phone has securely locked again; owner unlock
was requested while independent release preparation continues.
