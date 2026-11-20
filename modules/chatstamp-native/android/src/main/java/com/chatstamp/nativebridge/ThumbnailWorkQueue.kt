package com.chatstamp.nativebridge

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit

internal class ThumbnailWorkQueue<T>(workers: Int = 2, private val pendingLimit: Int = 64) {
  private val guard = Any()
  private val capacity = workers + pendingLimit
  private val permits = Semaphore(workers)
  private val heavy = Semaphore(1)
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private data class Work<T>(val owner: String?, val task: Deferred<T>)
  private val work = mutableMapOf<String, Work<T>>()

  init { require(workers > 0 && pendingLimit >= 0) }

  fun enqueue(key: String, owner: String?, isHeavy: Boolean, render: suspend () -> T): Deferred<T>? = synchronized(guard) {
    work[key]?.let { return@synchronized it.task }
    if (work.size >= capacity) return@synchronized null
    val task = scope.async(start = CoroutineStart.LAZY) {
      if (isHeavy) heavy.withPermit { permits.withPermit { render() } }
      else permits.withPermit { render() }
    }
    work[key] = Work(owner, task)
    task.invokeOnCompletion { synchronized(guard) { if (work[key]?.task === task) work.remove(key) } }
    task.start()
    task
  }

  fun cancelOwner(owner: String): List<Deferred<T>> = synchronized(guard) {
    work.values.filter { it.owner == owner }.map { it.task }.also { tasks -> tasks.forEach { it.cancel() } }
  }

  fun cancelAll(): List<Deferred<T>> = synchronized(guard) {
    work.values.map { it.task }.also { tasks -> tasks.forEach { it.cancel() } }
  }
}
