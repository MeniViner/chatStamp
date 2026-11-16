# chatStamp core rebuild

Branch `fix/core-rebuild` starts at `2a76514` (0.1.1). The stage order is 0, A, P, B, C, D, E, F. The physical storage probe in Stage P is required before the production save path in Stage B.

## Stage 0 · 2026-11-16

- Implementation moved the reusable QA tooling into `scripts/android-verification/` with run-scoped output, QA-only package IDs, destination-aware readback, and scoped cleanup. The [baseline record](VERIFICATION.md) retains the 0.1.1 device results.
- Test design added seven paired export transcripts and inventories, including matching, missing dates, filename and ZIP-entry fallback, collisions, and DST boundaries. The inventory test automatically includes sanitized pairs from the `real` directory and rejects missing pair members.
- Baseline smoke at `2a76514` passed `npm ci`, typecheck, 111 tests, lint, clean Expo prebuild, and the arm64 QA debug build with two Gradle workers. Baseline logs are under `dist/android-verification/stage-0/`. The previously measured API 33 results remain the physical baseline.
- Review verified all five synthetic ZIPs, including the 134,221,021-byte large fixture, can be generated from the tracked tool. The post-fixture suite has 118 tests. Stage 0 is limited to documentation, fixtures, and QA tooling.

## Stage A · 2026-11-16

- Implementation matches transcript attachments against archive entry IDs. It resolves date order once, handles named time zones and DST, and records filename, entry-time, and missing-date fallbacks. The import builds the transcript preview during parsing and yields in both line grouping and record conversion. Audio, GIF, and unmatched supported attachments are selectable. The legacy bridge receives only finite dates. The results use MediaStore readback to count verified chat dates.
- Test design covers the paired fixtures, same-minute runs of 61 files, supported unmatched items, an undated transcript, and the baseline MP4 false-success case. The older sequential duplicate test now expects ambiguous basenames to remain unmatched. The multiline example uses an explicit attachment marker.
- Review checked the import, selection, preview, and save entry points against `docs/CODE_REVIEW.md`. The Kotlin transcript discovery and extraction remain in use until Stage C. A year-first transcript that fails the legacy discovery heuristic can still be rejected before TypeScript sees it. Date-less files remain visible and selectable. The existing save flow skips them until Stage B can save without a target timestamp.
- Host smoke passed `npm ci`, typecheck, 129 tests, lint, clean Expo prebuild, and arm64 debug assembly. The final reviewed code also passed typecheck, tests, lint, and a rebuilt APK. Manifest inspection confirmed QA identity `com.menis.chatstamp.qa`, min SDK 24 and target SDK 36. The baseline storage grants remain declared at this stage.
- Device smoke passed on the Galaxy Note20 Ultra SM-N986N, API 33, after the USB connection returned. The arm64 QA APK cold-launched in 1.25 seconds. The system picker imported the mixed synthetic export and showed ten items. `IMG-20210417-WA8899.jpg` appeared under Unknown sender with an approximate 17 April 2021 noon date. `contact.vcf` appeared under Dana. The QA process had no crash entries, and the cleanup removed its package and Downloads fixture. Evidence is under `dist/android-verification/stage-a/`.
- A cold ADB share of the shell-created MediaStore Downloads URI reached the QA application. The provider denied file access. The successful smoke used the system picker without granting All Files Access. The logged share denial is a separate case for Stage C.
- The Gradle connected runner preflight resolved all 13 registered Unified Test Platform configurations, including the core that failed at baseline. The [tracked prefetch command](../scripts/android-verification/README.md) also passed with `--offline` after warming the cache. The device assertions remain pending.

### Repeat the physical smoke test

Connect and unlock the API 33 Samsung, then run the following from the repository root. The APK is the isolated QA copy.

```powershell
$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
& $adb devices -l
& $adb install -r dist/android-verification/stage-a/chatstamp-stage-a-qa.apk
python scripts/android-verification/device.py launch cold
$env:CHATSTAMP_QA_RUN_ID = 'stage-a'
python scripts/android-verification/fixtures.py --skip-large
python scripts/android-verification/device.py prepare mixed
```

Record the rendered first screen and QA process crash log. Complete or skip onboarding if shown. Use Choose ZIP and open Downloads, then `chatstamp-qa-stage-a/chatstamp-qa-stage-a-mixed.zip`. On selection, find `IMG-20210417-WA8899.jpg` under the localized unknown sender with an approximate date and find `contact.vcf` under Dana. Capture a UI dump with `python scripts/android-verification/device.py dump qa-selection`, then run `python scripts/android-verification/cleanup-device.py`.

## Stage P · 2026-11-16

- Prepared a standalone Gradle probe with package `com.menis.chatstamp.qa.probe`, test package `com.menis.chatstamp.qa.probe.test`, and AndroidJUnitRunner 1.7.0. Both manifests specify min SDK 30 and target SDK 36. The manifest check verifies the runner's target and rejects broad storage permissions in both APKs.
- Synthetic assets reuse both JPEGs, the PNG, and both misdated MP4s from the baseline. The 13-file set adds separate PNG and WebP controls with opposing insert order, OPUS and M4A audio, VCF, and TXT. The probe records the app UID, runtime permissions, published bytes, embedded dates, indexed dates, mtime attempts and destination fallbacks. The PNG and WebP modification-time result is a candidate pending an independent Gallery check.
- The probe tries shared Pictures, shared DCIM, and split Pictures and Movies on rejection. Audio uses Music. Each document tries Files in Documents, owned Downloads, and the system folder picker. Cleanup verifies exact run folders and uses the originating app UID for MediaStore deletion.
- Host smoke passed typecheck, 129 Vitest tests, ESLint, six JVM tests, Android lint, and both probe APK builds. The pinned AGP 8.13.0 probe build and connected dependency prefetch passed offline after caching. FFmpeg decoded 11 media inputs. FFprobe confirmed the green MP4 changed from `2022-07-08T09:10:11Z` to `2019-02-16T09:30:00Z` and the purple MP4 from `2018-07-08T09:10:11Z` to `2020-03-17T10:00:00Z`.
- Reviewed against `docs/CODE_REVIEW.md`. The test app streams synthetic bytes through scoped content URIs, compares reopened content and separately checks embedded and indexed dates. The runner captures failed paths and the cleanup addresses the app's exact run namespace. Production sources and configuration are outside the probe's build.
- Samsung verification passed under the probe app UID. The Gradle connected identity test and the direct storage and cleanup tests each passed with one executed assertion group. The probe reopened all 13 files. Reopened EXIF, both MP4 retriever dates and FFprobe results, and the MediaStore dates matched their targets where applicable.
- Samsung Gallery 14.5.14.0 showed purple, yellow, blue, green, red in Date created (descending). The red JPEG showed 15 February 2019 at 10:30 in Asia/Jerusalem. Both PNG and WebP controls had matching `DATE_TAKEN`. Modifications were set on the app-owned pending path and survived publication.
- The proved Stage B destinations are shared Pictures for images and videos, Music for audio, and Files/Documents for VCF and TXT. Audio and document modification times matched and their `DATE_TAKEN` was null. Report those timestamp limits separately from the successful save.
- The cleanup test deleted the 13 owned rows and the host checked all run directories and both packages were gone. The physical report and reproducible command are in the [capability matrix](VERIFICATION.md#stage-p--scoped-storage-feasibility) and the [probe procedure](../scripts/android-verification/README.md#stage-p-storage-probe).
- Excluded the probe's generated Gradle build tree from ESLint after the connected run produced its HTML report and JavaScript assets. The TypeScript, test, and lint checks pass with the connected reports present.

## Stage B · 2026-11-16

- Replaced the public-folder save and scanner bridge with one scoped save call. The default roots are Pictures, Music, and Documents. The app can also save into an explicitly chosen folder and verifies that its access is still valid. The debug build uses min SDK 30 and target SDK 36. The APK inspection found no broad storage permissions.
- Existing capture dates are kept by default. Always use message date opts into EXIF or container timestamp changes. The save result distinguishes file publication, capture-date readback, modification-time readback, and dates that could not be verified. The output bytes are still saved when a date is unavailable or metadata cannot be changed safely.
- The app hashes the cached ZIP natively and records completed entries by archive, destination, relative path, and occurrence. The recorded folder stays stable across retries. A different entry that collides by name gets a deterministic suffix. Replacement checks the new bytes and applicable date before deleting the previous file. Legacy settings and history retain their recognized values, known URIs, and paths.
- Host smoke passed npm ci, typecheck, 112 Vitest tests, ESLint, clean Expo prebuild, and arm64 QA assembly. The current suite replaces legacy permission and date-diagnostic assertions with the scoped storage checks. The native test XML reports five JVM and three Samsung tests with zero failures or skips.
- Reviewed against `docs/CODE_REVIEW.md`. The save code streams one file at a time, limits scratch preparation to available space, cleans failed owned rows, and restricts the app FileProvider to the import cache. History deletion targets individual files and checks ownership before deleting MediaStore rows.
- Expo installed the verified QA APK on the connected Samsung and opened the QA activity. The interactive import, gallery sort, and duplicate rerun need an unlocked screen. See the [Stage B app regression steps](../scripts/android-verification/README.md#stage-b-app-save-regression).
