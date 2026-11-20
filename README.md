# chatStamp

chatStamp is an Android app for importing a WhatsApp export ZIP, selecting attachments and saving them with their message dates where the file format, Android destination and Gallery support them. Processing stays on the phone: no account, database, analytics, ads, cloud upload or application network access.

## Current status

Production **com.menis10tec.chatstamp**, isolated QA **com.menis10tec.chatstamp.qa**. Signed **0.2.0 (14)** implements the owner's long-title, active-filter, internal transcript, RTL-arrow and categorized Settings requests. The existing external upload key is retained; [PR #1](https://github.com/MeniViner/chatStamp/pull/1) remains open/unmerged.

Source **9e6c28f11117e8a6ff6531ccab874192c55cc61a**, source and scoped acceptance review CLEAR. Full smoke: **564 host/55 files, 127 Python, 59 fresh JVM, 52 connected on each API 30/API 36**, zero failures/errors/skips; npm ci/typecheck/lint/clean prebuild/debug assembly pass. Exact signed/static production/QA 14 checks and both source Android CI runs pass. A30 Hebrew and 1280×800 dp API 36 English minified UX, bounded full-transcript readback and five-file independent embedded/indexed dates pass.

New app **4975002762311404414 / com.menis10tec.chatstamp**: fresh20November readback shows **Alpha14(0.2.0) ACTIVE**,178country/region entries. Production14 was installed through actual native Google Play on the connected Samsung A30 and opened; installer readback is **com.android.vending**. Its existing device account was added through one new **internal-only** list; original five closed-list assignments remain. The earlier bilingual chatStamp invitation to20unique addresses retains its SENT/exact-recipient verification. Six fresh Hebrew QA14 split posters and a localized feature remain saved in iw-IL. The latest **three store changes are in review**: replacement default icon and support-address-only EN/HE full-description edits. Both per-app support fields separately published as menis10tec@gmail.com without a new binary. Existing banners/screenshots and all other copy are unchanged; the matching Tank Malle logo remains a local-only approval proposal. Earlier today the Dashboard showed1opted-in tester; that count was not refreshed after artwork submission and no qualifying12tester/14day period or production access is claimed.

Latest store metadata: [new chatStamp icon and support email](store/play/brand-refresh-20261120/README.md). Both per-app support contacts published as menis10tec@gmail.com without a new binary; chatStamp icon and two address-only description updates are in review. Native app/source and installed launcher are unchanged. The matching Tank Malle logo remains a local owner-approval proposal.

Current follow-up: [Play installation, Hebrew artwork and invitations](store/play/owner-followup-20261120/README.md). Current results: [fresh verification](dist/play/owner-ux-0.2.0-14-20261120/README.md) and [release products](dist/play/release-0.2.0-14/README.md). Changing application ID created a separate app/sandbox; old **com.menis.chatstamp** artifacts and Console records retain their original identity. Private settings/history/grants, output ownership and tester clocks do not automatically transfer.

Real owner-export/WhatsApp shares, fresh 14 Gallery visual ordering/private-byte cleanup, physical API 33, actual 16 KiB runtime and full UI/provider coverage remain **UNVERIFIED**. The English listing retains four actual code9 screenshots. Hebrew now uses six fresh actual QA14 captures in split posters plus its localized feature. Original code9 PNGs retain historical provenance; the foreground demonstration remains actual code11 of unchanged saving behavior.

## Use the app

Two onboarding pages introduce date handling and WhatsApp export. The main flow has three steps:

1. **Import:** choose an export ZIP through Android's picker or share one from another app. The native importer reads the granted source URI directly, streams extraction and computes the archive fingerprint without copying the ZIP into private storage.
2. **Select:** search and filter by sender, media type or date, preview files and choose what to save. The actual chat transcript appears first among eligible files and opens in a local scrollable reader; long transcripts continue in bounded sections. Hidden selections remain selected; Save captures the visible selected IDs and the current destination/date/duplicate/folder policy.
3. **Save:** a user-started foreground operation reports real progress and supports Cancel. Results and History distinguish saved, skipped, cancelled, failed and date-verified files.

The default output uses owned Android collections under `Pictures/chatStamp` for photos **and videos**, `Music/chatStamp` for audio and `Documents/chatStamp` for documents, with a Downloads fallback if the document collection rejects a write. An explicitly selected folder uses its persisted provider grant. Custom-folder date preservation and opening folders depend on that provider and installed file manager.

Settings opens a six-category menu, with each category containing its own controls. English and Hebrew are supported. Changing language commits the preference before applying translations and native RTL flags. A layout-direction change requires **Restart now** or a later restart; the app does not simulate native RTL with a root-view flip. New exports capture localized folder labels; retrying an existing export keeps its recorded folder paths and duplicate identity.

See [Android technical notes](docs/TECHNICAL_NOTES_ANDROID.md) for supported extensions, date rules, limits, caching and native boundaries. A successful file save alone does not prove its message date or Gallery position.

## Local development and isolated QA

Use **Node 26.7.0**, **JDK 17** (CI pins Temurin 17.0.19+10), Android SDK/platform **36**, build-tools **36.0.0**, NDK **27.1.12297006** and SDK platform-tools. Set `ANDROID_HOME` to your SDK root and put its `platform-tools` directory on `PATH` so `adb devices -l` is available.

Run from the repository root:

```sh
npm ci
npm run typecheck
npm run test
npm run lint
npx expo prebuild --platform android --clean
./android/gradlew -p android --console=plain --max-workers=2 \
  -I ../scripts/android-verification/device-test.init.gradle \
  :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
```

The init-script path above is relative to the Android project selected by `-p android`. On Windows use `android\gradlew.bat` and the equivalent `..\scripts\android-verification\device-test.init.gradle` path. `/android` is generated and ignored; durable Android code lives in `modules/chatstamp-native/android`, `app.config.ts` and the release config plugin.

Before any install, inspect the built APK and confirm its application ID is **`com.menis10tec.chatstamp.qa`**, min SDK 30 and target SDK 36. Routine testing uses only this isolated QA copy, never an unqualified production install. Select the intended device explicitly:

```sh
adb devices -l
adb -s YOUR_QA_SERIAL install --no-incremental -r android/app/build/outputs/apk/debug/app-debug.apk
adb -s YOUR_QA_SERIAL shell am start -W -n com.menis10tec.chatstamp.qa/com.menis10tec.chatstamp.MainActivity
```

Run native regression tests against an authorized test device/emulator:

```sh
./android/gradlew -p android --console=plain --max-workers=2 \
  :chatstamp-native:testDebugUnitTest :chatstamp-native:connectedDebugAndroidTest \
  -PreactNativeArchitectures=arm64-v8a
```

Both native tasks must execute a nonzero test count. The code 14 smoke executed 59 JVM tests and 52 connected cases on each API 30/API 36 device, with no skips. Follow the [verification guide](scripts/android-verification/README.md) for manifest inspection, synthetic inputs, locked-device handling, run-scoped cleanup and restoring device settings. Do not unlock the owner's phone or commit private exports.

[Android CI](.github/workflows/ci.yml) defines pinned tooling, host checks, generated Android, native JVM execution and merged release-manifest policy. Its fresh-checkout run passed; exact source, counts and the separately scoped device/artifact results are in VERIFICATION.md.

## Privacy and release

The production package is **`com.menis10tec.chatstamp`**. The app uses scoped owned outputs or an explicit folder grant, with no broad storage/media-read, recording or network permission. Settings, history and save records are small atomic local JSON files; active import files are private working data. Android backup/transfer is disabled by source policy and must be checked in the final artifact.

Read the [privacy policy](docs/privacy-policy.md), [release checklist](docs/PLAY_RELEASE_CHECKLIST.md), [manual Play upload steps](docs/PLAY_UPLOAD_STEPS.md), [tester/real-export acceptance guide](docs/TESTERS.md) and [external signing guide](docs/ANDROID_RELEASE_SIGNING.md). Historical artifact paths in release documents identify their original candidate; use the latest verified candidate and matching code/hash report for a later upload. Signing material stays outside Git. Play publication and real-export/Gallery acceptance are separate gates.
