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
import kotlinx.coroutines.SupervisorJob
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class SaveForegroundService : Service() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private var running: Job? = null
  @Volatile private var operationId: String? = null
  private var stoppedOperationId: String? = null
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

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = startSaveCommand(intent, startId)

  private fun startSaveCommand(intent: Intent?, startId: Int): Int {
    val id = intent?.getStringExtra(idExtra) ?: run { stopSelf(startId); return START_NOT_STICKY }
    if (intent.action == cancelAction) {
      if (operationId == null) {
        NativeOperations.cancel(id)
        stopSelf(startId)
      } else cancelAndStop(id)
      return START_NOT_STICKY
    }
    val previous = operationId?.let(NativeOperations::find)
    if (saveWorkerIsBusy(running, previous)) return START_NOT_STICKY
    operationId = id
    stoppedOperationId = null
    try {
      val (items, settings) = readInput(this, id)
      options = settings
      val operation = NativeOperations.find(id) ?: throw OperationFailure("IO_ERROR", "The save operation is unavailable.")
      if (operation.progress.terminal) {
        launchSaveFinalizer(scope) { stopIfOwned(id) }
        return START_NOT_STICKY
      }
      val manager = getSystemService(NotificationManager::class.java)
      manager.createNotificationChannel(NotificationChannel(channelId, settings.notificationTitle, NotificationManager.IMPORTANCE_LOW))
      ServiceCompat.startForeground(this, notificationId, notification(operation, settings), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
      val work = launchSaveWorker(scope, applicationContext, operation, items, settings,
        onStopped = { stopIfOwned(id) })
      running = work
      operation.worker = work
    } catch (error: Throwable) {
      val operation = NativeOperations.find(id)
      val work = launchSaveFinalizer(scope) {
        var failure = failureFor(error)
        try { stopIfOwned(id) } catch (stopping: Throwable) {
          failure = OperationFailure("IO_ERROR", "The foreground save service could not be stopped.", cause = stopping)
        }
        operation?.let { NativeOperations.finish(applicationContext, it, "failed", error = failure) }
      }
      running = work
      operation?.worker = work
    }
    return START_NOT_STICKY
  }

  override fun onTimeout(startId: Int, fgsType: Int) {
    // Cancellation closes the current streams; the worker stops the service after awaited cleanup.
    val id = operationId
    if (id == null) {
      try { ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE) }
      finally { stopSelf(startId) }
      return
    }
    cancelAndStop(id)
  }

  private fun cancelAndStop(id: String) {
    val worker = if (operationId == id) running else null
    NativeOperations.cancel(id)
    launchSaveFinalizer(scope) {
      NativeOperations.cancelAndAwait(id)
      worker?.join()
      stopIfOwned(id)
    }
  }

  private suspend fun stopIfOwned(id: String) = stopSaveIfOwned(id,
    currentOperationId = { operationId.takeUnless { stoppedOperationId == it } },
    onStop = {
      try { ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE) }
      finally {
        try { stopSelf() } finally { stoppedOperationId = id }
      }
    })

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
      val json = encodeInput(items, options)
      val file = AtomicFile(inputFile(context, options.operationId))
      val stream = file.startWrite()
      try {
        stream.write(json.toString().toByteArray(Charsets.UTF_8))
        file.finishWrite(stream)
      } catch (error: Exception) { file.failWrite(stream); throw error }
    }

    internal fun encodeInput(items: List<ScopedSaveItem>, options: ScopedSaveOptions): JSONObject =
      JSONObject().put("items", JSONArray(items.map { item ->
        JSONObject().put("entryId", item.entryId).put("sourceUri", item.sourceUri).put("filename", item.filename)
          .put("mediaType", item.mediaType).put("mimeType", item.mimeType).put("timestampMillis", item.timestampMillis)
          .put("dateSource", item.dateSource).put("timeZone", item.timeZone).put("relativeFolder", item.relativeFolder)
          .put("whatsAppDateIso", item.whatsAppDateIso).put("dateAmbiguous", item.dateAmbiguous).put("senderName", item.senderName)
      })).put("options", JSONObject().put("archiveFingerprint", options.archiveFingerprint).put("chatName", options.chatName)
        .put("treeUri", options.treeUri).put("duplicateHandling", options.duplicateHandling)
        .put("timestampFolder", options.timestampFolder).put("organizationMode", options.organizationMode)
        .put("alwaysUseMessageDate", options.alwaysUseMessageDate).put("operationId", options.operationId)
        .put("workingDirectory", options.workingDirectory).put("notificationTitle", options.notificationTitle)
        .put("notificationCancelLabel", options.notificationCancelLabel).put("sourceUri", options.sourceUri)
        .put("folderLabels", options.folderLabels?.toJson()).put("chatFolderName", options.chatFolderName))

    private fun readInput(context: Context, id: String): Pair<List<ScopedSaveItem>, ScopedSaveOptions> {
      val json = JSONObject(AtomicFile(inputFile(context, id)).openRead().use { it.readBytes().toString(Charsets.UTF_8) })
      return decodeInput(json)
    }

    internal fun decodeInput(json: JSONObject): Pair<List<ScopedSaveItem>, ScopedSaveOptions> {
      val array = json.getJSONArray("items")
      val items = (0 until array.length()).map { index ->
        val item = array.getJSONObject(index)
        ScopedSaveItem(item.getString("entryId"), item.getString("sourceUri"), item.getString("filename"),
          item.getString("mediaType"), item.getString("mimeType"), item.nullableDouble("timestampMillis"),
          item.optString("dateSource", "none"), item.nullableString("timeZone"), item.nullableString("relativeFolder"),
          item.nullableString("whatsAppDateIso"), item.optBoolean("dateAmbiguous", false), item.nullableString("senderName"))
      }
      val value = json.getJSONObject("options")
      val options = ScopedSaveOptions(value.getString("archiveFingerprint"), value.getString("chatName"),
        value.nullableString("treeUri"), value.getString("duplicateHandling"), value.getBoolean("timestampFolder"),
        value.getString("organizationMode"), value.getBoolean("alwaysUseMessageDate"), value.getString("operationId"),
        value.getString("workingDirectory"), value.getString("notificationTitle"), value.getString("notificationCancelLabel"), value.nullableString("sourceUri"),
        value.optJSONObject("folderLabels")?.let { OutputFolderLabels.fromJson(it) }, value.nullableString("chatFolderName"))
      return items to options
    }
  }
}

private fun JSONObject.nullableString(key: String): String? = if (isNull(key)) null else getString(key)
private fun JSONObject.nullableDouble(key: String): Double? = if (isNull(key)) null else getDouble(key)
