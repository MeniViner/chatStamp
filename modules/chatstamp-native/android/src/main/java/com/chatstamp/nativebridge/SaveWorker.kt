package com.chatstamp.nativebridge

import android.content.Context
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.DelicateCoroutinesApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

internal fun saveWorkerIsBusy(worker: Job?, previous: NativeOperation?): Boolean =
  worker?.isCompleted == false && previous?.progress?.terminal == false

internal suspend fun stopSaveIfOwned(
  operationId: String,
  currentOperationId: () -> String?,
  onStop: () -> Unit,
  dispatcher: CoroutineDispatcher = Dispatchers.Main.immediate
) = withContext(dispatcher) {
  if (currentOperationId() == operationId) onStop()
}

@OptIn(DelicateCoroutinesApi::class)
internal fun launchSaveFinalizer(scope: CoroutineScope, action: suspend () -> Unit): Job =
  scope.launch(start = CoroutineStart.ATOMIC) { withContext(NonCancellable) { action() } }

/** Enter cleanup even when cancellation wins before the dispatcher's first turn. */
@OptIn(DelicateCoroutinesApi::class)
internal fun launchFinalizingSaveWorker(
  scope: CoroutineScope,
  work: suspend () -> Unit,
  onFailure: suspend (Throwable) -> Unit,
  onStopped: suspend () -> Unit
): Job = scope.launch(start = CoroutineStart.ATOMIC) {
  try {
    currentCoroutineContext().ensureActive()
    work()
  } catch (error: Throwable) {
    withContext(NonCancellable) { onFailure(error) }
  } finally {
    withContext(NonCancellable) { onStopped() }
  }
}

internal fun launchSaveWorker(
  scope: CoroutineScope,
  context: Context,
  operation: NativeOperation,
  items: List<ScopedSaveItem>,
  settings: ScopedSaveOptions,
  onStopped: suspend () -> Unit,
  save: suspend () -> Map<String, Any?> = { ScopedMediaSaver(context, operation).save(items, settings) }
): Job {
  var result: Map<String, Any?>? = null
  var failure: OperationFailure? = null

  fun interruptedResult(error: OperationFailure): Map<String, Any?> {
    val completed = operation.completedResults()
    val done = completed.mapNotNull { it["entryId"] as? String }.toSet()
    val rest = items.filter { it.entryId !in done }.map { item ->
      bridgeObject(echoDateContext(JSONObject()
        .put("entryId", item.entryId).put("filename", item.filename)
        .put("mediaType", item.mediaType).put("mimeType", item.mimeType)
        .put("outcome", if (error.code == "CANCELLED") "cancelled" else "failed")
        .put("ok", false).put("dateVerification", "unverified")
        .put("failureCode", error.code).put("failureReason", error.message), item))
    }
    return mapOf("mode" to if (settings.treeUri == null) "scoped-media-store" else "saf-custom-folder",
      "results" to completed + rest)
  }

  return launchFinalizingSaveWorker(scope,
    work = {
      operation.checkCancelled()
      result = save()
    },
    onFailure = { error ->
      val classified = failureFor(error, operation.cancelled.get())
      failure = classified
      // The saver has awaited pending-row and scratch cleanup before unwinding.
      result = interruptedResult(classified)
    },
    onStopped = {
      try {
        onStopped()
      } catch (error: Throwable) {
        failure = OperationFailure("IO_ERROR", "The foreground save service could not be stopped.", cause = error)
      }
      val terminalFailure = failure ?: if (result == null) {
        OperationFailure("IO_ERROR", "The save worker did not produce a result.")
      } else null
      val finalResult = result ?: interruptedResult(requireNotNull(terminalFailure))
      // No service cleanup remains after publishing terminal progress/completion.
      NativeOperations.finish(context, operation,
        if (terminalFailure == null) "completed" else if (terminalFailure.code == "CANCELLED") "cancelled" else "failed",
        finalResult, terminalFailure)
    })
}
