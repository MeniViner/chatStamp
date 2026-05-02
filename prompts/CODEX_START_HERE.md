# Prompt for Codex — Start Here

You are working in the `whatsapp-media-timefixer` repository.

First read:

1. `AGENTS.md`
2. `.agent/PLANS.md`
3. `.agent/EXECPLAN-MVP.md`
4. `docs/PRD.md`
5. `docs/ARCHITECTURE.md`
6. `docs/TECHNICAL_NOTES_ANDROID.md`
7. `docs/CODE_REVIEW.md`

Then perform Milestone 1 from `.agent/EXECPLAN-MVP.md`:

- Make the project installable and typecheckable.
- Fix any dependency or TypeScript issues caused by Expo SDK/package version changes.
- Ensure these commands pass:

```bash
npm run typecheck
npm run test
npm run lint
```

Do not implement Phase 2 features. Do not fake native timestamp success. If a library cannot satisfy the metadata requirement, document it and keep the native bridge task explicit.
