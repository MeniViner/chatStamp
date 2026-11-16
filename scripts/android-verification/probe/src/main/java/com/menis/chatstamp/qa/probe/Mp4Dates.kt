package com.menis.chatstamp.qa.probe

import java.io.File
import java.io.RandomAccessFile
import java.time.Instant

// The probe rewrites fixed-width date fields in its synthetic QuickTime fixtures.
internal object Mp4Dates {
    private const val EPOCH_DIFFERENCE = 2_082_844_800L
    private val dateBoxes = mapOf("moov" to "mvhd", "trak" to "tkhd", "mdia" to "mdhd")
    private val childBoxes = mapOf("" to "moov", "moov" to "trak", "trak" to "mdia")

    private data class Field(val box: String, val position: Long, val width: Int)
    data class Dates(val box: String, val creation: Instant, val modification: Instant)

    fun rewrite(file: File, instant: Instant) {
        RandomAccessFile(file, "rw").use { input ->
            val fields = findFields(input)
            val time = Math.addExact(instant.epochSecond, EPOCH_DIFFERENCE)
            require(time >= 0L && fields.all { it.width == 8 || time <= 0xFFFF_FFFFL }) {
                "Date exceeds the range of the MP4 header"
            }
            for (field in fields) {
                input.seek(field.position)
                if (field.width == 4) {
                    input.writeInt(time.toInt())
                    input.writeInt(time.toInt())
                } else {
                    input.writeLong(time)
                    input.writeLong(time)
                }
            }
        }
    }

    fun read(file: File): List<Dates> = RandomAccessFile(file, "r").use { input ->
        findFields(input).map { field ->
            input.seek(field.position)
            val creation = readTime(input, field.width)
            val modification = readTime(input, field.width)
            Dates(field.box, creation, modification)
        }
    }

    private fun readTime(input: RandomAccessFile, width: Int): Instant {
        val ticks = if (width == 4) input.readInt().toUInt().toLong() else input.readLong()
        require(ticks >= 0)
        return Instant.ofEpochSecond(ticks - EPOCH_DIFFERENCE)
    }

    private fun findFields(input: RandomAccessFile): List<Field> {
        val fields = mutableListOf<Field>()
        scan(input, 0, input.length(), "", fields)
        require(fields.map { it.box }.containsAll(dateBoxes.values)) { "Missing MP4 date headers" }
        return fields
    }

    private fun scan(input: RandomAccessFile, start: Long, end: Long, parent: String, fields: MutableList<Field>) {
        var position = start
        while (position < end) {
            val remaining = end - position
            require(remaining >= 8) { "Truncated MP4 box header" }
            input.seek(position)
            val size32 = input.readInt().toUInt().toLong()
            val box = ByteArray(4).also(input::readFully).toString(Charsets.US_ASCII)
            val header = if (size32 == 1L) 16 else 8
            require(remaining >= header) { "Truncated extended MP4 box header" }
            val size = when (size32) {
                0L -> remaining
                1L -> input.readLong()
                else -> size32
            }
            require(size in header.toLong()..remaining) { "Invalid size for $box" }
            val content = position + header
            if (box == childBoxes[parent]) {
                scan(input, content, position + size, box, fields)
            } else if (box == dateBoxes[parent]) {
                val length = size - header
                require(length >= 4) { "Missing version for $box" }
                val width = when (input.readUnsignedByte()) {
                    0 -> 4
                    1 -> 8
                    else -> error("Unsupported version for $box")
                }
                require(length >= 4 + width * 2) { "Truncated dates in $box" }
                fields += Field(box, content + 4, width)
            }
            position += size
        }
    }
}
