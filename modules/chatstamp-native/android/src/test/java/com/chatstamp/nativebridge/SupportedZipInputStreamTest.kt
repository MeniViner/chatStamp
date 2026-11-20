package com.chatstamp.nativebridge

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import java.util.zip.CRC32
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test

class SupportedZipInputStreamTest {
  @Test fun rejectsLegacyZstandardBeforeEntryDataOrOptionalClassLoading() = rejectMethod(20)
  @Test fun rejectsZstandardBeforeEntryDataOrOptionalClassLoading() = rejectMethod(93)

  private fun rejectMethod(method: Int) {
    val buffer = ByteArrayOutputStream()
    val payload = "Synthetic transcript".toByteArray()
    val entry = ZipEntry("_chat.txt").apply {
      this.method = ZipEntry.STORED
      size = payload.size.toLong()
      compressedSize = size
      crc = CRC32().apply { update(payload) }.value
    }
    ZipOutputStream(buffer).use { zip ->
      zip.putNextEntry(entry)
      zip.write(payload)
      zip.closeEntry()
    }
    val archive = buffer.toByteArray()
    archive[8] = method.toByte()
    archive[9] = 0
    SupportedZipInputStream(ByteArrayInputStream(archive)).use { zip ->
      try {
        zip.nextEntry
        fail("Unsupported compression must fail before returning an entry")
      } catch (error: OperationFailure) {
        assertEquals("ZIP_INVALID", error.code)
      }
    }
  }
}
