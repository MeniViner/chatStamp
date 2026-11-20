# Hebrew store artwork — native editable layout

This is a renderable design template, not a rendered/approved asset set. Root owns
capture integration, actual rendering, inspection and upload. No app/repository,
device or browser operation is part of this tooling.

The Tank Malle reference supplies the composition: quiet cream or ink poster,
condensed Hebrew headline at upper right, a full tilted real screen at left,
and a short explanation with a restrained gold arrow at right. chatStamp uses its
own unchanged mint/teal/soft-gold icon and a new genuine bitmap illustration.

## Inputs and dependencies

- macOS native Swift + AppKit/CoreGraphics/CoreText/ImageIO/CryptoKit; no pip/npm
  packages, server, browser, generated UI or imagegen call in the renderer.
- Editable UTF-8 `layout.json`: all seven canvases, exact Hebrew copy, colors,
  text boxes, phone slot, angles and image-quality/byte ceilings.
- `fonts/Karantina-Bold.ttf` and `fonts/Heebo.ttf`, registered for this process
  only. Headline is Karantina Bold; body prefers Heebo with native Arial fallback.
  The downloaded official Google Fonts OFL files are included alongside them.
- Complete actual captures at
  `/tmp/chatstamp-store-he-20261120/captures/{01-import,02-selection,03-saving,04-results,05-transcript,06-settings}.png`.
  No old-capture fallback exists. Missing inputs stop the renderer.
- Unchanged brand icon: repository `store/play/icon.png`.
- Illustration:
  `/tmp/chatstamp-store-he-20261120/illustration/chatstamp-memory-illustration.png`.
  The supplied1254×1254 RGBA is sufficient: display is below500px and uses contain
  without upscaling. It appears only in the feature, outside any actual UI, with
  the Hebrew AI-illustration disclosure.

## Portable rendering command

Use the repository-relative command in `../../README.md`. Capture inputs now live
in `../native-captures/`; the illustration lives in `../chatstamp-memory-illustration.png`.
The original temporary tooling paths below describe authoring history only.

## Review and size boundary

Root should open every export before upload: Hebrew order and line breaks,
current real UI, full top/bottom screenshot bounds, legible actual counts and
conditional date copy. Exact1–6 headline copy is in `layout.json`. Results says
date accuracy depends on the file and destination; the feature makes no universal
Gallery/date guarantee.

Output images target≤3,500,000 bytes. The renderer includes all existing nested
files in the output folder in a conservative old/new-overlap check and refuses
before writing if the complete set would reach10,000,000 bytes. It also refuses
text overflow rather than silently clipping or shrinking below the configured
minimum. Keep original capture PNGs in TMP; the manifest records hashes without
copying them into the final set. The existing genuine illustration/source prompt
remain owned by root in the final folder. Re-measure after any root additions.

If a render must be revised, edit only the layout JSON and rerun. When the
conservative overlap check refuses a repeat, remove only that pass's seven known
JPEGs and render-manifest before rerendering; retain root's source illustration.
Do not copy old proof, raw logs, binaries or repository snapshots here.

## Official font sources

- https://raw.githubusercontent.com/google/fonts/main/ofl/karantina/Karantina-Bold.ttf
- https://raw.githubusercontent.com/google/fonts/main/ofl/karantina/OFL.txt
- https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/Heebo%5Bwght%5D.ttf
- https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/OFL.txt

The current reference and brand/icon/illustration were inspected before authoring.
No final composition has been rendered or visually accepted by the template author.

Official OFL license text keeps its original words; CRLF endings and trailing spaces were normalized for repository whitespace checks.
