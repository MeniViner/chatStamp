package com.chatstamp.nativebridge

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

internal class ThumbnailManager(
  context: Context,
  limits: ThumbnailLimits = ThumbnailLimits(),
  private val renderer: ThumbnailRenderer = PlatformThumbnailRenderer(context.applicationContext)
) {
  private val application = context.applicationContext
  private val guard = Any()
  private val access = PreviewFileAccess(application)
  private val queue = ThumbnailWorkQueue<Map<String, Any?>>()
  private val admissions = Semaphore(66)
  private val cache = ThumbnailDiskCache(File(application.cacheDir, "chatstamp-thumbnails"), limits)
  private val invalidatedJobs = linkedSetOf<String>()

  suspend fun get(uri: String, requestedSize: Int): Map<String, Any?> = withContext(Dispatchers.IO) {
    val size = ThumbnailPolicy.normalizedSize(requestedSize)
    if (!admissions.tryAcquire()) return@withContext unavailable("busy")
    try {
      val source = try { access.resolve(uri) }
      catch (error: PreviewAccessException) { return@withContext unavailable(if (error.reason == "invalid-uri") "unsupported" else "unreadable") }
      catch (_: Exception) { return@withContext unavailable("unreadable") }
      if (source.kind == null) return@withContext unavailable("unsupported")
      val key = ThumbnailPolicy.key(source.identity, source.modifiedMillis, source.bytes, size)
      val task = synchronized(guard) {
        if (source.ownerJob in invalidatedJobs) return@withContext unavailable("unreadable")
        queue.enqueue(key, source.ownerJob, source.kind != "image") { render(source, size, key) }
      } ?: return@withContext unavailable("busy")
      try { task.await() }
      catch (error: CancellationException) { throw error }
      catch (_: Exception) { unavailable("decode-failed") }
    } finally { admissions.release() }
  }

  private suspend fun render(source: PreviewSource, size: Int, identityKey: String): Map<String, Any?> {
    currentCoroutineContext().ensureActive()
    val latest = try { access.resolve(source.uri.toString()) } catch (_: Exception) { return unavailable("unreadable") }
    if (latest.identity != source.identity || latest.modifiedMillis != source.modifiedMillis || latest.bytes != source.bytes) {
      return unavailable("unreadable")
    }
    if (source.reusable) synchronized(guard) {
      if (source.ownerJob in invalidatedJobs) return unavailable("unreadable")
      val cached = cache.read(identityKey)
      if (cached != null) {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(cache.file(identityKey).path, bounds)
        if (bounds.outWidth == cached.width && bounds.outHeight == cached.height) return result(identityKey, cached, true)
        cache.remove(identityKey)
      }
    }
    var rendered: RenderedThumbnail? = null
    var opaque: Bitmap? = null
    try {
      currentCoroutineContext().ensureActive()
      val frame = renderer.render(source, size)
      rendered = frame
      currentCoroutineContext().ensureActive()
      if (frame.bitmap.width !in 1..size || frame.bitmap.height !in 1..size) {
        return unavailable("decode-failed")
      }
      val jpeg = opaqueThumbnail(frame.bitmap)
      opaque = jpeg
      val coroutine = currentCoroutineContext()
      return synchronized(guard) {
        coroutine.ensureActive()
        if (source.ownerJob in invalidatedJobs) return@synchronized unavailable("unreadable")
        val current = try { access.resolve(source.uri.toString()) } catch (_: Exception) { return@synchronized unavailable("unreadable") }
        if (current.identity != source.identity || current.modifiedMillis != source.modifiedMillis || current.bytes != source.bytes) {
          return@synchronized unavailable("unreadable")
        }
        val key = if (source.reusable) identityKey else ThumbnailPolicy.key(source.identity + UUID.randomUUID(), null, null, size)
        val record = ThumbnailCacheRecord(jpeg.width, jpeg.height, frame.kind, frame.durationMillis,
          source.ownerJob, source.reusable)
        cache.put(key, record) { jpeg.compress(Bitmap.CompressFormat.JPEG, 80, it) }
        result(key, record, false)
      }
    } catch (error: CancellationException) { throw error }
    catch (_: Exception) { return unavailable("decode-failed") }
    catch (_: OutOfMemoryError) { return unavailable("decode-failed") }
    finally {
      opaque?.let { if (it !== rendered?.bitmap) it.recycle() }
      rendered?.bitmap?.recycle()
    }
  }

  fun discardJob(directory: File) = synchronized(guard) {
    val owner = directory.canonicalPath
    invalidatedJobs.add(owner)
    while (invalidatedJobs.size > 512) invalidatedJobs.remove(invalidatedJobs.first())
    val cancelled = queue.cancelOwner(owner)
    cache.invalidateOwner(owner)
    cancelled
  }

  fun cancelAll() = queue.cancelAll()
  fun cleanup() = cache.cleanup()

  fun invalidate(value: String) {
    val uri = Uri.parse(value)
    if (uri.scheme != "file" || !uri.authority.isNullOrEmpty() || uri.query != null || uri.fragment != null || uri.path == null) {
      throw OperationFailure("IO_ERROR", "The thumbnail URI is invalid.")
    }
    cache.invalidateFile(File(uri.path!!))
  }

  private fun result(key: String, record: ThumbnailCacheRecord, hit: Boolean): Map<String, Any?> = buildMap {
    put("available", true); put("uri", Uri.fromFile(cache.file(key)).toString())
    put("width", record.width); put("height", record.height); put("kind", record.kind)
    put("cacheKey", key); put("cacheHit", hit)
    record.durationMillis?.let { put("durationMillis", it) }
  }

  private fun unavailable(reason: String): Map<String, Any?> = mapOf("available" to false, "reason" to reason)

  companion object {
    @Volatile private var shared: ThumbnailManager? = null
    fun get(context: Context): ThumbnailManager = shared ?: synchronized(this) {
      shared ?: ThumbnailManager(context.applicationContext).also { shared = it }
    }
  }
}
