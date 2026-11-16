package com.chatstamp.nativebridge

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.time.Instant
import java.time.ZoneId
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class ScopedMediaSaverTest {
  private val instrumentation = InstrumentationRegistry.getInstrumentation()
  private val context: Context = instrumentation.targetContext
  private lateinit var cache: File
  private lateinit var chat: String
  private val created = mutableSetOf<Uri>()
  private val zone = ZoneId.of("Asia/Jerusalem")
  private val winter = Instant.parse("2019-02-15T08:30:00Z")
  private val summer = Instant.parse("2020-06-06T10:20:00Z")

  @Before fun prepare() {
    chat = "chatstamp-test-" + UUID.randomUUID().toString().take(8)
    cache = File(context.cacheDir, "chatstamp/$chat").apply { check(mkdirs()) }
  }

  @After fun cleanup() {
    created.forEach { context.contentResolver.delete(it, null, null) }
    cache.deleteRecursively()
  }

  @Test fun preservesExistingCaptureDateAndRewritesOnRequest() = runBlocking {
    val formats = listOf(
      Triple("winter.jpg", Bitmap.CompressFormat.JPEG, "image/jpeg"),
      Triple("winter.png", Bitmap.CompressFormat.PNG, "image/png"),
      Triple("winter.webp", Bitmap.CompressFormat.WEBP_LOSSLESS, "image/webp")
    )
    val inputs = formats.map { (name, format, mime) ->
      val file = File(cache, name)
      Bitmap.createBitmap(24, 24, Bitmap.Config.ARGB_8888).let { bitmap ->
        try {
          bitmap.eraseColor(Color.BLUE)
          file.outputStream().use { assertTrue(bitmap.compress(format, 100, it)) }
        } finally {
          bitmap.recycle()
        }
      }
      MediaTimestamps.writeExif(file, winter, zone)
      item(name, file, "photo", mime, summer)
    }
    val archive = archive()
    val preserved = save(inputs, archive)
    val rewritten = save(inputs, archive.copy(duplicateHandling = "keep-both", alwaysUseMessageDate = true))
    for (index in inputs.indices) {
      assertEquals("capture", preserved[index]["timestampSource"])
      assertEquals("verified", preserved[index]["dateVerification"])
      assertEquals(winter.toEpochMilli(), (preserved[index]["mediaStoreDateTaken"] as Number).toLong())
      assertEquals("chat", rewritten[index]["timestampSource"])
      assertEquals("verified", rewritten[index]["dateVerification"])
      assertEquals(summer.toEpochMilli(), (rewritten[index]["mediaStoreDateTaken"] as Number).toLong())
      assertExif(preserved[index], "2019:02:15 10:30:00", "+02:00")
      assertExif(rewritten[index], "2020:06:06 13:20:00", "+03:00")
    }
  }

  @Test fun savesUndatedFilesAndResumesCompletedEntriesInTheSameFolder() = runBlocking {
    val first = File(cache, "first.txt").apply { writeText("First test document") }
    val second = File(cache, "second.txt").apply { writeText("Second test document") }
    val a = item("folder A/notes.txt", first, "document", "text/plain", null, "notes.txt")
    val b = item("folder B/notes.txt", second, "document", "text/plain", null, "notes.txt")
    val options = archive().copy(timestampFolder = true)
    val original = save(listOf(a), options).single()
    val resumed = save(listOf(a, b), options)
    assertEquals("saved", original["outcome"])
    assertEquals("date-unavailable", original["verificationReason"])
    assertNull(original["targetTimestampMillis"])
    assertEquals("skipped", resumed[0]["outcome"])
    assertEquals(original["insertedUri"], resumed[0]["insertedUri"])
    assertEquals("saved", resumed[1]["outcome"])
    assertEquals(original["outputDirectory"], resumed[1]["outputDirectory"])
    assertNotEquals(original["displayName"], resumed[1]["displayName"])
    assertArrayEquals(second.readBytes(), read(resumed[1]))
    val repeated = save(listOf(a, b), options)
    assertEquals(resumed.map { it["insertedUri"] }, repeated.map { it["insertedUri"] })
    assertTrue(repeated.all { it["outcome"] == "skipped" })
  }

  @Test fun preservesTheOldVideoWhenItsReplacementDateCannotBeVerified() = runBlocking {
    val file = File(cache, "sample.mp4")
    instrumentation.context.assets.open("dated-video.mp4").use { input ->
      file.outputStream().use { input.copyTo(it) }
    }
    val options = archive().copy(alwaysUseMessageDate = true)
    val first = item("sample.mp4", file, "video", "video/mp4", winter)
    val old = save(listOf(first), options).single()
    assertEquals("verified", old["dateVerification"])
    val oldBytes = read(old)
    val unsupported = first.copy(timestampMillis = Instant.parse("2080-01-01T00:00:00Z").toEpochMilli().toDouble())
    val replacement = save(listOf(unsupported), options.copy(duplicateHandling = "replace-existing")).single()
    assertEquals("saved", replacement["outcome"])
    assertNotEquals("verified", replacement["dateVerification"])
    assertEquals("previous-file-kept", replacement["replacementWarning"])
    assertArrayEquals(file.readBytes(), read(replacement))
    assertArrayEquals(oldBytes, read(old))
  }

  private fun archive(): ScopedSaveOptions {
    val zip = File(cache, "test.zip")
    ZipOutputStream(zip.outputStream()).use { output ->
      output.putNextEntry(ZipEntry("_chat.txt"))
      output.write("15/02/2019, 10:30 - Dana: Test conversation".toByteArray())
      output.closeEntry()
    }
    return ScopedSaveOptions(Uri.fromFile(zip).toString(), chat)
  }

  private fun item(id: String, file: File, type: String, mime: String, date: Instant?, filename: String = file.name) =
    ScopedSaveItem(id, Uri.fromFile(file).toString(), filename, type, mime, date?.toEpochMilli()?.toDouble(),
      if (date == null) "none" else "chat", zone.id)

  @Suppress("UNCHECKED_CAST")
  private suspend fun save(items: List<ScopedSaveItem>, options: ScopedSaveOptions): List<Map<String, Any?>> {
    val results = ScopedMediaSaver(context).save(items, options)["results"] as List<Map<String, Any?>>
    results.mapNotNull { it["insertedUri"] as? String }.map(Uri::parse).forEach(created::add)
    return results
  }

  private fun read(result: Map<String, Any?>): ByteArray =
    requireNotNull(context.contentResolver.openInputStream(Uri.parse(result["insertedUri"] as String))).use { it.readBytes() }

  private fun assertExif(result: Map<String, Any?>, date: String, offset: String) {
    val uri = Uri.parse(result["insertedUri"] as String)
    val input = context.contentResolver.openInputStream(uri)
    assertNotNull(input)
    input!!.use {
      val exif = ExifInterface(it)
      assertEquals(date, exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL))
      assertEquals(offset, exif.getAttribute(ExifInterface.TAG_OFFSET_TIME_ORIGINAL))
    }
  }
}
