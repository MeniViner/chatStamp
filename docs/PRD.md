# Product Requirements Document — WhatsApp Media TimeFixer

## 1. Problem

When users export WhatsApp chats with media, the media files often lose meaningful gallery ordering after import/copy. Android Gallery may show media by the date it was saved/imported rather than the date the message was sent.

## 2. Objective

Create a local Android app that restores meaningful gallery ordering by reading original message dates from WhatsApp `_chat.txt` and applying those dates to selected exported media files.

## 3. MVP scope

### In scope

- Android-first app.
- Import one WhatsApp ZIP at a time.
- Parse `_chat.txt`.
- Match media filenames to sender and message timestamp.
- Filter by sender.
- Filter by media type:
  - Photos: jpg, jpeg, png, heic, webp
  - Videos: mp4, mov, 3gp, m4v
  - Voice notes: opus, ogg — default excluded
- Save selected photos/videos to Gallery.
- Apply original dates as metadata / MediaStore fields.
- Clear cache after completion.
- Stateless pipeline, no history.

### Out of scope for MVP / Phase 2 backlog

- Bottom navigation.
- Settings screen.
- Automatic recurring cache cleanup settings.
- Dedicated album management.
- Extraction history/logs UI.
- Visual media grid with thumbnails.
- Advanced grouping/sorting.
- Smart select-all.
- End-user polished copywriting.
- Cloud backup, server sync, user accounts.

## 4. User flow

1. User opens app or shares WhatsApp ZIP to app.
2. App requests media permissions.
3. App copies ZIP to cache.
4. App extracts relevant files.
5. App parses `_chat.txt`.
6. App shows senders and media counts.
7. User selects one or more senders and media types.
8. App saves selected media to Gallery with original dates.
9. App shows completion summary.
10. App clears temporary files.

## 5. Core screens

### Import screen

- Explain purpose simply.
- Button: Select WhatsApp ZIP.
- Optional: display received shared ZIP.
- Show permission status.

### Review screen

- Summary cards:
  - ZIP name
  - matched media count
  - unmatched media count
  - senders count
- Sender checklist.
- Media type toggles.
- Continue button.

### Processing screen

- Progress indicator.
- Current stage text.
- Counts: processed / total / failed.
- Cancel is optional for MVP if safe cancellation is hard.

### Done screen

- Saved count.
- Skipped count.
- Failed count.
- Cache cleanup result.
- Start over button.

## 6. Functional requirements

- App must not upload files.
- App must keep processing local.
- Parser must tolerate WhatsApp locale variations.
- Failed files must not crash the entire run.
- Unmatched media must be shown in summary.
- Cache must be deleted after completion or reset.

## 7. Non-functional requirements

- Avoid loading large ZIP files into JS memory.
- Use typed models.
- All file operations must be isolated in services/adapters.
- UI must remain responsive during long operations.
- Handle Android scoped storage explicitly.

## 8. Acceptance criteria

- A real WhatsApp ZIP can be imported.
- Senders are detected from `_chat.txt`.
- User can filter by sender and media type.
- Selected photos/videos are saved to Android Gallery.
- Gallery date sorting uses original WhatsApp message dates in at least one verified Android Gallery app.
- Temporary cache is removed after processing.
