package com.chatstamp.nativebridge

import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

internal suspend fun awaitMediaRelease() = suspendCancellableCoroutine<Unit> { continuation ->
  // Expo Video posts player.release() to Dispatchers.Main during shared-object cleanup.
  // A later main-queue post completes after those already-posted release callbacks.
  val handler = Handler(Looper.getMainLooper())
  val barrier = Runnable { if (continuation.isActive) continuation.resume(Unit) }
  if (!handler.post(barrier)) continuation.resumeWithException(IllegalStateException("Main queue is unavailable."))
  continuation.invokeOnCancellation { handler.removeCallbacks(barrier) }
}
