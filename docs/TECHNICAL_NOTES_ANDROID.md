# Android technical notes

Current source: **0.2.0/code 6**, Expo 55.0.32/core 55.0.27, RN 0.83.10, min SDK 30, compile/target 36, build-tools 36.0.0 and NDK 27.1.12297006. These are source/configuration facts; the updated candidate's full smoke, CI, signed-artifact and runtime checks remain pending. Consult the dated [verification record](VERIFICATION.md) for results tied to a particular source, binary, handset and Gallery.

## Import and archive policy

[`StreamingZipImporter.kt`](../modules/chatstamp-native/android/src/main/java/com/chatstamp/nativebridge/StreamingZipImporter.kt) opens the original granted `content://` or supported `file://` URI. One native stream feeds ZIP decoding and SHA-256 fingerprinting, including remaining source bytes. It creates extracted working entries, not a private ZIP copy. Native CRC/size/end-record checks reject damaged archives. STORED and DEFLATED entries are supported; unsupported compression/encryption fails the import.

Safe supported entries are extracted; unsafe paths and unsupported extensions are counted with reasons. Even ignored entries pass streamed entry-count and decompression-byte limits. The accepted extensions, case-insensitive, are:

| Kind | Extensions |
| --- | --- |
| Text candidates | txt |
| Images/stickers | jpg, jpeg, png, heic, webp |
| Video containers | mp4, mov, m4v, 3gp |
| Audio/voice | opus, ogg, m4a, mp3, aac |
| Animation | gif |
| Other attachments | pdf, doc, docx, vcf, xls, xlsx, ppt, pptx, zip |

A nested ZIP is an attachment, not a recursively expanded archive. Import support does not imply a platform decoder, inline preview or embedded-date writer exists for every variant.

[`ArchiveLimits.kt`](../modules/chatstamp-native/android/src/main/java/com/chatstamp/nativebridge/ArchiveLimits.kt) and the importer enforce:

| Limit | Value |
| --- | --- |
| All entries, including ignored entries | 20,000 |
| Uncompressed bytes per entry | 2 GiB |
| Cumulative streamed uncompressed bytes | 8 GiB |
| Each retained TXT sample | 64 KiB |
| All retained TXT samples together | 16 MiB |
| Selected transcript parsed by JavaScript | 16 MiB |

Free-space checks run before/while writing. Limit/space errors are coded and partial extraction cleanup is awaited. Payloads remain streamed; metadata and retained samples still use memory within these limits, so this is not a claim of constant total memory for every archive.

[`importService.ts`](../src/services/importService.ts) and [`transcriptDetection.ts`](../src/lib/transcriptDetection.ts) choose the transcript in TypeScript from every returned TXT candidate. Kotlin does not score WhatsApp lines. The selected transcript is read only within the parsing limit and remains a selectable document; other supported TXT candidates remain attachments. Parser/matcher fixtures exercise Android/iOS, Hebrew, year-first, ambiguous date order, attachment collisions and time-zone cases. A filename-derived date is approximate; an unavailable date is not replaced with today.

## Shares, progress and operation lifetime

[`SharedZipInbox.kt`](../modules/chatstamp-native/android/src/main/java/com/chatstamp/nativebridge/SharedZipInbox.kt) retains launch/warm shares at application scope, with a one-shot launch marker and distinct new-intent deliveries. Event subscriptions and explicit consumption replace JS polling. Grants remain tied to the original source; ignored/rejected sources and completed imports have explicit release paths.

[`NativeOperations.kt`](../modules/chatstamp-native/android/src/main/java/com/chatstamp/nativebridge/NativeOperations.kt) supplies import/save progress, Cancel and snapshots. JS recreation can reattach to an operation still owned by the live native registry. Terminal save acknowledgment follows durable History publication; it must not launch a second save. This does **not** promise automatic recovery after full process death.

Import cancellation, discard and replacement setup use one serialized ownership
queue; extraction and transcript parsing run outside it so Cancel remains usable.
Old cleanup finishes before a replacement can publish its session. Pending
transitions block Save and language restart. A successful stale parse releases its
actual working directory; cleanup failure retains its context and blocks replacement.
After JS recreation, failed/cancelled Results offer reimport when valid retry inputs
are unavailable. Cancelling the picker preserves the retained result/cache, and an
empty save cannot acknowledge or clear that work.

[`SaveForegroundService.kt`](../modules/chatstamp-native/android/src/main/java/com/chatstamp/nativebridge/SaveForegroundService.kt) uses an unexported, user-started **dataSync** foreground service with progress and Cancel notification. Android 13+ notification permission denial does not create a fake successful save. Cancellation/timeout closes tracked streams and waits for pending-output/scratch cleanup before terminal reporting. Fully published files remain saved and untouched remaining files are reported cancelled/failed; cleanup failures remain errors. Source-revocation simulation and process-death reconciliation beyond the implemented owned-record cases remain deferred.

## Destinations, duplicates and dates

[`ScopedMediaSaver.kt`](../modules/chatstamp-native/android/src/main/java/com/chatstamp/nativebridge/ScopedMediaSaver.kt) and [`SaveDestinations.kt`](../modules/chatstamp-native/android/src/main/java/com/chatstamp/nativebridge/SaveDestinations.kt) write app-owned scoped MediaStore rows:

- Images, GIFs/stickers and videos use their image/video collections under `Pictures/chatStamp`.
- Audio/voice uses the audio collection under `Music/chatStamp`.
- Documents use the Files collection under `Documents/chatStamp`, falling back to Downloads when the default document destination is rejected.
- A chosen folder uses its persisted read/write tree grant and DocumentsContract/DocumentFile provider operations. It has provider-dependent timestamps and no universal Gallery-sorting guarantee.

No All Files Access, broad external-storage/media-read permission or direct public-path write is required. MediaStore pending rows are published only after the copy; owned results are reopened/read back. Document formats may have a modification date without a Gallery capture date.

The Save tap captures ordered visible selected IDs and a copy of destination, duplicate handling, date preference, folder labels and notification text. Later UI/settings changes do not alter that requested save. New/missing settings default **Always use message date** to true; an explicit stored false remains false. When false, a readable existing capture date is preferred when there is a requested date; provenance remains distinct from the WhatsApp date.

[`MediaTimestamps.kt`](../modules/chatstamp-native/android/src/main/java/com/chatstamp/nativebridge/MediaTimestamps.kt) writes EXIF date/offset fields for **JPEG, PNG and WebP**. [`Mp4Timestamps.kt`](../modules/chatstamp-native/android/src/main/java/com/chatstamp/nativebridge/Mp4Timestamps.kt) handles supported MP4-family header dates. A bounded private scratch copy is used where metadata rewriting needs one; the original extracted source is retained. These are selected-media scratch files, not duplicated source ZIPs. Other imported formats do not gain an embedded-date guarantee.

Keep four separate outcomes:

1. **Saved:** the output was copied, published where applicable and can be reopened.
2. **Date readback:** indexed/capture metadata and, for supported metadata formats, embedded readback match the selected target within the native tolerance. A modification-only result is separate.
3. **WhatsApp date verified:** JS additionally requires the known, unambiguous message instant to match the target. Preserving a different original capture date or using a filename fallback does not establish this.
4. **Gallery order observed:** a particular Gallery/version/sort mode visibly orders the actual saved files. This requires separate device evidence.

Skip existing uses stable archive/destination/organization identity and stored per-entry results. Keep both and Replace existing are explicit policies; replacement retains the previous file when the new copy/date verification cannot establish the required replacement safety. [`SaveRecords.kt`](../modules/chatstamp-native/android/src/main/java/com/chatstamp/nativebridge/SaveRecords.kt) atomically pins each record's actual chat folder, localized labels and optional Export segment before any destination creation. Legacy English paths and completed URIs remain unchanged, including an empty Export segment; changing language on retry must not create an alternate folder or duplicate row.

## Preview and language boundaries

Thumbnails are native JPEG descriptors, never list-cell video players. Images are downsampled; video uses a scaled native frame; PDF uses the first page. The thumbnail cache is bounded to **32 MiB/512 entries**, each JPEG at most **512 KiB**, with requested edges clamped to **64–512 px**. Two workers and at most 64 queued requests bound admission; heavy video/PDF rendering is serialized. Keys include source identity, size, mtime and requested dimensions; unknown metadata prevents a persistent cache hit. Discard invalidates queued/active derived work before source deletion; a late completion cannot recreate discarded output. Decode errors have a bounded invalidation/retry path.

Only the active full-screen video owns a player. Video handoffs and explicit audio release await the native MAIN-queue release barrier. This is a bounded preview lifecycle, not a claim that every Android codec can decode every supported extension. Nonseekable/unsupported files can fall back to a narrow FileProvider read grant in another app; missing or unsuitable external handlers remain a truthful fallback.

Android applies `NativeLanguagePolicy` from the regenerated MainApplication,
after `super.onCreate()` and before `loadReactNative`, so the first native surface
uses the committed language direction. The policy reads only
`filesDir/chatstamp-store/settings.v1.json`, bounded to64KiB; explicit EN/HE wins,
and system/missing follows the same locale source as Expo. Invalid, unreadable,
nonobject, trailing or oversized content preserves existing flags and file bytes.
The config plugin durably asserts `supportsRtl=true` and rejects ambiguous or
misplaced executable startup hooks; comments and strings cannot suppress insertion.

Native **I18nManager.isRTL** describes the current JS runtime's cached native
constant; it alone does not prove the already mounted surface direction. Settings writes are serialized/atomic and publish state only after success; a failed read does not permit overwriting with defaults. Language sync applies persisted allowRTL/forceRTL flags and translations, reports mismatch and offers a real same-bundle Expo reload. There is no ExpoUpdates/cloud reload or custom direction provider. Restart waits for persistence, safe operation/discard handling and media release; actual RTL application must be checked in the restarted minified runtime. App-language formatting preserves the source instant/time-zone/provenance rather than manufacturing a date.

## Storage, testing and release boundaries

There is no database or server. Zustand owns the session; small atomic JSON files hold settings, History summaries/per-file details and native save records. Failed/cancelled work can retain private files for retry until discard/cleanup. Source policy disables OS backup/transfer and application network/recording/broad-storage permissions; verify the merged manifest and final artifact.

Results and History share the same file-sharing sheet. It displays explicit ranges
of at most 100 files with Previous/Next controls; each batch needs its own Share
gesture. Opening the Android chooser is not a delivery receipt. JavaScript and the
native bridge reject oversized requests rather than silently dropping later files.

Representative regression sources include [StreamingImportTest](../modules/chatstamp-native/android/src/androidTest/java/com/chatstamp/nativebridge/StreamingImportTest.kt), [ZipIntegrityTest](../modules/chatstamp-native/android/src/androidTest/java/com/chatstamp/nativebridge/ZipIntegrityTest.kt), [ScopedMediaSaverTest](../modules/chatstamp-native/android/src/androidTest/java/com/chatstamp/nativebridge/ScopedMediaSaverTest.kt), [SaveFolderProfileTest](../modules/chatstamp-native/android/src/androidTest/java/com/chatstamp/nativebridge/SaveFolderProfileTest.kt), [MediaPreviewsTest](../modules/chatstamp-native/android/src/androidTest/java/com/chatstamp/nativebridge/MediaPreviewsTest.kt), [SharedZipInboxTest](../modules/chatstamp-native/android/src/androidTest/java/com/chatstamp/nativebridge/SharedZipInboxTest.kt), and host [fixtures](../__tests__/chatArchive.test.ts), [actual selection](../__tests__/stageEFlow.test.ts), [Results](../__tests__/resultsPresentation.test.ts), [language persistence](../__tests__/languageRestart.test.ts) and [locale dates](../__tests__/localeDates.test.ts). Their presence does not assert their latest execution or universal provider/Gallery compatibility.

Use the [README QA commands](../README.md#local-development-and-isolated-qa) and [verification guide](../scripts/android-verification/README.md). Android CI is configured for pinned tools, host/native JVM checks and merged-manifest policy; a successful run on the new dependency graph remains a separate gate. See [known risks](KNOWN_RISKS.md), [release checklist](PLAY_RELEASE_CHECKLIST.md) and [external signing](ANDROID_RELEASE_SIGNING.md) before describing a candidate as ready for Play.

## History output identity

Each import session has a bounded, stable history identity derived from its native working-directory operation ID and archive fingerprint. Reimports remain separate records, including keep-both copies, different destinations and later failures. Retries and cold terminal replay update the same session. Per-output URI/path identities preserve distinct saved copies; resolving a failed entry removes only that session's pending attempt. A same-URI skip retains the original saved/date evidence. Unknown cold replay retains a previous custom-folder tree URI only for the same session, SAF method and exact nonempty destination; an explicit incoming tree wins. This does not regrant a permission revoked by the provider. Legacy history IDs and output handles remain intact.

## Native save finalization and language reload

The save worker starts atomically, checks cancellation before invoking the saver,
and always enters non-cancellable finalization. It preserves completed results,
classifies remaining entries, awaits cleanup and an ownership check plus service
stop on Main, then publishes terminal progress/completion. Cancellation waiters
also finalize after their scope is cancelled. A previous acknowledged job's last
bookkeeping cannot block a registered replacement; late stop callbacks cannot
remove the replacement's foreground service. Startup failures attempt shutdown
before terminal publication. Stop failures still attempt both shutdown calls and
produce IO_ERROR in the native snapshot.

App-language restart uses Expo reloadAppAsync after committing settings and native
I18n direction. It may retain the process PID. Verify the actual new native React
surface/layout, then force-stop/cold-launch separately to check committed language
before opening Settings. PID change is not a language-reload requirement.
