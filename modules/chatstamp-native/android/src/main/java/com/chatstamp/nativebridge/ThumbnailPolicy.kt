package com.chatstamp.nativebridge

import java.security.MessageDigest
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

internal data class ThumbnailLimits(
  val maxBytes: Long = 32L * 1024 * 1024,
  val maxEntries: Int = 512,
  val maxJpegBytes: Long = 512L * 1024
) {
  init { require(maxBytes > 0 && maxEntries > 0 && maxJpegBytes > 0) }
}

internal object ThumbnailPolicy {
  fun normalizedSize(value: Int): Int = normalizedSize(value.toDouble())

  fun normalizedSize(value: Double): Int {
    if (!value.isFinite() || value <= 0 || value % 1.0 != 0.0) {
      throw OperationFailure("IO_ERROR", "Thumbnail size must be a positive integer.")
    }
    return value.coerceIn(64.0, 512.0).toInt()
  }

  fun fit(width: Int, height: Int, maximum: Int): Pair<Int, Int> {
    require(width > 0 && height > 0 && maximum > 0)
    val scale = min(1.0, min(maximum.toDouble() / width, maximum.toDouble() / height))
    return max(1, (width * scale).roundToInt()) to max(1, (height * scale).roundToInt())
  }

  fun reusable(modifiedMillis: Long?, bytes: Long?): Boolean =
    modifiedMillis != null && modifiedMillis > 0 && bytes != null && bytes >= 0

  fun key(identity: String, modifiedMillis: Long?, bytes: Long?, size: Int): String {
    val parts = listOf("chatstamp-thumbnail-v1", identity, modifiedMillis?.toString() ?: "unknown",
      bytes?.toString() ?: "unknown", size.toString())
    val input = parts.joinToString("") { "${it.length}:$it" }
    return MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
      .joinToString("") { "%02x".format(it) }
  }
}
