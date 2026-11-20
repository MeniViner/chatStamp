# סמלי החנות — chatStamp וטנק מלא

עודכן ב־20 בנובמבר 2026 לפי אישור הבעלים והבקשה להסיר את העלים מ־chatStamp בלבד.

שני האייקונים הוחלפו ב־Play Console, נשמרו ונשלחו ל־Google. בשתי האפליקציות הסטטוס בסיום הוא **השינויים בבדיקה**. הופעתם לציבור עדיין לא אומתה.

| אפליקציה | קובץ סופי | תוצאה |
| --- | --- | --- |
| chatStamp — com.menis10tec.chatstamp | [PNG שקוף ללא העלים](chatstamp-icon-transparent.png) | נשמר ונפתח מחדש באנגלית ובעברית |
| טנק מלא — com.meniviner.tankmalle | [PNG שקוף](tank-malle-icon-transparent.png) | נשמר ונפתח מחדש בעברית, שפת ברירת המחדל והיחידה המוגדרת |

שני הקבצים בגודל 512×512, בפורמט PNG עם sRGB ו־RGBA של 32 ביט. השקיפות אמיתית; היא נשמרה גם בייצוא לחנות. Google Play מציגה מאחורי האיור את רקע החנות, ומוסיפה בעצמה את מסגרת התצוגה והצל שלה. [מפרט Google Play](https://developer.android.com/distribute/google-play/resources/icon-design-specifications).

הבאנרים, צילומי המסך, סדר התמונות וכל הטקסטים נשארו זהים — נבדקו שמות הקבצים וכתובות המקור לאחר שמירה וטעינה מחדש. לא נבנה ולא הועלה AAB חדש. האייקון המותקן בתוך האפליקציות לא השתנה במסגרת עדכון סמלי החנות הזה. כתובת התמיכה המעודכנת מהשלב הקודם נשארה כפי שהיא.

התמונות נערכו בכלי image_gen המובנה. [הפרומפטים המדויקים](source/generation-prompts.md), שני קובצי המקור, [כלי הייצוא ששומר שקיפות](source/export-transparent-icons.swift) ו[בדיקות הפורמט והחתימות](asset-checks.json) מרוכזים כאן. בדיקת Test author עברה ובדיקת Reviewer הסתיימה ללא ממצאים. העיצוב נבדק על רקע בהיר וכהה.

צילומי הקונסול והאישורים הקצרים נשארים מקומיים בלבד בתיקיית [owner-proof](owner-proof/):

- [chatStamp בעברית — האייקון שנשמר](owner-proof/chatstamp-icon-he-saved.jpg)
- [טנק מלא — האייקון שנשמר](owner-proof/tank-icon-saved.jpg)
- [chatStamp — השינוי בבדיקה](owner-proof/chatstamp-icon-in-review.jpg)
- [טנק מלא — השינוי בבדיקה](owner-proof/tank-icon-in-review.jpg)
- [רישום האימות](owner-proof/console-receipt.md)

כל הקבצים החדשים מרוכזים בתיקייה זו. קובץ החנות הקנוני store/play/icon.png תואם לאייקון chatStamp הסופי. אין שינוי בקוד האפליקציה, באייקון ההפעלה המקומי או במאגר טנק מלא. PR #1 נשאר פתוח ולא מוזג.
