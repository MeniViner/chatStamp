# ExecPlan — chatStamp MVP

## Goal

Import a WhatsApp export ZIP on Android, map attachments to original message
instants, select/filter files and save them so the tested Gallery sorts by those
instants. Saved and verified dates remain separate facts. Local-only; no DB,
accounts, analytics, cloud or server. Current requested production identity is com.menis10tec.chatstamp; retain the owner's external upload key. Earlier com.menis.chatstamp artifacts remain historical.

## Current state — 2026-11-20, owner UX follow-up; code 14 under verification

Meni reports successfully joining the new app's tester program and downloading
the Play build. This updates the earlier unavailable-account checkpoint; it is
owner-reported availability, not agent-run Play installation or a qualifying
tester period. The owner now requests five UI corrections after importing a ZIP.

Code 14 work: single-line ellipsized chat/ZIP headings, a filled active media tab
with outlined inactive tabs, actual transcript pinned/labeled first with a local
scrollable reader, native-RTL media paging, and six Settings categories with
category→menu→original-screen Back behavior. Keep actual transcript identity,
filters/selection, save/date semantics, all existing settings and current key.

Decisions: preserve the full accessible title; pin only the transcript marked by
the importer and only among eligible filtered items; isolate it from ordinary
whole-day selection groups. Read one32KiB UTF-8 section plus at most3lookahead
bytes through SDK55 FileHandle, close every handle and keep stale reader responses
out of replacement documents. Scroll within each section and expose explicit
continuation/previous-section controls. Do not load the complete file for preview.
Native I18nManager, including pending-restart behavior, determines arrow direction.

Roles: root implements title/filter/transcript/viewer and integrates locales,
versioning, full smoke, release and device hygiene; Implementer owns categorized
Settings; Test author derives independent criteria before source inspection and
owns actual UI regressions; Reviewer audits against CODE_REVIEW. No UI, native,
artifact or Play result for14is accepted until observed.

Milestones: complete implementation/independent regressions/review; run the full
npm-ci smoke and Python verifier suite; clean prebuild/QA debug/59+JVM and nonzero
connected API30/API36 checks; exact signed/static14verification; affected minified
phone/wide runtime (long synthetic Hebrew name, filters, transcript scrolling/
continuation, native RTL, category Back/persistence and five-file date readback);
restore controls/remove run-owned QA/fixtures/outputs; commit/push and record CI;
upload the accepted new bytes to the existing new-package tracks under the
continuing release authorization. Code13and prior receipts remain historical.
Real-export acceptance, broad UI/provider/API33/16KiB/Cancel gaps and genuine
closed participation remain separate. PR #1 stays open/unmerged.

## Prior state — 2026-11-20, IARC complete; Alpha 13 submitted/in review

Meni explicitly requests production application ID **com.menis10tec.chatstamp**.
This supersedes the previous fixed-ID instruction. Code 13 keeps version 0.2.0,
uses isolated **com.menis10tec.chatstamp.qa**, and retains the existing upload key.
The bridge library namespace stays com.chatstamp.nativebridge. Update current
harness/verifier identities and regenerate Android; never relabel an old artifact.

Google Play treats a changed application ID as a separate app. The existing
4974511742201615518 entry belongs permanently to com.menis.chatstamp. Its code 12
acceptance and earlier store/runtime proof keep their historical identities.
The new package needs its own Play entry, current artifact identity verification,
and actual new-track availability. No old private settings/history/grants or
MediaStore ownership migrate automatically between Android sandboxes.

Implementation, independent identity tests and source review are complete. Root
verified the full npm-ci smoke, generated/final identity and provider checks,
both-device native/minified runtime, signing and actual independent read grant.
Both source CI runs pass. New app 4975002762311404414 is created after owner-approved declarations;
internal 13 was available at the 19 November checkpoint. On 20 November the owner
approved IARC; the factual questionnaire completed and all 16 prepared changes
were submitted. Publishing shows Changes in review, with quick checks running;
Alpha 13 is in review. The signed-in closed opt-in page reports App not available.
No closed availability, real-export acceptance or tester participation is inferred.
Previous API 33/full UI, actual 16 KiB,
browser/provider/Cancel/real-export gaps remain explicitly scoped.

## Implemented decisions and boundaries

- Native ZIP streaming directly from a granted source URI; validation and
  fingerprint in the same stream, no complete private ZIP copies or JS ZIP data.
-20,000 entries,2 GiB per entry,8 GiB total; actual free-space guards. TXT samples
 64 KiB each/16 MiB total; TypeScript selects transcript. Unsafe/unsupported
 entries counted. Supported native extraction and preview limits are in TECHNICAL_NOTES_ANDROID.md.
- Scoped own MediaStore writes: photos/videos together under Pictures/chatStamp,
 audio under Music, documents under Documents with Downloads/provider fallback.
 EXIF JPEG/PNG/WebP, MP4 header rewriting and independent indexed/mtime readback.
 Approximate/ambiguous/undated outcomes never count as verified message dates.
- Native saved-record identities preserve old paths across duplicates, languages
 and partial retry. New folder labels follow the committed app language.
- Save captures session, IDs and committed destination/policy before async audio
 release/notification permission; restart/share intake has an idle native fence.
- Real progress, cancellable streamed buffers, user-started dataSync foreground
 save with notification-denial behavior and API36 timeout cleanup. Cold-once and
 warm-event shares; no polling. Discard/cold-start cleanup and grant release.
- Atomic local settings/history/native-save JSON; details-before-index history
 and startup reconciliation. Zustand is session state only; no database.
- Virtualized day grid, Set selection, filtered footer/Save, bounded native JPEG
 thumbnails, zero cell players, one viewer video and shared audio. OPUS/voice,
 GIF/WebP, PDF/VCF and external document fallback are in current scope.
- Import → Select → Save; organization/duplicates/custom folder in Settings.
 Native I18nManager direction with explicit restart; app-language dates, actual
 dynamic colors where supported and warm fallback. Insets/Back/font/wide UI
 verified only in the combinations named by runtime receipts.
- min30/target36, no broad-storage/media/network/microphone permission. Backup
 and transfer disabled. Durable plugin/module source; ignored Android regenerated.

## Remaining gates

- Complete: code 13 identity migration, independent source review, full smoke, both source CI runs, signed/static artifacts, new provider read grant and affected minified runtime. Earlier native fixes and broader runtime receipts keep their original binary scope.
- Complete: dedicated code 13 product and fresh proof sets, current bilingual listing/declaration/tester guides. Eight screenshots remain actual code 9; the public foreground demo remains actual code 11. No relabeling.
- Complete: code 13 five-output/one-ZIP cleanup per device, QA/helper removal, original control restoration and owned emulator shutdown. Private release-cache byte inspection remains UNVERIFIED.
- Complete: new app creation/upload/internal availability, bilingual listing/assets, factual declarations and five lists on internal/Alpha. Alpha reuses uploaded 13; 177 countries plus Rest of World saved. Old internal is paused; old Alpha pause submitted/in review.
- Complete: owner-approved new IARC agreement and factual questionnaire; status Completed and seven regional ratings read back. All 16 changes submitted on 20 November; publishing and Alpha 13 show in review. Quick checks were running at the recorded snapshot.
- G2 owner/external gates: Google review, actual closed availability and a working eligible-account opt-in route before invitations. Owner real-export acceptance, PR decision and genuine new-package opt-in/usage/period remain open. The agent does not merge or request production access before its genuine gate.

## Open risks and exact follow-up

See KNOWN_RISKS.md and PLAY_UPLOAD_STEPS.md: API33 physical, real owner WhatsApp
share, arbitrary Gallery/provider/codec combinations, actual16 KiB runtime and
owner browser first-run rendering remain unverified. Provider-revocation
simulation and the narrow process-death row-record window are deferred per v4.
Play account is personal; creation date remains unknown. Exact new tracks are
recorded, while genuine qualifying opt-ins/usage/period must be observed. Never substitute synthetic/device tests
for a real closed-test period.

## Verification

Follow scripts/android-verification/README.md: npm ci/typecheck/test/lint,
clean prebuild, two-worker arm64 QA assemble, merged manifest/APK inspection,
nonzero JVM/connected suites and QA cold-launch/affected UI cases. Do not install
over production. verify-release.py checks signed candidates separately; CI's
resolved-toolchain/manifest/JUnit policy does not certify signing or device runs.

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
- Use only `com.menis10tec.chatstamp.qa` for current app acceptance. Preserve the production
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
- [x] C: single-pass content-URI streaming and fingerprint; bounded extraction;
  TypeScript transcript selection; real progress; cancellation; dataSync foreground
  save and reattachment; one-shot cold/warm share events; cache/grant cleanup;
  coded errors; atomic split history with migration and orphan reconciliation.
- [x] G1: check current official Play requirements; build and validate signed
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


## Stage D implementation and acceptance plan · 2026-11-18

G1 is accepted with a manual Play handoff (commit30a422a); no track upload is
claimed. D uses versionCode4 while keeping0.2.0 and the production identity.
Before any D product edits, root imported40 synthetic H.264 videos on the A30,
scrolled six screens and opened VID-20190224-WA4012. Captured PID5216 contains
42 ExoPlayer Init,1 Release, peak41 unreleased captured instances and76 decoder
error lines including OMX.Exynos.avc.dec initialization failures. Preview opened;
these errors establish resource pressure, not an independently enumerated hardware
decoder count. Small fresh proof: d-baseline-40-video.json.

Implementation ownership: implementer owns native thumbnails/cache/queue,
FileProvider opening, cleanup and native barrier plus AppUi thumbnail removal;
root owns picker/viewer, shared lazy audio, Set selection and save-scope snapshot;
test author independently derives pure, actual-cell and lifecycle regressions;
reviewer checks the complete diff against the task and CODE_REVIEW.

- Native thumbnails are64–512px JPEGs: image downsample, scaled video frame, PDF
  page one; two workers, one heavy renderer, bounded pending work and32MiB/512
  cache entries. Identity includes URI/path, native mtime/size and requested size.
  Invalidation and import discard prevent late repopulation. External opens use
  only checked cache/owned/granted content URIs and read-only temporary grants.
- Selection is an immutable Set by ID. All eligible media, voice, documents and
  transcript start selected. Sender/search/tab/date filters preserve hidden
  selections; day/filter tri-state and shrinking ranges affect the active IDs
  only. Footer and pendingSaveIds use the same filtered ordered intersection.
- Real SectionList cells are square3/5-column visual rows or64dp voice/docs rows,
  with sticky day headers. Stable callbacks/metadata and memoized actual cells
  must pass500/5000-cell invalidation tests, not fake counter replacements.
- Viewer follows the filtered/sorted order, provides image pinch/double-tap,
  current-page video, one lazy shared audio owner/seek/loading/error state,
  PDF first page, VCF name/phone and external-app fallbacks. No list player.
- Installed Expo factories allocate players during render and release them later
  on Android MAIN. **try another way:** construct the viewer player only after
  commit, acquire a global slot, claim the still-current offer, and hold the slot
  through explicit release plus an awaited MAIN completion fence. Superseded
  offers create nothing; owner remounts share the same fence; failure stays closed.
  Regression tests must cover batched requests and delayed release/remount.

Remaining acceptance: full smoke from npm ci; native nonzero unit/connected counts;
physical40-video grid/player-log comparison, all nine fixture attachment previews,
external opening and sender+Photos footer/save scope; API36 runtime cross-check;
source review closure; signed code4 update or manual handoff; QA cleanup and settings
restoration. Stage D is OPEN until these are observed. E/F/G2 have not started.


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


## Stage E implementation plan · 2026-11-18

D accepted atce0acb3. E uses0.2.0/code5. Root owns direct Import→Select→Save,
two-page onboarding,shared scaffold/insets,Settings/restart prompt/theme,Results
virtualized Details,History dateformat and bilingualresources. Implementer owns
native-I18n-only direction/reload adapter,BottomSheet constrainedbody/footer,
serializedatomicsettings/date default and localized save-record compatibility.
Test author derives real production-consumer tests and strict finite i18n usage
checks independently; reviewer checks the full final diff/CODE_REVIEW.

Language text changes only after preference commits; layout direction changes by
actual native restart,with Restart now/Later and recoverable failures. Native
I18nManager.isRTL alone controls currentdirection; no root override/key remount.
Restart waits for explicit discard/cleanup and cannot interrupt running work.
New installs/missing datepreference use message date; explicit old false persists.
New output records capturelocalizedlabels; existingrecords/paths/duplicate keys
remain exact. No date/verifier policy change. Dynamicpalette must visiblycontrol
actualroles where supported,with honest API30 fallback.

Acceptance includes retained C/D suites,full smoke,actual directfilteredSave,
Back/modalpriority,inset/130%font/wide600dp EN+HE matrix on actual API30phone and
API36emu,actualminifiedreloadbothdirections,updated phone-only syntheticstore
screens plus curateddocs/screens. API33phone remainsUNVERIFIED with exactowner
steps. No Play credentials: signedcode5/manualhigher-codeupdate,not track claim.
E remains OPEN until these checks,reviews anddevicecleanup are observed.


### E review and first full-cycle corrections

Fresh review found and fixed: deferred audio-release Save could target a replaced
import (revision/identity+component-generation guards); restart cancellation could
resume intake while cleanup continued (committed non-dismissable/disabled dialog);
queued Settings UI patches could restore stale nested organization fields (typed
nested partials); result rows conflated indexed fallback dates with verified
message dates (one predicate+approximate context); native English error messages
bypassed bilingual copy (typed/generic localized errors, rawdeveloperdisclosure).
Meaningful actual component/coordinator/store regressions cover these cases.

First fullcycle `stage-e-final-1` passed npmci/typecheck then stopped at448tests:
440pass/8fail. Six assertions expected the old completion summary-key names even
though E now uses the shared four-count sentence; preserve all saved/cancelled/
failed/verified counts and actual EN/HE rendering tests while updating that UI
contract. Two Processing Back cases passed in isolation but failed in the whole
suite because `--no-isolate` reused a component module with another file's mocked
BackHandler listener. **try another way:** restore Vitest's normal per-file module
isolation, retaining single worker/thread execution and every behavior assertion.
Restart the complete cycle from npmci; these failures are not an accepted cycle.


The second E cycle passed448TS/50files,prebuild,QAarm64APK,manifestchecks and40JVM,
then35connectedtests executed perAPI30/API36 with3failures each in new profile
path assertions. Save outcomes, same-URI reruns and profile equality had passed;
the new assertions wrongly expected a trailing slash on outputDirectory, while
the established MediaStoreFolder.label trims it and feeds duplicate identity.
**try another way:** assert the exact expected directory and independent indexed
RELATIVE_PATH/count,without changing production labels or weakening duplication
criteria. Fix the cleanup-ref lint warning in the same correction batch and
restart the complete cycle from npmci. No E device acceptance is claimed yet.


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


### E additional Save-policy regression

Independent acceptance contract requires a Save's settings to be fixed before
async work. Two actual coordinator regressions reproduced a delayed notification
permission allowing settingsB/notificationcopyB to replace acceptedA;18 existing
cases stayed green. **try another way:** capture cloned policy,folderlabels and
notificationstrings at the visible Save gesture as part of SaveIntent,and use the
same snapshot across media-release and notification waits; direct retry captures
beforeitsfirstawait. Capturedcustom-folderhistoryusesA; restoredunknownhandle is
null whileactualoutputURIs/pathsremainstored. Newgesture-boundarycase plus both
permissioncases pass:21coordinator tests; expectedfullsuite451. No native/UIlayout
code changed. API36 preflight remains explicitly source0db5579/APKb4684528…;
final cycle/artifact/runtime replay will follow the emulator lease release.


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


-2026-11-19: E/F final code6 acceptance recorded above and in VERIFICATION.md:431host/40JVM/39connected each,81Python, fresh Android CI,64ELF staticpolicy, final minified scopes and device hygiene pass. G2 packaged owner fallback; real-export/Play production-access facts remain unverified.


-2026-11-19 G2: PR1 opened atd3634a4: https://github.com/MeniViner/chatStamp/pull/1; no merge. Signed code6/manual Play/owner real-export handoff complete. Real owner export and actual Play/tester eligibility remain unverified; production installation untouched and QA cleanup complete.


-2026-11-19 CI-only transport repair: repeated final-head MavenGson failures now use an authenticated-byte, exact-GAV local plugin bootstrap from official Central; runtime code6 artifacts unchanged.24new fail-closed tests bring verifier suite to105; actual local CI hooks/toolchain/40JVM/release-manifest policy pass. Fresh GitHub CI remains the final gate.


## 2026-11-19 — Final code 11 owner handoff

Final 138e00c8 source, independent red-to-green controls,497host/59JVM/52connected each/105Python, freshCI44447719684, exact signed/static products and affected minified runtime are accepted within their recorded scopes. Fresh code11demo and all hashes verified; phone17outputs/twoZIPs/QAhelper removed and originalsettings restored; emulator46outputs/twoZIPs/controls restored/rootchecked/shutdown. Final physicalCancelselection remains UNVERIFIED with a concrete follow-up; no actual gesture was selected by the two final harness attempts. Owner realWhatsApp/Play/account/tester and device/fullmatrix/16KiB/provider gaps remain explicit. G2 completes via authorizedmanualpackaging, not an uploadedrelease or productionapproval. See the closing VERIFICATION entry and local REPORT for exact source, products, CI and measured evidence size.

## 2026-11-19 — Code 12 portrait hardware availability follow-up

The owner authorized the narrow fix after Console reported required portrait
screen hardware. **try another way:** the durable Android manifest plugin now
keeps one exact `android.hardware.screen.portrait` declaration with
`android:required="false"` and scoped `tools:replace="android:required"`, overriding
the attribute's lower-manifest OR merge. Existing unrelated feature attributes
and declarations remain; repeated plugin application is stable. Activity/app
portrait orientation remains declared. Expo and native module use versionCode12;
versionName remains0.2.0. The existing signed code11 AAB stays unchanged.

Root owns the fresh full smoke, clean-prebuild/merged-manifest proof, signed code12
artifact validation and Console replacement/availability check. These code12
outcomes remain UNVERIFIED until observed; no new device or Play result is inferred.

Source review is CLEAR including the seven plugin/eleven artifact-policy cases.
Root host504/51files,116Python, clean prebuild,226-task QA assembly and59fresh
JVM/release-manifest policy pass. Complete smoke was restarted after correcting
Expo CLI device-name selection. Signed12/minified/Console checks remain pending;
A30 unlock is requested. Owner-completed IARC is no longer the Console blocker.


## 2026-11-19 — Code 12 verified and submitted to Google

Signed **0.2.0 (12)** is **active and available to internal testers**. The same uploaded AAB was selected from the library for **Alpha**, replacing the pending code 11 release. **All 16 changes are submitted and shown “Changes in review”**, including Alpha 12, both listings, content rating and the other prepared declarations. The owner completed IARC; the former portrait hardware issue is resolved. No closed availability, invitation-email delivery, qualifying tester period or production approval is inferred.

Exact code 12 app/config source: **b2b88e9d3ef8292d00ef695f328a225cbb9b2418**. The complete restarted smoke passes npm ci, TypeScript, **504 host tests/51 files**, lint, **116 Python cases**, clean prebuild,226 executed QA assembly tasks, **59 fresh JVM tests/zero skipped**,52 connected cases on **each API 30/API 36** and offline startup. Production/QA signature, identity, permissions/backup, all 64 ELF static checks and ZIP/bundle16 KiB policy pass. AAPT2 independently lists portrait only as optional. [PR CI](https://github.com/MeniViner/chatStamp/actions/runs/44526874420) passed; the simultaneous push run initially failed before tests on unavailable official Central Kotlin artifacts, then its unchanged failed-job retry passed. No assertion or dependency version was relaxed.

Exact minified12 QA passes fresh system-HE first native RTL on the A30 at the original font1.1, picker import and five saved/five independently verified dates. The API 36 emulator passes the same five-file check at actual2560×1600 / density 320 (1280×800 dp), with notification permission denied. Both readbacks cover MediaStore, actual mtime and embedded JPEG/PNG/MP4 dates. New12 Gallery visual order, background/timeout, duplicate/language-restart and101-file sharing are not claimed as rerun; their earlier11/10/9 receipts retain their exact scope. Core src/ and native Kotlin files are unchanged from11.

Production12 AAB50,956,257 bytes/SHA2560d2efc0cb86b2ba5657fee04e57484aac3fb6847c59f2bf9dda112dfa05a6d51; minified QA APK75,225,186 bytes/SHA2562bec0cb7139901629693b4a062dd8343cb2f86cc9abea8cd0292c6fa49ff8b9b. Existing certificate retained. Both final manifests keep min30/target36, portrait MainActivity and only FGS/dataSync/notification platform permissions. All64 ELF libraries are inventoried:32 required 64-bit 16 KiB passes and32 genuine 32-bit NOT_APPLICABLE; actual16 KiB execution stays unverified.

try another way: the phone's DocumentsUI CardView stayed on Downloads after the coordinate/accessibility attempt. Use the guarded exact-label80 ms FINGER helper to enter only this run's folder/ZIP and receive the real picker grant. Pass multiword Hebrew through a single shlex-quoted remote command; the first split command failed before any action. No source/permission change or product assertion was relaxed. AAPT2's indented optional-feature line was whitespace-normalized before interpreting it.

Both app-level Start over flows returned to Import. Cleanup/restoration outcomes are recorded in the current compact Console receipt, with the two new five-file date readbacks and artifact reports; no raw logs, binaries or old proof are repackaged as evidence. Source CI is green; documentation-head CI is tracked separately there. All previous owner real-export, API 33/full UI,16 KiB, browser/provider/physicalCancel gaps retain their explicit scope.


## 2026-11-19 — Requested package identity correction, code 13

The owner explicitly requested com.menis10tec.chatstamp after seeing the old Play
URL. **try another way:** Play package names are immutable after upload, so build
and verify the new identity and use a separate Play app entry instead of pretending
the old URL can be renamed. Retain the existing upload key and immutable old
products. Current QA/probe/verifier/defaults and generated Activity namespace must
follow the new identity; provider/receiver names remain runtime-scoped. No data
migration, broad permission, cloud feature or production replacement is added.

Roles: implementer owns runtime/config/harness migration, test author owns current
identity guards and historical explicit-artifact compatibility, reviewer checks
namespace/authority/sandbox/provenance. Root owns smoke/signing/device hygiene and
Console/current docs. All new identity outcomes remain UNVERIFIED until observed.


## 2026-11-19 — Code 13 migration acceptance checkpoint

Implementation, independent acceptance-derived identity tests and source review
complete; root smoke 504 host/126 Python/59 JVM/52 connected each API 30/API 36,
six standalone probe JVM cases, exact signed/static checks, actual new-authority
612-byte transport and affected minified five-file dates pass. App source
1b82201792839d7925daee7dce4394fb0139bb6f has two successful source CI runs.
Both reset/cleanup/restoration flows pass; owner production remains untouched.
Products and fresh compact proof are separately grouped under dist/play.

New Play form package availability confirmed. Owner confirmation of the two legal
declarations is the sole current creation/upload blocker; do not accept terms
without it or claim a new app/track ID. Existing specific Console authorization
continues after that gate. Reapply assets/declarations/lists, verify actual internal,
pause superseded old tracks reversibly, submit Alpha, and invite only after actual
closed availability. Old package currently shows closed testing; no clock transfers.
All owner real-export/device/browser/provider/16 KiB/Cancel gaps remain explicit;
PR #1 stays unmerged. No pending source fix is inferred from the legal blocker.


## 2026-11-19 — New Play app and testing preparation

Owner approved both creation declarations. App 4975002762311404414 now binds the
requested package; accepted 13 is uploaded and active on internal4701429810228968626.
Alpha4699420811279917961 reuses uploaded13, with both notes, countries and five lists
saved. Both listings/assets and factual declarations are saved; fresh UI readback
matches text and screenshot order. No new code, build or device work performed.

Publishing has 15 unsent changes and one exact content-rating issue. Separate new
IARC agreement owner confirmation remains pending; do not accept terms or claim
closed availability without it. After approval complete rating, submit, verify
actual closed availability, then send authorized deduplicated invitations. New
12-opt-in/14-day requirement observed; no old clock transfers. Old internal is
paused, old Alpha pause in review. Source/docs CI63890 passes; later docs CI separate.
Fresh Console proof is grouped separately; PR #1 remains open/unmerged.

## 2026-11-20 — Owner-approved IARC completion and Alpha submission

Accepted the new IARC agreement only after the owner's specific confirmation.
All other app types, meniviner@gmail.com and nine factual No answers were saved;
official guidance excludes secondary-app sharing and privately imported content
from native user interaction/promoted online content respectively. Status Completed
and seven actual ratings read back; audience remains the separate saved 18+ setting.

Submitted all 16 changes through both confirmation steps. Publishing shows Changes
in review with quick checks running; Alpha4699420811279917961 shows exact13 in review.
All five lists remain checked, with 20 potentially overlapping memberships and
178 country/region entries. Copy-link buttons are enabled after submission, but
the actual signed-in route shows App not available; eligibility was not independently
established. No invitations or qualifying period claimed. Google review and actual
closed availability are external gates; no recurring monitoring is started.
Fresh compact proof: dist/play/iarc-submission-20261120/. No app bytes, source,
assets or device state changed; prior receipts stay historical. PR #1 stays unmerged.
