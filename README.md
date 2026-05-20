# chatStamp

Local Android pipeline app for importing WhatsApp chat export ZIP files, filtering media by sender and media type, and fixing gallery ordering by applying original message dates from the WhatsApp chat transcript TXT.

## MVP goal

Build a stateless, local-only React Native + Expo app that:

1. Receives or selects a WhatsApp chat export ZIP.
2. Copies it into app cache.
3. Extracts the WhatsApp chat transcript TXT plus supported media files.
4. Parses the transcript into `{ filename, sender, originalMessageDate }` records.
5. Lets the user select senders and media types.
6. Saves selected media to Android Gallery with the original dates applied to metadata / MediaStore where possible.
7. Deletes cache and resets state.

## Important technical decision

This app cannot rely only on `mtime`, `ctime`, or JavaScript file timestamps. Android Gallery often sorts from MediaStore fields and/or EXIF metadata. The implementation must verify real Gallery behavior on an Android device.

For production-grade Android behavior, Codex should implement or wire a native Android bridge if Expo APIs cannot update the fields needed by the target Gallery app.

## Recommended start

```bash
npm install
npm run typecheck
npm run test
```

For Android testing with native libraries:

```bash
npx expo prebuild --platform android
npx expo run:android
```

For live terminal logs while testing on a real Android device:

```bash
npx expo start --dev-client
adb reverse tcp:8081 tcp:8081
adb logcat -s ChatStamp ReactNativeJS Expo
```

For Android resolver and merged-package share target diagnostics:

```bash
adb shell cmd package query-intent-activities -a android.intent.action.SEND -t application/zip
adb shell dumpsys package com.local.chatstamp
adb logcat -s ChatStamp ReactNativeJS Expo
```

The installed package must show `MainActivity` as a ZIP share target for `SEND` and `SEND_MULTIPLE`. A real WhatsApp share attempt should log `shareIntentRaw`, `shareIntentAccepted`, `shareIntentCopied`, and `shareIntentConsumedByJS` with a `content://` source URI, copied size greater than zero, and `validZip=true`.

If a real Android device shows asset URLs like `http://localhost:8081/assets/...`, the device is trying to reach Metro. Run `adb reverse tcp:8081 tcp:8081` before launching the development build over USB.

When testing WhatsApp share-sheet import, compare the log lines for `sourceSizeBytes`, `copiedSizeBytes`, `validZip`, `zipEntryCount`, and `firstZipEntries`. If the shared ZIP has only the transcript TXT and no media entries, export again from WhatsApp with `Include media`.

The final save path is native Android MediaStore insertion. The app does not use `expo-media-library` to create Gallery assets. New photos/videos are inserted as app-owned MediaStore rows, so Android 10+ does not require broad Gallery read permission for saving selected files.

or use EAS development builds:

```bash
npx eas build --profile development --platform android
```

## Why not Expo Go?

The MVP needs native ZIP extraction and probably native Android MediaStore date updates. Treat Expo Go as insufficient for the full MVP. Use a development build.

## Repository layout

```txt
.
├── AGENTS.md                         # Codex operating rules
├── .agent/PLANS.md                   # Execution-plan rules for complex work
├── .agent/EXECPLAN-MVP.md            # Living implementation plan for this MVP
├── docs/                             # PRD, architecture, testing, review rules
├── prompts/                          # Ready-to-paste Codex prompts
├── src/                              # Starter TypeScript app skeleton
├── App.tsx                           # App entry
├── app.config.ts                     # Expo config and Android permissions
├── package.json                      # Dependencies and scripts
└── tsconfig.json
```

## Current status of this starter

This ZIP is not meant to be a finished app. It is a Codex-ready starter repository with:

- A strong product/technical spec.
- Rules that tell Codex what not to fake.
- Starter app structure.
- Pure parsing utilities and tests.
- Native integration placeholders for ZIP, Share Intent, EXIF, and MediaStore work.

The first real Codex task should be: open `prompts/CODEX_START_HERE.md` and follow it.
