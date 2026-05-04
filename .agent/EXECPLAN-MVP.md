# ExecPlan — WhatsApp Media TimeFixer MVP

## Goal

Deliver an Android-first MVP that imports a WhatsApp chat export ZIP, extracts media and `_chat.txt`, maps each media file to sender/date, filters by sender and media type, saves selected media to Gallery, and applies original dates so Android Gallery sorting is correct.

## Current state

This repository is a starter prepared for Codex. It now has the TypeScript MVP pipeline wired through import, review, processing, and completion screens. Milestones 1 and 2 pass typecheck, tests, and lint. Android native module source exists for selective ZIP extraction and MediaStore/EXIF date writes, but it has not been compiled or verified on a real Android device yet.

## Decisions already made

- App is local-only and stateless.
- MVP uses React Native + Expo + TypeScript.
- Zustand is allowed only for current session state.
- No database.
- No backend.
- Native ZIP extraction is required.
- Android Gallery date correctness is a core acceptance criterion.
- OPUS voice notes are excluded or handled separately from photo/video export.

## Open risks / unknowns

- Whether `expo-media-library` alone can preserve/set the required Android Gallery sort fields for all media types.
- Whether target Gallery apps sort by `DATE_TAKEN`, `DATE_ADDED`, `DATE_MODIFIED`, EXIF `DateTimeOriginal`, or another field.
- How WhatsApp export filenames vary by locale, Android version, and chat type.
- Whether Share Intent payload arrives as `content://`, `file://`, or MIME variants.
- Local native compile was blocked on this machine because the Gradle wrapper could not download Gradle 9.0.0 (`Connection reset`) and no Android device/emulator was available for `npx expo run:android`.

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
- 2026-05-02: Pivoted the primary save path to Termux Parity Mode after real-device evidence showed post-save MediaStore mutation and MP4 metadata rewrites did not produce the required Gallery behavior. Added native `saveMediaTermuxParityAsync`, which copies selected media to `/storage/emulated/0/Pictures/WhatsApp Media TimeFixer/<safe chat name>/`, preserves Hebrew-safe filenames, adds duplicate suffixes, writes JPEG EXIF when possible, calls `File.setLastModified`, verifies `destFile.lastModified`, runs `MediaScannerConnection.scanFile`, queries MediaStore after scan, and returns per-file diagnostics. Added All Files Access native checks/settings launch, declared `MANAGE_EXTERNAL_STORAGE`, blocked read-gallery permissions, removed `expo-media-library`, and added an `Output Folder & Save Method` wizard step that blocks saving until All Files Access is granted. MP4 internal metadata is now diagnostic-only and does not block Termux Parity success. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, and `./android/gradlew.bat -p android assembleDebug`; real-device Gallery/My Files validation remains required.
- 2026-05-02: Polished the Android wizard UI around the working Termux Parity save path without replacing it. Added `@pchmn/expo-material3-theme` for Android 12+ dynamic Material You colors with an MD3 fallback source color, centralized Paper theme/light-dark handling, shared wizard shell, full-screen import/analyze/summary/file-selection/output/review/saving/results/error screens, FlatList-based file selection, hidden diagnostics, category-correct result wording, and quieter share-intent debug logging. Added focused tests for wizard navigation, filtering/selection persistence, unsupported category gating, result labels, and fallback theme generation. Native save behavior remains `saveMediaTermuxParityAsync`.
- 2026-05-02: Product polish pass compacted the wizard to Import, Analyze, Choose Media, Save Options, Review & Save, and Results while preserving Termux Parity Mode. Added Settings, local JSON-file settings/history persistence, History screen, media preview modal with image/video/voice playback, official Android app-language settings entry with English/Hebrew locale resources, output organization by type/sender/export timestamp, folder-path fallback without `file://`, and Gallery opening only through native `ACTION_VIEW` for scanned media URIs with `FLAG_GRANT_READ_URI_PERMISSION`. Native Termux Parity save now accepts relative output folders and copies voice/stickers/documents/other files with verified filesystem timestamps. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, `./android/gradlew.bat -p android assembleDebug`, `adb reverse tcp:8081 tcp:8081`, `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`, and basic app launch/logcat. Direct WhatsApp ZIP share was observed in logcat through accepted share, ZIP extraction, transcript detection, matching, and categorization. Manual real-save smoke test still needs a selected video save on device to reconfirm `filesystemTimestampFixed`, `mediaScannerCompleted`, and `galleryMaySortByImportTime`.
- 2026-05-02: Production polish follow-up merged Save Options and Review & Save into a single `Save & Options` step that starts the existing Termux Parity save path directly. Added persisted developer mode defaulting off, hid MP4 diagnostics and share/debug details behind it, compacted category filtering so non-default categories remain visible/selectable, switched folder opening to copy-path fallback only, changed Results to open the first scanned media `content://` item, and quieted debug logs unless developer mode is enabled. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, and `./android/gradlew.bat -p android assembleDebug`. ADB device smoke commands could not run because this shell reported no attached device.
- 2026-05-02: Production-quality polish pass completed on top of the same working native save core. Added explicit output organization modes (`all-in-one`, `by-type`, `by-sender`, `by-sender-and-type`), export timestamp folder toggle, duplicate handling, and live output-path preview. Settings and History now use explicit overlay return navigation so both header-back and Android hardware back return to the prior in-app screen instead of exiting, while saving still blocks back with a message. The wizard shell now uses tighter Android safe-area/status-bar spacing. Choose Media was redesigned with collapsed search, separate sort and filter controls, bottom sheets, compact cards, working `expo-audio` voice playback, `expo-video` thumbnails/playback fallback, and developer-only diagnostics hiding. Folder opening now tries native folder/tree intents first and falls back to a polished sheet with retry, open-first-item, and copy-path as secondary action. App language switching now persists, reapplies on resume, and forces RTL reload when Hebrew changes layout direction; remaining raw alerts were removed. Added focused unit coverage for overlay navigation, file-selection UI defaults, results label logic, folder-open fallback capabilities, custom-folder/language persistence, and locale parity. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, and `./android/gradlew.bat -p android assembleDebug`; `adb devices` showed no attached device, so install/logcat/manual Gallery verification is still pending.
- 2026-05-02: Added a premium first-launch onboarding flow above the existing app navigator without changing the ZIP import, parsing, matching, save, settings, or history pipelines underneath. The new 5-step flow is driven by translated English/Hebrew copy, animated slide/fade entrances, MD3 visuals, page indicators, a persisted `onboardingCompleted` setting, and a replay trigger from Settings. The final step reuses the real Android All Files Access check/settings flow already required by the Termux Parity save path, shows granted vs limited states, and allows continuing into the app even if access is postponed. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, and `./android/gradlew.bat -p android assembleDebug`. Remaining proof still requires real-device visual/RTL/permission smoke testing of the onboarding itself alongside the existing Gallery-date acceptance checks.

## Final acceptance criteria

The MVP is accepted only when a real Android device shows selected media in Gallery sorted by original WhatsApp message date.
