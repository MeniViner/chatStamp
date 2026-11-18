package com.chatstamp.nativebridge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import android.util.AtomicFile
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class SaveForegroundService : Service() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private var running: Job? = null
  private var operationId: String? = null
  private var options: ScopedSaveOptions? = null

  override fun onCreate() {
    super.onCreate()
    NativeOperations.addListener(this) { event, _ ->
      if (event == "onSaveProgress") {
        val state = operationId?.let(NativeOperations::find)
        val settings = options
        if (state != null && settings != null && !state.progress.terminal) {
          runCatching { getSystemService(NotificationManager::class.java).notify(notificationId, notification(state, settings)) }
        }
      }
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val id = intent?.getStringExtra(idExtra) ?: run { stopSelf(startId); return START_NOT_STICKY }
    if (intent.action == cancelAction) {
      scope.launch {
        NativeOperations.cancelAndAwait(id)
        ServiceCompat.stopForeground(this@SaveForegroundService, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf(startId)
      }
      return START_NOT_STICKY
    }
    if (running?.isActive == true) return START_NOT_STICKY
    operationId = id
    try {
      val (items, settings) = readInput(this, id)
      options = settings
      val operation = NativeOperations.find(id) ?: throw OperationFailure("IO_ERROR", "The save operation is unavailable.")
      val manager = getSystemService(NotificationManager::class.java)
      manager.createNotificationChannel(NotificationChannel(channelId, settings.notificationTitle, NotificationManager.IMPORTANCE_LOW))
      ServiceCompat.startForeground(this, notificationId, notification(operation, settings), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
      val work = scope.launch {
        try {
          operation.checkCancelled()
          val result = ScopedMediaSaver(applicationContext, operation).save(items, settings)
          withContext(NonCancellable) { NativeOperations.finish(applicationContext, operation, "completed", result) }
        } catch (error: Throwable) {
          val failure = failureFor(error, operation.cancelled.get())
          withContext(NonCancellable) {
            // The saver finishes non-cancellable pending-row and scratch cleanup before unwinding here.
            val completed = operation.completedResults()
            val done = completed.mapNotNull { it["entryId"] as? String }.toSet()
            val rest = items.filter { it.entryId !in done }.map { item ->
              bridgeObject(echoDateContext(JSONObject()
                .put("entryId", item.entryId).put("filename", item.filename)
                .put("mediaType", item.mediaType).put("mimeType", item.mimeType)
                .put("outcome", if (failure.code == "CANCELLED") "cancelled" else "failed")
                .put("ok", false).put("dateVerification", "unverified")
                .put("failureCode", failure.code).put("failureReason", failure.message), item))
            }
            val result = mapOf("mode" to if (settings.treeUri == null) "scoped-media-store" else "saf-custom-folder",
              "results" to completed + rest)
            NativeOperations.finish(applicationContext, operation,
              if (failure.code == "CANCELLED") "cancelled" else "failed", result, failure)
          }
        } finally {
          withContext(NonCancellable) {
            ServiceCompat.stopForeground(this@SaveForegroundService, ServiceCompat.STOP_FOREGROUND_REMOVE)
            stopSelf(startId)
          }
        }
      }
      running = work
      operation.worker = work
    } catch (error: Throwable) {
      val failure = failureFor(error)
      NativeOperations.find(id)?.let { NativeOperations.finish(this, it, "failed", error = failure) }
      ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
      stopSelf(startId)
    }
    return START_NOT_STICKY
  }

  override fun onTimeout(startId: Int, fgsType: Int) {
    // Cancellation closes the current streams; the worker stops the service after awaited cleanup.
    val id = operationId
    if (id == null || running?.isActive != true) {
      ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
      stopSelf(startId)
      return
    }
    scope.launch {
      NativeOperations.cancelAndAwait(id)
      ServiceCompat.stopForeground(this@SaveForegroundService, ServiceCompat.STOP_FOREGROUND_REMOVE)
      stopSelf(startId)
    }
  }

  override fun onDestroy() {
    operationId?.let { NativeOperations.cancel(it) }
    NativeOperations.removeListener(this)
    scope.coroutineContext[Job]?.cancel()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun notification(operation: NativeOperation, settings: ScopedSaveOptions): Notification {
    val progress = operation.progress
    val cancel = PendingIntent.getService(this, 0, Intent(this, SaveForegroundService::class.java)
      .setAction(cancelAction).putExtra(idExtra, operation.id), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val launch = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(this, 1, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    val count = "${progress.filesDone} / ${progress.totalFiles ?: "—"}"
    val text = progress.currentFileName?.let { "$count · $it" } ?: count
    return NotificationCompat.Builder(this, channelId)
      .setSmallIcon(android.R.drawable.stat_sys_download)
      .setContentTitle(settings.notificationTitle).setContentText(text)
      .setContentIntent(launch).setOnlyAlertOnce(true).setOngoing(true)
      .setCategory(NotificationCompat.CATEGORY_PROGRESS).setPriority(NotificationCompat.PRIORITY_LOW)
      .setProgress(progress.totalFiles ?: 0, progress.filesDone, progress.totalFiles == null)
      .addAction(android.R.drawable.ic_menu_close_clear_cancel, settings.notificationCancelLabel, cancel).build()
  }

  companion object {
    private const val notificationId = 18420
    private const val channelId = "chatstamp-save"
    private const val idExtra = "operationId"
    private const val cancelAction = "com.chatstamp.nativebridge.CANCEL_SAVE"

    suspend fun start(context: Context, items: List<ScopedSaveItem>, options: ScopedSaveOptions): Map<String, Any?> {
      val existing = NativeOperations.find(options.operationId)
      if (existing != null && existing.kind == "save" && !existing.progress.terminal) return existing.completion.await()
      jobDirectory(context, options.workingDirectory)
      val operation = NativeOperations.begin(context, options.operationId, "save", options.workingDirectory,
        sourceUri = options.sourceUri, chatName = options.chatName, archiveFingerprint = options.archiveFingerprint, totalFiles = items.size)
      try {
        writeInput(context, items, options)
        context.startForegroundService(Intent(context, SaveForegroundService::class.java).putExtra(idExtra, options.operationId))
      } catch (error: Throwable) {
        val failure = failureFor(error)
        NativeOperations.finish(context, operation, "failed", error = failure)
        throw failure
      }
      return operation.completion.await()
    }

    fun removeInput(context: Context, id: String) { inputFile(context, id).delete() }

    private fun inputFile(context: Context, id: String): File {
      if (!Regex("[A-Za-z0-9._-]{1,120}").matches(id) || id == "." || id == "..") {
        throw OperationFailure("IO_ERROR", "Invalid operation identifier.")
      }
      return File(context.filesDir, "chatstamp-operations/input-$id.json")
    }

    private fun writeInput(context: Context, items: List<ScopedSaveItem>, options: ScopedSaveOptions) {
      val json = JSONObject().put("items", JSONArray(items.map { item ->
        JSONObject().put("entryId", item.entryId).put("sourceUri", item.sourceUri).put("filename", item.filename)
          .put("mediaType", item.mediaType).put("mimeType", item.mimeType).put("timestampMillis", item.timestampMillis)
          .put("dateSource", item.dateSource).put("timeZone", item.timeZone).put("relativeFolder", item.relativeFolder)
          .put("whatsAppDateIso", item.whatsAppDateIso).put("dateAmbiguous", item.dateAmbiguous)
      })).put("options", JSONObject().put("archiveFingerprint", options.archiveFingerprint).put("chatName", options.chatName)
        .put("treeUri", options.treeUri).put("duplicateHandling", options.duplicateHandling)
        .put("timestampFolder", options.timestampFolder).put("organizationMode", options.organizationMode)
        .put("alwaysUseMessageDate", options.alwaysUseMessageDate).put("operationId", options.operationId)
        .put("workingDirectory", options.workingDirectory).put("notificationTitle", options.notificationTitle)
        .put("notificationCancelLabel", options.notificationCancelLabel).put("sourceUri", options.sourceUri))
      val file = AtomicFile(inputFile(context, options.operationId))
      val stream = file.startWrite()
      try {
        stream.write(json.toString().toByteArray(Charsets.UTF_8))
        file.finishWrite(stream)
      } catch (error: Exception) { file.failWrite(stream); throw error }
    }

    private fun readInput(context: Context, id: String): Pair<List<ScopedSaveItem>, ScopedSaveOptions> {
      val json = JSONObject(AtomicFile(inputFile(context, id)).openRead().use { it.readBytes().toString(Charsets.UTF_8) })
      val array = json.getJSONArray("items")
      val items = (0 until array.length()).map { index ->
        val item = array.getJSONObject(index)
        ScopedSaveItem(item.getString("entryId"), item.getString("sourceUri"), item.getString("filename"),
          item.getString("mediaType"), item.getString("mimeType"), item.nullableDouble("timestampMillis"),
          item.optString("dateSource", "none"), item.nullableString("timeZone"), item.nullableString("relativeFolder"),
          item.nullableString("whatsAppDateIso"), item.optBoolean("dateAmbiguous", false))
      }
      val value = json.getJSONObject("options")
      val options = ScopedSaveOptions(value.getString("archiveFingerprint"), value.getString("chatName"),
        value.nullableString("treeUri"), value.getString("duplicateHandling"), value.getBoolean("timestampFolder"),
        value.getString("organizationMode"), value.getBoolean("alwaysUseMessageDate"), value.getString("operationId"),
        value.getString("workingDirectory"), value.getString("notificationTitle"), value.getString("notificationCancelLabel"), value.nullableString("sourceUri"))
      return items to options
    }
  }
}

private fun JSONObject.nullableString(key: String): String? = if (isNull(key)) null else getString(key)
private fun JSONObject.nullableDouble(key: String): Double? = if (isNull(key)) null else getDouble(key)
