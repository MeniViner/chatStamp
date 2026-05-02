# Prompt for Codex — Harden WhatsApp Parser

Improve the parser in `src/lib/chatParser.ts` using tests first.

Requirements:

- Support common WhatsApp `_chat.txt` formats.
- Support Hebrew/RTL sender names and Unicode direction marks.
- Support multiline messages.
- Extract filename, sender, and original timestamp.
- Return skipped/unmatched diagnostics rather than throwing for normal bad lines.
- Add tests for every new format.

Run:

```bash
npm run test
npm run typecheck
```
