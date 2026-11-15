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
