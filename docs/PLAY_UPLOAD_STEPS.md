# chatStamp — current Play Console state and next steps

Updated **2026-11-19**. Continue the existing app **4974511742201615518**, package **com.menis.chatstamp**, in menis 10tec.

[Dashboard](https://play.google.com/console/u/0/developers/5615073583807067044/app/4974511742201615518/app-dashboard) · [Publishing overview](https://play.google.com/console/u/0/developers/5615073583807067044/app/4974511742201615518/publishing).

Signed **0.2.0 (12)** is **active and available to internal testers**. The same uploaded AAB was selected from the library for **Alpha**, replacing the pending code 11 release. **All 16 changes are submitted and shown “Changes in review”**, including Alpha 12, both listings, content rating and the other prepared declarations. The owner completed IARC; the former portrait hardware issue is resolved. No closed availability, invitation-email delivery, qualifying tester period or production approval is inferred.

| Item | Observed result |
| --- | --- |
| Internal | Active0.2.0 (12), available to testers. [Internal opt-in](https://play.google.com/apps/internaltest/4700119235354966099). Internal participation does not count toward closed testing. |
| Alpha | Track4699842536467818806, same 12 AAB from library, bilingual notes. Included in16 submitted changes; shown **Changes in review**. Closed availability is not yet confirmed. |
| Testers | All five existing lists: list1(4), list2(7), Tank Malle – Internal(1), חברים(6), משפחה(2), assigned to internal and Alpha.20 memberships may overlap; they are not20 unique/opted-in testers. No addresses are exported to Git/evidence. No invitation email has been sent. |
| Countries |177 countries/regions plus Rest of World; private tester eligibility and opt-in still apply. |
| Listing | Complete EN(en-US)/HE(iw-IL), logo/banner and four actual phone images per language, Import→Select→Saving→Results. Brand graphics alone have AI labels. Images retain actual9provenance; the public FGS demo retains actual11provenance for unchanged behavior. |
| Configuration | Free, Tools category/tag,18+ audience; public support meniviner@gmail.com and bilingual policy. Owner completed content rating; the pending rating declaration was included in submission. |
| Declarations | No restricted login, ads, reportable collection/sharing, Advertising ID, government, financial or health feature. dataSync: Local processing→Import/export, with the verified public11 demo URL. |

## Immutable code 12 products

Production AAB: `dist/play/release-0.2.0-12/chatstamp-0.2.0-12.aab`, **50,956,257 bytes**, SHA256 **0d2efc0cb86b2ba5657fee04e57484aac3fb6847c59f2bf9dda112dfa05a6d51**. QA APK: same folder, **75,225,186 bytes**, SHA256 **2bec0cb7139901629693b4a062dd8343cb2f86cc9abea8cd0292c6fa49ff8b9b**. Both use existing certificate `efe36695cfc6a3d9ea8471527103f29e3374322ab09890af41692412d76a66c8`. Source **b2b88e9d3ef8292d00ef695f328a225cbb9b2418**.

**Code 12 is consumed by Play.** Reuse its exact library artifact; different future bytes require code13 or higher and new acceptance. Preserve11 and12 products and the existing upload key. Play's app-signing key and upload key have separate purposes.

The durable plugin explicitly marks `android.hardware.screen.portrait` optional and retains portrait activity orientation. Local merged/AAB/APK manifests and independent AAPT2 badging agree; both Console release checks showed ready, and Publishing overview accepted the16 changes without the original issue. This expands eligibility; it does not certify every tablet/Desktop/TV/car/XR runtime. Exact12 wide-screen five-file acceptance is recorded separately.

## Resume after Google's review

1. Inspect the actual existing review outcome. Address specific new findings if any; do not recreate the app or infer approval from a submitted state.
2. After approval, confirm Alpha 12 is available and its closed opt-in link works for an eligible assigned account: `https://play.google.com/apps/testing/com.menis.chatstamp`.
3. Send the approved bilingual invitation in [TESTERS.md](TESTERS.md) to all assigned groups, privately deduplicating recipients. An internal tester must leave internal testing before joining closed testing. Do not substitute the working internal link for a qualifying closed test.
4. Record genuine closed opt-ins, continuous participation and actual feedback. Console showed0 closed opt-ins and requires12 testers/14 continuous days. List membership, screenshots, internal installs or local test runs do not satisfy that period.
5. Complete the owner's private real-export acceptance and truthful production-access answers only when the real gate is satisfied. PR #1 remains unmerged; no production rollout is requested.

Current proof: `dist/play/console-setup-20261119/README.md` and console-state.json. Earlier dated evidence retains its original scope. Owner real WhatsApp, API 33physical/full UI, actual16 KiB runtime, browser rendering and scoped provider/Cancel gaps remain in [KNOWN_RISKS.md](KNOWN_RISKS.md). After owner merge, change Pages source to main/docs before deleting fix/core-rebuild.
