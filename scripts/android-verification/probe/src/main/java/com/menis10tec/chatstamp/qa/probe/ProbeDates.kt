package com.menis10tec.chatstamp.qa.probe

import java.time.DateTimeException
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeFormatterBuilder
import java.time.format.DateTimeParseException
import java.time.format.ResolverStyle
import java.time.temporal.ChronoField
import java.util.Locale

internal object ProbeDates {
    val zone: ZoneId = ZoneId.of("Asia/Jerusalem")
    private val exifTime = DateTimeFormatter.ofPattern("uuuu:MM:dd HH:mm:ss", Locale.ROOT)
        .withResolverStyle(ResolverStyle.STRICT)
    private val exifOffset = DateTimeFormatter.ofPattern("xxx", Locale.ROOT)
    private val basicTime = DateTimeFormatterBuilder()
        .appendPattern("uuuuMMdd'T'HHmmss")
        .appendFraction(ChronoField.NANO_OF_SECOND, 0, 9, true)
        .appendOffset("+HHmm", "Z")
        .toFormatter(Locale.ROOT)

    fun exifValues(instant: Instant): Pair<String, String> {
        val local = instant.atZone(zone)
        return exifTime.format(local) to exifOffset.format(local)
    }

    fun parseExif(date: String?, offset: String?): Instant? {
        if (date == null || offset == null) return null
        return try {
            LocalDateTime.parse(date, exifTime).toInstant(ZoneOffset.of(offset))
        } catch (_: DateTimeException) {
            null
        }
    }

    fun parseRetriever(raw: String?): Instant? {
        if (raw == null) return null
        return try {
            Instant.parse(raw)
        } catch (_: DateTimeParseException) {
            try {
                OffsetDateTime.parse(raw, basicTime).toInstant()
            } catch (_: DateTimeParseException) {
                null
            }
        }
    }

    fun matches(actual: Instant?, expected: Instant): Boolean =
        actual != null && Duration.between(expected, actual).abs() <= Duration.ofSeconds(2)
}
