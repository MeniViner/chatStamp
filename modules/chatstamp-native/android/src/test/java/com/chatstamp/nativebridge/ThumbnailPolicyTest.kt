package com.chatstamp.nativebridge

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import java.nio.file.Files

class ThumbnailPolicyTest {
  @Test fun clampsPositiveSizesAndRejectsNonpositiveRequests() {
    assertEquals(64, ThumbnailPolicy.normalizedSize(1))
    assertEquals(256, ThumbnailPolicy.normalizedSize(256))
    assertEquals(512, ThumbnailPolicy.normalizedSize(Int.MAX_VALUE))
    for (size in listOf(0, -1)) {
      try { ThumbnailPolicy.normalizedSize(size); fail("Nonpositive size accepted") }
      catch (error: OperationFailure) { assertEquals("IO_ERROR", error.code) }
    }
    for (size in listOf(Double.NaN, Double.POSITIVE_INFINITY, 0.5)) {
      try { ThumbnailPolicy.normalizedSize(size); fail("Invalid numeric size accepted") }
      catch (error: OperationFailure) { assertEquals("IO_ERROR", error.code) }
    }
  }

  @Test fun fitsBeforeDecodeWithoutUpscalingOrZeroDimensions() {
    assertEquals(256 to 192, ThumbnailPolicy.fit(4000, 3000, 256))
    assertEquals(100 to 50, ThumbnailPolicy.fit(100, 50, 256))
    assertEquals(1 to 64, ThumbnailPolicy.fit(1, 100000, 64))
    assertEquals(64 to 1, ThumbnailPolicy.fit(100000, 1, 64))
  }

  @Test fun everySourceVersionAndSizeChangesTheOpaqueKey() {
    val original = ThumbnailPolicy.key("file:///one", 100, 200, 256)
    assertTrue(original.matches(Regex("[a-f0-9]{64}")))
    assertNotEquals(original, ThumbnailPolicy.key("file:///two", 100, 200, 256))
    assertNotEquals(original, ThumbnailPolicy.key("file:///one", 101, 200, 256))
    assertNotEquals(original, ThumbnailPolicy.key("file:///one", 100, 201, 256))
    assertNotEquals(original, ThumbnailPolicy.key("file:///one", 100, 200, 512))
    assertFalse(ThumbnailPolicy.reusable(null, 200))
    assertFalse(ThumbnailPolicy.reusable(100, null))
    assertFalse(ThumbnailPolicy.reusable(0, 200))
    assertTrue(ThumbnailPolicy.reusable(100, 0))
  }

  @Test fun diskCacheEvictsByCountAndBytesAndRejectsIncompletePairs() {
    val root = Files.createTempDirectory("chatstamp-thumb-").toFile()
    try {
      val cache = ThumbnailDiskCache(root, ThumbnailLimits(maxBytes = 9000, maxEntries = 2, maxJpegBytes = 1024))
      val a = ThumbnailPolicy.key("a", 1, 1, 64)
      val b = ThumbnailPolicy.key("b", 1, 1, 64)
      val c = ThumbnailPolicy.key("c", 1, 1, 64)
      fun put(key: String, owner: String = "job-a") = cache.put(key,
        ThumbnailCacheRecord(64, 32, "image", null, owner, true)) { stream ->
          stream.write(byteArrayOf(-1, -40)); stream.write(ByteArray(100)); stream.write(byteArrayOf(-1, -39)); true
        }
      put(a); put(b)
      java.io.File(root, "$a.properties").setLastModified(1)
      java.io.File(root, "$b.properties").setLastModified(2)
      put(c, "job-b")
      assertNull(cache.read(a))
      assertNotNull(cache.read(c))
      assertTrue(cache.totalBytes() <= 9000)
      assertTrue(cache.entryCount() <= 2)
      java.io.File(root, "$c.jpg").delete()
      assertNull(cache.read(c))
      assertFalse(java.io.File(root, "$c.properties").exists())
      cache.invalidateOwner("job-a")
      assertNull(cache.read(b))
    } finally { root.deleteRecursively() }
  }

  @Test fun failedOrOversizedWritesLeaveNoTemporaryOrPartialEntry() {
    val root = Files.createTempDirectory("chatstamp-thumb-").toFile()
    try {
      val cache = ThumbnailDiskCache(root, ThumbnailLimits(maxBytes = 6000, maxEntries = 2, maxJpegBytes = 16))
      val key = ThumbnailPolicy.key("source", 1, 1, 64)
      try {
        cache.put(key, ThumbnailCacheRecord(64, 64, "image", null, null, true)) {
          it.write(ByteArray(17)); true
        }
        fail("Oversized output accepted")
      } catch (_: java.io.IOException) { }
      assertEquals(0, root.listFiles().orEmpty().size)
      try {
        cache.put(key, ThumbnailCacheRecord(64, 64, "image", null, null, true)) { false }
        fail("Failed encoder accepted")
      } catch (_: java.io.IOException) { }
      assertEquals(0, root.listFiles().orEmpty().size)
    } finally { root.deleteRecursively() }
  }

  @Test fun byteReservationEvictsEvenBelowTheEntryLimit() {
    val root = Files.createTempDirectory("chatstamp-thumb-").toFile()
    try {
      val cache = ThumbnailDiskCache(root, ThumbnailLimits(maxBytes = 4800, maxEntries = 20, maxJpegBytes = 400))
      fun put(name: String) {
        cache.put(ThumbnailPolicy.key(name, 1, 1, 64), ThumbnailCacheRecord(64, 64, "image", null, "job", true)) {
          it.write(byteArrayOf(-1, -40)); it.write(ByteArray(386)); it.write(byteArrayOf(-1, -39)); true
        }
      }
      put("one"); put("two")
      assertNull(cache.read(ThumbnailPolicy.key("one", 1, 1, 64)))
      assertNotNull(cache.read(ThumbnailPolicy.key("two", 1, 1, 64)))
      assertTrue(cache.totalBytes() <= 4800)
    } finally { root.deleteRecursively() }
  }

  @Test fun explicitInvalidationRemovesOnlyAnOwnedJpegAndItsRecord() {
    val root = Files.createTempDirectory("chatstamp-thumb-").toFile()
    val outside = Files.createTempFile("chatstamp-private-", ".json").toFile().apply { writeText("keep") }
    try {
      val cache = ThumbnailDiskCache(root)
      val key = ThumbnailPolicy.key("source", 1, 1, 64)
      cache.put(key, ThumbnailCacheRecord(64, 64, "image", null, null, true)) {
        it.write(byteArrayOf(-1, -40, 1, 2, -1, -39)); true
      }
      cache.invalidateFile(cache.file(key))
      assertFalse(cache.file(key).exists())
      assertFalse(java.io.File(root, "$key.properties").exists())
      cache.invalidateFile(cache.file(key))
      for (file in listOf(outside, java.io.File(root, "arbitrary.jpg"), java.io.File(root, "$key.properties"))) {
        try { cache.invalidateFile(file); fail("Non-owned cache path accepted") }
        catch (error: OperationFailure) { assertEquals("IO_ERROR", error.code) }
      }
      Files.createSymbolicLink(cache.file(key).toPath(), outside.toPath())
      try { cache.invalidateFile(cache.file(key)); fail("Symlink escaped the thumbnail root") }
      catch (error: OperationFailure) { assertEquals("IO_ERROR", error.code) }
      assertEquals("keep", outside.readText())
    } finally { root.deleteRecursively(); outside.delete() }
  }

  @Test fun queueCoalescesAndRejectsExcessInsteadOfGrowingWithoutBound() = runBlocking {
    val queue = ThumbnailWorkQueue<Int>(workers = 1, pendingLimit = 1)
    val started = CompletableDeferred<Unit>()
    val finish = CompletableDeferred<Unit>()
    try {
      val first = queue.enqueue("one", "job", false) { started.complete(Unit); finish.await(); 1 }!!
      started.await()
      assertSame(first, queue.enqueue("one", "job", false) { error("Duplicate render") })
      val second = queue.enqueue("two", "job", false) { 2 }!!
      assertNull(queue.enqueue("three", "job", false) { 3 })
      finish.complete(Unit)
      assertEquals(1, first.await())
      assertEquals(2, second.await())
    } finally { queue.cancelAll() }
  }

  @Test fun invalidatedQueuedWorkNeverRendersAfterAnotherTaskFinishes() = runBlocking {
    val queue = ThumbnailWorkQueue<Int>(workers = 1, pendingLimit = 2)
    val started = CompletableDeferred<Unit>()
    val finish = CompletableDeferred<Unit>()
    var lateRenders = 0
    try {
      val first = queue.enqueue("first", "other-job", false) { started.complete(Unit); finish.await(); 1 }!!
      started.await()
      val stale = queue.enqueue("stale", "released-job", false) { lateRenders++; 2 }!!
      queue.cancelOwner("released-job")
      finish.complete(Unit)
      first.await()
      try { stale.await(); fail("Cancelled work completed") }
      catch (_: kotlinx.coroutines.CancellationException) { }
      assertEquals(0, lateRenders)
    } finally { queue.cancelAll() }
  }

  @Test fun heavyTasksAreSerialAndDoNotBlockTheImageWorker() = runBlocking {
    val queue = ThumbnailWorkQueue<Int>(workers = 2, pendingLimit = 2)
    val firstStarted = CompletableDeferred<Unit>()
    val finish = CompletableDeferred<Unit>()
    var secondHeavyStarted = false
    try {
      val first = queue.enqueue("video-one", null, true) { firstStarted.complete(Unit); finish.await(); 1 }!!
      firstStarted.await()
      val second = queue.enqueue("video-two", null, true) { secondHeavyStarted = true; 2 }!!
      assertEquals(3, queue.enqueue("image", null, false) { 3 }!!.await())
      assertFalse(secondHeavyStarted)
      finish.complete(Unit)
      assertEquals(1, first.await()); assertEquals(2, second.await())
    } finally { queue.cancelAll() }
  }
}
