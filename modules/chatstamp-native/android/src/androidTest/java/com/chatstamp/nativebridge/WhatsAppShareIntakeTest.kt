package com.chatstamp.nativebridge

import android.content.ClipData
import android.content.ContentProvider
import android.content.ContentResolver
import android.content.ContentValues
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.UriPermission
import android.content.pm.ProviderInfo
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import androidx.core.content.FileProvider
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.supervisorScope
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutionException
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicInteger
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class WhatsAppShareIntakeTest {
  private val context: Context = InstrumentationRegistry.getInstrumentation().targetContext
  private lateinit var inputs: File
  private val leases = mutableSetOf<String>()
  private val jobs = mutableListOf<File>()
  private val operationIds = mutableListOf<String>()
  private val conversation = "2019-02-26, 12:34 - QA Dana: photo.jpg (file attached)\nהמשך הודעה בעברית\n"

  @Before fun prepare() {
    assertEquals(0, SharedZipInbox.debug()["pendingCount"])
    inputs = File(context.cacheDir, "chatstamp/wa-inputs-${UUID.randomUUID()}").apply { check(mkdirs()) }
  }

  @After fun cleanup() {
    try {
      assertEquals(0, SharedZipInbox.debug()["pendingCount"])
    } finally {
      NativeOperations.removeListener(this)
      operationIds.forEach { NativeOperations.acknowledge(context, it) }
      leases.forEach { SharedZipInbox.release(context, it) }
      jobs.forEach { it.deleteRecursively() }
      if (::inputs.isInitialized) inputs.deleteRecursively()
    }
  }

  @Test fun coldLaunchAfterOrdinaryIntentReceivesShareAndRereadingItsTokenDoesNotDuplicate() {
    val zip = zip("cold.zip")
    val source = uri(zip)
    SharedZipInbox.captureLaunch(context, Intent(Intent.ACTION_MAIN))
    assertEquals(false, SharedZipInbox.consume()["received"])
    val share = single(source)
    SharedZipInbox.captureLaunch(context, share)
    val delivery = consume()
    assertEquals(listOf(source), SharedZipInbox.resolve(handle(delivery))?.sources)
    SharedZipInbox.captureLaunch(context, Intent(share))
    SharedZipInbox.captureNew(context, share)
    assertEquals(false, consume()["received"])
  }

  @Test fun warmNewIntentWithTheSameUriGetsItsOwnLeaseAndOneReleaseCannotDiscardTheOther() {
    val source = uri(zip("same-export.zip"))
    SharedZipInbox.captureNew(context, single(source))
    val first = consume()
    SharedZipInbox.captureNew(context, single(source))
    val second = consume()
    assertNotEquals(first["id"], second["id"])
    val firstHandle = handle(first)
    val secondHandle = handle(second)
    assertNotEquals(firstHandle, secondHandle)
    SharedZipInbox.release(context, firstHandle)
    assertNull(SharedZipInbox.resolve(firstHandle))
    assertEquals(listOf(source), SharedZipInbox.resolve(secondHandle)?.sources)
    context.contentResolver.openInputStream(source)!!.use { assertEquals(0x50, it.read()) }
    SharedZipInbox.release(context, secondHandle)
    assertNull(SharedZipInbox.resolve(secondHandle))
    assertEquals(false, consume()["received"])
  }

  @Test fun streamBatchIsOneImmutableReceiptAndDoesNotAbsorbUnrelatedClipData() {
    val text = uri(text())
    val photo = uri(file("photo.jpg", byteArrayOf(1, 2, 3, 4)))
    val unrelated = uri(zip("unrelated.zip"))
    val streams = arrayListOf(text, photo, text)
    val intent = multiple(streams).apply { clipData = ClipData.newRawUri("Ignored fallback", unrelated) }
    SharedZipInbox.captureNew(context, intent)
    streams.add(unrelated)
    intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, arrayListOf(unrelated))
    val delivery = consume()
    assertEquals(listOf(text, photo), SharedZipInbox.resolve(handle(delivery))?.sources)
    assertEquals(false, consume()["received"])
  }

  @Test fun clipDataOnlyGenericSendFallsBackToOriginalContentSourceAndDeduplicatesUris() = runBlocking {
    val zip = zip("clip-only.zip")
    val source = uri(zip)
    val clip = ClipData.newRawUri("Synthetic export", source).apply { addItem(ClipData.Item(source)) }
    SharedZipInbox.captureNew(context, Intent(Intent.ACTION_SEND).apply {
      type = "application/octet-stream"
      clipData = clip
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    })
    val delivery = consume()
    val sourceHandle = handle(delivery)
    assertEquals(listOf(source), SharedZipInbox.resolve(sourceHandle)?.sources)
    val result = extract(sourceHandle)
    assertEquals(hexDigest(zip.readBytes()), result["archiveFingerprint"])
    assertEquals(setOf("_chat.txt", "photo.jpg"), extractedNames(result))
    assertTrue(zip.isFile)
    assertNoCopiedArchive()
    assertEquals(false, consume()["received"])
  }

  @Test fun sendMultipleSeparateTranscriptAndMediaImportsWithoutAPriorSavedZip() = runBlocking {
    val transcript = text()
    val photo = file("photo.jpg", byteArrayOf(7, 8, 9, 10))
    val sources = listOf(uri(transcript), uri(photo))
    SharedZipInbox.captureNew(context, multiple(sources).apply {
      putExtra(Intent.EXTRA_TEXT, "Synthetic chat metadata, not a second export")
    })
    val sourceHandle = handle(consume())
    assertEquals(sources, SharedZipInbox.resolve(sourceHandle)?.sources)
    val result = extract(sourceHandle)
    assertEquals(2, result["extractedCount"])
    assertEquals(setOf("_chat.txt", "photo.jpg"), extractedNames(result))
    val candidate = rows(result, "transcriptCandidates").single()
    assertEquals(conversation, File(Uri.parse(candidate["uri"] as String).path!!).readText())
    assertEquals(conversation, candidate["sample"])
    assertTrue((result["archiveFingerprint"] as String).matches(Regex("[a-f0-9]{64}")))
    assertEquals(listOf("_chat.txt", "photo.jpg"), inputs.listFiles()!!.map { it.name }.sorted())
    assertNoCopiedArchive()
    assertNotNull(SharedZipInbox.resolve(sourceHandle))
    SharedZipInbox.release(context, sourceHandle)
    assertNull(SharedZipInbox.resolve(sourceHandle))
  }

  @Test fun clipDataOnlyMultipleRawFilesRemainOneImport() = runBlocking {
    val text = uri(text())
    val photo = uri(file("photo.jpg", byteArrayOf(3, 4, 5)))
    SharedZipInbox.captureNew(context, Intent(Intent.ACTION_SEND_MULTIPLE).apply {
      type = "*/*"
      clipData = ClipData.newRawUri("Transcript", text).apply { addItem(ClipData.Item(photo)); addItem(ClipData.Item(text)) }
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    })
    val sourceHandle = handle(consume())
    assertEquals(listOf(text, photo), SharedZipInbox.resolve(sourceHandle)?.sources)
    assertEquals(setOf("_chat.txt", "photo.jpg"), extractedNames(extract(sourceHandle)))
    assertEquals(false, consume()["received"])
    assertNoCopiedArchive()
  }

  @Test fun rawFileFingerprintIsStableAcrossNewReceiptsAndChangesWithActualMediaContent() = runBlocking {
    val text = text()
    val photo = file("photo.jpg", byteArrayOf(20, 21, 22))
    suspend fun importCurrent(sources: List<Uri> = listOf(uri(text), uri(photo))): String {
      SharedZipInbox.captureNew(context, multiple(sources))
      return extract(handle(consume()))["archiveFingerprint"] as String
    }
    val first = importCurrent()
    val replay = importCurrent()
    assertEquals(first, replay)
    assertEquals(first, importCurrent(listOf(uri(photo), uri(text))))
    photo.writeBytes(byteArrayOf(20, 21, 23))
    assertNotEquals(first, importCurrent())
    assertNoCopiedArchive()
  }

  @Test fun rawTextSamplingIsBoundedAndKeepsUtf8HebrewWithoutTruncatingTheExtractedFile() = runBlocking {
    val content = conversation + "שלום משפחה, שורה עברית נוספת\n".repeat(10_000)
    val transcript = file("_chat.txt", content.toByteArray(Charsets.UTF_8))
    val photo = file("photo.jpg", byteArrayOf(30, 31, 32))
    SharedZipInbox.captureNew(context, multiple(listOf(uri(transcript), uri(photo))))
    val result = extract(handle(consume()))
    val candidate = rows(result, "transcriptCandidates").single()
    val sample = candidate["sample"] as String
    assertTrue(sample.toByteArray(Charsets.UTF_8).size <= 64 * 1024)
    assertTrue(sample.startsWith(conversation))
    assertFalse(sample.contains('\uFFFD'))
    assertEquals(transcript.length(), (candidate["sizeBytes"] as Number).toLong())
    assertEquals(content, File(Uri.parse(candidate["uri"] as String).path!!).readText(Charsets.UTF_8))
    assertNoCopiedArchive()
  }

  @Test fun transcriptWithAZipAttachmentUsesRawFilesAndDoesNotImportTheAttachmentAsAnotherChat() = runBlocking {
    val transcript = text()
    val photo = file("photo.jpg", byteArrayOf(40, 41, 42))
    val attachment = zip("attachment.zip")
    SharedZipInbox.captureNew(context, multiple(listOf(uri(transcript), uri(photo), uri(attachment))))
    val result = extract(handle(consume()))
    assertEquals(3, result["extractedCount"])
    assertEquals(setOf("_chat.txt", "photo.jpg", "attachment.zip"), extractedNames(result))
    assertEquals(0, result["skippedCount"])
    assertTrue(rows(result, "skippedEntries").isEmpty())
    val transcripts = rows(result, "transcriptCandidates")
    assertEquals(1, transcripts.size)
    assertEquals("_chat.txt", transcripts.single()["filename"])
    val documents = rows(result, "mediaFiles")
    assertEquals(setOf("photo.jpg", "attachment.zip"), documents.map { it["filename"] }.toSet())
    val zipDocument = documents.single { it["filename"] == attachment.name }
    val copiedDocument = File(Uri.parse(zipDocument["uri"] as String).path!!)
    assertTrue("The ZIP attachment must remain a byte-identical document", attachment.readBytes().contentEquals(copiedDocument.readBytes()))
    val outputs = jobs.single().walkTopDown().filter { it.isFile }.toList()
    assertEquals(3, outputs.size)
    assertEquals((transcripts + documents).map { File(Uri.parse(it["uri"] as String).path!!).canonicalFile }.toSet(),
      outputs.map { it.canonicalFile }.toSet())
    assertTrue("An attached ZIP must not produce nested extraction output", outputs.all { it.parentFile == File(jobs.single(), "extracted") })
    assertTrue(transcript.isFile && photo.isFile && attachment.isFile)
  }

  @Test fun multipleArchivesWithoutATranscriptAreAnExplicitUnsupportedShare() = runBlocking {
    SharedZipInbox.captureNew(context, multiple(listOf(uri(zip("one.zip")), uri(zip("two.zip")))))
    expectFailure("SHARE_INVALID", handle(consume()))
    assertTrue(jobs.all { File(it, "extracted").listFiles().orEmpty().isEmpty() })
  }

  @Test fun mediaOnlyBatchHasActionableNoTranscriptFailureWithoutDeletingOriginals() = runBlocking {
    val photo = file("photo.jpg", byteArrayOf(50, 51, 52))
    SharedZipInbox.captureNew(context, multiple(listOf(uri(photo))))
    expectFailure("NO_TRANSCRIPT", handle(consume()))
    assertTrue(photo.isFile)
    assertTrue(jobs.all { File(it, "extracted").listFiles().orEmpty().isEmpty() })
  }

  @Test fun expiredSourceAndReleasedHandleBothFailAsPermissionLostWithoutPartialOutput() = runBlocking {
    val first = zip("expired.zip")
    SharedZipInbox.captureNew(context, single(uri(first)))
    val firstHandle = handle(consume())
    assertTrue(first.delete())
    expectFailure("PERMISSION_LOST", firstHandle)
    val second = zip("released.zip")
    SharedZipInbox.captureNew(context, single(uri(second)))
    val secondHandle = handle(consume())
    SharedZipInbox.release(context, secondHandle)
    expectFailure("PERMISSION_LOST", secondHandle)
    assertTrue(second.isFile)
    assertTrue(jobs.all { File(it, "extracted").listFiles().orEmpty().isEmpty() })
  }

  @Test fun rawFileEntryAndByteLimitsUseTheNativeArchivePolicyAndRemovePartialFiles() = runBlocking {
    val text = text()
    val photo = file("photo.jpg", ByteArray(2048) { 4 })
    for (limits in listOf(ArchiveLimits(maxEntries = 1), ArchiveLimits(maxEntryBytes = 32))) {
      SharedZipInbox.captureNew(context, multiple(listOf(uri(text), uri(photo))))
      expectFailure("ARCHIVE_LIMIT", handle(consume()), limits)
    }
    assertTrue(jobs.all { File(it, "extracted").listFiles().orEmpty().isEmpty() })
    assertTrue(text.isFile && photo.isFile)
  }

  @Test fun temporaryOnlyProviderStillWorksWhenPersistablePermissionIsOfferedButRefused() = runBlocking {
    val source = uri(zip("temporary-only.zip"))
    assertFalse(context.contentResolver.persistedUriPermissions.any { it.uri == source })
    SharedZipInbox.captureNew(context, single(source).addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION))
    val sourceHandle = handle(consume())
    assertEquals(setOf("_chat.txt", "photo.jpg"), extractedNames(extract(sourceHandle)))
    assertFalse(context.contentResolver.persistedUriPermissions.any { it.uri == source })
    assertNotNull(SharedZipInbox.resolve(sourceHandle))
  }

  @Test fun malformedOptionalSubjectMetadataDoesNotDiscardAValidGrantedStream() {
    val archive = zip("valid-with-metadata.zip")
    val source = uri(archive)
    SharedZipInbox.captureNew(context, single(source).apply { putExtra(Intent.EXTRA_SUBJECT, 17) })
    val delivery = consume()
    assertEquals(listOf(source), SharedZipInbox.resolve(handle(delivery))?.sources)
    assertEquals(archive.name, delivery["filename"])
    assertEquals(false, consume()["received"])
  }

  @Test fun cancellationAtTheFirstRealExtractingEventSettlesAndRemovesTheCreatedOutput() = runBlocking {
    val transcript = text()
    val photo = file("photo.jpg", ByteArray(2048) { 7 })
    SharedZipInbox.captureNew(context, multiple(listOf(uri(transcript), uri(photo))))
    var cancelledId: String? = null
    var sawCreatedOutput = false
    NativeOperations.addListener(this@WhatsAppShareIntakeTest) { event, progress ->
      val id = progress["operationId"] as? String
      if (event == "onImportProgress" && progress["phase"] == "extracting" && id != null && id in operationIds && cancelledId == null) {
        cancelledId = id
        sawCreatedOutput = jobs.any { File(it, "extracted").isDirectory }
        NativeOperations.cancel(id)
      }
    }
    val error = runCatching { extract(handle(consume())) }.exceptionOrNull()
    assertNotNull("Cancellation must not return a successful import", error)
    assertEquals("CANCELLED", failureFor(error!!, cancelledId != null).code)
    assertNotNull(cancelledId)
    assertTrue(sawCreatedOutput)
    assertEquals("cancelled", NativeOperations.find(cancelledId!!)!!.progress.phase)
    assertTrue(jobs.all { !File(it, "extracted").exists() })
    assertTrue(transcript.isFile && photo.isFile)
  }

  @Test fun laterRawByteLimitRemovesTheAlreadyExtractedTranscriptPrefix() = runBlocking {
    val transcript = text()
    val photo = file("photo.jpg", ByteArray(2048) { 5 })
    SharedZipInbox.captureNew(context, multiple(listOf(uri(transcript), uri(photo))))
    expectFailure("ARCHIVE_LIMIT", handle(consume()), ArchiveLimits(maxEntryBytes = 1024))
    val operation = NativeOperations.find(operationIds.last())!!
    assertTrue(operation.progress.bytesDone >= transcript.length())
    assertEquals("failed", operation.progress.phase)
    assertTrue(jobs.all { !File(it, "extracted").exists() })
    assertTrue(transcript.isFile && photo.isFile)
  }

  @Test fun cancellationDuringBlockedMetadataQueryPreventsAllPayloadOpensAndWrites() {
    val transcript = text()
    val provider = BlockingMetadataProvider(transcript)
    provider.attachInfo(context, ProviderInfo().apply { authority = "com.chatstamp.synthetic.metadata" })
    val sourceContext = ResolverContext(context, ContentResolver.wrap(provider))
    val source = Uri.parse("content://com.chatstamp.synthetic.metadata/_chat.txt")
    // A subject prevents the inbox's optional display-name lookup from being the gate.
    SharedZipInbox.captureNew(sourceContext, single(source).apply { putExtra(Intent.EXTRA_SUBJECT, "Synthetic metadata cancellation") })
    val sourceHandle = handle(consume())
    val executor = Executors.newSingleThreadExecutor()
    val extraction = executor.submit<Map<String, Any?>> { runBlocking { extract(sourceHandle, sourceContext = sourceContext) } }
    try {
      assertTrue("Metadata query did not start", provider.entered.await(5, TimeUnit.SECONDS))
      val id = operationIds.last()
      assertNotNull("Import must be registered before provider metadata IO", NativeOperations.find(id))
      assertNotNull("Metadata lookup must carry cancellation", provider.signal)
      NativeOperations.cancel(id)
      assertTrue("Cancellation must reach the blocked provider", provider.signal!!.isCanceled)
      provider.unblock.countDown()
      val failure = runCatching { extraction.get(5, TimeUnit.SECONDS) }.exceptionOrNull()
      assertNotNull("Cancelled metadata must not return a successful extraction", failure)
      val cause = if (failure is ExecutionException) failure.cause!! else failure!!
      assertEquals("CANCELLED", failureFor(cause).code)
      assertEquals("cancelled", NativeOperations.find(id)!!.progress.phase)
      assertEquals(0, provider.payloadOpens.get())
      assertTrue(jobs.all { it.walkTopDown().none { candidate -> candidate.isFile } })
      assertTrue(transcript.isFile)
    } finally {
      provider.unblock.countDown()
      runCatching { extraction.get(5, TimeUnit.SECONDS) }
      executor.shutdownNow()
      assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS))
    }
  }

  @Test fun pendingOldGrantRevocationSerializesNewSameUriConsumptionAndReacquiresItsGrant() {
    val source = uri(zip("grant-race.zip"))
    val grants = BlockingGrantResolver(context)
    val sourceContext = ResolverContext(context, grants)
    fun receipt() = single(source).apply {
      addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
      putExtra(Intent.EXTRA_SUBJECT, "Synthetic grant ownership")
    }
    SharedZipInbox.captureNew(sourceContext, receipt())
    val first = handle(consume())
    assertEquals(1, grants.acquisitions.get())
    val executor = Executors.newFixedThreadPool(2)
    val releasing = executor.submit { SharedZipInbox.release(sourceContext, first) }
    var consuming: java.util.concurrent.Future<Map<String, Any?>>? = null
    try {
      assertTrue("Old platform revocation did not begin", grants.revocationEntered.await(5, TimeUnit.SECONDS))
      // Capturing remains fast while grant platform IO is blocked.
      executor.submit { SharedZipInbox.captureNew(sourceContext, receipt()) }.get(2, TimeUnit.SECONDS)
      val consumeEntered = CountDownLatch(1)
      val consumingNow = executor.submit<Map<String, Any?>> {
        consumeEntered.countDown()
        SharedZipInbox.consume()
      }
      consuming = consumingNow
      assertTrue(consumeEntered.await(5, TimeUnit.SECONDS))
      try {
        consumingNow.get(200, TimeUnit.MILLISECONDS)
        throw AssertionError("New consumption must wait until old grant revocation completes")
      } catch (_: TimeoutException) { /* A is held at an explicit platform IO gate. */ }
      assertEquals(1, grants.acquisitions.get())
      grants.allowRevocation.countDown()
      releasing.get(5, TimeUnit.SECONDS)
      val second = consumingNow.get(5, TimeUnit.SECONDS).also { delivery ->
        (delivery["sourceUri"] as? String)?.let(leases::add)
      }
      val secondHandle = handle(second)
      assertNotEquals(first, secondHandle)
      assertNull(SharedZipInbox.resolve(first))
      assertEquals(listOf(source), SharedZipInbox.resolve(secondHandle)?.sources)
      assertEquals(2, grants.acquisitions.get())
      assertTrue(grants.events.indexOf("revoke-end") < grants.events.indexOf("take-2"))
      assertEquals(0x50, grants.readOriginalAfterGrant(source))
    } finally {
      grants.allowRevocation.countDown()
      runCatching { releasing.get(5, TimeUnit.SECONDS) }
      runCatching { consuming?.get(5, TimeUnit.SECONDS) }.getOrNull()?.let { delivery ->
        (delivery["sourceUri"] as? String)?.let(leases::add)
      }
      executor.shutdownNow()
      assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS))
    }
  }

  @Test fun cancelBeforeQueuedImportStartsPreventsMetadataPayloadAndPendingOperationLeaks() = runBlocking {
    val transcript = text()
    val provider = BlockingMetadataProvider(transcript)
    provider.attachInfo(context, ProviderInfo().apply { authority = "com.chatstamp.synthetic.queued" })
    val sourceContext = ResolverContext(context, ContentResolver.wrap(provider))
    val source = Uri.parse("content://com.chatstamp.synthetic.queued/_chat.txt")
    SharedZipInbox.captureNew(sourceContext, single(source).apply { putExtra(Intent.EXTRA_SUBJECT, "Synthetic queued cancellation") })
    val sourceHandle = handle(consume())
    val id = "wa-import-${UUID.randomUUID()}"
    val job = File(context.cacheDir, "chatstamp/$id").apply { check(mkdirs()) }
    jobs.add(job); operationIds.add(id)
    supervisorScope {
      val worker = async(start = CoroutineStart.LAZY) {
        SharedExportImporter(sourceContext).extract(sourceHandle, Uri.fromFile(File(job, "extracted")).toString(), id)
      }
      try {
        assertNull(NativeOperations.find(id))
        NativeOperations.cancelAndAwait(id)
        assertEquals(1L, provider.entered.count)
        worker.start()
        val error = runCatching { withTimeout(5_000) { worker.await() } }.exceptionOrNull()
        assertNotNull("Pre-dispatch cancellation must not return a successful import", error)
        assertEquals("CANCELLED", failureFor(error!!).code)
        assertEquals("Provider metadata must never be queried", 1L, provider.entered.count)
        assertEquals(0, provider.payloadOpens.get())
        val operation = NativeOperations.find(id)!!
        assertEquals("cancelled", operation.progress.phase)
        assertTrue("The native completion promise must settle", operation.completion.isCompleted)
        val completionError = runCatching { operation.completion.await() }.exceptionOrNull()
        assertNotNull(completionError)
        assertEquals("CANCELLED", failureFor(completionError!!).code)
        assertTrue(job.walkTopDown().none { it.isFile })
        assertTrue(transcript.isFile)
      } finally {
        provider.unblock.countDown()
        runCatching { withTimeout(5_000) { worker.await() } }
      }
    }
  }

  private fun file(name: String, bytes: ByteArray): File = File(inputs, name).apply { writeBytes(bytes) }
  private fun text(): File = file("_chat.txt", conversation.toByteArray(Charsets.UTF_8))
  private fun uri(file: File): Uri = FileProvider.getUriForFile(context, "${context.packageName}.ChatStampFileProvider", file)
  private fun single(source: Uri): Intent = Intent(Intent.ACTION_SEND).apply {
    type = "application/zip"
    putExtra(Intent.EXTRA_STREAM, source)
    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
  }
  private fun multiple(sources: List<Uri>): Intent = Intent(Intent.ACTION_SEND_MULTIPLE).apply {
    type = "*/*"
    putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(sources))
    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
  }
  private fun consume(): Map<String, Any?> = SharedZipInbox.consume().also { result ->
    (result["sourceUri"] as? String)?.let(leases::add)
  }
  private fun handle(delivery: Map<String, Any?>): String {
    assertEquals(true, delivery["received"])
    assertNull(delivery["errorCode"])
    val value = delivery["sourceUri"] as String
    assertEquals("chatstamp-share", Uri.parse(value).scheme)
    return value
  }
  private suspend fun extract(source: String, limits: ArchiveLimits = ArchiveLimits(), sourceContext: Context = context): Map<String, Any?> {
    val id = "wa-import-${UUID.randomUUID()}"
    val job = File(context.cacheDir, "chatstamp/$id").apply { check(mkdirs()) }
    jobs.add(job); operationIds.add(id)
    return SharedExportImporter(sourceContext, limits).extract(source, Uri.fromFile(File(job, "extracted")).toString(), id)
  }
  private suspend fun expectFailure(code: String, source: String, limits: ArchiveLimits = ArchiveLimits()) {
    try {
      extract(source, limits)
      throw AssertionError("Expected $code")
    } catch (failure: OperationFailure) {
      assertEquals(code, failure.code)
    }
  }
  @Suppress("UNCHECKED_CAST")
  private fun rows(result: Map<String, Any?>, key: String): List<Map<String, Any?>> = result[key] as List<Map<String, Any?>>
  private fun extractedNames(result: Map<String, Any?>): Set<String> =
    (rows(result, "transcriptCandidates") + rows(result, "mediaFiles")).map { it["filename"] as String }.toSet()
  private fun assertNoCopiedArchive() {
    jobs.forEach { job -> assertFalse(job.walkTopDown().any { it.isFile && it.extension.equals("zip", true) }) }
  }
  private fun hexDigest(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
  private fun zip(name: String): File = File(inputs, name).apply {
    ZipOutputStream(outputStream()).use { archive ->
      for ((path, data) in listOf("_chat.txt" to conversation.toByteArray(Charsets.UTF_8), "photo.jpg" to byteArrayOf(1, 2, 3))) {
        archive.putNextEntry(ZipEntry(path)); archive.write(data); archive.closeEntry()
      }
    }
  }

  private class ResolverContext(base: Context, private val resolver: ContentResolver) : ContextWrapper(base) {
    override fun getApplicationContext(): Context = this
    override fun getContentResolver(): ContentResolver = resolver
  }

  private class BlockingMetadataProvider(private val payload: File) : ContentProvider() {
    val entered = CountDownLatch(1)
    val unblock = CountDownLatch(1)
    val payloadOpens = AtomicInteger()
    @Volatile var signal: CancellationSignal? = null
    override fun onCreate(): Boolean = true
    override fun getType(uri: Uri): String = "text/plain"
    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor = metadata(projection, null)
    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?, cancellationSignal: CancellationSignal?): Cursor = metadata(projection, cancellationSignal)
    private fun metadata(projection: Array<out String>?, cancellation: CancellationSignal?): Cursor {
      signal = cancellation
      entered.countDown()
      check(unblock.await(10, TimeUnit.SECONDS)) { "Metadata gate was not released" }
      cancellation?.throwIfCanceled()
      val columns = projection ?: arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
      return MatrixCursor(columns).apply {
        addRow(columns.map { name -> when (name) {
          OpenableColumns.DISPLAY_NAME -> payload.name
          OpenableColumns.SIZE -> payload.length()
          else -> null
        } })
      }
    }
    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
      payloadOpens.incrementAndGet()
      return ParcelFileDescriptor.open(payload, ParcelFileDescriptor.MODE_READ_ONLY)
    }
    override fun insert(uri: Uri, values: ContentValues?): Uri? = throw UnsupportedOperationException()
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = throw UnsupportedOperationException()
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = throw UnsupportedOperationException()
  }

  /** Controls only platform grant calls; inbox ownership/serialization stays real. */
  private class BlockingGrantResolver(private val realContext: Context) : ContentResolver(realContext) {
    val revocationEntered = CountDownLatch(1)
    val allowRevocation = CountDownLatch(1)
    val acquisitions = AtomicInteger()
    val events = CopyOnWriteArrayList<String>()
    private val held = ConcurrentHashMap.newKeySet<Uri>()
    override fun getPersistedUriPermissions(): MutableList<UriPermission> = mutableListOf()
    override fun takePersistableUriPermission(uri: Uri, modeFlags: Int) {
      check(modeFlags == Intent.FLAG_GRANT_READ_URI_PERMISSION)
      held.add(uri)
      events.add("take-${acquisitions.incrementAndGet()}")
    }
    override fun releasePersistableUriPermission(uri: Uri, modeFlags: Int) {
      check(modeFlags == Intent.FLAG_GRANT_READ_URI_PERMISSION)
      events.add("revoke-start")
      revocationEntered.countDown()
      check(allowRevocation.await(10, TimeUnit.SECONDS)) { "Grant revocation gate was not released" }
      held.remove(uri)
      events.add("revoke-end")
    }
    fun readOriginalAfterGrant(uri: Uri): Int {
      check(uri in held) { "The new receipt lost its grant" }
      return realContext.contentResolver.openInputStream(uri)!!.use { it.read() }
    }
  }
}
