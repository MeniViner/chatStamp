package com.chatstamp.nativebridge

import java.io.File
import java.io.RandomAccessFile
import java.time.Instant

internal object Mp4Timestamps {
  private const val EPOCH_OFFSET_SECONDS = 2_082_844_800L
  private data class Box(val type: String, val start: Long, val end: Long)
  private data class Field(val offset: Long, val width: Int)

  fun readCreation(file: File): Instant? = RandomAccessFile(file, "r").use { input ->
    val movieHeader = field(input, movie(input).let { child(input, it, "mvhd") })
    input.seek(movieHeader.offset)
    val seconds = if (movieHeader.width == 4) input.readInt().toUInt().toLong() else input.readLong()
    if (seconds > EPOCH_OFFSET_SECONDS) Instant.ofEpochSecond(seconds - EPOCH_OFFSET_SECONDS) else null
  }

  // Callers patch a disposable copy so an I/O failure leaves the source intact.
  fun rewrite(file: File, target: Instant) = RandomAccessFile(file, "rw").use { output ->
    val movie = movie(output)
    val movieHeader = field(output, child(output, movie, "mvhd"))
    val fields = mutableListOf(movieHeader)
    boxes(output, movie.start, movie.end).filter { it.type == "trak" }.forEach { track ->
      fields += field(output, child(output, track, "tkhd"))
      fields += field(output, child(output, child(output, track, "mdia"), "mdhd"))
    }
    require(fields.size > 1) { "No track timestamp headers found" }
    val seconds = Math.addExact(target.epochSecond, EPOCH_OFFSET_SECONDS)
    require(seconds >= 0 && fields.all { it.width == 8 || seconds <= 0xFFFF_FFFFL }) {
      "Date exceeds the range of the container timestamp"
    }
    for (field in fields) {
      output.seek(field.offset)
      if (field.width == 4) {
        output.writeInt(seconds.toInt())
        output.writeInt(seconds.toInt())
      } else {
        output.writeLong(seconds)
        output.writeLong(seconds)
      }
    }
  }

  private fun movie(input: RandomAccessFile): Box =
    child(input, Box("file", 0, input.length()), "moov")

  private fun child(input: RandomAccessFile, parent: Box, type: String): Box =
    requireNotNull(boxes(input, parent.start, parent.end).filter { it.type == type }.singleOrNull()) {
      "Expected one $type in ${parent.type}"
    }

  private fun field(input: RandomAccessFile, box: Box): Field {
    require(box.end - box.start >= 4) { "Missing version and flags in ${box.type}" }
    input.seek(box.start)
    val width = when (input.readUnsignedByte()) {
      0 -> 4
      1 -> 8
      else -> throw IllegalArgumentException("Unsupported version in ${box.type}")
    }
    require(box.end - box.start >= 4 + 2 * width) { "Truncated dates in ${box.type}" }
    return Field(box.start + 4, width)
  }

  private fun boxes(input: RandomAccessFile, start: Long, end: Long): Sequence<Box> = sequence {
    var position = start
    while (position < end) {
      val remaining = end - position
      require(remaining >= 8) { "Truncated box header" }
      input.seek(position)
      val size32 = input.readInt().toUInt().toLong()
      val type = ByteArray(4).also(input::readFully).toString(Charsets.US_ASCII)
      val header = if (size32 == 1L) 16L else 8L
      require(remaining >= header) { "Truncated extended box header" }
      val size = when (size32) {
        0L -> remaining
        1L -> input.readLong()
        else -> size32
      }
      require(size in header..remaining) { "Invalid size for $type" }
      yield(Box(type, position + header, position + size))
      position += size
    }
  }
}
