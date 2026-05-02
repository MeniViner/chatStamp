# Android Technical Notes

## Scoped storage

Android 10+ changed how apps access shared storage. The app should treat direct filesystem writes to public media folders as unreliable unless mediated by Android's official storage/media APIs.

## Gallery sorting

Android Gallery apps may sort by different fields. Common candidates:

- EXIF DateTimeOriginal for images.
- MediaStore DATE_TAKEN.
- MediaStore DATE_ADDED.
- MediaStore DATE_MODIFIED.
- File modified time.

The MVP must verify which fields matter on the target device/gallery.

## ZIP extraction

Do not use a JS-only unzip implementation that buffers the entire archive. Use native ZIP extraction and extract only relevant files.

## Share Intent

WhatsApp may share exported ZIPs as `content://` URIs. The app should copy the incoming URI into app cache before processing.

## OPUS voice notes

Voice notes are not the core MVP target. They should be detected and excluded by default. A later phase can decide whether to save them as audio files or show a separate flow.

## Native bridge guidance

If Expo APIs cannot update date fields sufficiently, implement a focused Android native module with methods like:

```ts
setMediaStoreDates(params: {
  contentUri: string;
  takenAtMillis: number;
  modifiedAtSeconds?: number;
}): Promise<void>;
```

Keep this bridge tiny and test it on-device.
