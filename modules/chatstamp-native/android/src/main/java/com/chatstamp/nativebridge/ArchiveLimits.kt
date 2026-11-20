package com.chatstamp.nativebridge

internal class OperationFailure(
  val code: String,
  message: String,
  val missingBytes: Long? = null,
  cause: Throwable? = null
) : RuntimeException(message, cause)

internal class ArchiveLimits(
  private val maxEntries: Int = 20_000,
  private val maxEntryBytes: Long = 2_147_483_648,
  private val maxTotalBytes: Long = 8_589_934_592
) {
  init {
    require(maxEntries > 0 && maxEntryBytes > 0 && maxTotalBytes > 0)
  }

  fun checkEntryCount(count: Int) {
    if (count < 0 || count > maxEntries) {
      throw OperationFailure("ARCHIVE_LIMIT", "The archive exceeds the entry-count limit ($maxEntries).")
    }
  }

  fun checkWrite(entryBytes: Long, totalBytes: Long, nextBytes: Long, freeBytes: Long) {
    if (entryBytes < 0 || totalBytes < 0 || nextBytes < 0 || freeBytes < 0 ||
      entryBytes > maxEntryBytes || nextBytes > maxEntryBytes - entryBytes ||
      totalBytes > maxTotalBytes || nextBytes > maxTotalBytes - totalBytes) {
      throw OperationFailure("ARCHIVE_LIMIT", "The archive exceeds its uncompressed byte limit.")
    }
    if (nextBytes > freeBytes) {
      throw OperationFailure("NO_SPACE", "The cache volume does not have enough free space.", nextBytes - freeBytes)
    }
  }
}
