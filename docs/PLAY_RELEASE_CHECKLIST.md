# Google Play release checklist

Official requirements checked2026-11-18; artifact/runtime and Console checkpoint2026-11-20. Current candidate **0.2.1/versionCode15**, **com.menis10tec.chatstamp**, min30/target36. See [fresh report](../dist/play/direct-share-0.2.1-15-20261120/README.md) and [VERIFICATION.md](VERIFICATION.md).

New app **4975002762311404414**: internal15 available. Same AAB promoted to Alpha100% with EN/HE notes and both submission steps completed: **Changes in review**, quick checks running. Previous active closed14/178countries remains the confirmed baseline. All five lists preserved; no invitation resend or production-access request. Source45f2738 CI and full smoke pass; real owner export/physical15/Gallery order/16KiB runtime remain unverified.

## Release gates

- [x] Signed AAB at `dist/play/release-0.2.1-15/chatstamp-0.2.1-15.aab`; record actual SHA256, source commit and upload certificate fingerprint in the verification report. Reuse the established upload key via [external signing configuration](ANDROID_RELEASE_SIGNING.md). Never put keys or passwords in this repository.
- [x] `bundletool validate` passes. Inspect the final AAB/APKs for package/version, min 30/target 36, release signature, `debuggable=false`, R 8/minification and every delivered ABI. A successful Gradle task alone does not prove signing.
- [x] Check the final permission list: foreground service, dataSync and notifications are the intended app permissions; investigate generated library permissions. No Internet/network-state, broad storage/media-read, microphone, overlay, vibration or install-referrer permission. Verify backup and device-transfer exclusion in the merged release manifest/rules before publishing this privacy policy.
- [x] Inventory every bundled native library and its actual ELF class/machine. Require at least 16 KiB LOAD alignment and no RELRO concern on 64-bit arm64-v8a/x86_64; retain genuine 32-bit raw alignments with explicit policy NOT_APPLICABLE, without claiming 16 KiB compatibility. Confirm bundle config requests `PAGE_ALIGNMENT_16K`, and a universal APK passes `zipalign -c -P 16 -v 4`. Record any 16 KiB runtime smoke separately; static alignment does not prove it ran on a 16 KiB device.
- [x] Signed minified15 actual Android raw/ZIP cold/warm intake, no-grant recovery, Hebrew guide/font1.3/Back and3saved/1verified/0failed pass on the owner-selected API36 emulator; independent JPEG EXIF/MediaStore readback agrees. Real WhatsApp, physical15, fresh Gallery ordering and private discarded-byte inspection remain separate UNVERIFIED gates.
- [x] Existing bilingual listing, approved transparent icons, features and code-scoped screenshots retain their original provenance: four English screenshots and six Hebrew code14 split posters. No store artwork or launcher change in15.
- [ ] Public HTTPS policy freshly returns20November updated bilingual ZIP/separate-file text and approved support alias. Its Console URL is retained and in-app action exists; actual in-app browser rendering remains UNVERIFIED. URL: `https://meniviner.github.io/chatStamp/privacy-policy.html`.
- [x] New factual declarations, Free/Tools/18+, countries, support and verified FGS demo are saved.
- [x] New owner-approved IARC agreement and factual questionnaire completed; status Completed and seven regional ratings read back on 20 November.
- [x] Exact15 uploaded/processed; internal4701429810228968626 release3 available,20November16:14local. Same artifact promoted Alpha4699420811279917961/100% and submitted as one change: Changes in review, quick checks running.
- [x] All five Alpha lists freshly checked;20 unique assigned addresses received one private Bcc bilingual invitation, Gmail SENT/exact-recipient readback verified. Earlier creation/listing/IARC submission published with Alpha 13.
- [x] Previous closed14 active/178countries and the eligible closed route are documented. Closed15 availability is not claimed. Earlier Dashboard count1 remains historical; genuine12continuous testers/14days and production access remain unmet.

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
| Final rating | **Completed in the new entry on 20 November:** ClassInd All ages; ESRB Everyone; PEGI 3; USK All ages; IARC Generic, Russia and South Korea 3+. No content descriptors shown. / **הושלם ברשומה החדשה ב־20 בנובמבר:** כל הגילאים בברזיל ובגרמניה, כולם בצפון אמריקה, PEGI 3 באירופה ו־3+ בשאר האזורים המוצגים. לא הוצגו מתארי תוכן. |

The actual nine questions were answered from app behavior. [Google's User Content
guidance](https://support.google.com/googleplay/android-developer/answer/11070862?hl=en)
excludes sharing performed through secondary apps; [Online Content guidance](https://support.google.com/googleplay/android-developer/answer/11070055?hl=en)
excludes content privately imported by users. No hosted communications, promoted
online catalog, purchases, location-sharing, rewards, browser/search or news/education
feature is introduced. The 18+ audience choice does not change the generated ratings.

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

The final demonstration is a **fresh actual minified code 11** recording at `dist/play/release-0.2.0-11/chatstamp-0.2.0-11-fgs-demo.mp4`, with synthetic content only. Duration/progress/hash: 8.25 s, 81,486 bytes, SHA256 `d319af658e5a35e16e7bea13ce0af8d74902f4bf12415f19efe60bcca29b7519`; actual live 1/4 notification and 4 saved/4 verified Results. It shows one real English foreground save, its Saving/Cancel control, the own live background notification and 4 saved/4 verified Results. Cuts remove waiting/Home transitions; only the own notification rectangle remains in its original position with black elsewhere. No UI or progress is invented. Raw/full shade remain temporary and are removed after verification. **Reviewer video URL: https://meniviner.github.io/chatStamp/media/chatstamp-0.2.0-11-fgs-demo.mp4** — HTTP 200/body hash verified and saved in the actual dataSync Local processing → Import/export declaration on 2026-11-19. Code 9 PNG screenshots retain that provenance; Selection differs in 14. Saving behavior is unchanged; no old image/video is relabeled as 14.

| Step | English narration | קריינות בעברית |
| --- | --- | --- |
| 1 | “I choose this synthetic WhatsApp export and select its attachments.” Show the picker and selected files. | ״אני בוחר ייצוא WhatsApp לדוגמה ואת הקבצים מתוכו.״ להציג את הבורר ואת הבחירה. |
| 2 | “I tap Save to start a local export.” Keep the actual tap and progress visible. | ״אני לוחץ על שמירה כדי להתחיל ייצוא מקומי.״ להציג את הלחיצה ואת ההתקדמות. |
| 3 | “The save continues when I leave the app.” Press Home, open the notification shade and show changing progress plus Cancel. | ״השמירה ממשיכה גם כשאני יוצא מהאפליקציה.״ לעבור למסך הבית ולהציג בהתראה התקדמות וביטול. |
| 4 | “I return to the results.” Show actual saved/date-verified counts and the saved files. | ״אני חוזר לתוצאות.״ להציג את מספר הקבצים שנשמרו והתאריכים שאומתו ואת הקבצים עצמם. |
| Optional extended cancellation example (separately accepted in Stage C) | “I start another save and cancel it. Completed files remain; the rest are cancelled.” Show a fresh remaining-file run, Cancel, truthful partial results and no ongoing save notification. | ״אני מתחיל שמירה נוספת ומבטל אותה. הקבצים שהושלמו נשארים והיתר מבוטלים.״ להציג פעולה חדשה, ביטול, תוצאות חלקיות וסיום ההתראה. |

If one save finishes too quickly, use a larger synthetic fixture. Do not edit a completed run to look like background work or claim a notification-denied test that was not performed in this video.

## Current testing facts and production-access draft / מצב בדיקות ובקשת גישה לייצור

Current15 scope:605 host/58files,127 Python,59 fresh JVM,72 connected API36; strict signed artifact checks; exact-source Android CI44748707957 success; synthetic Android actual-share-sheet raw/ZIP cold/warm intake, guide/RTL and independent three-file save/date scope pass. Earlier code14 physical/bounded-reader/five-file cases retain their original scope. Real WhatsApp/physical15/Gallery order/16KiB runtime and minified private discarded bytes remain unverified.

Historical code 11 and explicitly earlier rebuild evidence is in [VERIFICATION.md](VERIFICATION.md): Samsung Galaxy A30 SM-A305 F, Android 11/API 30, Samsung Gallery 12.1.09.1; Android 16/API 36 emulator. Synthetic cases covered five-file metadata/readback and Gallery order, duplicates, undated reporting, cold/warm Files shares, 128 MiB import/cache cleanup, background saving, cancellation and API 36 timeout/notification denial. Final F smoke: **497 host tests/50 files, 59 executed JVM tests, 52 connected tests on each API 30/API 36 device**, plus 105 verification-tool tests. Fresh-checkout Android CI passed. Signed code 11 production/QA artifact checks and physical five-file date/Gallery checks passed; current runtime receipts state the exact scope. This is development QA, not a count of external closed-test participants or proof of their continuous opt-in period.

**English draft:**

> chatStamp is for Android users who want to save selected attachments from their own WhatsApp exports with message dates where supported. Development testing used synthetic exports on a physical API 30 Samsung and an API 36 emulator. Testing found misleading partial-save/history counts; these were corrected and regression-tested. Real owner WhatsApp exports, closed-test participant count, continuous opt-in dates, engagement, feedback and production readiness will be reported only after those checks occur.

**נוסח עברי:**

> chatStamp מיועדת למשתמשי אנדרואיד שרוצים לשמור קבצים שבחרו מייצוא WhatsApp שלהם עם תאריכי ההודעות כשניתן. בדיקות הפיתוח השתמשו בייצואים מלאכותיים במכשיר Samsung עם API 30 ובאמולטור API 36. בבדיקות נמצאו ספירות מטעות של שמירה חלקית ובהיסטוריה; הן תוקנו ונוספו בדיקות למניעת חזרה. תוצאות ייצוא WhatsApp אמיתי, מספר המשתתפים בבדיקה הסגורה, מועדי הצטרפות רצופים, שימוש, משוב ומוכנות להפצה יתועדו רק לאחר שייבדקו בפועל.

**Owner completion fields:** account creation date **UNKNOWN**; Dashboard opted-in count **1 at 20 Novembercheckpoint**; qualifying 12 tester continuous period **UNVERIFIED**; feedback **NOT YET COLLECTED**; owner real export **UNVERIFIED**. API 33 physical coverage is also unverified. Use [TESTERS.md](TESTERS.md) for invitations and an honest private tracking template. At G 2 replace this draft with actual counts, dates, feedback, fixes and final candidate evidence; do not submit it as proof that the closed test already happened.

## G 2 production-access answers — facts to complete before submission

These are answer inputs, not a completed closed-test claim. Do not submit the
application until the owner has actual Console eligibility and participant facts.
Use the final build/version and the private record in TESTERS.md.

| Application topic | English answer input | נוסח עברי להשלמה |
| --- | --- | --- |
| Recruitment and participants | Qualifying closed-test count, recruitment channel and opt-in interval are UNKNOWN. Owner: insert actual aggregate count, how people joined and continuous dates; address-list membership alone is not opt-in. | מספר הבודקים המזכים, אופן הגיוס ותקופת ההצטרפות אינם ידועים. יש להזין את מספר המשתתפים בפועל, איך הצטרפו ואת התאריכים הרצופים. רישום כתובת ברשימה אינו הצטרפות. |
| What was tested | Development QA covered synthetic exports on Samsung A30/API 30 and an API 36 emulator: original dates/Gallery, duplicates, streaming/cache, closed/warm Files shares, background/cancel/timeout, formats/one-player picker, three-step flow, EN/HE restart and accessibility. Owner's real WhatsApp exports and API 33 physical remain UNVERIFIED. Add actual closed-test devices, usage and cases separately. | בדיקות הפיתוח כללו ייצואים מלאכותיים ב-Samsung A30 עם API 30 ובאמולטור API 36: תאריכים וגלריה, כפילויות, ייבוא וניקוי, שיתוף מקבצים, שמירה ברקע וביטול, פורמטים ותצוגות מקדימות, שלושת השלבים, שפות ונגישות. ייצוא אמיתי ו-API 33 פיזי טרם אומתו. יש להוסיף בנפרד מכשירים, שימוש ובדיקות של המשתתפים בפועל. |
| Feedback and changes | No external closed-test feedback is recorded. Development testing drove actual fixes: MP 4/EXIF dates, cancellation/history counts, 41 concurrent decoder/player baseline reduced to at most one, safe Save/settings/restart fencing and stale mixed-selection accessibility labels. Do not attribute these findings to unreported testers. Add genuine tester feedback, resulting changes and retest outcomes after collection. | אין משוב מתועד ממשתתפי בדיקה סגורה. בדיקות הפיתוח הובילו לתיקוני תאריכים, ספירות ביטול והיסטוריה, צמצום עומס נגני וידאו לנגן אחד, מניעת מרוצים בשמירה ובהפעלה מחדש ותיקון תוויות נגישות. אין לייחס ממצאים אלה לבודקים שלא דווחו. יש להוסיף משוב אמיתי, שינויים ובדיקה חוזרת לאחר שיתקבל. |
| Audience and value | Android 11+ users saving selected attachments from their own WhatsApp exports locally, with supported original message-date handling and truthful verification. Owner chooses intended age groups, countries and pricing in the actual forms. | משתמשי אנדרואיד11 ומעלה שרוצים לשמור במכשיר קבצים שבחרו מייצוא WhatsApp שלהם, עם טיפול בתאריכי ההודעות כשניתן ודיווח אמיתי על אימות. בעל החשבון בוחר קבוצות גיל, מדינות ותמחור בטפסים. |
| Production readiness | Automated/native/development release checks are documented. Production readiness is not certified: complete real-export acceptance, remaining applicable device/provider checks and the actual closed-test requirement, then explain how genuine feedback and retests support readiness. | בדיקות הפיתוח והגרסה מתועדות. אין עדיין אישור למוכנות להפצה: יש להשלים ייצוא אמיתי, בדיקות מכשירים ויעדים רלוונטיים ודרישות בדיקה סגורה בפועל, ואז להסביר כיצד המשוב והבדיקות החוזרות תומכים במוכנות. |

## Official requirements checked 2026-11-18

| Requirement | Current constraint and source |
| --- | --- |
| Format | New apps use AAB; see [Play app bundles](https://support.google.com/googleplay/android-developer/answer/9844279?hl=en). Enroll/use Play App Signing and preserve the existing upload key. |
| Target API | Phone new apps and updates target API 36 from 31 Aug 2026; the extension ended 1 Nov 2026. [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en). |
| Native page size | API 35+ native apps must support 16 KiB on 64-bit devices. Current guidance names 1 Feb 2027 for blocking incompatible updates, differing from older November 2025 launch wording. The task still requires G 1 alignment verification now. [Android page-size guide](https://developer.android.com/guide/practices/page-sizes). |
| Personal account testing | The new app's actual Console requires at least 12 testers continuously opted into closed testing for 14 days. Account creation date remains unknown; internal testing does not satisfy this observed gate, and eligibility is not automatic approval. [Personal-account test requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en). |
| Listing | Limits and current image requirements are linked in [store/play/README.md](../store/play/README.md). |

## Owner summary / סיכום לבעל החשבון

**English:** Internal15 is available; the same artifact is submitted/in review for closed Alpha. Previous active closed14 and existing five lists are retained. No new invitations or production request. Real WhatsApp/owner-export acceptance and genuine tester participation remain separate requirements.

**עברית:** גרסה15 זמינה במסלול הפנימי, ואותה חבילה נשלחה לבדיקה עבור Alpha. גרסה14 היא הגרסה הסגורה הפעילה האחרונה שאומתה. חמש הרשימות נשמרו; לא נשלחו הזמנות חוזרות ולא הוגשה בקשת הפצה. ייצוא WhatsApp אמיתי והשתתפות בודקים אמיתית עדיין דורשים אימות נפרד.
