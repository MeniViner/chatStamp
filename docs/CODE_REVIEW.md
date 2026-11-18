# Code review checklist

Current acceptance rules, 2026-11-18. Historical dated reviews below describe
older implementations and do not authorize their superseded storage/RTL paths.

## Product and dates

- Import → Select → Save, exactly two permission-free onboarding pages.
- Local-only: no database, accounts, analytics, ads, cloud or server APIs.
- Saved, verified original message date and observed Gallery order are separate
  facts. Approximate/ambiguous/undated results never masquerade as verified.
- JPEG/PNG/WebP EXIF, MP4 headers, mtime and MediaStore are independently read
  back where applicable. Check the real Gallery's creation-date order/details.
- Duplicate reruns and locale changes reuse recorded paths and identities;
  legacy save/history compatibility stays intact.

## Android and lifecycle

- Production ID com.menis.chatstamp stays fixed. Test only .qa side-by-side.
- min SDK30, target/compile36, build-tools36.0.0, NDK27.1.12297006 resolve from
  durable source after clean prebuild; generated android/ is ignored.
- Only FGS/dataSync/notification platform permissions and the app-owned AndroidX
  signature receiver permission; no broad storage/media, microphone or network.
- Native source-URI streaming, single-pass validation/fingerprint, space/archive
  limits and bounded transcript samples; no complete private ZIP copies.
- Intent inbox cold-once/warm-event behavior, grant lifetime, busy-share queue,
  typed failures and retry readability remain correct.
- Save captures session/IDs/settings before asynchronous work. Cancel, Back,
  activity recreation, service timeout and restart preserve correct ownership.
- Cancellation removes own partial/pending output, retains complete files and
  reports the remainder as cancelled. Startup reconciles own stale job state.
- Atomic JSON details-before-index writes; no settings publication before commit.
- Backup and device transfer disabled/excluded; temporary external read grants
  only on explicit user open/share actions.

## UI and performance

- Set selection, stable memoized cells and virtualized grid/day sections; Save
  and footer use the current filter and preserve hidden selections.
- Bounded native thumbnails; zero cell video players, at most one viewer video
  player and one shared audio controller. Release on page/unmount/background.
- Real progress with unknown totals supported; no fabricated steps/percentages.
- Native I18nManager direction only, explicit safe restart for direction changes,
  app-language dates and actual dynamic palette or honest fallback.
- English/Hebrew parity and zero unreachable keys; plain Hebrew without raw
  placeholders/technical error leakage. Strict TypeScript has zero any.
- Check Back, dialogs/sheets, keyboard and inset-safe primary actions on phone
  and 600 dp layouts, 100/130% font sizes, both languages. Aggregate accessibility
  checked/disabled/mixed transitions must agree with actual native descriptions.

## Required validation and custody

Run npm ci, typecheck, test, lint, clean Android prebuild, two-worker arm64 QA
assembly, manifest/APK policy checks, nonzero native JVM and connected tests,
then cold-launch and the affected real-device cases. Restart the whole cycle
from npm ci after a failure/fix. Verification tooling regressions also run in CI.

Release checks additionally validate signed AAB/APK identity, upload certificate,
SDK/permission/backup policy, nondebug/minified runtime and packaged ELF/16 KiB
alignment. Static alignment does not certify a 16 KiB device run. Never replace
or regenerate the owner's key; secrets remain outside the repository and logs.

Review against the requested acceptance criteria, update the ExecPlan/rebuild/
verification logs and distinguish source, local tests, fresh-checkout CI,
artifact checks, device outcomes and Play distribution. Keep evidence minimal
and under the cumulative 10 MB ceiling. The owner controls Play Console and real
exports; a local bundle does not establish upload, tester counts or 14 days.

## Latest Review Status

- 2026-06-04: Blocking QA/build pass changed the requested Android package identity to `com.menis.chatstamp` in Expo config and JS fallback docs without touching import/parsing/save semantics. Fresh prebuild generated `namespace`, `applicationId`, and Kotlin app packages as `com.menis.chatstamp`; FileProvider authorities remain placeholder/runtime-package based. The first debug build exposed stale React Native autolinking output under ignored `android/build/generated/autolinking` that still referenced `menis.chatstamp.com`; removing that generated cache and rebuilding regenerated `ReactNativeApplicationEntryPoint` with `com.menis.chatstamp`. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, `./gradlew assembleDebug`, `./gradlew assembleRelease`, `apksigner verify`, and APK metadata for `com.menis.chatstamp`. `adb devices` reported no attached device/emulator, so install, media controls, bottom-sheet layout, folder opening, and Gallery/date smoke testing remain blocked.
- 2026-06-04: Android branding/release pass is configuration and packaging focused. The uploaded image is now the Expo source for the launcher icon, adaptive icon, and Android 13 monochrome icon after cropping the 1095x1280 JPEG to a centered square and removing the black outer background. Android package identity is now `com.menis.chatstamp` with version `0.1.1` / `versionCode` 2. A config plugin makes release signing local-only via environment/local properties and enables release minify/resource shrinking without committing secrets. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, and release `./gradlew clean assembleRelease`; `apksigner` verifies the APK and `apkanalyzer` reports package `com.menis.chatstamp`. No Android device/emulator was attached, so install, launcher icon visual QA, and Gallery/save smoke testing remain pending.
- 2026-06-04: Current pass keeps ZIP parsing, native extraction, selection persistence, and timestamp restoration semantics unchanged while tightening the Hebrew RTL UI around Steps 3, 4, and 6. Step 3 now uses a compact appbar/header and icon-only filter/sort/search/select toolbar with visible-filtered selection counts; media preview sheets no longer wrap video/TXT previews in a parent scroll view; video thumbnails are generated asynchronously and cached for media/result rows. Step 4 shows the save summary first. Step 6 removes History/import-another actions, adds saved-row thumbnails and expand/collapse-all controls. Native folder opening now carries explicit output-directory metadata and tries exact `ACTION_VIEW` folder document/public-folder URIs before a document-navigator fallback. Verified `npm run typecheck`, `npm run test`, and `npm run lint`; Android Gradle assembly could not run in this shell because no Java runtime is installed. Real Android verification remains required for bottom-sheet nav behavior, video controls, direct folder opening, SAF fallback behavior, and Gallery date sorting.
- 2026-05-02: Transcript detection, share intent handling, and logging changes keep the app local-only, stateless, and Android-focused.
- 2026-05-02: ZIP handling remains native and streamed; the JS layer receives extracted files and metadata only, not whole ZIP contents.
- 2026-05-02: Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, and native Gradle `assembleDebug`.
- 2026-05-02: Device launch and real WhatsApp share-sheet verification still require a connected Android phone from the tester environment.
- 2026-05-02: Runtime stabilization keeps filter taps pure; sender/media selection only updates Zustand state and logs the change. Save now requests Gallery permission before entering the processing pipeline.
- 2026-05-02: Date correction is no longer considered successful just because a file timestamp changed. The app reports saved-but-not-date-corrected files separately so Gallery sort failures remain visible during MVP acceptance.
- 2026-05-02: Final save path is native MediaStore insertion, not Expo MediaLibrary asset creation plus post-update. Broad gallery read permission is not required for this save path; file picker/share grants ZIP access, and the app writes new owned MediaStore rows.
- 2026-05-02: Current pass compiles a native MP4 metadata rewrite path using `org.mp4parser:isoparser:1.9.56`; it rewrites MP4 movie, track, and media header creation/modification dates before MediaStore insertion and requires Android `MediaMetadataRetriever`/MediaStore verification before reporting success. Direct share now has a pending native store instead of relying on the latest Activity intent. Remaining acceptance risk is real-phone validation with WhatsApp share intents and Samsung/Android Gallery sorting.
- 2026-05-02: Follow-up native pass moved share capture before React startup in `MainActivity`, added raw `onCreate`/`onNewIntent` intent diagnostics and share debug status, and made JS consume pending shares globally so warm app shares are not stranded. MP4 save verification now separates mp4parser box rewrite success from Android retriever exposure and reports exact failure classes plus retained debug paths in development. Local checks and debug APK assembly pass; real-device resolver/logcat/Gallery proof is still required.
- 2026-05-02: Current MP4-only pass keeps scope local and Android-focused. It does not alter share intent or storage permissions. MP4 save now refuses MediaStore insert when native mp4parser re-read does not prove `mvhd`/`tkhd`/`mdhd` changed, keeps failed debug files in dev mode, and exposes a no-save diagnostic button. Local checks and debug APK assembly pass; real-device logcat and Gallery proof are still required before claiming video date correction works.
- 2026-05-02: Termux Parity Mode is now the recommended/default save path. It keeps ZIP extraction native and streamed, writes selected media to a real public folder, sets filesystem timestamps before scanning, verifies `lastModified`, and reports MediaScanner/MediaStore diagnostics without treating MediaStore values as the primary success condition. All Files Access is required for this mode; read-gallery permissions are blocked from the merged manifest. Local checks and debug APK assembly pass; Samsung Gallery and My Files still need real-device verification.
- 2026-05-02: UI polish pass keeps the proven Termux Parity Mode intact and only wraps it in a Material Design 3 wizard. The app now uses Android dynamic colors when available through `@pchmn/expo-material3-theme`, with a generated MD3 fallback palette and system light/dark mode. File selection is virtualized, unsupported categories remain visible but not saveable, technical diagnostics are hidden by default, and result labels are category-aware. Real-device verification should confirm the new UI still reaches the same `filesystemTimestampFixed`, `mediaScannerCompleted`, and Gallery sorting outcomes.
- 2026-05-02: Current product-polish pass keeps ZIP extraction and Termux Parity saving as the working core. It adds settings/history/media preview and broader file-category export without a database or server. Settings/history are stored as small local JSON files in app documents. Open Folder no longer emits public `file://` URIs; it copies the public path and gives manual My Files guidance. Open Gallery only appears when a scanned media URI exists and opens via native `ACTION_VIEW` plus temporary read grant; otherwise it falls back to manual Gallery guidance. Local checks, prebuild, debug APK assembly, APK install, direct-share import logcat check, and basic launch check pass. Real-device save smoke test is still required before claiming Gallery-date behavior remains proven after the UI changes.
- 2026-05-02: Final production-polish follow-up preserves the same native Termux Parity save service. It removes the extra review screen from the active wizard flow, defaults developer mode off, hides diagnostics/debug UI unless explicitly enabled, keeps non-default categories visible for selection, and avoids broken folder intents by copying the public output path. TypeScript, tests, lint, prebuild, and debug APK assembly pass; ADB reported no connected device, so device smoke testing still needs a real selected photo/video save.
- 2026-05-02: This production-quality polish pass still preserves the native `saveMediaTermuxParityAsync` default flow and the ZIP/share import pipeline. It makes output organization explicit with four folder modes plus export-timestamp toggle and duplicate handling, adds native SAF tree picking with persisted permission and tested timestamp-capability reporting, fixes Settings/History back behavior through explicit overlay return state, tightens the safe-area/header density, replaces raw alerts with styled sheets/dialogs, restores Hebrew/English switching with persisted RTL-aware i18n sync, upgrades voice preview to `expo-audio`, upgrades video preview from deprecated `expo-av` Video to `expo-video` with generated thumbnails and graceful fallback, and keeps developer diagnostics hidden unless developer mode is on. Verified `npm run typecheck`, `npm run test`, `npm run lint`, `npx expo prebuild --platform android`, and `./android/gradlew.bat -p android assembleDebug`; no ADB device was attached for install/logcat/manual Gallery validation, and SAF custom-folder saves still report timestamp preservation as unverified unless the native SAF capability probe confirms it.
- 2026-05-02: First-launch onboarding pass stays local-only, does not touch ZIP extraction or native save correctness, and reuses the real Android All Files Access flow instead of simulating success. The intro is gated by a persisted local setting, can be replayed from Settings, and all onboarding copy now flows through the existing English/Hebrew i18n resources with RTL support handled by the same app-language plumbing. Local checks, prebuild, and debug APK assembly pass. Remaining verification is visual/device-oriented: confirm first-launch gating, tour replay, RTL layout, transitions, permission messaging, and handoff back into the normal app flow on a real Android device.
- 2026-05-04: Folder-opening reliability pass keeps the save pipeline local-only and does not claim unsupported Android behavior as success. Default public-folder opens remain best-effort because Android does not provide a guaranteed public API to open an arbitrary filesystem folder in every Files app. The app now only reuses a persisted SAF folder target when the active save destination was actually `custom-folder`, and native folder launching converts persisted tree URIs to document URIs, catches `SecurityException`/`ActivityNotFoundException` per intent attempt, and falls back to manual guidance instead of rejecting the promise. Verified `npm run typecheck`, `npm run test`, `npm run lint`, and `.\android\gradlew.bat -p android assembleDebug`; real-device verification is still needed to confirm the preferred Files-app intent on the target OEM build.
- 2026-05-04: RTL/UI refactor is presentation-only and preserves the local ZIP/native save pipeline. Shared UI tokens/components now control card radius, spacing, button height, badges, long path text, bottom sheets, and media list rows. TypeScript, unit tests, and lint pass. Remaining risk is visual/device verification: Hebrew RTL on a real Android device, narrow 360dp layout, increased font size, modal/footer interaction, and Gallery/save smoke testing.
- 2026-05-04: Compact-density UI refactor is presentation-only and does not touch the native Termux Parity save path, parser, ZIP extraction, or timestamp verification semantics. It reduces global spacing/radii/button/list dimensions, replaces oversized media/history/sort/filter patterns with compact MD3-style list rows and icon actions, keeps long paths ellipsized, and changes the folder preview to an indented icon tree. TypeScript, unit tests, and lint pass. Remaining risk is visual/device verification on a narrow Android screen, Hebrew RTL, larger font sizes, bottom sheet ergonomics, and the existing real-device Gallery date smoke test.
- 2026-05-20: Full-app premium RTL UI pass is presentation-only and keeps the proven local/native pipeline unchanged. The first Import screen, onboarding, active wizard screens, settings, history, error handling, share/fallback sheets, confirmation dialogs, and kept legacy review surfaces now share the warm token system, rounded cards/buttons, safe-area-aware sticky actions, simplified Hebrew copy, and collapsed technical details. TypeScript, unit tests, lint, and the Hebrew typo search pass. Remaining risk is visual/device verification on Android for first-launch visibility, narrow RTL layout, larger system font, gesture navigation, keyboard search, and the existing Gallery date smoke test.
- 2026-05-20: Current structural UI/UX refactor is presentation-only and keeps ZIP extraction, parsing, selection persistence, settings/history storage, Android permissions, and native Termux Parity saving unchanged. Media Selection, Sort/Filter sheets, Save Options, Saving Progress, Results, and History now use shared premium primitives, one primary CTA per screen/sheet, safe-area-aware sticky actions, hidden raw paths, collapsed SAF/timestamp/folder-template details, and simpler Hebrew copy. TypeScript, unit tests, and lint pass. Remaining risk is real-device visual QA for Hebrew RTL at narrow width, increased Android font size, gesture navigation bottom sheets, and the existing Gallery-date acceptance smoke test.
- 2026-05-22: No-media WhatsApp ZIP handling keeps the pipeline local, stateless, and native-extraction-backed. `_chat.txt` is exposed as a saveable document instead of treating the import as a failure, while media date-correction semantics remain unchanged for Gallery items. Share/open registration is now ZIP-only in Expo config and the generated Android manifest, removing broad `application/octet-stream`/`*/*` resolver matches. TypeScript, unit tests, lint, and prebuild pass; Android run/share-sheet verification still needs a configured Android SDK plus a real device or emulator.
- 2026-05-23: Release-blocking native gap fixed. `ChatStampNative` now has a real Android Expo module again, so global share polling, native ZIP extraction, Termux Parity save, SAF folder selection, output sharing/deletion, and All Files Access checks no longer call an absent native bridge. ZIP handling remains native/streamed and local-only; the JS layer still receives extracted files and metadata rather than whole ZIP contents. The share polling guard now avoids trapping navigation if a future build lacks the native module. TypeScript, unit tests, lint, prebuild, release APK assembly, APK install, and clean launch logcat on the connected phone pass. Real WhatsApp share and Gallery date ordering are still the remaining device proof.
- 2026-05-23: TXT preview is presentation-only and keeps the import/save pipeline local, stateless, and native-extraction-backed. Transcript documents are read from the extracted cache path, parsed with the existing WhatsApp parser grouping rules, shown as sender/date/message bubbles, and fall back to a clean raw text preview when parsing finds no chat messages. Added parser coverage for text-only conversation previews. Verified `npm run typecheck`, `npm run test -- --run`, `npm run lint`, `npx expo prebuild --platform android`, release APK assembly, APK install, and launch logcat on the connected phone with no chatStamp native-module or fatal crash lines.
- 2026-05-23: TXT preview follow-up keeps the same local/native import and save semantics. Transcript preview content now uses a bounded nested Android scroll area, message timestamps use the compact `D/M/YY HH:mm` format with no seconds, and selectable text was removed from bubbles so scroll gestures are not captured. RTL/LTR switching now uses a live app-level layout-direction provider plus root and bottom-sheet `direction` styles instead of relying on `I18nManager.isRTL` for immediate in-session changes. Verified `npm run typecheck`, `npm run test -- --run` (25 files / 103 tests), `npm run lint`, `npx expo prebuild --platform android`, release APK assembly, APK install, and connected-phone launch logcat with no chatStamp fatal/native-module errors.


- 2026-11-18: Stage C final review found no remaining actionable findings after
  cancellation summary/history corrections. Independent acceptance adds31tests;
  final smoke222Vitest/23JVM/10connected perAPI30/API36 passes. Physical share,
  cache, background and cancellation plus API36 notification denial and official
  timeout cleanup passed. API33 physical and real WhatsApp export remain unverified.

- 2026-11-18: D final source review clear after bounded thumbnails, actual Set/cell/lifecycle tests, clipping replay and native gesture fixes. Full smoke305TS/35JVM/27connected perAPI30/API36 passes; signed code4 artifact checks and physical scoped runtime pass. E still owns sheet/footer accessibility; OEM HTML Viewer limitation and API33/real-export/Play gaps remain explicit.

- 2026-11-18: E source review clear after Save-intent/restart/share-intake races, serialized partial settings patches, native localized-profile compatibility and consistent message-date facts/bilingual errors were fixed. Wholecycle448TS/40JVM/35connected perAPI30/API36 passed; minified UI/RTL and screenshots remain OPEN.


-2026-11-19: E/F final source/docs findings resolved. Fullsmoke431host/40JVM/39connected perAPI30/API36,81Python, stricti18n/Knip and fresh Android CI pass. Code6 signed artifacts, final physical five-file/Gallery/duplicate/a11y/RTL/background/40-video and API36 reviewer scope pass. Cleanup/restoration pass. Full UI matrix/API33/real owner export/actual16KiB/Play participant facts remain explicitly unverified; no merge/upload. G2 owner-handoff review is separate.
