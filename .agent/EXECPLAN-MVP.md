# ExecPlan — chatStamp MVP

## Goal

Deliver an Android-first MVP that imports a WhatsApp chat export ZIP, extracts media and `_chat.txt`, maps each media file to sender/date, filters by sender and media type, saves selected media to Gallery, and applies original dates so Android Gallery sorting is correct.

## Current state

The 0.1.1 baseline builds and runs on the connected Galaxy Note20 Ultra (Android 13 / API 33). Typecheck, lint and the 111 existing tests pass. A physical device run verified ZIP import, permission gating, saving and JPEG date indexing. Samsung Gallery's default creation-date sort and sharing into an already open app failed. See [the 0.1.1 verification report](../docs/VERIFICATION.md) for the observed dates, cache findings and remaining checks.

The rebuild branch contains Stage 0, the Stage A implementation, and the Stage P test tooling. Stage A host verification passed 129 tests and produced a standalone arm64 QA APK. The Stage P app and test APK build with target SDK 36. Six probe JVM tests and independent FFprobe verification of both rewritten MP4s pass.

Stage A passed its physical smoke on the Samsung with an Android picker import. An ADB share of the shell-created Downloads URI was denied by the provider. Stage P passed on the same handset. Both probe packages and their synthetic output were removed. The [verification matrix](../docs/VERIFICATION.md#stage-p--scoped-storage-feasibility) records the observed timestamps and Gallery order.

Stage B replaces the save bridge with app-owned MediaStore and explicit folder-provider writes. The Android QA build declares min SDK 30 and target SDK 36, the native XML reports five passing JVM tests and three passing tests on the Samsung, and TypeScript, Vitest, and ESLint pass. The physical app and Gallery checks use the Stage B five-file ZIP.

## Decisions already made

- App is local-only and stateless.
- MVP uses React Native + Expo + TypeScript.
- Zustand is allowed only for current session state.
- No database.
- No backend.
- Native ZIP extraction is required.
- Android Gallery date correctness is a core acceptance criterion.
- OPUS voice notes are excluded or handled separately from photo/video export.
- For Stage B, publish images and videos to `Pictures/chatStamp/<chat>/` using the Images and Video collections with `IS_PENDING`. Use the owned row's path to set modification time before publishing. Require matching embedded metadata and indexed `DATE_TAKEN` for verified image/video dates on the tested path. PNG and WebP used that path successfully.
- Publish audio through Audio to `Music/chatStamp/<chat>/` and documents through Files to `Documents/chatStamp/<chat>/`. The tested audio and documents reopened byte-for-byte with the target `DATE_MODIFIED` and a null `DATE_TAKEN`. Use the Downloads and explicit folder alternatives when required on other configurations.

## Core rebuild stages

The v3 rebuild runs on `fix/core-rebuild` in the order 0, A, P, B, C, D, E, F. See [the rebuild log](../docs/REBUILD_LOG.md) for per-stage results.

- Stage 0 captures the verified baseline, synthetic fixture pairs, and checked-in QA helpers.
- Stage A adds archive-aware transcript matching, date source and precision, and visible unmatched attachments while retaining the legacy native save bridge.
- Stage P proves an owned-storage save on the connected Samsung. Require internal metadata and MediaStore readback plus the default Gallery order. Document working destinations for pictures, videos, audio, and documents before starting B.
- Stage B implements the proven write path with verified timestamps, safe duplicate handling, and no broad storage permissions.
- Stage C streams ZIP contents from the source into a bounded cache, delivers cold and warm shares, and adds background save, progress, cancellation, and cleanup.
- Stages D and E update selection, previews, the three-step flow, accessibility, and English and Hebrew layouts. Stage F finishes CI, audit and release checks, including a real WhatsApp export on the physical phone.

## Open risks / unknowns

- Whether Samsung Gallery's creation-date sort follows `DATE_MODIFIED` if another PNG or WebP triggers a null `DATE_TAKEN`. The tested PNG and WebP fixtures have indexed capture dates.
- Whether the scoped storage destinations and date verification work on other devices, formats, and Gallery applications.
- How WhatsApp export filenames vary by locale, Android version, and chat type.
- Whether Share Intent payload arrives as `content://`, `file://`, or MIME variants.
- The device run used synthetic exports on Android 13. A real WhatsApp export, Android 16 layout behavior, and the full English and Hebrew layout pass still need verification.

## Milestone 1 — Project compiles

- Install dependencies.
- Ensure `npm run typecheck`, `npm run test`, and `npm run lint` work.
- Fix starter code if package versions require adjustment.

## Milestone 2 — Parser hardening

- Expand parser tests for real WhatsApp `_chat.txt` formats.
- Support Unicode control characters and RTL/LTR marks.
- Support line continuations.
- Extract sender, date, and filename reliably.
- Mark unparseable lines without crashing.

## Milestone 3 — ZIP import and extraction

- Implement ZIP selection and/or Share Intent import.
- Copy ZIP to cache.
- Extract only `_chat.txt` and supported media extensions.
- Avoid JS memory loading of the ZIP.
- Create progress reporting.

## Milestone 4 — Review/filter UI

- Show extracted summary.
- Show sender checklist.
- Show media type toggles: photos, videos, OPUS voice notes.
- Default OPUS excluded for MVP export.
- Show matched/unmatched counts.

## Milestone 5 — Gallery save pipeline

- Save selected media to Gallery.
- Apply original dates through the best available method.
- If Expo APIs are insufficient, implement native Android bridge for MediaStore/EXIF fields.
- Keep one clear adapter around metadata writes.

## Milestone 6 — Verification on device

- Test with a real WhatsApp export ZIP.
- Test Android 10+ scoped storage behavior.
- Confirm Gallery sort order after save.
- Confirm cache cleanup.

## Verification steps

```bash
npm run typecheck
npm run test
npm run lint
npx expo prebuild --platform android
npx expo run:android
```

Manual Android verification:

1. Export a WhatsApp chat including media.
2. Share ZIP to the app or select it manually.
3. Select one sender and photos/videos.
4. Save to Gallery.
5. Open Gallery and sort by date.
6. Confirm items appear at original message dates.
7. Delete app cache from the app and verify no temporary files remain.

## Progress log

- 2026-11-16: Implemented the scoped save pipeline, date preference and readback, and archive-level save records that preserve the chosen folder and completed entries across retries. The QA manifest and native suites pass. Run the regression from the app's ZIP picker through Samsung Gallery before accepting Stage B.

- 2026-11-16: Verified Stage A on the Samsung via the Android ZIP picker. Both the filename-dated unmatched JPEG and matched VCF appeared in selection, with no QA crash. Stage P verified scoped writes, indexed timestamps, and the Samsung Gallery creation-date sort on the same device. Cleanup passed. The Stage B destinations and date checks are listed above.

- 2026-11-16: Captured the baseline and tracked QA tooling in Stage 0. Stage A implemented archive-aware matching, file-wide date order, DST and date provenance, and visible supported files without a chat match. Legacy date success now requires MediaStore readback. Host checks and the QA build pass. The physical smoke test is unverified after the phone disconnected from ADB.

- 2026-11-15: Tested baseline `2a76514` on a physical Samsung with an isolated debug package, following `docs/CODE_REVIEW.md`. Five selected media files were saved. JPEGs indexed the chat instant, the PNG indexed only modification time, and both MP4s retained their internal creation dates. Samsung Gallery sorted the videos incorrectly by creation date. Sorting the test album by modification date matched all five chat timestamps. Warm sharing failed with the same content URI that imported after a cold launch. A 128 MiB ZIP completed on the same process and left two private ZIP copies and the extracted video in cache after Back and restart. The gallery acceptance criterion remains failed. See `docs/VERIFICATION.md`.
- 2026-06-04: Blocking QA/build pass changed Android identity from the previously requested reversed form to `com.menis.chatstamp`. Source-of-truth files now use `com.menis.chatstamp`, while native module providers stay placeholder/runtime-package based. `npx expo prebuild --platform android` regenerated ignored Android files with `namespace`/`applicationId`/Kotlin package `com.menis.chatstamp`. Initial `assembleDebug` exposed stale ignored React Native autolinking output still pointing at `menis.chatstamp.com`; deleting `android/build/generated/autolinking` and `android/app/build/generated/autolinking` allowed Gradle to regenerate the entrypoint with `com.menis.chatstamp`. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `./gradlew assembleDebug`, `./gradlew assembleRelease`, `apksigner verify`, and APK metadata for `com.menis.chatstamp`. `adb devices` showed no attached Android device/emulator, so the requested manual QA checklist, direct folder-opening proof, video-control proof, bottom-sheet safe-area proof, and Gallery save/date proof remain blocked.
- 2026-06-04: Completed Android branding and release packaging for v0.1.1. The uploaded 1095x1280 JPEG was cropped to a centered square, had the black outer background removed, and now feeds Expo launcher, adaptive, and monochrome icon assets. Android app identity is `com.menis.chatstamp` with `versionCode` 2. Added an Expo config plugin for local-only release signing configuration and release minify/resource shrinking. Generated a local release keystore outside the repo, built `dist/releases/chatstamp-android-v0.1.1.apk` as a signed universal release APK, and verified package/version metadata plus `apksigner` signature. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, and `./gradlew clean assembleRelease` using a local Temurin 17 JDK and Android SDK. No Android device/emulator was attached, so installation, launcher icon visual QA, and the real Gallery save/date smoke test remain pending.
- 2026-06-04: Implemented the requested Step 3/4/6 UI and Android folder-opening batch without changing ZIP import/parsing/save timestamp semantics. Shared bottom sheets now draw through the Android navigation area while applying safe-area padding internally and support a non-scroll media-preview mode. Step 3 uses a compact top appbar title/pill, no subtitle/media-count chip row, an icon-only toolbar with visible-filtered selection counts, compact filter sheet rows, cached async video thumbnails, working native video-control touch ownership, and internally scrollable TXT previews. Step 4 shows the selected/images/videos/other summary first. Step 6 removes the import-another/history buttons, adds saved-file thumbnails, and adds expand/collapse-all controls for row details. Native folder opening now carries exact output-directory metadata, opens SAF/public folder targets with `ACTION_VIEW` first, and only falls back to the system document navigator with an explicit fallback message. Added focused tests for filtered counts, visible select/clear, result-row expansion, bottom-sheet padding, and folder target helpers. Verified `npm run typecheck`, `npm run test`, and `npm run lint`; Android Gradle assembly could not run because this shell has no Java runtime. Real-device verification remains required for the folder intent behavior, video controls, bottom-sheet nav area, and Gallery date sorting.
- 2026-05-01: Starter repository created with docs, rules, parser skeleton, screens, and native placeholders.
- 2026-05-01: Milestone 1 completed. Installed dependencies, generated `package-lock.json`, pinned Expo SDK 55-compatible versions, fixed Expo config loading, and verified `npm run typecheck`, `npm run test`, and `npm run lint`.
- 2026-05-01: Milestone 2 parser hardening completed for current MVP formats. Added tests for RTL direction marks, bracketed timestamps with seconds, 12-hour timestamps, multiline messages, omitted media lines, and duplicate filename matching. Verified `npm run test` and `npm run typecheck`.
- 2026-05-01: Milestones 3-5 implemented in code. Added a local Android Expo module for native selective ZIP extraction plus MediaStore/EXIF date writes, wired ZIP import through cache, parsed `_chat.txt`, matched media to records, added sender/media filters, saved selected photos/videos, and cleaned cache after completion or reset.
- 2026-05-01: Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo install --check`, and `npx expo prebuild --platform android`. `npx expo run:android --no-install --no-bundler` could not continue because no Android device/emulator was available. Native Gradle compile could not be completed because Gradle 9.0.0 download from `services.gradle.org` reset repeatedly.
- 2026-05-01: Reviewed against `docs/CODE_REVIEW.md`. Remaining acceptance risk is entirely Android-device verification: native module compile, permissions, real ZIP processing, Gallery sort behavior, and cache cleanup on device.
- 2026-05-02: Fixed real-device import issues discovered with Hebrew WhatsApp exports. Native ZIP extraction now scans TXT entries, prefers `_chat.txt`, scores WhatsApp-style transcript samples, supports Unicode/RTL filenames, logs all TXT candidates, and reports found TXT files when no transcript is selected. Added native Android share-intent intake for `SEND`, `SEND_MULTIPLE`, and `VIEW`, including `content://` copy-to-cache before JS import. Added structured JS/native logging and documented logcat commands. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, and `./android/gradlew.bat -p android assembleDebug`. `npx expo run:android --device` could not run because no Android device/emulator was visible to this shell.
- 2026-05-02: Stabilized real-device runtime behavior after testing found MaterialCommunityIcons asset loading errors, unclear Gallery permission flow, and noisy selection taps. Added explicit local font preloading and expo-font native bundling for MaterialCommunityIcons/MaterialIcons, app-level loading/error state, permission gating before save starts, actionable permission error recovery, clearer selected chip/checkbox states, pure selection logic tests, and more structured logs. Verified JS checks before Android prebuild.
- 2026-05-02: Fixed date-write success semantics after real Gallery testing showed `mediaStoreRowsUpdated: 0` with import-time sorting. Native date writer now resolves the saved asset MediaStore row, updates image/video `DATE_TAKEN` and `DATE_MODIFIED`, queries before/after values, returns `dateCorrectionVerified`, and logs warnings when rows updated is 0 or fields do not verify. Save summaries now separate files saved from files date-corrected. Added Welcome/Permissions onboarding, permanent-denial Settings flow, selected-files preview, direct-share ZIP size/validity/entry diagnostics, and tests for permission decisions, preview summaries, and save summaries.
- 2026-05-02: Replaced the final save architecture after device logs proved post-save MediaStore updates were ineffective. The app no longer uses `expo-media-library` to save selected media. JS now sends selected file IDs to a native `saveMediaWithOriginalDatesAsync` batch method. Android inserts app-owned photos/videos directly into MediaStore with `IS_PENDING`, `DISPLAY_NAME`, `MIME_TYPE`, `RELATIVE_PATH`, timestamp values at insert time, and post-insert query verification. JPEG photos get EXIF written to a temp copy before insert. Videos are marked experimental unless MediaStore verifies indexed date fields. Added individual file selection, WhatsApp-aware media categories, and share-intent filtering that ignores Expo dev-client URLs.
- 2026-05-02: Reworked share intake into a native `PendingSharedZipStore` fed by `MainActivity.onCreate` and `onNewIntent`, with asynchronous stream copy, ZIP validation, TXT transcript validation, one-time JS consume, and explicit dev-client/Metro URL ignores. Added `org.mp4parser:isoparser:1.9.56` and rewrites MP4 `mvhd`, all `tkhd`, and all `mdhd` creation/modification dates before MediaStore insertion. Video results now include rewrite attempted/succeeded flags, MediaMetadataRetriever dates before/after/after-insert, MediaStore date values, and a failure reason when Android verification fails. Refactored UI stages to welcome, analyzing, summary, file selection, review before save, saving, results, with hardware Back handling outside saving/analyzing. Updated OPUS to always classify as voice and WEBP as sticker. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, and `./android/gradlew.bat -p android assembleDebug`.
- 2026-05-02: Diagnosed the latest real-device failures without treating UI text as proof. Final merged manifest still contains `SEND`/`SEND_MULTIPLE` ZIP filters on exported `singleTask` `MainActivity`. `MainActivity` now records raw native intent details before React startup, `PendingSharedZipStore` exposes debug status and preserves valid pending ZIPs across invalid dev-client intents, and JS polls/consumes pending shared ZIPs from any wizard stage. MP4 handling now has native `debugInspectMp4DatesAsync` and `debugRewriteMp4DateAsync`, reads all `mvhd`/`tkhd`/`mdhd` dates back through mp4parser, distinguishes `mp4BoxRewriteFailed` from `mp4BoxesUpdatedButAndroidRetrieverDateMissing`, inserts rewritten MP4s into Video MediaStore, and returns retriever/MediaStore diagnostics plus retained debug paths when development verification fails. Results UI now displays structured per-file evidence. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, and `./android/gradlew.bat -p android assembleDebug`; phone-side resolver/logcat/Gallery verification remains the blocker for claiming true video/share success.
- 2026-05-02: Tightened MP4 rewrite verification after real-device evidence showed `MP4 boxes were not rewritten`. Native MP4 handling now uses explicit `MovieBox`/`TrackBox` traversal instead of path strings, logs `mp4RewritePathStarted` with source path, file size, target UTC date, parser availability, box counts, per-track `tkhd`/`mdhd` presence, old/new raw QuickTime seconds, and exact failure reason. A failed MP4 box verification now stops before MediaStore insert, returns `mp4BoxRewriteFailed`, and keeps original/rewritten debug files in dev mode. Added a dev-only `Run MP4 diagnostics` action that rewrites to cache and reports before/after mp4parser plus retriever diagnostics without saving to Gallery. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, and `./android/gradlew.bat -p android assembleDebug`. Real-device logcat is still required to prove the boxes changed on the WhatsApp sample and to determine whether Android retriever reads the QuickTime metadata.
- 2026-05-02: Pivoted the primary save path to Termux Parity Mode after real-device evidence showed post-save MediaStore mutation and MP4 metadata rewrites did not produce the required Gallery behavior. Added native `saveMediaTermuxParityAsync`, which copies selected media to `/storage/emulated/0/Pictures/chatStamp/<safe chat name>/`, preserves Hebrew-safe filenames, adds duplicate suffixes, writes JPEG EXIF when possible, calls `File.setLastModified`, verifies `destFile.lastModified`, runs `MediaScannerConnection.scanFile`, queries MediaStore after scan, and returns per-file diagnostics. Added All Files Access native checks/settings launch, declared `MANAGE_EXTERNAL_STORAGE`, blocked read-gallery permissions, removed `expo-media-library`, and added an `Output Folder & Save Method` wizard step that blocks saving until All Files Access is granted. MP4 internal metadata is now diagnostic-only and does not block Termux Parity success. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, and `./android/gradlew.bat -p android assembleDebug`; real-device Gallery/My Files validation remains required.
- 2026-05-02: Polished the Android wizard UI around the working Termux Parity save path without replacing it. Added `@pchmn/expo-material3-theme` for Android 12+ dynamic Material You colors with an MD3 fallback source color, centralized Paper theme/light-dark handling, shared wizard shell, full-screen import/analyze/summary/file-selection/output/review/saving/results/error screens, FlatList-based file selection, hidden diagnostics, category-correct result wording, and quieter share-intent debug logging. Added focused tests for wizard navigation, filtering/selection persistence, unsupported category gating, result labels, and fallback theme generation. Native save behavior remains `saveMediaTermuxParityAsync`.
- 2026-05-02: Product polish pass compacted the wizard to Import, Analyze, Choose Media, Save Options, Review & Save, and Results while preserving Termux Parity Mode. Added Settings, local JSON-file settings/history persistence, History screen, media preview modal with image/video/voice playback, official Android app-language settings entry with English/Hebrew locale resources, output organization by type/sender/export timestamp, folder-path fallback without `file://`, and Gallery opening only through native `ACTION_VIEW` for scanned media URIs with `FLAG_GRANT_READ_URI_PERMISSION`. Native Termux Parity save now accepts relative output folders and copies voice/stickers/documents/other files with verified filesystem timestamps. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, `./android/gradlew.bat -p android assembleDebug`, `adb reverse tcp:8081 tcp:8081`, `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`, and basic app launch/logcat. Direct WhatsApp ZIP share was observed in logcat through accepted share, ZIP extraction, transcript detection, matching, and categorization. Manual real-save smoke test still needs a selected video save on device to reconfirm `filesystemTimestampFixed`, `mediaScannerCompleted`, and `galleryMaySortByImportTime`.
- 2026-05-02: Production polish follow-up merged Save Options and Review & Save into a single `Save & Options` step that starts the existing Termux Parity save path directly. Added persisted developer mode defaulting off, hid MP4 diagnostics and share/debug details behind it, compacted category filtering so non-default categories remain visible/selectable, switched folder opening to copy-path fallback only, changed Results to open the first scanned media `content://` item, and quieted debug logs unless developer mode is enabled. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, and `./android/gradlew.bat -p android assembleDebug`. ADB device smoke commands could not run because this shell reported no attached device.
- 2026-05-02: Production-quality polish pass completed on top of the same working native save core. Added explicit output organization modes (`all-in-one`, `by-type`, `by-sender`, `by-sender-and-type`), export timestamp folder toggle, duplicate handling, and live output-path preview. Settings and History now use explicit overlay return navigation so both header-back and Android hardware back return to the prior in-app screen instead of exiting, while saving still blocks back with a message. The wizard shell now uses tighter Android safe-area/status-bar spacing. Choose Media was redesigned with collapsed search, separate sort and filter controls, bottom sheets, compact cards, working `expo-audio` voice playback, `expo-video` thumbnails/playback fallback, and developer-only diagnostics hiding. Folder opening now tries native folder/tree intents first and falls back to a polished sheet with retry, open-first-item, and copy-path as secondary action. App language switching now persists, reapplies on resume, and forces RTL reload when Hebrew changes layout direction; remaining raw alerts were removed. Added focused unit coverage for overlay navigation, file-selection UI defaults, results label logic, folder-open fallback capabilities, custom-folder/language persistence, and locale parity. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, and `./android/gradlew.bat -p android assembleDebug`; `adb devices` showed no attached device, so install/logcat/manual Gallery verification is still pending.
- 2026-05-02: Added a premium first-launch onboarding flow above the existing app navigator without changing the ZIP import, parsing, matching, save, settings, or history pipelines underneath. The new 5-step flow is driven by translated English/Hebrew copy, animated slide/fade entrances, MD3 visuals, page indicators, a persisted `onboardingCompleted` setting, and a replay trigger from Settings. The final step reuses the real Android All Files Access check/settings flow already required by the Termux Parity save path, shows granted vs limited states, and allows continuing into the app even if access is postponed. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, and `./android/gradlew.bat -p android assembleDebug`. Remaining proof still requires real-device visual/RTL/permission smoke testing of the onboarding itself alongside the existing Gallery-date acceptance checks.
- 2026-05-04: Hardened post-save folder opening without pretending Android guarantees it. `DoneScreen` now passes a custom SAF folder target only when the current save destination actually used `custom-folder`, preventing stale saved SAF locations from hijacking default-folder opens. Native `openFolderTargetAsync` now converts persisted SAF tree URIs into document URIs with `DocumentsContract.buildDocumentUriUsingTree(...)`, treats each launch intent as best-effort with per-attempt exception handling instead of rejecting the whole promise on the first `SecurityException`, and falls back cleanly to manual path copy / open-first-item guidance. Also fixed local TypeScript style typing in `src/components/AppUi.tsx` so verification can complete again. Verified `npm run typecheck`, `npm run test`, `npm run lint`, and `.\android\gradlew.bat -p android assembleDebug`. Real-device validation is still required to confirm which Files app intents actually open on the target phone and that the fallback sheet now appears instead of a rejected native promise.
- 2026-05-04: Refactored the Hebrew React Native UI for RTL/layout resilience without changing import, filtering, settings, history, or native save business logic. Added centralized design tokens and reusable RTL-aware UI primitives for section cards, selectable option cards, setting rows, buttons, badges, file paths, modal sheets, and media list items. Updated the wizard shell, Settings, Output Options, File Selection, History, folder fallback sheet, and Review Save presentation to use start/end-aligned text, safer long-path rendering, larger touch targets, scrollable safe-area bottom sheets, non-overlapping card headers, and sticky footers that do not compete with modal sheets. Verified `npm run typecheck`, `npm run test`, and `npm run lint`. Real-device RTL visual QA at 360dp width and increased Android font size is still required.
- 2026-05-04: Completed a compact-density UI/UX refactor across the active React Native Material-style screens. Shared spacing, radius, typography, button, thumbnail, and list-item tokens were reduced; media selection rows now use compact thumbnail/title/subtitle/checkbox list items; Sort Results uses selectable radio rows instead of large buttons; Advanced Filter chips are tighter; History cards use icon actions and overflow-menu destructive actions; and Save Options folder preview now renders as a compact indented folder/file tree. This is presentation-only and preserves ZIP extraction, selection state, settings/history persistence, and native save behavior. Verified `npm run typecheck`, `npm run test`, and `npm run lint`; real Android visual QA and Gallery/save smoke testing remain required.
- 2026-05-19: Renamed the product identity from the old TimeFixer naming to `chatStamp` across Expo config, npm package metadata, i18n copy, output folder paths, local storage/cache names, native module registration, Android package id, docs, prompts, and tests while preserving legitimate WhatsApp export terminology. Reviewed against `docs/CODE_REVIEW.md`; this is an identity/config rename and does not change ZIP parsing or the Termux Parity save semantics. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, and a debug APK build output at `android/app/build/outputs/apk/debug/app-debug.apk`. `npx expo run:android` could not launch because no Android device or emulator was available.
- 2026-05-19: Completed a premium Hebrew RTL UI/UX refactor for the active media selection, save options, saving progress, results, share sheet, history, shared wizard shell, bottom sheet, and design-token surfaces without touching ZIP extraction, parsing, selection persistence, or native Termux Parity save semantics. Added warm light/dark tokens, large wizard titles with localized `Step N of 6` labels, no wizard indicator on History, safer sticky footers, labeled toolbar actions, clearer filter/sort sheets, a guided Save Options hierarchy with disabled reasons, and collapsed technical folder/path details. Reviewed against `docs/CODE_REVIEW.md`. Verified `npm run typecheck`, `npm run test`, and `npm run lint`; real-device visual QA is still required for Hebrew RTL at narrow width, increased Android font size, gesture-nav bottom sheets, and the existing Gallery-date smoke test.
- 2026-05-20: Extended the premium Hebrew RTL redesign to the whole reachable app shell, including the first Import screen, onboarding pages/footer, Settings, Error recovery, legacy Review/Summary/Review Save presentation, shared confirmation dialog, and remaining copy/localization surfaces. The pass keeps ZIP import, parsing, selection persistence, settings/history storage, Android permissions, and native Termux Parity save behavior unchanged; long paths and technical details remain secondary/expandable, sticky footers and bottom sheets use shared safe-area-aware styling, History stays outside the wizard stepper, and the `סר` typo check is clean. Reviewed against `docs/CODE_REVIEW.md`. Verified `npm run typecheck`, `npm run test` (22 files / 93 tests), and `npm run lint`; real-device visual QA is still required for first-launch visibility, Hebrew RTL at narrow width, increased Android font size, gesture navigation, keyboard search, and the existing Gallery-date smoke test.
- 2026-05-20: Reworked the active Hebrew RTL save flow as a structural UI/UX refactor rather than a visual reskin. Added/refactored shared primitives (`AppScreenScaffold`, `StepHeader`, `PremiumCard`, `SectionHeader`, `PrimaryBottomActionBar`, `PremiumBottomSheet`, `OptionCard`, `SelectableChip`, `StatusBanner`, `SummaryMetricCard`, and `ExpandableTechnicalDetails`) and rebuilt Media Selection, Sort/Filter sheets, Save Options, Saving Progress, Results, and History around one primary purpose per screen. Primary views now hide full paths, SAF/timestamp diagnostics, folder templates, and per-file technical evidence behind expandable details/developer mode. ZIP parsing, selection state, settings/history persistence, Android permissions, and native Termux Parity saving were intentionally left unchanged. Reviewed against `docs/CODE_REVIEW.md`. Verified `npm run typecheck`, `npm run test` (22 files / 93 tests), and `npm run lint`; real-device visual QA remains required for narrow Hebrew RTL, increased Android font size, gesture-nav bottom sheets, and the existing Gallery-date smoke test.
- 2026-05-22: ZIP import now accepts WhatsApp exports that contain only `_chat.txt` and no media. The extracted transcript is represented as a selectable `document` item, selected by default when it is the only item, saved through the existing native copy/timestamp path, and shared as `text/plain`. Android share/open intent filters were tightened to ZIP MIME types only by removing `application/octet-stream` and `*/*`, with the generated manifest checked after `npx expo prebuild --platform android`. The active file-selection screen header was compacted into a one-line step/title area plus a small summary row so the list has more vertical room. Reviewed against `docs/CODE_REVIEW.md`. Verified `npm run typecheck`, `npm run test -- --run` (24 files / 100 tests), `npm run lint`, and `npx expo prebuild --platform android`; `npx expo run:android --no-install --no-bundler` could not run because the Android SDK path was missing and no device/emulator was available.
- 2026-05-23: Restored the missing Android Expo module implementation for `ChatStampNative`, including native selective ZIP extraction, ZIP share/open intake, Termux Parity filesystem save, SAF folder support, share/delete/open helpers, and All Files Access checks. This fixes the real-device release loop where global share polling repeatedly failed with `ChatStampNative is not available` and returned every screen to the unsupported ZIP error view. Added a JS guard so native-module-missing share polling disables itself instead of hijacking navigation. Reviewed against `docs/CODE_REVIEW.md`. Verified `npm run typecheck`, `npm run test -- --run` (24 files / 100 tests), `npm run lint`, `npx expo prebuild --platform android`, `./android/gradlew --no-daemon :app:assembleRelease`, `adb install -r android/app/build/outputs/apk/release/app-release.apk`, and clean launch logcat on the connected phone. A small no-media ZIP was launched with Android `ACTION_VIEW` without native-module errors or crash. Real WhatsApp share and Gallery-date save verification still need the user’s actual export flow.
- 2026-05-23: Added a polished TXT preview path in the media selection sheet. Chat transcript documents now load the extracted TXT from cache, parse WhatsApp-style messages into sender/date/message preview bubbles, and fall back to a clean raw-text view for non-chat TXT files. The feature is read-only and keeps ZIP extraction native/local; it does not change save semantics or Gallery timestamp reporting. Verified `npm run typecheck`, `npm run test -- --run` (24 files / 101 tests), `npm run lint`, `npx expo prebuild --platform android`, `./android/gradlew --no-daemon :app:assembleRelease`, `adb install -r android/app/build/outputs/apk/release/app-release.apk`, and launch logcat on the connected phone with no chatStamp native-module or fatal crash lines.
- 2026-05-23: Fixed the TXT preview usability follow-up and live direction switching. The transcript preview now uses a bounded nested scroll region, message bubbles format time as `D/M/YY HH:mm` without seconds, and bubble text no longer captures scroll gestures as selectable text. App language changes now publish a live RTL/LTR direction through `AppLayoutDirectionProvider` and apply `direction: rtl/ltr` at the app root and bottom-sheet modal root, so Settings/Onboarding language changes remount the app shell immediately instead of depending on force-stopping the process. Reviewed against `docs/CODE_REVIEW.md`. Verified `npm run typecheck`, `npm run test -- --run` (25 files / 103 tests), `npm run lint`, `npx expo prebuild --platform android`, `./android/gradlew --no-daemon :app:assembleRelease`, `adb install -r android/app/build/outputs/apk/release/app-release.apk`, and connected-phone launch logcat without chatStamp fatal/native-module errors.

## Final acceptance criteria

The MVP is accepted only when a real Android device shows selected media in Gallery sorted by original WhatsApp message date.

## Active v4 continuation — 2026-11-18

### Goal and recovered state

Resume from the pushed scoped-storage implementation, accept its real app save,
finish robust import/save and the picker, and prepare a truthful Google Play
closed-test release. The authorized order is **R → B-close → C → G1 → D → E → F → G2**.
Earlier dated observations above remain historical evidence, not current acceptance.

- Recovery began on clean `main` at `2a76514`, with no stashes. `git fetch origin`
  discovered `origin/fix/core-rebuild` at `811a27561fc7733a7ccccbad25bab286013916e3`.
  Tracking checkout and `git pull --ff-only origin fix/core-rebuild` matched that head.
- The currently attached and unlocked device is Samsung Galaxy A30 SM-A305F,
  Android 11 / API 30, arm64, Samsung Gallery 12.1.09.1, Asia/Jerusalem.
  The historical API 33 Note20 is not attached. Report device coverage separately.
- Use only `com.menis.chatstamp.qa` for app acceptance. Preserve the production
  package. Restore the prior stay-awake setting (7) after device runs and remove
  the run's QA packages, fixtures, and saved files.
- Existing release signing configuration and keystore are outside this repository.
  Their presence does not establish a validated or uploaded release. Do not expose
  their contents or create a replacement key.

### Milestones and verification

- [x] R: run the complete host/native smoke with nonzero test counts, update
  repository instructions, remove obsolete prompts, review, commit `stage-r:`, push.
- [x] B-close: five-file picker save; separate saved/date-verified UI outcomes;
  independent MediaStore and MP4 readback; Samsung Gallery order and red-photo
  details; duplicate and language-change reruns; undated-document save.
- [ ] C: single-pass content-URI streaming and fingerprint; bounded extraction;
  TypeScript transcript selection; real progress; cancellation; dataSync foreground
  save and reattachment; one-shot cold/warm share events; cache/grant cleanup;
  coded errors; atomic split history with migration and orphan reconciliation.
- [ ] G1: check current official Play requirements; build and validate signed
  0.2.0 (3) AAB; verify 16 KiB native alignment and minified QA release save;
  bilingual privacy policy, listing, declarations, tester invitation, and upload
  or exact manual handoff. No Play Console UI automation.
- [ ] D: baseline 40-video reproduction; bounded native thumbnails; virtualized
  grid and compact rows; set selection; full-screen viewer with one video player;
  filter-consistent aggregates; unit/render/device checks; increment test release.
- [ ] E: Import → Select → Save; two-page onboarding; safe insets; accessible
  bilingual visual system; I18nManager restart flow; API 30 physical checks and
  requested API 33/API 36 checks reported according to actual availability.
- [ ] F: remove replaced code; align docs; pinned CI and nonzero native tests;
  shipped dependency audit disposition; fresh-checkout verification.
- [ ] G2: final closed-track update or package; open one PR to main, do not merge;
  prepare production-access answers and owner-run real-export acceptance steps.

For every stage, separate implementer, acceptance-test author, and reviewer roles.
Run `npm ci`, typecheck, Vitest, ESLint, clean Android prebuild, arm64 QA assembly
with two workers, APK/manifest inspection, JVM and connected native tests, and
the stage's device cases. Fix failures and restart the smoke cycle from npm ci.
On macOS use `./android/gradlew -p android` in place of the Windows wrapper.
Keep production native changes in the Expo module/config plugin, never generated
`android/`. Commit and push each completed stage without force-pushing.

### Evidence and open risks

Keep only new concise reports/readbacks and essential synthetic screenshots in
one curated evidence output set, below **10,000,000 bytes in total**. Build outputs,
fixture archives, dependencies, and full logs are development intermediates and
must not be placed in that evidence set. Check the final cumulative byte count.
Keep tracked stage summaries in REBUILD_LOG.md and VERIFICATION.md current.

- B app/Gallery acceptance passed on the retained `fe7be66` QA APK and physical
  API 30 handset; current Stage C runtime and release-build acceptance continue.
- API 33 and API 36 are not established by API 30 results.
- Defer arbitrary provider-revocation simulation and crash recovery beyond cleanup
  of the operation's own orphaned pending MediaStore rows.
- Real WhatsApp export acceptance requires the owner and remains UNVERIFIED until
  performed. Never commit a real export or include it in evidence.
- Play credentials, account type, app-entry existence, Pages publication and tester
  recruitment have not yet been checked; none are assumed complete.


### Stage C implementation checkpoint — 2026-11-18

Source now uses a direct granted-URI native stream and SHA-256 fingerprint;
TypeScript selects the transcript from bounded candidate samples and keeps other
supported TXT files. Limits are 20,000 archive entries, 2 GiB per entry, 8 GiB
uncompressed total, 64 KiB per TXT sample, 16 MiB total samples, and a 16 MiB
selected transcript parsing limit before JavaScript reads it. Supported extensions:
`txt jpg jpeg png heic webp mp4 mov m4v 3gp opus ogg m4a mp3 aac gif pdf doc docx
vcf xls xlsx ppt pptx zip`. Unsafe paths are skipped, not written.

The application-scoped operation registry, dataSync foreground service,
notification cancellation, real progress, retained event-driven cold/warm shares,
source/cache cleanup, coded errors, and atomic split history are implemented.
History details precede the summary index, migration keeps legacy data until
committed, and native completion is acknowledged only after durable history.

A complete smoke retry passed npm ci, strict TypeScript, 191 Vitest tests in 32
files, ESLint, clean prebuild, arm64 QA assembly, service/permission inspection,
16 JVM tests, and 10 connected tests on each of API 30 and API 36. The first
API 36 run exposed Android's default ZIP path validator before the application's
skip guard; the replacement is Apache Commons Compress 1.28.0 with independent
safe-path, CRC, size and end-record validation. No global path validator was
disabled. Review then found a cancellation/error-classification race; its fix
and additional tests require a fresh full smoke before this source is committed.

B-close remains unaccepted: physical app/Gallery evidence requires owner unlock.
Stage C UI/cache/background/notification/cancel/timeout acceptance is being run
on the disposable API 36 emulator and remains distinct from physical coverage.
G1 is still gated. No Play version bump, upload, or publication is claimed.


### Stage B-close accepted on the physical Galaxy A30 — 2026-11-18

- [x] Retained QA APK from `fe7be66` passed the app-driven five-file save with
  Always use message date and no broad storage access. APK SHA-256:
  `0065af3cab31781d83c90682da839d58fae1d5bd17f963fdbd833a53d351386c`.
  Product code for this baseline was unchanged while Stage C source reached
  `25a9abc` on the working branch.
- [x] On SM-A305F / Android 11 / API 30 / Samsung Gallery 12.1.09.1 in
  Asia/Jerusalem, all five MediaStore capture/modification dates and reopened
  image/video metadata matched their chat instants. UI showed five saved,
  five dates verified and zero failures. Default Date created, descending Gallery
  order was purple, yellow, blue, green, red; red details showed 15 February 2019,
  10:30. The RTL grid's reading order is recorded in the verification report.
- [x] Hebrew and English skip-existing reruns kept row IDs 121–125 and the same
  single Pictures destination, with no duplicate file or folder. The undated VCF
  saved as published row 128 with one saved, zero dates verified and no failure;
  Date unavailable / Saved without a date remained explicit.
- [x] QA and disposable UI helper removed; synthetic sources and saved run rows
  removed; stay-awake 7 and screen timeout 600000 ms restored. Fresh B-close
  review found no remaining findings. Baseline smoke counts remain 112 Vitest,
  five JVM and three connected tests; no extra build was needed for documentation.
- [ ] Stage C physical/runtime acceptance is still in progress. Repeat applicable
  save/Gallery checks for the changed pipeline and the eventual minified release.
  G1 awaits accepted C. Real-export owner acceptance remains UNVERIFIED.

Current B-close evidence is summarized by
[stage-b-acceptance.json](../dist/android-verification/rebuild-20261118/stage-b-acceptance.json),
with its readbacks and synthetic screenshots in the same existing folder.
See [the verification report](../docs/VERIFICATION.md#b-close--physical-app-and-gallery-acceptance--pass--2026-11-18)
for exact dates, Gallery interpretation, duplicate inventories and cleanup.
