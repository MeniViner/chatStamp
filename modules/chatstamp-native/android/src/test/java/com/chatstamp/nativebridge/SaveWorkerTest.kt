package com.chatstamp.nativebridge

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.util.ArrayDeque
import kotlin.coroutines.CoroutineContext

class SaveWorkerTest {
  /** Dispatch never executes automatically, making the publication window exact. */
  private class PausedDispatcher : CoroutineDispatcher() {
    private val pending = ArrayDeque<Runnable>()
    override fun dispatch(context: CoroutineContext, block: Runnable) {
      synchronized(pending) { pending.addLast(block) }
    }
    fun drain() {
      var steps = 0
      while (true) {
        val next = synchronized(pending) { pending.pollFirst() } ?: return
        check(++steps <= 1000) { "Worker did not quiesce" }
        next.run()
      }
    }
  }

  private class Harness {
    val dispatcher = PausedDispatcher()
    val uncaught = mutableListOf<Throwable>()
    val scope = CoroutineScope(SupervisorJob() + dispatcher + CoroutineExceptionHandler { _, error -> uncaught.add(error) })
    fun close() { scope.cancel(); dispatcher.drain() }
  }

  @Test fun defaultStartControlReallySkipsTheBodyAndFinallyWhenCancelledBeforeDispatch() {
    val h = Harness()
    var entered = false
    var stopped = false
    try {
      val work = h.scope.launch {
        try { entered = true } finally { stopped = true }
      }
      work.cancel()
      h.dispatcher.drain()
      assertTrue(work.isCompleted)
      assertTrue(work.isCancelled)
      assertFalse(entered)
      assertFalse("This control proves the original DEFAULT-start failure window", stopped)
    } finally { h.close() }
  }

  @Test fun cancellingPublishedWorkerBeforeDispatchStillAwaitsFailureAndStopFinalization() {
    val h = Harness()
    val operation = NativeOperation("prestart-worker", "save", "file:///cache/chatstamp/prestart-worker/")
    val stopGate = CompletableDeferred<Unit>()
    val finalized = CompletableDeferred<Unit>()
    val failures = mutableListOf<Throwable>()
    var workCalls = 0
    var stopEntered = false
    try {
      val worker = launchFinalizingSaveWorker(h.scope,
        work = { workCalls++ },
        onFailure = { failures.add(it) },
        onStopped = { stopEntered = true; stopGate.await(); finalized.complete(Unit) })
      operation.worker = worker
      operation.cancel()
      assertEquals(0, workCalls)
      h.dispatcher.drain()
      assertEquals(0, workCalls)
      assertEquals(1, failures.size)
      assertTrue(failures.single() is CancellationException)
      assertTrue(stopEntered)
      assertFalse(finalized.isCompleted)
      assertFalse("Awaiting stop must survive worker cancellation", worker.isCompleted)
      stopGate.complete(Unit)
      h.dispatcher.drain()
      assertTrue(finalized.isCompleted)
      assertTrue(worker.isCompleted)
      assertTrue(h.uncaught.isEmpty())
    } finally { stopGate.complete(Unit); h.close() }
  }

  @Test fun normalWorkRunsOnceThenStopsWithoutAFalseFailure() {
    val h = Harness()
    val events = mutableListOf<String>()
    try {
      val worker = launchFinalizingSaveWorker(h.scope,
        work = { events.add("work") }, onFailure = { events.add("failure") }, onStopped = { events.add("stop") })
      assertTrue(events.isEmpty())
      h.dispatcher.drain()
      assertEquals(listOf("work", "stop"), events)
      assertTrue(worker.isCompleted)
      assertFalse(worker.isCancelled)
      assertTrue(h.uncaught.isEmpty())
    } finally { h.close() }
  }

  @Test fun inFlightCancellationDoesNotResumeWorkButStillAwaitsStop() {
    val h = Harness()
    val input = CompletableDeferred<Unit>()
    val stop = CompletableDeferred<Unit>()
    var entered = false
    var continued = false
    var stopping = false
    val failures = mutableListOf<Throwable>()
    try {
      val worker = launchFinalizingSaveWorker(h.scope,
        work = { entered = true; input.await(); continued = true },
        onFailure = { failures.add(it) }, onStopped = { stopping = true; stop.await() })
      h.dispatcher.drain()
      assertTrue(entered)
      worker.cancel()
      h.dispatcher.drain()
      assertFalse(continued)
      assertEquals(1, failures.size)
      assertTrue(failures.single() is CancellationException)
      assertTrue(stopping)
      assertFalse(worker.isCompleted)
      stop.complete(Unit)
      h.dispatcher.drain()
      assertTrue(worker.isCompleted)
      assertTrue(h.uncaught.isEmpty())
    } finally { input.complete(Unit); stop.complete(Unit); h.close() }
  }

  @Test fun genuineWorkFailureKeepsItsCauseAndStillStops() {
    val h = Harness()
    val diskFailure = IOException("Synthetic output failure")
    var observed: Throwable? = null
    var stopped = false
    try {
      val worker = launchFinalizingSaveWorker(h.scope,
        work = { throw diskFailure }, onFailure = { observed = it }, onStopped = { stopped = true })
      h.dispatcher.drain()
      assertSame(diskFailure, observed)
      assertTrue(stopped)
      assertTrue(worker.isCompleted)
      assertTrue(h.uncaught.isEmpty())
    } finally { h.close() }
  }

  @Test fun cancelledParentCannotInterruptAwaitedFailureCleanupOrStopCallback() {
    val h = Harness()
    val failureCleanup = CompletableDeferred<Unit>()
    val stop = CompletableDeferred<Unit>()
    val events = mutableListOf<String>()
    try {
      val worker = launchFinalizingSaveWorker(h.scope, work = { error("Cancelled work must not run") },
        onFailure = { events.add("failure"); failureCleanup.await(); events.add("cleaned") },
        onStopped = { events.add("stop"); stop.await(); events.add("stopped") })
      worker.cancel()
      h.dispatcher.drain()
      assertEquals(listOf("failure"), events)
      h.scope.cancel()
      failureCleanup.complete(Unit)
      h.dispatcher.drain()
      assertEquals(listOf("failure", "cleaned", "stop"), events)
      assertFalse(worker.isCompleted)
      stop.complete(Unit)
      h.dispatcher.drain()
      assertEquals(listOf("failure", "cleaned", "stop", "stopped"), events)
      assertTrue(worker.isCompleted)
      assertTrue(h.uncaught.isEmpty())
    } finally { failureCleanup.complete(Unit); stop.complete(Unit); h.close() }
  }

  @Test fun parentAlreadyCancelledBeforeLaunchStillRunsFinalizationWithoutWork() {
    val h = Harness()
    var workCalls = 0
    var failure: Throwable? = null
    var stopped = false
    try {
      h.scope.cancel()
      val worker = launchFinalizingSaveWorker(h.scope, work = { workCalls++ },
        onFailure = { failure = it }, onStopped = { stopped = true })
      h.dispatcher.drain()
      assertEquals(0, workCalls)
      assertTrue(failure is CancellationException)
      assertTrue(stopped)
      assertTrue(worker.isCompleted)
      assertTrue(h.uncaught.isEmpty())
    } finally { h.close() }
  }

  @Test fun anUnfinishedWorkerWithARegisteredNonterminalOwnerRemainsBusy() {
    val operation = NativeOperation("active-owner", "save", "file:///cache/chatstamp/active-owner/")
    val worker = Job()
    try { assertTrue(saveWorkerIsBusy(worker, operation)) }
    finally { worker.cancel() }
  }

  @Test fun terminalOrAcknowledgedOwnerCannotBlockANewSaveDuringOldJobBookkeeping() {
    val operation = NativeOperation("old-owner", "save", "file:///cache/chatstamp/old-owner/")
    val oldWorker = Job()
    try {
      operation.progress = operation.progress.copy(phase = "completed")
      assertFalse(oldWorker.isCompleted)
      assertFalse(saveWorkerIsBusy(oldWorker, operation))
      assertFalse("Acknowledgement removes the prior registry entry", saveWorkerIsBusy(oldWorker, null))
    } finally { oldWorker.cancel() }
  }

  @Test fun cancelledButUnfinishedCleanupStillBlocksReplacementWhileItsOwnerIsNonterminal() {
    val h = Harness()
    val operation = NativeOperation("cleaning-owner", "save", "file:///cache/chatstamp/cleaning-owner/")
    val stop = CompletableDeferred<Unit>()
    try {
      val worker = launchFinalizingSaveWorker(h.scope, work = {}, onFailure = {}, onStopped = { stop.await() })
      operation.worker = worker
      operation.cancel()
      h.dispatcher.drain()
      assertTrue(worker.isCancelled)
      assertFalse(worker.isCompleted)
      assertTrue(saveWorkerIsBusy(worker, operation))
      stop.complete(Unit)
      h.dispatcher.drain()
      assertFalse(saveWorkerIsBusy(worker, operation))
    } finally { stop.complete(Unit); h.close() }
  }

  @Test fun delayedStopChecksOwnershipOnTheMainTurnInsteadOfBeforeDispatch() {
    val main = PausedDispatcher()
    val caller = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
    var owner = "A"
    var stopped = 0
    try {
      val stop = caller.launch {
        stopSaveIfOwned("A", currentOperationId = { owner }, onStop = { stopped++ }, dispatcher = main)
      }
      assertFalse(stop.isCompleted)
      owner = "B"
      main.drain()
      assertTrue(stop.isCompleted)
      assertEquals("B", owner)
      assertEquals("Old A must not stop the new owner B", 0, stopped)
    } finally { caller.cancel(); main.drain() }
  }

  @Test fun ownedStopIsAwaitedAndItsFailureIsNotSwallowedBeforeWorkerFinalization() {
    val main = PausedDispatcher()
    val caller = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
    val failure = IOException("Synthetic foreground stop failure")
    var observed: Throwable? = null
    var stopCalls = 0
    try {
      val stop = caller.launch {
        try {
          stopSaveIfOwned("A", currentOperationId = { "A" }, onStop = { stopCalls++; throw failure }, dispatcher = main)
        } catch (error: Throwable) { observed = error }
      }
      assertEquals(0, stopCalls)
      assertFalse(stop.isCompleted)
      main.drain()
      assertTrue(stop.isCompleted)
      assertEquals(1, stopCalls)
      assertTrue(observed is IOException)
      assertEquals(failure.message, observed?.message)
      // Coroutine stack-trace recovery may copy the exception across dispatch;
      // the original failure must remain reachable rather than be swallowed.
      assertTrue(generateSequence(observed) { it.cause }.any { it === failure })
    } finally { caller.cancel(); main.drain() }
  }

  @Test fun startupFinalizerSurvivesAnAlreadyCancelledScopeAndAwaitsItsAction() {
    val h = Harness()
    val cleanup = CompletableDeferred<Unit>()
    var entered = false
    var finished = false
    try {
      h.scope.cancel()
      val finalizer = launchSaveFinalizer(h.scope) { entered = true; cleanup.await(); finished = true }
      h.dispatcher.drain()
      assertTrue(entered)
      assertFalse(finished)
      assertFalse(finalizer.isCompleted)
      cleanup.complete(Unit)
      h.dispatcher.drain()
      assertTrue(finished)
      assertTrue(finalizer.isCompleted)
      assertTrue(h.uncaught.isEmpty())
    } finally { cleanup.complete(Unit); h.close() }
  }
}
