package com.menis10tec.chatstamp.qa.probe

import android.content.ContentUris
import android.net.Uri
import android.os.SystemClock
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.junit.Test
import java.time.Instant

class ProbeStorageTest {
    @Test
    fun publishesFixturesAndVerifiesReadback() {
        val run = ProbeRun()
        run.begin()
        val arguments = InstrumentationRegistry.getArguments()
        val store = MediaStoreProbe(run)
        val failures = mutableListOf<String>()

        fun save(id: String, collection: Uri, destination: String): Published? {
            val fixture = run.fixtures.getValue(id)
            return try {
                val saved = store.publish(fixture, collection, destination)
                val row = saved.row
                val dateResult = when {
                    !fixture.image && !fixture.video -> "saved"
                    !saved.internalDateMatches -> "internal-date-failed"
                    ProbeDates.matches(row.taken, fixture.expected) -> "date-taken"
                    fixture.mayUseMtime && row.taken == null &&
                        ProbeDates.matches(row.modified, fixture.expected) -> "mtime-candidate"
                    else -> "indexed-date-failed"
                }
                run.record("case", "id" to id, "destination" to destination, "collection" to collection.toString(),
                    "date_result" to dateResult)
                if (dateResult.endsWith("-failed")) failures += "$id $dateResult"
                saved
            } catch (_: InsertRejected) {
                null
            } catch (failure: Exception) {
                run.record("write-error", "id" to id, "destination" to destination, "error" to failure.toString())
                null
            }
        }

        val paths = when (arguments.getString("layout", "auto")) {
            "auto" -> listOf("Pictures" to "Pictures", "DCIM" to "DCIM", "Pictures" to "Movies")
            "dcim" -> listOf("DCIM" to "DCIM")
            "split" -> listOf("Pictures" to "Movies")
            else -> error("Unexpected Gallery layout")
        }
        val imageOrder = listOf("red", "blue", "yellow")
        val gallery = mutableMapOf<String, IndexedRow>()
        var imageRoot: String? = null
        for ((stillRoot, videoRoot) in paths) {
            val videoFolder = album(videoRoot, run.stem, if (stillRoot == videoRoot) "" else "-videos")
            val first = save("green", videos, videoFolder) ?: continue
            val imageFolder = album(stillRoot, run.stem)
            val firstImage = save("red", images, imageFolder)
            if (firstImage == null) {
                store.delete(first.row.uri)
                continue
            }
            imageRoot = stillRoot
            run.record("gallery-paths", "images" to imageFolder, "videos" to videoFolder)
            gallery["green"] = first.row
            gallery["red"] = firstImage.row
            save("purple", videos, videoFolder)?.also { gallery["purple"] = it.row }
            for (id in imageOrder.drop(1)) {
                save(id, images, imageFolder)?.also { gallery[id] = it.row }
            }
            break
        }
        val expectedOrder = listOf("purple", "yellow", "blue", "green", "red")
        val indexedOrder = gallery.entries.sortedByDescending { it.value.taken ?: it.value.modified ?: Instant.MIN }
            .map { it.key }
        run.record("indexed-order", "ids" to JSONArray(indexedOrder), "expected" to JSONArray(expectedOrder))
        if (indexedOrder != expectedOrder) failures += "Regression MediaStore order $indexedOrder"

        for (format in listOf("png", "webp")) {
            val folder = album(imageRoot ?: "Pictures", run.stem, "-$format-check")
            // The older timestamp is inserted last, so import-time and expected orders differ.
            val newer = save("$format-new", images, folder)?.row
            SystemClock.sleep(1_100)
            val older = save("$format-old", images, folder)?.row
            if (newer == null || older == null) {
                failures += "Missing $format control"
                continue
            }
            val expectedNewer = run.fixtures.getValue("$format-new").expected
            val expectedOlder = run.fixtures.getValue("$format-old").expected
            val opposingInsertOrder = ContentUris.parseId(newer.uri) < ContentUris.parseId(older.uri) &&
                (newer.addedSeconds ?: Long.MAX_VALUE) < (older.addedSeconds ?: Long.MIN_VALUE)
            val mtimeRequired = newer.taken == null || older.taken == null ||
                (format == "png" && gallery["yellow"]?.taken == null)
            val mtimeReady = newer.taken == null && older.taken == null &&
                ProbeDates.matches(newer.modified, expectedNewer) && ProbeDates.matches(older.modified, expectedOlder)
            run.record("order-control", "format" to format, "destination" to folder, "newer" to newer.name,
                "older" to older.name, "opposing_insert_order" to opposingInsertOrder,
                "mtime_required" to mtimeRequired, "mtime_ready_for_gallery_check" to mtimeReady)
            if (!opposingInsertOrder || (mtimeRequired && !mtimeReady)) failures += "$format fallback control"
        }

        val audio = listOf("voice", "audio").mapNotNull { id -> save(id, music, album("Music", run.stem)) }
        if (audio.isEmpty()) failures += "No scoped Music destination reopened successfully"
        val safNeeded = listOf("contact", "notes").filter { id ->
            save(id, files, album("Documents", run.stem)) == null &&
                save(id, downloads, album("Download", run.stem)) == null
        }
        if (safNeeded.isNotEmpty()) {
            val allowPicker = arguments.getString("allowSaf") == "true"
            val saf = if (allowPicker) runCatching { ProbeDocuments(run).checkPicker(safNeeded) } else null
            run.record("saf-fallback", "ids" to JSONArray(safNeeded), "allowed" to allowPicker,
                "passed" to (saf?.isSuccess == true), "error" to saf?.exceptionOrNull()?.toString())
            if (saf?.isSuccess != true) failures += "SAF needed for $safNeeded"
        }
        run.record("storage-assertions", "errors" to JSONArray(failures), "gallery" to "unverified")
        check(failures.isEmpty()) { failures.joinToString("\n") }
    }
}

class ProbeCleanupTest {
    @Test
    fun deletesProbeExports() {
        val run = ProbeRun()
        checkProbeIdentity(run.context)
        MediaStoreProbe(run).cleanup()
        ProbeDocuments(run).cleanup()
    }
}
