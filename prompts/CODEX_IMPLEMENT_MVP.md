# Prompt for Codex — Implement MVP

Implement the MVP according to `.agent/EXECPLAN-MVP.md`.

Important constraints:

- Local-only. No backend, no cloud upload, no accounts.
- Stateless. No database.
- Do not load entire ZIP files into JavaScript memory.
- Use native ZIP extraction.
- Keep OPUS voice notes excluded by default.
- The app is not done until Android Gallery date sorting is verified on a real device.

Work milestone by milestone. Update `.agent/EXECPLAN-MVP.md` as you progress.

Before final response, run:

```bash
npm run typecheck
npm run test
npm run lint
```

If native changes were made, also explain the Android device verification steps and any results.
