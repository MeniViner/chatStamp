package com.chatstamp.nativebridge

import android.content.Context
import android.net.Uri
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.security.MessageDigest
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.CRC32
import java.util.zip.ZipOutputStream

class StreamingImportTest {
  private val context: Context = InstrumentationRegistry.getInstrumentation().targetContext
  private lateinit var job: File
  private lateinit var source: File
  private lateinit var operationId: String

  @Before fun prepare() {
    operationId = "stream-test-${UUID.randomUUID()}"
    job = File(context.cacheDir, "chatstamp/$operationId").apply { check(mkdirs()) }
    source = File(context.cacheDir, "$operationId.zip")
  }

  @After fun cleanup() {
    NativeOperations.removeListener(this)
    job.deleteRecursively()
    source.delete()
  }

  @Suppress("UNCHECKED_CAST")
  @Test fun returnsEveryTextCandidateAndStreamFingerprintWithoutZipCopies() = runBlocking {
    ZipOutputStream(source.outputStream()).use { zip ->
      write(zip, "exports/_chat.txt", "2020-03-16, 15:15 - Dana: photo.jpg".toByteArray())
      write(zip, "notes.txt", ByteArray(100_000) { 'a'.code.toByte() })
      write(zip, "photo.jpg", byteArrayOf(1, 2, 3, 4))
      write(zip, "ignored.exe", ByteArray(4096))
      write(zip, "../escape.pdf", ByteArray(4096))
    }
    val result = StreamingZipImporter(context).extract(
      Uri.fromFile(source).toString(), Uri.fromFile(File(job, "extracted")).toString(), operationId
    )
    val candidates = result["transcriptCandidates"] as List<Map<String, Any?>>
    assertEquals(setOf("_chat.txt", "notes.txt"), candidates.map { it["filename"] }.toSet())
    assertEquals(64 * 1024, (candidates.single { it["filename"] == "notes.txt" }["sample"] as String).toByteArray().size)
    assertTrue(candidates.all { File(Uri.parse(it["uri"] as String).path!!).isFile })
    val expectedHash = MessageDigest.getInstance("SHA-256").digest(source.readBytes()).joinToString("") { "%02x".format(it) }
    assertEquals(expectedHash, result["archiveFingerprint"])
    assertEquals(2, result["skippedCount"])
    assertEquals(3, result["extractedCount"])
    assertFalse(job.walkTopDown().any { it.isFile && it.extension == "zip" })
    assertFalse(File(job.parentFile, "escape.pdf").exists())
    val snapshot = NativeOperations.snapshot(context)!!
    val progress = snapshot["progress"] as Map<String, Any?>
    assertEquals("completed", progress["phase"])
    assertEquals(5, progress["filesDone"])
  }

  @Test fun malformedArchiveRemovesPartialExtraction() = runBlocking {
    source.writeText("This is not an archive")
    var code: String? = null
    try {
      StreamingZipImporter(context).extract(
        Uri.fromFile(source).toString(), Uri.fromFile(File(job, "extracted")).toString(), operationId
      )
    } catch (error: OperationFailure) {
      code = error.code
    }
    assertEquals("ZIP_INVALID", code)
    assertFalse(File(job, "extracted").exists())
  }

  @Test fun truncatedEndRecordRemovesExtractedFiles() = runBlocking {
    ZipOutputStream(source.outputStream()).use { write(it, "_chat.txt", "2020-03-16, 15:15 - Dana: Test".toByteArray()) }
    java.io.RandomAccessFile(source, "rw").use { it.setLength(source.length() - 12) }
    var code: String? = null
    try {
      StreamingZipImporter(context).extract(
        Uri.fromFile(source).toString(), Uri.fromFile(File(job, "extracted")).toString(), operationId
      )
    } catch (error: OperationFailure) { code = error.code }
    assertEquals("ZIP_INVALID", code)
    assertFalse(File(job, "extracted").exists())
  }

  @Test fun rejectsCorruptStoredEntryWithoutPublishingExtractedFiles() = runBlocking {
    val payload = "A stored attachment with a checked CRC".toByteArray()
    ZipOutputStream(source.outputStream()).use { zip ->
      zip.putNextEntry(ZipEntry("_chat.txt").apply {
        method = ZipEntry.STORED
        size = payload.size.toLong()
        compressedSize = size
        crc = CRC32().apply { update(payload) }.value
      })
      zip.write(payload)
      zip.closeEntry()
    }
    val bytes = source.readBytes()
    fun word(offset: Int): Int = (bytes[offset].toInt() and 255) or ((bytes[offset + 1].toInt() and 255) shl 8)
    val payloadOffset = 30 + word(26) + word(28)
    bytes[payloadOffset] = (bytes[payloadOffset].toInt() xor 1).toByte()
    source.writeBytes(bytes)
    var code: String? = null
    try {
      StreamingZipImporter(context).extract(
        Uri.fromFile(source).toString(), Uri.fromFile(File(job, "extracted")).toString(), operationId
      )
    } catch (error: OperationFailure) { code = error.code }
    assertEquals("ZIP_INVALID", code)
    assertFalse(File(job, "extracted").exists())
  }

  @Test fun atomicStoreRejectsPathsAndPublishesWholeContents() {
    val store = LocalJsonStore(context)
    val name = "$operationId.json"
    try {
      store.write(name, "first")
      store.write(name, "second")
      assertEquals("second", store.read(name))
      assertTrue(store.list(operationId).contains(name))
      var rejected = false
      try { store.write("../escape.json", "invalid") } catch (_: OperationFailure) { rejected = true }
      assertTrue(rejected)
    } finally {
      store.delete(name)
    }
    assertEquals(null, store.read(name))
  }

  private fun write(zip: ZipOutputStream, name: String, bytes: ByteArray) {
    zip.putNextEntry(ZipEntry(name).apply { time = 1_584_363_600_000 })
    zip.write(bytes)
    zip.closeEntry()
  }
}
