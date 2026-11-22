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


## Stage B-close · physical Galaxy A30 acceptance · PASS · 2026-11-18

- Accepted the retained QA APK built from `fe7be66` on Samsung Galaxy A30
  SM-A305F, Android 11 / API 30, Samsung Gallery 12.1.09.1, Asia/Jerusalem.
  Its SHA-256 is recorded in the new acceptance JSON. Stage B product code was
  unchanged during this run; the working branch's Stage C source is `25a9abc`.
- The baseline smoke remains green: npm ci, typecheck, 112 Vitest tests, ESLint,
  clean prebuild, arm64 QA assembly, min30/target36/permission inspection, five
  JVM tests and three connected tests. The physical app regression imported the
  five-media export through the system picker with Always use message date
  enabled and no broad storage access.
- Independent MediaStore readback matched all five chat instants in DATE_TAKEN
  and DATE_MODIFIED. Reopened JPEG/PNG metadata and both saved MP4 creation times
  matched; the intentionally wrong source MP4 dates were replaced. Results showed
  five saved, five dates verified and zero failures.
- Samsung Gallery's default Date created, descending sort showed purple, yellow,
  blue, green, red in the Hebrew RTL grid's reading order. Red JPEG details showed
  15 February 2019 at 10:30. The verification report links the synthetic screenshots.
- Skip-existing reruns in Hebrew and then English retained row IDs 121–125 and
  `Pictures/chatStamp/chatstamp-qa-b-20261118-mixed/`, with no additional copy or
  destination folder. The first, second and language-rerun inventories agree.
- An unmatched undated VCF published as row 128 in the run's Documents folder.
  Results showed one saved, zero dates verified, zero failures, Date unavailable
  and Saved without a date. The app did not invent date success.
- Cleanup passed: QA app and disposable UI helper uninstalled, both synthetic
  source exports and saved run rows removed, stay-awake restored to 7 and screen
  timeout restored to 600000 ms. Independent review reported no findings on the
  five-file, duplicate or Gallery cases.
- New proof stays in the existing compact
  [rebuild evidence folder](../dist/android-verification/rebuild-20261118/), with
  `stage-b-acceptance.json` as its B-close summary. No artifact copies were added
  to the evidence set by this documentation update. Stage C physical/runtime
  acceptance continues separately; G1 awaits accepted C and its release checks.


## Stage C accepted · physical API30 and emulator API36 · 2026-11-18

- Real Google Files Share to the open QA process retained its PID and started
  exactly one import; force-stop plus the same real share launched a new process
  and started exactly one import. The granted content URI was used directly.
- Physical128MiB extraction held only the134220717-byte video and66-byte transcript,
  with no private ZIP/DocumentPicker/shared ZIP copy. Confirmed Back/discard and
  cold launch left zero job files. Independent five-file MediaStore/EXIF/FFprobe
  readback also passed after the new save implementation.
- Fresh physical background saves completed while Launcher remained foreground,
  both with notifications allowed and with API30 POST_NOTIFICATION blocked.
  Each published a new full128MiB file (rows133 and142), not an already-saved skip.
  API36 separately tested the Android13+ runtime notification-denial path.
- First physical cancel sampling waited for a published and pending row together;
  its brief insertion window was missed and all eight files completed. This was
  inconclusive, not a cancellation pass. **try another way**: use16videos and tap
  the visible Cancel footer as soon as one file is published while the FGS is
  active. Result:2saved,14cancelled; no pending/partial row; both completed32MiB
  files remain intact and FFprobe matches2019-02-21T09:00/09:01Z.
- Emulator API36 also passed real warm/cold share,128MiB cache/discard, fresh
  allowed/denied background writes,4saved/20cancelled with full files, and the
  official dataSync timeout controls. System timeout was followed by clean
  service stop about40ms later, with no pending/partial output or crash.
- Runtime testing found misleading cancellation summary copy. Results now counts
  newly saved outcomes separately from cancelled/failed/skipped rows and verified
  dates. History persists cancelled counts and reconciles older details; retries
  clear cancelled outcomes only when they actually save them. A new installed QA
  cold start visibly shows Partial save:2saved,14cancelled,0failed.
- Independent test author added17completion and14history regressions. Final
  complete smoke passed npm ci, strict TypeScript,222Vitest tests/34files, ESLint,
  clean prebuild, two-worker arm64 QA assembly, min30/target36/permission/service
  inspection,23JVM tests and10connected tests on each API30/API36; zero failures,
  errors or skips. Final reviewer found no actionable findings.
- Final QA APK SHA256:acfe5fd889feb63525b4162d3e5559f1bd74cf08ed6a9458564b046a1eed1558.
  It cold-launched in2.926s and its process crash buffer was empty.
- Physical cleanup removed17owned output rows and five source ZIPs, uninstalled
  QA/UI helper and restored stay-awake7 and screen timeout600000. Emulator cleanup
  removed its QA/run files and restored stay-awake1 and platform test defaults.
  Production package was absent and unchanged. Curated proof remains in the one
  ignored rebuild-20261118 evidence folder, currently below1MB.
- Provider-revocation simulation and crash recovery beyond cleanup of this
  operation's own orphaned pending rows remain explicitly deferred. API33
  physical coverage and a real owner WhatsApp export remain UNVERIFIED.


## Stage G1 preparation checkpoint · 2026-11-18

Version0.2.0/code3 is synchronized across Expo, root/module package metadata,
lockfile and module Gradle. Release policy removes unnecessary Internet/network,
overlay/audio/vibration/referrer capabilities, disables background media playback,
and excludes private data from backup/transfers. Actual minified AAB manifest
confirms exactly the three required platform permissions plus AndroidX's own
signature receiver permission, nondebuggable, min30/target36, backup disabled
and all nine-domain exclusion rules. Bilingual policy/listings/upload/tester
materials and in-app privacy/support actions are prepared; public website,
phone screenshots/demo and upload remain pending.

The first R8 pass found Commons Compress's optional Zstd class. A suppression
alone was rejected by review: its factory can run before the entry-method guard.
**try another way**: SupportedZipInputStream rejects Zstd in the protected factory.
Two known-size method20/93 JVM controls prove rejection before returning an entry.
The initial descriptor fixture did not enter that factory; the fixture was fixed,
not the assertion. Complete retry passes222Vitest/25JVM/10connected perAPI30/API36.
The minified bundle then builds successfully and bundletool validates it.

Artifact acceptance remains OPEN. Independent certificate comparison caught that
the old config-plugin regex missed Expo's commented release block, leaving the
DEBUG signingConfig selected. Fix the durable plugin, regression-test selection,
rebuild and require an exact established-upload-certificate match; never distribute
this preflight artifact. No new upload key was generated. All72native libraries
were inspected: all36ELF64 LOAD/RELRO results pass16KiB. Genuine ELF32 libraries
include4KiB segments; Android/AOSP policy scopes the16KiB requirement to64-bit
ABIs, so preserve their raw results and correct verifier applicability rather than
omit ABIs or claim ELF32 compatibility. The public policy page/Play upload are
not established by this checkpoint. Phone has securely locked again; owner unlock
was requested while independent release preparation continues.


## Stage G1 accepted with manual Play handoff · 2026-11-18

- Final complete smoke: npm ci, strict TypeScript, **230 Vitest tests/35 files**,
  lint, clean Android prebuild, two-worker QA assembly/manifest checks, **25 JVM
  tests**, and **10 connected tests on each API30/API36**, all passed. Independent
  signing-template tests cover eight cases; the standalone verifier/harness has
  **73 passing Python tests**. Reviewer found no remaining actionable findings.
- Fixed release signing selection across Expo comments and fail closed on unknown
  Gradle templates. Production AAB `dist/play/chatstamp-0.2.0-3.aab` SHA256
  `7cd6730b3b80742abeb50d1c61197ce4825c316ac2657ccea1f56e5e2c84c95d`
  validates and is signed by the established upload certificate SHA256
  `efe36695cfc6a3d9ea8471527103f29e3374322ab09890af41692412d76a66c8`.
  Exact identity/version0.2.0/code3/min30/target36/nondebug, signed payload coverage,
  backup exclusions, platform-permission trio and AndroidX own signature permission
  pass. All72 ELF libraries were inspected: all36 ELF64 LOAD/RELRO checks and
  APK16KiB ZIP alignment pass; genuine32-bit raw results are retained with explicit
  policy NOT_APPLICABLE. Actual16KiB-device runtime remains UNVERIFIED.
- The same owner-signed minified QA universal APK SHA256
  `3151927af160166cb15737050d0eb949228db5ed07a2ad3e483dc74a48359640`
  cold-launched in998ms and passed real-picker five-file save/readback on the
  physical Samsung A30/API30 and API36 emulator. Five saved and five dates verified
  agree independently with MediaStore, filesystem dates, EXIF and both MP4
  creation times. Phone Gallery default Date created descending shows purple,
  yellow, blue, green, red; red details show15Feb2019 10:30. Crash buffer empty.
- All eight synthetic actual-phone store screenshots are captured in English
  and Hebrew, with dimensions/hashes/provenance. The English fresh-save run
  intentionally removed Hebrew rows244–248 first; rows249–253 are new. This reset
  is not duplicate acceptance; accepted Stage B proves duplicate preservation.
- Privacy policy is public HTTP200 at
  https://meniviner.github.io/chatStamp/privacy-policy.html and matches tracked
  bilingual HTML. Pages currently serves fix/core-rebuild /docs; after owner merge
  switch to main /docs before deleting the branch. Installed Privacy policy action
  launches Chrome on both devices; browser first-run/sync prompts prevented page
  rendering. **UNVERIFIED:** owner completes their browser setup and taps Settings
  → Privacy policy; the test did not alter account/sync preferences.
- Recorded actual minified user-started save, live dataSync notification while
  Launcher was foreground, reattachment and4saved/4verified results. The14.4s
  `dist/play/chatstamp-0.2.0-3-fgs-demo.mp4` uses cuts around transitions and a crop
  of only the chatStamp notification to exclude unrelated personal notifications;
  no UI or progress was composited. A first timing attempt missed the shade:
  **try another way**: wait for Home to settle, then use a real downward swipe.
  The owner must publish an accessible video URL. No raw/private video is packaged.
- No Play service-account variable was supplied. **try another way:** signed AAB,
  bilingual listing/declarations/tester messages and exact numbered manual steps
  are ready; no upload or started closed-test period is claimed. Personal-account
  creation date and tester participation remain UNKNOWN. Real owner WhatsApp
  export and API33 physical coverage remain UNVERIFIED with G2 steps.
- Phone cleanup removed the five current Gallery rows and four demo rows, both
  source ZIPs, both temporary recordings and QA/helper packages; earlier trial
  rows were already removed. Display1080x2340/font1.1/timeout600000/stay-awake7
  restored. Emulator cleanup removed its QA/run files and restored stay-awake1.
  Production package stayed absent and unchanged. Compact proof is in the single
  ignored rebuild-20261118 folder; product AAB/demo are separate requested outputs.


## Stage D implementation and acceptance plan · 2026-11-18

G1 is accepted with a manual Play handoff (commit30a422a); no track upload is
claimed. D uses versionCode4 while keeping0.2.0 and the production identity.
Before any D product edits, root imported40 synthetic H.264 videos on the A30,
scrolled six screens and opened VID-20190224-WA4012. Captured PID5216 contains
42 ExoPlayer Init,1 Release, peak41 unreleased captured instances and76 decoder
error lines including OMX.Exynos.avc.dec initialization failures. Preview opened;
these errors establish resource pressure, not an independently enumerated hardware
decoder count. Small fresh proof: d-baseline-40-video.json.

Implementation ownership: implementer owns native thumbnails/cache/queue,
FileProvider opening, cleanup and native barrier plus AppUi thumbnail removal;
root owns picker/viewer, shared lazy audio, Set selection and save-scope snapshot;
test author independently derives pure, actual-cell and lifecycle regressions;
reviewer checks the complete diff against the task and CODE_REVIEW.

- Native thumbnails are64–512px JPEGs: image downsample, scaled video frame, PDF
  page one; two workers, one heavy renderer, bounded pending work and32MiB/512
  cache entries. Identity includes URI/path, native mtime/size and requested size.
  Invalidation and import discard prevent late repopulation. External opens use
  only checked cache/owned/granted content URIs and read-only temporary grants.
- Selection is an immutable Set by ID. All eligible media, voice, documents and
  transcript start selected. Sender/search/tab/date filters preserve hidden
  selections; day/filter tri-state and shrinking ranges affect the active IDs
  only. Footer and pendingSaveIds use the same filtered ordered intersection.
- Real SectionList cells are square3/5-column visual rows or64dp voice/docs rows,
  with sticky day headers. Stable callbacks/metadata and memoized actual cells
  must pass500/5000-cell invalidation tests, not fake counter replacements.
- Viewer follows the filtered/sorted order, provides image pinch/double-tap,
  current-page video, one lazy shared audio owner/seek/loading/error state,
  PDF first page, VCF name/phone and external-app fallbacks. No list player.
- Installed Expo factories allocate players during render and release them later
  on Android MAIN. **try another way:** construct the viewer player only after
  commit, acquire a global slot, claim the still-current offer, and hold the slot
  through explicit release plus an awaited MAIN completion fence. Superseded
  offers create nothing; owner remounts share the same fence; failure stays closed.
  Regression tests must cover batched requests and delayed release/remount.

Remaining acceptance: full smoke from npm ci; native nonzero unit/connected counts;
physical40-video grid/player-log comparison, all nine fixture attachment previews,
external opening and sender+Photos footer/save scope; API36 runtime cross-check;
source review closure; signed code4 update or manual handoff; QA cleanup and settings
restoration. Stage D is OPEN until these are observed. E/F/G2 have not started.


### Stage D runtime checkpoint — 2026-11-18

Last pre-fix complete smoke (stage-d-final-2) passed305 Vitest/39files,35 JVM and
27 connected tests on each API30/API36, plus clean prebuild/QA assembly and
merged service/permission checks. First new native-test compilation used `.use`
with Android PdfDocument, which is not Closeable: **try another way**, explicit
try/finally close; assertions unchanged. The cycle was restarted from npm ci.

New grid creates zero ExoPlayers; physical pilot opened/released one cleanly.
Independent emulator preflight passed40 videos/eight scrolls with zero list
players, playback/16rapid-page taps/four reopen cycles with peak1/final0, and
all media formats, sender+Photos footer and hidden selections. Actual host tests
include500/5000 real memoized cells, shrinking/no-move gestures, lazy thumbnail
recovery and deferred native release across owner remounts/batched offers.

Runtime acceptance found a Fabric native-child-order error after date26→empty
date25→date26→scroll→Photos. It reproduced on c2763b9a… and final-2 APK
86e8e703be14151e1604b6e8e6e53cc606f12669ccdda375df65ca9059254577,
outside connected-test intervals. **try another way:** disable only native
removeClippedSubviews; keep SectionList windowSize5, initial/batch8 and stable
keys. Official RN guidance documents correctness risks with clipping:
https://reactnative.dev/docs/optimizing-flatlist-configuration#removeclippedsubviews
The failure is established; clipping is a controlled hypothesis pending replay,
not yet a proven cause/fix. Current code4 bundles are preflight artifacts and have
not been handed off/uploaded. D remains OPEN through the fresh smoke and replay.

Filter-sheet Reset was clipped at default emulator width; sender/date/sort controls
were observed, hidden selections preserved by manually clearing filters. Keep the
Reset defect explicit for the immediately following E sheet/inset work. No
all-controls-accessible claim is made. No E implementation has started.


## Stage D accepted · scoped runtime and signed update · 2026-11-18

Final whole cycle `stage-d-image-touch-final` passed npm ci, strict TypeScript,
305 Vitest tests/39 files, lint, clean Android prebuild/arm64 QA assembly, merged
identity/permission/service checks,35 JVM and27 connected tests on EACH API30
phone and API36 emulator. Reviewer found no remaining D source blockers against
CODE_REVIEW. The75 new TS tests exercise production selection, actual500/5000
memoized cells, thumbnail hooks, cleanup and deferred native-player ownership.

The native-clipping alternative passed three exact emulator replays of the
previous Fabric failure (date26→empty25→26→scroll→Photos); no Fabric error recurred.
SectionList keeps windowSize5/batch8/stable keys; only native clipping is disabled.
Image gestures originally competed with Pressable responder ownership: **try
another way**, place PanResponder on a plain parent View, preserve latest transform
when a pointer lifts and retain gesture ownership until release. Final physical
FINGER tests observed doubletap red extent810→1620px, two-finger→one-finger zoom
1758px, no paging during pan, then reset810px and a swipe to the next image.

Final upload-signed/minified QA APK SHA256
`69bfa0a5d78701556dc2386eb5f9d0cabd7d94c981a6f87afab24df35fee5015`
ran40videos/sixscrolls with zero grid players. Captured cold-PID11276 preview/
reopen window had4Init/4Release,peak1/final0,zero decoder-error lines and empty
crash buffer. A subsequent actual Play displayed00:01/00:02 and a decoded frame.
These are scoped event measurements, not independently queried decoder counts.
Rapid video swipes were not certified as page changes; actual photo swipe and
emulator16page-button transitions were observed independently.

Physical all-media acceptance: photo gestures; GIF actual two-color animation;
WebP rendered to match its white320x240 source; MP4 playback; OPUS reached20/20s;
PDF showed the labelled red first page; VCF showed QA Dana/+15550123456. TXT
FileProvider launched a real chooser. OEM HTML Viewer requested its own broad
media permission and exited on denial. **try another way:** an independent,
zero-permission disposable receiver read the actual granted content URI through
ContentResolver and displayed exact62-byte UTF8,READ_OK/read_grant=GRANTED. This
proves external transport; it does not certify that OEM viewer without its own
permission. API36 built-in HTML Viewer had displayed the document. No storage
permission was granted to chatStamp. Actual senderQA Dana+Photos footer1of1/673B
saved only the red JPEG; independent MediaStore datetaken1551175200000,
date_modified/mtime1551175200 agree with2019-02-26T10:00Z (1saved,1dateverified).

Signed production AAB `dist/play/chatstamp-0.2.0-4.aab` SHA256
`98b97a409ff9cfd38a1034095ea53faf26e51e6e001a1820081d027d682379e2`
and production universal APK SHA256
`5f96adb9dc2ff84610973642d74434366c9b5bd996c88326ba28efffff6b3827`
pass the full artifact verifier with the established upload cert,exact identity,
0.2.0/code4,min30/target36,minified/non-debuggable,allowed permissions,no backups,
zipalignment and all72ELF entries (36ELF64 pass16KiB;32-bit explicitpolicyN/A).
QA AAB/APK pass the same verifier except intentional.qa identity. First signed
install over debug was rejected for different certificates: **try another way**,
remove only our debug QA after deleting its own saved row,then install signed QA.
Production was absent and untouched. No service-account credential exists; code4
is packaged as the higher-code manual update under PLAY_UPLOAD_STEPS,not uploaded.
No internal/closed track availability or tester clock is claimed.

Current proof stays in `dist/android-verification/rebuild-20261118/`:d-emulator-
runtime.json,d-phone-runtime.json,gesture/filter/external/release40 receipts,
production/QA artifact reports and only small relevant screenshots. Actual phone
cleanup removed saved row340,two source ZIPs,QA/helper/native instrumentation and
temporary UI XML; restoredstayon7,timeout600000,font1.1,size1080x2340/density420
without overrides. Emulator QA/source/output cleanup passed; native test package
was removed after the final cycle,stayon1,font1.0,size1080x2400 unchanged.

Known E work: filter-sheet Reset is still clipped at default dimensions, and
footer/viewer native touch bounds need the E inset pass. Do not claim all-controls
accessibility. API33 physical remains UNVERIFIED (actualA30API30 substitute).
E/F/G2 now continue; real owner WhatsApp export and Play actions remain external.


## Stage E implementation plan · 2026-11-18

D accepted atce0acb3. E uses0.2.0/code5. Root owns direct Import→Select→Save,
two-page onboarding,shared scaffold/insets,Settings/restart prompt/theme,Results
virtualized Details,History dateformat and bilingualresources. Implementer owns
native-I18n-only direction/reload adapter,BottomSheet constrainedbody/footer,
serializedatomicsettings/date default and localized save-record compatibility.
Test author derives real production-consumer tests and strict finite i18n usage
checks independently; reviewer checks the full final diff/CODE_REVIEW.

Language text changes only after preference commits; layout direction changes by
actual native restart,with Restart now/Later and recoverable failures. Native
I18nManager.isRTL alone controls currentdirection; no root override/key remount.
Restart waits for explicit discard/cleanup and cannot interrupt running work.
New installs/missing datepreference use message date; explicit old false persists.
New output records capturelocalizedlabels; existingrecords/paths/duplicate keys
remain exact. No date/verifier policy change. Dynamicpalette must visiblycontrol
actualroles where supported,with honest API30 fallback.

Acceptance includes retained C/D suites,full smoke,actual directfilteredSave,
Back/modalpriority,inset/130%font/wide600dp EN+HE matrix on actual API30phone and
API36emu,actualminifiedreloadbothdirections,updated phone-only syntheticstore
screens plus curateddocs/screens. API33phone remainsUNVERIFIED with exactowner
steps. No Play credentials: signedcode5/manualhigher-codeupdate,not track claim.
E remains OPEN until these checks,reviews anddevicecleanup are observed.


### E review and first full-cycle corrections

Fresh review found and fixed: deferred audio-release Save could target a replaced
import (revision/identity+component-generation guards); restart cancellation could
resume intake while cleanup continued (committed non-dismissable/disabled dialog);
queued Settings UI patches could restore stale nested organization fields (typed
nested partials); result rows conflated indexed fallback dates with verified
message dates (one predicate+approximate context); native English error messages
bypassed bilingual copy (typed/generic localized errors, rawdeveloperdisclosure).
Meaningful actual component/coordinator/store regressions cover these cases.

First fullcycle `stage-e-final-1` passed npmci/typecheck then stopped at448tests:
440pass/8fail. Six assertions expected the old completion summary-key names even
though E now uses the shared four-count sentence; preserve all saved/cancelled/
failed/verified counts and actual EN/HE rendering tests while updating that UI
contract. Two Processing Back cases passed in isolation but failed in the whole
suite because `--no-isolate` reused a component module with another file's mocked
BackHandler listener. **try another way:** restore Vitest's normal per-file module
isolation, retaining single worker/thread execution and every behavior assertion.
Restart the complete cycle from npmci; these failures are not an accepted cycle.


The second E cycle passed448TS/50files,prebuild,QAarm64APK,manifestchecks and40JVM,
then35connectedtests executed perAPI30/API36 with3failures each in new profile
path assertions. Save outcomes, same-URI reruns and profile equality had passed;
the new assertions wrongly expected a trailing slash on outputDirectory, while
the established MediaStoreFolder.label trims it and feeds duplicate identity.
**try another way:** assert the exact expected directory and independent indexed
RELATIVE_PATH/count,without changing production labels or weakening duplication
criteria. Fix the cleanup-ref lint warning in the same correction batch and
restart the complete cycle from npmci. No E device acceptance is claimed yet.


### E implementation checkpoint · full smoke green · 2026-11-18

Wholecycle `stage-e-final-3` PASS:448Vitest/50files,strictTS,zero-warninglint,
cleanprebuild/QAarm64assemble,mergedSDK/permission/servicechecks,40JVM and35
connected tests on EACH API30phone/API36emu,zero failures/errors/skips. DebugQA
APK SHA256`1a76dbcbc4cbf6d41428b7edecbb783f5c1dafe04344eee4ce2b455bf6416af2`. Nativeprofiletests now independently verifyexact paths,
indexed relativepaths,published state and0→1/1→2rowcounts acrosslanguagechanges.
Reviewer source review clear; allreportedrace,bilingual-error,settingsmerge and
message-dateverification findings haveactualregressions. Standardper-fileVitest
isolation retainsoneworker; no acceptanceassertionsremoved.

Code5 source is checkpointed for signed release/runtime acceptance. This is not
E closure: actual minified restart/RTLbothdirections,Back/insets/font130/wideENHE,
updatedrealphone-onlysyntheticstoreimages,manualsignedupdate andcleanup remain.
Physicalphoneunlock wasrequestedagain; API33physical remains unavailable.


### E additional Save-policy regression

Independent acceptance contract requires a Save's settings to be fixed before
async work. Two actual coordinator regressions reproduced a delayed notification
permission allowing settingsB/notificationcopyB to replace acceptedA;18 existing
cases stayed green. **try another way:** capture cloned policy,folderlabels and
notificationstrings at the visible Save gesture as part of SaveIntent,and use the
same snapshot across media-release and notification waits; direct retry captures
beforeitsfirstawait. Capturedcustom-folderhistoryusesA; restoredunknownhandle is
null whileactualoutputURIs/pathsremainstored. Newgesture-boundarycase plus both
permissioncases pass:21coordinator tests; expectedfullsuite451. No native/UIlayout
code changed. API36 preflight remains explicitly source0db5579/APKb4684528…;
final cycle/artifact/runtime replay will follow the emulator lease release.


## E physical gate and independent F continuation · 2026-11-18

E implementation is preserved/pushed at041a79a (minified UIpreflight0db5579).
PhoneUI gate is externally BLOCKED on ownerunlock: securelock confirmed atrelease
build boundary; onlyMeni canunlock. No bypass,phoneUIclaim or phone screenshot
replacement is allowed. RequestedAPI33physical isalso unavailable; actualA30 is
API30. API36preflight remainsinprogress withits exclusivelease andexactAPKhase.
Do not mark E complete or claim finalminifiedpolicyacceptance. Final451-testcycle,
code5 rebuild/replay andstorecaptures remain after runtime/owner gates.

Groundrule9 permits independent next-stage work after alternatives are exhausted.
F cleanup/docs/CI-source preparation nowcontinues withoutdevice/build/prebuild/
connectedtest/npm-install mutations during the emulator lease. Implementer owns
caller-checkeddeadsource/exportcleanup; testauthor migratesactiveacceptance before
retiringtest-onlyhelpers; root ownsdocs,currentExecPlan,CI/policyguards andpackage
changes afterlease; reviewer laterreviewsfinaldiff. F release candidatewilluse
highercode6. NativeZIPsample-budget suspicion wasrefuted byowningsource (64KiB/TXT,
16MiBglobal,20kentries); do notchangeaworkingguard orreportit asadefect.


### 2026-11-18 — F validation corrections (candidate code6, acceptance pending)

Caller-checked cleanup removed obsolete screens/root strays and test-only helper
implementations. Criterion migration retains parser/date/cancel/history and real
500/5000-cell/player tests; host baseline is431 tests/46files (previous451 before
retiring duplicated wrapper assertions). Role handoff stays temporary; no raw
work inputs were repackaged as evidence.

Compatible SDK55 patching removes unused packages/redundant lint pins, declares
real core/asset dependencies and keeps RN0.83. npm audit37→11 findings; every
remaining package has a disposition in DEPENDENCY_AUDIT.md. Expo compatibility
also required RN0.83.10 and matching React types. No forced major override or
Expo52 downgrade. Reviewer found an inert NDK property: try another way, inject
root ext.ndkVersion before Expo defaults and assert the resolved app/root SDK,
build-tools and NDK in CI. AGP SDK getters use integer values.

Physical code5 preflight reproduced a native stale mixed-selection description
when narrowing an all-selected filter. RN setViewState only refreshed the label
for checked-string transitions. try another way: retain stable checkbox nodes
and include truthful busy:false on aggregate day/footer states to force native
label refresh. Final code6 native mixed→all/none/empty checks remain pending.

F wholecycle1 stopped at the empty-footer host assertion after this new state;
updated its exact expected map to retain checked/disabled plus busy:false.
Wholecycle2 passed431 host/TS/lint/prebuild but stopped at autolinking: expo-audio's
unbounded expo-asset peer selected SDK58 beside Expo55. try another way: declare
Expo's compatible expo-asset55.0.20 at the root, rather than patching node_modules
or relaxing native metadata parsing. Full cycle restarts at npm ci.


-2026-11-19 F wholecycle3:431 host/TS/lint/clean prebuild/QAarm64 assembly and
 manifest assertions passed (226 executed build tasks). Native step8 stopped in
 the temporary force-execution harness: its projectsEvaluated callback also ran
 for RN's included Gradle plugin build, where :chatstamp-native does not exist.
 try another way: scope the temporary task override to builds that actually own
 that project. No product assertion or connected test was weakened. Full cycle
 restarts from npm ci; CI uses its separate resolved-toolchain task.


## 2026-11-19 — E/F accepted in the executed scope; final code6 handoff

Final app source3f4ab91 (later changes are documentation/listing/check config).
The wholecycle4 passed npm ci, strict TypeScript,431 Vitest/46files, lint,
clean prebuild,226 executed QA build tasks, arm64 QA manifest/APK checks,
40 freshly executed JVM cases and39 connected cases on EACH API30/API36,
zero failures/skips. Debug QA cold launches rendered onboarding on both, with
empty per-process crash buffers. Python verifier/CI-harness81 tests pass;
strict i18n318 keys/zero issues and pinned Knip6.46.0 files/exports/types scan
zero issues. The tracked Knip config makes its Expo/native entries reproducible.
Fresh GitHub Android CI44406963599 on3f4ab91 passed431host/81Python/40JVM,
93 executed build tasks, actual resolved SDK36/min30/build-tools36/NDK27.1.12297006
and strict merged release permission/backup checks. Pages CI is separate.

Role closure: implementer caller-checked cleanup froze18edited/16deleted files;
test author moved duplicated legacy wrapper tests onto actual Screen/List/Viewer
boundaries (451→431 is an explained migration, not relaxed parser/date/cancel/
hidden-selection criteria); reviewer corrected the inert NDK pin and AGP getter
shape, then cleared source/docs review. The8 signing cases, C17 cancellation/
summary cases, atomic history and real500/5000 cell/player suites remain.

Both code6 signed production and QA artifacts pass verify-release.py with the
established upload certificate efe36695cfc6a3d9ea8471527103f29e3374322ab09890af41692412d76a66c8.
Production AAB dist/play/chatstamp-0.2.0-6.aab SHA256
591654c0bbe5c7e118acfe32e68e45156559251f12738a9c2bfb780cf5062394.
Production universal APK aec0ad7f0b9f737f6a6c20b349d7c34045442df4bc6f5d16646b4e87c5b0ef5b.
QA AAB3dde63f217d3991f603f9dd2217a81fa7a19ff672f038c481870d376a4600fec;
QA APK33031bd87f77a5bfa8cbb374be3a392c48dc471eb54a3f22da21a5cad4071fed.
Identity0.2.0/code6/min30/target36/nondebug/signature/payload/backup/permissions
pass. Every64 packaged ELF is inventoried:32 ELF64 required16KiB cases pass;
32 genuine32-bit cases retain raw values and explicit NOT_APPLICABLE. Bundle
alignment and universal APK zipalign pass. Actual16KiB-device runtime is still
UNVERIFIED; this is static verification, not a substituted runtime claim.

Final physical A30/API30 minified run:5new saved/5message dates verified agree
with independent MediaStore DATE_TAKEN/DATE_MODIFIED, filesystem mtime, JPEG/PNG
EXIF and both MP4 creation times. Samsung Gallery default creation-date descending
shows purple,yellow,blue,green,red in RTL reading order; red details15Feb2019
10:30. Same-language and HE→EN duplicate runs preserve all5URIs/paths and one
folder, with0new saved and Already saved details. Native same-bundle restarts
apply actual LTR/RTL in both directions without Metro. Native aggregate labels
clear mixed on all/none/narrowed/empty states;130% empty scope is disabled and
hidden TXT stays unchecked. Actual image double-tap grows the yellow area810→1552px.

Both EN/HE fresh512MiB four-video saves complete4saved/4verified after Back/Home.
Own foreground service remains active after Home; own progress notification is
observed, and expanding the Hebrew notification exposes Cancel. Eight independent
full-size output rows match expected indexed dates/modified dates. English11.17s
actual final demo shows Save/Cancel, own2/4 background notification and4/4results.
Variable-frame recording export was corrected by applying CFR before trim;
only the own notification rectangle is retained at its original position, with
black redaction elsewhere. Raw full-shade media was temporary and removed.

Final physical40-video regression:0 grid players after scrolling,1Init/1Release,
peak1/final0, actual native playback00:00→00:02. No final QA crash-buffer entries.
All8 store screenshots replaced with direct physical code6 captures (1080x2160,
RGB24, synthetic, native language direction); exact hashes/provenance tracked.
API36 final reviewer run independently passed5/5 readback with notifications
denied, actual EN↔HE root/modal restarts,130% phone/600dp modal actions, native
aggregate transitions, MP4/OPUS playback+seek,3Init/3Release peak1/final0.

Limits remain explicit: unavailable API33 physical; owner WhatsApp own-share
closed/warm real export; full every-screen×8configuration matrix; arbitrary
providers/Galleries/codecs, dark/wallpaper palette refresh and actual16KiB
runtime. Concurrent policy-race injection is host-tested, not claimed as a
minified runtime injection. Provider revocation and the narrow process-death
row-record window remain deferred per v4. Owner Chrome first-run blocked actual
policy-page rendering, although public URL and installed intent were verified.

Cleanup passed: phone13owned rows,4source ZIPs, recordings/window XML and QA/helper
removed; no own run rows or chatStamp/test packages remain. Original phone
1080x2340/density420/font1.1/timeout600000/stay-awake7 restored, no reverse ports.
Emulator reviewer removed5owned rows/fixtures/QA/helper, restored original
1080x2400/density420/font1/stay-awake1/timezone and removed reverse/scratch.
App-level discards preceded OS uninstall; release private cache was not read
through run-as. Production package stayed absent and was never installed/replaced.

Audit37→11 findings (9moderate/2high/0critical), all remaining packages have a
one-line disposition. Exact production Hermes map1016sources includes26Expo
runtime modules and one @expo/cli standalone Metro loader; reviewed loader has
no advised implementation, and glob/minimatch/zod plus other seven affected
Node-tooling packages are absent. See DEPENDENCY_AUDIT.md and the artifact-scoped
receipt; no universal dependency-safety or zero-audit claim is made.

G2 manual handoff is concrete: signed production AAB, isolated QA installer,
privacy-safe demo, bilingual refreshed listing/declarations, exact owner upload/
real-export steps and truthful production-access inputs. Play service-account
path remains unset. try another way: owner manual upload; no Console automation,
Play upload/live track/tester opt-in clock, production approval or merge claimed.
One final PR and head/CI receipts are recorded by the G2 closeout entry.

Small current proof is together under ignored dist/android-verification/rebuild-20261118;
requested binary/demo product files are separate under ignored dist/play. Store
assets and docs/screens are tracked. Combined proof/listing/screens remain under
10,000,000bytes; final exact size is recorded at handoff.


## 2026-11-19 — G2 owner handoff and PR opened

PR1 is open: https://github.com/MeniViner/chatStamp/pull/1, fix/core-rebuild→main,
created at branch head d3634a42c4333dfe075506b7689f49085b32dfdb. It is not merged.
Final code6 binary app source remains3f4ab91; subsequent commits update docs,
listing assets/check configuration and receipts. Current final head/CI are
recorded in the local primary report and PR checks rather than self-referencing
this commit. The production package was not installed or replaced.

Owner can now use the signed code6 AAB, isolated QA APK and11.17s actual synthetic
FGS demo under dist/play, the8updated store screenshots, live privacy URL and
numbered PLAY_UPLOAD_STEPS. TESTERS contains exact closed-app/warm WhatsApp
own-share acceptance and isolated installer commands, plus a private result form.
PLAY_RELEASE_CHECKLIST has truthful production-access inputs; external tester
counts/continuous opt-in/feedback and account creation date stay UNKNOWN.

No service-account path was configured. No agent Play upload/live track/tester
clock or production approval was established. The owner must upload manually,
publish an accessible demo URL, confirm account/audience/legal fields, recruit
qualifying testers and record the actual interval/feedback. Real owner export,
API33/full UI matrix, actual16KiB and remaining platform/provider limits remain
UNVERIFIED with exact follow-up in the primary report. QA/helper/test material
is removed and original phone/emulator settings restored. No cross-chat watcher,
recurring check, merge or automatic production rollout was created.


-2026-11-19 late CI note: d3634a4 push run44415277957 passed host/tooling
 checks but failed native configuration because Maven resolution reported
 com.google.code.gson:gson:2.9.1 missing in the repositories. Its official Maven
 Central POM independently returned HTTP200 (8208bytes, SHA256
 e5966323d7142570b37a4be979e21bc2dae848107e4dc416d8f44d9aa3f02903).
 Earlier full fresh runs3f4ab91 and6f3178f passed the identical app/dependency
 source. try another way: require the complete final-head push/PR checkout to
 rerun npm ci through native/JUnit/manifest gates; no continue-on-error, source
 dependency override or skipped test is introduced. Final run outcome/link is
 recorded in the primary report after completion.

-2026-11-19 G2 roles closed: implementer independently rehashed final AAB/QAAPK,
 checked demo/screens and finalized owner availability dates in upload steps;
 test author prepared concrete real-export closed/warm/privacy-safe result steps;
 reviewer found no material handoff issue, confirmed artifact/screens/demo and
 reverified the public policy HTTP200 byte-identical to tracked HTML. Owner-only
 gaps remain explicit. Device hygiene is complete and app source unchanged.


-2026-11-19 F CI transport repair: final-head MavenGson2.9.1 resolution failed
 again after a full fresh verify-job retry. try another way: a CI-only four-file
 repository fetches the unchanged Gson2.9.1 POM/JAR and parent POMs from the two
 official Maven Central hosts, validates pinned SHA256/size before atomic publish,
 and fails closed on tampering/missing/unsafe paths. A beforeSettings hook reaches
 composite builds, admits only those exact three GAVs, preserves Plugin Portal
 and ordinary Android buildscript repositories, and revalidates bytes before
 Gradle uses them. It neither patches node_modules nor changes runtime versions,
 package identity, signing, native app source or the existing code6 binaries.

 Implementer live official fetch/verify-only passed4/4; independent test author
 added24meaningful transport/integrity/cache/atomic/path regressions. Combined
 Python suite105/105 passes. Root's actual Gradle execution with both CI hooks
 passes resolved SDK/NDK,40 freshly executed JVM tests and production release
 manifest; strict ci-policy passes. Reviewer checked the composite/default-portal
 trap before implementation. A new fresh GitHub checkout must pass the complete
 npmci→host→prebuild→pinnedfetch→native→manifest path; no tests are skipped or
 marked continue-on-error. Final current CI link is recorded in the report.


- 2026-11-19 CI workflow evaluation correction: the first bootstrap push b51bd00
  was rejected before any job because runner.temp is unavailable in job-level
  env. try another way: define the identical runner-local repository in the
  fetch and Gradle step env blocks, where runner is supported. Official context
  table: https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability.
  No host/native gate was skipped. The earlier ea45a36 push CI44417140377 also
  completed successfully; its separate PR retry had failed Maven resolution.


- 2026-11-19 CI transport accepted on5e0917f: independent reviewer clear. Fresh
  GitHub PR run44421242295/job135214500429 passes checkout/npmci,431host/46files,
  TypeScript/lint,105Python,cleanprebuild,4/4pinned official artifact downloads,
  resolved SDK/NDK,40executed JVM,93executed Gradle tasks and strict production
  manifest/backup policy. https://github.com/MeniViner/chatStamp/actions/runs/44421242295
  Three newly read PR product findings are now being fixed separately: invalid
  retry after runtime recreation, silent share100 truncation, and stale parsed-
  import cache ownership. A new code7 artifact/fullsmoke/runtime gate follows;
  this CI checkpoint does not certify those uncommitted source fixes.


## 2026-11-19 — PR product review fixes, code7 source checkpoint

The three externally raised P2s were reproduced with independent acceptance
tests: runtime recreation could leave a visible empty Retry; category sharing
silently truncated after100; a superseded import could retain its extracted
job after native extraction finished. try another way: explicit reimport when
retry inputs are absent plus a no-empty-save guard; one shared Done/History
batch sheet with explicit ranges/Previous/Next and a separate chooser gesture
per at-most100files; native and JS oversized requests reject rather than cut.
The chooser opening is never described as successful delivery. Stale import
results release their exact job/grant before replacement; same-source grants
remain readable. Cleanup errors block replacement and retain cleanup context.
A second deferred-snapshot interleaving now reads current cleanup ownership
after awaits, so a just-published import result cannot be lost by reset.

Test author added25criterion regressions (10recovery/cleanup,15sharing) and
corrected the existing coordinator fixture to contain the1file its unchanged
21save assertions already modelled. Root full smoke from npmci passes
456Vitest/48files, TypeScript/lint, clean prebuild, two-worker arm64 QA assembly
(226executed tasks), QA manifest,40fresh JVM and39connected on each API30/API36
with0fail/skip.105Python and unused-source check pass; i18n has325keys with
parity/zero-unused assertions. Final source review, phone debug cold launch,
signed code7 artifact checks and minified runtime are separate pending gates.
The phone is locked; the owner unlock request is pending while builds and
emulator work continue. Earlier code6 artifacts remain historical candidates.


- 2026-11-19 code7 review gate failed despite green smoke: reviewer found that
  an old import cancellation can resume after replacement and discard the new
  import; async discard cleanup can similarly reset replacement state. try
  another way: fence or serialize lifecycle ownership, and add independently
  deferred cancellation/release regressions before rebuilding code8. Code7
  signed production/QA strict artifact checks passed, but code7 is superseded
  and was not accepted for final handoff or uploaded. No code7 media save was
  performed. Debug cold screens rendered on both devices with zero app crash
  entries; those checks do not waive the review finding. The first QA bundle
  command used the debug-only hook and stayed production-ID; this was caught
  before any installation. try another way: use release-test.init.gradle,
  then require the QA identity in strict artifact verification before install.


- Code7 UI harness correction: the isolated UI helper installation was rejected
  as TEST_ONLY before launch. try another way: install that known test APK
  with adb install -t; do not alter the product APK or testOnly policy. This
  tooling failure did not change product source or save any media.


- Code7 fresh CI44423400404/job135221916850 passed456host/105Python and native
  execution, then correctly rejected Native and application versions differ:
  root had raised Expo versionCode without updating the durable module Gradle
  versionCode. try another way: synchronize both to8 before the next complete
  clean-prebuild cycle; retain the source/manifest identity guard unchanged.
  The failed gate was not treated as a successful current CI run.


- 2026-11-19 code8 ownership fix: independent source reviewer reports no remaining
  material finding. A serialized transition queue covers cancellation, discard
  and replacement setup without holding extraction/parsing; captured identity
  and synchronous pending-transition fences protect the replacement, Save and
  language restart. Test author independently reran49/49 focused cases: recovery13,
  sharing15 and coordinator21. All3P1 regressions changed from red to green with
  unchanged assertions. Root restarted the entire smoke at npmci;459host/48files,
  typecheck/lint and cleanprebuild pass so far. Native, signed artifacts and final
  minified runtime gates are still pending; no code7 acceptance is substituted.


- 2026-11-19 code8 full smoke accepted: npmci→typecheck→459Vitest/48files→lint
  →cleanprebuild→two-worker arm64QA(226executed)→strictQAmanifest→40freshJVM
  /39connected on each API30/API36(0fail/skip)→actual offline cold onboarding on
  both devices with zero PID crash entries. No Metro or ADB reverse was needed.
 105Python and unused-source checks pass. Independent source review is clear.
  App and durable module both use versionCode8; signed artifact/current fresh CI
  and minified runtime follow on this exact source. No Play upload or merge.


- Code8 pre-install harness guard matched the helper's package prefix as if
  production were present. try another way: compare exact package-list entries
  instead of substrings; production remains absent and protected. No install
  occurred before that assertion was corrected; no source/test criterion changed.


## 2026-11-19 — Code8 fresh-install Hebrew surface gate

Code8 source1992c38 full smoke459/40/39each+105, fresh CI44425759475
/job135230045587 and both signed strict artifacts passed. Production AAB SHA256
c9ba6655fb222871351a9014216dd011e3088b097dd7e862cbfce3dc46097d38;
QA APK7a7beb7371d4eb9757ed67871b53df5e5d7b7876f55ea8fc3b8085da6c1122de.
However fresh minified API30/systemHE onboarding and first Import rendered
LTR (badge x36–233, actions right), without the initial restart prompt.
Settings rendered RTL; returning to Import remounted it with badge x846–1043
and actions left, without a language change or restart. The reviewer traced
ReactSurface native direction capture before JS versus cached I18nManager
constants: awaiting the JS sync does not establish mounted surface direction.
This first-launch E case is a real failed acceptance, not a verified RTL pass.

try another way: configure native language policy before ReactSurface creation
through durable source/plugin integration, preserving committed EN/HE/system
preferences and failing safely on invalid/unreadable settings without data
overwrite. Do not add a JS direction override or another Promise around the
same cached constant. Code9 is the next candidate; whole smoke, signed checks
and actual fresh-HE first-screen proof must repeat. No code8 Play upload or
physical media save occurred. Its API36 reviewer five-file readback5/5 with
notification denial is a scoped intermediate checkpoint, followed by cleanup.


- Code9 independent startup tests exposed a plugin recognition bug: a commented
  native policy call was counted as installed. try another way: mask comments
  (including nested blocks), strings/raw strings and quoted literals while
  preserving offsets, then require exactly one executable hook as the first
  statement after super.onCreate and before React startup. Unknown/ambiguous
  templates fail closed. The unchanged13newVM+8existing signing tests now21/21
  pass; source reviewer clear.6newJVM and8connected criteria cases are authored.
  Root restarted full cycle:472host/49files, typecheck/lint, cleanprebuild with
  actual generated-hook ordering/supportsRtl assertion, arm64QA226executed and
  QAmanifest pass. Actual native execution and first-surface runtime follow.


- Code9 cycle1 reached native execution:46JVM pass, but8new connected setup
  cases fail on each device because the standalone native-module test host
  lacks FLAG_SUPPORTS_RTL. The other39 cases per device pass. The generated
  product QA manifest already declares RTL support; the standalone target does
  not execute the Expo config plugin. try another way: declare supportsRtl=true
  on the module's own application manifest, keeping the actual-manifest/native
  direction assertions unchanged. Restart the whole cycle from npmci after
  this source manifest correction; do not treat the failed connected gate as pass.


- 2026-11-19 code9 cycle2 accepted: npmci→typecheck→472Vitest/49files→lint
  →cleanprebuild with actual startup-hook/manifest ordering→arm64QA226executed
  →QAidentity/SDK/FGSpolicy→46fresh JVM/47connected EACH API30/API36,0fail/skip.
  Offline cold onboarding renders on both; physical firstHE badge x846–1043 is
  correct before Settings/language change/remount,0PID crash entries and noMetro
  orreverse.105Python/unused-source checks pass. All source review findings are
  resolved. Signed code9/current CI and minified firstHE/Gallery/runtime gates
  remain separate; no older binary is substituted.


- Code9 physical first-five PASS:5saved/5verified; independent MediaStore taken/
  modified, filesystem mtime, image EXIF and both MP4 creation times match.
  Samsung Gallery12.1.09.1 default Date created/descending was inspected without
  changing it; RTL order purple/yellow/blue/green/red and red Details15Feb2019
 10:30 pass. HE duplicate run reports0new/0newdateverifications; external
  comparison preserves all5URI/name/path identities and one folder.
  Picker harness initially searched Downloads before entering its own run
  folder. try another way: enter the exact run folder and select its ZIP. A
  synthetic adb ACTION_SEND then lacked a usable source read grant and correctly
  surfaced PERMISSION_LOST. try another way: use the actual system picker grant
  for the large fixture. No app permission was broadened and no source change
  was made for either harness correction; real WhatsApp own-share stays unverified.


## 2026-11-19 — Code9 signed/runtime closure; final history follow-up

Exact app sourcea3dea2a/code9 passed strict signed production/QA checks and CI44432611264 (472host/105Python/46fresh JVM plus resolved Android policy). Full local smoke472/46/47connected each passed. Physical fresh system-HE first surface is native RTL before Settings/remount; five-file indexed/mtime/EXIF/MP4 readback and Samsung creation-date order/2019Details pass. HE/EN Skip-existing retains all5identities. Actual HE512MiB/EN1GiB background saves each4/4 and physical101-file Done sharing exposes100+1; no destination/send chosen. Independent API36 scope includes persistedHE, both native direction changes, denied-notification5/5, exact101URI sharing/History,130%phone/600dp and MP4/OPUS lifetime. Phone removed114owned rows/4ZIPs and QA/helper; emulator removed106rows/3ZIPs and restored settings. Raw shade/recording remained temporary and was removed.

Code9 screenshots and8.125s own1/4notification demo retain their exact provenance; they depict the unchanged UI/native FGS in code10, not captures10. Cloud review then found fingerprint-only history IDs could erase earlier keep-both/destination outputs; independent reviewer also caught loss of a known custom-tree handle on cold terminal replay. Code10 corrects these with stable import sessions and output identities, with new independent red→green cases. try another way: preserve same-session retries/replay and old records, rather than grouping separate imports by fingerprint. First code10 cycle reached489host/QA manifest then correctly stopped before native tests because prior physical cleanup had not yet completed; no gate was waived. Restart the full cycle after replay fix and cleanup.


### Code10 complete source/debug cycle — 2026-11-19

Independent reviewer source CLEAR after custom-tree replay correction; author25new cases retain allprior17 (isolated prior13FAIL/4PASS, replay-safeguard-only backout4FAIL/21PASS). Wholecycle2 passed497host/50files,46fresh JVM,47connected perAPI30/API36,105Python, typecheck/lint, cleanprebuild,226executed QAassemblytasks and actual offline first screens with0QAcrashes. App source895cf0247f4c11126ee48e8462f8981d3338a777 pushed withoutforce. try another way: run Knip with the repository's existing explicit package-entry config (empty module entry is named by package metadata), yielding0unused issues; use existing node scripts/i18n-audit.js because no npm alias exists. No product gate was weakened. Release QA verification initially used a mistyped temp APK path; corrected the path and repeated the full unchanged verifier. Signed/runtime results follow separately.


### Code10 exact signed/static and fresh app-source CI — 2026-11-19

ProductionAAB SHA256bd2dda4f1d7365137d89ae2fad6d3bf8b23abcbf450948a1c114f3f0e2395114 (50,952,250bytes); QAAPK SHA256c0fb4d2616435f644ebbd7279878daa01f6623200e2745e61f9cd0a0921f8fc8 (69,623,951bytes). Existingcertificateefe36695…a66c8reused; both complete verifier reportsPASS (productionuniversal0f02464e…d0168; QA AAB5efc2b8a…56c7). Min30/target36, signatures/fullpayload/minified, exactpermission/backup and all64ELF/static16KiB gates unchanged/passed. Actual16KiB runtime notclaimed. ExactproductionHermes map1018sources includes26Expo runtime+oneCLIrequirebootstrap; otheraffectedowners0.

Fresh sourceCI44441593832/job135283494659 passes497host/50files,105Python,4official pinned Mavenfiles verified,46executed JVM/0skip,93Gradletasksall executed and exactcode10release identity/permissions/backup. Phone freshsigned10HEfirstonboarding is nativeRTL before Settings (bounds826,185→1043,232 atoriginalfont1.1),0QAcrashes. Affectedphysical/API36save/history acceptance remains inprogress. No Playupload.


### Code10 superseded by native pre-start cancellation fix — 2026-11-19

Cloudreview895cf02 found a valid narrow race: a default IO launch can be cancelled after publishing its Job but before its body starts, skipping existing catch/finally/NativeOperations.finish and leaving the promise/UI/job nonterminal. try another way: guarantee terminal finalization even for pre-start cancellation, with independent deterministic regression controls, then rerun the entire cycle as code11. Code10 passing tests/artifacts/observed phone5+2019Details and emulator keep-both/cold-history/disjoint-share facts remain code10scope; they do not certify this previously untested cancellation window. Final handoff11is OPEN.


### Code11 native source freeze — 2026-11-19

Independent source review CLEAR for SaveWorker and service after related ownership issues were closed: ATOMIC entry with ensureActive prevents prestart outputs but always enters failure/finalization; cancellation/timeout waits for cancelling cleanup; service stop ownership check and both stop attempts serialize on MAIN; NativeOperations.finish publishes terminal only after the stop attempt. Startup failures follow the same order. Acknowledged old workers cannot drop an accepted next start; stale Cancel deliveries cannot stop the next owner and idle stale deliveries stop their own startId. A stopped-owner marker prevents duplicate stop callbacks. No output/date/history policy was replaced.

Test author derives13pure scheduling/control cases and5actual lifecycle/registry cases before readingfix, including a manually paused DEFAULT negativecontrol, real document readback and stop-failure settlement. Nativebuild/bothdevices are leased solely to the author for focusedred→green; full11smoke/signing/runtime remain pending. [Kotlin ATOMIC reference](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/-coroutine-start/-a-t-o-m-i-c/) and [Android Service lifecycle](https://developer.android.com/reference/android/app/Service) were checked for scheduling/stop semantics.

## 2026-11-19 — E/F accepted in the executed scope; final code11 handoff

Final app source **138e00c8bc3f991b9d984cf79075501b566b3f40**, **0.2.0 (11)**, branch **fix/core-rebuild**. R → B-close → C → G1 → D → E → F → G2 are complete within their explicitly executed scopes and the task's manual-upload fallback. PR #1 is open and unmerged. No Play upload, available track, qualifying tester clock or production approval is asserted.

**Complete code 11 smoke:** `stage-f-final-11-1` passes npm ci, TypeScript, **497 tests/50 files**, lint, clean prebuild, native pre-React RTL hook/supportsRtl, **226 executed QA assembly tasks**, exact SDK/manifest/dataSync policy, **59 fresh JVM and 52 connected cases on each API 30/API 36 device**, zero failures/errors/skips, and offline first screens with zero QA crashes. **105 Python verifier cases**, 325-key i18n parity/zero unused and configured Knip 6.46.0 with zero issues (five hints) pass. Fresh app-source [CI 44447719684](https://github.com/MeniViner/chatStamp/actions/runs/44447719684), job 135303820924, passes 497 host/105 Python/59 executed JVM/zero skipped, four official pinned Maven files, all 93 Gradle tasks executed and exact code 11 release policy. Final documentation/assets-head CI is linked from the local REPORT; it does not change the binary app source.

**Native regression:** atomic worker entry checks cancellation inside try/finally, awaits cleanup and main-thread-owned service stop before terminal publication, and handles stale owners/startup failures. Independent source review is CLEAR; cloud review on `138e00c8` has no findings or unresolved findings. All 13 new JVM and five connected lifecycle cases pass on both devices. An isolated ATOMIC→DEFAULT control fails four JVM cases and the actual native pre-start case. `save-worker-prestart-code11.json` records source hashes/results. The 25 independent History regressions retain original-source **13 FAIL/4 PASS** and replay-safeguard-only backout **4 FAIL/21 PASS** controls, then final **25/25 PASS**.

**Exact products**, together in `dist/play/release-0.2.0-11/` with README/SHA256SUMS:

| Product | Bytes | SHA256 |
| --- | ---: | --- |
| Production AAB | 50,956,189 | `999cbcc1883377bc5965a7665ec20b837eb76ce9ae9597530de0b3ed149fd4ab` |
| Isolated QA APK | 69,623,951 | `d4ae6f8143068ff7c6c29d869c04021827f4d251afa35a8b4c2c66b0f935c74f` |
| Fresh actual code 11 foreground demo | 81,486 | `d319af658e5a35e16e7bea13ce0af8d74902f4bf12415f19efe60bcca29b7519` |

Both exact artifact reports PASS signature/full payload, identity/version, nondebug/minified, min 30/target 36, intended permissions/backup, all 64 ELF static checks (32 required ELF64 16 KiB passes; 32 genuine 32-bit N/A), bundle configuration and APK ZIP alignment. Existing upload certificate `efe36695cfc6a3d9ea8471527103f29e3374322ab09890af41692412d76a66c8` was reused; no replacement key. **Actual 16 KiB execution remains UNVERIFIED.** The exact 1,018-source Hermes map includes 26 Expo runtime sources and one standalone CLI require bootstrap; the other ten affected Node owners are absent. Locked audit remains 11 findings (nine moderate/two high/zero critical), with explicit tooling dispositions.

**Minified physical 11:** A30/API 30/Gallery 12.1.09.1; fresh system-HE first surface is native RTL with zero crashes. Five saved/five verified files independently pass indexed dates, filesystem mtime, EXIF and both MP4 dates. Existing Date created/Descending choices remain unchanged; actual album order is purple→yellow→blue→green→red and red Details shows 15 February 2019, 10:30. HE/EN Skip-existing retains all five identities/dates with zero new copies. Native HE→EN reload and separate persisted-English cold start pass. Expo's native React reload may retain its PID; the harness's PID-change expectation was corrected without a product change. A fresh 1 GiB/four-video background run survives Back/Home, shows foreground admission/one Cancel action and an own live 1/4 notification, then finishes 4 saved/4 verified with no FGS. All four large outputs independently match complete size, indexed dates and actual mtime; full internal MP4 readback is separately covered by the core five-file/API 36 timeout scopes.

**Minified API 36:** notification-denied 5/5; a Keep-both second import retains ten dated outputs, two cold History records and disjoint five-URI choosers. Actual official dataSync timeout on 24 videos yields **12 saved/12 verified/0 failed/12 cancelled**; service stop follows ActivityManager's real timeout by 9 ms, Home stays resumed, all 12 published files pass independent full-size/frame/date readback, and no pending/partial output or FGS remains. First attempt had an inconclusive admission precondition. **try another way:** wait for actual foreground admission, then apply the real platform control; no callback was faked. Historical code 9/10 receipts separately own 101-file batch sharing, selected layouts/fonts, both language directions and playback; these are not claimed as rerun on 11.

**Physical Cancel-selection limit:** the final notification harness never reached SystemUI; an alternate visible-app harness missed the Saving accessibility window. No Cancel action was selected, so no final physical UI-action pass is claimed. Both extra Keep-both runs completed 4/4 and their eight outputs were full-sized/dated. `f11-phone-cancel-scope.json` gives exact next steps. Native lifecycle and actual API 36 timeout passes remain separately scoped.

**Demo/assets:** the fresh 8.25-second code 11 clip is H.264 540×1080/24 fps without audio. Actual Saving/visible Cancel, own live 1/4 notification and actual 4/4 Results frames were inspected. Cuts remove waiting/Home transitions; notification crop/pad blacks out unrelated content in its original position. No UI/progress is invented. Raw recording/full shade files were deleted. No reviewer URL is published; the owner must host it. Eight PNGs retain exact code 9 source/binary/1080×2160 RGB24 provenance for the unchanged depicted UI. All eight hashes/dimensions and EN 9/69/1852 versus HE 9/61/1603 text limits pass.

**Cleanup:** app-level Start over returned to Import, then 17 exact owned outputs/two ZIPs/QA/helper/scratch were removed. A strict query found two stale directory index rows. **try another way:** verify exact run paths, directory types and absent files, delete only IDs 777/784, then repeat the complete zero-result check. Original phone 1080×2340/density 420/font 1.1/timeout 600000/stay-awake 7/Asia-Jerusalem was restored; no run MediaStore/Downloads/QA package/reverse remains. API 36 removed 46 outputs (24 inconclusive + ten normal/Keep-both + 12 timeout), two ZIPs/packages/scratch and restored all captured settings/timeout controls. Root independently read the originals and shut down the emulator. Production was absent before QA and untouched. OS uninstall removes private data after app discard; no release run-as inspection is claimed. Receipts: `f11-phone-runtime.json`, `f11-phone-cleanup.json`, `stage-f11-emulator/f11-emulator-runtime.json`.

**Owner gates:** real WhatsApp own-share closed/warm, API 33 physical/full UI matrix, actual 16 KiB execution, installed-browser policy rendering, arbitrary providers/Galleries/codecs, dark dynamic palette and final physical Cancel selection remain UNVERIFIED with exact steps. Mid-read revocation and the narrow process-death window remain deferred per v4. Manual upload, hosted reviewer URL, account creation date/audience/legal facts, actual track availability and genuine 12-tester/14-day eligibility where applicable remain owner actions, available 19 November. No Console automation was used. Public policy returned HTTP 200 on 19 November with 14,306 bytes/SHA256 `637d43fb8a8665bcc02d86bc66521094d8a2e5e658eee5436862940867649040`; authorized support is meniviner@gmail.com. The local REPORT lists every gap/next step and the measured cumulative evidence total below 10,000,000 bytes.


## 2026-11-19 — Play Console continuation authorized by owner

The owner superseded the earlier manual-only Console instruction and requested app creation, listing/artifact uploads and all existing tester lists. The owner explicitly approved the two app-creation legal declarations at action time. Created **chatStamp**, production package **com.menis.chatstamp**, app ID **4974511742201615518**, in the existing personal account. Internal version **0.2.0 (11)** is now shown **active** after actual production AAB upload, processing and two-step save/publish. Console displays min30/target36 and four ABIs. All five existing account lists were saved: list1(4), list2(7), Tank Malle – Internal(1), friends(6), family(2). These20memberships are not a unique/opted-in count. Enabled internal opt-in URL: https://play.google.com/apps/internaltest/4700119235354966099 . Closed testing is still gated on app setup; zero closed opt-ins shown. No production rollout.

English listing saved with icon/feature graphic and four actual phone PNGs in stage order. Hebrew text/four phone captures are being completed. Play requires the locale tag **iw-IL**, not repository locale **he-IL**; the unsupported-tag validation was corrected without changing the text or app. try another way: the listing Add-assets button opens a separate asset-library drawer; use its Upload control, then select/apply each asset. The AAB chooser itself works. AI-assisted brand graphics are labeled separately; actual screenshots are not relabeled AI.

The exact81,486-byte synthetic code11 foreground demo is copied to **docs/media/chatstamp-0.2.0-11-fgs-demo.mp4** for the existing public Pages source, SHA256 **d319af658e5a35e16e7bea13ce0af8d74902f4bf12415f19efe60bcca29b7519**. This is a requested reviewer-facing product, not a raw recording or new runtime test. Public availability must be verified after Pages deployment before using its URL. Final Console status, remaining declarations, real-export gaps and private invitation delivery are recorded separately; no tester period or production approval is inferred.


## 2026-11-19 — Console setup completed through the IARC agreement gate

Existing app4974511742201615518 now has **active internal0.2.0(11)**, complete saved EN/HE listings, logo/banner and four actual phone images per language, public support/policy, Tools/free/18+ configuration, no-login/ads/data-collection/government/financial/health/Advertising-ID declarations and local Import/export dataSync with the body-verified public81,486-byte demo. All five existing lists are saved for internal and Alpha (20memberships, not unique opt-ins), with no private-address export and no email invitations sent. Alpha uses the same artifact selected from the library, bilingual release notes,177countries plus Rest of World and feedback; **15changes saved, not submitted/available**. Console explicitly requires12continuous closed opt-ins/14days and shows0.

Only required content declaration remaining is **content rating**. Owner agreement to the additional IARC terms was requested at its actual unchecked legal box; categoryAll-other-app-types/contact are prepared. Until that approval, do not accept terms or invent a rating. The second pre-check issue is an availability warning for `android.hardware.screen.portrait`, affecting some tablet/Desktop/XR hardware. The verified phone-focused native scope/bytes were not changed. No production rollout/approval or qualifying test period is claimed.

try another way: Add-assets opens a library drawer; upload through its Upload control, then explicitly select/apply. Batch insertion used completion order, so existing library assets were applied individually and reordered to Import/Select/Saving/Results in both locales. Hebrew upload aliases in TMP preserve exact original SHA256, avoiding duplicate-filename ambiguity without copying old evidence into the current set. Some custom Advertising-ID controls ignored Playwright events; fresh AX indices and the documented CUA click applied No/Save, then the saved outcome was observed. No browser/auth security protection was disabled.

The public demo HTTP200/SHA d319af658e5a35e16e7bea13ce0af8d74902f4bf12415f19efe60bcca29b7519 matches the verified product. Source checkpoint055ea27 has successful Pages44519035516 and PRCI44519046435. Its push CI44519037756 failed closed because the exact official Central Gson2.9.1POM was unavailable; same-head PRCI passed, and only the failed job was retried unchanged. Final CI retry/head outcome is kept in the local Console receipt. Signed app source138e00c8 and all device/artifact facts remain unchanged.

Current checkpoint: `dist/play/console-setup-20261119/README.md` and console-state.json, with only relevant small screenshots. Previous proof remains at its original location; cumulative evidence including Console files, all docs/listing and both small demos is measured below10,000,000bytes. PR1 remains open/unmerged. Owner real WhatsApp, API33/full UI,16KiB execution, browser acceptance and scoped/deferred gaps remain explicit.


## 2026-11-19 — Code12 optional portrait hardware source freeze

The owner completed IARC/content rating; the current publishing issue is only
`android.hardware.screen.portrait`. It is a hardware availability filter, not a
new storage/media permission. Code12 keeps the portrait activity request and
adds one explicit optional feature through the durable manifest plugin, with a
scoped required-attribute merge override. Both version codes are12;0.2.0,
production identity, permissions, dataSync, backup, dependencies and upload key
are unchanged. Code11 artifacts remain immutable.

Independent implementation/test/review roles report source CLEAR, including
seven public-plugin tests and eleven artifact-policy cases. Code12+ policy
rejects missing/default-required/true/duplicate portrait requirements and
requires the unchanged portrait MainActivity; historical11 policy is retained.
The fresh root host suite passes504tests/51files and116Python cases. Clean
prebuild,226-task QA assembly,59fresh JVM tests/zero skipped and code12 merged
release policy pass. Connected/cold-launch, signed12 artifacts, exact minified
runtime and Console replacement remain in progress. The A30 is connected but
locked; owner unlock was requested without attempting to unlock it.

try another way: Expo CLI resolves its `--device` argument by device name, not
ADB serial. The initial selector failed before installation. Use the observed
AVD name `chatstamp-api36-20261118` and restart the complete smoke at npm ci.
This is a harness admission correction, not an app failure or acceptance waiver.
[Android screen-feature guidance](https://developer.android.com/guide/topics/manifest/uses-feature-element#screen-hw-features).


## 2026-11-19 — Code 12 verified and submitted to Google

Signed **0.2.0 (12)** is **active and available to internal testers**. The same uploaded AAB was selected from the library for **Alpha**, replacing the pending code 11 release. **All 16 changes are submitted and shown “Changes in review”**, including Alpha 12, both listings, content rating and the other prepared declarations. The owner completed IARC; the former portrait hardware issue is resolved. No closed availability, invitation-email delivery, qualifying tester period or production approval is inferred.

Exact code 12 app/config source: **b2b88e9d3ef8292d00ef695f328a225cbb9b2418**. The complete restarted smoke passes npm ci, TypeScript, **504 host tests/51 files**, lint, **116 Python cases**, clean prebuild,226 executed QA assembly tasks, **59 fresh JVM tests/zero skipped**,52 connected cases on **each API 30/API 36** and offline startup. Production/QA signature, identity, permissions/backup, all 64 ELF static checks and ZIP/bundle16 KiB policy pass. AAPT2 independently lists portrait only as optional. [PR CI](https://github.com/MeniViner/chatStamp/actions/runs/44526874420) passed; the simultaneous push run initially failed before tests on unavailable official Central Kotlin artifacts, then its unchanged failed-job retry passed. No assertion or dependency version was relaxed.

Exact minified12 QA passes fresh system-HE first native RTL on the A30 at the original font1.1, picker import and five saved/five independently verified dates. The API 36 emulator passes the same five-file check at actual2560×1600 / density 320 (1280×800 dp), with notification permission denied. Both readbacks cover MediaStore, actual mtime and embedded JPEG/PNG/MP4 dates. New12 Gallery visual order, background/timeout, duplicate/language-restart and101-file sharing are not claimed as rerun; their earlier11/10/9 receipts retain their exact scope. Core src/ and native Kotlin files are unchanged from11.

Production12 AAB50,956,257 bytes/SHA2560d2efc0cb86b2ba5657fee04e57484aac3fb6847c59f2bf9dda112dfa05a6d51; minified QA APK75,225,186 bytes/SHA2562bec0cb7139901629693b4a062dd8343cb2f86cc9abea8cd0292c6fa49ff8b9b. Existing certificate retained. Both final manifests keep min30/target36, portrait MainActivity and only FGS/dataSync/notification platform permissions. All64 ELF libraries are inventoried:32 required 64-bit 16 KiB passes and32 genuine 32-bit NOT_APPLICABLE; actual16 KiB execution stays unverified.

try another way: the phone's DocumentsUI CardView stayed on Downloads after the coordinate/accessibility attempt. Use the guarded exact-label80 ms FINGER helper to enter only this run's folder/ZIP and receive the real picker grant. Pass multiword Hebrew through a single shlex-quoted remote command; the first split command failed before any action. No source/permission change or product assertion was relaxed. AAPT2's indented optional-feature line was whitespace-normalized before interpreting it.

Both app-level Start over flows returned to Import. Cleanup/restoration outcomes are recorded in the current compact Console receipt, with the two new five-file date readbacks and artifact reports; no raw logs, binaries or old proof are repackaged as evidence. Source CI is green; documentation-head CI is tracked separately there. All previous owner real-export, API 33/full UI,16 KiB, browser/provider/physicalCancel gaps retain their explicit scope.


## 2026-11-19 — Requested Android identity migrated, code 13 verified

Meni explicitly replaces the old fixed ID with **com.menis10tec.chatstamp**.
Production/config, QA/harness/probe identities and current verifier defaults now
agree; QA uses **com.menis10tec.chatstamp.qa**, with MainActivity under the
production namespace. The bridge library namespace stays com.chatstamp.nativebridge.
Historical artifacts still require their explicit expected package/version. Eight
probe Kotlin files moved with unchanged assertions. Existing upload key retained.
Independent implementation/test/review roles report source CLEAR. App source:
**1b82201792839d7925daee7dce4394fb0139bb6f**.

Full smoke passes npm ci, typecheck, **504 host tests/51 files**, lint,
**126 Python**, clean prebuild, QA assembly, **59 fresh JVM/zero skipped**,
**52 connected cases on each API 30/API 36** and the new Activity cold launch.
Six standalone probe JVM cases and APK identity checks pass. Both exact-source
CI runs pass: PR44587342205 and push44587326892. Signed production/QA code 13
artifacts pass identity/signature/SDK/permission/backup/portrait/static alignment.
Final AAB/APK providers and signature receiver use their correct own new IDs.

Exact minified QA passes A30 first system-HE RTL/font 1.1 and wide API 36 English
1280×800 dp/notification-denied five-file saves; independent MediaStore/mtime/
embedded dates match five of five. Actual Open in another app/chooser reached a
separate UID receiver, which read all 612 synthetic TXT bytes through the new QA
FileProvider with a temporary read grant and matching SHA256. No code 13 Gallery
visual ordering, full UI, real-export or 16 KiB runtime is inferred. Both Start
over flows returned to Import; five outputs/one ZIP/QA removed per device, phone
helper removed, controls restored, zero run rows/crash records, owned AVD stopped.
Private release-cache byte inspection is not claimed.

Google Play requires a separate entry. Actual creation form confirms availability
of the requested package; two legal declarations remain unchecked pending the
owner's action-time confirmation. No new app/track ID or upload exists yet. The
old entry now shows closed testing/latest publication 19 November; this updates
its former review checkpoint only. Its tester period does not transfer. Prepared
continuation preserves existing assets/code 9 screenshots/code 11 demo provenance,
assigns intended lists to the new entry and pauses old tracks only after new
internal availability. PR #1 remains unmerged; no production access requested.

try another way: standalone probe assembly first lacked its documented fixture
assets. Generate the tiny run-specific inputs and use -PchatStampProbeRun; all
six cases then execute, and inputs are removed. Artifact reporting first correctly
rejected a parent folder containing build products above the evidence ceiling;
write diagnostic reports inside their temporary work directories and retain only
small fresh summaries in the proof set. No assertion or evidence cap was weakened.
The optional screenshot conversion lacked Pillow; use macOS sips without adding
a dependency. Fresh proof remains in dist/play/identity-0.2.0-13-20261119/;
products are separate in dist/play/release-0.2.0-13/. Earlier proof is not copied.


## 2026-11-19 — New package created, internal 13 active, IARC gate isolated

Owner confirmed the two new-app creation declarations at action time. Created
**4975002762311404414 / com.menis10tec.chatstamp** in menis 10tec. Uploaded exact
accepted signed code 13 (AAB SHA256 0b7950c0d42fdcb716382ffcd180cf15250e25f2754702c471ac114290e7a5c2).
Internal **4701429810228968626** is active/available after two-step publish and
five-list assignment. Alpha **4699420811279917961** reuses the same library AAB;
preview ready, bilingual notes, 177 countries plus Rest of World, five lists and
feedback saved. The 20 memberships may overlap. No emails or qualifying period.

Saved EN/iw-IL listing texts and icon/banner/four phone PNGs per locale. Reopened
the editor to compare every text against source and confirm both image orders.
Public AI labels apply only to brand graphics, never real screenshots. Screens
remain actual 9; foreground video remains actual 11 of unchanged behavior.
All factual declarations, support/Tools/18+ and local Import/export dataSync with
body-verified public demo are saved. Policy/demo HTTP 200 and original SHA256 match.

Publishing has **15 saved changes**, Send disabled and **one exact issue: missing
content rating**. New IARC checkbox is unchecked; separate owner agreement approval
was requested at that actual gate and remains pending. Creation approval does not
accept IARC. Do not bypass the agreement or claim new closed availability. New
closed/store links are disabled. The new dashboard requires 12 continuous closed
opt-ins/14 days and showed zero. PR #1 stays unmerged; no production access request.

After new internal availability, old com.menis.chatstamp internal was paused;
old Alpha pause submitted and still under review at final readback. Old records
are retained. No permanent deletion or private-data/tester-clock migration.
App source/bytes/device scope unchanged; documentation head 63890b397867d50799355ec73b190dfcc22e1e46
has successful PR44593327255, push44593315713 and Pages44593313897.

try another way: the browser's multi-file chooser did not support a batch; serial
uploads reached most files before the control runtime stopped. Recover the same
Chrome profile/tabs, reconcile actual library contents and upload only missing
he-04-results.png separately; no security preference changed by the agent.
Inherited default images ignore removal; adding the first Hebrew image creates
the localized set, then append the other three in order. Custom Advertising ID
controls needed fresh AX actions/readback; No was verified before Save. Private
asset-organization tags and public AI declaration are separate; public review
confirmed only the two graphics checked and all eight screenshots unchecked.

Fresh receipt dist/play/new-package-console-20261119/ contains compact state,
listing/resource readbacks and only relevant JPEGs. Earlier proof is referenced
in place. All previous real-export/device/browser/provider/16 KiB/Cancel gaps stay
explicit; no additional native or device run is claimed for this Console-only work.

## 2026-11-20 — IARC complete and 16 changes submitted

Owner explicitly approved the new app's IARC terms and factual questionnaire.
Accepted that agreement, saved contact meniviner@gmail.com / All other app types
and answered the nine actual questions from shipped app behavior. Google's
question-specific official guidance excludes secondary-app sharing and privately
imported content from native interaction/promoted online content. The app does
not provide a hosted communication service or online catalog.

Final IARC status is Completed, submitted 20 November at 01:38 local. Actual
ratings: ClassInd All ages, ESRB Everyone, PEGI3, USK All ages, IARC Generic/Russia/
South Korea3+; no descriptors shown and certificate ID still '-'. The saved 18+
audience remains separate. Missing-rating blocker cleared and Send enabled for16.
Completed both submission confirmations. Publishing shows Changes in review with
quick checks running; Alpha4699420811279917961 shows exact13 in review, an enabled
track and178country/region entries. No successful quick checks or approval inferred.

All five Alpha lists remain checked with the same20potentially overlapping
memberships. Copy-link buttons are now enabled; actual signed-in web opt-in shows
App not available. That page permits unpublished build/account eligibility as
explanations; eligibility was not independently established. No invitations sent,
qualifying period or closed availability claimed. Google review and actual closed
access remain the external gate; no recurring monitoring or auto-resumption started.

try another way: create-tab visibility was unsupported for selected Chrome.
Used the documented tabs API, reconciled its one blank tab and navigated to the
actual opt-in URL. No browser setting changed. Fresh proof is grouped in
dist/play/iarc-submission-20261120/; earlier receipts remain untouched in place.
No app source/assets/binary or device state changed. Previous documentation head
4c44ef6 has successful PR44610925844/push44610913049/Pages44610911578, freshly read.
PR #1 remains open/unmerged; no production access request. Old-track review and
internal availability retain their19November checkpoint scope.

## 2026-11-20 — Owner UX corrections, code14source checkpoint

Owner reports new-package tester opt-in and Play download succeeded, superseding
the earlier account-unavailable observation. This is owner-reported installation,
not a completed real-export/date/cleanup acceptance or qualifying tester period.
Owner requests one-line ZIP/chat headings; active-only filled media categories;
actual transcript first/labeled with an in-app scrolling reader; corrected Hebrew
media arrows; and categorized Settings. All five are implemented with bilingual
copy and no new dependency or permission.

Root implements title/filter/transcript/viewer; separate Implementer owns Settings,
Test author derives criteria first and adds44meaningful UI regressions, Reviewer
audits against CODE_REVIEW. Reader uses SDK55 FileHandle, at most32KiB+3UTF-8 bytes
per page, handle-finally cleanup, replacement guards and local scrolling/explicit
continuation. It uses the original extracted file, never loads the ZIP or complete
transcript for preview. Native I18nManager determines glyphs/swipes. Actual sourceKind
marks the chat transcript; ordinary documents, filters/selected IDs and save dates
retain their semantics. All existing Settings handlers remain behind six categories.

try another way: pinning the transcript directly into contiguous date grouping
could split the same day under Oldest. Isolate its row in a headerless section,
then keep ordinary whole-day controls coherent; independent real-list selection
regression passes. This was a source-review finding fixed before the full cycle,
not a claimed executed negative control.

Current whole cycle passes npmci/typecheck/lint/cleanprebuild,564host/55files,
127Python,226executed QA assembly tasks,59fresh JVM0skip and52connected each on
A30/API30 and the existing API36 emulator. Source review CLEAR. No production app
replacement. Signed14/static/affected minified runtime and publication remain
pending at this checkpoint; exact source/receipt and cleanup close separately.

## 2026-11-20 — G2 code 14 owner UX, minified acceptance and Play update

Exact app/config source: `9e6c28f11117e8a6ff6531ccab874192c55cc61a`,
`stage-g2: refine selection, transcript preview and settings navigation`, pushed
on `fix/core-rebuild`. Production `com.menis10tec.chatstamp`; isolated QA
`com.menis10tec.chatstamp.qa`; version 0.2.0, code 14. No source changed after this
freeze. Later closure commits change documentation only.

The five owner requests are implemented: one-line ellipsized titles with full
accessible names; filled active and outlined inactive filters; actual transcript
first in a separate headerless section plus internal selectable scrolling and
bounded continuation; native RTL arrows/swipes; six Settings categories preserving
all controls and category → menu → original-screen Back. The dedicated transcript
section resolves review's date-group split concern without changing day selection.
Implementer completed Settings, Test author added 44 acceptance regressions, and
Reviewer source and final scoped acceptance reviews are CLEAR.

Full npm-ci smoke: 564 host tests / 55 files, 127 Python tests, typecheck and lint,
clean Android prebuild, QA debug assembly (226 tasks executed), 59 fresh JVM tests
(57 tasks executed), and 52 connected tests each on A30/API 30 and the existing
API 36 AVD; zero failures, errors or skips. Exact-source Android CI push run
44649941128 and PR run 44649948012 both pass; Pages run 44649939658 also passes.
These are source CI facts, separate from the device and Play checks below.

Signed products use the existing upload certificate
`efe36695cfc6a3d9ea8471527103f29e3374322ab09890af41692412d76a66c8`.
Production AAB: 50,961,179 bytes, SHA256
`4cd84aa5a6e54bd831cbd0bc3bf138e0f113ad5c8f2f2acfc9c5666b24fe83b5`.
Minified QA APK: 75,234,106 bytes, SHA256
`a9bb8a591a5831820e317b55f9833152f38c9180683a7381960bccc4a0c9d0e7`.
Both pass signature/identity/version, min 30/target 36, manifest permissions,
backup/transfer, optional portrait and all-ABI/16 KiB static checks. This does not
prove execution with 16 KiB pages. Products are grouped under
`dist/play/release-0.2.0-14/` with their README and SHA256SUMS.

Fresh minified runtime: A30 Hebrew at original font 1.1 and temporary 1.3 verifies
long-title truncation, active-filter counts 3/2/1, retained selection, transcript
first/internal scrolling, section navigation, native RTL glyphs and three-file
paging. HE → EN → HE explicit restart and 0.2.0 (14) readback pass. The owned API 36
AVD at 1280×800 dp in English verifies all six categories, Back to retained 3/3
selection, and the complete synthetic long transcript: 357,772 UTF-8 bytes across
11 bounded sections, exactly matching the original hash; scrolling visually
observed. Five media files per device saved; all independent embedded and indexed
dates match expected original message instants. Fresh Gallery visual order/Details
and private discarded-job byte removal before uninstall remain UNVERIFIED.

Runtime harness alternatives, not app source failures: shell-created Downloads URI
lacked a valid app grant → **try another way**, use the actual Android ZIP picker;
Samsung DocsUI ignored standard taps → **try another way**, use the guarded exact-
text disposable FINGER helper; owned-emulator geometry change triggered SystemUI
ANR → select Wait and observe recovery before testing. A loose crash-buffer string
check matched another app's broadcast mentioning the helper → **try another way**,
match the actual crashing Process identity; zero QA-process entries were present
in the checked buffer. Returning to Import after Start over was separately observed.
No broad permission, device unlock or unrelated app change was used.

Run hygiene: QA, exact synthetic fixture rows/files, five saved outputs and the
current helper removed; original stay-awake/timeout/font restored on A30. Owned
emulator 5556 geometry/controls restored, QA/fixtures/outputs removed, then stopped.
Preexisting emulator 5554 was used only for native connected tests and left running.
Owner production app untouched. These removal checks do not replace private-byte
inspection before uninstall.

Play continuation: owner's initial tester/download report did not identify a track;
it was not itself proof of closed approval. Fresh Console shows Alpha 13 ACTIVE,
178 country/region entries and all five lists checked. Actual signed-in closed URL
`https://play.google.com/apps/testing/com.menis10tec.chatstamp` shows You are a
tester plus download. Exact 14 AAB uploaded/processed/published internally at
20 November 03:36 local; the same uploaded artifact promoted to Alpha, 100% closed
rollout and en-US/iw-IL notes, one change submitted. Final publishing readback:
Changes in review; quick checks still running. Closed 14 availability, review success
and Play-delivered 14 installation are not inferred. Existing IARC/creation approvals
remain valid; no new agreement was accepted or requested.

All five assigned lists privately enumerated: list1(4), list2(7), Tank Malle –
Internal(1), friends(6), family(2), exactly 20 unique addresses. One bilingual
private Bcc invitation sent from owner Gmail; SENT and exact recipient readback
verified, message `1a1f6949bdd2ed22`. No private roster is committed or in evidence.
This proves Gmail submission, not inbox delivery or participation. Dashboard freshly
shows 1 opted-in tester; 12 continuously opted in for 14 days is unmet, production
access request disabled. No qualifying clock or production request fabricated.

Fresh evidence is one small dedicated set:
`dist/play/owner-ux-0.2.0-14-20261120/README.md`, four synthetic UI JPEGs, one
Dashboard JPEG and concise signed/runtime/CI/Console/send receipts. The Dashboard
image predates Alpha 14 submission and proves app/count/gate, not review status;
final review state is recorded from the actual DOM. Older evidence stays at original
locations; code 9 store images (older Selection UI) and code 11 FGS demo retain their
provenance. Final cumulative size must be checked below 10,000,000 bytes at handoff.

Remaining separate acceptance: owner real export, own WhatsApp cold/warm shares,
fresh Gallery ordering and private-byte inspection, physical API 33, actual 16 KiB,
full UI/font/provider matrix, genuine closed usage/feedback and 12/14 eligibility.
PR #1 stays open/unmerged. No recurring Google checks or invitation retries scheduled.


## 2026-11-20 — Play installation14, Hebrew invitations and split store artwork

App/native source and signed14 bytes remain frozen at9e6c28f11117e8a6ff6531ccab874192c55cc61a. Git was fetched again before this asset/documentation continuation; branch and origin were equal. No new app code/version/signing key was introduced. The prior full smoke counts and exact-source CI scope remain the earlier candidate's results, not fresh tests of this documentation commit.

Production14 was absent, then installed from actual native Google Play on the physical Samsung A30 under the owner's explicit instruction. Exact package/version14/0.2.0, installer com.android.vending, real Open/onboarding, process presence and no matching production crash entry in the bounded buffer were observed. Existing phone Google account needed a new one-member list, chatStamp – Connected Android, selected only on internal4701429810228968626; five Alpha assignments stayed unchanged. Actual internal opt-in said You are a tester. Two Play download failures → **try another way**, clear Play cache only through Android Settings following official guidance; third installation succeeded. Authenticated account/data and security were retained. This internal install is not qualifying closed participation.

Fresh final Alpha4699420811279917961 summary shows **14(0.2.0) ACTIVE**,178countries/regions. Thus the earlier14-in-review checkpoint is superseded for the binary. Actual Play installation remains specifically internal. No production eligibility, genuine12tester/14day period or clock transfer is claimed; last earlier Dashboard count was1 and was not refreshed here.

Tank Malle's actual Alpha15/1.11.4, same five lists and eligible signed-in opt-in were verified. Union with prior chatStamp recipients was20unique; the owner-identified clothing/admin address identified by the owner was excluded. Exactly19unique addresses were included in one Hebrew-only private Bcc message with actual opt-in and web links. Gmail SENT and exact-recipient readback passed; no delivery/open/participation inference and no private roster in Git/evidence. This is separate from the previous20-person bilingual chatStamp send; no invitation retry occurred.

Six fresh synthetic physical minified **QA14** captures produced Hebrew1080×1920 split posters in Import→Select→Saving→Results→Transcript→Settings order; a new1024×500 Hebrew feature uses a genuine transparent imagegen illustration. Karantina/Heebo typography and native AppKit/CoreText composition retain complete actual1080×2340 UI with uniform contain/rotation only. No crop, UI reconstruction or fabricated progress/count. Actual Saving2/9/64MB and Results9saved/9verified/0failed were captured; all9indexed date rows were read. This is not owner-export or fresh visual Gallery-order acceptance. Implementer Swift typecheck PASS; independent Test author seven-image/static checks PASS; Reviewer CLEAR. Final/source hashes, exact prompt/mode, official font licenses, editable renderer and six native inputs are durable together.

All seven new composite assets were AI-labeled in Console (existing generated logo/new feature illustration; native UI remains actual). Correct iw-IL seven assets saved/reopened; six ordered thumbnails and unchanged English text/asset-source URLs verified. Two changes—Hebrew phone screenshots and feature—submitted through both steps. Final publishing status **Changes in review**, quick checks running; new public artwork publication is not claimed. No identical AAB resubmission or recurring monitor.

Hygiene: QA/helper, exact synthetic ZIP and9owned output rows/files removed and absence checked. Initial cleanup delete response text was inconclusive → **try another way**, reconcile exact remaining rows and use authoritative no-result readback without repeating that deletion. Original stayawake7/timeout600000/font1.1 restored; production Play14 kept and reopened. Preexisting emulator5554 untouched. Private temporary account/UI dumps removed. Uninstall removal does not prove discarded private bytes before uninstall.

One fresh grouped delivery: **store/play/owner-followup-20261120/**. Public artwork/source/provenance are tracked there; owner-only sanitized send/install/Console receipts and screenshots remain locally in that same folder, excluded from Git. Prior evidence stays at its original location. Full cumulative delivery size must be checked below10,000,000bytes at handoff. PR1 remains open/unmerged. Owner real export/own WhatsApp shares, fresh Gallery order/private-byte observation, physicalAPI33, actual16KiB/full provider-UI matrix and genuine closed participation remain separate.


## 2026-11-20 — Owner-authorized Play logo and support-contact refresh

Owner confirmed menis10tec@gmail.com for both per-app support fields and requested the approved chatStamp illustration as its replacement store logo. Both support fields completed **Save and publish plus the second immediate-publication confirmation**, displayed Change published, and persisted after independent close/reload. An initial first-step-only draft did not persist after reload → **try another way**, inspect the additional confirmation, complete both steps and reconcile fresh readback. No verification email, invitation resend, developer-account/contact/privacy change or AAB upload occurred. Public propagation is separate; Console says changes usually appear within an hour.

Built-in imagegen edit preserves the approved chat/clock/folder/photo composition on a full-square cream background. Native Swift export performs uniform resizing/color conversion only:512×512,32-bit fully opaque sRGB PNG,353086bytes. New store/play/icon.png matches that export; native assets/icon.png and application source/config remain unchanged. The new default icon and literal support-address-only replacements in EN/HE descriptions saved/reopened exactly. Hebrew inherits the new default icon; existing EN/HE banners/screenshot source URLs remain unchanged. New icon AI label checked, prior labels preserved. Exactly three changes—default icon and two full descriptions—submitted through both steps; final publishing shows **Changes in review**. No new-logo public publication is inferred.

Tank Malle's current live Play icon is gold car+wallet+receipt+gauge; dirty/232-behind local PWA contains a stale teal gauge and stayed read-only. Browser media download timed out → **try another way**, use a bounded CUA crop of the actual visible published icon as style-transfer identity input. A matching soft3D proposal and512PNG(355717bytes) were produced and independently reviewed. **Tank proposal, prompt/reference and owner review remain local-only, excluded from Git and not applied/uploaded/pushed before owner approval.** chatStamp's authorization does not approve the Tank replacement.

Root implements; independent Test author formats/scope/size PASS; Reviewer visuals/static/contact capture review CLEAR. Exact prompts, hashes, conversion tool and new outputs are grouped in store/play/brand-refresh-20261120/; owner-only screenshots/receipts and Tank proposal are excluded from Git in that same folder. Full new delivery plus canonical new icon is below10,000,000bytes. Prior evidence remains unchanged. Git diff confirms no src/modules/assets/app.config/plugins/package changes; signed14 bytes stay frozen at9e6c28f application source. No runtime/CI acceptance is manufactured for this metadata-only update; prior source-smoke scope remains separate. PR1 stays open/unmerged.


## 2026-11-20 — Both store icons approved, transparent; chatStamp leaves removed

Owner approved the matching Tank Malle replacement as well as chatStamp, requested transparent backgrounds where possible, then explicitly requested removal of chatStamp's leafy sprig only. Built-in image_gen background-extraction edits preserve the approved designs; one precise-object edit removes all chatStamp leaves/stem. Mechanical Swift export preserves alpha without cropping or flattening. Both final icons are512×512,sRGB,32-bitRGBA: chatStamp224095bytes/SHA2565448946ba8a1b84fca36d151741337f81c2560fd1dfb69f70eaa8ef93806902e; Tank206564bytes/SHA25681c5fcbd6eda1822e4975db7dfefa10c4a9fd734378063dfa8c478b37e19cb27. Google's official icon spec permits transparent assets; the store supplies its UI background/mask/shadow.

Root implements; independent Test author PASS for both formats/alpha/visuals, Reviewer CLEAR for both icons/exporter. Light/dark inspections show safe margins, clean edges, opaque-looking cream subject interiors and no visible halos/clipping. Most generated subject pixels are alpha253; actual transparent-pixel counts139084/149860. An initial exact255/corner0 guard rejected this near-opaque quantization → **try another way**, retain original alpha, inspect distributions and actual light/dark composites rather than flattening artwork. First Tank Save immediately after AI-label close did not produce a saved result → **try another way**, reconcile the unchanged form, explicitly Save, then require the success dialog and fresh reload.

Play Console: Tank app4975939003117228141/com.meniviner.tankmalle has only default iw-IL; new transparent icon saved/reopened and one icon-only change submitted through both steps. chatStamp app4975002762311404414/com.menis10tec.chatstamp default en-US updated. Waiting for completed Hebrew asset load exposed an older localized icon, superseding the previous inheritance inference; explicitly select the new library icon in iw-IL, save and reload. Both locales now read back chatstamp-icon-transparent.png. All three locale readbacks preserve every text value and every non-icon filename/sourceURL/order, including banners and phone screenshots. AI labels verified for both new icons and prior labels preserved. Console aggregated chatStamp's final submission as one en-US icon change. Final publishing headings for BOTH apps: **Changes in review**. Public propagation/review approval is not inferred, and no external review monitoring is scheduled.

New selected masters,exports,prompts,mechanical tool,asset checks and a concise owner README are grouped in **store/play/icon-rollout-20261120/**. Fresh Console JPEGs/receipts stay locally in owner-proof/,excluded from Git. Prior evidence and cream proposals remain at original locations unchanged. Canonical store/play/icon.png now equals final leafless transparent chatStamp export. Native assets/icon.png,all application/config/native code,existing signed14bytes and dirty Tank checkout stay untouched. No new AAB, version, device run, email send or app-runtime test was needed for this metadata-only continuation. Prior full smoke remains scoped to9e6c28f application source. Current branch was clean/fetched/equal before work; final delivery must stay below10000000bytes. PR1 remains open/unmerged; all previously documented real-export/Gallery/closed-participation gaps remain separate.

## 2026-11-20 — Direct WhatsApp exports and guide, code 15 source acceptance

The owner reports that chatStamp appears in WhatsApp sharing but does not receive
the export, and explicitly selects emulator verification for this follow-up.
Git was inspected, fetched and fast-forward pulled: fix/core-rebuild matched
origin at b4d2b7a. The preexisting untracked Meni-Viner-CV-Hebrew.pdf is preserved.

Code 0.2.1 (15) now accepts one Android delivery as one bounded native receipt:
a source ZIP streams directly from its grant, or a transcript and attachments
stream individually into the existing private extraction job. No ZIP is built,
staged as a complete source-archive copy, or read into JS. A ZIP document within
a raw-file export remains an opaque supported attachment, never a nested chat.
Raw fingerprints and duplicate-filename ordering remain stable across reordering.
Existing 20,000-entry/2-GiB-per-entry/8-GiB and bounded transcript-sample limits
apply. Sixteen receipt leases bound pending native input.

Durable MainActivity capture runs before React startup and before new-intent
dispatch, retaining the current intent. Owner-generated receipt tokens deduplicate
activity recreation without suppressing a later deliberate same-URI share.
EXTRA_STREAM is authoritative; ClipData is the fallback, not an unrelated preview
to import. Temporary-only grants work; a separate grant mutex serializes
persistable acquisition/revocation while capture remains free of provider IO.
Native ownership starts before metadata, cancellable queries register a
CancellationSignal, and cancellation reservations also cover a queued bridge/IO
dispatch. Phase changes emit immediately while byte updates stay throttled.

Home prominently explains direct WhatsApp sharing without a prior manual save.
The six-page EN/HE guide covers chat, three dots/More, Export chat, Include media,
chatStamp and automatic import. Guide Back/Close return Home; incoming work takes
over. The ZIP picker and both onboarding pages remain available. Invalid incoming
shares do not replace active work; dialogs wait during saving. Existing support
alias approval now also reaches the in-app mailto and the bilingual privacy
policy, which accurately describes ZIP and separate-file processing. Native
launcher assets and all store banners/screenshots are unchanged.

Root implements intake/config; implementer owns UI/locales; independent Test author
derives regressions; Reviewer CLEAR, including cancellation/grant/Activity deltas.
Final full cycle restarted at npm ci: typecheck, 605 host tests/58 files, lint,
127 Python tests, clean Android prebuild, standalone arm64 QA assembly, 59 fresh
JVM and 72 connected tests on the owned API36 emulator, all zero failures/errors/
skips. The 72 include 20 new intake cases and deterministic metadata/queued
cancellation and grant-revocation interleavings. Strict i18n:364 used keys,
zero missing/unused/unresolved/parity/interpolation/Hebrew issues.

Failures and alternatives: strict startup-prefix validation rejected a harmless
test-only local documentation string → **try another way**, move that literal
to a class property while preserving the decoy assertions and strict guard.
The first connected run found that throttling suppressed the first extracting
phase → **try another way**, emit actual phase transitions immediately and
recheck Cancel before opening payloads. An independently authored ZIP-document
fixture wrongly expected an existing supported type to be skipped → **try
another way**, require byte-identical document retention, exactly one transcript
and no recursive extraction; source-archive no-copy assertions remain unchanged.

Debug QA identity/SDK and no-broad-storage/media/network checks pass. Its generated
Expo debug manifest contains SYSTEM_ALERT_WINDOW; this is a debug-only tool
overlay and is not accepted as release policy evidence. Signed production and
minified QA must independently pass the stricter release verifier before upload.

Fresh debug UI: both onboarding pages, prominent Home and all six English guide
pages/Android Back rendered. A separate synthetic sender with an unexported
provider and distinct UID denied reads without a grant, then Android's actual
share sheet delivered three private files with a temporary grant. Selection
shows one transcript first, one photo and one PDF, matched 2019 message dates,
without any prior manual Files/ZIP save. This proves the Android contract on the
emulator; it is not a real WhatsApp-app export or Gallery-order acceptance.

Pending at this source checkpoint: signed artifact/static and minified UI checks,
new Play upload/distribution and fresh public privacy readback. UNVERIFIED commands:
build production with :app:bundleRelease; build isolated minified QA using
scripts/android-verification/release-test.init.gradle and :app:assembleRelease;
run verify-release.py with expected package/version/code15 and the existing public
upload certificate. Real WhatsApp acceptance remains UNVERIFIED: in the actual
owner app follow chat → three dots → More → Export chat → Include media →
chatStamp, once cold and once warm, then select/save/check original dates.
No production eligibility, genuine tester period or final MVP closure is inferred.

## 2026-11-20 — Direct sharing code15 signed runtime and Play submission

Implementation source **45f27382b64d7e7fa688747eea3a42659e9bb61f** is frozen at
0.2.1 (15). Exact-source Android CI PR run **44748707957** completed/success.
The final full-cycle counts remain605 host/58files,127 Python,59 freshly executed
JVM and72 connected API36 tests, with independent Test author PASS/Reviewer CLEAR.

Existing-key production AAB:50,978,271bytes,
SHA2563187e6902a5026b460141848e191cf3c2db1e4a85e14eb901102cd401afe7779.
Isolated minified QA APK:75,259,898bytes,
SHA256a800b9a623de09c0e6add98cbb9be23d409adb571a387195b28fee69daecc564.
Both strict release verifiers PASS for identity/version/certificate/min30/target36,
permissions, backup/minification, four ABI and static16KiB policies. Actual emulator
page size4096; no16KiB execution claim. Debug-only overlay permission remains
separate from the strict signed release policy.

Owned API36 emulator, as requested: actual Android share sheet from a distinct-UID,
unexported private provider delivered TXT/JPEG/PDF to signed minified QA15 while
its Hebrew guide was open, producing one3-file selection. Force-stopped QA15
accepted a generic-MIME ZIP; warm separate-file share preserved the active session
behind a prompt until confirmation. Missing grants yield the translated recovery
error. All six Hebrew guide pages at font1.3 and hardware Back to Home pass.
No prior manual Files/ZIP save was used. This proves synthetic Android transport,
not actual WhatsApp sender behavior.

Raw-share save:3saved,1message-date verified,0failed/cancelled. Independent
MediaStore rows98/99 confirm TXT/PDF modification time1551258000,datetakenNULL;
photo row101 has modification1551177240 and datetaken1551177240000. Independent
host ImageIO reads photo DateTimeOriginal/DateTimeDigitized2019:02:26 12:34:00,
OffsetTimeOriginal+02:00. Documents are not mislabeled as verified message dates.
The public bilingual privacy page freshly returns its20November update,
separate-file explanation and menis10tec@gmail.com. In-app browser rendering
remains separately unverified.

Play accepted the exact production AAB, internal4701429810228968626 release3:
**15(0.2.1), Available to internal testers**,20November16:14local. The same library
artifact was promoted to Alpha4699420811279917961 with100%rollout/EN+HE notes.
Both submission steps completed. Final publishing heading **Changes in review**,
quick checks running; closed15 availability/approval is not claimed. Previous
active Alpha14/178countries remains the distribution baseline. All five assigned
lists remain checked; the connected Android list remains internal-only. No new
invitations, list-membership edits or production-access request occurred.

**try another way:** release UI hides a debug raw error code, so assert its exact
localized recovery message; the initial shell-split MediaStore WHERE failed, so
quote the device command with shlex.join; Pillow is absent, so inspect the saved
JPEG using installed Apple ImageIO. These are verification-tool alternatives,
not source or policy relaxations.

Debug discard private-job removal was inspected before uninstall. Minified Start
over returns Home, but minified private discarded-byte inspection is UNVERIFIED
because the release package is not debuggable. Exact synthetic public rows/files,
QA/helper packages and provider fixtures were removed with absence readbacks.
Stayawake1/font1.0/physical320x640,density160 were restored; crash buffer empty;
the owned emulator was stopped. Production was never installed/replaced there.

Fresh small evidence: **dist/play/direct-share-0.2.1-15-20261120/**, README, compact
receipts/static checks and selected whole-screen JPEGs only. Large signed products
are separate in **dist/play/release-0.2.1-15/**. Earlier evidence/artwork remains
unchanged. Native launcher/icons/banners and the dirty unrelated CV are preserved.
PR1 remains open/unmerged. Actual owner WhatsApp cold/warm export, physical code15,
fresh Gallery order,16KiB execution, real closed participation and production
eligibility remain UNVERIFIED; the final MVP is not closed by emulator fixtures.

## 2026-11-21 — Installed launcher icons, code16 source acceptance

The owner confirms both new Play icons are correct but installed launchers remain
old after update/reinstall, then explicitly requests integration. Root inspected
Git, fetched and fast-forward pulled fix/core-rebuild: unchanged7a531a9; the
preexisting untracked owner CV is preserved. Tank work remains in its separate
native handoff worktree/branch; the canonical PWA and other worktrees are untouched.

Exact approved leafless chatStamp master SHA256
5448946ba8a1b84fca36d151741337f81c2560fd1dfb69f70eaa8ef93806902e is immutable.
The new durable Swift generator performs only uniform scale/padding/color-space
export: existing white legacy1024 asset and transparent adaptive/monochrome1024
assets. Meaningful alpha fits32.41dp of the33dp safe radius in Android108dp layers.
Monochrome preserves the same alpha silhouette. Clean Expo prebuild consumes these
tracked assets; no unique generated-android edits or runtime behavior changes.
Package/native/verifier metadata aligns0.2.2/code16. EN/HE release notes describe
the installed icon; existing store icons/banners/screenshots remain unchanged.

Separate Implementer owns Tank generation/build; Test author derives acceptance
before inspecting implementation; Reviewer CLEAR for both source/asset diffs,
including no stale day/night/round references and safe monochrome geometry.
Root caught an overbroad lockfile version substitution before smoke: **try another
way**, restore the unrelated lan-network0.2.1 entry and retain only app/native
0.2.2 metadata. Dependency resolution and integrity do not change.

Full cycle from npm ci PASS: typecheck,605host/58files,lint,127Python,clean prebuild,
standalone arm64 QA assembly,59freshly executed JVM/8suites and72connected API36,
zero failures/errors/skips. Mandatory source checks are complete. Signed AAB/QA
and actual launcher update/reinstall checks follow separately; do not infer them
from source geometry or tests. Existing original upload key is retained.

Chrome currently has another Google account, not the authorized meniviner owner
session. An owner manual-login request is pending; both apps’ uploads remain
UNVERIFIED until actual Console readback. No new legal terms are accepted for the
other account. Fresh small receipts/proof go together in
**dist/play/native-launcher-icons-20261120/**; required signed binary products
are separate in **dist/play/native-launcher-release-20261120/**. Earlier receipts
retain their original candidate scope. Real WhatsApp/Gallery/16KiB/physical cases
and genuine tester eligibility are not established by this icon-only follow-up.

## 2026-11-21 — Installed icons signed/runtime/Play acceptance

Exact-source chatStamp d26bddfa0eb37e090d24fb8a1969715e3e40b5d9 is frozen at0.2.2/16;
AndroidCI44826496766 succeeds. Full source smoke605host/58files,127Python,59freshJVM,
72connected API36 passes. Existing-key strict production/QA artifact checks PASS.
Production AAB SHA81c3b8944fe381bf739b0e8185b17af360f3002b457bed72b18c626afcc03971;
QA SHAfd01704c29810137f2d5dce9ff4246a68201dbf96cc18bcfa5ecf9d143d67ebc.

Tank source44941104bac497dc0c9bf7bc4bbee4a5cdb90c36,1.11.6/17, is pushed in isolated
codex/launcher-icons-20261120; no other worktree/merge. Host1534PASS/7existing skips,
TypeScript/lint(0errors/25existingwarnings), bundle/signature/alignment/R8 PASS.
AAB SHA3477fd9d832255196a3247317a9a29be11b49a0c2aa617c1f0793605e91617fc;
QA SHAb9f0fd4e1add5002818956310793f02b32a58a37ab9f1626b1994b07156b9984.
Existing identities/certificates/SDK/permissions are retained in both apps.
Independent source Reviewer CLEAR; independent Test author packaged-pixel checks
PASS:20/20chat WebP and22/22Tank PNG, correct resource graph/night/round/mono;
meaningful radii32.596/32.902dp fit33dp. Approved masters unchanged/leafless chat.

Actual owned API36 launcher: signed QA15→16 replaces chat icon without launcher
cache clearing/restart. Full uninstall/reinstall QA16 and TankQA17 display both new
logos, day/night, with complete art under the native circle mask. Chat16 cold
onboarding rendered; exact PackageManager-resolved Tank17Activity cold-launched.
Icon QA was offline, with no account/auth/data actions. This does not certify Tank
web/auth flows or actual physical/Play installations. **try another way:** generic
shell Tank intent did not resolve, so use its actual resolved component; source
or manifest/security rules were not weakened. Both QA packages/own UI dump were
removed with absence readback; original network/stay/font/night/display controls
restored, crash buffer empty, owned emulator stopped. No media-save fixture was
created for icon QA and no production app was installed or replaced.

The original Chrome ID now identified a different profile; **try another way**,
refresh inventory after owner correction and use the Meni Viner profile's existing
authenticated user tab. Newly created tabs lacked that session. No owner password
was requested in chat, wrong-account terms accepted or credentials changed.

Play accepted exact16/17 AABs. Internal chat4701429810228968626/release4 available
21Nov00:20local; Tank4701635743178258439/release5 available00:22. Same library
artifacts promoted to chatAlpha4699420811279917961 and TankAlpha4700518119588886058,
100% each, EN+HE/chat and HE/Tank notes. Both submission confirmations completed
for both apps. Final headings **Changes in review**; chat quick checks running,
no closed availability/approval inferred. Tank’s nonblocking native-symbol
recommendation is recorded without claiming closure. Tester/country settings,
invitations, store artwork/banners and production access were not changed.

Fresh report/selected actual JPEGs/static checks/compact receipts are together in
**dist/play/native-launcher-icons-20261120/** below10MB. Required large products
are together separately in **dist/play/native-launcher-release-20261120/**.
Earlier evidence remains unchanged. Final PR1 stays open/unmerged; real owner
WhatsApp/Gallery/physical/16KiB/testing-period gates retain UNVERIFIED scope.

## 2026-11-22 — Owner design pass: ReVanced-style visual language and chat reader

Owner request: adopt ReVanced Manager's visual language (installed reference app on
the owner's SM-A305F, API 30) across chatStamp, restyle Settings to match, and make
the transcript reader readable. Owner decisions: keep the brown/peach palette and
always prefer the user's dynamic Material colors; add a permissions onboarding
screen only for what is needed (notifications, no battery exemption); WhatsApp-style
chat bubbles.

Changes (presentation only; import, matching, native save and date verification
are untouched):
- Shared design language in `src/theme/designTokens.ts` and `src/components/AppUi.tsx`:
  segmented grouped lists (24dp outer / 6dp inner corners, 2dp gaps), tonal icon
  circles, large start-aligned titles, 56dp pill buttons, colored info banners,
  28dp dialogs with text buttons, tag badges. `SettingsCategoryPanel` was deleted
  and replaced by `ListGroup` / `ListItem` / `NavigationItem`.
- Settings menu, categories, three-circle theme selector and About row; Home,
  History, Processing, Error, Done, Select and the WhatsApp guide restyled.
- Onboarding: "Welcome to chatStamp" header with the app logo on every page. Two
  pages (intro, export steps). On Android 13+ only, an optional notifications page
  sits between them; it never blocks Next and says saving works without it.
  `src/native/notificationPermission.ts` is now the single POST_NOTIFICATIONS path,
  also used at save time by `operationCoordinator`. `docs/CODE_REVIEW.md` onboarding
  rule updated to this owner decision.
- Transcript reader: `src/lib/transcriptMessages.ts` turns a bounded section into
  day, system, message and plain-text entries (Android and iOS forms, iOS group
  notices, omitted/deleted media, attachment captions). `TranscriptReader` shows
  bubbles with sender colors, run grouping, day pills, a "which one is you" chooser
  and in-section search; each bubble is one accessible element with sender, time
  and text.
- Small in-app logo `assets/app-logo.png` (192px) instead of the 1024px icon.
- `SafeAreaProvider` receives `initialWindowMetrics` so cold-start top bars do not
  draw under the status bar.

Roles: Implementer (main session), Test author and Reviewer as separate sub-agents.
Reviewer findings (1 blocker, 4 major, 8 minor) were all resolved: onboarding rule
aligned with the owner decision and the permission made optional and API-gated;
row accessibility with extras fixed; bubbles grouped for TalkBack; duplicate
permission request removed; honest permission copy; iOS notice/omitted/caption
parsing; shared line split; dead tokens/props removed; 48dp targets; duplicate
Home row removed; Done success icon requires verified dates; small logo asset.
The compact Select title keeps its untruncated text as the accessible name.
