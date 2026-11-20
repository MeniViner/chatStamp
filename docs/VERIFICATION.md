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


## Stage G1 accepted with manual Play handoff · 2026-11-18

- Final complete smoke: npm ci, strict TypeScript, **230 Vitest tests/35 files**,
  lint, clean Android prebuild, two-worker QA assembly/manifest checks, **25 JVM
  tests**, and **10 connected tests on each API30/API36**, all passed. Independent
  signing-template tests cover eight cases; the standalone verifier/harness has
  **73 passing Python tests**. Reviewer found no remaining actionable findings.
- Fixed release signing selection across Expo comments and fail closed on unknown
  Gradle templates. Production AAB `dist/play/chatstamp-0.2.0-3.aab` SHA256
  `7cd6730b3b80742abeb50d1c61197ce4825c316ac2657ccea1f56e5e2c84c95d`
  validates and is signed by the established upload certificate SHA256
  `efe36695cfc6a3d9ea8471527103f29e3374322ab09890af41692412d76a66c8`.
  Exact identity/version0.2.0/code3/min30/target36/nondebug, signed payload coverage,
  backup exclusions, platform-permission trio and AndroidX own signature permission
  pass. All72 ELF libraries were inspected: all36 ELF64 LOAD/RELRO checks and
  APK16KiB ZIP alignment pass; genuine32-bit raw results are retained with explicit
  policy NOT_APPLICABLE. Actual16KiB-device runtime remains UNVERIFIED.
- The same owner-signed minified QA universal APK SHA256
  `3151927af160166cb15737050d0eb949228db5ed07a2ad3e483dc74a48359640`
  cold-launched in998ms and passed real-picker five-file save/readback on the
  physical Samsung A30/API30 and API36 emulator. Five saved and five dates verified
  agree independently with MediaStore, filesystem dates, EXIF and both MP4
  creation times. Phone Gallery default Date created descending shows purple,
  yellow, blue, green, red; red details show15Feb2019 10:30. Crash buffer empty.
- All eight synthetic actual-phone store screenshots are captured in English
  and Hebrew, with dimensions/hashes/provenance. The English fresh-save run
  intentionally removed Hebrew rows244–248 first; rows249–253 are new. This reset
  is not duplicate acceptance; accepted Stage B proves duplicate preservation.
- Privacy policy is public HTTP200 at
  https://meniviner.github.io/chatStamp/privacy-policy.html and matches tracked
  bilingual HTML. Pages currently serves fix/core-rebuild /docs; after owner merge
  switch to main /docs before deleting the branch. Installed Privacy policy action
  launches Chrome on both devices; browser first-run/sync prompts prevented page
  rendering. **UNVERIFIED:** owner completes their browser setup and taps Settings
  → Privacy policy; the test did not alter account/sync preferences.
- Recorded actual minified user-started save, live dataSync notification while
  Launcher was foreground, reattachment and4saved/4verified results. The14.4s
  `dist/play/chatstamp-0.2.0-3-fgs-demo.mp4` uses cuts around transitions and a crop
  of only the chatStamp notification to exclude unrelated personal notifications;
  no UI or progress was composited. A first timing attempt missed the shade:
  **try another way**: wait for Home to settle, then use a real downward swipe.
  The owner must publish an accessible video URL. No raw/private video is packaged.
- No Play service-account variable was supplied. **try another way:** signed AAB,
  bilingual listing/declarations/tester messages and exact numbered manual steps
  are ready; no upload or started closed-test period is claimed. Personal-account
  creation date and tester participation remain UNKNOWN. Real owner WhatsApp
  export and API33 physical coverage remain UNVERIFIED with G2 steps.
- Phone cleanup removed the five current Gallery rows and four demo rows, both
  source ZIPs, both temporary recordings and QA/helper packages; earlier trial
  rows were already removed. Display1080x2340/font1.1/timeout600000/stay-awake7
  restored. Emulator cleanup removed its QA/run files and restored stay-awake1.
  Production package stayed absent and unchanged. Compact proof is in the single
  ignored rebuild-20261118 folder; product AAB/demo are separate requested outputs.


### Stage D runtime checkpoint — 2026-11-18

Last pre-fix complete smoke (stage-d-final-2) passed305 Vitest/39files,35 JVM and
27 connected tests on each API30/API36, plus clean prebuild/QA assembly and
merged service/permission checks. First new native-test compilation used `.use`
with Android PdfDocument, which is not Closeable: **try another way**, explicit
try/finally close; assertions unchanged. The cycle was restarted from npm ci.

New grid creates zero ExoPlayers; physical pilot opened/released one cleanly.
Independent emulator preflight passed40 videos/eight scrolls with zero list
players, playback/16rapid-page taps/four reopen cycles with peak1/final0, and
all media formats, sender+Photos footer and hidden selections. Actual host tests
include500/5000 real memoized cells, shrinking/no-move gestures, lazy thumbnail
recovery and deferred native release across owner remounts/batched offers.

Runtime acceptance found a Fabric native-child-order error after date26→empty
date25→date26→scroll→Photos. It reproduced on c2763b9a… and final-2 APK
86e8e703be14151e1604b6e8e6e53cc606f12669ccdda375df65ca9059254577,
outside connected-test intervals. **try another way:** disable only native
removeClippedSubviews; keep SectionList windowSize5, initial/batch8 and stable
keys. Official RN guidance documents correctness risks with clipping:
https://reactnative.dev/docs/optimizing-flatlist-configuration#removeclippedsubviews
The failure is established; clipping is a controlled hypothesis pending replay,
not yet a proven cause/fix. Current code4 bundles are preflight artifacts and have
not been handed off/uploaded. D remains OPEN through the fresh smoke and replay.

Filter-sheet Reset was clipped at default emulator width; sender/date/sort controls
were observed, hidden selections preserved by manually clearing filters. Keep the
Reset defect explicit for the immediately following E sheet/inset work. No
all-controls-accessible claim is made. No E implementation has started.


## Stage D accepted · scoped runtime and signed update · 2026-11-18

Final whole cycle `stage-d-image-touch-final` passed npm ci, strict TypeScript,
305 Vitest tests/39 files, lint, clean Android prebuild/arm64 QA assembly, merged
identity/permission/service checks,35 JVM and27 connected tests on EACH API30
phone and API36 emulator. Reviewer found no remaining D source blockers against
CODE_REVIEW. The75 new TS tests exercise production selection, actual500/5000
memoized cells, thumbnail hooks, cleanup and deferred native-player ownership.

The native-clipping alternative passed three exact emulator replays of the
previous Fabric failure (date26→empty25→26→scroll→Photos); no Fabric error recurred.
SectionList keeps windowSize5/batch8/stable keys; only native clipping is disabled.
Image gestures originally competed with Pressable responder ownership: **try
another way**, place PanResponder on a plain parent View, preserve latest transform
when a pointer lifts and retain gesture ownership until release. Final physical
FINGER tests observed doubletap red extent810→1620px, two-finger→one-finger zoom
1758px, no paging during pan, then reset810px and a swipe to the next image.

Final upload-signed/minified QA APK SHA256
`69bfa0a5d78701556dc2386eb5f9d0cabd7d94c981a6f87afab24df35fee5015`
ran40videos/sixscrolls with zero grid players. Captured cold-PID11276 preview/
reopen window had4Init/4Release,peak1/final0,zero decoder-error lines and empty
crash buffer. A subsequent actual Play displayed00:01/00:02 and a decoded frame.
These are scoped event measurements, not independently queried decoder counts.
Rapid video swipes were not certified as page changes; actual photo swipe and
emulator16page-button transitions were observed independently.

Physical all-media acceptance: photo gestures; GIF actual two-color animation;
WebP rendered to match its white320x240 source; MP4 playback; OPUS reached20/20s;
PDF showed the labelled red first page; VCF showed QA Dana/+15550123456. TXT
FileProvider launched a real chooser. OEM HTML Viewer requested its own broad
media permission and exited on denial. **try another way:** an independent,
zero-permission disposable receiver read the actual granted content URI through
ContentResolver and displayed exact62-byte UTF8,READ_OK/read_grant=GRANTED. This
proves external transport; it does not certify that OEM viewer without its own
permission. API36 built-in HTML Viewer had displayed the document. No storage
permission was granted to chatStamp. Actual senderQA Dana+Photos footer1of1/673B
saved only the red JPEG; independent MediaStore datetaken1551175200000,
date_modified/mtime1551175200 agree with2019-02-26T10:00Z (1saved,1dateverified).

Signed production AAB `dist/play/chatstamp-0.2.0-4.aab` SHA256
`98b97a409ff9cfd38a1034095ea53faf26e51e6e001a1820081d027d682379e2`
and production universal APK SHA256
`5f96adb9dc2ff84610973642d74434366c9b5bd996c88326ba28efffff6b3827`
pass the full artifact verifier with the established upload cert,exact identity,
0.2.0/code4,min30/target36,minified/non-debuggable,allowed permissions,no backups,
zipalignment and all72ELF entries (36ELF64 pass16KiB;32-bit explicitpolicyN/A).
QA AAB/APK pass the same verifier except intentional.qa identity. First signed
install over debug was rejected for different certificates: **try another way**,
remove only our debug QA after deleting its own saved row,then install signed QA.
Production was absent and untouched. No service-account credential exists; code4
is packaged as the higher-code manual update under PLAY_UPLOAD_STEPS,not uploaded.
No internal/closed track availability or tester clock is claimed.

Current proof stays in `dist/android-verification/rebuild-20261118/`:d-emulator-
runtime.json,d-phone-runtime.json,gesture/filter/external/release40 receipts,
production/QA artifact reports and only small relevant screenshots. Actual phone
cleanup removed saved row340,two source ZIPs,QA/helper/native instrumentation and
temporary UI XML; restoredstayon7,timeout600000,font1.1,size1080x2340/density420
without overrides. Emulator QA/source/output cleanup passed; native test package
was removed after the final cycle,stayon1,font1.0,size1080x2400 unchanged.

Known E work: filter-sheet Reset is still clipped at default dimensions, and
footer/viewer native touch bounds need the E inset pass. Do not claim all-controls
accessibility. API33 physical remains UNVERIFIED (actualA30API30 substitute).
E/F/G2 now continue; real owner WhatsApp export and Play actions remain external.


### E implementation checkpoint · full smoke green · 2026-11-18

Wholecycle `stage-e-final-3` PASS:448Vitest/50files,strictTS,zero-warninglint,
cleanprebuild/QAarm64assemble,mergedSDK/permission/servicechecks,40JVM and35
connected tests on EACH API30phone/API36emu,zero failures/errors/skips. DebugQA
APK SHA256`1a76dbcbc4cbf6d41428b7edecbb783f5c1dafe04344eee4ce2b455bf6416af2`. Nativeprofiletests now independently verifyexact paths,
indexed relativepaths,published state and0→1/1→2rowcounts acrosslanguagechanges.
Reviewer source review clear; allreportedrace,bilingual-error,settingsmerge and
message-dateverification findings haveactualregressions. Standardper-fileVitest
isolation retainsoneworker; no acceptanceassertionsremoved.

Code5 source is checkpointed for signed release/runtime acceptance. This is not
E closure: actual minified restart/RTLbothdirections,Back/insets/font130/wideENHE,
updatedrealphone-onlysyntheticstoreimages,manualsignedupdate andcleanup remain.
Physicalphoneunlock wasrequestedagain; API33physical remains unavailable.


## E physical gate and independent F continuation · 2026-11-18

E implementation is preserved/pushed at041a79a (minified UIpreflight0db5579).
PhoneUI gate is externally BLOCKED on ownerunlock: securelock confirmed atrelease
build boundary; onlyMeni canunlock. No bypass,phoneUIclaim or phone screenshot
replacement is allowed. RequestedAPI33physical isalso unavailable; actualA30 is
API30. API36preflight remainsinprogress withits exclusivelease andexactAPKhase.
Do not mark E complete or claim finalminifiedpolicyacceptance. Final451-testcycle,
code5 rebuild/replay andstorecaptures remain after runtime/owner gates.

Groundrule9 permits independent next-stage work after alternatives are exhausted.
F cleanup/docs/CI-source preparation nowcontinues withoutdevice/build/prebuild/
connectedtest/npm-install mutations during the emulator lease. Implementer owns
caller-checkeddeadsource/exportcleanup; testauthor migratesactiveacceptance before
retiringtest-onlyhelpers; root ownsdocs,currentExecPlan,CI/policyguards andpackage
changes afterlease; reviewer laterreviewsfinaldiff. F release candidatewilluse
highercode6. NativeZIPsample-budget suspicion wasrefuted byowningsource (64KiB/TXT,
16MiBglobal,20kentries); do notchangeaworkingguard orreportit asadefect.


### 2026-11-18 — F validation corrections (candidate code6, acceptance pending)

Caller-checked cleanup removed obsolete screens/root strays and test-only helper
implementations. Criterion migration retains parser/date/cancel/history and real
500/5000-cell/player tests; host baseline is431 tests/46files (previous451 before
retiring duplicated wrapper assertions). Role handoff stays temporary; no raw
work inputs were repackaged as evidence.

Compatible SDK55 patching removes unused packages/redundant lint pins, declares
real core/asset dependencies and keeps RN0.83. npm audit37→11 findings; every
remaining package has a disposition in DEPENDENCY_AUDIT.md. Expo compatibility
also required RN0.83.10 and matching React types. No forced major override or
Expo52 downgrade. Reviewer found an inert NDK property: try another way, inject
root ext.ndkVersion before Expo defaults and assert the resolved app/root SDK,
build-tools and NDK in CI. AGP SDK getters use integer values.

Physical code5 preflight reproduced a native stale mixed-selection description
when narrowing an all-selected filter. RN setViewState only refreshed the label
for checked-string transitions. try another way: retain stable checkbox nodes
and include truthful busy:false on aggregate day/footer states to force native
label refresh. Final code6 native mixed→all/none/empty checks remain pending.

F wholecycle1 stopped at the empty-footer host assertion after this new state;
updated its exact expected map to retain checked/disabled plus busy:false.
Wholecycle2 passed431 host/TS/lint/prebuild but stopped at autolinking: expo-audio's
unbounded expo-asset peer selected SDK58 beside Expo55. try another way: declare
Expo's compatible expo-asset55.0.20 at the root, rather than patching node_modules
or relaxing native metadata parsing. Full cycle restarts at npm ci.


-2026-11-19 F wholecycle3:431 host/TS/lint/clean prebuild/QAarm64 assembly and
 manifest assertions passed (226 executed build tasks). Native step8 stopped in
 the temporary force-execution harness: its projectsEvaluated callback also ran
 for RN's included Gradle plugin build, where :chatstamp-native does not exist.
 try another way: scope the temporary task override to builds that actually own
 that project. No product assertion or connected test was weakened. Full cycle
 restarts from npm ci; CI uses its separate resolved-toolchain task.


## 2026-11-19 — E/F accepted in the executed scope; final code6 handoff

Final app source3f4ab91 (later changes are documentation/listing/check config).
The wholecycle4 passed npm ci, strict TypeScript,431 Vitest/46files, lint,
clean prebuild,226 executed QA build tasks, arm64 QA manifest/APK checks,
40 freshly executed JVM cases and39 connected cases on EACH API30/API36,
zero failures/skips. Debug QA cold launches rendered onboarding on both, with
empty per-process crash buffers. Python verifier/CI-harness81 tests pass;
strict i18n318 keys/zero issues and pinned Knip6.46.0 files/exports/types scan
zero issues. The tracked Knip config makes its Expo/native entries reproducible.
Fresh GitHub Android CI44406963599 on3f4ab91 passed431host/81Python/40JVM,
93 executed build tasks, actual resolved SDK36/min30/build-tools36/NDK27.1.12297006
and strict merged release permission/backup checks. Pages CI is separate.

Role closure: implementer caller-checked cleanup froze18edited/16deleted files;
test author moved duplicated legacy wrapper tests onto actual Screen/List/Viewer
boundaries (451→431 is an explained migration, not relaxed parser/date/cancel/
hidden-selection criteria); reviewer corrected the inert NDK pin and AGP getter
shape, then cleared source/docs review. The8 signing cases, C17 cancellation/
summary cases, atomic history and real500/5000 cell/player suites remain.

Both code6 signed production and QA artifacts pass verify-release.py with the
established upload certificate efe36695cfc6a3d9ea8471527103f29e3374322ab09890af41692412d76a66c8.
Production AAB dist/play/chatstamp-0.2.0-6.aab SHA256
591654c0bbe5c7e118acfe32e68e45156559251f12738a9c2bfb780cf5062394.
Production universal APK aec0ad7f0b9f737f6a6c20b349d7c34045442df4bc6f5d16646b4e87c5b0ef5b.
QA AAB3dde63f217d3991f603f9dd2217a81fa7a19ff672f038c481870d376a4600fec;
QA APK33031bd87f77a5bfa8cbb374be3a392c48dc471eb54a3f22da21a5cad4071fed.
Identity0.2.0/code6/min30/target36/nondebug/signature/payload/backup/permissions
pass. Every64 packaged ELF is inventoried:32 ELF64 required16KiB cases pass;
32 genuine32-bit cases retain raw values and explicit NOT_APPLICABLE. Bundle
alignment and universal APK zipalign pass. Actual16KiB-device runtime is still
UNVERIFIED; this is static verification, not a substituted runtime claim.

Final physical A30/API30 minified run:5new saved/5message dates verified agree
with independent MediaStore DATE_TAKEN/DATE_MODIFIED, filesystem mtime, JPEG/PNG
EXIF and both MP4 creation times. Samsung Gallery default creation-date descending
shows purple,yellow,blue,green,red in RTL reading order; red details15Feb2019
10:30. Same-language and HE→EN duplicate runs preserve all5URIs/paths and one
folder, with0new saved and Already saved details. Native same-bundle restarts
apply actual LTR/RTL in both directions without Metro. Native aggregate labels
clear mixed on all/none/narrowed/empty states;130% empty scope is disabled and
hidden TXT stays unchecked. Actual image double-tap grows the yellow area810→1552px.

Both EN/HE fresh512MiB four-video saves complete4saved/4verified after Back/Home.
Own foreground service remains active after Home; own progress notification is
observed, and expanding the Hebrew notification exposes Cancel. Eight independent
full-size output rows match expected indexed dates/modified dates. English11.17s
actual final demo shows Save/Cancel, own2/4 background notification and4/4results.
Variable-frame recording export was corrected by applying CFR before trim;
only the own notification rectangle is retained at its original position, with
black redaction elsewhere. Raw full-shade media was temporary and removed.

Final physical40-video regression:0 grid players after scrolling,1Init/1Release,
peak1/final0, actual native playback00:00→00:02. No final QA crash-buffer entries.
All8 store screenshots replaced with direct physical code6 captures (1080x2160,
RGB24, synthetic, native language direction); exact hashes/provenance tracked.
API36 final reviewer run independently passed5/5 readback with notifications
denied, actual EN↔HE root/modal restarts,130% phone/600dp modal actions, native
aggregate transitions, MP4/OPUS playback+seek,3Init/3Release peak1/final0.

Limits remain explicit: unavailable API33 physical; owner WhatsApp own-share
closed/warm real export; full every-screen×8configuration matrix; arbitrary
providers/Galleries/codecs, dark/wallpaper palette refresh and actual16KiB
runtime. Concurrent policy-race injection is host-tested, not claimed as a
minified runtime injection. Provider revocation and the narrow process-death
row-record window remain deferred per v4. Owner Chrome first-run blocked actual
policy-page rendering, although public URL and installed intent were verified.

Cleanup passed: phone13owned rows,4source ZIPs, recordings/window XML and QA/helper
removed; no own run rows or chatStamp/test packages remain. Original phone
1080x2340/density420/font1.1/timeout600000/stay-awake7 restored, no reverse ports.
Emulator reviewer removed5owned rows/fixtures/QA/helper, restored original
1080x2400/density420/font1/stay-awake1/timezone and removed reverse/scratch.
App-level discards preceded OS uninstall; release private cache was not read
through run-as. Production package stayed absent and was never installed/replaced.

Audit37→11 findings (9moderate/2high/0critical), all remaining packages have a
one-line disposition. Exact production Hermes map1016sources includes26Expo
runtime modules and one @expo/cli standalone Metro loader; reviewed loader has
no advised implementation, and glob/minimatch/zod plus other seven affected
Node-tooling packages are absent. See DEPENDENCY_AUDIT.md and the artifact-scoped
receipt; no universal dependency-safety or zero-audit claim is made.

G2 manual handoff is concrete: signed production AAB, isolated QA installer,
privacy-safe demo, bilingual refreshed listing/declarations, exact owner upload/
real-export steps and truthful production-access inputs. Play service-account
path remains unset. try another way: owner manual upload; no Console automation,
Play upload/live track/tester opt-in clock, production approval or merge claimed.
One final PR and head/CI receipts are recorded by the G2 closeout entry.

Small current proof is together under ignored dist/android-verification/rebuild-20261118;
requested binary/demo product files are separate under ignored dist/play. Store
assets and docs/screens are tracked. Combined proof/listing/screens remain under
10,000,000bytes; final exact size is recorded at handoff.


## 2026-11-19 — G2 owner handoff and PR opened

PR1 is open: https://github.com/MeniViner/chatStamp/pull/1, fix/core-rebuild→main,
created at branch head d3634a42c4333dfe075506b7689f49085b32dfdb. It is not merged.
Final code6 binary app source remains3f4ab91; subsequent commits update docs,
listing assets/check configuration and receipts. Current final head/CI are
recorded in the local primary report and PR checks rather than self-referencing
this commit. The production package was not installed or replaced.

Owner can now use the signed code6 AAB, isolated QA APK and11.17s actual synthetic
FGS demo under dist/play, the8updated store screenshots, live privacy URL and
numbered PLAY_UPLOAD_STEPS. TESTERS contains exact closed-app/warm WhatsApp
own-share acceptance and isolated installer commands, plus a private result form.
PLAY_RELEASE_CHECKLIST has truthful production-access inputs; external tester
counts/continuous opt-in/feedback and account creation date stay UNKNOWN.

No service-account path was configured. No agent Play upload/live track/tester
clock or production approval was established. The owner must upload manually,
publish an accessible demo URL, confirm account/audience/legal fields, recruit
qualifying testers and record the actual interval/feedback. Real owner export,
API33/full UI matrix, actual16KiB and remaining platform/provider limits remain
UNVERIFIED with exact follow-up in the primary report. QA/helper/test material
is removed and original phone/emulator settings restored. No cross-chat watcher,
recurring check, merge or automatic production rollout was created.


-2026-11-19 late CI note: d3634a4 push run44415277957 passed host/tooling
 checks but failed native configuration because Maven resolution reported
 com.google.code.gson:gson:2.9.1 missing in the repositories. Its official Maven
 Central POM independently returned HTTP200 (8208bytes, SHA256
 e5966323d7142570b37a4be979e21bc2dae848107e4dc416d8f44d9aa3f02903).
 Earlier full fresh runs3f4ab91 and6f3178f passed the identical app/dependency
 source. try another way: require the complete final-head push/PR checkout to
 rerun npm ci through native/JUnit/manifest gates; no continue-on-error, source
 dependency override or skipped test is introduced. Final run outcome/link is
 recorded in the primary report after completion.

-2026-11-19 G2 roles closed: implementer independently rehashed final AAB/QAAPK,
 checked demo/screens and finalized owner availability dates in upload steps;
 test author prepared concrete real-export closed/warm/privacy-safe result steps;
 reviewer found no material handoff issue, confirmed artifact/screens/demo and
 reverified the public policy HTTP200 byte-identical to tracked HTML. Owner-only
 gaps remain explicit. Device hygiene is complete and app source unchanged.


-2026-11-19 F CI transport repair: final-head MavenGson2.9.1 resolution failed
 again after a full fresh verify-job retry. try another way: a CI-only four-file
 repository fetches the unchanged Gson2.9.1 POM/JAR and parent POMs from the two
 official Maven Central hosts, validates pinned SHA256/size before atomic publish,
 and fails closed on tampering/missing/unsafe paths. A beforeSettings hook reaches
 composite builds, admits only those exact three GAVs, preserves Plugin Portal
 and ordinary Android buildscript repositories, and revalidates bytes before
 Gradle uses them. It neither patches node_modules nor changes runtime versions,
 package identity, signing, native app source or the existing code6 binaries.

 Implementer live official fetch/verify-only passed4/4; independent test author
 added24meaningful transport/integrity/cache/atomic/path regressions. Combined
 Python suite105/105 passes. Root's actual Gradle execution with both CI hooks
 passes resolved SDK/NDK,40 freshly executed JVM tests and production release
 manifest; strict ci-policy passes. Reviewer checked the composite/default-portal
 trap before implementation. A new fresh GitHub checkout must pass the complete
 npmci→host→prebuild→pinnedfetch→native→manifest path; no tests are skipped or
 marked continue-on-error. Final current CI link is recorded in the report.


- 2026-11-19 CI workflow evaluation correction: the first bootstrap push b51bd00
  was rejected before any job because runner.temp is unavailable in job-level
  env. try another way: define the identical runner-local repository in the
  fetch and Gradle step env blocks, where runner is supported. Official context
  table: https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability.
  No host/native gate was skipped. The earlier ea45a36 push CI44417140377 also
  completed successfully; its separate PR retry had failed Maven resolution.


- 2026-11-19 CI transport accepted on5e0917f: independent reviewer clear. Fresh
  GitHub PR run44421242295/job135214500429 passes checkout/npmci,431host/46files,
  TypeScript/lint,105Python,cleanprebuild,4/4pinned official artifact downloads,
  resolved SDK/NDK,40executed JVM,93executed Gradle tasks and strict production
  manifest/backup policy. https://github.com/MeniViner/chatStamp/actions/runs/44421242295
  Three newly read PR product findings are now being fixed separately: invalid
  retry after runtime recreation, silent share100 truncation, and stale parsed-
  import cache ownership. A new code7 artifact/fullsmoke/runtime gate follows;
  this CI checkpoint does not certify those uncommitted source fixes.


## 2026-11-19 — PR product review fixes, code7 source checkpoint

The three externally raised P2s were reproduced with independent acceptance
tests: runtime recreation could leave a visible empty Retry; category sharing
silently truncated after100; a superseded import could retain its extracted
job after native extraction finished. try another way: explicit reimport when
retry inputs are absent plus a no-empty-save guard; one shared Done/History
batch sheet with explicit ranges/Previous/Next and a separate chooser gesture
per at-most100files; native and JS oversized requests reject rather than cut.
The chooser opening is never described as successful delivery. Stale import
results release their exact job/grant before replacement; same-source grants
remain readable. Cleanup errors block replacement and retain cleanup context.
A second deferred-snapshot interleaving now reads current cleanup ownership
after awaits, so a just-published import result cannot be lost by reset.

Test author added25criterion regressions (10recovery/cleanup,15sharing) and
corrected the existing coordinator fixture to contain the1file its unchanged
21save assertions already modelled. Root full smoke from npmci passes
456Vitest/48files, TypeScript/lint, clean prebuild, two-worker arm64 QA assembly
(226executed tasks), QA manifest,40fresh JVM and39connected on each API30/API36
with0fail/skip.105Python and unused-source check pass; i18n has325keys with
parity/zero-unused assertions. Final source review, phone debug cold launch,
signed code7 artifact checks and minified runtime are separate pending gates.
The phone is locked; the owner unlock request is pending while builds and
emulator work continue. Earlier code6 artifacts remain historical candidates.


- 2026-11-19 code7 review gate failed despite green smoke: reviewer found that
  an old import cancellation can resume after replacement and discard the new
  import; async discard cleanup can similarly reset replacement state. try
  another way: fence or serialize lifecycle ownership, and add independently
  deferred cancellation/release regressions before rebuilding code8. Code7
  signed production/QA strict artifact checks passed, but code7 is superseded
  and was not accepted for final handoff or uploaded. No code7 media save was
  performed. Debug cold screens rendered on both devices with zero app crash
  entries; those checks do not waive the review finding. The first QA bundle
  command used the debug-only hook and stayed production-ID; this was caught
  before any installation. try another way: use release-test.init.gradle,
  then require the QA identity in strict artifact verification before install.


- Code7 UI harness correction: the isolated UI helper installation was rejected
  as TEST_ONLY before launch. try another way: install that known test APK
  with adb install -t; do not alter the product APK or testOnly policy. This
  tooling failure did not change product source or save any media.


- Code7 fresh CI44423400404/job135221916850 passed456host/105Python and native
  execution, then correctly rejected Native and application versions differ:
  root had raised Expo versionCode without updating the durable module Gradle
  versionCode. try another way: synchronize both to8 before the next complete
  clean-prebuild cycle; retain the source/manifest identity guard unchanged.
  The failed gate was not treated as a successful current CI run.


- 2026-11-19 code8 ownership fix: independent source reviewer reports no remaining
  material finding. A serialized transition queue covers cancellation, discard
  and replacement setup without holding extraction/parsing; captured identity
  and synchronous pending-transition fences protect the replacement, Save and
  language restart. Test author independently reran49/49 focused cases: recovery13,
  sharing15 and coordinator21. All3P1 regressions changed from red to green with
  unchanged assertions. Root restarted the entire smoke at npmci;459host/48files,
  typecheck/lint and cleanprebuild pass so far. Native, signed artifacts and final
  minified runtime gates are still pending; no code7 acceptance is substituted.


- 2026-11-19 code8 full smoke accepted: npmci→typecheck→459Vitest/48files→lint
  →cleanprebuild→two-worker arm64QA(226executed)→strictQAmanifest→40freshJVM
  /39connected on each API30/API36(0fail/skip)→actual offline cold onboarding on
  both devices with zero PID crash entries. No Metro or ADB reverse was needed.
 105Python and unused-source checks pass. Independent source review is clear.
  App and durable module both use versionCode8; signed artifact/current fresh CI
  and minified runtime follow on this exact source. No Play upload or merge.


- Code8 pre-install harness guard matched the helper's package prefix as if
  production were present. try another way: compare exact package-list entries
  instead of substrings; production remains absent and protected. No install
  occurred before that assertion was corrected; no source/test criterion changed.


## 2026-11-19 — Code8 fresh-install Hebrew surface gate

Code8 source1992c38 full smoke459/40/39each+105, fresh CI44425759475
/job135230045587 and both signed strict artifacts passed. Production AAB SHA256
c9ba6655fb222871351a9014216dd011e3088b097dd7e862cbfce3dc46097d38;
QA APK7a7beb7371d4eb9757ed67871b53df5e5d7b7876f55ea8fc3b8085da6c1122de.
However fresh minified API30/systemHE onboarding and first Import rendered
LTR (badge x36–233, actions right), without the initial restart prompt.
Settings rendered RTL; returning to Import remounted it with badge x846–1043
and actions left, without a language change or restart. The reviewer traced
ReactSurface native direction capture before JS versus cached I18nManager
constants: awaiting the JS sync does not establish mounted surface direction.
This first-launch E case is a real failed acceptance, not a verified RTL pass.

try another way: configure native language policy before ReactSurface creation
through durable source/plugin integration, preserving committed EN/HE/system
preferences and failing safely on invalid/unreadable settings without data
overwrite. Do not add a JS direction override or another Promise around the
same cached constant. Code9 is the next candidate; whole smoke, signed checks
and actual fresh-HE first-screen proof must repeat. No code8 Play upload or
physical media save occurred. Its API36 reviewer five-file readback5/5 with
notification denial is a scoped intermediate checkpoint, followed by cleanup.


- Code9 independent startup tests exposed a plugin recognition bug: a commented
  native policy call was counted as installed. try another way: mask comments
  (including nested blocks), strings/raw strings and quoted literals while
  preserving offsets, then require exactly one executable hook as the first
  statement after super.onCreate and before React startup. Unknown/ambiguous
  templates fail closed. The unchanged13newVM+8existing signing tests now21/21
  pass; source reviewer clear.6newJVM and8connected criteria cases are authored.
  Root restarted full cycle:472host/49files, typecheck/lint, cleanprebuild with
  actual generated-hook ordering/supportsRtl assertion, arm64QA226executed and
  QAmanifest pass. Actual native execution and first-surface runtime follow.


- Code9 cycle1 reached native execution:46JVM pass, but8new connected setup
  cases fail on each device because the standalone native-module test host
  lacks FLAG_SUPPORTS_RTL. The other39 cases per device pass. The generated
  product QA manifest already declares RTL support; the standalone target does
  not execute the Expo config plugin. try another way: declare supportsRtl=true
  on the module's own application manifest, keeping the actual-manifest/native
  direction assertions unchanged. Restart the whole cycle from npmci after
  this source manifest correction; do not treat the failed connected gate as pass.


- 2026-11-19 code9 cycle2 accepted: npmci→typecheck→472Vitest/49files→lint
  →cleanprebuild with actual startup-hook/manifest ordering→arm64QA226executed
  →QAidentity/SDK/FGSpolicy→46fresh JVM/47connected EACH API30/API36,0fail/skip.
  Offline cold onboarding renders on both; physical firstHE badge x846–1043 is
  correct before Settings/language change/remount,0PID crash entries and noMetro
  orreverse.105Python/unused-source checks pass. All source review findings are
  resolved. Signed code9/current CI and minified firstHE/Gallery/runtime gates
  remain separate; no older binary is substituted.


- Code9 physical first-five PASS:5saved/5verified; independent MediaStore taken/
  modified, filesystem mtime, image EXIF and both MP4 creation times match.
  Samsung Gallery12.1.09.1 default Date created/descending was inspected without
  changing it; RTL order purple/yellow/blue/green/red and red Details15Feb2019
 10:30 pass. HE duplicate run reports0new/0newdateverifications; external
  comparison preserves all5URI/name/path identities and one folder.
  Picker harness initially searched Downloads before entering its own run
  folder. try another way: enter the exact run folder and select its ZIP. A
  synthetic adb ACTION_SEND then lacked a usable source read grant and correctly
  surfaced PERMISSION_LOST. try another way: use the actual system picker grant
  for the large fixture. No app permission was broadened and no source change
  was made for either harness correction; real WhatsApp own-share stays unverified.


## 2026-11-19 — Code9 acceptance and code10 open follow-up

Exact app sourcea3dea2a/code9 passed strict signed production/QA checks and CI44432611264 (472host/105Python/46fresh JVM plus resolved Android policy). Full local smoke472/46/47connected each passed. Physical fresh system-HE first surface is native RTL before Settings/remount; five-file indexed/mtime/EXIF/MP4 readback and Samsung creation-date order/2019Details pass. HE/EN Skip-existing retains all5identities. Actual HE512MiB/EN1GiB background saves each4/4 and physical101-file Done sharing exposes100+1; no destination/send chosen. Independent API36 scope includes persistedHE, both native direction changes, denied-notification5/5, exact101URI sharing/History,130%phone/600dp and MP4/OPUS lifetime. Phone removed114owned rows/4ZIPs and QA/helper; emulator removed106rows/3ZIPs and restored settings. Raw shade/recording remained temporary and was removed.

Code9 screenshots and8.125s own1/4notification demo retain their exact provenance; they depict the unchanged UI/native FGS in code10, not captures10. Cloud review then found fingerprint-only history IDs could erase earlier keep-both/destination outputs; independent reviewer also caught loss of a known custom-tree handle on cold terminal replay. Code10 corrects these with stable import sessions and output identities, with new independent red→green cases. try another way: preserve same-session retries/replay and old records, rather than grouping separate imports by fingerprint. First code10 cycle reached489host/QA manifest then correctly stopped before native tests because prior physical cleanup had not yet completed; no gate was waived. Restart the full cycle after replay fix and cleanup.


## 2026-11-19 — Code10 checkpoint and native11 gate

App895cf0247f4c11126ee48e8462f8981d3338a777/code10 fullsmoke497host/50files,46fresh JVM/47connected each/105Python, i18n325/parity/zero-unused, configuredKnip0issues and offlinecold0crashes pass. FreshCI44441593832/job135283494659 independently passes497/105/46executed0skip/93all-executed and code10policy. Both exactsigned/static production/QA PASS; AABbd2dda4f…95114,QA c0fb4d26…1f8fc8,existingcert reused.

Physical10freshHE firstsurface nativeRTL atfont1.1/0crashes,5saved5verified withindependentall5indexed+mtime+EXIF/MP4 dates and SamsungredDetails15Feb2019 10:30.10defaultalbumorder/dupereruns notclaimed. API36actual10keep-both twoimports retain10datedrows, two5savedHistoryrecords aftercold and disjoint5URIchoosers; Done/History100+1all101IDs, EN↔HE/persistedHE/subsetlayout pass. No destination/send. CleanupPASS:phone5outputs/oneZIP, emulator111outputs/twoZIPs, ownpackages/scratch andoriginalsettingsrestored. Receiptsf10-* andstage-f10-emulator.

Code10is superseded by validcloudP2r4623456277: cancelling a default coroutine beforeIO body dispatch can skip catch/finally/terminalpromise. try another way: code11guaranteed worker finalization, control/owned-stop ordering and deterministicprestart/cleanup/new-operation tests, thenfreshwholecycle/signing/runtime.11acceptanceisOPEN; earlier passesdo notcoverthatwindow.

## 2026-11-19 — E/F accepted in the executed scope; final code11 handoff

Final app source **138e00c8bc3f991b9d984cf79075501b566b3f40**, **0.2.0 (11)**, branch **fix/core-rebuild**. R → B-close → C → G1 → D → E → F → G2 are complete within their explicitly executed scopes and the task's manual-upload fallback. PR #1 is open and unmerged. No Play upload, available track, qualifying tester clock or production approval is asserted.

**Complete code 11 smoke:** `stage-f-final-11-1` passes npm ci, TypeScript, **497 tests/50 files**, lint, clean prebuild, native pre-React RTL hook/supportsRtl, **226 executed QA assembly tasks**, exact SDK/manifest/dataSync policy, **59 fresh JVM and 52 connected cases on each API 30/API 36 device**, zero failures/errors/skips, and offline first screens with zero QA crashes. **105 Python verifier cases**, 325-key i18n parity/zero unused and configured Knip 6.46.0 with zero issues (five hints) pass. Fresh app-source [CI 44447719684](https://github.com/MeniViner/chatStamp/actions/runs/44447719684), job 135303820924, passes 497 host/105 Python/59 executed JVM/zero skipped, four official pinned Maven files, all 93 Gradle tasks executed and exact code 11 release policy. Final documentation/assets-head CI is linked from the local REPORT; it does not change the binary app source.

**Native regression:** atomic worker entry checks cancellation inside try/finally, awaits cleanup and main-thread-owned service stop before terminal publication, and handles stale owners/startup failures. Independent source review is CLEAR; cloud review on `138e00c8` has no findings or unresolved findings. All 13 new JVM and five connected lifecycle cases pass on both devices. An isolated ATOMIC→DEFAULT control fails four JVM cases and the actual native pre-start case. `save-worker-prestart-code11.json` records source hashes/results. The 25 independent History regressions retain original-source **13 FAIL/4 PASS** and replay-safeguard-only backout **4 FAIL/21 PASS** controls, then final **25/25 PASS**.

**Exact products**, together in `dist/play/release-0.2.0-11/` with README/SHA256SUMS:

| Product | Bytes | SHA256 |
| --- | ---: | --- |
| Production AAB | 50,956,189 | `999cbcc1883377bc5965a7665ec20b837eb76ce9ae9597530de0b3ed149fd4ab` |
| Isolated QA APK | 69,623,951 | `d4ae6f8143068ff7c6c29d869c04021827f4d251afa35a8b4c2c66b0f935c74f` |
| Fresh actual code 11 foreground demo | 81,486 | `d319af658e5a35e16e7bea13ce0af8d74902f4bf12415f19efe60bcca29b7519` |

Both exact artifact reports PASS signature/full payload, identity/version, nondebug/minified, min 30/target 36, intended permissions/backup, all 64 ELF static checks (32 required ELF64 16 KiB passes; 32 genuine 32-bit N/A), bundle configuration and APK ZIP alignment. Existing upload certificate `efe36695cfc6a3d9ea8471527103f29e3374322ab09890af41692412d76a66c8` was reused; no replacement key. **Actual 16 KiB execution remains UNVERIFIED.** The exact 1,018-source Hermes map includes 26 Expo runtime sources and one standalone CLI require bootstrap; the other ten affected Node owners are absent. Locked audit remains 11 findings (nine moderate/two high/zero critical), with explicit tooling dispositions.

**Minified physical 11:** A30/API 30/Gallery 12.1.09.1; fresh system-HE first surface is native RTL with zero crashes. Five saved/five verified files independently pass indexed dates, filesystem mtime, EXIF and both MP4 dates. Existing Date created/Descending choices remain unchanged; actual album order is purple→yellow→blue→green→red and red Details shows 15 February 2019, 10:30. HE/EN Skip-existing retains all five identities/dates with zero new copies. Native HE→EN reload and separate persisted-English cold start pass. Expo's native React reload may retain its PID; the harness's PID-change expectation was corrected without a product change. A fresh 1 GiB/four-video background run survives Back/Home, shows foreground admission/one Cancel action and an own live 1/4 notification, then finishes 4 saved/4 verified with no FGS. All four large outputs independently match complete size, indexed dates and actual mtime; full internal MP4 readback is separately covered by the core five-file/API 36 timeout scopes.

**Minified API 36:** notification-denied 5/5; a Keep-both second import retains ten dated outputs, two cold History records and disjoint five-URI choosers. Actual official dataSync timeout on 24 videos yields **12 saved/12 verified/0 failed/12 cancelled**; service stop follows ActivityManager's real timeout by 9 ms, Home stays resumed, all 12 published files pass independent full-size/frame/date readback, and no pending/partial output or FGS remains. First attempt had an inconclusive admission precondition. **try another way:** wait for actual foreground admission, then apply the real platform control; no callback was faked. Historical code 9/10 receipts separately own 101-file batch sharing, selected layouts/fonts, both language directions and playback; these are not claimed as rerun on 11.

**Physical Cancel-selection limit:** the final notification harness never reached SystemUI; an alternate visible-app harness missed the Saving accessibility window. No Cancel action was selected, so no final physical UI-action pass is claimed. Both extra Keep-both runs completed 4/4 and their eight outputs were full-sized/dated. `f11-phone-cancel-scope.json` gives exact next steps. Native lifecycle and actual API 36 timeout passes remain separately scoped.

**Demo/assets:** the fresh 8.25-second code 11 clip is H.264 540×1080/24 fps without audio. Actual Saving/visible Cancel, own live 1/4 notification and actual 4/4 Results frames were inspected. Cuts remove waiting/Home transitions; notification crop/pad blacks out unrelated content in its original position. No UI/progress is invented. Raw recording/full shade files were deleted. No reviewer URL is published; the owner must host it. Eight PNGs retain exact code 9 source/binary/1080×2160 RGB24 provenance for the unchanged depicted UI. All eight hashes/dimensions and EN 9/69/1852 versus HE 9/61/1603 text limits pass.

**Cleanup:** app-level Start over returned to Import, then 17 exact owned outputs/two ZIPs/QA/helper/scratch were removed. A strict query found two stale directory index rows. **try another way:** verify exact run paths, directory types and absent files, delete only IDs 777/784, then repeat the complete zero-result check. Original phone 1080×2340/density 420/font 1.1/timeout 600000/stay-awake 7/Asia-Jerusalem was restored; no run MediaStore/Downloads/QA package/reverse remains. API 36 removed 46 outputs (24 inconclusive + ten normal/Keep-both + 12 timeout), two ZIPs/packages/scratch and restored all captured settings/timeout controls. Root independently read the originals and shut down the emulator. Production was absent before QA and untouched. OS uninstall removes private data after app discard; no release run-as inspection is claimed. Receipts: `f11-phone-runtime.json`, `f11-phone-cleanup.json`, `stage-f11-emulator/f11-emulator-runtime.json`.

**Owner gates:** real WhatsApp own-share closed/warm, API 33 physical/full UI matrix, actual 16 KiB execution, installed-browser policy rendering, arbitrary providers/Galleries/codecs, dark dynamic palette and final physical Cancel selection remain UNVERIFIED with exact steps. Mid-read revocation and the narrow process-death window remain deferred per v4. Manual upload, hosted reviewer URL, account creation date/audience/legal facts, actual track availability and genuine 12-tester/14-day eligibility where applicable remain owner actions, available 19 November. No Console automation was used. Public policy returned HTTP 200 on 19 November with 14,306 bytes/SHA256 `637d43fb8a8665bcc02d86bc66521094d8a2e5e658eee5436862940867649040`; authorized support is meniviner@gmail.com. The local REPORT lists every gap/next step and the measured cumulative evidence total below 10,000,000 bytes.


## 2026-11-19 — Play Console continuation authorized by owner

The owner superseded the earlier manual-only Console instruction and requested app creation, listing/artifact uploads and all existing tester lists. The owner explicitly approved the two app-creation legal declarations at action time. Created **chatStamp**, production package **com.menis.chatstamp**, app ID **4974511742201615518**, in the existing personal account. Internal version **0.2.0 (11)** is now shown **active** after actual production AAB upload, processing and two-step save/publish. Console displays min30/target36 and four ABIs. All five existing account lists were saved: list1(4), list2(7), Tank Malle – Internal(1), friends(6), family(2). These20memberships are not a unique/opted-in count. Enabled internal opt-in URL: https://play.google.com/apps/internaltest/4700119235354966099 . Closed testing is still gated on app setup; zero closed opt-ins shown. No production rollout.

English listing saved with icon/feature graphic and four actual phone PNGs in stage order. Hebrew text/four phone captures are being completed. Play requires the locale tag **iw-IL**, not repository locale **he-IL**; the unsupported-tag validation was corrected without changing the text or app. try another way: the listing Add-assets button opens a separate asset-library drawer; use its Upload control, then select/apply each asset. The AAB chooser itself works. AI-assisted brand graphics are labeled separately; actual screenshots are not relabeled AI.

The exact81,486-byte synthetic code11 foreground demo is copied to **docs/media/chatstamp-0.2.0-11-fgs-demo.mp4** for the existing public Pages source, SHA256 **d319af658e5a35e16e7bea13ce0af8d74902f4bf12415f19efe60bcca29b7519**. This is a requested reviewer-facing product, not a raw recording or new runtime test. Public availability must be verified after Pages deployment before using its URL. Final Console status, remaining declarations, real-export gaps and private invitation delivery are recorded separately; no tester period or production approval is inferred.


## 2026-11-19 — Console setup completed through the IARC agreement gate

Existing app4974511742201615518 now has **active internal0.2.0(11)**, complete saved EN/HE listings, logo/banner and four actual phone images per language, public support/policy, Tools/free/18+ configuration, no-login/ads/data-collection/government/financial/health/Advertising-ID declarations and local Import/export dataSync with the body-verified public81,486-byte demo. All five existing lists are saved for internal and Alpha (20memberships, not unique opt-ins), with no private-address export and no email invitations sent. Alpha uses the same artifact selected from the library, bilingual release notes,177countries plus Rest of World and feedback; **15changes saved, not submitted/available**. Console explicitly requires12continuous closed opt-ins/14days and shows0.

Only required content declaration remaining is **content rating**. Owner agreement to the additional IARC terms was requested at its actual unchecked legal box; categoryAll-other-app-types/contact are prepared. Until that approval, do not accept terms or invent a rating. The second pre-check issue is an availability warning for `android.hardware.screen.portrait`, affecting some tablet/Desktop/XR hardware. The verified phone-focused native scope/bytes were not changed. No production rollout/approval or qualifying test period is claimed.

try another way: Add-assets opens a library drawer; upload through its Upload control, then explicitly select/apply. Batch insertion used completion order, so existing library assets were applied individually and reordered to Import/Select/Saving/Results in both locales. Hebrew upload aliases in TMP preserve exact original SHA256, avoiding duplicate-filename ambiguity without copying old evidence into the current set. Some custom Advertising-ID controls ignored Playwright events; fresh AX indices and the documented CUA click applied No/Save, then the saved outcome was observed. No browser/auth security protection was disabled.

The public demo HTTP200/SHA d319af658e5a35e16e7bea13ce0af8d74902f4bf12415f19efe60bcca29b7519 matches the verified product. Source checkpoint055ea27 has successful Pages44519035516 and PRCI44519046435. Its push CI44519037756 failed closed because the exact official Central Gson2.9.1POM was unavailable; same-head PRCI passed, and only the failed job was retried unchanged. Final CI retry/head outcome is kept in the local Console receipt. Signed app source138e00c8 and all device/artifact facts remain unchanged.

Current checkpoint: `dist/play/console-setup-20261119/README.md` and console-state.json, with only relevant small screenshots. Previous proof remains at its original location; cumulative evidence including Console files, all docs/listing and both small demos is measured below10,000,000bytes. PR1 remains open/unmerged. Owner real WhatsApp, API33/full UI,16KiB execution, browser acceptance and scoped/deferred gaps remain explicit.


## 2026-11-19 — Code12 optional portrait hardware source freeze

The owner completed IARC/content rating; the current publishing issue is only
`android.hardware.screen.portrait`. It is a hardware availability filter, not a
new storage/media permission. Code12 keeps the portrait activity request and
adds one explicit optional feature through the durable manifest plugin, with a
scoped required-attribute merge override. Both version codes are12;0.2.0,
production identity, permissions, dataSync, backup, dependencies and upload key
are unchanged. Code11 artifacts remain immutable.

Independent implementation/test/review roles report source CLEAR, including
seven public-plugin tests and eleven artifact-policy cases. Code12+ policy
rejects missing/default-required/true/duplicate portrait requirements and
requires the unchanged portrait MainActivity; historical11 policy is retained.
The fresh root host suite passes504tests/51files and116Python cases. Clean
prebuild,226-task QA assembly,59fresh JVM tests/zero skipped and code12 merged
release policy pass. Connected/cold-launch, signed12 artifacts, exact minified
runtime and Console replacement remain in progress. The A30 is connected but
locked; owner unlock was requested without attempting to unlock it.

try another way: Expo CLI resolves its `--device` argument by device name, not
ADB serial. The initial selector failed before installation. Use the observed
AVD name `chatstamp-api36-20261118` and restart the complete smoke at npm ci.
This is a harness admission correction, not an app failure or acceptance waiver.
[Android screen-feature guidance](https://developer.android.com/guide/topics/manifest/uses-feature-element#screen-hw-features).


## 2026-11-19 — Code 12 verified and submitted to Google

Signed **0.2.0 (12)** is **active and available to internal testers**. The same uploaded AAB was selected from the library for **Alpha**, replacing the pending code 11 release. **All 16 changes are submitted and shown “Changes in review”**, including Alpha 12, both listings, content rating and the other prepared declarations. The owner completed IARC; the former portrait hardware issue is resolved. No closed availability, invitation-email delivery, qualifying tester period or production approval is inferred.

Exact code 12 app/config source: **b2b88e9d3ef8292d00ef695f328a225cbb9b2418**. The complete restarted smoke passes npm ci, TypeScript, **504 host tests/51 files**, lint, **116 Python cases**, clean prebuild,226 executed QA assembly tasks, **59 fresh JVM tests/zero skipped**,52 connected cases on **each API 30/API 36** and offline startup. Production/QA signature, identity, permissions/backup, all 64 ELF static checks and ZIP/bundle16 KiB policy pass. AAPT2 independently lists portrait only as optional. [PR CI](https://github.com/MeniViner/chatStamp/actions/runs/44526874420) passed; the simultaneous push run initially failed before tests on unavailable official Central Kotlin artifacts, then its unchanged failed-job retry passed. No assertion or dependency version was relaxed.

Exact minified12 QA passes fresh system-HE first native RTL on the A30 at the original font1.1, picker import and five saved/five independently verified dates. The API 36 emulator passes the same five-file check at actual2560×1600 / density 320 (1280×800 dp), with notification permission denied. Both readbacks cover MediaStore, actual mtime and embedded JPEG/PNG/MP4 dates. New12 Gallery visual order, background/timeout, duplicate/language-restart and101-file sharing are not claimed as rerun; their earlier11/10/9 receipts retain their exact scope. Core src/ and native Kotlin files are unchanged from11.

Production12 AAB50,956,257 bytes/SHA2560d2efc0cb86b2ba5657fee04e57484aac3fb6847c59f2bf9dda112dfa05a6d51; minified QA APK75,225,186 bytes/SHA2562bec0cb7139901629693b4a062dd8343cb2f86cc9abea8cd0292c6fa49ff8b9b. Existing certificate retained. Both final manifests keep min30/target36, portrait MainActivity and only FGS/dataSync/notification platform permissions. All64 ELF libraries are inventoried:32 required 64-bit 16 KiB passes and32 genuine 32-bit NOT_APPLICABLE; actual16 KiB execution stays unverified.

try another way: the phone's DocumentsUI CardView stayed on Downloads after the coordinate/accessibility attempt. Use the guarded exact-label80 ms FINGER helper to enter only this run's folder/ZIP and receive the real picker grant. Pass multiword Hebrew through a single shlex-quoted remote command; the first split command failed before any action. No source/permission change or product assertion was relaxed. AAPT2's indented optional-feature line was whitespace-normalized before interpreting it.

Both app-level Start over flows returned to Import. Cleanup/restoration outcomes are recorded in the current compact Console receipt, with the two new five-file date readbacks and artifact reports; no raw logs, binaries or old proof are repackaged as evidence. Source CI is green; documentation-head CI is tracked separately there. All previous owner real-export, API 33/full UI,16 KiB, browser/provider/physicalCancel gaps retain their explicit scope.


## 2026-11-19 — Exact requested identity, signed code 13

**Production com.menis10tec.chatstamp; QA com.menis10tec.chatstamp.qa; 0.2.0 (13).**
App/config source **1b82201792839d7925daee7dce4394fb0139bb6f** on fix/core-rebuild.
Independent source review CLEAR. Native library namespace intentionally unchanged.
Current identity defaults are strict; historical 11/12 checks need explicit old
package/version. QA Activity resolves under the production namespace.

| Fresh check | Result |
| --- | --- |
| npm ci / TypeScript / lint / clean prebuild / QA debug assembly | PASS |
| Vitest / verification-tool Python | 504/51 files; 126; PASS |
| Native JVM / connected API 30 / connected API 36 | 59 / 52 / 52; zero failures/errors/skips |
| Migrated standalone probe | 6 JVM cases; new-ID APK checks PASS |
| New QA Activity cold launch | PASS through Expo's actual observed AVD name |
| Source PR CI / push CI | [44587342205](https://github.com/MeniViner/chatStamp/actions/runs/44587342205) / [44587326892](https://github.com/MeniViner/chatStamp/actions/runs/44587326892), both success |
| Signed production and minified QA artifacts | PASS signatures, IDs/code, SDK, permission/backup, optional portrait, full ELF/ZIP/bundle static policy |
| Final manifests and providers | New own production/QA authorities and signature receiver permission; zero old application-ID attribute values; grants remain scoped |
| Independent receiver read | 612 bytes, actual new QA authority, separate UID, temporary read granted, exact synthetic transcript SHA256 matched |
| A30 minified 13 | First system-HE native RTL/font 1.1; actual picker grant; 5 saved/5 verified/0 failed; independent dates PASS |
| Wide API 36 minified 13 | 1280×800 dp EN; notifications denied; 5 saved/5 verified/0 failed; independent dates PASS |
| App reset / cleanup | Both Start over → Import; five outputs/one ZIP/QA per device and phone helper removed; original controls restored; zero remaining run rows/matching crash records; owned emulator stopped |

Production AAB **50,956,412 bytes**, SHA256
`0b7950c0d42fdcb716382ffcd180cf15250e25f2754702c471ac114290e7a5c2`.
Minified QA APK **75,225,206 bytes**, SHA256
`c26eb11de77bb33b172ac73022f571480367c3958e2ec10d2ef8c63a6ad926c7`.
Existing certificate SHA256
`efe36695cfc6a3d9ea8471527103f29e3374322ab09890af41692412d76a66c8`.
Products/README/SHA256SUMS: dist/play/release-0.2.0-13/.
Fresh reports, two date readbacks, provider transport, hygiene and three relevant
JPEGs: dist/play/identity-0.2.0-13-20261119/. Full diagnostics remain temporary,
not curated evidence. Measure the whole current proof set before handoff.

New Play form confirms package availability but creation is **PENDING owner
confirmation of its two unchecked legal declarations**. No new entry ID, upload,
internal/closed availability, list assignment, invitations or new tester period is
established. Old entry 4974511742201615518 now shows closed testing/latest
publication 19 November. This is a refreshed old-package fact, not new-package
publication. Old tracks have not been paused. PR #1 is not merged.

**UNVERIFIED:** real owner WhatsApp export/own cold and warm ShareSheet, physical
API 33, full UI/configuration matrix, actual 16 KiB-page execution, installed-browser
privacy rendering, arbitrary providers/Galleries/codecs and final physical Cancel
selection. Code 13 Gallery action reached Android's resolver; visual order/Details,
duplicate/language-restart/background/101-file checks retain earlier exact scope.
Non-debug release private-cache bytes were not inspected after UI reset; uninstall
is not that inspection. Mid-read provider revocation and narrow process-death
reconciliation remain deferred. See TESTERS.md for exact owner steps.


## 2026-11-19 — New Play identity continuation, no new app bytes

Created **4975002762311404414 / com.menis10tec.chatstamp** after the owner's two
creation declarations were confirmed. Exact accepted production **0.2.0 (13)** AAB
uploaded/processed, SHA256 0b7950c0d42fdcb716382ffcd180cf15250e25f2754702c471ac114290e7a5c2.
App/config source remains 1b82201792839d7925daee7dce4394fb0139bb6f. No rebuild or
physical acceptance rerun is claimed. Documentation head 63890b397867d50799355ec73b190dfcc22e1e46
has successful PR44593327255, push44593315713 and Pages44593313897.

| New Console check | Observed result |
| --- | --- |
| Internal 4701429810228968626 | Active / available to internal testers, exact 13; enabled opt-in link |
| Alpha 4699420811279917961 | Same uploaded 13 selected from library; preview ready; release/EN+iw-IL notes saved, not submitted |
| Testers / countries | All five lists on both tracks, 20 potentially overlapping memberships; 177 countries plus Rest of World on Alpha |
| Store text / images | EN+iw-IL saved; fresh reopening matches source text exactly; four actual phone images per locale in stage order |
| AI declaration | Logo/banner checked; all eight screenshots unchecked; original 9/11 screenshot/demo provenance retained |
| Factual declarations | Privacy/no restricted access/no ads/no reportable collection/sharing/no Advertising ID/no government/financial/health features; Tools/tag, support and 18+ saved |
| Foreground service | Local processing Import/export only; existing actual 11 video URL saved and public body hash reverified |
| Publishing | 15 saved changes; Send disabled; one problem: missing content rating |
| Legal gate | New IARC checkbox unchecked; owner confirmation requested/pending; no bypass |
| Old package | Internal paused/inactive; Alpha pause submitted and still Changes in review at final readback; no permanent deletion |

Fresh compact receipt/readbacks/screens: dist/play/new-package-console-20261119/.
The new closed/store URLs are displayed but disabled, so actual closed availability,
Play-delivered installation, invitation emails and the qualifying period are not
claimed. Initial new dashboard shows zero and requires 12 continuous closed opt-ins
for 14 days. Internal membership does not establish that period. App source/runtime
limitations and owner steps retain their earlier exact scope. PR #1 is unmerged.

Documentation-only closure: independent Test author/Reviewer consistency findings
were corrected and the narrow re-review is CLEAR. Root checked all 79 local
Markdown links in the ten changed guides and three product/proof indexes; none
are missing. All current proof JSON parses, git diff --check passes and the fresh
nine-file Console proof set measures 328,341 bytes before final head bookkeeping,
below the 10,000,000-byte ceiling. No new app tests or device runs were required
for these documentation-only changes; accepted code 13 validation remains scoped
to its original source and receipts.

## 2026-11-20 — Owner-approved IARC and actual submission readback

Console-only continuation for **4975002762311404414 / com.menis10tec.chatstamp**.
Existing exact0.2.0(13) AAB/source/key unchanged; no app build, test or device run.
Owner's specific new IARC agreement/questionnaire approval received before action.
Separate Test author derived acceptance criteria from the release checklist and
tester guide before final submission. Root performed the actual UI actions/readback.

| Check | Actual readback |
| --- | --- |
| IARC | Completed, All other app types, meniviner@gmail.com; submitted20November01:38local |
| Regional ratings | ClassInd All ages; ESRB Everyone; PEGI3; USK All ages; IARC Generic/Russia/South Korea3+; descriptors '-' |
| Questionnaire scope | Nine actual factual No answers; official user-content/online-content guidance checked; imported private files and secondary-app sharing kept distinct |
| Certificate / audience | IARC ID still '-'; no identifier invented. Saved18+ audience is separate from generated rating |
| Submission | Missing-rating blocker cleared;16changes submitted through both confirmation steps |
| Publishing | Changes in review; quick checks running, not inferred successful or main review approved |
| Alpha4699420811279917961 | Enabled track, exact13(0.2.0) in review,178country/region entries |
| Testers | All five lists freshly checked,20potentially overlapping memberships; feedback preserved |
| Actual opt-in route | Copy buttons enabled; signed-in page App not available; account eligibility not independently established |
| Invitations / production | No emails or production access request; no closed availability or qualifying period claimed |

Fresh concise README/state and four relevant JPEGs are grouped in
dist/play/iarc-submission-20261120/. No prior evidence or app binaries copied.
The prior19November receipt remains an accurate historical pending checkpoint.
Internal availability, old-track review and zero opt-ins retain their19November
scope; no current count inferred. App/runtime acceptance and owner gaps remain
unchanged. Previous docs head4c44ef6 PR44610925844/push44610913049/Pages44610911578
all show success at fresh exact-head readback. Current docs CI is separate.
Google review and actual closed access are external gates; no recurring monitor
or automatic resumption. PR #1 remains open/unmerged.

Documentation-only closure: Reviewer reports CLEAR, with no stale current legal
gate or unsent15claims. Root checked77local Markdown links across the ten current
guides and three product/proof indexes; none missing. JSON parses and diff checking
pass. Fresh six-file proof measures254,752bytes before final head bookkeeping;
no binary/source tests repeated for this Console/documentation-only continuation.

## 2026-11-20 — Code14source and full smoke checkpoint

Owner's actual Play opt-in/download success is recorded as owner-reported,
superseding the prior account-specific unavailable observation. No full real-export
acceptance, automatic qualifying period or agent-run Play install is inferred.

Five owner-requested UX corrections are implemented. Independent roles supplied
44new actual UI regressions (65/65focused across five files), root adds16bounded
reader service regressions, and Reviewer reports source CLEAR after resolving the
split-day control issue. This is source/test scope; visual/minified claims follow.

| Full cycle1check | Actual result |
| --- | --- |
| npmci / strict TypeScript / ESLint / clean prebuild | PASS |
| Vitest | 564passed/55files |
| Python verification tooling | 127passed |
| Isolated QA debug assembly | 226tasks, all executed; code14/newQAID/min30/target36/current production MainActivity |
| Fresh JVM --rerun-tasks | 59tests,0failures/errors/skips;57tasks all executed |
| Connected A30/API30 | 52tests,0failures/errors/skips |
| Connected API36 | 52tests,0failures/errors/skips; pre-existing tankmalle_icon_api36_20261119 AVD, not owned by this task |

Full logs/XML/fixtures stay under /tmp/chatstamp-ux14-20261120. The existing emulator
must not be stopped or reconfigured by this run. Physical original controls were
recorded before temporary test stay-awake/timeout changes; restore after the run.
Signed AAB/QA APK, final manifest/artifact checks, affected minified UI/date runtime,
source CI, run hygiene and Play14availability remain pending, with no false pass.

## 2026-11-20 — G2 code 14 owner UX, minified acceptance and Play update

Exact app/config source: `9e6c28f11117e8a6ff6531ccab874192c55cc61a`,
`stage-g2: refine selection, transcript preview and settings navigation`, pushed
on `fix/core-rebuild`. Production `com.menis10tec.chatstamp`; isolated QA
`com.menis10tec.chatstamp.qa`; version 0.2.0, code 14. No source changed after this
freeze. Later closure commits change documentation only.

The five owner requests are implemented: one-line ellipsized titles with full
accessible names; filled active and outlined inactive filters; actual transcript
first in a separate headerless section plus internal selectable scrolling and
bounded continuation; native RTL arrows/swipes; six Settings categories preserving
all controls and category → menu → original-screen Back. The dedicated transcript
section resolves review's date-group split concern without changing day selection.
Implementer completed Settings, Test author added 44 acceptance regressions, and
Reviewer source and final scoped acceptance reviews are CLEAR.

Full npm-ci smoke: 564 host tests / 55 files, 127 Python tests, typecheck and lint,
clean Android prebuild, QA debug assembly (226 tasks executed), 59 fresh JVM tests
(57 tasks executed), and 52 connected tests each on A30/API 30 and the existing
API 36 AVD; zero failures, errors or skips. Exact-source Android CI push run
44649941128 and PR run 44649948012 both pass; Pages run 44649939658 also passes.
These are source CI facts, separate from the device and Play checks below.

Signed products use the existing upload certificate
`efe36695cfc6a3d9ea8471527103f29e3374322ab09890af41692412d76a66c8`.
Production AAB: 50,961,179 bytes, SHA256
`4cd84aa5a6e54bd831cbd0bc3bf138e0f113ad5c8f2f2acfc9c5666b24fe83b5`.
Minified QA APK: 75,234,106 bytes, SHA256
`a9bb8a591a5831820e317b55f9833152f38c9180683a7381960bccc4a0c9d0e7`.
Both pass signature/identity/version, min 30/target 36, manifest permissions,
backup/transfer, optional portrait and all-ABI/16 KiB static checks. This does not
prove execution with 16 KiB pages. Products are grouped under
`dist/play/release-0.2.0-14/` with their README and SHA256SUMS.

Fresh minified runtime: A30 Hebrew at original font 1.1 and temporary 1.3 verifies
long-title truncation, active-filter counts 3/2/1, retained selection, transcript
first/internal scrolling, section navigation, native RTL glyphs and three-file
paging. HE → EN → HE explicit restart and 0.2.0 (14) readback pass. The owned API 36
AVD at 1280×800 dp in English verifies all six categories, Back to retained 3/3
selection, and the complete synthetic long transcript: 357,772 UTF-8 bytes across
11 bounded sections, exactly matching the original hash; scrolling visually
observed. Five media files per device saved; all independent embedded and indexed
dates match expected original message instants. Fresh Gallery visual order/Details
and private discarded-job byte removal before uninstall remain UNVERIFIED.

Runtime harness alternatives, not app source failures: shell-created Downloads URI
lacked a valid app grant → **try another way**, use the actual Android ZIP picker;
Samsung DocsUI ignored standard taps → **try another way**, use the guarded exact-
text disposable FINGER helper; owned-emulator geometry change triggered SystemUI
ANR → select Wait and observe recovery before testing. A loose crash-buffer string
check matched another app's broadcast mentioning the helper → **try another way**,
match the actual crashing Process identity; zero QA-process entries were present
in the checked buffer. Returning to Import after Start over was separately observed.
No broad permission, device unlock or unrelated app change was used.

Run hygiene: QA, exact synthetic fixture rows/files, five saved outputs and the
current helper removed; original stay-awake/timeout/font restored on A30. Owned
emulator 5556 geometry/controls restored, QA/fixtures/outputs removed, then stopped.
Preexisting emulator 5554 was used only for native connected tests and left running.
Owner production app untouched. These removal checks do not replace private-byte
inspection before uninstall.

Play continuation: owner's initial tester/download report did not identify a track;
it was not itself proof of closed approval. Fresh Console shows Alpha 13 ACTIVE,
178 country/region entries and all five lists checked. Actual signed-in closed URL
`https://play.google.com/apps/testing/com.menis10tec.chatstamp` shows You are a
tester plus download. Exact 14 AAB uploaded/processed/published internally at
20 November 03:36 local; the same uploaded artifact promoted to Alpha, 100% closed
rollout and en-US/iw-IL notes, one change submitted. Final publishing readback:
Changes in review; quick checks still running. Closed 14 availability, review success
and Play-delivered 14 installation are not inferred. Existing IARC/creation approvals
remain valid; no new agreement was accepted or requested.

All five assigned lists privately enumerated: list1(4), list2(7), Tank Malle –
Internal(1), friends(6), family(2), exactly 20 unique addresses. One bilingual
private Bcc invitation sent from owner Gmail; SENT and exact recipient readback
verified, message `1a1f6949bdd2ed22`. No private roster is committed or in evidence.
This proves Gmail submission, not inbox delivery or participation. Dashboard freshly
shows 1 opted-in tester; 12 continuously opted in for 14 days is unmet, production
access request disabled. No qualifying clock or production request fabricated.

Fresh evidence is one small dedicated set:
`dist/play/owner-ux-0.2.0-14-20261120/README.md`, four synthetic UI JPEGs, one
Dashboard JPEG and concise signed/runtime/CI/Console/send receipts. The Dashboard
image predates Alpha 14 submission and proves app/count/gate, not review status;
final review state is recorded from the actual DOM. Older evidence stays at original
locations; code 9 store images (older Selection UI) and code 11 FGS demo retain their
provenance. Final cumulative size must be checked below 10,000,000 bytes at handoff.

Remaining separate acceptance: owner real export, own WhatsApp cold/warm shares,
fresh Gallery ordering and private-byte inspection, physical API 33, actual 16 KiB,
full UI/font/provider matrix, genuine closed usage/feedback and 12/14 eligibility.
PR #1 stays open/unmerged. No recurring Google checks or invitation retries scheduled.


## 2026-11-20 — Play installation14, Hebrew invitations and split store artwork

App/native source and signed14 bytes remain frozen at9e6c28f11117e8a6ff6531ccab874192c55cc61a. Git was fetched again before this asset/documentation continuation; branch and origin were equal. No new app code/version/signing key was introduced. The prior full smoke counts and exact-source CI scope remain the earlier candidate's results, not fresh tests of this documentation commit.

Production14 was absent, then installed from actual native Google Play on the physical Samsung A30 under the owner's explicit instruction. Exact package/version14/0.2.0, installer com.android.vending, real Open/onboarding, process presence and no matching production crash entry in the bounded buffer were observed. Existing phone Google account needed a new one-member list, chatStamp – Connected Android, selected only on internal4701429810228968626; five Alpha assignments stayed unchanged. Actual internal opt-in said You are a tester. Two Play download failures → **try another way**, clear Play cache only through Android Settings following official guidance; third installation succeeded. Authenticated account/data and security were retained. This internal install is not qualifying closed participation.

Fresh final Alpha4699420811279917961 summary shows **14(0.2.0) ACTIVE**,178countries/regions. Thus the earlier14-in-review checkpoint is superseded for the binary. Actual Play installation remains specifically internal. No production eligibility, genuine12tester/14day period or clock transfer is claimed; last earlier Dashboard count was1 and was not refreshed here.

Tank Malle's actual Alpha15/1.11.4, same five lists and eligible signed-in opt-in were verified. Union with prior chatStamp recipients was20unique; the owner-identified clothing/admin address identified by the owner was excluded. Exactly19unique addresses were included in one Hebrew-only private Bcc message with actual opt-in and web links. Gmail SENT and exact-recipient readback passed; no delivery/open/participation inference and no private roster in Git/evidence. This is separate from the previous20-person bilingual chatStamp send; no invitation retry occurred.

Six fresh synthetic physical minified **QA14** captures produced Hebrew1080×1920 split posters in Import→Select→Saving→Results→Transcript→Settings order; a new1024×500 Hebrew feature uses a genuine transparent imagegen illustration. Karantina/Heebo typography and native AppKit/CoreText composition retain complete actual1080×2340 UI with uniform contain/rotation only. No crop, UI reconstruction or fabricated progress/count. Actual Saving2/9/64MB and Results9saved/9verified/0failed were captured; all9indexed date rows were read. This is not owner-export or fresh visual Gallery-order acceptance. Implementer Swift typecheck PASS; independent Test author seven-image/static checks PASS; Reviewer CLEAR. Final/source hashes, exact prompt/mode, official font licenses, editable renderer and six native inputs are durable together.

All seven new composite assets were AI-labeled in Console (existing generated logo/new feature illustration; native UI remains actual). Correct iw-IL seven assets saved/reopened; six ordered thumbnails and unchanged English text/asset-source URLs verified. Two changes—Hebrew phone screenshots and feature—submitted through both steps. Final publishing status **Changes in review**, quick checks running; new public artwork publication is not claimed. No identical AAB resubmission or recurring monitor.

Hygiene: QA/helper, exact synthetic ZIP and9owned output rows/files removed and absence checked. Initial cleanup delete response text was inconclusive → **try another way**, reconcile exact remaining rows and use authoritative no-result readback without repeating that deletion. Original stayawake7/timeout600000/font1.1 restored; production Play14 kept and reopened. Preexisting emulator5554 untouched. Private temporary account/UI dumps removed. Uninstall removal does not prove discarded private bytes before uninstall.

One fresh grouped delivery: **store/play/owner-followup-20261120/**. Public artwork/source/provenance are tracked there; owner-only sanitized send/install/Console receipts and screenshots remain locally in that same folder, excluded from Git. Prior evidence stays at its original location. Full cumulative delivery size must be checked below10,000,000bytes at handoff. PR1 remains open/unmerged. Owner real export/own WhatsApp shares, fresh Gallery order/private-byte observation, physicalAPI33, actual16KiB/full provider-UI matrix and genuine closed participation remain separate.


## 2026-11-20 — Owner-authorized Play logo and support-contact refresh

Owner confirmed menis10tec@gmail.com for both per-app support fields and requested the approved chatStamp illustration as its replacement store logo. Both support fields completed **Save and publish plus the second immediate-publication confirmation**, displayed Change published, and persisted after independent close/reload. An initial first-step-only draft did not persist after reload → **try another way**, inspect the additional confirmation, complete both steps and reconcile fresh readback. No verification email, invitation resend, developer-account/contact/privacy change or AAB upload occurred. Public propagation is separate; Console says changes usually appear within an hour.

Built-in imagegen edit preserves the approved chat/clock/folder/photo composition on a full-square cream background. Native Swift export performs uniform resizing/color conversion only:512×512,32-bit fully opaque sRGB PNG,353086bytes. New store/play/icon.png matches that export; native assets/icon.png and application source/config remain unchanged. The new default icon and literal support-address-only replacements in EN/HE descriptions saved/reopened exactly. Hebrew inherits the new default icon; existing EN/HE banners/screenshot source URLs remain unchanged. New icon AI label checked, prior labels preserved. Exactly three changes—default icon and two full descriptions—submitted through both steps; final publishing shows **Changes in review**. No new-logo public publication is inferred.

Tank Malle's current live Play icon is gold car+wallet+receipt+gauge; dirty/232-behind local PWA contains a stale teal gauge and stayed read-only. Browser media download timed out → **try another way**, use a bounded CUA crop of the actual visible published icon as style-transfer identity input. A matching soft3D proposal and512PNG(355717bytes) were produced and independently reviewed. **Tank proposal, prompt/reference and owner review remain local-only, excluded from Git and not applied/uploaded/pushed before owner approval.** chatStamp's authorization does not approve the Tank replacement.

Root implements; independent Test author formats/scope/size PASS; Reviewer visuals/static/contact capture review CLEAR. Exact prompts, hashes, conversion tool and new outputs are grouped in store/play/brand-refresh-20261120/; owner-only screenshots/receipts and Tank proposal are excluded from Git in that same folder. Full new delivery plus canonical new icon is below10,000,000bytes. Prior evidence remains unchanged. Git diff confirms no src/modules/assets/app.config/plugins/package changes; signed14 bytes stay frozen at9e6c28f application source. No runtime/CI acceptance is manufactured for this metadata-only update; prior source-smoke scope remains separate. PR1 stays open/unmerged.


## 2026-11-20 — Both store icons approved, transparent; chatStamp leaves removed

Owner approved the matching Tank Malle replacement as well as chatStamp, requested transparent backgrounds where possible, then explicitly requested removal of chatStamp's leafy sprig only. Built-in image_gen background-extraction edits preserve the approved designs; one precise-object edit removes all chatStamp leaves/stem. Mechanical Swift export preserves alpha without cropping or flattening. Both final icons are512×512,sRGB,32-bitRGBA: chatStamp224095bytes/SHA2565448946ba8a1b84fca36d151741337f81c2560fd1dfb69f70eaa8ef93806902e; Tank206564bytes/SHA25681c5fcbd6eda1822e4975db7dfefa10c4a9fd734378063dfa8c478b37e19cb27. Google's official icon spec permits transparent assets; the store supplies its UI background/mask/shadow.

Root implements; independent Test author PASS for both formats/alpha/visuals, Reviewer CLEAR for both icons/exporter. Light/dark inspections show safe margins, clean edges, opaque-looking cream subject interiors and no visible halos/clipping. Most generated subject pixels are alpha253; actual transparent-pixel counts139084/149860. An initial exact255/corner0 guard rejected this near-opaque quantization → **try another way**, retain original alpha, inspect distributions and actual light/dark composites rather than flattening artwork. First Tank Save immediately after AI-label close did not produce a saved result → **try another way**, reconcile the unchanged form, explicitly Save, then require the success dialog and fresh reload.

Play Console: Tank app4975939003117228141/com.meniviner.tankmalle has only default iw-IL; new transparent icon saved/reopened and one icon-only change submitted through both steps. chatStamp app4975002762311404414/com.menis10tec.chatstamp default en-US updated. Waiting for completed Hebrew asset load exposed an older localized icon, superseding the previous inheritance inference; explicitly select the new library icon in iw-IL, save and reload. Both locales now read back chatstamp-icon-transparent.png. All three locale readbacks preserve every text value and every non-icon filename/sourceURL/order, including banners and phone screenshots. AI labels verified for both new icons and prior labels preserved. Console aggregated chatStamp's final submission as one en-US icon change. Final publishing headings for BOTH apps: **Changes in review**. Public propagation/review approval is not inferred, and no external review monitoring is scheduled.

New selected masters,exports,prompts,mechanical tool,asset checks and a concise owner README are grouped in **store/play/icon-rollout-20261120/**. Fresh Console JPEGs/receipts stay locally in owner-proof/,excluded from Git. Prior evidence and cream proposals remain at original locations unchanged. Canonical store/play/icon.png now equals final leafless transparent chatStamp export. Native assets/icon.png,all application/config/native code,existing signed14bytes and dirty Tank checkout stay untouched. No new AAB, version, device run, email send or app-runtime test was needed for this metadata-only continuation. Prior full smoke remains scoped to9e6c28f application source. Current branch was clean/fetched/equal before work; final delivery must stay below10000000bytes. PR1 remains open/unmerged; all previously documented real-export/Gallery/closed-participation gaps remain separate.

## 2026-11-20 — Direct WhatsApp exports and guide, code 15 source acceptance

The owner reports that chatStamp appears in WhatsApp sharing but does not receive
the export, and explicitly selects emulator verification for this follow-up.
Git was inspected, fetched and fast-forward pulled: fix/core-rebuild matched
origin at b4d2b7a. The preexisting untracked Meni-Viner-CV-Hebrew.pdf is preserved.

Code 0.2.1 (15) now accepts one Android delivery as one bounded native receipt:
a source ZIP streams directly from its grant, or a transcript and attachments
stream individually into the existing private extraction job. No ZIP is built,
staged as a complete source-archive copy, or read into JS. A ZIP document within
a raw-file export remains an opaque supported attachment, never a nested chat.
Raw fingerprints and duplicate-filename ordering remain stable across reordering.
Existing 20,000-entry/2-GiB-per-entry/8-GiB and bounded transcript-sample limits
apply. Sixteen receipt leases bound pending native input.

Durable MainActivity capture runs before React startup and before new-intent
dispatch, retaining the current intent. Owner-generated receipt tokens deduplicate
activity recreation without suppressing a later deliberate same-URI share.
EXTRA_STREAM is authoritative; ClipData is the fallback, not an unrelated preview
to import. Temporary-only grants work; a separate grant mutex serializes
persistable acquisition/revocation while capture remains free of provider IO.
Native ownership starts before metadata, cancellable queries register a
CancellationSignal, and cancellation reservations also cover a queued bridge/IO
dispatch. Phase changes emit immediately while byte updates stay throttled.

Home prominently explains direct WhatsApp sharing without a prior manual save.
The six-page EN/HE guide covers chat, three dots/More, Export chat, Include media,
chatStamp and automatic import. Guide Back/Close return Home; incoming work takes
over. The ZIP picker and both onboarding pages remain available. Invalid incoming
shares do not replace active work; dialogs wait during saving. Existing support
alias approval now also reaches the in-app mailto and the bilingual privacy
policy, which accurately describes ZIP and separate-file processing. Native
launcher assets and all store banners/screenshots are unchanged.

Root implements intake/config; implementer owns UI/locales; independent Test author
derives regressions; Reviewer CLEAR, including cancellation/grant/Activity deltas.
Final full cycle restarted at npm ci: typecheck, 605 host tests/58 files, lint,
127 Python tests, clean Android prebuild, standalone arm64 QA assembly, 59 fresh
JVM and 72 connected tests on the owned API36 emulator, all zero failures/errors/
skips. The 72 include 20 new intake cases and deterministic metadata/queued
cancellation and grant-revocation interleavings. Strict i18n:364 used keys,
zero missing/unused/unresolved/parity/interpolation/Hebrew issues.

Failures and alternatives: strict startup-prefix validation rejected a harmless
test-only local documentation string → **try another way**, move that literal
to a class property while preserving the decoy assertions and strict guard.
The first connected run found that throttling suppressed the first extracting
phase → **try another way**, emit actual phase transitions immediately and
recheck Cancel before opening payloads. An independently authored ZIP-document
fixture wrongly expected an existing supported type to be skipped → **try
another way**, require byte-identical document retention, exactly one transcript
and no recursive extraction; source-archive no-copy assertions remain unchanged.

Debug QA identity/SDK and no-broad-storage/media/network checks pass. Its generated
Expo debug manifest contains SYSTEM_ALERT_WINDOW; this is a debug-only tool
overlay and is not accepted as release policy evidence. Signed production and
minified QA must independently pass the stricter release verifier before upload.

Fresh debug UI: both onboarding pages, prominent Home and all six English guide
pages/Android Back rendered. A separate synthetic sender with an unexported
provider and distinct UID denied reads without a grant, then Android's actual
share sheet delivered three private files with a temporary grant. Selection
shows one transcript first, one photo and one PDF, matched 2019 message dates,
without any prior manual Files/ZIP save. This proves the Android contract on the
emulator; it is not a real WhatsApp-app export or Gallery-order acceptance.

Pending at this source checkpoint: signed artifact/static and minified UI checks,
new Play upload/distribution and fresh public privacy readback. UNVERIFIED commands:
build production with :app:bundleRelease; build isolated minified QA using
scripts/android-verification/release-test.init.gradle and :app:assembleRelease;
run verify-release.py with expected package/version/code15 and the existing public
upload certificate. Real WhatsApp acceptance remains UNVERIFIED: in the actual
owner app follow chat → three dots → More → Export chat → Include media →
chatStamp, once cold and once warm, then select/save/check original dates.
No production eligibility, genuine tester period or final MVP closure is inferred.

## 2026-11-20 — Direct sharing code15 signed runtime and Play submission

Implementation source **45f27382b64d7e7fa688747eea3a42659e9bb61f** is frozen at
0.2.1 (15). Exact-source Android CI PR run **44748707957** completed/success.
The final full-cycle counts remain605 host/58files,127 Python,59 freshly executed
JVM and72 connected API36 tests, with independent Test author PASS/Reviewer CLEAR.

Existing-key production AAB:50,978,271bytes,
SHA2563187e6902a5026b460141848e191cf3c2db1e4a85e14eb901102cd401afe7779.
Isolated minified QA APK:75,259,898bytes,
SHA256a800b9a623de09c0e6add98cbb9be23d409adb571a387195b28fee69daecc564.
Both strict release verifiers PASS for identity/version/certificate/min30/target36,
permissions, backup/minification, four ABI and static16KiB policies. Actual emulator
page size4096; no16KiB execution claim. Debug-only overlay permission remains
separate from the strict signed release policy.

Owned API36 emulator, as requested: actual Android share sheet from a distinct-UID,
unexported private provider delivered TXT/JPEG/PDF to signed minified QA15 while
its Hebrew guide was open, producing one3-file selection. Force-stopped QA15
accepted a generic-MIME ZIP; warm separate-file share preserved the active session
behind a prompt until confirmation. Missing grants yield the translated recovery
error. All six Hebrew guide pages at font1.3 and hardware Back to Home pass.
No prior manual Files/ZIP save was used. This proves synthetic Android transport,
not actual WhatsApp sender behavior.

Raw-share save:3saved,1message-date verified,0failed/cancelled. Independent
MediaStore rows98/99 confirm TXT/PDF modification time1551258000,datetakenNULL;
photo row101 has modification1551177240 and datetaken1551177240000. Independent
host ImageIO reads photo DateTimeOriginal/DateTimeDigitized2019:02:26 12:34:00,
OffsetTimeOriginal+02:00. Documents are not mislabeled as verified message dates.
The public bilingual privacy page freshly returns its20November update,
separate-file explanation and menis10tec@gmail.com. In-app browser rendering
remains separately unverified.

Play accepted the exact production AAB, internal4701429810228968626 release3:
**15(0.2.1), Available to internal testers**,20November16:14local. The same library
artifact was promoted to Alpha4699420811279917961 with100%rollout/EN+HE notes.
Both submission steps completed. Final publishing heading **Changes in review**,
quick checks running; closed15 availability/approval is not claimed. Previous
active Alpha14/178countries remains the distribution baseline. All five assigned
lists remain checked; the connected Android list remains internal-only. No new
invitations, list-membership edits or production-access request occurred.

**try another way:** release UI hides a debug raw error code, so assert its exact
localized recovery message; the initial shell-split MediaStore WHERE failed, so
quote the device command with shlex.join; Pillow is absent, so inspect the saved
JPEG using installed Apple ImageIO. These are verification-tool alternatives,
not source or policy relaxations.

Debug discard private-job removal was inspected before uninstall. Minified Start
over returns Home, but minified private discarded-byte inspection is UNVERIFIED
because the release package is not debuggable. Exact synthetic public rows/files,
QA/helper packages and provider fixtures were removed with absence readbacks.
Stayawake1/font1.0/physical320x640,density160 were restored; crash buffer empty;
the owned emulator was stopped. Production was never installed/replaced there.

Fresh small evidence: **dist/play/direct-share-0.2.1-15-20261120/**, README, compact
receipts/static checks and selected whole-screen JPEGs only. Large signed products
are separate in **dist/play/release-0.2.1-15/**. Earlier evidence/artwork remains
unchanged. Native launcher/icons/banners and the dirty unrelated CV are preserved.
PR1 remains open/unmerged. Actual owner WhatsApp cold/warm export, physical code15,
fresh Gallery order,16KiB execution, real closed participation and production
eligibility remain UNVERIFIED; the final MVP is not closed by emulator fixtures.

## 2026-11-21 — Installed launcher icons, code16 source acceptance

The owner confirms both new Play icons are correct but installed launchers remain
old after update/reinstall, then explicitly requests integration. Root inspected
Git, fetched and fast-forward pulled fix/core-rebuild: unchanged7a531a9; the
preexisting untracked owner CV is preserved. Tank work remains in its separate
native handoff worktree/branch; the canonical PWA and other worktrees are untouched.

Exact approved leafless chatStamp master SHA256
5448946ba8a1b84fca36d151741337f81c2560fd1dfb69f70eaa8ef93806902e is immutable.
The new durable Swift generator performs only uniform scale/padding/color-space
export: existing white legacy1024 asset and transparent adaptive/monochrome1024
assets. Meaningful alpha fits32.41dp of the33dp safe radius in Android108dp layers.
Monochrome preserves the same alpha silhouette. Clean Expo prebuild consumes these
tracked assets; no unique generated-android edits or runtime behavior changes.
Package/native/verifier metadata aligns0.2.2/code16. EN/HE release notes describe
the installed icon; existing store icons/banners/screenshots remain unchanged.

Separate Implementer owns Tank generation/build; Test author derives acceptance
before inspecting implementation; Reviewer CLEAR for both source/asset diffs,
including no stale day/night/round references and safe monochrome geometry.
Root caught an overbroad lockfile version substitution before smoke: **try another
way**, restore the unrelated lan-network0.2.1 entry and retain only app/native
0.2.2 metadata. Dependency resolution and integrity do not change.

Full cycle from npm ci PASS: typecheck,605host/58files,lint,127Python,clean prebuild,
standalone arm64 QA assembly,59freshly executed JVM/8suites and72connected API36,
zero failures/errors/skips. Mandatory source checks are complete. Signed AAB/QA
and actual launcher update/reinstall checks follow separately; do not infer them
from source geometry or tests. Existing original upload key is retained.

Chrome currently has another Google account, not the authorized meniviner owner
session. An owner manual-login request is pending; both apps’ uploads remain
UNVERIFIED until actual Console readback. No new legal terms are accepted for the
other account. Fresh small receipts/proof go together in
**dist/play/native-launcher-icons-20261120/**; required signed binary products
are separate in **dist/play/native-launcher-release-20261120/**. Earlier receipts
retain their original candidate scope. Real WhatsApp/Gallery/16KiB/physical cases
and genuine tester eligibility are not established by this icon-only follow-up.
