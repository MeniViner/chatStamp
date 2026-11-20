# Store branding provenance — 20 November 2026

The owner explicitly requested replacing chatStamp's old store logo with the approved soft3D chat/clock/folder/photo illustration, a matching Tank Malle proposal for approval, and changing both per-app Play support emails to menis10tec@gmail.com if no new binary was needed. The exact address was explicitly confirmed.

## Artwork

Both creative edits use the built-in image_gen tool, with no CLI/API fallback. The public chatStamp prompt and input role are in chatstamp-imagegen-prompt.json. The separate Tank proposal prompt/reference and images are local-only and excluded from Git until approval. The chatStamp reference is the prior approved illustration at ../../owner-followup-20261120/store-he/source/chatstamp-memory-illustration.png; it is referenced, not repackaged. The new full-square cream-backed master is chatstamp-logo-master.png.

The actual current Tank Malle Play logo was visually inspected on the live listing and captured as tank-current-store-logo-reference.jpg: a gold car-wallet, receipt and small gauge. The local dirty/232-commits-behind PWA checkout contains an older teal gauge and was read only; that stale mark was not used. A browser media-download attempt timed out → **try another way**, use a bounded CUA screenshot crop of the actual visible public icon. The reference crop is an input, not proof of a changed app. The generated Tank Malle master and512 export remain local proposal-only; no Tank logo was uploaded, replaced, committed or pushed.

export-icons.swift makes only a uniform resize/color-format conversion from each square generated master:512×512, sRGB IEC61966-2.1,32-bit RGBA PNG with fully opaque pixels and no crop. It does not create or retouch creative imagery. Final sizes are353,086bytes(chatStamp) and355,717bytes(Tank proposal). Independent Test author checks PASS and Reviewer CLEAR on dimensions, color/alpha, margins, style and scope.

## Contact scope and store checks

Both per-app support contact fields were changed through Save and publish **and the second immediate-publication confirmation**. Both displayed Change published, were closed/reloaded and showed menis10tec@gmail.com independently. An initial one-step save was only a draft: reload reconciled the original address, then both confirmation steps completed. No duplicate mail was sent, and no AAB or developer-account email change occurred. Console says public display usually updates within an hour; separate public propagation was not established.

Only the literal old support-address reference in each chatStamp EN/HE full listing description is replaced, to avoid contradicting its new public support field. The rest of those descriptions, titles, short descriptions, banners and screenshots remain unchanged. Tank listing text has no corresponding support-address footer in the inspected public description and is not rewritten. Native in-app mailto, launcher assets and privacy contacts remain unchanged; this task edits store metadata, not an installed application or privacy policy.

Application code/config/native/launcher and signed14 bytes remain frozen; no new runtime tests or binary acceptance are asserted for these store-only edits. The grouped new delivery includes only fresh sources/results and small owner-only Console proof, below10,000,000bytes. Older delivery sets remain at their original locations. Current source and final-asset hashes are in ../asset-provenance.json; final save/submission state is recorded in owner-only receipts beside the owner README.

The final chatStamp default icon and exact EN/HE address-only description edits were saved/reopened and submitted as three changes. Publishing readback says Changes in review. Hebrew was verified to use the same new default icon; all existing banner/screenshot source URLs remained unchanged. Both per-app support fields separately displayed Change published and persisted after reload.

Official references: [Play listing/contact configuration](https://support.google.com/googleplay/android-developer/answer/9859152) and [preview/icon assets](https://support.google.com/googleplay/android-developer/answer/9866151). Actual save/publication and pending-review claims come from fresh Console readback, not documentation inference.

The prior poster renderer can be reproduced with its original brand icon from commit ec6a60f:store/play/icon.png; the canonical current store/play/icon.png now intentionally contains the replacement logo. Keep historical approved poster outputs unchanged.
