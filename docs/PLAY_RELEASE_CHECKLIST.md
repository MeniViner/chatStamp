# Google Play release checklist

Official requirements were checked on **2026-11-18**; candidate and Console identity refreshed **2026-11-19**. Current candidate: **0.2.0 / versionCode 13**, package **com.menis10tec.chatstamp**, min SDK **30**, target SDK **36**. Use [VERIFICATION.md](VERIFICATION.md) for exact source/artifact evidence. Later different uploaded bytes require a higher versionCode.

The new app **4975002762311404414 / com.menis10tec.chatstamp** is created and exact signed 13 is active/available internally. Alpha **4699420811279917961** reuses that uploaded AAB; both store languages/assets, 177 countries plus Rest of World, all five tester lists and factual declarations are saved. **15 changes are not submitted: one exact Google issue is missing content rating.** Separate owner IARC agreement confirmation is pending. New closed links are disabled, no invitations or qualifying period claimed. Old internal is paused; old Alpha pause is submitted/in review. Follow [the continuation](PLAY_UPLOAD_STEPS.md).

## Release gates

- [x] Signed AAB at `dist/play/release-0.2.0-13/chatstamp-0.2.0-13.aab`; record actual SHA256, source commit and upload certificate fingerprint in the verification report. Reuse the established upload key via [external signing configuration](ANDROID_RELEASE_SIGNING.md). Never put keys or passwords in this repository.
- [x] `bundletool validate` passes. Inspect the final AAB/APKs for package/version, min30/target36, release signature, `debuggable=false`, R8/minification and every delivered ABI. A successful Gradle task alone does not prove signing.
- [x] Check the final permission list: foreground service, dataSync and notifications are the intended app permissions; investigate generated library permissions. No Internet/network-state, broad storage/media-read, microphone, overlay, vibration or install-referrer permission. Verify backup and device-transfer exclusion in the merged release manifest/rules before publishing this privacy policy.
- [x] Inventory every bundled native library and its actual ELF class/machine. Require at least16 KiB LOAD alignment and no RELRO concern on64-bit arm64-v8a/x86_64; retain genuine32-bit raw alignments with explicit policy NOT_APPLICABLE, without claiming16 KiB compatibility. Confirm bundle config requests `PAGE_ALIGNMENT_16K`, and a universal APK passes `zipalign -c -P 16 -v 4`. Record any 16 KiB runtime smoke separately; static alignment does not prove it ran on a 16 KiB device.
- [x] Exact minified code 13 QA installed/started and passed five-file independent date readback on A30 and wide API 36. Actual new-authority sharing passed through an independent receiver. Gallery visual order/Details retains code 11 scope; code 13 reached the Android resolver without selecting a handler. Existing debug-only coverage does not replace these minified checks.
- [x] `store/play/` contains both listing languages, icon, feature graphic and four actual-phone synthetic screenshots per language. Check formats/dimensions against [its README](../store/play/README.md).
- [x] Privacy page publicly returns the policy over HTTPS without login. Add its URL in Console **and inside the app**; verify the in-app Privacy policy action is accessible and opens it. Expected URL: `https://meniviner.github.io/chatStamp/privacy-policy.html` — **PUBLIC: HTTP200 verified2026-11-18; installed action launches Chrome; page rendering UNVERIFIED because browser setup blocks it**.
- [x] New factual declarations, Free/Tools/18+, countries, support and verified FGS demo are saved.
- [ ] Complete the new content rating after the pending owner IARC agreement confirmation; old-entry completion does not accept this new agreement.
- [x] Exact 13 uploaded to the new entry; internal 4701429810228968626 is active/available and its actual enabled opt-in URL recorded.
- [x] All five lists assigned to new internal/Alpha; same uploaded 13 saved for Alpha, bilingual listing/assets and 15 changes prepared.
- [ ] Finish content rating, submit the new changes and observe actual closed availability before invitations; no new-package qualifying period is established.

## Ready-to-paste app and Data safety facts / פרטי האפליקציה ובטיחות נתונים

Submit these facts only after the artifact/SDK audit above matches them. Console questions may vary. Owner signs the declarations; do not mechanically mark every questionnaire answer No.

| Field | English draft | נוסח עברי |
| --- | --- | --- |
| App purpose | Android utility for importing a user-selected WhatsApp export, matching supported attachments to message dates, and saving selected files locally. | כלי לאנדרואיד לייבוא ייצוא WhatsApp שנבחר על ידי המשתמש, להתאמת קבצים נתמכים לתאריכי ההודעות ולשמירת הקבצים שנבחרו במכשיר. |
| Data collected | No. Chat messages, participant information and attachments are accessed and processed only on the device. The app sends no personal data to the developer or a server and contains no analytics, advertising or remote crash-reporting SDK. | לא. הודעות, פרטי משתתפים וקבצים מעובדים רק במכשיר. האפליקציה אינה שולחת מידע אישי למפתח או לשרת ואינה כוללת שירותי ניתוח שימוש, פרסום או דיווח תקלות מרחוק. |
| Data shared | No reportable sharing by the app. Save/Open/Share occurs only after a specific user action to the selected destination/app. No automatic third-party transfer. Recheck that the user-initiated sharing exception applies to every shipped flow. | אין שיתוף המחייב דיווח על ידי האפליקציה. שמירה, פתיחה ושיתוף נעשים רק בעקבות פעולה מפורשת של המשתמש ליעד או לאפליקציה שנבחרו. אין העברה אוטומטית לצד שלישי. יש לוודא שהחריג לשיתוף ביוזמת המשתמש מתאים לכל פעולה בגרסה המופצת. |
| Ads | No ads. | אין פרסומות. |
| App access | All app functions are accessible without an account, login, subscription or special credentials. The reviewer supplies a local ZIP through Android's picker/share flow. | כל פעולות האפליקציה זמינות ללא חשבון, כניסה, מנוי או פרטי גישה מיוחדים. הבודק בוחר קובץ ZIP מקומי דרך בורר הקבצים או מסך השיתוף של אנדרואיד. |
| Accounts/deletion | The app does not create accounts. Local cache/history can be cleared in Settings; Android Clear storage/uninstall removes private app data. Saved shared-storage files remain until separately deleted. No account-deletion URL is applicable to an app without accounts. | האפליקציה אינה יוצרת חשבונות. אפשר לנקות מטמון והיסטוריה בהגדרות; ניקוי נתוני האפליקציה באנדרואיד או הסרתה מוחקים מידע פרטי. קבצים באחסון המשותף נשארים עד למחיקה נפרדת. אין כתובת למחיקת חשבון משום שאין חשבונות. |
| Privacy URL | `https://meniviner.github.io/chatStamp/privacy-policy.html` — use only after live check. | יש להשתמש בכתובת רק לאחר שאומתה זמינותה לציבור. |

The [Data safety definitions](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en) exclude solely on-device processing from collection and provide an exception for expected user-initiated sharing. Device-local transfers are not universally exempt. Do not claim encryption in transit for an app with no app data transmissions, security certification or completed deletion requests that did not occur. Voluntary support email and a chosen cloud provider are described in the policy. Complete any conditional form fields according to the actual practice. Closed testing needs Data safety; an exclusively internal-track app is exempt.

## Content rating and audience — legal consent / דירוג תוכן וקהל יעד — הסכמה משפטית

| Questionnaire area | Facts available for the owner / מידע לבעל החשבון |
| --- | --- |
| Rating contact and category | Contact `meniviner@gmail.com`; utility/app, not a game. / כתובת לפניות: `meniviner@gmail.com`; כלי שימושי, לא משחק. |
| Developer-provided content | No developer-provided violence, sexual content, gambling, controlled-substance promotion or real-money transactions. Imported private files can contain arbitrary user-selected content. / אין תוכן כזה מטעם המפתח או עסקאות בכסף אמיתי. קבצים פרטיים שהמשתמש מייבא עשויים להכיל כל תוכן. |
| User interaction/content | Local previews and user-started Android sharing; no hosted public feed, chat service, matchmaking or online community. Answer the form's exact user-generated-content/file-access questions using this distinction. / תצוגה מקומית ושיתוף ביוזמת המשתמש דרך אנדרואיד; אין פיד ציבורי, שירות צ׳אט או קהילה מקוונת. יש לענות לפי הניסוח המדויק בטופס. |
| Intended age groups | **18+ saved for the new entry**. No Families eligibility is claimed. / **18 ומעלה נשמרו ברשומה החדשה**; אין טענה להתאמה לתוכנית המשפחות. |
| Final rating | **New-entry questionnaire pending.** The owner completed the old questionnaire; no new regional rating is inferred. / **השאלון ברשומה החדשה טרם הושלם.** בעל החשבון השלים את השאלון הקודם; אין להסיק מכך דירוג לרשומה החדשה. |

Free status and distribution countries are saved under the authorized setup. Preserve the actual developer identity and obtain action-time owner confirmation for any additional legal agreement; do not re-request already given creation or routine setup authorization. The app has no news, health, financial or government-service feature; answer any related category form according to the actual app. [Play review preparation](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en) explains the required App content sections and the public, in-app-linked privacy page.

## Foreground service declaration / הצהרה על שירות בחזית

**Type:** `dataSync` / `FOREGROUND_SERVICE_DATA_SYNC`. **Use case:** Local processing → Import or export. Only the user-started save uses this service; do not declare a network transfer, automatic sync, media playback or startup task.

**Functionality — English:**

> The user selects attachments from a locally chosen WhatsApp export and taps Save. chatStamp uses a dataSync foreground service to publish those selected files to Android shared storage or an explicitly selected folder, apply supported date metadata and verify each result. This is local file export with progress and Cancel controls, not a network transfer. It runs only for the requested save and stops after completion, cancellation or timeout cleanup.

**תיאור הפעולה — עברית:**

> המשתמש בוחר קבצים מתוך ייצוא WhatsApp מקומי ולוחץ על שמירה. chatStamp משתמשת בשירות dataSync בחזית כדי לשמור את הקבצים שנבחרו באחסון המשותף של אנדרואיד או בתיקייה שנבחרה במפורש, להחיל תאריכים כשניתן ולאמת כל תוצאה. זהו ייצוא קבצים מקומי עם התקדמות ואפשרות ביטול, ולא העברה ברשת. השירות פועל רק עבור השמירה שהתבקשה ונעצר לאחר השלמה, ביטול או ניקוי בעקבות מגבלת הזמן של המערכת.

**Impact of deferral/interruption — English:**

> Deferral prevents the export the user just requested from starting immediately. Interruption can leave only part of the selection saved. chatStamp preserves fully completed files, removes its incomplete pending output where cleanup succeeds, and reports saved, cancelled, failed and date-verified outcomes separately. Retained working files may allow a retry. The app does not promise automatic recovery after full process death.

**השפעת דחייה או הפסקה — עברית:**

> דחייה מונעת מהייצוא שהמשתמש ביקש להתחיל מיד. הפסקה עשויה להשאיר רק חלק מהקבצים שמורים. chatStamp משאירה קבצים שהושלמו, מסירה פלט חלקי שלה כשפעולת הניקוי מצליחה, ומציגה בנפרד קבצים שנשמרו, בוטלו, נכשלו ותאריכים שאומתו. קובצי עבודה שנשארו עשויים לאפשר ניסיון חוזר. אין הבטחה לשחזור אוטומטי אחרי סיום מלא של תהליך האפליקציה.

The [official FGS guidance](https://support.google.com/googleplay/android-developer/answer/13392821?hl=en) lists local import/export under dataSync. It requires functionality, deferral/interruption impact, use case and a video showing the triggering user action.

### Demonstration video script / תסריט סרטון הדגמה

The final demonstration is a **fresh actual minified code 11** recording at `dist/play/release-0.2.0-11/chatstamp-0.2.0-11-fgs-demo.mp4`, with synthetic content only. Duration/progress/hash: 8.25 s, 81,486 bytes, SHA256 `d319af658e5a35e16e7bea13ce0af8d74902f4bf12415f19efe60bcca29b7519`; actual live 1/4 notification and 4 saved/4 verified Results. It shows one real English foreground save, its Saving/Cancel control, the own live background notification and4saved/4verified Results. Cuts remove waiting/Home transitions; only the own notification rectangle remains in its original position with black elsewhere. No UI or progress is invented. Raw/full shade remain temporary and are removed after verification. **Reviewer video URL: https://meniviner.github.io/chatStamp/media/chatstamp-0.2.0-11-fgs-demo.mp4** — HTTP200/body hash verified and saved in the actual dataSync Local processing → Import/export declaration on2026-11-19. Code 9PNG screenshots remain explicitly code 9 captures of the unchanged UI; no old video is relabeled11.

| Step | English narration | קריינות בעברית |
| --- | --- | --- |
| 1 | “I choose this synthetic WhatsApp export and select its attachments.” Show the picker and selected files. | ״אני בוחר ייצוא WhatsApp לדוגמה ואת הקבצים מתוכו.״ להציג את הבורר ואת הבחירה. |
| 2 | “I tap Save to start a local export.” Keep the actual tap and progress visible. | ״אני לוחץ על שמירה כדי להתחיל ייצוא מקומי.״ להציג את הלחיצה ואת ההתקדמות. |
| 3 | “The save continues when I leave the app.” Press Home, open the notification shade and show changing progress plus Cancel. | ״השמירה ממשיכה גם כשאני יוצא מהאפליקציה.״ לעבור למסך הבית ולהציג בהתראה התקדמות וביטול. |
| 4 | “I return to the results.” Show actual saved/date-verified counts and the saved files. | ״אני חוזר לתוצאות.״ להציג את מספר הקבצים שנשמרו והתאריכים שאומתו ואת הקבצים עצמם. |
| Optional extended cancellation example (separately accepted in Stage C) | “I start another save and cancel it. Completed files remain; the rest are cancelled.” Show a fresh remaining-file run, Cancel, truthful partial results and no ongoing save notification. | ״אני מתחיל שמירה נוספת ומבטל אותה. הקבצים שהושלמו נשארים והיתר מבוטלים.״ להציג פעולה חדשה, ביטול, תוצאות חלקיות וסיום ההתראה. |

If one save finishes too quickly, use a larger synthetic fixture. Do not edit a completed run to look like background work or claim a notification-denied test that was not performed in this video.

## Current testing facts and production-access draft / מצב בדיקות ובקשת גישה לייצור

Current code 13 scope: 504 host/51 files, 126 Python, 59 fresh JVM and 52 connected each API 30/API 36, exact signed/static identity/authority checks, A30-HE and wide API 36-EN five-file independent dates, actual temporary-read transport and both source CI runs pass. Six standalone probe JVM cases also pass. Historical artifacts remain verifiable only with explicit expected identity/version; current defaults enforce the requested package and original production MainActivity namespace for QA.

Historical code 11 and explicitly earlier rebuild evidence is in [VERIFICATION.md](VERIFICATION.md): Samsung Galaxy A30 SM-A305F, Android 11/API 30, Samsung Gallery 12.1.09.1; Android 16/API 36 emulator. Synthetic cases covered five-file metadata/readback and Gallery order, duplicates, undated reporting, cold/warm Files shares, 128 MiB import/cache cleanup, background saving, cancellation and API 36 timeout/notification denial. Final F smoke: **497 host tests/50 files, 59 executed JVM tests, 52 connected tests on each API 30/API 36 device**, plus105 verification-tool tests. Fresh-checkout Android CI passed. Signed code 11 production/QA artifact checks and physical five-file date/Gallery checks passed; current runtime receipts state the exact scope. This is development QA, not a count of external closed-test participants or proof of their continuous opt-in period.

**English draft:**

> chatStamp is for Android users who want to save selected attachments from their own WhatsApp exports with message dates where supported. Development testing used synthetic exports on a physical API 30 Samsung and an API 36 emulator. Testing found misleading partial-save/history counts; these were corrected and regression-tested. Real owner WhatsApp exports, closed-test participant count, continuous opt-in dates, engagement, feedback and production readiness will be reported only after those checks occur.

**נוסח עברי:**

> chatStamp מיועדת למשתמשי אנדרואיד שרוצים לשמור קבצים שבחרו מייצוא WhatsApp שלהם עם תאריכי ההודעות כשניתן. בדיקות הפיתוח השתמשו בייצואים מלאכותיים במכשיר Samsung עם API 30 ובאמולטור API 36. בבדיקות נמצאו ספירות מטעות של שמירה חלקית ובהיסטוריה; הן תוקנו ונוספו בדיקות למניעת חזרה. תוצאות ייצוא WhatsApp אמיתי, מספר המשתתפים בבדיקה הסגורה, מועדי הצטרפות רצופים, שימוש, משוב ומוכנות להפצה יתועדו רק לאחר שייבדקו בפועל.

**Owner completion fields:** account creation date **UNKNOWN**; testers opted in **UNKNOWN**; qualifying continuous period **NOT STARTED / UNVERIFIED**; feedback **NOT YET COLLECTED**; owner real export **UNVERIFIED**. API 33 physical coverage is also unverified. Use [TESTERS.md](TESTERS.md) for invitations and an honest private tracking template. At G2 replace this draft with actual counts, dates, feedback, fixes and final candidate evidence; do not submit it as proof that the closed test already happened.

## G2 production-access answers — facts to complete before submission

These are answer inputs, not a completed closed-test claim. Do not submit the
application until the owner has actual Console eligibility and participant facts.
Use the final build/version and the private record in TESTERS.md.

| Application topic | English answer input | נוסח עברי להשלמה |
| --- | --- | --- |
| Recruitment and participants | Qualifying closed-test count, recruitment channel and opt-in interval are UNKNOWN. Owner: insert actual aggregate count, how people joined and continuous dates; address-list membership alone is not opt-in. | מספר הבודקים המזכים, אופן הגיוס ותקופת ההצטרפות אינם ידועים. יש להזין את מספר המשתתפים בפועל, איך הצטרפו ואת התאריכים הרצופים. רישום כתובת ברשימה אינו הצטרפות. |
| What was tested | Development QA covered synthetic exports on Samsung A30/API 30 and an API 36 emulator: original dates/Gallery, duplicates, streaming/cache, closed/warm Files shares, background/cancel/timeout, formats/one-player picker, three-step flow, EN/HE restart and accessibility. Owner's real WhatsApp exports and API 33 physical remain UNVERIFIED. Add actual closed-test devices, usage and cases separately. | בדיקות הפיתוח כללו ייצואים מלאכותיים ב-Samsung A30 עם API 30 ובאמולטור API 36: תאריכים וגלריה, כפילויות, ייבוא וניקוי, שיתוף מקבצים, שמירה ברקע וביטול, פורמטים ותצוגות מקדימות, שלושת השלבים, שפות ונגישות. ייצוא אמיתי ו-API 33 פיזי טרם אומתו. יש להוסיף בנפרד מכשירים, שימוש ובדיקות של המשתתפים בפועל. |
| Feedback and changes | No external closed-test feedback is recorded. Development testing drove actual fixes: MP4/EXIF dates, cancellation/history counts, 41 concurrent decoder/player baseline reduced to at most one, safe Save/settings/restart fencing and stale mixed-selection accessibility labels. Do not attribute these findings to unreported testers. Add genuine tester feedback, resulting changes and retest outcomes after collection. | אין משוב מתועד ממשתתפי בדיקה סגורה. בדיקות הפיתוח הובילו לתיקוני תאריכים, ספירות ביטול והיסטוריה, צמצום עומס נגני וידאו לנגן אחד, מניעת מרוצים בשמירה ובהפעלה מחדש ותיקון תוויות נגישות. אין לייחס ממצאים אלה לבודקים שלא דווחו. יש להוסיף משוב אמיתי, שינויים ובדיקה חוזרת לאחר שיתקבל. |
| Audience and value | Android11+ users saving selected attachments from their own WhatsApp exports locally, with supported original message-date handling and truthful verification. Owner chooses intended age groups, countries and pricing in the actual forms. | משתמשי אנדרואיד11 ומעלה שרוצים לשמור במכשיר קבצים שבחרו מייצוא WhatsApp שלהם, עם טיפול בתאריכי ההודעות כשניתן ודיווח אמיתי על אימות. בעל החשבון בוחר קבוצות גיל, מדינות ותמחור בטפסים. |
| Production readiness | Automated/native/development release checks are documented. Production readiness is not certified: complete real-export acceptance, remaining applicable device/provider checks and the actual closed-test requirement, then explain how genuine feedback and retests support readiness. | בדיקות הפיתוח והגרסה מתועדות. אין עדיין אישור למוכנות להפצה: יש להשלים ייצוא אמיתי, בדיקות מכשירים ויעדים רלוונטיים ודרישות בדיקה סגורה בפועל, ואז להסביר כיצד המשוב והבדיקות החוזרות תומכים במוכנות. |

## Official requirements checked 2026-11-18

| Requirement | Current constraint and source |
| --- | --- |
| Format | New apps use AAB; see [Play app bundles](https://support.google.com/googleplay/android-developer/answer/9844279?hl=en). Enroll/use Play App Signing and preserve the existing upload key. |
| Target API | Phone new apps and updates target API 36 from 31 Aug 2026; the extension ended 1 Nov 2026. [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en). |
| Native page size | API 35+ native apps must support 16 KiB on 64-bit devices. Current guidance names 1 Feb 2027 for blocking incompatible updates, differing from older November 2025 launch wording. The task still requires G1 alignment verification now. [Android page-size guide](https://developer.android.com/guide/practices/page-sizes). |
| Personal account testing | The new app's actual Console requires at least 12 testers continuously opted into closed testing for 14 days. Account creation date remains unknown; internal testing does not satisfy this observed gate, and eligibility is not automatic approval. [Personal-account test requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en). |
| Listing | Limits and current image requirements are linked in [store/play/README.md](../store/play/README.md). |

## Owner summary / סיכום לבעל החשבון

**English:** The new app is created and exact 13 is active internally; both listings/assets and Alpha are saved. Confirm the pending new IARC agreement, finish content rating and submit the prepared changes. Verify actual new Alpha availability before sending the authorized invitations, then record genuine opt-in/usage/feedback. Owner real-export and in-app browser acceptance remain separate. Do not request production access before the observed 12-tester/14-day gate is genuinely met.

**עברית:** הרשומה החדשה נוצרה וגרסה 13 פעילה בבדיקה הפנימית. שני דפי החנות, התמונות ומסלול Alpha נשמרו. נותר לאשר את הסכם IARC החדש, להשלים דירוג תוכן ולשלוח את השינויים המוכנים לבדיקה. לאחר אישור Google יש לאמת זמינות בפועל של הבדיקה הסגורה, לשלוח את ההזמנות שאושרו ולתעד הצטרפות, שימוש ומשוב אמיתיים. בדיקת ייצוא WhatsApp אמיתי ופתיחת מדיניות הפרטיות בדפדפן נשארות בנפרד. אין לבקש גישה להפצה לפני ש-12 בודקים השתתפו ברציפות למשך 14 ימים כנדרש.
