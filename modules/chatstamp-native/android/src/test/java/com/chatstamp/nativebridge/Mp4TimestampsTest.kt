package com.chatstamp.nativebridge

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.time.Instant

class Mp4TimestampsTest {
  @get:Rule val temporary = TemporaryFolder()

  @Test fun rewritesBothWidthsAcrossTracksWithAnExtendedMovieAfterMedia() {
    val file = temporary.newFile()
    val media = box("mdat", byteArrayOf(9, 3, 4, 7))
    file.writeBytes(media + movie(0))
    val target = Instant.parse("2020-03-17T10:00:00Z")
    Mp4Timestamps.rewrite(file, target)
    val quickTimeSeconds = 3_667_284_000L
    assertArrayEquals(media + movie(quickTimeSeconds), file.readBytes())
    assertEquals(target, Mp4Timestamps.readCreation(file))
  }

  @Test fun validatesEveryTrackBeforeWriting() {
    val file = temporary.newFile()
    val malformed = box("moov", dates("mvhd", 0, 0) + track(1, 0) +
      box("trak", dates("tkhd", 0, 0) + box("mdia", box("mdhd", byteArrayOf(0, 0)))))
    file.writeBytes(malformed)
    assertThrows(IllegalArgumentException::class.java) {
      Mp4Timestamps.rewrite(file, Instant.parse("2019-02-16T09:30:00Z"))
    }
    assertArrayEquals(malformed, file.readBytes())
  }

  @Test fun rejectsTruncatedBoxesAndVersionZeroOverflowWithoutMutation() {
    val file = temporary.newFile()
    for (source in listOf(movie(0), movie(0).dropLast(1).toByteArray())) {
      file.writeBytes(source)
      assertThrows(IllegalArgumentException::class.java) {
        Mp4Timestamps.rewrite(file, Instant.parse("2080-01-01T00:00:00Z"))
      }
      assertArrayEquals(source, file.readBytes())
    }
  }

  @Test fun usesTheFullVersionOneRange() {
    val file = temporary.newFile()
    val target = Instant.parse("2080-01-01T00:00:00Z")
    file.writeBytes(box("moov", dates("mvhd", 1, 0) + track(1, 0)))
    Mp4Timestamps.rewrite(file, target)
    assertEquals(target, Mp4Timestamps.readCreation(file))
  }

  @Test fun aFailedReplacementKeepsThePreviousFile() {
    assertFalse(mayRemoveReplacedFile(false, true, "verified", true))
    assertFalse(mayRemoveReplacedFile(true, true, "mtime-only", true))
    assertFalse(mayRemoveReplacedFile(true, true, "unverified", false))
    assertTrue(mayRemoveReplacedFile(true, true, "verified", true))
    assertTrue(mayRemoveReplacedFile(true, false, "unverified", false))
  }

  private fun movie(time: Long) = box("moov", dates("mvhd", 0, time) + track(0, time) + track(1, time), wide = true)
  private fun track(version: Int, time: Long) =
    box("trak", dates("tkhd", version, time) + box("mdia", dates("mdhd", version, time)))

  private fun dates(name: String, version: Int, time: Long) = box(name, bytes {
    writeInt(version shl 24)
    repeat(2) { if (version == 0) writeInt(time.toInt()) else writeLong(time) }
    writeInt(48000)
  })

  private fun box(name: String, payload: ByteArray, wide: Boolean = false) = bytes {
    writeInt(if (wide) 1 else payload.size + 8)
    writeBytes(name)
    if (wide) writeLong(payload.size + 16L)
    write(payload)
  }

  private fun bytes(write: DataOutputStream.() -> Unit): ByteArray {
    val stream = ByteArrayOutputStream()
    DataOutputStream(stream).use(write)
    return stream.toByteArray()
  }
}
