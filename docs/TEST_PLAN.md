# Test Plan

## Unit tests

### Parser

- Standard English WhatsApp export lines.
- Hebrew/RTL names and Unicode control marks.
- 24-hour timestamps.
- 12-hour timestamps if encountered.
- Multiline messages.
- Media omitted lines.
- Attached media filename lines.
- Duplicate filenames.

### Media classifier

- Photo extensions.
- Video extensions.
- OPUS/voice extensions.
- Unknown extensions.
- Uppercase/lowercase variants.

## Integration tests / manual tests

### ZIP import

- Small ZIP.
- Large ZIP.
- ZIP with nested folders.
- ZIP without `_chat.txt`.
- ZIP with unsupported files.

### Share Intent

- Share ZIP from WhatsApp export flow.
- Open ZIP from file manager.
- Handle MIME variants.

### Android Gallery verification

For each test device:

1. Export a WhatsApp chat with known media dates.
2. Process it through the app.
3. Save selected files.
4. Open Gallery.
5. Sort by date.
6. Confirm date positions match original message dates.
7. Record Gallery app name/version and Android version.

## Acceptance test dataset

Create a small private test ZIP manually:

- 3 photos from Sender A on different dates.
- 2 videos from Sender B.
- 1 OPUS voice note.
- 1 unmatched media file.

Do not commit private WhatsApp exports to the repo.
