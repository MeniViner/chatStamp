package com.chatstamp.nativebridge

import android.content.Context
import android.net.Uri
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.util.UUID
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipOutputStream

class ZipIntegrityTest {
  private val context: Context = InstrumentationRegistry.getInstrumentation().targetContext
  private val payload = "2020-03-16, 15:15 - Dana: A synthetic descriptor integrity fixture.\n".toByteArray()
  private lateinit var operationId: String
  private lateinit var job: File
  private lateinit var source: File

  @Before fun prepare() {
    operationId = "zip-integrity-${UUID.randomUUID()}"
    job = File(context.cacheDir, "chatstamp/$operationId").apply { check(mkdirs()) }
    source = File(context.cacheDir, "$operationId.zip")
    ZipOutputStream(source.outputStream()).use { zip ->
      // Leaving CRC and sizes unset makes the writer emit a DEFLATED data descriptor.
      zip.putNextEntry(ZipEntry("_chat.txt"))
      zip.write(payload)
      zip.closeEntry()
    }
  }

  @After fun cleanup() {
    try {
      NativeOperations.acknowledge(context, operationId)
    } finally {
      job.deleteRecursively()
      source.delete()
    }
    assertFalse("The integrity fixture job remains", job.exists())
    assertFalse("The integrity source ZIP remains", source.exists())
  }

  @Test fun acceptsTheUnchangedDeflatedDescriptorFixture() = runBlocking {
    val bytes = source.readBytes()
    val descriptor = descriptorOffset(bytes)
    assertEquals(CRC32().apply { update(payload) }.value, unsignedInt(bytes, descriptor + 4))

    val result = StreamingZipImporter(context).extract(
      Uri.fromFile(source).toString(), Uri.fromFile(File(job, "extracted")).toString(), operationId
    )
    assertEquals(1, result["extractedCount"])
    val candidate = (result["transcriptCandidates"] as List<*>).single() as Map<*, *>
    assertArrayEquals(payload, File(Uri.parse(candidate["uri"] as String).path!!).readBytes())
  }

  @Test fun rejectsAMismatchedDescriptorCrcEvenWhenPayloadAndCentralDirectoryAreIntact() = runBlocking {
    val original = source.readBytes()
    val descriptor = descriptorOffset(original)
    val corrupted = original.copyOf()
    corrupted[descriptor + 4] = (corrupted[descriptor + 4].toInt() xor 1).toByte()
    assertEquals(listOf(descriptor + 4), original.indices.filter { original[it] != corrupted[it] })
    source.writeBytes(corrupted)

    // Independent central-directory readback proves this changes no compressed payload or end record.
    ZipFile(source).use { zip ->
      val entry = checkNotNull(zip.getEntry("_chat.txt"))
      assertEquals(CRC32().apply { update(payload) }.value, entry.crc)
      assertArrayEquals(payload, zip.getInputStream(entry).use { it.readBytes() })
    }

    var rejected: OperationFailure? = null
    try {
      StreamingZipImporter(context).extract(
        Uri.fromFile(source).toString(), Uri.fromFile(File(job, "extracted")).toString(), operationId
      )
    } catch (error: OperationFailure) {
      rejected = error
    }
    assertEquals("ZIP_INVALID", rejected?.code)
    assertFalse("Corrupt descriptor left extracted output", File(job, "extracted").exists())
    val snapshot = checkNotNull(NativeOperations.snapshot(context))
    assertEquals("failed", (snapshot["progress"] as Map<*, *>)["phase"])
    assertEquals("ZIP_INVALID", (snapshot["error"] as Map<*, *>)["code"])
  }

  private fun descriptorOffset(bytes: ByteArray): Int {
    assertEquals(0x04034b50L, unsignedInt(bytes, 0))
    assertTrue("Fixture must use a data descriptor", (unsignedShort(bytes, 6) and 8) != 0)
    assertEquals(ZipEntry.DEFLATED, unsignedShort(bytes, 8))
    val payloadOffset = 30 + unsignedShort(bytes, 26) + unsignedShort(bytes, 28)
    val compressedSize = ZipFile(source).use { checkNotNull(it.getEntry("_chat.txt")).compressedSize }
    assertTrue(compressedSize > 0 && compressedSize < Int.MAX_VALUE)
    val descriptor = payloadOffset + compressedSize.toInt()
    assertEquals(0x08074b50L, unsignedInt(bytes, descriptor))
    return descriptor
  }

  private fun unsignedShort(bytes: ByteArray, offset: Int): Int =
    (bytes[offset].toInt() and 255) or ((bytes[offset + 1].toInt() and 255) shl 8)

  private fun unsignedInt(bytes: ByteArray, offset: Int): Long =
    (0..3).fold(0L) { value, index -> value or ((bytes[offset + index].toLong() and 255) shl (8 * index)) }
}
