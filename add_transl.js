const fs = require('fs');

const enPath = './src/i18n/locales/en.json';
const hePath = './src/i18n/locales/he.json';

const newTranslations = {
  "fileSelection": {
    "title": "Choose Media",
    "subtitle": "{{matched}} matched files • {{selectedSenders}}/{{totalSenders}} senders",
    "footerSelected": "{{selected}} selected • {{photos}} photos • {{videos}} videos • {{other}} other",
    "continue": "Continue",
    "photos": "Photos",
    "videos": "Videos",
    "other": "Other",
    "all": "All",
    "searchPlaceholder": "Search filename or sender",
    "galleryNote": "Only photos and videos are guaranteed to appear in Gallery. Other files are saved to folders.",
    "selectAll": "Select all",
    "clear": "Clear",
    "emptyStateTitle": "No files match these filters",
    "emptyStateBody": "Try another search, category, or sender.",
    "runDiagnostics": "Run MP4 diagnostics",
    "unknownSender": "Unknown sender",
    "noDate": "No WhatsApp date",
    "play": "Play voice note",
    "pause": "Pause",
    "selected": "Selected",
    "selectFile": "Select file",
    "types": {
      "photo": "Photo",
      "video": "Video",
      "voice": "Voice",
      "sticker": "Sticker",
      "document": "Document",
      "file": "File"
    }
  }
};

const newHebrewTranslations = {
  "fileSelection": {
    "title": "בחר מדיה",
    "subtitle": "{{matched}} קבצים מתאימים • {{selectedSenders}}/{{totalSenders}} שולחים",
    "footerSelected": "{{selected}} נבחרו • {{photos}} תמונות • {{videos}} סרטונים • {{other}} אחר",
    "continue": "המשך",
    "photos": "תמונות",
    "videos": "סרטונים",
    "other": "אחר",
    "all": "הכל",
    "searchPlaceholder": "חפש שם קובץ או שולח",
    "galleryNote": "רק תמונות וסרטונים מובטחים להופיע בגלריה. קבצים אחרים נשמרים בתיקיות.",
    "selectAll": "בחר הכל",
    "clear": "נקה",
    "emptyStateTitle": "אין קבצים התואמים למסננים אלה",
    "emptyStateBody": "נסה חיפוש, קטגוריה או שולח אחרים.",
    "runDiagnostics": "הפעל אבחון MP4",
    "unknownSender": "שולח לא ידוע",
    "noDate": "אין תאריך וואטסאפ",
    "play": "נגן הודעת קול",
    "pause": "השהה",
    "selected": "נבחר",
    "selectFile": "בחר קובץ",
    "types": {
      "photo": "תמונה",
      "video": "סרטון",
      "voice": "הודעה קולית",
      "sticker": "מדבקה",
      "document": "מסמך",
      "file": "קובץ"
    }
  }
};

function updateJson(path, newData) {
  let data = {};
  if (fs.existsSync(path)) {
    data = JSON.parse(fs.readFileSync(path, 'utf8'));
  }
  Object.assign(data, newData);
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

updateJson(enPath, newTranslations);
updateJson(hePath, newHebrewTranslations);
