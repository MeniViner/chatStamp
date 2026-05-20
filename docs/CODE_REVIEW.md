# Code Review Checklist

Use this checklist before accepting Codex changes.

## Product correctness

- Does the change move the MVP toward real Gallery date sorting?
- Does it avoid Phase 2 scope creep?
- Does it keep the app local-only?

## Android correctness

- Are Android permissions appropriate and minimal?
- Does the change respect scoped storage?
- Does it handle `content://` URIs?
- Does it avoid relying only on filesystem timestamps?

## Performance

- Does it avoid loading the whole ZIP into JS memory?
- Are large file operations streamed or native-backed?
- Does UI progress update during long operations?

## Parser quality

- Are new WhatsApp text formats covered by tests?
- Does parsing tolerate Unicode marks and multiline messages?
- Does failure produce a skipped/unmatched result rather than a crash?

## TypeScript quality

- No `any` unless justified.
- Public service functions use typed inputs/outputs.
- Errors are represented clearly.

## Verification

Run:

```bash
npm run typecheck
npm run test
npm run lint
```

For native changes, also run on Android device:

```bash
npx expo prebuild --platform android
npx expo run:android
```

## Latest Review Status

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
