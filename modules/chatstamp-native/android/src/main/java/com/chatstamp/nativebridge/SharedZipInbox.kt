package com.chatstamp.nativebridge

import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.IntentCompat
import java.util.ArrayDeque
import java.util.UUID

internal data class SharedExportBatch(val sources: List<Uri>, val mimeType: String?, val title: String?)

/** One receipt owns all files in one Android share, including while JS prompts. */
internal object SharedZipInbox {
  private const val RECEIPT_EXTRA = "com.menis10tec.chatstamp.OWNED_SHARE_RECEIPT"
  private const val MAX_SOURCES = 20_000
  private const val MAX_LEASES = 16
  private val guard = Any()
  private val grantGuard = Any()
  private val pending = ArrayDeque<Map<String, Any?>>()
  private val leases = mutableMapOf<String, Lease>()
  private val seenReceipts = linkedSetOf<String>()
  private val persistedByUs = mutableSetOf<String>()
  private var launchRead = false
  private var lastDelivery: Map<String, Any?> = emptyMap()

  private data class Lease(val batch: SharedExportBatch, val context: Context, val persistable: Boolean)

  fun captureLaunch(context: Context, intent: Intent?) = synchronized(guard) {
    if (intent == null) return@synchronized
    launchRead = true
    capture(context.applicationContext, intent)
  }

  fun captureNew(context: Context, intent: Intent) = captureLaunch(context, intent)

  fun notifySubscribers() = synchronized(guard) {
    pending.peekFirst()?.let { NativeOperations.emit("onSharedZip", mapOf("received" to true, "id" to it["id"])) }
  }

  fun consume(): Map<String, Any?> {
    val delivery = synchronized(guard) { pending.pollFirst() } ?: return mapOf("received" to false)
    val handle = delivery["sourceUri"] as? String ?: return delivery
    val lease = synchronized(guard) { leases[handle] } ?: return delivery + ("errorCode" to "PERMISSION_LOST")
    return try {
      retainGrants(handle, lease)
      // Provider metadata is read only after cancellable import ownership starts.
      val named = lease.batch.title ?: lease.batch.sources.singleOrNull()?.lastPathSegment?.substringAfterLast('/')
      if (named.isNullOrBlank()) delivery else delivery + ("filename" to named.take(240))
    } catch (error: OperationFailure) { delivery + ("errorCode" to error.code) }
    catch (_: SecurityException) { delivery + ("errorCode" to "PERMISSION_LOST") }
    catch (_: Exception) { delivery + ("errorCode" to "IO_ERROR") }
  }

  fun resolve(sourceUri: String): SharedExportBatch? = synchronized(guard) { leases[sourceUri]?.batch }

  fun debug(): Map<String, Any?> = synchronized(guard) {
    mapOf("launchIntentRead" to launchRead, "pendingCount" to pending.size, "leaseCount" to leases.size,
      "lastDelivery" to lastDelivery)
  }

  fun release(context: Context, sourceUri: String) {
    // Grant state and platform mutations are serialized separately from capture.
    // A newly captured receipt can queue immediately; its claim waits for an
    // in-flight revocation and then observes/reacquires the current permission.
    synchronized(grantGuard) {
      val releaseUris = synchronized(guard) {
        if (pending.any { it["sourceUri"] == sourceUri }) return
        val released = leases.remove(sourceUri) ?: return
        released.batch.sources.map(Uri::toString).filter { uri ->
          leases.values.none { other -> other.batch.sources.any { it.toString() == uri } } && persistedByUs.remove(uri)
        }
      }
      releaseUris.forEach { uri ->
        runCatching { context.contentResolver.releasePersistableUriPermission(Uri.parse(uri), Intent.FLAG_GRANT_READ_URI_PERMISSION) }
      }
    }
  }

  private fun retainGrants(handle: String, lease: Lease) {
    synchronized(grantGuard) {
      if (synchronized(guard) { !leases.containsKey(handle) }) throw OperationFailure("PERMISSION_LOST", "The share was released.")
      if (!lease.persistable) return
      val resolver = lease.context.contentResolver
      val existing = resolver.persistedUriPermissions.filter { it.isReadPermission }.map { it.uri.toString() }.toSet()
      lease.batch.sources.filter { it.scheme == ContentResolver.SCHEME_CONTENT && it.toString() !in existing }.forEach { uri ->
        // Temporary-only grants remain valid even when persistable access is refused.
        val acquired = runCatching { resolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }.isSuccess
        if (acquired) {
          val retained = synchronized(guard) {
            if (leases.containsKey(handle)) { persistedByUs.add(uri.toString()); true } else false
          }
          if (!retained) runCatching { resolver.releasePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
        }
      }
    }
  }

  private fun capture(context: Context, intent: Intent) {
    val action = intent.action
    if (action !in setOf(Intent.ACTION_SEND, Intent.ACTION_SEND_MULTIPLE, Intent.ACTION_VIEW)) return
    if (action == Intent.ACTION_VIEW && intent.data?.scheme !in setOf("content", "file")) return
    val priorReceipt = runCatching { intent.getStringExtra(RECEIPT_EXTRA) }.getOrNull()
    if (priorReceipt != null && priorReceipt in seenReceipts) return
    val receipt = UUID.randomUUID().toString()
    seenReceipts.add(receipt)
    if (seenReceipts.size > 256) seenReceipts.remove(seenReceipts.first())
    var count = 0
    try {
      intent.putExtra(RECEIPT_EXTRA, receipt)
      val sources = if (action == Intent.ACTION_VIEW) listOfNotNull(intent.data) else sharedUris(intent)
      count = sources.size
      if (sources.isEmpty()) throw OperationFailure("PERMISSION_LOST", "No readable export was shared.")
      if (sources.any { it.scheme !in setOf(ContentResolver.SCHEME_CONTENT, ContentResolver.SCHEME_FILE) }) {
        throw OperationFailure("SHARE_INVALID", "Share files from a WhatsApp chat export.")
      }
      if (leases.size >= MAX_LEASES) throw OperationFailure("ARCHIVE_LIMIT", "Finish or dismiss a previous shared export first.")
      val title = runCatching { intent.getStringExtra(Intent.EXTRA_SUBJECT) }.getOrNull()
        ?.replace(Regex("[\\p{Cc}]"), " ")?.trim()?.take(240)?.takeIf(String::isNotEmpty)
      val handle = "chatstamp-share://$receipt"
      leases[handle] = Lease(SharedExportBatch(sources.toList(), intent.type, title), context,
        intent.flags and Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION != 0)
      enqueue(mapOf("received" to true, "id" to receipt, "sourceUri" to handle,
        "sourceAction" to action, "sourceCount" to count, "mimeType" to intent.type))
      lastDelivery = mapOf("action" to action, "mimeType" to intent.type, "sourceCount" to count, "accepted" to true)
    } catch (error: Exception) {
      val code = (error as? OperationFailure)?.code ?: "SHARE_INVALID"
      // Preserve earlier valid shares and bound rejection records as well as leases.
      if (pending.size < MAX_LEASES + 1) enqueue(mapOf("received" to true, "id" to receipt, "errorCode" to code))
      lastDelivery = mapOf("action" to action, "mimeType" to intent.type, "sourceCount" to count,
        "accepted" to false, "errorCode" to code)
    }
  }

  private fun sharedUris(intent: Intent): List<Uri> {
    fun single() = runCatching { IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java) }.getOrNull()
    fun multiple() = runCatching { IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java) }.getOrNull()
    val streams = if (intent.action == Intent.ACTION_SEND_MULTIPLE) {
      multiple()?.takeIf { it.isNotEmpty() } ?: listOfNotNull(single())
    } else single()?.let(::listOf) ?: multiple().orEmpty()
    if (streams.size > MAX_SOURCES) throw OperationFailure("ARCHIVE_LIMIT", "Too many files were shared.")
    // EXTRA_STREAM is the payload; ClipData can additionally contain a preview.
    if (streams.isNotEmpty()) return streams.distinct()
    val clip = intent.clipData ?: return emptyList()
    if (clip.itemCount > MAX_SOURCES) throw OperationFailure("ARCHIVE_LIMIT", "Too many files were shared.")
    return (0 until clip.itemCount).mapNotNull { clip.getItemAt(it).uri }.distinct()
  }

  private fun enqueue(delivery: Map<String, Any?>) {
    pending.addLast(delivery)
    NativeOperations.emit("onSharedZip", mapOf("received" to true, "id" to delivery["id"]))
  }
}
