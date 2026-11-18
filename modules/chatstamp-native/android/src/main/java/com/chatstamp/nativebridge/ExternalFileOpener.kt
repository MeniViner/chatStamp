package com.chatstamp.nativebridge

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.withContext
import java.io.FileNotFoundException

internal class PreviewFileRecord : Record {
  @Field var uri: String = ""
  @Field var mimeType: String? = null
  @Field var filename: String? = null
}

internal class ExternalFileOpener(
  private val context: Context,
  private val hasHandler: (Intent) -> Boolean = { it.resolveActivity(context.packageManager) != null },
  private val launch: (Intent) -> Unit = { context.startActivity(it) }
) {
  fun intent(file: PreviewFileRecord): Intent {
    val access = PreviewFileAccess(context)
    val source = access.resolve(file.uri)
    val uri = access.contentUri(source)
    val supplied = file.mimeType?.takeIf { it.matches(Regex("[A-Za-z0-9!#$&^_.+*-]+/[A-Za-z0-9!#$&^_.+*-]+")) }
    val type = source.mimeType?.takeIf { it != "application/octet-stream" }
      ?: supplied ?: file.filename?.let { PreviewFileAccess.mimeForName(it) } ?: "application/octet-stream"
    return Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(uri, type)
      clipData = ClipData.newUri(context.contentResolver, "chatStamp", uri)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
  }

  suspend fun open(file: PreviewFileRecord): Map<String, Any?> {
    val view = try { withContext(Dispatchers.IO) { intent(file) } }
    catch (error: CancellationException) { throw error }
    catch (error: PreviewAccessException) { return failure(error.reason) }
    catch (_: SecurityException) { return failure("permission-lost") }
    catch (_: FileNotFoundException) { return failure("unreadable") }
    catch (_: IllegalArgumentException) { return failure("invalid-uri") }
    catch (_: Exception) { return failure("unreadable") }
    return withContext(Dispatchers.Main) {
      try {
        if (!hasHandler(view)) return@withContext failure("no-handler")
        val chooser = Intent.createChooser(view, null).apply {
          clipData = view.clipData
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        launch(chooser)
        mapOf("opened" to true)
      } catch (_: ActivityNotFoundException) { failure("no-handler") }
      catch (_: SecurityException) { failure("permission-lost") }
      catch (_: Exception) { failure("launch-failed") }
    }
  }

  private fun failure(reason: String): Map<String, Any?> = mapOf("opened" to false, "reason" to reason)
}
