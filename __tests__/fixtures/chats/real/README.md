# Sanitized real exports

Add a transcript as `<name>.txt` and its matching inventory as `<name>.files.json` in this directory. The fixture discovery test picks up complete pairs automatically.

Use the shape in `../android-day-month.files.json`. Set the actual transcript time zone and date order. Preserve date punctuation, line breaks, attachment markers, and Unicode direction marks when sanitizing. Replace participant names, message text, and identifying filenames with fictional values before adding a fixture. Keep original chats and media outside version control.
