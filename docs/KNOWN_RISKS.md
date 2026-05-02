# Known Risks

## 1. MediaStore / EXIF limitations

Expo APIs may not expose all fields needed to control Android Gallery sorting. If this happens, implement a focused native Android module.

## 2. Gallery app differences

Samsung Gallery, Google Photos, OEM Gallery apps, and file managers may use different sorting logic.

## 3. WhatsApp export format variations

WhatsApp text export lines vary by locale, platform, and version. Keep the parser test-driven.

## 4. Large ZIP memory pressure

A chat export can contain thousands of files. Avoid all-at-once reads and use native extraction.

## 5. Share Intent URI handling

Shared files may arrive as `content://` URIs with temporary permissions. Copy to cache immediately.

## 6. Permissions and Play policy

Broad media access may require justification. MVP should request only needed permissions.
