package com.chatstamp.nativebridge

import android.content.ContentResolver
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.BaseColumns
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.provider.MediaStore.MediaColumns
import androidx.documentfile.provider.DocumentFile
import java.io.File
import java.io.IOException
import java.time.Instant
import java.util.Locale

internal data class SavedItem(
  val uri: Uri,
  val name: String,
  val size: Long,
  val pending: Boolean = false,
  val taken: Instant? = null,
  val modified: Instant? = null,
  val path: String? = null,
  val isDirectory: Boolean = false
)

internal class DestinationRejected(cause: Exception) : IOException(cause)

internal abstract class SaveFolder(val label: String) {
  private var files: MutableMap<String, SavedItem>? = null
  protected abstract fun listFiles(): List<SavedItem>
  abstract fun create(name: String, mime: String): Uri
  abstract fun read(uri: Uri): SavedItem?
  abstract fun delete(uri: Uri): Boolean
  abstract fun publish(uri: Uri)
  open fun trySetModified(uri: Uri, target: Instant): Boolean = false
  val sharedMedia: Boolean get() = this is MediaStoreFolder

  fun existing(name: String): SavedItem? {
    val indexed = files ?: listFiles().associateByTo(mutableMapOf()) { it.name.lowercase(Locale.ROOT) }.also { files = it }
    return indexed[name.lowercase(Locale.ROOT)]
  }

  fun remember(item: SavedItem) {
    files?.set(item.name.lowercase(Locale.ROOT), item)
  }

  fun forget(item: SavedItem) {
    files?.remove(item.name.lowercase(Locale.ROOT))
  }
}

internal class MediaStoreFolder(
  private val context: Context,
  private val collection: Uri,
  private val relativePath: String
) : SaveFolder("${Environment.getExternalStorageDirectory().absolutePath}/${relativePath.trimEnd('/')}") {
  private val resolver = context.contentResolver
  private val projection = arrayOf(
    MediaColumns.DISPLAY_NAME, MediaColumns.SIZE, MediaColumns.IS_PENDING, MediaColumns.DATE_TAKEN,
    MediaColumns.DATE_MODIFIED, MediaColumns.DATA, MediaColumns.RELATIVE_PATH, MediaColumns.OWNER_PACKAGE_NAME
  )
  private val includePending = Bundle().apply {
    putInt(MediaStore.QUERY_ARG_MATCH_PENDING, MediaStore.MATCH_INCLUDE)
  }

  override fun create(name: String, mime: String): Uri {
    try {
      return resolver.insert(collection, ContentValues().apply {
        put(MediaColumns.DISPLAY_NAME, name)
        put(MediaColumns.MIME_TYPE, mime)
        put(MediaColumns.RELATIVE_PATH, relativePath)
        put(MediaColumns.IS_PENDING, 1)
      }) ?: throw DestinationRejected(IOException("MediaStore did not create the file"))
    } catch (error: IllegalArgumentException) {
      throw DestinationRejected(error)
    } catch (error: SecurityException) {
      throw DestinationRejected(error)
    }
  }

  override fun read(uri: Uri): SavedItem? =
    resolver.query(uri, projection, includePending, null)?.use { cursor ->
      if (cursor.moveToFirst()) row(cursor, uri) else null
    }

  override fun listFiles(): List<SavedItem> {
    val args = Bundle(includePending).apply {
      putString(ContentResolver.QUERY_ARG_SQL_SELECTION, "${MediaColumns.RELATIVE_PATH}=?")
      putStringArray(ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS, arrayOf(relativePath))
    }
    return resolver.query(collection, projection + BaseColumns._ID, args, null)?.use { cursor ->
      buildList {
        while (cursor.moveToNext()) {
          val uri = ContentUris.withAppendedId(collection, cursor.getLong(projection.size))
          row(cursor, uri)?.let(::add)
        }
      }
    }.orEmpty()
  }

  override fun publish(uri: Uri) {
    val updated = resolver.update(uri, ContentValues().apply { put(MediaColumns.IS_PENDING, 0) }, null, null)
    check(updated == 1) { "MediaStore did not publish the file" }
  }

  override fun delete(uri: Uri): Boolean = read(uri) != null && resolver.delete(uri, null, null) == 1

  override fun trySetModified(uri: Uri, target: Instant): Boolean {
    val row = read(uri) ?: return false
    val file = row.path?.let(::File) ?: return false
    if (file.parentFile?.absolutePath != label) return false
    if (file.name != row.name && !(row.pending && file.name.startsWith(".pending-") && file.name.endsWith("-${row.name}"))) {
      return false
    }
    return file.setLastModified(target.toEpochMilli())
  }

  private fun row(cursor: Cursor, uri: Uri): SavedItem? {
    if (cursor.getString(6) != relativePath || cursor.getString(7) != context.packageName) return null
    return SavedItem(uri, cursor.getString(0), cursor.getLong(1), cursor.getInt(2) != 0,
      cursor.optionalLong(3)?.takeIf { it > 0 }?.let(Instant::ofEpochMilli),
      cursor.optionalLong(4)?.takeIf { it > 0 }?.let(Instant::ofEpochSecond), cursor.getString(5))
  }
}

internal class DocumentFolder(
  private val resolver: ContentResolver,
  private val tree: Uri,
  private val directory: DocumentFile,
  label: String
) : SaveFolder(label) {
  private val projection = arrayOf(
    DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_SIZE,
    DocumentsContract.Document.COLUMN_LAST_MODIFIED, DocumentsContract.Document.COLUMN_DOCUMENT_ID,
    DocumentsContract.Document.COLUMN_MIME_TYPE
  )

  override fun listFiles(): List<SavedItem> {
    val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(directory.uri))
    return resolver.query(children, projection, null, null, null)?.use { cursor ->
      buildList {
        while (cursor.moveToNext()) {
          add(row(cursor, DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(3))))
        }
      }
    }.orEmpty()
  }

  override fun create(name: String, mime: String): Uri =
    DocumentsContract.createDocument(resolver, directory.uri, mime, name)
      ?: throw IOException("The chosen folder could not create the file")

  override fun read(uri: Uri): SavedItem? = resolver.query(uri, projection, null, null, null)?.use { cursor ->
    if (cursor.moveToFirst()) row(cursor, uri) else null
  }

  override fun publish(uri: Uri) = Unit

  override fun delete(uri: Uri): Boolean =
    read(uri)?.isDirectory == false && DocumentsContract.deleteDocument(resolver, uri)

  private fun row(cursor: Cursor, uri: Uri): SavedItem = SavedItem(
    uri, cursor.getString(0), cursor.optionalLong(1) ?: -1L,
    modified = cursor.optionalLong(2)?.takeIf { it > 0 }?.let(Instant::ofEpochMilli),
    isDirectory = cursor.getString(4) == DocumentsContract.Document.MIME_TYPE_DIR
  )
}

private fun Cursor.optionalLong(index: Int): Long? = if (isNull(index)) null else getLong(index)
