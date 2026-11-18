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

## Stage R · recovered macOS baseline · 2026-11-18

- Recovery inspected status, stashes, branches, recent commits and origin before
  editing. Clean `main` at `2a76514` had no stashes. Fetch discovered the pushed
  `fix/core-rebuild` at `811a27561fc7733a7ccccbad25bab286013916e3`; tracking checkout
  and fast-forward-only pull matched origin without discarding or rewriting work.
- The current physical phone is Galaxy A30 SM-A305F, Android 11 / API 30, arm64,
  Samsung Gallery 12.1.09.1, Asia/Jerusalem. The historical Note20/API33 results
  remain historical. The phone was unlocked; its previous stay-awake value was 7.
- Implementer updated AGENTS.md for the actual bilingual Kotlin/scoped-storage
  stack and v4 release sequence and removed the four obsolete prompts. No active
  callers reference those prompts; the already-obsolete FILE_TREE.txt is left
  for Stage F. The active v4 continuation is appended to the ExecPlan.
- Acceptance-test author added run-scoped working-directory support, an undated
  VCF fixture, strict five-file timestamp and duplicate inventory assertions,
  and namespace/ownership-checked cleanup. Reviewer caught a query that could
  miss sibling duplicate folders; the query now searches the QA-owned run across
  destinations before asserting the expected five identities.
- Smoke passed: `npm ci`, TypeScript, 112 Vitest tests in 28 files, ESLint,
  clean Expo Android prebuild, arm64 QA debug assembly with two workers, APK
  inspection, five JVM tests and three connected tests, all with zero failures
  or skips. The inspected APK is `com.menis.chatstamp.qa`, min SDK 30, target 36,
  with no broad storage or media-read permission. QA cold launch took 2.919 s;
  onboarding rendered and its process crash buffer was empty.
- The QA app was uninstalled after the baseline run and stay-awake restored to 7.
  The production package was absent and was not installed or changed. Build and
  fixture intermediates stay outside the compact evidence set.
- Fixture portability: the installed FFmpeg lacks `libwebp`. **try another way**:
  use the available `cwebp` encoder with a temporary FFmpeg-generated PNG; retain
  the requested WebP fixture and clean its intermediate. This is verification
  tooling, not a change to application media/date behavior.
- Final verification-helper validation: 18 Python host tests passed; the five-media and undated fixtures generated successfully with the WebP fallback. Final independent R diff review found no remaining actionable findings.


## Stage B-close · UI awaiting owner unlock · 2026-11-18

- Tested application source remains the Stage R head `fe7be66`; no product change
  was made for B-close. The complete smoke cycle was rerun and passed: npm ci,
  TypeScript, 112 Vitest tests, ESLint, clean prebuild, two-worker arm64 QA assembly,
  min30/target36 QA manifest inspection, five JVM and three API30 connected tests.
- The synthetic five-media ZIP and absent-date VCF ZIP generated successfully.
  The source MP4s still deliberately contain the wrong 2022/2018 dates.
- Before the app-driven regression the phone entered a secure lock. A wake key
  brought up the lock screen; policy reports `showing=true`, `secure=true`.
  ADB remains connected but battery service reports AC/USB/wireless power false,
  so `svc power stayon usb` does not keep this connection awake.
- **try another way**: wake and inspect the keyguard rather than attempting a
  credential or gesture unlock. A secure unlock still requires the owner. The
  owner was asked to unlock the A30 and leave it connected. No UI save, Gallery,
  duplicate or absent-date result is claimed.
- Preserve the tested head and QA binary as a development input. Keep B-close
  acceptance pending and continue independent Stage C implementation; G1 stays
  gated on accepted B-close and C. On unlock, repeat the retained QA regression,
  then run it again on any changed save implementation.


## Stage C · implementation and review · 2026-11-18

- Implementer replaced private ZIP copies with native content/file-URI streaming,
  one-pass SHA-256, bounded entry extraction, candidate metadata and ZIP times.
  TypeScript selects the transcript and keeps other supported TXT documents.
  Actual limits and supported extensions are appended in the active ExecPlan.
- Added application-scoped operation snapshots, event-driven cold/warm shares,
  real throttled progress, cancellation, a user-started dataSync foreground save
  with notification Cancel, safe cache/source release, coded recovery messages,
  atomic native JSON writes and split history with durable migration/reconciliation.
- Independent acceptance tests cover unknown progress totals, operation isolation,
  typed error messages in both languages, original-URI extraction without copies,
  year-first transcript selection, undated VCF, transcript limits, interrupted
  history writes, and retained native completion after a history write failure.
- Review fixed a second-share queue guard that could delay replacement prompts,
  restored same-minute save timestamp offsets in completion counts, and prevented
  save acknowledgement before durable history. The final coordinator suite has
  twelve passing cases; the full TypeScript suite has 191 passing tests/32 files.
- First native compile hit an Expo zero-argument Coroutine overload ambiguity;
  **try another way**: use an explicit zero-argument lambda. The compile passed.
- First API36 native run failed because Android's default ZIP validator rejected
  an unsafe entry before it could be counted/skipped. **try another way**: use
  Apache Commons Compress 1.28.0 ZipArchiveInputStream while retaining explicit
  safe-path/bounded-write checks. Do not disable the platform validator globally.
  Added independent STORED-payload and DEFLATED-descriptor CRC corruption checks;
  no assertion was relaxed. Official dependency coordinates checked:
  https://commons.apache.org/proper/commons-compress/dependency-info.html .
- The complete retry passed npm ci, TypeScript, 191 tests, ESLint, clean prebuild,
  arm64 QA assembly, min30/target36/no-broad-permission inspection, exact exported-
  false dataSync service/notification declarations, 16 JVM tests, and ten connected
  tests on each of physical API30 and emulator API36, zero failures/errors/skips.
- Further review identified cancellation-close I/O classification and pending-row
  cleanup reporting; preserve explicit cleanup IO_ERROR and test the actual reader
  cancellation boundary. A fresh full cycle is required after those final fixes.
- Current official Android timeout/notification test procedures were checked at
  https://developer.android.com/develop/background-work/services/fgs/timeout and
  https://developer.android.com/develop/ui/compose/notifications/notification-permission .
  Runtime UI, background, denial, cancel and timeout acceptance is still in progress.

- Final C fresh smoke after review passes191 TypeScript tests,23 JVM tests and
  ten connected tests per API 30/API 36. Seven new pure JVM controls exercise actual
  source-close cancellation before ZIP error wrapping and keep explicit cleanup
  failures visible as IO_ERROR. The initial proposed blanket error-precedence
  assertion was replaced by this real reader-boundary test because cleanup I/O
  failures must not be masked; no integrity/cancellation acceptance was relaxed.
- Final independent source review has no remaining findings. C implementation
  may be committed with runtime acceptance explicitly open. The API36 picker
  imported 128 MiB with no private ZIP copy; confirmed discard plus cold launch
  left zero job files. Curated evidence totals about 131 KiB at this checkpoint.
- Owner reported physical unlock; policy confirmed showing=false. Temporarily
  changed screen_off_timeout from 600000 to 1800000 ms for physical UI tests;
  restore 600000 and prior stay-awake 7 after device cleanup.
