# Google Play release checklist

Prepared and official requirements checked: **2026-11-18**. G1 candidate: **0.2.0 / versionCode 3**, package **`com.menis.chatstamp`**, min SDK **30**, target SDK **36**. Each later upload needs a higher versionCode. Use the latest verified candidate recorded in [VERIFICATION.md](VERIFICATION.md); these documents do not certify an artifact or a Play rollout.

The account is personal; its creation date is **UNKNOWN — owner must confirm**. No Play service-account credential was provided for G1. No upload, closed-test enrollment or production access is asserted here. The privacy policy was published and anonymously verified HTTP200 on2026-11-18 from `fix/core-rebuild /docs`; its body matches the tracked HTML. Use [the manual upload steps](PLAY_UPLOAD_STEPS.md). Public privacy/support contact chosen by the owner: **meniviner@gmail.com**.

## Release gates

- [x] Signed AAB at `dist/play/chatstamp-0.2.0-3.aab`; record actual SHA256, source commit and upload certificate fingerprint in the verification report. Reuse the established upload key via [external signing configuration](ANDROID_RELEASE_SIGNING.md). Never put keys or passwords in this repository.
- [x] `bundletool validate` passes. Inspect the final AAB/APKs for package/version, min30/target36, release signature, `debuggable=false`, R8/minification and every delivered ABI. A successful Gradle task alone does not prove signing.
- [x] Check the final permission list: foreground service, dataSync and notifications are the intended app permissions; investigate generated library permissions. No Internet/network-state, broad storage/media-read, microphone, overlay, vibration or install-referrer permission. Verify backup and device-transfer exclusion in the merged release manifest/rules before publishing this privacy policy.
- [x] Inventory every bundled native library and its actual ELF class/machine. Require at least16KiB LOAD alignment and no RELRO concern on64-bit arm64-v8a/x86_64; retain genuine32-bit raw alignments with explicit policy NOT_APPLICABLE, without claiming16KiB compatibility. Confirm bundle config requests `PAGE_ALIGNMENT_16K`, and a universal APK passes `zipalign -c -P 16 -v 4`. Record any 16 KiB runtime smoke separately; static alignment does not prove it ran on a 16 KiB device.
- [x] Minified release installed under the permitted production/QA identity, launched, and passed the five-file save plus Gallery regression. Existing debug QA coverage does not replace this check.
- [x] `store/play/` contains both listing languages, icon, feature graphic and four actual-phone synthetic screenshots per language. Check formats/dimensions against [its README](../store/play/README.md).
- [x] Privacy page publicly returns the policy over HTTPS without login. Add its URL in Console **and inside the app**; verify the in-app Privacy policy action is accessible and opens it. Expected URL: `https://meniviner.github.io/chatStamp/privacy-policy.html` — **PUBLIC: HTTP200 verified2026-11-18; installed action launches Chrome; page rendering UNVERIFIED because browser setup blocks it**.
- [ ] Owner completed App content declarations below, verified intended audience/countries/pricing, and provided an accessible FGS demonstration-video link. The private/local video path is not a valid Console link.
- [ ] Internal and closed tracks show the intended version as available; record the actual track status and opt-in URLs after Console confirmation. A draft or submitted review is not a live test.

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

## Content rating and audience — owner-only / דירוג תוכן וקהל יעד — בעל החשבון בלבד

| Questionnaire area | Facts available for the owner / מידע לבעל החשבון |
| --- | --- |
| Rating contact and category | Contact `meniviner@gmail.com`; utility/app, not a game. / כתובת לפניות: `meniviner@gmail.com`; כלי שימושי, לא משחק. |
| Developer-provided content | No developer-provided violence, sexual content, gambling, controlled-substance promotion or real-money transactions. Imported private files can contain arbitrary user-selected content. / אין תוכן כזה מטעם המפתח או עסקאות בכסף אמיתי. קבצים פרטיים שהמשתמש מייבא עשויים להכיל כל תוכן. |
| User interaction/content | Local previews and user-started Android sharing; no hosted public feed, chat service, matchmaking or online community. Answer the form's exact user-generated-content/file-access questions using this distinction. / תצוגה מקומית ושיתוף ביוזמת המשתמש דרך אנדרואיד; אין פיד ציבורי, שירות צ׳אט או קהילה מקוונת. יש לענות לפי הניסוח המדויק בטופס. |
| Intended age groups | **OWNER TO CHOOSE.** Do not infer an age group or Families eligibility from this technical checklist. / **לבחירת בעל החשבון.** אין להסיק מהמסמך קבוצת גיל או התאמה לתוכנית המשפחות. |
| Final rating | **UNKNOWN until the rating questionnaire is completed.** No ESRB/PEGI rating is promised. / **לא ידוע עד להשלמת השאלון.** אין התחייבות לדירוג גיל מסוים. |

Owner must also confirm free/paid status, distribution countries, official developer identity and all legal declarations. The app has no news, health, financial or government-service feature; answer any related category form according to the actual app. [Play review preparation](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en) explains the required App content sections and the public, in-app-linked privacy page.

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

Record the actual final minified candidate on the phone with synthetic content only. Keep raw capture temporary; package only the privacy-safe demo under ignored `dist/play/`, outside the curated evidence folder. Do not upload personal chats, notification contents, account identifiers or credentials. The owner must publish an accessible reviewer link and verify it while signed out. **G1 recording:** `dist/play/chatstamp-0.2.0-3-fgs-demo.mp4` (14.4s, synthetic, minified QA0.2.0/code3). It shows the Save trigger, actual progress/Cancel, the live notification while Launcher is foreground, and4saved/4verified results. Cuts omit Home transitions; only the chatStamp notification is cropped into its original screen frame to exclude unrelated private notifications. **Video URL: NOT PUBLISHED; owner must publish an accessible reviewer link.** Replace with final UI candidate after Stage E.

| Step | English narration | קריינות בעברית |
| --- | --- | --- |
| 1 | “I choose this synthetic WhatsApp export and select its attachments.” Show the picker and selected files. | ״אני בוחר ייצוא WhatsApp לדוגמה ואת הקבצים מתוכו.״ להציג את הבורר ואת הבחירה. |
| 2 | “I tap Save to start a local export.” Keep the actual tap and progress visible. | ״אני לוחץ על שמירה כדי להתחיל ייצוא מקומי.״ להציג את הלחיצה ואת ההתקדמות. |
| 3 | “The save continues when I leave the app.” Press Home, open the notification shade and show changing progress plus Cancel. | ״השמירה ממשיכה גם כשאני יוצא מהאפליקציה.״ לעבור למסך הבית ולהציג בהתראה התקדמות וביטול. |
| 4 | “I return to the results.” Show actual saved/date-verified counts and the saved files. | ״אני חוזר לתוצאות.״ להציג את מספר הקבצים שנשמרו והתאריכים שאומתו ואת הקבצים עצמם. |
| Optional extended cancellation example (separately accepted in Stage C) | “I start another save and cancel it. Completed files remain; the rest are cancelled.” Show a fresh remaining-file run, Cancel, truthful partial results and no ongoing save notification. | ״אני מתחיל שמירה נוספת ומבטל אותה. הקבצים שהושלמו נשארים והיתר מבוטלים.״ להציג פעולה חדשה, ביטול, תוצאות חלקיות וסיום ההתראה. |

If one save finishes too quickly, use a larger synthetic fixture. Do not edit a completed run to look like background work or claim a notification-denied test that was not performed in this video.

## Current testing facts and production-access draft / מצב בדיקות ובקשת גישה לייצור

Accepted rebuild evidence is in [VERIFICATION.md](VERIFICATION.md): Samsung Galaxy A30 SM-A305F, Android 11/API 30, Samsung Gallery 12.1.09.1; Android 16/API 36 emulator. Synthetic cases covered five-file metadata/readback and Gallery order, duplicates, undated reporting, cold/warm Files shares, 128 MiB import/cache cleanup, background saving, cancellation and API 36 timeout/notification denial. Latest accepted C smoke: **222 host tests, 23 JVM tests, 10 connected tests on each device**. This is development QA, not a claim of external closed-test participation or a final minified release result.

**English draft:**

> chatStamp is for Android users who want to save selected attachments from their own WhatsApp exports with message dates where supported. Development testing used synthetic exports on a physical API 30 Samsung and an API 36 emulator. Testing found misleading partial-save/history counts; these were corrected and regression-tested. Real owner WhatsApp exports, closed-test participant count, continuous opt-in dates, engagement, feedback and production readiness will be reported only after those checks occur.

**נוסח עברי:**

> chatStamp מיועדת למשתמשי אנדרואיד שרוצים לשמור קבצים שבחרו מייצוא WhatsApp שלהם עם תאריכי ההודעות כשניתן. בדיקות הפיתוח השתמשו בייצואים מלאכותיים במכשיר Samsung עם API30 ובאמולטור API36. בבדיקות נמצאו ספירות מטעות של שמירה חלקית ובהיסטוריה; הן תוקנו ונוספו בדיקות למניעת חזרה. תוצאות ייצוא WhatsApp אמיתי, מספר המשתתפים בבדיקה הסגורה, מועדי הצטרפות רצופים, שימוש, משוב ומוכנות להפצה יתועדו רק לאחר שייבדקו בפועל.

**Owner completion fields:** account creation date **UNKNOWN**; testers opted in **UNKNOWN**; qualifying continuous period **NOT STARTED / UNVERIFIED**; feedback **NOT YET COLLECTED**; owner real export **UNVERIFIED**. API 33 physical coverage is also unverified. Use [TESTERS.md](TESTERS.md) for invitations and an honest private tracking template. At G2 replace this draft with actual counts, dates, feedback, fixes and final candidate evidence; do not submit it as proof that the closed test already happened.

## Official requirements checked 2026-11-18

| Requirement | Current constraint and source |
| --- | --- |
| Format | New apps use AAB; see [Play app bundles](https://support.google.com/googleplay/android-developer/answer/9844279?hl=en). Enroll/use Play App Signing and preserve the existing upload key. |
| Target API | Phone new apps and updates target API 36 from 31 Aug 2026; the extension ended 1 Nov 2026. [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en). |
| Native page size | API 35+ native apps must support 16 KiB on 64-bit devices. Current guidance names 1 Feb 2027 for blocking incompatible updates, differing from older November 2025 launch wording. The task still requires G1 alignment verification now. [Android page-size guide](https://developer.android.com/guide/practices/page-sizes). |
| Personal account testing | For accounts created after 13 Nov 2023: at least 12 testers continuously opted into closed testing for the 14 days immediately before applying. Internal testing does not count toward that gate; eligibility permits an application, not automatic approval. Plan for this until the owner confirms applicability. [Personal-account test requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en). |
| Listing | Limits and current image requirements are linked in [store/play/README.md](../store/play/README.md). |

## Owner summary / סיכום לבעל החשבון

**English:** Verify the already published privacy page and its in-app action, confirm the audience and account date, complete the declarations, publish the synthetic FGS demo, manually upload the verified candidate to internal then closed testing, invite testers and record real opt-in/feedback evidence. Do not request production access before its actual testing gate is met.

**עברית:** עמוד הפרטיות פורסם ואומת; יש לבדוק את הכפתור באפליקציה, לאשר את קהל היעד ואת מועד פתיחת החשבון, להשלים הצהרות, לפרסם סרטון הדגמה עם מידע מלאכותי, להעלות ידנית את הגרסה המאומתת לבדיקה פנימית ולאחר מכן סגורה, להזמין בודקים ולתעד הצטרפות ומשוב אמיתיים. אין לבקש גישה להפצה לפני שדרישות הבדיקה התקיימו בפועל.
