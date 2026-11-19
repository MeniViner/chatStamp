package com.menis10tec.chatstamp.qa.probe

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.io.File
import java.time.Instant

class ProbeHostTest {
    @get:Rule
    val temporary = TemporaryFolder()

    @Test
    fun rewritesBothDecodableVideoFixtures() {
        val assets = File(requireNotNull(System.getProperty("probe.assets")))
        val output = File(requireNotNull(System.getProperty("probe.host-output")))
        val stem = assets.resolve("probe-run.txt").readText().trim()
        val targets = listOf(
            Triple("green", "2022-07-08T09:10:11Z", "2019-02-16T09:30:00Z"),
            Triple("purple", "2018-07-08T09:10:11Z", "2020-03-17T10:00:00Z"),
        )
        for ((id, original, expected) in targets) {
            val fixture = assets.resolve("$stem-$id.mp4")
            val rewritten = fixture.copyTo(output.resolve(fixture.name), overwrite = true)
            assertEquals(Instant.parse(original), Mp4Dates.read(fixture).first { it.box == "mvhd" }.creation)
            Mp4Dates.rewrite(rewritten, Instant.parse(expected))
            assertEquals(fixture.length(), rewritten.length())
            assertEquals(listOf("mvhd", "tkhd", "mdhd"), Mp4Dates.read(rewritten).map { it.box })
            assertTrue(Mp4Dates.read(rewritten).all { it.creation == Instant.parse(expected) && it.modification == it.creation })
        }
    }

    @Test
    fun versionOneSupportsWideDatesWithoutChangingMediaBytes() {
        val media = box("mdat", byteArrayOf(23, 42, 7))
        val file = temporary.newFile("version-one.mp4").apply { writeBytes(movie(1) + media) }
        val target = Instant.parse("2080-01-01T12:00:00Z")
        Mp4Dates.rewrite(file, target)
        assertTrue(Mp4Dates.read(file).all { it.creation == target && it.modification == target })
        assertArrayEquals(media, file.readBytes().takeLast(media.size).toByteArray())
    }

    @Test
    fun versionZeroRejectsOverflowBeforeAnyWrite() {
        val source = movie(0)
        val file = temporary.newFile("version-zero.mp4").apply { writeBytes(source) }
        assertThrows(IllegalArgumentException::class.java) {
            Mp4Dates.rewrite(file, Instant.parse("2080-01-01T12:00:00Z"))
        }
        assertArrayEquals(source, file.readBytes())
    }

    @Test
    fun rejectsTruncatedBoxBeforeAnyWrite() {
        val source = movie(0).dropLast(1).toByteArray()
        val file = temporary.newFile("truncated.mp4").apply { writeBytes(source) }
        assertThrows(IllegalArgumentException::class.java) {
            Mp4Dates.rewrite(file, Instant.parse("2019-02-15T08:30:00Z"))
        }
        assertArrayEquals(source, file.readBytes())
    }

    @Test
    fun jpegLocalTimeAndOffsetIdentifyTheOriginalInstant() {
        val winter = Instant.parse("2019-02-15T08:30:00Z")
        val summer = Instant.parse("2020-06-20T10:00:00Z")
        assertEquals("2019:02:15 10:30:00" to "+02:00", ProbeDates.exifValues(winter))
        assertEquals("2020:06:20 13:00:00" to "+03:00", ProbeDates.exifValues(summer))
        assertEquals(winter, ProbeDates.parseExif("2019:02:15 10:30:00", "+02:00"))
        assertNull(ProbeDates.parseExif("2019:02:15 10:30:00", null))
    }

    @Test
    fun retrieverDatesAndIndexToleranceAreComparedAsInstants() {
        val expected = Instant.parse("2020-03-17T10:00:00Z")
        assertEquals(expected, ProbeDates.parseRetriever("20200317T100000.000Z"))
        assertEquals(expected, ProbeDates.parseRetriever("20200317T120000+0200"))
        assertEquals(expected, ProbeDates.parseRetriever("2020-03-17T10:00:00Z"))
        assertNull(ProbeDates.parseRetriever("20200317T100000"))
        assertTrue(ProbeDates.matches(expected.plusSeconds(2), expected))
        assertFalse(ProbeDates.matches(expected.plusMillis(2_001), expected))
    }

    private fun movie(version: Int): ByteArray = box(
        "moov", dateBox("mvhd", version) +
            box("trak", dateBox("tkhd", version) + box("mdia", dateBox("mdhd", version))),
    )

    private fun dateBox(type: String, version: Int): ByteArray {
        val datesSize = if (version == 0) 8 else 16
        return box(type, byteArrayOf(version.toByte(), 0, 0, 0) + ByteArray(datesSize))
    }

    private fun box(type: String, payload: ByteArray): ByteArray {
        val stream = ByteArrayOutputStream()
        DataOutputStream(stream).use {
            it.writeInt(8 + payload.size)
            it.writeBytes(type)
            it.write(payload)
        }
        return stream.toByteArray()
    }
}
