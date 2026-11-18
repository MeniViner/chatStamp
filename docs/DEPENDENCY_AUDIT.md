# Dependency audit — 2026-11-18

`npm audit --json` after compatible locked updates reports **11 package findings:
9 moderate, 2 high, 0 critical**, down from 37 (1 critical, 14 high, 21 moderate,
1 low). These are package findings, including propagated parent alerts, rather
than eleven distinct application vulnerabilities. Reproduce with `npm ci` then
`npm audit --json`; the command remains nonzero while these findings exist.

Removed unused expo-sharing/react-native-screens and the redundant direct
TypeScript-ESLint pins/overrides. Added the real direct expo-modules-core import.
Kept SDK55 and RN0.83, updating Expo55.0.32/core55.0.27/RN0.83.10 together with
Expo-compatible React types. Vitest is4.1.12. `npx expo install --check` passes.
Compatible transitive updates remove the earlier shell-quote, Babel, XML, brace,
browserslist, compression, YAML, nanoid, forge, PostCSS, source-map, UUID, Vite,
Vitest and ws audit paths. No incompatible forced override or Expo52 downgrade
was accepted. The full smoke and release runtime checks remain the authority for
this native dependency change; a lockfile update alone is not runtime proof.

## Remaining package dispositions

| Affected package/version | Severity | Disposition |
| --- | --- | --- |
| @expo/cli55.0.37 | high | Node build/development CLI; propagated config/glob/zod alerts. No CLI entry in app imports; retain SDK55-compatible owner until its fixes land. |
| @expo/config55.0.21 | moderate | Node prebuild configuration; propagated plugin/glob alerts. |
| @expo/config-plugins55.0.12 | moderate | Node native-project generation; propagated glob alert. |
| @expo/fingerprint0.16.8 | moderate | Node build fingerprinting; propagated glob/minimatch alerts. |
| @expo/local-build-cache-provider55.0.16 | moderate | Node development build cache; propagated config alert. |
| @expo/metro-config55.0.27 | moderate | Node bundle configuration; propagated config/glob alerts. |
| @expo/prebuild-config55.0.22 | moderate | Node project generation; propagated config/plugin alerts. |
| expo55.0.32 | moderate | Parent package also supplies runtime APIs, but this audit alert propagates through its Node tooling dependencies; it does not identify an Expo runtime API flaw. |
| glob13.0.7 | moderate | Build/tool filesystem traversal. Patched14.0.2 crosses the owning13.x range; defer incompatible override. |
| minimatch10.2.6 | moderate | Tool glob parsing. Patched11.0.1 crosses the affected10.x parent's range; other installed versions are not conflated with this affected node. |
| zod3.25.76 | high | Expo CLI schema validation. Patched4.6.6 crosses3.x API; defer incompatible override. |

Primary advisory/version checks: [glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4),
[minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249),
[zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
These remaining risks concern developer/build tooling. Do not feed untrusted
repositories/configuration to development servers as a substitute for package
maintenance. This is a reviewed reachability disposition, not an assertion that
an npm production-dependency flag establishes APK contents. The final minified
Hermes source-map check must be recorded with its artifact in VERIFICATION.md; no raw
map or dependency tree is included in curated evidence. That final-candidate
source-map check remains pending until an artifact-scoped result is appended.
