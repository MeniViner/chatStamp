# chatStamp — current Play Console state and next steps

Updated **2026-11-19** after the owner authorized Console setup and explicitly approved the app-creation legal declarations. Continue the **existing app**, not another app entry:

[chatStamp dashboard](https://play.google.com/console/u/0/developers/5615073583807067044/app/4974511742201615518/app-dashboard) · [Publishing overview](https://play.google.com/console/u/0/developers/5615073583807067044/app/4974511742201615518/publishing).

## What is actually saved

| Item | Observed result |
| --- | --- |
| Identity | chatStamp, `com.menis.chatstamp`, app ID `4974511742201615518`, existing personal developer account. Free app; Tools category/tag; audience 18+. |
| Internal testing | **Active**, **0.2.0 (11)**. Production AAB processed with min SDK30/target36/four ABIs; save/publish confirmed. [Enabled internal opt-in link](https://play.google.com/apps/internaltest/4700119235354966099). This does not start a closed-test clock. |
| Closed Alpha | **Same code11 AAB selected from the artifact library**, bilingual release notes and full review step saved. Alpha track `4699842536467818806`. **Not yet submitted or available.** |
| Testers | All five existing lists assigned to internal and Alpha: list1(4), list2(7), Tank Malle – Internal(1), חברים(6), משפחה(2). Counts can overlap; these20memberships are not20unique/opted-in testers. Private addresses were not exported to Git/evidence. |
| Countries | Alpha changes include177countries/regions plus Rest of World. Access still requires the tester list, eligibility and opt-in. |
| Listing | English (`en-US`) and Hebrew (`iw-IL`) saved with complete text, logo, feature banner and four actual-phone screenshots per language in Import/Select/Saving/Results order. PNGs retain actual code9 capture provenance for unchanged UI; no screenshot is relabeled as code11. Brand graphics have individual AI labels; actual screenshots do not. |
| Contact/policy | `meniviner@gmail.com` saved. [Public bilingual policy](https://meniviner.github.io/chatStamp/privacy-policy.html) matches tracked HTML. The installed-browser page rendering still needs owner acceptance. |
| Declarations | No restricted login, ads, reportable collection/sharing, government affiliation, financial/health features or Advertising ID. dataSync is declared only as **Local processing → Import/export**, with the actual hosted demo below. |
| Remaining content declaration | **IARC terms/content rating**, awaiting the owner's action-time agreement. Other factual declarations are saved. |

No production rollout or production-access approval was requested. No invitation email has been sent. Assigning tester lists grants eligibility; it does not deliver an email or establish opt-in.

## Exact products already used

The dedicated [local product set](../dist/play/release-0.2.0-11/README.md) identifies binary app source **138e00c8bc3f991b9d984cf79075501b566b3f40**, established upload certificate and all artifact hashes. The uploaded production AAB SHA256 is **999cbcc1883377bc5965a7665ec20b837eb76ce9ae9597530de0b3ed149fd4ab**. The side-by-side QA installer is not the upload identity.

**VersionCode11 has now been uploaded.** Reuse that exact artifact from the library for Alpha; different future bytes require a higher code and their own acceptance. Do not generate another upload key. Play's app-signing key and the established upload key have separate purposes.

The fresh actual code11 foreground demonstration is publicly served at:
[chatStamp foreground-save demo](https://meniviner.github.io/chatStamp/media/chatstamp-0.2.0-11-fgs-demo.mp4).
HTTP200, **81,486bytes**, SHA256 **d319af658e5a35e16e7bea13ce0af8d74902f4bf12415f19efe60bcca29b7519** was verified against the local product. It is the8.25-second actual synthetic Saving/Cancel → own1/4notification →4saved/4verified run. The full raw recording/shade were deleted; no personal content is hosted.

## Finish the remaining review steps

1. Open the existing content-rating questionnaire. Public contact **meniviner@gmail.com** and **All other app types** are prepared. Review the [IARC terms](https://web.iarcservices.com/terms). Browser-control policy requires the owner's explicit action-time agreement before checking its legal acceptance box. That specific approval is pending; the earlier app-creation approval does not silently accept this additional agreement.
2. After approval, complete the actual questionnaire using the app's real behavior. It is an offline file/date utility with local user-chosen imports and user-started Android sharing, without a hosted feed or communication service. Read each question's exact definition. Submit and record the actual resulting ratings; none is invented beforehand.
3. In **Publishing overview**, inspect all prepared Alpha/listing/content changes and actual pre-check results. The observed two issues were missing content rating and a **portrait hardware availability warning**. The verified phone-focused code11 requires `android.hardware.screen.portrait`; this can exclude some tablet/Desktop/XR devices. It is distinct from a date/save failure. Expanding supported hardware needs a future source/version/verification change; do not alter the signed11bytes to dismiss a warning.
4. Once required errors are resolved, acknowledge the applicable availability warning for this tested phone release and choose **Send changes for review**. If pre-checks are running, record their real result. Submission is not approval or availability. No production rollout is part of this step.
5. Wait for the real Google review/track status. Confirm Alpha code11 is available. Then copy the **closed** opt-in link from Alpha's Testers tab and verify it with an eligible account. Console currently displays `https://play.google.com/apps/testing/com.menis.chatstamp` but its closed-link control is disabled until availability; it is **not yet a working closed invitation**.
6. Only then deliver the closed invitation from [TESTERS.md](TESTERS.md) to the five assigned lists. Record actual delivery, genuine usage/feedback and unique continuous opt-ins privately. Internal testers should leave internal testing before using the closed track. Do not send an internal link as a qualifying closed link.
7. Console explicitly requires **at least12 testers continuously opted in for14days** and currently shows **zero closed opt-ins**. Use Console eligibility and genuine feedback before applying for production access. The account creation date is still unknown; the displayed requirement is already explicit. [Official requirement](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).
8. Complete the owner's real WhatsApp closed/warm share and known-date Gallery acceptance in TESTERS.md. The synthetic device tests do not establish it. Keep private chats/media outside Git/public proof. API33physical/full UI, actual16KiB execution and the other scoped/deferred gaps remain in [KNOWN_RISKS.md](KNOWN_RISKS.md).

## Publishing-source custody

Pages currently serves **fix/core-rebuild /docs**, including policy and the small synthetic demo. [PR #1](https://github.com/MeniViner/chatStamp/pull/1) is open/unmerged. Only after the owner merges the same content to main should Pages switch to **main /docs**; verify deployment before deleting the branch. The agent does not merge.

## לבעל החשבון

האפליקציה כבר נוצרה, וגרסה0.2.0(11) פעילה בבדיקה הפנימית. אין ליצור אפליקציה נוספת או להעלות קובץ אחר תחת אותו קוד. החנות נשמרה באנגלית ובעברית עם הלוגו, הבאנר וארבעה צילומים בכל שפה. חמש הרשימות הקיימות צורפו גם ל-Alpha.

הגרסה הסגורה נשמרה אך עדיין לא נשלחה לבדיקה ולא זמינה להצטרפות. נותר אישור תנאיIARC והשלמת דירוג התוכן, ואז בדיקת סיכום השינויים ושליחה ל-Google. לאחר אישור וזמינות בפועל יש למסור לבודקים את הקישור הסגור ולתעד הצטרפות אמיתית. לא נשלחו הודעות הזמנה, לא התחיל שעון הבדיקה הסגורה ולא התקבל אישור להפצה לייצור.
