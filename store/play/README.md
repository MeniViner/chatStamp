# Google Play listing package

Final listing updated **2026-11-19** for **0.2.0 (6)**. This folder is the tracked listing output set. No Console upload or live listing is established by its presence. The linked privacy policy was published and anonymously verified HTTP200 on2026-11-18; its in-app action still needs installed-device verification. Start the owner handoff at [PLAY_UPLOAD_STEPS.md](../../docs/PLAY_UPLOAD_STEPS.md); declarations and release gates are in [PLAY_RELEASE_CHECKLIST.md](../../docs/PLAY_RELEASE_CHECKLIST.md).

## Text files

| Console language | Directory | Fields |
| --- | --- | --- |
| English (United States), `en-US` | [en-US/](en-US/) | `title.txt`, `short-description.txt`, `full-description.txt`, `release-notes.txt` |
| Hebrew, `he-IL` | [he-IL/](he-IL/) | Same four fields; Hebrew text is authored, not an automatic translation. |

Paste file contents only, without filenames or Markdown fences. Title≤30, short description≤80 and full description≤4000 characters; release notes≤500 characters per language. Recheck counts after editing. The contact chosen by the owner is **meniviner@gmail.com**. The listing describes current functionality and explicitly limits date guarantees; it includes the implemented three-step picker/preview/RTL redesign. Replace release notes/version references for each later candidate.

## Asset map and required verification

The release owner supplies and verifies the assets; this text preparation does not certify them. Do not mark the package complete until every file below exists, is inspected, and depicts the verified candidate.

| File(s) | Required format / content |
| --- | --- |
| `icon.png` | 512×512, 32-bit PNG with alpha, ≤1024 KB, sRGB. Full square; no pre-rendered outer corner mask or shadow. |
| `feature-graphic.png` | 1024×500, 24-bit PNG without alpha; JPEG is also accepted if the actual filename is updated here. Use actual branding without ranking/award claims. |
| `screenshots/en-US/01-import.png` | Actual physical-phone import screen, synthetic data, English. |
| `screenshots/en-US/02-selection.png` | Actual selected supported files, synthetic names/content, English. |
| `screenshots/en-US/03-saving.png` | Actual user-started save/progress, English; do not stage a finished run as active. |
| `screenshots/en-US/04-results.png` | Actual saved/date-verified counts from the same candidate, English. |
| `screenshots/he-IL/01-import.png` through `04-results.png` | The corresponding actual-phone Hebrew screens, readable RTL. |

Phone screenshots: JPEG or 24-bit PNG without alpha, 320–3840 px per dimension and longest side ≤2×shortest; at most 8 per device type. Play needs at least 2 screenshots to publish; this task requires **four per language**. Prefer 1080×1920 portrait for the recommendation format. A raw 1080×2340 capture is too tall: use compliant physical capture dimensions or a truthful crop that preserves the depicted content. Do not invent UI, hide relevant results, use real chats/names/photos, or substitute emulator images for the required phone captures. Keep a brief provenance record of phone, candidate, language, synthetic run and any crop; do not place raw logs here.

The shared `feature-graphic.png` currently contains English copy and is mapped as the English default graphic; it is not language-neutral. The Hebrew listing may use it as the shared default, or the owner may add a separately verified Hebrew localized graphic. Suggested alt text: English “chatStamp imports a chat export and saves selected files with verified date results.” Hebrew “chatStamp מייבאת ייצוא שיחה ושומרת קבצים נבחרים עם תוצאות אימות תאריך.”

Before handoff inspect image dimensions/channels and every screen, validate text limits, scan for private content/secrets, and state any missing asset. Do not copy build outputs, old evidence, raw videos or a real export into this folder. Keep the combined current evidence set under 10,000,000 bytes; release APK/AAB artifacts belong under ignored `dist/`, not the listing folder.

## Sources checked 2026-11-18

- [Play listing fields](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en): localized title/short/full limits and a listing shared across tracks.
- [Play preview assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en): icon/feature graphic, screenshot counts, format, size/aspect and actual-app content requirements. The article's explicit 8 MB limit is for Android XR; no universal phone 8 MB ceiling is asserted here.
- [Play icon specifications](https://developer.android.com/distribute/google-play/resources/icon-design-specifications): dimensions, sRGB, full square and Play-applied corner mask/shadow.
- [Prepare a release](https://support.google.com/googleplay/android-developer/answer/9859348?hl=en): localized release notes. Use the current Console limit if it changes.

## לבעל החשבון

קובצי הטקסט באנגלית ובעברית מוכנים להעתקה, אך אין בכך אישור שהחנות או הבדיקה הסגורה פורסמו. יש לוודא שקיימים ונבדקו סמל 512×512, תמונת נושא 1024×500 וארבעה צילומי מסך אמיתיים מכל שפה, עם מידע מלאכותי בלבד. יש לעדכן גרסה, הערות הפצה וצילומים בכל העלאה עתידית ולפעול לפי [הוראות ההעלאה](../../docs/PLAY_UPLOAD_STEPS.md). עמוד הפרטיות פורסם ואומת לציבור; יש לבדוק גם את פתיחתו מהאפליקציה המותקנת.

All eight actual-phone screenshots were replaced on2026-11-19 with the minified code6 three-step UI. Exact device, synthetic runs, native direction, dimensions and hashes are in `screenshots/provenance.json`. Results intentionally show the actual distinct runs: English4/4 background demo and Hebrew5/5 Gallery regression. Both Saving images show the actual initial four-video operation, not fabricated progress.
