# AGENTS.md — chatStamp

These are repository-level instructions for Codex and other coding agents.

## Product purpose

Build an Android-first React Native app that imports WhatsApp chat export ZIP files, maps exported media files to their original message dates from `_chat.txt`, filters by sender/media type, and saves selected media to Android Gallery so Gallery sorting reflects the original WhatsApp dates.

## Non-negotiable rules

1. Do not fake timestamp success. If the app cannot actually make Android Gallery sort correctly, expose that as a failed verification and implement the missing native layer.
2. Do not use a database for MVP. Keep the pipeline stateless. Zustand state is allowed for current session state only.
3. Do not load whole ZIP files into JavaScript memory. Use native ZIP extraction.
4. Do not extract unnecessary files. Extract only chat text and supported media extensions for the current stage.
5. Do not include cloud upload, analytics, account login, or server APIs.
6. Do not build Phase 2 features unless explicitly requested. Phase 2 is listed in `docs/PRD.md`.
7. Keep prompts, docs, code comments, and internal task descriptions in English.
8. User-facing UI copy can be simple English for now. Hebrew/RTL copy is not part of the MVP unless requested later.

## Tech stack

- React Native with Expo managed workflow plus development build when native modules are required.
- TypeScript.
- Zustand for temporary pipeline state.
- react-native-paper / Material Design 3 for UI.
- expo-media-library for saving into Gallery where useful.
- react-native-zip-archive or equivalent native module for ZIP extraction.
- Native Android bridge / Expo module if needed for reliable MediaStore / EXIF / DateTaken updates.

## Commands

Run these after meaningful changes:

```bash
npm run typecheck
npm run test
npm run lint
```

If native Android config changes:

```bash
npx expo prebuild --platform android
npx expo run:android
```

## Definition of done for MVP

A feature is not done until:

- TypeScript passes.
- Parser tests pass.
- Large ZIP handling avoids JavaScript memory blowups.
- Android permissions are tested on a real Android device.
- A real WhatsApp export ZIP is processed.
- Saved media appears in Gallery.
- At least one Gallery app sorts saved media by the original WhatsApp date, not the import time.
- Cache cleanup is verified.

## Architecture expectations

Use adapter boundaries:

- `src/lib/*` for pure utilities.
- `src/services/*` for app services and orchestration.
- `src/native/*` for native module boundaries.
- `src/store/*` for Zustand session state.
- `src/screens/*` for UI flows.

Do not let screens parse chat text, unzip files, or write metadata directly.

## Planning rule

For significant features, use an ExecPlan from `.agent/PLANS.md`. Start from `.agent/EXECPLAN-MVP.md` unless the user asks for a narrower task.

## Review rule

Before finalizing work, review against `docs/CODE_REVIEW.md` and update the relevant status sections in `.agent/EXECPLAN-MVP.md`.
