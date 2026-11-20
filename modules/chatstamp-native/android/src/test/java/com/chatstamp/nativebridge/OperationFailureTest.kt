package com.chatstamp.nativebridge

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.CancellationException

class OperationFailureTest {
  @Test fun cancellationDuringAReadClosesItsInputWithoutReportingArchiveCorruption() = runBlocking {
    val operation = NativeOperation("cancel-read-test", "import", "file:///cache/chatstamp/cancel-read-test/")
    val stream = operation.register(CloseAwareInputStream())
    try {
      val rejected = runCatching {
        readZip(operation) {
          assertEquals(7, stream.read())
          operation.cancel()
          stream.read()
        }
      }.exceptionOrNull()
      assertTrue("Cancellation must close the registered source", stream.closed)
      assertTrue("The read must fail with a coded operation error", rejected is OperationFailure)
      assertEquals("CANCELLED", (rejected as OperationFailure).code)
    } finally {
      operation.unregister(stream)
      stream.close()
    }
  }

  @Test fun aGenuineArchiveReadFailureStillReportsZipInvalid() = runBlocking {
    val operation = NativeOperation("damaged-read-test", "import", "file:///cache/chatstamp/damaged-read-test/")
    val corruptRead = IOException("Compressed entry could not be read")
    val rejected = runCatching { readZip(operation) { throw corruptRead } }.exceptionOrNull()
    assertTrue(rejected is OperationFailure)
    assertEquals("ZIP_INVALID", (rejected as OperationFailure).code)
    assertSame(corruptRead, rejected.cause)
  }

  @Test fun aCodedZipErrorRemainsARealArchiveFailureWithoutCancellation() {
    val corruptArchive = OperationFailure("ZIP_INVALID", "CRC does not match")
    val classified = failureFor(corruptArchive, cancelled = false)
    assertEquals("ZIP_INVALID", classified.code)
    assertSame(corruptArchive, classified)
  }

  @Test fun aClosedStreamIsCancellationWhenTheOperationWasCancelled() {
    val closedStream = IOException("Stream closed")
    val classified = failureFor(closedStream, cancelled = true)
    assertEquals("CANCELLED", classified.code)
    assertSame(closedStream, classified.cause)
  }

  @Test fun aCoroutineCancellationIsClassifiedAsCancellationWithoutAnExplicitFlag() {
    assertEquals("CANCELLED", failureFor(CancellationException("Cancelled worker")).code)
  }

  @Test fun genuineIoFailureRemainsIoErrorWithoutCancellation() {
    val diskFailure = IOException("The output volume is unavailable")
    val classified = failureFor(diskFailure, cancelled = false)
    assertEquals("IO_ERROR", classified.code)
    assertSame(diskFailure, classified.cause)
  }

  @Test fun anExplicitCleanupFailureRemainsVisibleEvenAfterCancellation() {
    val cleanupFailure = OperationFailure("IO_ERROR", "The pending output row could not be deleted")
    val classified = failureFor(cleanupFailure, cancelled = true)
    assertEquals("IO_ERROR", classified.code)
    assertSame(cleanupFailure, classified)
  }

  private class CloseAwareInputStream : InputStream() {
    var closed = false
      private set

    override fun read(): Int {
      if (closed) throw IOException("Stream closed")
      return 7
    }

    override fun close() { closed = true }
  }
}
