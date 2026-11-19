package com.chatstamp.nativebridge

import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.util.AtomicFile
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.io.File
import java.io.IOException
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.coroutines.CoroutineContext

/** Exercise the service's real worker/registry, with deterministic dispatch and stop gates. */
class SaveWorkerLifecycleTest {
  private val context: Context = InstrumentationRegistry.getInstrumentation().targetContext
  private lateinit var directory: File
  private lateinit var chat: String
  private lateinit var fingerprint: String
  private lateinit var items: List<ScopedSaveItem>
  private val operations = mutableListOf<NativeOperation>()
  private val harnesses = mutableListOf<Harness>()
  private val gates = mutableListOf<CompletableDeferred<Unit>>()
  private val listenerOwner = Any()

  private class PausedDispatcher : CoroutineDispatcher() {
    private val pending = LinkedBlockingQueue<Runnable>()
    override fun dispatch(context: CoroutineContext, block: Runnable) { pending.add(block) }
    fun drain() {
      var steps = 0
      while (true) {
        val next = pending.poll() ?: return
        check(++steps <= 1000) { "Worker did not quiesce" }
        next.run()
      }
    }
    fun pumpUntil(condition: () -> Boolean) {
      repeat(1000) {
        if (condition()) return
        val next = pending.poll(15, TimeUnit.SECONDS)
          ?: throw AssertionError("No queued continuation reached the expected worker boundary")
        next.run()
      }
      throw AssertionError("Worker exceeded its bounded continuation count")
    }
  }

  private class Harness {
    val dispatcher = PausedDispatcher()
    val uncaught = mutableListOf<Throwable>()
    val scope = CoroutineScope(SupervisorJob() + dispatcher + CoroutineExceptionHandler { _, error -> uncaught.add(error) })
  }

  private data class StoredRow(val uri: Uri, val pending: Int)

  @Before fun prepare() {
    val id = UUID.randomUUID().toString()
    directory = File(context.cacheDir, "chatstamp/worker-test-$id").apply { check(mkdirs()) }
    chat = "worker-test-${id.take(8)}"
    fingerprint = MessageDigest.getInstance("SHA-256").digest(chat.toByteArray()).joinToString("") { "%02x".format(it) }
    items = listOf(source("first"), source("second"))
  }

  @After fun cleanup() {
    NativeOperations.removeListener(listenerOwner)
    operations.forEach { it.cancel() }
    gates.forEach { it.complete(Unit) }
    harnesses.forEach { harness ->
      harness.scope.cancel()
      harness.dispatcher.pumpUntil { harness.scope.coroutineContext[Job]?.isCompleted == true }
    }
    // Only failure teardown may need this fallback; assertions above require
    // the production worker to settle the operation without test assistance.
    operations.asReversed().forEach { operation ->
      if (!operation.progress.terminal) NativeOperations.finish(context, operation, "cancelled",
        error = OperationFailure("CANCELLED", "Synthetic test teardown"))
      NativeOperations.acknowledge(context, operation.id)
    }
    if (::chat.isInitialized) {
      rows().forEach { context.contentResolver.delete(it.uri, null, null) }
      assertTrue("All MediaStore rows owned by this synthetic worker test must be removed", rows().isEmpty())
      File(context.filesDir, "chatstamp-store/save-records").listFiles().orEmpty().forEach { file ->
        if (file.isFile && file.name.matches(Regex("[a-f0-9]{64}\\.json")) &&
          runCatching { JSONObject(file.readText()).optString("chatFolderName") == chat }.getOrDefault(false)) {
          AtomicFile(file).delete()
        }
      }
    }
    if (::directory.isInitialized) {
      assertTrue("The synthetic import fixture must be removed", !directory.exists() || directory.deleteRecursively())
      assertFalse(directory.exists())
    }
  }

  private fun harness() = Harness().also(harnesses::add)
  private fun gate() = CompletableDeferred<Unit>().also(gates::add)

  private fun source(label: String): ScopedSaveItem {
    val file = File(directory, "$label.txt").apply { writeText("Synthetic worker fixture: $label") }
    return ScopedSaveItem(label, Uri.fromFile(file).toString(), file.name, "document", "text/plain", dateSource = "none")
  }

  private fun begin(label: String, selected: List<ScopedSaveItem> = items): Pair<NativeOperation, ScopedSaveOptions> {
    val id = "worker-$label-${UUID.randomUUID()}"
    val options = ScopedSaveOptions(fingerprint, chat, operationId = id, workingDirectory = Uri.fromFile(directory).toString(),
      notificationTitle = "Synthetic worker test", notificationCancelLabel = "Cancel", alwaysUseMessageDate = true)
    val operation = NativeOperations.begin(context, id, "save", options.workingDirectory,
      archiveFingerprint = fingerprint, chatName = chat, totalFiles = selected.size)
    operations.add(operation)
    return operation to options
  }

  private fun rows(): List<StoredRow> {
    val collection = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
    val args = Bundle().apply {
      putInt(MediaStore.QUERY_ARG_MATCH_PENDING, MediaStore.MATCH_INCLUDE)
      putString(android.content.ContentResolver.QUERY_ARG_SQL_SELECTION,
        "${MediaStore.MediaColumns.RELATIVE_PATH} LIKE ? AND ${MediaStore.MediaColumns.OWNER_PACKAGE_NAME}=?")
      putStringArray(android.content.ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS, arrayOf("%/chatStamp/$chat/%", context.packageName))
    }
    val output = mutableListOf<StoredRow>()
    context.contentResolver.query(collection, arrayOf(MediaStore.MediaColumns._ID, MediaStore.MediaColumns.IS_PENDING), args, null)?.use { cursor ->
      while (cursor.moveToNext()) output.add(StoredRow(ContentUris.withAppendedId(collection, cursor.getLong(0)), cursor.getInt(1)))
    }
    return output
  }

  @Suppress("UNCHECKED_CAST")
  private fun results(value: Map<String, Any?>): List<Map<String, Any?>> = value["results"] as List<Map<String, Any?>>

  private fun assertTerminal(operation: NativeOperation, phase: String, code: String? = null) {
    assertEquals(phase, operation.progress.phase)
    assertTrue(operation.progress.terminal)
    val snapshot = checkNotNull(NativeOperations.snapshot(context))
    assertEquals(operation.id, (snapshot["progress"] as Map<*, *>)["operationId"])
    assertEquals(phase, (snapshot["progress"] as Map<*, *>)["phase"])
    if (code != null) assertEquals(code, (snapshot["error"] as Map<*, *>)["code"])
  }

  private fun assertContent(result: Map<String, Any?>, item: ScopedSaveItem) {
    val uri = Uri.parse(result["insertedUri"] as String)
    val bytes = context.contentResolver.openInputStream(uri)!!.use { it.readBytes() }
    assertArrayEquals(File(Uri.parse(item.sourceUri).path!!).readBytes(), bytes)
  }

  @Test fun prestartCancelSettlesOnlyAfterStopCreatesNoRowsAndAllowsTheNextRealSave() = runBlocking {
    val h = harness()
    val (operation, options) = begin("prestart")
    val stop = gate()
    var stopEntered = false
    var stopped = false
    var saveCalls = 0
    val worker = launchSaveWorker(h.scope, context, operation, items, options,
      onStopped = { stopEntered = true; stop.await(); stopped = true },
      save = { saveCalls++; ScopedMediaSaver(context, operation).save(items, options) })
    operation.worker = worker
    operation.cancel()
    val cancelling = async(start = CoroutineStart.UNDISPATCHED) { NativeOperations.cancelAndAwait(operation.id) }
    try {
      h.dispatcher.drain()
      assertEquals(0, saveCalls)
      assertTrue("Prestart cancellation must enter the real stop boundary", stopEntered)
      assertFalse(stopped)
      assertFalse(operation.completion.isCompleted)
      assertFalse(operation.progress.terminal)
      assertFalse(cancelling.isCompleted)
      assertEquals(0, rows().size)
      assertTrue(items.all { File(Uri.parse(it.sourceUri).path!!).isFile })
      stop.complete(Unit)
      h.dispatcher.drain()
      cancelling.await()
      assertTrue(stopped)
      assertTrue(worker.isCompleted)
      assertTrue(operation.completion.isCompleted)
      val result = operation.completion.await()
      assertEquals(items.map { it.entryId }, results(result).map { it["entryId"] })
      assertTrue(results(result).all { it["outcome"] == "cancelled" && it["ok"] == false && it["failureCode"] == "CANCELLED" })
      assertTerminal(operation, "cancelled", "CANCELLED")
      assertEquals(0, rows().size)
      NativeOperations.acknowledge(context, operation.id)
      val (next, nextOptions) = begin("next", items.take(1))
      val nextWorker = launchSaveWorker(h.scope, context, next, items.take(1), nextOptions, onStopped = {})
      next.worker = nextWorker
      h.dispatcher.pumpUntil { nextWorker.isCompleted }
      assertTrue(next.completion.isCompleted)
      val saved = results(next.completion.await()).single()
      assertEquals("saved", saved["outcome"])
      assertContent(saved, items.first())
      assertTerminal(next, "completed")
      assertEquals(1, rows().size)
      assertTrue(rows().all { it.pending == 0 })
      assertTrue(h.uncaught.isEmpty())
    } finally { stop.complete(Unit); h.dispatcher.drain(); cancelling.cancel() }
  }

  @Test fun normalCompletionWaitsForStopAndAcknowledgedOldJobBookkeepingCannotRejectTheNextOwner() = runBlocking {
    val h = harness()
    val (operation, options) = begin("normal")
    val stop = gate()
    var stopEntered = false
    var stopped = false
    var admittedBeforeOldJobCompleted = false
    var listenerFailure: Throwable? = null
    var next: Pair<NativeOperation, ScopedSaveOptions>? = null
    val extra = source("third")
    lateinit var worker: Job
    NativeOperations.addListener(listenerOwner) { name, value ->
      if (name == "onSaveProgress" && value["operationId"] == operation.id && value["phase"] == "completed") {
        try {
          val oldStillFinishing = !worker.isCompleted
          NativeOperations.acknowledge(context, operation.id)
          val gateAllowsNext = !saveWorkerIsBusy(worker, NativeOperations.find(operation.id))
          next = begin("handover", listOf(extra))
          admittedBeforeOldJobCompleted = oldStillFinishing && gateAllowsNext && stopped
        } catch (error: Throwable) { listenerFailure = error }
      }
    }
    try {
      worker = launchSaveWorker(h.scope, context, operation, items, options,
        onStopped = { stopEntered = true; stop.await(); stopped = true })
      operation.worker = worker
      h.dispatcher.pumpUntil { stopEntered }
      assertFalse(operation.completion.isCompleted)
      assertFalse(operation.progress.terminal)
      assertEquals(2, rows().size)
      assertTrue(rows().all { it.pending == 0 })
      stop.complete(Unit)
      h.dispatcher.pumpUntil { worker.isCompleted }
      assertNull(listenerFailure)
      assertTrue("A real acknowledged registry entry must not block B while A's Job is unfinished", admittedBeforeOldJobCompleted)
      assertEquals("completed", operation.progress.phase)
      val saved = results(operation.completion.await())
      assertEquals(2, saved.size)
      saved.forEach { row -> assertContent(row, items.single { it.entryId == row["entryId"] }) }
      val (nextOperation, nextOptions) = checkNotNull(next)
      val nextWorker = launchSaveWorker(h.scope, context, nextOperation, listOf(extra), nextOptions, onStopped = {})
      nextOperation.worker = nextWorker
      h.dispatcher.pumpUntil { nextWorker.isCompleted }
      assertEquals("saved", results(nextOperation.completion.await()).single()["outcome"])
      assertTerminal(nextOperation, "completed")
      assertEquals(3, rows().size)
      assertTrue(h.uncaught.isEmpty())
    } finally { stop.complete(Unit); h.dispatcher.drain() }
  }

  @Test fun inFlightCancelKeepsTheRealCompletedFileAndCancelsOnlyTheRemainderAfterAwaitedStop() = runBlocking {
    val h = harness()
    val (operation, options) = begin("inflight")
    val firstSaved = gate()
    val continueSaving = gate()
    val stop = gate()
    var stopEntered = false
    val worker = launchSaveWorker(h.scope, context, operation, items, options,
      onStopped = { stopEntered = true; stop.await() },
      save = {
        val completed = ScopedMediaSaver(context, operation).save(items.take(1), options)
        firstSaved.complete(Unit)
        continueSaving.await()
        completed
      })
    operation.worker = worker
    try {
      h.dispatcher.pumpUntil { firstSaved.isCompleted }
      assertEquals(1, rows().size)
      operation.cancel()
      h.dispatcher.drain()
      assertTrue(stopEntered)
      assertFalse(operation.completion.isCompleted)
      assertFalse(operation.progress.terminal)
      stop.complete(Unit)
      h.dispatcher.drain()
      assertTrue(worker.isCompleted)
      assertTrue(operation.completion.isCompleted)
      val completed = results(operation.completion.await())
      assertEquals(listOf("saved", "cancelled"), completed.map { it["outcome"] })
      assertEquals(items.map { it.entryId }, completed.map { it["entryId"] })
      assertContent(completed.first(), items.first())
      assertEquals("CANCELLED", completed.last()["failureCode"])
      assertTerminal(operation, "cancelled", "CANCELLED")
      assertEquals(1, rows().size)
      assertTrue(rows().all { it.pending == 0 })
      assertTrue(h.uncaught.isEmpty())
    } finally { stop.complete(Unit); continueSaving.complete(Unit); h.dispatcher.drain() }
  }

  @Test fun anAlreadyCancelledParentStillPublishesCancellationAndStopsWithoutInvokingTheSaver() = runBlocking {
    val h = harness()
    val (operation, options) = begin("cancelled-parent")
    var saveCalls = 0
    var stopCalls = 0
    h.scope.cancel()
    val worker = launchSaveWorker(h.scope, context, operation, items, options,
      onStopped = { stopCalls++ }, save = { saveCalls++; error("Cancelled scope must not write") })
    operation.worker = worker
    h.dispatcher.drain()
    assertEquals(0, saveCalls)
    assertEquals(1, stopCalls)
    assertTrue(worker.isCompleted)
    assertTrue(operation.completion.isCompleted)
    assertTrue(results(operation.completion.await()).all { it["outcome"] == "cancelled" })
    assertTerminal(operation, "cancelled", "CANCELLED")
    assertEquals(0, rows().size)
    assertTrue(h.uncaught.isEmpty())
  }

  @Test fun throwingStopStillSettlesTheOperationWithVisibleIoFailureAndRetainsCompletedOutputs() = runBlocking {
    val h = harness()
    val selected = items.take(1)
    val (operation, options) = begin("stop-failure", selected)
    var stopAttempts = 0
    val worker = launchSaveWorker(h.scope, context, operation, selected, options,
      onStopped = { stopAttempts++; throw IOException("Synthetic foreground-stop failure") })
    operation.worker = worker
    h.dispatcher.pumpUntil { worker.isCompleted }
    assertEquals(1, stopAttempts)
    assertTrue(operation.completion.isCompleted)
    val saved = results(operation.completion.await()).single()
    assertEquals("saved", saved["outcome"])
    assertContent(saved, selected.single())
    assertTerminal(operation, "failed", "IO_ERROR")
    assertEquals(1, rows().size)
    assertTrue(rows().all { it.pending == 0 })
    assertTrue(h.uncaught.isEmpty())
  }
}
