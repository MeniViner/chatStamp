# Closed-test invitations and owner test record

Prepared **2026-11-18**. No tester count, opt-in period, live Play release or owner real-export result has been verified. The personal account's creation date is unknown. Plan for at least 12 testers continuously opted into closed testing for 14 days; the exact applicability and eligibility must be confirmed by the owner in Console. Internal testing does not satisfy that requirement. [Official personal-account requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).

## Owner setup

1. Follow [PLAY_UPLOAD_STEPS.md](PLAY_UPLOAD_STEPS.md) to make the closed track available. Add the volunteers' Google Account addresses to the selected list privately. The list is not proof of opt-in.
2. Copy the actual closed opt-in URL from Console into **`[CLOSED_TEST_OPT_IN_URL]`** in the invitations below before sending. No live URL is asserted. If using a Google Group, provide its real join link too. Send the invitation yourself; no messages have been sent by the agent.
3. Ask testers to use the listed Google Account, leave any internal test for this app, join the group first if applicable, opt into the closed test, then install from its Play link. Ask them to remain opted in for the full period, use the app meaningfully and give honest feedback. Neither installation nor an email-list entry replaces continuous opt-in. See [official tester setup](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en).

## English invitation — replace the URL before sending

Hi! I’m looking for volunteers to test chatStamp on Android 11 or later. It imports a WhatsApp export ZIP and saves selected attachments, using message dates where the format and Gallery support them. It processes files on the phone, without an account, ads or uploads by chatStamp.

Please open **[CLOSED_TEST_OPT_IN_URL]** using the Google Account you gave me, choose Join/Become a tester, and install through the Play link. If you were in the internal test, leave it first. Please stay opted into this closed test for at least 14 continuous days and try the app during that time. You can leave whenever you choose; tell me if you leave so I can keep the test record accurate.

Try importing through Files and sharing a ZIP while chatStamp is closed and open. Select a few photos/videos, save, and compare their dates with the chat and your Gallery. Try English/Hebrew, saving in the background, cancelling a larger save and importing the same export again. Please report what worked or failed, device/Android version, app version and steps to **meniviner@gmail.com** or private Play feedback. Use a synthetic or non-sensitive export first. Never send me your private chat ZIP, photos, names or message contents as a bug report. Screenshots should show synthetic data or have private details removed.

This is a test build. Date support varies by file/provider/Gallery, and a file can save without a verified date. Keep your originals and check results. Thank you!

## הזמנה בעברית — יש להחליף את הקישור לפני השליחה

היי! אני מחפש מתנדבים לבדיקת chatStamp באנדרואיד 11 ומעלה. האפליקציה מייבאת קובץ ZIP של ייצוא WhatsApp ושומרת קבצים שנבחרו, עם תאריכי ההודעות כשהקובץ והגלריה תומכים בכך. העיבוד נעשה בטלפון, ללא חשבון, פרסומות או העלאה על ידי chatStamp.

יש לפתוח את **[CLOSED_TEST_OPT_IN_URL]** עם חשבון Google שמסרת לי, לבחור בהצטרפות לבדיקה ולהתקין דרך הקישור ל-Play. אם הצטרפת קודם לבדיקה הפנימית, יש לצאת ממנה תחילה. אשמח שתישארו רשומים לבדיקה הסגורה לפחות 14 ימים רצופים ותנסו את האפליקציה בתקופה הזאת. אפשר לפרוש בכל רגע; אם פורשים, כדאי לעדכן אותי כדי שאוכל לתעד את הבדיקה במדויק.

כדאי לנסות ייבוא דרך הקבצים ושיתוף ZIP כשהאפליקציה סגורה וכשהיא פתוחה. לבחור כמה תמונות וסרטונים, לשמור ולהשוות את התאריכים לשיחה ולגלריה. כדאי לבדוק עברית ואנגלית, שמירה ברקע, ביטול שמירה גדולה וייבוא חוזר של אותו ייצוא. אפשר לשלוח ל-**meniviner@gmail.com** או דרך המשוב הפרטי ב-Play מה עבד ומה נכשל, דגם מכשיר, גרסת אנדרואיד, גרסת האפליקציה ושלבי שחזור. כדאי להתחיל בייצוא מלאכותי או לא רגיש. אין לשלוח לי קובץ שיחה פרטי, תמונות, שמות או תוכן הודעות כחלק מדיווח תקלה. בצילומי מסך יש להשתמש במידע מלאכותי או להסיר פרטים אישיים.

זו גרסת בדיקה. התמיכה בתאריכים משתנה לפי הקובץ, ספק האחסון והגלריה, וקובץ עשוי להישמר בלי שהתאריך אומת. יש לשמור את המקור ולבדוק את התוצאות. תודה!

## Suggested tests and feedback / בדיקות ומשוב

| Check | What to observe / מה לבדוק |
| --- | --- |
| Import and share | Picker import; Files/WhatsApp share into closed and open app; one import per share. / ייבוא דרך הבורר ושיתוף לאפליקציה סגורה ופתוחה, ללא ייבוא כפול. |
| Selection and language | Correct filenames/sender filtering, English/Hebrew and readable RTL. / שמות קבצים וסינון לפי שולח, אנגלית ועברית ותצוגה קריאה מימין לשמאל. |
| Save and dates | Actual saved count; verified versus unavailable dates; Gallery default order/details compared with known message dates. / כמות שנשמרה בפועל, תאריכים שאומתו מול תאריכים חסרים, והשוואת הסדר והפרטים בגלריה לתאריכי ההודעות. |
| Background and cancel | Start a fresh save, leave the app, return; cancel another sufficiently long run. Completed files stay intact; partial/cancelled counts are truthful. / שמירה חדשה ברקע וחזרה לתוצאות, ואז ביטול פעולה ארוכה. קבצים שהושלמו נשארים והספירות מדויקות. |
| Duplicate and cleanup | Reimport with Skip existing; check no extra copies and discard/clear cache. / ייבוא חוזר עם דילוג על קיימים, ללא עותקים נוספים, וניקוי המטמון. |

Report expected/actual behavior, steps, version, device/Android, language and whether the issue repeats. Do not claim tests you did not run. / יש לדווח מה ציפיתם שיקרה ומה קרה, שלבים, גרסה, מכשיר, שפה והאם התקלה חוזרת. אין לדווח על בדיקה שלא בוצעה.

## Owner real-export acceptance — still UNVERIFIED

The owner must export a real WhatsApp chat **with media** whose message dates are known. Keep the export and all personal proof outside Git and public evidence.

1. In WhatsApp export/share to chatStamp once while chatStamp is closed and once while it is already open. Confirm each share starts one import and the expected attachments/senders appear.
2. Select a few known photo/video messages. Start Save without granting broad storage permission; use the relevant message-date preference explicitly. Compare saved count and per-file verification with the source conversation.
3. In Samsung Gallery use the default creation-date order and inspect Details. Confirm order and displayed dates match the known messages. If anything differs, record the exact format and observed date; do not call all files corrected.
4. Repeat with Skip existing and confirm no duplicate file/folder. Discard/reset and relaunch; verify private import working files are gone. Delete only the test's saved outputs when no longer wanted, keeping the original export safe.
5. Record PASS/FAIL, date, candidate/version, device/Gallery version, formats, date preference and a redacted result summary. Do not upload the actual export. Until this happens, keep the result **UNVERIFIED**.

**לבעל החשבון:** יש לייצא מ-WhatsApp שיחה אמיתית עם מדיה ותאריכים מוכרים, לשתף כשהאפליקציה סגורה ופתוחה, לשמור קבצים נבחרים ללא הרשאת אחסון גורפת, ולהשוות את סדר ברירת המחדל ופרטי התאריך בגלריה לשיחה. יש לבדוק גם דילוג על קיימים וניקוי קובצי עבודה. שומרים את הייצוא ואת המידע האישי מחוץ ל-Git, ומתעדים רק סיכום ללא פרטים מזהים. התוצאה עדיין **לא אומתה**.

## Private owner record — template, not completed evidence

Keep this record outside the repository. Do not commit participant identities or addresses. Publish aggregate facts only after verification.

- Account category: personal; creation date: **UNKNOWN**.
- Candidate/version and closed track: **UNVERIFIED**.
- Closed opt-in URL and date track became available: **UNVERIFIED**.
- Per volunteer: private identifier, Google Account, actual opt-in date/time, any opt-out, installation/version, device/Android, checks performed and feedback.
- Qualifying continuously opted-in count: **UNKNOWN**. Fourteen-day qualifying interval: **UNVERIFIED**.
- Feedback received, changes made, retest results, outstanding issues: **NOT YET COLLECTED**.
- Owner real-export result: **UNVERIFIED**. Production-access application submitted/approved: **NOT VERIFIED**.

Use the owner record plus actual Console eligibility when completing the production-access answers in [PLAY_RELEASE_CHECKLIST.md](PLAY_RELEASE_CHECKLIST.md). Automated development test counts are separate from people participating in the closed test.
