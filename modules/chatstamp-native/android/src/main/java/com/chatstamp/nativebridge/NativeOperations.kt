package com.chatstamp.nativebridge

import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.provider.BaseColumns
import android.provider.MediaStore
import android.util.AtomicFile
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Job
import org.json.JSONArray
import org.json.JSONObject
import java.io.Closeable
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

internal data class OperationProgress(
  val operationId: String,
  val kind: String,
  val phase: String = "preparing",
  val filesDone: Int = 0,
  val totalFiles: Int? = null,
  val bytesDone: Long = 0,
  val totalBytes: Long? = null,
  val currentFileName: String? = null
) {
  val terminal: Boolean get() = phase in setOf("completed", "cancelled", "failed")
  fun bridge(): Map<String, Any?> = mapOf(
    "operationId" to operationId, "kind" to kind, "phase" to phase,
    "filesDone" to filesDone, "totalFiles" to totalFiles,
    "bytesDone" to bytesDone, "totalBytes" to totalBytes, "currentFileName" to currentFileName
  )
}

internal class NativeOperation(
  val id: String,
  val kind: String,
  val workingDirectory: String,
  val sourceUri: String? = null,
  val chatName: String? = null,
  var archiveFingerprint: String? = null,
  totalFiles: Int? = null,
  totalBytes: Long? = null
) {
  @Volatile var progress = OperationProgress(id, kind, totalFiles = totalFiles, totalBytes = totalBytes)
  @Volatile var worker: Job? = null
  val cancelled = AtomicBoolean(false)
  val completion = CompletableDeferred<Map<String, Any?>>()
  val results = mutableListOf<Map<String, Any?>>()
  private val streams = ConcurrentHashMap.newKeySet<Closeable>()
  private var lastEvent = 0L

  fun checkCancelled() {
    if (cancelled.get()) throw OperationFailure("CANCELLED", "The operation was cancelled.")
  }

  fun <T : Closeable> register(stream: T): T {
    if (cancelled.get()) { runCatching { stream.close() }; checkCancelled() }
    streams.add(stream)
    if (cancelled.get()) { runCatching { stream.close() }; checkCancelled() }
    return stream
  }

  fun unregister(stream: Closeable) { streams.remove(stream) }

  fun cancel() {
    cancelled.set(true)
    worker?.cancel()
    streams.forEach { runCatching { it.close() } }
  }

  @Synchronized fun advance(value: OperationProgress, force: Boolean = false) {
    val phaseChanged = value.phase != progress.phase
    progress = value
    val now = SystemClock.elapsedRealtime()
    if (force || phaseChanged || value.terminal || now - lastEvent >= 100) {
      lastEvent = now
      NativeOperations.emit(if (kind == "import") "onImportProgress" else "onSaveProgress", value.bridge())
    }
  }

  @Synchronized fun addResult(value: Map<String, Any?>) { results.add(value) }
  @Synchronized fun completedResults(): List<Map<String, Any?>> = results.toList()

  fun snapshot(result: Map<String, Any?>? = null, error: OperationFailure? = null): Map<String, Any?> =
    mapOf(
      "progress" to progress.bridge(), "workingDirectory" to workingDirectory,
      "sourceUri" to sourceUri, "archiveFingerprint" to archiveFingerprint,
      "chatName" to chatName, "result" to result,
      "error" to error?.let { mapOf("code" to it.code, "message" to it.message, "missingBytes" to it.missingBytes) }
    )
}

internal object NativeOperations {
  private val operations = ConcurrentHashMap<String, NativeOperation>()
  private val listeners = ConcurrentHashMap<Any, (String, Map<String, Any?>) -> Unit>()
  private val guard = Any()
  private val cancelledBeforeStart = linkedSetOf<String>()
  @Volatile private var latestId: String? = null
  @Volatile private var latestStored: Map<String, Any?>? = null
  @Volatile private var initialized = false

  fun addListener(owner: Any, listener: (String, Map<String, Any?>) -> Unit) { listeners[owner] = listener }
  fun removeListener(owner: Any) { listeners.remove(owner) }
  fun emit(name: String, value: Map<String, Any?>) { listeners.values.forEach { runCatching { it(name, value) } } }

  fun begin(
    context: Context, id: String, kind: String, workingDirectory: String,
    sourceUri: String? = null, chatName: String? = null, archiveFingerprint: String? = null,
    totalFiles: Int? = null, totalBytes: Long? = null
  ): NativeOperation = synchronized(guard) {
    initialize(context)
    if (!Regex("[A-Za-z0-9._-]{1,120}").matches(id) || id == "." || id == "..") {
      throw OperationFailure("IO_ERROR", "Invalid operation identifier.")
    }
    if (operations.values.any { !it.progress.terminal }) {
      throw OperationFailure("IO_ERROR", "Another operation is still running.")
    }
    if (kind == "save" && hasRetainedSave()) {
      throw OperationFailure("IO_ERROR", "Store the previous save result before starting another save.")
    }
    val operation = NativeOperation(id, kind, workingDirectory, sourceUri, chatName, archiveFingerprint, totalFiles, totalBytes)
    if (!hasRetainedSave()) {
      val initial = operation.snapshot()
      persist(context, initial)
      latestStored = initial
    }
    operations[id] = operation
    latestId = id
    if (cancelledBeforeStart.remove(id)) {
      operation.cancelled.set(true)
      val failure = OperationFailure("CANCELLED", "The operation was cancelled before it started.")
      finish(context, operation, "cancelled", error = failure)
      throw failure
    }
    operation.advance(operation.progress, true)
    operation
  }

  fun find(id: String): NativeOperation? = operations[id]

  fun finish(
    context: Context, operation: NativeOperation, phase: String,
    result: Map<String, Any?>? = null, error: OperationFailure? = null
  ) = synchronized(guard) {
    operation.progress = operation.progress.copy(phase = phase, currentFileName = null)
    var finalError = error
    var value = operation.snapshot(result, finalError)
    if (operation.kind == "save" || (latestId == operation.id && !hasRetainedSave())) {
      try { persist(context, value) } catch (failure: Exception) {
        finalError = failureFor(failure)
        operation.progress = operation.progress.copy(phase = "failed")
        value = operation.snapshot(result, finalError)
      }
      latestStored = value
    }
    operation.advance(operation.progress, true)
    if (!operation.completion.isCompleted) {
      if (result != null) operation.completion.complete(result)
      else if (finalError != null) operation.completion.completeExceptionally(finalError)
      else operation.completion.complete(emptyMap())
    }
    operations.entries.removeAll { it.key != latestId && it.value.progress.terminal && it.value.kind != "save" }
  }

  fun snapshot(context: Context): Map<String, Any?>? = synchronized(guard) {
    initialize(context)
    val live = latestId?.let(operations::get)
    if (hasRetainedSave()) latestStored
    else if (live != null && !live.progress.terminal) live.snapshot() else latestStored
  }

  fun acknowledge(context: Context, id: String) = synchronized(guard) {
    initialize(context)
    val operation = operations[id]
    if (operation != null && !operation.progress.terminal) return@synchronized
    val storedId = (latestStored?.get("progress") as? Map<*, *>)?.get("operationId")
    if (storedId == id) {
      if (latestId == id) latestId = null
      latestStored = latestId?.let(operations::get)?.snapshot()
      if (latestStored == null) AtomicFile(File(context.filesDir, "chatstamp-operations/latest.json")).delete()
      else persist(context, latestStored!!)
    }
    operations.remove(id)
    SaveForegroundService.removeInput(context, id)
  }

  private fun operationOrRememberCancellation(id: String): NativeOperation? = synchronized(guard) {
    operations[id]?.let { return@synchronized it }
    // The bridge or IO dispatcher may not have started an already-cancelled
    // import yet. Keep the cancellation until begin observes that same ID.
    if (Regex("[A-Za-z0-9._-]{1,120}").matches(id) && id != "." && id != "..") {
      cancelledBeforeStart.add(id)
      if (cancelledBeforeStart.size > 256) cancelledBeforeStart.remove(cancelledBeforeStart.first())
    }
    null
  }

  fun cancel(id: String) { operationOrRememberCancellation(id)?.takeUnless { it.progress.terminal }?.cancel() }
  suspend fun cancelAndAwait(id: String) {
    val operation = operationOrRememberCancellation(id) ?: return
    if (operation.progress.terminal) return
    operation.cancel()
    val worker = operation.worker
    if (worker != null) worker.join()
    else runCatching { operation.completion.await() }
    Unit
  }

  fun activeDirectories(): Set<String> = operations.values.filter { !it.progress.terminal }
    .map { File(Uri.parse(it.workingDirectory).path!!).canonicalPath }.toSet()

  fun releaseImport(context: Context, id: String, directoryUri: String, sourceUri: String) = synchronized(guard) {
    val directory = jobDirectory(context, directoryUri)
    if (operations.values.any { !it.progress.terminal &&
        File(Uri.parse(it.workingDirectory).path!!).canonicalFile == directory }) {
      throw OperationFailure("IO_ERROR", "The operation is still using its working files.")
    }
    ThumbnailManager.get(context).discardJob(directory)
    if (directory.exists() && !directory.deleteRecursively()) throw OperationFailure("IO_ERROR", "Working files could not be removed.")
    SharedZipInbox.release(context, sourceUri)
    operations[id]?.takeIf { it.progress.terminal && it.id != latestId }?.let { operations.remove(id) }
    Unit
  }

  fun releaseSource(context: Context, sourceUri: String) = synchronized(guard) {
    if (operations.values.none { !it.progress.terminal && it.sourceUri == sourceUri }) {
      SharedZipInbox.release(context, sourceUri)
    }
  }

  fun cleanupStaleJobs(context: Context) = synchronized(guard) {
    val active = activeDirectories()
    val root = File(context.cacheDir, "chatstamp").apply { mkdirs() }
    root.listFiles().orEmpty().forEach { file ->
      if (file.canonicalPath !in active) {
        ThumbnailManager.get(context).discardJob(file)
        if (!file.deleteRecursively()) throw OperationFailure("IO_ERROR", "Stale import files could not be removed.")
      }
    }
    ThumbnailManager.get(context).cleanup()
    if (active.isEmpty()) {
      listOf("shared-zips", "DocumentPicker").forEach { name ->
        File(context.cacheDir, name).takeIf(File::exists)?.let {
          if (!it.deleteRecursively()) throw OperationFailure("IO_ERROR", "Stale ZIP copies could not be removed.")
        }
      }
    }
    if (operations.values.none { it.kind == "save" && !it.progress.terminal }) cleanupOrphanPendingRows(context)
  }

  private fun hasRetainedSave(): Boolean {
    val progress = latestStored?.get("progress") as? Map<*, *>
    return progress?.get("kind") == "save" && latestStored?.get("result") != null
  }

  private fun initialize(context: Context) {
    if (initialized) return
    val stored = runCatching {
      val file = AtomicFile(File(context.filesDir, "chatstamp-operations/latest.json"))
      bridgeObject(JSONObject(file.openRead().use { it.readBytes().toString(Charsets.UTF_8) }))
    }.getOrNull()
    if (stored != null) {
      val progress = stored["progress"] as? Map<*, *>
      latestStored = if (progress?.get("phase") !in setOf("completed", "cancelled", "failed")) {
        stored + mapOf("progress" to (progress.orEmpty() + mapOf("phase" to "failed")),
          "error" to mapOf("code" to "IO_ERROR", "message" to "The previous operation was interrupted."))
      } else stored
    }
    initialized = true
  }

  private fun persist(context: Context, value: Map<String, Any?>) {
    val directory = File(context.filesDir, "chatstamp-operations").apply {
      if (!isDirectory && !mkdirs()) throw OperationFailure("IO_ERROR", "Could not create operation state.")
    }
    val file = AtomicFile(File(directory, "latest.json"))
    val stream = file.startWrite()
    try {
      stream.write(JSONObject(value).toString().toByteArray(Charsets.UTF_8))
      file.finishWrite(stream)
    } catch (error: Exception) {
      file.failWrite(stream)
      throw OperationFailure("IO_ERROR", "Could not persist operation state.", cause = error)
    }
  }

  private fun cleanupOrphanPendingRows(context: Context) {
    val collection = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
    val projection = arrayOf(BaseColumns._ID, MediaStore.MediaColumns.RELATIVE_PATH,
      MediaStore.MediaColumns.OWNER_PACKAGE_NAME, MediaStore.MediaColumns.IS_PENDING)
    val args = Bundle().apply {
      putInt(MediaStore.QUERY_ARG_MATCH_PENDING, MediaStore.MATCH_INCLUDE)
      putString(android.content.ContentResolver.QUERY_ARG_SQL_SELECTION,
        "${MediaStore.MediaColumns.OWNER_PACKAGE_NAME}=? AND ${MediaStore.MediaColumns.IS_PENDING}=?")
      putStringArray(android.content.ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS, arrayOf(context.packageName, "1"))
    }
    context.contentResolver.query(collection, projection, args, null)?.use { cursor ->
      val abandoned = mutableListOf<Uri>()
      while (cursor.moveToNext()) {
        val path = cursor.getString(1).orEmpty()
        if (cursor.getString(2) == context.packageName && cursor.getInt(3) == 1 &&
          listOf("Pictures", "Music", "Documents", "Download").any { path.startsWith("$it/chatStamp/") }) {
          abandoned.add(android.content.ContentUris.withAppendedId(collection, cursor.getLong(0)))
        }
      }
      abandoned.forEach { uri ->
        if (context.contentResolver.delete(uri, null, null) != 1) {
          throw OperationFailure("IO_ERROR", "An interrupted pending media row could not be removed.")
        }
      }
    }
  }
}

internal fun jobDirectory(context: Context, uriString: String): File {
  val uri = Uri.parse(uriString)
  val root = File(context.cacheDir, "chatstamp").canonicalFile
  val file = uri.path?.let(::File)?.canonicalFile
  if (uri.scheme != "file" || file == null || file.parentFile != root) {
    throw OperationFailure("IO_ERROR", "The working directory is outside the app's import cache.")
  }
  return file
}

internal fun bridgeObject(json: JSONObject): Map<String, Any?> = json.keys().asSequence().associateWith { key -> bridgeValue(json.get(key)) }
internal fun bridgeValue(value: Any?): Any? = when (value) {
  JSONObject.NULL -> null
  is JSONObject -> bridgeObject(value)
  is JSONArray -> (0 until value.length()).map { bridgeValue(value.get(it)) }
  else -> value
}
