package com.chatstamp.nativebridge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ArchiveLimitsTest {
  private val limits = ArchiveLimits(maxEntries = 3, maxEntryBytes = 8, maxTotalBytes = 12)

  private fun failure(code: String, block: () -> Unit): OperationFailure {
    val error = assertThrows(OperationFailure::class.java) { block() }
    assertEquals(code, error.code)
    return error
  }

  @Test fun entryCountIncludesEveryObservedEntryAndAcceptsTheBoundary() {
    (0..3).forEach(limits::checkEntryCount)
    failure("ARCHIVE_LIMIT") { limits.checkEntryCount(4) }
  }

  @Test fun productionEntryCountIsBoundedAtTwentyThousand() {
    val production = ArchiveLimits()
    production.checkEntryCount(20_000)
    failure("ARCHIVE_LIMIT") { production.checkEntryCount(20_001) }
  }

  @Test fun productionEntryBytesAreBoundedAtTwoGiB() {
    val production = ArchiveLimits()
    val twoGiB = 2L * 1024 * 1024 * 1024
    production.checkWrite(twoGiB - 1, twoGiB - 1, 1, Long.MAX_VALUE)
    failure("ARCHIVE_LIMIT") { production.checkWrite(twoGiB, twoGiB, 1, Long.MAX_VALUE) }
  }

  @Test fun productionTotalBytesAreBoundedAtEightGiB() {
    val production = ArchiveLimits()
    val eightGiB = 8L * 1024 * 1024 * 1024
    production.checkWrite(0, eightGiB - 1, 1, Long.MAX_VALUE)
    failure("ARCHIVE_LIMIT") { production.checkWrite(0, eightGiB, 1, Long.MAX_VALUE) }
  }

  @Test fun declaredEntrySizesCanBeCheckedBeforeTheFirstWrite() {
    limits.checkWrite(0, 0, 8, 8)
    failure("ARCHIVE_LIMIT") { limits.checkWrite(0, 0, 9, 20) }
  }

  @Test fun streamedWritesEnforceIndividualAndCumulativeBytes() {
    limits.checkWrite(7, 11, 1, 1)
    failure("ARCHIVE_LIMIT") { limits.checkWrite(8, 8, 1, 10) }
    failure("ARCHIVE_LIMIT") { limits.checkWrite(3, 12, 1, 10) }
  }

  @Test fun freeSpaceIsCheckedBeforeEveryUnknownSizeBufferWrite() {
    limits.checkWrite(2, 6, 2, 2)
    val error = failure("NO_SPACE") { limits.checkWrite(4, 8, 3, 2) }
    assertEquals(1L, error.missingBytes)
  }

  @Test fun noSpaceReportsTheComputableShortfallForKnownEntrySizes() {
    val error = failure("NO_SPACE") { limits.checkWrite(0, 0, 8, 3) }
    assertEquals(5L, error.missingBytes)
  }

  @Test fun zeroByteEntryDoesNotRequireFreeSpace() {
    limits.checkWrite(0, 0, 0, 0)
    limits.checkWrite(8, 12, 0, 0)
  }

  @Test fun overflowingCountersCannotBypassArchiveLimits() {
    failure("ARCHIVE_LIMIT") { limits.checkWrite(Long.MAX_VALUE, 0, 1, Long.MAX_VALUE) }
    failure("ARCHIVE_LIMIT") { limits.checkWrite(0, Long.MAX_VALUE, 1, Long.MAX_VALUE) }
    failure("ARCHIVE_LIMIT") { limits.checkWrite(0, 0, Long.MAX_VALUE, Long.MAX_VALUE) }
  }

  @Test fun failedChecksDoNotConsumeOrResetTheBudget() {
    failure("NO_SPACE") { limits.checkWrite(0, 0, 8, 0) }
    limits.checkWrite(7, 11, 1, 1)
    failure("ARCHIVE_LIMIT") { limits.checkWrite(0, 12, 1, 1) }
    limits.checkWrite(0, 0, 1, 1)
  }
}
