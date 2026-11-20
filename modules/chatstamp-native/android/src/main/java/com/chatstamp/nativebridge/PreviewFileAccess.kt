package com.chatstamp.nativebridge

import android.content.ContentResolver
import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.provider.BaseColumns
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.system.Os
import android.system.OsConstants
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileNotFoundException

internal class PreviewAccessException(val reason: String) : Exception(reason)

internal data class PreviewSource(
  val uri: Uri, val identity: String, val modifiedMillis: Long?, val bytes: Long?,
  val filename: String, val mimeType: String?, val ownerJob: String?
) {
  val reusable: Boolean get() = ThumbnailPolicy.reusable(modifiedMillis, bytes)
  val kind: String? get() = when {
    mimeType?.startsWith("image/") == true -> "image"
    mimeType?.startsWith("video/") == true -> "video"
    mimeType == "application/pdf" -> "pdf"
    else -> when (filename.substringAfterLast('.', "").lowercase()) {
      "jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "bmp" -> "image"
      "mp4", "mov", "m4v", "3gp", "webm", "mkv" -> "video"
      "pdf" -> "pdf"
      else -> null
    }
  }
}

internal class PreviewFileAccess(private val context: Context) {
  private val resolver get() = context.contentResolver
  private val importRoot get() = File(context.cacheDir, "chatstamp").canonicalFile

  fun resolve(value: String): PreviewSource {
    val uri = Uri.parse(value)
    return when (uri.scheme) {
      ContentResolver.SCHEME_FILE -> {
        val file = uri.path?.let(::File)?.canonicalFile ?: throw PreviewAccessException("invalid-uri")
        if (!isImportedFile(file)) {
          val owned = ownedMediaUriForPath(file.path) ?: throw PreviewAccessException("invalid-uri")
          return resolveContent(owned)
        }
        if (!file.isFile || !file.canRead()) throw PreviewAccessException("unreadable")
        PreviewSource(Uri.fromFile(file), file.path, file.lastModified().takeIf { it > 0 }, file.length(),
          file.name, mimeForName(file.name), ownerForFile(file))
      }
      ContentResolver.SCHEME_CONTENT -> resolveContent(uri)
      else -> throw PreviewAccessException("invalid-uri")
    }
  }

  fun shareableUri(uri: String?, path: String?): Uri? = runCatching {
    val value = uri?.takeIf { Uri.parse(it).scheme in setOf("file", "content") }
      ?: path?.let { Uri.fromFile(File(it)).toString() } ?: return@runCatching null
    contentUri(resolve(value))
  }.getOrNull()

  fun contentUri(source: PreviewSource): Uri = if (source.uri.scheme == "content") source.uri else {
    FileProvider.getUriForFile(context, "${context.packageName}.ChatStampFileProvider", File(source.uri.path!!))
  }

  fun ownedMediaUriForPath(path: String): Uri? = runCatching {
    val collection = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
    resolver.query(collection, arrayOf(BaseColumns._ID),
      "${MediaStore.MediaColumns.DATA}=? AND ${MediaStore.MediaColumns.OWNER_PACKAGE_NAME}=?",
      arrayOf(path, context.packageName), null
    )?.use { if (it.moveToFirst()) ContentUris.withAppendedId(collection, it.getLong(0)) else null }
  }.getOrNull()

  private fun resolveContent(uri: Uri): PreviewSource {
    var bytes: Long? = null
    var modified: Long? = null
    var filename = uri.lastPathSegment.orEmpty().take(256)
    try {
      resolver.openFileDescriptor(uri, "r")?.use { descriptor ->
        runCatching { Os.fstat(descriptor.fileDescriptor) }.getOrNull()?.let { stat ->
          if (OsConstants.S_ISREG(stat.st_mode)) {
            bytes = stat.st_size.takeIf { it >= 0 }
            modified = stat.st_mtime.takeIf { it > 0 }?.let { it * 1000 }
          }
        }
      } ?: throw PreviewAccessException("unreadable")
      runCatching {
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
          if (cursor.moveToFirst()) {
            cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME).takeIf { it >= 0 && !cursor.isNull(it) }
              ?.let { filename = cursor.getString(it).take(256) }
            cursor.getColumnIndex(OpenableColumns.SIZE).takeIf { it >= 0 && !cursor.isNull(it) }
              ?.let { bytes = cursor.getLong(it).takeIf { value -> value >= 0 } }
          }
        }
      }
      val column = when {
        DocumentsContract.isDocumentUri(context, uri) -> DocumentsContract.Document.COLUMN_LAST_MODIFIED
        uri.authority == MediaStore.AUTHORITY -> MediaStore.MediaColumns.DATE_MODIFIED
        else -> null
      }
      if (column != null) runCatching {
        resolver.query(uri, arrayOf(column), null, null, null)?.use { cursor ->
          if (cursor.moveToFirst() && !cursor.isNull(0)) {
            cursor.getLong(0).takeIf { it > 0 }?.let { modified = if (column == MediaStore.MediaColumns.DATE_MODIFIED) it * 1000 else it }
          }
        }
      }
      val ownFile = if (uri.authority == "${context.packageName}.ChatStampFileProvider" && uri.pathSegments.firstOrNull() == "imports") {
        File(importRoot, uri.pathSegments.drop(1).joinToString("/")).canonicalFile.takeIf(::isImportedFile)
      } else null
      if (ownFile != null) {
        if (!ownFile.isFile) throw PreviewAccessException("unreadable")
        modified = ownFile.lastModified().takeIf { it > 0 }; bytes = ownFile.length()
      }
      val type = runCatching { resolver.getType(uri) }.getOrNull() ?: mimeForName(filename)
      return PreviewSource(uri, ownFile?.path ?: uri.toString(), modified, bytes, filename, type,
        ownFile?.let(::ownerForFile))
    } catch (_: SecurityException) { throw PreviewAccessException("permission-lost") }
    catch (_: FileNotFoundException) { throw PreviewAccessException("unreadable") }
  }

  private fun isImportedFile(file: File): Boolean = file.path.startsWith(importRoot.path + File.separator)

  private fun ownerForFile(file: File): String = File(importRoot, file.relativeTo(importRoot).path.substringBefore(File.separator)).path

  companion object {
    fun mimeForName(name: String): String? = MimeTypeMap.getSingleton()
      .getMimeTypeFromExtension(name.substringAfterLast('.', "").lowercase())
  }
}
