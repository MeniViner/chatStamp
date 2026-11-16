package com.chatstamp.nativebridge

import android.media.MediaMetadataRetriever
import androidx.exifinterface.media.ExifInterface
import java.io.File
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeFormatterBuilder
import java.time.format.ResolverStyle
import java.time.temporal.ChronoField
import java.util.Locale

internal object MediaTimestamps {
  private val localFormat = DateTimeFormatter.ofPattern("uuuu:MM:dd HH:mm:ss", Locale.ROOT)
    .withResolverStyle(ResolverStyle.STRICT)
  private val offsetFormat = DateTimeFormatter.ofPattern("xxx", Locale.ROOT)
  private val retrieverFormat = DateTimeFormatterBuilder()
    .appendPattern("uuuuMMdd'T'HHmmss")
    .appendFraction(ChronoField.NANO_OF_SECOND, 0, 9, true)
    .appendOffset("+HHmm", "Z")
    .toFormatter(Locale.ROOT)

  enum class Format { EXIF, CONTAINER, OTHER }
  data class DateChoice(val instant: Instant?, val source: String)

  fun format(mime: String): Format = when (mime) {
    "image/jpeg", "image/png", "image/webp" -> Format.EXIF
    "video/mp4", "video/quicktime", "video/x-m4v", "video/3gpp" -> Format.CONTAINER
    else -> Format.OTHER
  }

  fun choose(requested: Instant?, source: String, existing: Instant?, alwaysUseMessageDate: Boolean): DateChoice = when {
    requested == null -> DateChoice(null, "none")
    !alwaysUseMessageDate && existing != null -> DateChoice(existing, "capture")
    else -> DateChoice(requested, source)
  }

  fun close(actual: Instant?, expected: Instant?): Boolean =
    actual != null && expected != null && Duration.between(expected, actual).abs() <= Duration.ofSeconds(2)

  fun readExif(exif: ExifInterface, zone: ZoneId, requireOffset: Boolean = false): Instant? {
    val local = exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL) ?: return null
    val offset = exif.getAttribute(ExifInterface.TAG_OFFSET_TIME_ORIGINAL)
    if (requireOffset && offset == null) return null
    return runCatching {
      val date = LocalDateTime.parse(local, localFormat)
      if (offset != null) date.toInstant(ZoneOffset.of(offset))
      else date.atZone(zone).toInstant()
    }.getOrNull()
  }

  fun writeExif(file: File, date: Instant, zone: ZoneId) {
    val local = date.atZone(zone)
    ExifInterface(file).apply {
      for (tag in listOf(ExifInterface.TAG_DATETIME, ExifInterface.TAG_DATETIME_ORIGINAL, ExifInterface.TAG_DATETIME_DIGITIZED)) {
        setAttribute(tag, localFormat.format(local))
      }
      for (tag in listOf(ExifInterface.TAG_OFFSET_TIME, ExifInterface.TAG_OFFSET_TIME_ORIGINAL, ExifInterface.TAG_OFFSET_TIME_DIGITIZED)) {
        setAttribute(tag, offsetFormat.format(local))
      }
      for (tag in listOf(ExifInterface.TAG_SUBSEC_TIME, ExifInterface.TAG_SUBSEC_TIME_ORIGINAL, ExifInterface.TAG_SUBSEC_TIME_DIGITIZED)) {
        setAttribute(tag, null)
      }
      saveAttributes()
    }
  }

  fun readVideo(retriever: MediaMetadataRetriever): Instant? {
    val date = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE) ?: return null
    return runCatching { Instant.parse(date) }.getOrElse {
      runCatching { OffsetDateTime.parse(date, retrieverFormat).toInstant() }.getOrNull()
    }
  }
}
