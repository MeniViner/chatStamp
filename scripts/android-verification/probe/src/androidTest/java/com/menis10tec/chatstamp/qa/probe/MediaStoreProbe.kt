package com.menis10tec.chatstamp.qa.probe

import android.content.ContentUris
import android.content.ContentValues
import android.database.Cursor
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.os.SystemClock
import android.provider.BaseColumns._ID
import android.provider.MediaStore
import android.provider.MediaStore.MediaColumns.*
import android.system.Os
import androidx.exifinterface.media.ExifInterface
import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.attribute.FileTime
import java.time.Instant
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.json.JSONArray

private val VOLUME = MediaStore.VOLUME_EXTERNAL_PRIMARY
internal val images: Uri = MediaStore.Images.Media.getContentUri(VOLUME)
internal val videos: Uri = MediaStore.Video.Media.getContentUri(VOLUME)
internal val music: Uri = MediaStore.Audio.Media.getContentUri(VOLUME)
internal val files: Uri = MediaStore.Files.getContentUri(VOLUME)
internal val downloads: Uri = MediaStore.Downloads.getContentUri(VOLUME)

internal fun album(root: String, stem: String, suffix: String = ""): String =
    "$root/chatStamp/$stem$suffix/"

internal class InsertRejected(cause: Exception) : IOException(cause)

internal data class IndexedRow(
    val uri: Uri,
    val name: String,
    val relativePath: String,
    val path: String?,
    val owner: String?,
    val size: Long,
    val pending: Boolean,
    val takenMillis: Long?,
    val modifiedSeconds: Long?,
    val addedSeconds: Long?,
) {
    val taken get() = takenMillis?.let(Instant::ofEpochMilli)
    val modified get() = modifiedSeconds?.let(Instant::ofEpochSecond)
}

internal data class Published(val row: IndexedRow, val internalDateMatches: Boolean)

internal class MediaStoreProbe(private val run: ProbeRun) {
    private val resolver = run.context.contentResolver
    private val includePending = Bundle().apply {
        putInt(MediaStore.QUERY_ARG_MATCH_PENDING, MediaStore.MATCH_INCLUDE)
    }

    fun publish(fixture: Fixture, collection: Uri, relativePath: String): Published {
        val uri = insert(fixture, collection, relativePath)
        val scratch = File.createTempFile("prepare-", ".${fixture.name.substringAfterLast('.')}", run.context.cacheDir)
        try {
            run.open(fixture).use { input -> scratch.outputStream().use { input.copyTo(it) } }
            if (fixture.image) writeImageDates(scratch, fixture.expected)
            if (fixture.video) {
                val source = Mp4Dates.read(scratch).first { it.box == "mvhd" }.creation
                check(source == fixture.original && source != fixture.expected)
                Mp4Dates.rewrite(scratch, fixture.expected)
                run.record("video-source", "id" to fixture.id, "creation_utc" to source.toString())
            }

            requireNotNull(resolver.openOutputStream(uri, "w")).use { output ->
                scratch.inputStream().use { input -> input.copyTo(output) }
            }
            val pendingRow = read(uri)
            check(pendingRow?.pending == true) { "Pending row missing or already published at $uri" }
            setMtime(fixture, pendingRow, "pending")
            val beforePublish = readMtime(uri)
            check(resolver.update(uri, ContentValues().apply { put(IS_PENDING, 0) }, null, null) == 1)
            val afterPublish = readMtime(uri)
            val publishedRow = requireNotNull(read(uri)) { "Row missing after publication at $uri" }
            if (!ProbeDates.matches(afterPublish, fixture.expected)) setMtime(fixture, publishedRow, "published")
            if (ProbeDates.matches(readMtime(uri), fixture.expected) &&
                !ProbeDates.matches(read(uri)?.modified, fixture.expected)
            ) {
                val file = ownedFile(publishedRow)
                if (file != null) rescan(fixture, file)
            }

            val row = awaitIndex(uri, fixture, scratch.length())
            val finalMtime = readMtime(uri)
            val reopened = requireNotNull(resolver.openInputStream(uri)).use { it.sha256() }
            val bytesMatch = row.size == scratch.length() && scratch.inputStream().use { it.sha256() } == reopened
            run.record(
                "readback", "id" to fixture.id, "name" to row.name, "mime" to fixture.mime,
                "uri" to row.uri.toString(), "destination" to row.relativePath, "path" to row.path,
                "owner" to row.owner, "pending" to row.pending, "size" to row.size,
                "expected_size" to scratch.length(), "bytes_match" to bytesMatch,
                "expected_utc" to fixture.expected.toString(), "date_taken_ms" to row.takenMillis,
                "date_modified_s" to row.modifiedSeconds, "date_added_s" to row.addedSeconds,
                "mtime_before_publish_s" to beforePublish?.epochSecond,
                "mtime_after_publish_s" to afterPublish?.epochSecond, "mtime_final_s" to finalMtime?.epochSecond,
            )
            check(!row.pending && row.size > 0 && bytesMatch) { "Saved bytes failed readback" }
            check(row.name == fixture.name && row.relativePath == relativePath && row.owner == PROBE_PACKAGE) {
                "Unexpected display name, destination, or owner"
            }
            val internalDateMatches = when {
                fixture.image -> readImageDates(uri, fixture)
                fixture.video -> readVideoDates(uri, fixture)
                else -> true
            }
            return Published(row, internalDateMatches)
        } catch (failure: Exception) {
            run.record("publish-error", "id" to fixture.id, "uri" to uri.toString(), "error" to failure.toString())
            runCatching { delete(uri) }.onFailure(failure::addSuppressed)
            throw failure
        } finally {
            scratch.delete()
        }
    }

    private fun insert(fixture: Fixture, collection: Uri, relativePath: String): Uri {
        val values = ContentValues().apply {
            put(DISPLAY_NAME, fixture.name)
            put(MIME_TYPE, fixture.mime)
            put(RELATIVE_PATH, relativePath)
            put(IS_PENDING, 1)
        }
        val uri = try {
            resolver.insert(collection, values) ?: throw IOException("Insert returned null")
        } catch (failure: Exception) {
            run.record("insert-rejected", "id" to fixture.id, "collection" to collection.toString(),
                "destination" to relativePath, "error" to failure.toString())
            throw InsertRejected(failure)
        }
        run.record("inserted", "id" to fixture.id, "name" to fixture.name, "collection" to collection.toString(),
            "destination" to relativePath, "uri" to uri.toString())
        return uri
    }

    @Suppress("DEPRECATION")
    private fun read(uri: Uri): IndexedRow? = resolver.query(
        uri,
        arrayOf(DISPLAY_NAME, RELATIVE_PATH, DATA, OWNER_PACKAGE_NAME, SIZE, IS_PENDING, DATE_TAKEN, DATE_MODIFIED, DATE_ADDED),
        includePending,
        null,
    )?.use { cursor ->
        if (!cursor.moveToFirst()) return@use null
        IndexedRow(uri, cursor.getString(0), cursor.getString(1), cursor.getString(2), cursor.getString(3),
            cursor.getLong(4), cursor.getInt(5) != 0, cursor.optionalLong(6), cursor.optionalLong(7), cursor.optionalLong(8))
    }

    private fun Cursor.optionalLong(index: Int): Long? = if (isNull(index)) null else getLong(index)

    private fun awaitIndex(uri: Uri, fixture: Fixture, size: Long): IndexedRow {
        val deadline = SystemClock.uptimeMillis() + 4_000
        var row: IndexedRow?
        do {
            row = read(uri)
            if (row != null && !row.pending && row.size == size &&
                ((!fixture.image && !fixture.video) || ProbeDates.matches(row.taken, fixture.expected))
            ) return row
            SystemClock.sleep(200)
        } while (SystemClock.uptimeMillis() < deadline)
        return requireNotNull(row) { "No indexed row at $uri" }
    }

    private fun readMtime(uri: Uri): Instant? = runCatching {
        requireNotNull(resolver.openFileDescriptor(uri, "r")).use {
            Instant.ofEpochSecond(Os.fstat(it.fileDescriptor).st_mtime)
        }
    }.onFailure { run.record("stat-error", "uri" to uri.toString(), "error" to it.toString()) }.getOrNull()

    @Suppress("DEPRECATION")
    private fun ownedFile(row: IndexedRow): File? {
        if (row.owner != PROBE_PACKAGE || !row.name.startsWith("${run.stem}-")) return null
        val file = row.path?.let(::File) ?: return null
        val parent = File(Environment.getExternalStorageDirectory(), row.relativePath.trimEnd('/'))
        return file.takeIf {
            it.parentFile == parent && (it.name == row.name ||
                (row.pending && it.name.startsWith(".pending-") && it.name.endsWith("-${row.name}")))
        }
    }

    private fun setMtime(fixture: Fixture, row: IndexedRow, phase: String) {
        val file = ownedFile(row)
        val direct = runCatching { file?.setLastModified(fixture.expected.toEpochMilli()) }
        run.record("mtime-attempt", "id" to fixture.id, "phase" to phase, "method" to "owned-path",
            "set" to direct.getOrNull(), "error" to direct.exceptionOrNull()?.toString())
        if (ProbeDates.matches(readMtime(row.uri), fixture.expected)) return
        val descriptor = runCatching {
            requireNotNull(resolver.openFileDescriptor(row.uri, "rw")).use {
                Files.setLastModifiedTime(Paths.get("/proc/self/fd/${it.fd}"), FileTime.from(fixture.expected))
            }
        }
        run.record("mtime-attempt", "id" to fixture.id, "phase" to phase, "method" to "owned-fd",
            "set" to descriptor.isSuccess, "error" to descriptor.exceptionOrNull()?.toString())
    }

    private fun rescan(fixture: Fixture, file: File) {
        val completed = CountDownLatch(1)
        var scanned: Uri? = null
        MediaScannerConnection.scanFile(run.context, arrayOf(file.path), arrayOf(fixture.mime)) { _, result ->
            scanned = result
            completed.countDown()
        }
        val answered = completed.await(3, TimeUnit.SECONDS)
        run.record("rescan", "id" to fixture.id, "completed" to answered,
            "uri" to if (answered) scanned?.toString() else null)
    }

    private fun writeImageDates(file: File, expected: Instant) {
        val (date, offset) = ProbeDates.exifValues(expected)
        ExifInterface(file).apply {
            for (tag in listOf(TAG_DATETIME, TAG_DATETIME_ORIGINAL, TAG_DATETIME_DIGITIZED)) setAttribute(tag, date)
            for (tag in listOf(TAG_OFFSET_TIME, TAG_OFFSET_TIME_ORIGINAL, TAG_OFFSET_TIME_DIGITIZED)) setAttribute(tag, offset)
            saveAttributes()
        }
    }

    private fun readImageDates(uri: Uri, fixture: Fixture): Boolean {
        val exif = requireNotNull(resolver.openInputStream(uri)).use { ExifInterface(it) }
        val date = exif.getAttribute(TAG_DATETIME_ORIGINAL)
        val offset = exif.getAttribute(TAG_OFFSET_TIME_ORIGINAL)
        val instant = ProbeDates.parseExif(date, offset)
        val bitmap = requireNotNull(resolver.openInputStream(uri)).use { requireNotNull(BitmapFactory.decodeStream(it)) }
        val dimensions = bitmap.width to bitmap.height
        bitmap.recycle()
        run.record("exif", "id" to fixture.id, "local" to date, "offset" to offset, "instant_utc" to instant?.toString(),
            "width" to dimensions.first, "height" to dimensions.second)
        return (date to offset) == ProbeDates.exifValues(fixture.expected) &&
            ProbeDates.matches(instant, fixture.expected) && dimensions == (320 to 240)
    }

    private fun readVideoDates(uri: Uri, fixture: Fixture): Boolean {
        val rawDate = MediaMetadataRetriever().use { retriever ->
            requireNotNull(resolver.openFileDescriptor(uri, "r")).use {
                retriever.setDataSource(it.fileDescriptor)
                retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE)
            }
        }
        val instant = ProbeDates.parseRetriever(rawDate)
        val reopened = File(run.directory, "reopened-${fixture.name}")
        requireNotNull(resolver.openInputStream(uri)).use { input ->
            reopened.outputStream().use { input.copyTo(it) }
        }
        val headers = Mp4Dates.read(reopened)
        run.record("video", "id" to fixture.id, "retriever_raw" to rawDate, "retriever_utc" to instant?.toString(),
            "headers" to JSONArray(headers.map {
                json("box" to it.box, "creation_utc" to it.creation.toString(), "modification_utc" to it.modification.toString())
            }))
        return ProbeDates.matches(instant, fixture.expected) && headers.all { header ->
            ProbeDates.matches(header.creation, fixture.expected) && ProbeDates.matches(header.modification, fixture.expected)
        }
    }

    fun cleanup() {
        val collections = listOf(images, videos, music, downloads, files)
        for (collection in collections) {
            findRunRows(collection).forEach(::delete)
        }
        check(collections.all { findRunRows(it).isEmpty() }) { "Probe MediaStore rows remain" }
        run.record("cleanup-media", "owned_rows_remaining" to 0)
    }

    fun delete(uri: Uri) {
        val row = requireNotNull(read(uri))
        check(row.owner == PROBE_PACKAGE && row.name.startsWith("${run.stem}-"))
        check(resolver.delete(uri, null, null) == 1)
        run.record("deleted", "uri" to uri.toString(), "name" to row.name, "path" to row.path)
    }

    private fun findRunRows(collection: Uri): List<Uri> {
        val locations = listOf(
            album("Pictures", run.stem), album("DCIM", run.stem), album("Movies", run.stem, "-videos"),
            album("Pictures", run.stem, "-png-check"), album("DCIM", run.stem, "-png-check"),
            album("Pictures", run.stem, "-webp-check"), album("DCIM", run.stem, "-webp-check"),
            album("Music", run.stem), album("Documents", run.stem), album("Download", run.stem),
        )
        val args = Bundle(includePending).apply {
            putString(android.content.ContentResolver.QUERY_ARG_SQL_SELECTION,
                "$RELATIVE_PATH IN (${locations.joinToString(",") { "?" }})")
            putStringArray(android.content.ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS, locations.toTypedArray())
        }
        return requireNotNull(resolver.query(collection, arrayOf(_ID, DISPLAY_NAME, OWNER_PACKAGE_NAME), args, null)).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    if (cursor.getString(1).startsWith("${run.stem}-") && cursor.getString(2) == PROBE_PACKAGE) {
                        add(ContentUris.withAppendedId(collection, cursor.getLong(0)))
                    }
                }
            }
        }
    }

    private companion object {
        const val TAG_DATETIME = ExifInterface.TAG_DATETIME
        const val TAG_DATETIME_ORIGINAL = ExifInterface.TAG_DATETIME_ORIGINAL
        const val TAG_DATETIME_DIGITIZED = ExifInterface.TAG_DATETIME_DIGITIZED
        const val TAG_OFFSET_TIME = ExifInterface.TAG_OFFSET_TIME
        const val TAG_OFFSET_TIME_ORIGINAL = ExifInterface.TAG_OFFSET_TIME_ORIGINAL
        const val TAG_OFFSET_TIME_DIGITIZED = ExifInterface.TAG_OFFSET_TIME_DIGITIZED
    }
}
