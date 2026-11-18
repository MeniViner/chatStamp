package com.chatstamp.nativebridge

import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import java.util.ArrayDeque
import java.util.UUID

internal object SharedZipInbox {
  private val guard = Any()
  private val pending = ArrayDeque<Map<String, Any?>>()
  private val persistedByUs = mutableSetOf<String>()
  private var launchRead = false

  fun captureLaunch(context: Context, intent: Intent?) = synchronized(guard) {
    if (launchRead || intent == null) return@synchronized
    launchRead = true
    capture(context, intent)
  }

  fun captureNew(context: Context, intent: Intent) = synchronized(guard) {
    launchRead = true
    capture(context, intent)
  }

  fun notifySubscribers() = synchronized(guard) {
    pending.peekFirst()?.let { NativeOperations.emit("onSharedZip", mapOf("received" to true, "id" to it["id"])) }
  }

  fun consume(): Map<String, Any?> = synchronized(guard) {
    pending.pollFirst() ?: mapOf("received" to false)
  }

  fun debug(): Map<String, Any?> = synchronized(guard) {
    mapOf("launchIntentRead" to launchRead, "pendingCount" to pending.size)
  }

  fun release(context: Context, sourceUri: String) = synchronized(guard) {
    if (pending.any { it["sourceUri"] == sourceUri } || !persistedByUs.remove(sourceUri)) return@synchronized
    runCatching { context.contentResolver.releasePersistableUriPermission(Uri.parse(sourceUri), Intent.FLAG_GRANT_READ_URI_PERMISSION) }
  }

  private fun capture(context: Context, intent: Intent) {
    val action = intent.action
    if (action !in setOf(Intent.ACTION_SEND, Intent.ACTION_SEND_MULTIPLE, Intent.ACTION_VIEW)) return
    val uris = when (action) {
      Intent.ACTION_VIEW -> listOfNotNull(intent.data)
      else -> buildList {
        if (Build.VERSION.SDK_INT >= 33) {
          if (action == Intent.ACTION_SEND_MULTIPLE) intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)?.let(::addAll)
          else intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)?.let(::add)
        } else {
          @Suppress("DEPRECATION")
          if (action == Intent.ACTION_SEND_MULTIPLE) intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)?.let(::addAll)
          else intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)?.let(::add)
        }
        intent.clipData?.let { clip -> (0 until clip.itemCount).mapNotNullTo(this) { clip.getItemAt(it).uri } }
      }
    }.filter { it.scheme in setOf(ContentResolver.SCHEME_CONTENT, ContentResolver.SCHEME_FILE) }.distinct()
    if (uris.isEmpty()) {
      if (action == Intent.ACTION_VIEW) return
      enqueue(mapOf("received" to true, "id" to UUID.randomUUID().toString(), "errorCode" to "PERMISSION_LOST"))
      return
    }
    uris.forEach { uri ->
      val delivery = mutableMapOf<String, Any?>("received" to true, "id" to UUID.randomUUID().toString(),
        "sourceUri" to uri.toString(), "mimeType" to (intent.type ?: "application/zip"))
      try {
        val hadGrant = context.contentResolver.persistedUriPermissions.any { it.uri == uri && it.isReadPermission }
        if (!hadGrant && intent.flags and Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION != 0) {
          runCatching {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            persistedByUs.add(uri.toString())
          }
        }
        val name = if (uri.scheme == ContentResolver.SCHEME_FILE) uri.lastPathSegment else {
          context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
          }
        }
        delivery["filename"] = name?.takeIf(String::isNotBlank) ?: "whatsapp-export.zip"
      } catch (_: SecurityException) {
        delivery["errorCode"] = "PERMISSION_LOST"
      } catch (_: Exception) {
        delivery["errorCode"] = "IO_ERROR"
      }
      enqueue(delivery)
    }
  }

  private fun enqueue(delivery: Map<String, Any?>) {
    pending.addLast(delivery)
    NativeOperations.emit("onSharedZip", mapOf("received" to true, "id" to delivery["id"]))
  }
}
