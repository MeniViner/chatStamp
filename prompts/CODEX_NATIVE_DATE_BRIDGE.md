# Prompt for Codex — Native Android Date Bridge

Investigate and implement the minimum native Android bridge needed to make saved media sort correctly in Android Gallery by original WhatsApp message date.

Rules:

- Do not assume `expo-media-library` is enough. Verify.
- Keep the bridge tiny and Android-focused.
- Wrap native calls behind `src/native/androidMediaStore.ts`.
- Expose a service API from `src/services/mediaLibraryService.ts`.
- Record which fields are written: EXIF, MediaStore DATE_TAKEN, DATE_MODIFIED, DATE_ADDED if possible/allowed.
- Test with a real Android device and record results in `.agent/EXECPLAN-MVP.md`.

Acceptance criteria:

- Saved images/videos appear in Gallery in original WhatsApp chronological order.
- Failures are reported per file and do not crash the whole run.
