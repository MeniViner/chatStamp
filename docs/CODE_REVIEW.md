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
