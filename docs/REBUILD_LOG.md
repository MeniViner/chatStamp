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
