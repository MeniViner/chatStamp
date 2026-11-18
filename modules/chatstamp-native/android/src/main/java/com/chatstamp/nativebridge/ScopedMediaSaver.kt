package com.chatstamp.nativebridge

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.MediaStore
import androidx.documentfile.provider.DocumentFile
import androidx.exifinterface.media.ExifInterface
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.Closeable
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneId
import java.util.Locale

internal class ScopedMediaSaver(private val context: Context, private val operation: NativeOperation? = null) {
  private val resolver = context.contentResolver
  private val cache = File(context.cacheDir, "chatstamp").canonicalFile

  suspend fun save(items: List<ScopedSaveItem>, options: ScopedSaveOptions): Map<String, Any?> =
    withContext(Dispatchers.IO) {
      saveLock.withLock {
        val archiveFingerprint = options.archiveFingerprint
        if (!Regex("[a-fA-F0-9]{64}").matches(archiveFingerprint)) throw OperationFailure("IO_ERROR", "The archive fingerprint is unavailable.")
        val chat = cleanSegment(options.chatName)
        val tree = options.treeUri?.takeIf(String::isNotBlank)?.let(Uri::parse)
        if (tree != null && resolver.persistedUriPermissions.none { it.uri == tree && it.isReadPermission && it.isWritePermission }) {
          throw OperationFailure("PERMISSION_LOST", "Selected folder access expired. Choose it again in Settings.")
        }
        val destination = SaveFolders(context, tree)
        val recordKey = hash(listOf(archiveFingerprint, tree?.toString(), chat, options.organizationMode, options.timestampFolder))
        val records = SaveRecords(File(context.filesDir, "chatstamp-store/save-records"), recordKey, options.timestampFolder,
          chat, options.chatFolderName, options.folderLabels)
        val root = listOf(records.chatFolderName, records.folder).filter(String::isNotEmpty).joinToString("/")
        val results = mutableListOf<JSONObject>()
        val sizes = items.map { runCatching { cacheFile(it.sourceUri).length() }.getOrNull() }
        val totalBytes = if (sizes.all { it != null }) sizes.filterNotNull().sum() else null
        items.forEachIndexed { index, item ->
          checkOperation()
          operation?.advance(operation.progress.copy(phase = "saving", filesDone = index,
            totalFiles = items.size, totalBytes = totalBytes, currentFileName = item.filename))
          val result = try {
            val relative = relativeOutputFolder(item, options.organizationMode, records.labels, options.folderLabels != null)
            val folder = listOf(root, relative).filter(String::isNotEmpty).joinToString("/")
            val target = destination.forItem(item.mediaType, folder)
            try {
              saveOne(item, options, records, target, archiveFingerprint)
            } catch (error: DestinationRejected) {
              if (tree != null || item.mediaType != "document") throw error
              saveOne(item, options, records, destination.forDownload(folder), archiveFingerprint)
            }
          } catch (cancelled: CancellationException) {
            throw cancelled
          } catch (error: Exception) {
            val failure = failureFor(error, operation?.cancelled?.get() == true)
            if (failure.code == "CANCELLED") throw failure
            baseResult(item, "failed").put("failureReason", failure.message).put("failureCode", failure.code)
          }
          results.add(result)
          operation?.addResult(toBridgeMap(result))
          operation?.advance(operation.progress.copy(filesDone = index + 1))
        }
        mapOf(
          "mode" to if (tree == null) "scoped-media-store" else "saf-custom-folder",
          "results" to results.map(::toBridgeMap)
        )
      }
    }

  private suspend fun saveOne(
    item: ScopedSaveItem,
    options: ScopedSaveOptions,
    records: SaveRecords,
    folder: SaveFolder,
    archiveFingerprint: String
  ): JSONObject {
    checkOperation()
    val key = hash(listOf(item.entryId, folder.label))
    val recovered = recover(records, key, item, folder)
    if (recovered != null) return recovered
    val completed = records.completed(key)
    val completedUri = completed?.optString("insertedUri")?.takeIf(String::isNotBlank)?.let(Uri::parse)
    val previousCopy = completedUri?.let(folder::read)?.takeUnless { it.pending || it.isDirectory }
    if (options.duplicateHandling == "skip-existing" && previousCopy != null && canRead(previousCopy.uri)) {
      return echoDateContext(JSONObject(completed.toString()), item).put("outcome", "skipped").put("ok", true)
        .put("failureReason", "already-saved")
    }

    val filename = cleanFilename(item.filename)
    val existing = folder.existing(filename)
    val replaced = if (options.duplicateHandling == "replace-existing") {
      previousCopy ?: existing?.takeUnless { it.pending || it.isDirectory }
    } else null
    val name = if (existing == null) filename else chooseName(folder, filename, hash(listOf(archiveFingerprint, item.entryId)).take(10))
    val input = cacheFile(item.sourceUri)
    val zone = runCatching { ZoneId.of(item.timeZone ?: ZoneId.systemDefault().id) }.getOrDefault(ZoneId.systemDefault())
    val format = MediaTimestamps.format(item.mimeType)
    val requested = item.timestampMillis?.takeIf(Double::isFinite)?.toLong()?.let(Instant::ofEpochMilli)
    val existingCapture = if (requested != null && !options.alwaysUseMessageDate) readCapture(input, format, zone) else null
    val choice = MediaTimestamps.choose(requested, item.dateSource, existingCapture, options.alwaysUseMessageDate)
    val scratch = prepare(input, choice, format, zone)
    val prepared = scratch ?: input
    var uri: Uri? = null
    var published = false
    var completedResult: JSONObject? = null
    try {
      val writing = JSONObject().put("name", name).put("folder", folder.label).put("mimeType", item.mimeType)
      records.updateWriting(key, writing)
      val created = folder.create(name, item.mimeType)
      uri = created
      records.updateWriting(key, writing.put("uri", created.toString()))
      val output = resolver.openOutputStream(created, "w") ?: throw IOException("Could not open the destination")
      val copied = tracked(output) { stream -> tracked(prepared.inputStream()) { copy(it, stream, true) } }
      check(copied == prepared.length()) { "The source changed while it was being copied" }
      if (choice.instant != null) runCatching { folder.trySetModified(created, choice.instant) }
      writing.put("expectedSize", copied).put("timestampSource", choice.source)
        .put("targetTimestampMillis", choice.instant?.toEpochMilli() ?: JSONObject.NULL)
      records.updateWriting(key, writing)
      checkOperation()
      folder.publish(created)
      val result = inspect(item, folder, created, copied, choice, zone)
      published = true
      result.put("exifWritten", scratch != null && format == MediaTimestamps.Format.EXIF)
        .put("mp4MetadataFixed", scratch != null && format == MediaTimestamps.Format.CONTAINER)
      records.complete(key, result)
      completedResult = result
      val row = runCatching { folder.read(created) }.getOrNull()
      if (row != null) folder.remember(row)
      if (replaced != null) {
        val bytesVerified = runCatching {
          fingerprint(prepared) == resolver.openInputStream(created)?.use { fingerprint(it) }
        }.getOrDefault(false)
        checkOperation()
        val verified = mayRemoveReplacedFile(
          bytesVerified, choice.instant != null, result.getString("dateVerification"), item.mediaType in galleryTypes
        )
        val removed = verified && runCatching { folder.delete(replaced.uri) }.getOrDefault(false)
        if (removed) folder.forget(replaced)
        else result.put("replacementWarning", "previous-file-kept")
        records.complete(key, result)
      }
      return result
    } catch (error: Exception) {
      if (published && completedResult != null && (error is CancellationException || operation?.cancelled?.get() == true)) {
        if (replaced != null) completedResult.put("replacementWarning", "previous-file-kept")
        return completedResult
      }
      if (!published) withContext(NonCancellable) {
        val clean = uri?.let { runCatching { folder.delete(it) }.getOrDefault(false) } ?: true
        if (clean) records.updateWriting(key, null)
        else throw OperationFailure("IO_ERROR", "The interrupted destination could not be removed.", cause = error)
      }
      throw error
    } finally {
      scratch?.delete()
    }
  }

  private suspend fun recover(
    records: SaveRecords, key: String, item: ScopedSaveItem, folder: SaveFolder
  ): JSONObject? {
    val writing = records.writing(key) ?: return null
    val uri = writing.optString("uri").takeIf(String::isNotBlank)?.let(Uri::parse)
    val row = if (uri != null) folder.read(uri)
    else folder.existing(writing.optString("name"))?.takeIf { it.pending && folder.sharedMedia }
    val size = writing.optLong("expectedSize", -1L)
    if (row != null && !row.pending && size >= 0 && (row.size == size || row.size < 0) && canRead(row.uri)) {
      val target = writing.optionalMillis("targetTimestampMillis")
      val choice = MediaTimestamps.DateChoice(target, writing.optString("timestampSource", "none"))
      val zone = runCatching { ZoneId.of(item.timeZone ?: ZoneId.systemDefault().id) }.getOrDefault(ZoneId.systemDefault())
      val restored = inspect(item, folder, row.uri, size, choice, zone).put("reconciled", true)
      records.complete(key, restored)
      folder.remember(row)
      return restored
    }
    if (row != null) {
      check(folder.delete(row.uri)) { "Could not remove an interrupted copy" }
      folder.forget(row)
    }
    records.updateWriting(key, null)
    return null
  }

  private suspend fun inspect(
    item: ScopedSaveItem, folder: SaveFolder, uri: Uri, size: Long, choice: MediaTimestamps.DateChoice, zone: ZoneId
  ): JSONObject {
    val instant = choice.instant
    val gallery = folder.sharedMedia && item.mediaType in galleryTypes
    var row: SavedItem? = null
    for (attempt in 0..12) {
      row = runCatching { folder.read(uri) }.getOrNull()
      if (row != null && !row.pending && (row.size == size || row.size < 0)) {
        if (!gallery || instant == null || MediaTimestamps.close(row.taken, instant)) break
      }
      if (attempt < 12) delay(200)
    }
    check((row == null || (!row.pending && (row.size == size || row.size < 0))) && canRead(uri)) {
      "The saved file could not be reopened"
    }
    val format = MediaTimestamps.format(item.mimeType)
    val embedded = if (instant == null) null else readEmbedded(uri, format, zone, choice.source != "capture")
    val verified = gallery && MediaTimestamps.close(row?.taken, instant) &&
      (format == MediaTimestamps.Format.OTHER || MediaTimestamps.close(embedded, instant))
    val mtimeVerified = MediaTimestamps.close(row?.modified, instant)
    val verification = if (verified) "verified" else if (mtimeVerified) "mtime-only" else "unverified"
    val reason = when {
      instant == null -> "date-unavailable"
      verified && choice.source == "capture" -> "capture-preserved"
      verified -> "indexed-date"
      mtimeVerified -> "modification-time"
      format != MediaTimestamps.Format.OTHER && embedded == null -> "metadata-unavailable"
      else -> "date-readback-mismatch"
    }
    return baseResult(item, "saved")
      .put("insertedUri", uri.toString())
      .put("displayName", row?.name ?: cleanFilename(item.filename))
      .put("outputPath", row?.let { it.path ?: "${folder.label}/${it.name}" } ?: JSONObject.NULL)
      .put("outputDirectory", folder.label)
      .put("destinationKind", if (folder.sharedMedia) "media-store" else "document-provider")
      .put("targetTimestampMillis", instant?.toEpochMilli() ?: JSONObject.NULL)
      .put("timestampSource", choice.source)
      .put("embeddedTimestampMillis", embedded?.toEpochMilli() ?: JSONObject.NULL)
      .put("dateVerification", verification)
      .put("verificationReason", reason)
      .put("mediaStoreDateTaken", row?.taken?.toEpochMilli() ?: JSONObject.NULL)
      .put("observedModifiedMillis", row?.modified?.toEpochMilli() ?: JSONObject.NULL)
      .put("filesystemTimestampFixed", mtimeVerified)
  }

  private suspend fun prepare(input: File, choice: MediaTimestamps.DateChoice, format: MediaTimestamps.Format, zone: ZoneId): File? {
    val instant = choice.instant ?: return null
    if (choice.source == "capture" || format == MediaTimestamps.Format.OTHER) return null
    if (!hasScratchSpace(input.length(), cache.usableSpace, format)) return null
    var scratch: File? = null
    try {
      val copy = File.createTempFile(".date-", ".${input.extension}", input.parentFile)
      scratch = copy
      copy.outputStream().use { output -> input.inputStream().use { copy(it, output) } }
      when (format) {
        MediaTimestamps.Format.EXIF -> MediaTimestamps.writeExif(copy, instant, zone)
        MediaTimestamps.Format.CONTAINER -> Mp4Timestamps.rewrite(copy, instant)
        else -> Unit
      }
      return copy
    } catch (error: Exception) {
      scratch?.delete()
      if (error is CancellationException || (error is OperationFailure && error.code == "CANCELLED")) throw error
      return null
    }
  }

  private fun readCapture(file: File, format: MediaTimestamps.Format, zone: ZoneId): Instant? = runCatching {
    when (format) {
      MediaTimestamps.Format.EXIF -> MediaTimestamps.readExif(ExifInterface(file), zone)
      MediaTimestamps.Format.CONTAINER -> {
        val header = Mp4Timestamps.readCreation(file)
        MediaMetadataRetriever().use {
          it.setDataSource(file.path)
          header?.takeIf { date -> MediaTimestamps.close(MediaTimestamps.readVideo(it), date) }
        }
      }
      else -> null
    }
  }.getOrNull()

  private fun readEmbedded(uri: Uri, format: MediaTimestamps.Format, zone: ZoneId, requireOffset: Boolean): Instant? = runCatching {
    when (format) {
      MediaTimestamps.Format.EXIF ->
        resolver.openInputStream(uri)?.use { MediaTimestamps.readExif(ExifInterface(it), zone, requireOffset) }
      MediaTimestamps.Format.CONTAINER ->
        resolver.openFileDescriptor(uri, "r")?.use { descriptor ->
          MediaMetadataRetriever().use {
            it.setDataSource(descriptor.fileDescriptor)
            MediaTimestamps.readVideo(it)
          }
        }
      else -> null
    }
  }.getOrNull()

  private suspend fun copy(input: InputStream, output: OutputStream, trackProgress: Boolean = false): Long {
    val buffer = ByteArray(128 * 1024)
    var copied = 0L
    while (true) {
      checkOperation()
      val count = input.read(buffer)
      if (count < 0) return copied
      output.write(buffer, 0, count)
      copied += count
      if (trackProgress) operation?.advance(operation.progress.copy(bytesDone = operation.progress.bytesDone + count))
    }
  }

  private suspend fun fingerprint(file: File): String = file.inputStream().use { fingerprint(it) }

  private suspend fun fingerprint(input: InputStream): String {
    val digest = MessageDigest.getInstance("SHA-256")
    val buffer = ByteArray(128 * 1024)
    while (true) {
      checkOperation()
      val count = input.read(buffer)
      if (count < 0) return digest.digest().hex()
      digest.update(buffer, 0, count)
    }
  }

  private suspend fun checkOperation() {
    operation?.checkCancelled()
    currentCoroutineContext().ensureActive()
  }

  private suspend fun <T : Closeable, R> tracked(stream: T, block: suspend (T) -> R): R {
    operation?.register(stream)
    return try { block(stream) } finally { operation?.unregister(stream); stream.close() }
  }

  private fun cacheFile(value: String): File {
    val uri = Uri.parse(value)
    val file = File(requireNotNull(uri.path)).canonicalFile
    check(uri.scheme == "file" && file.path.startsWith(cache.path + File.separator) && file.isFile) {
      "The imported file is unavailable. Import the ZIP again."
    }
    return file
  }

  private fun canRead(uri: Uri): Boolean = runCatching {
    resolver.openInputStream(uri)?.use { true } == true
  }.getOrDefault(false)

  companion object {
    private val saveLock = Mutex()
    private val galleryTypes = setOf("photo", "video", "sticker", "gif")
  }
}

private class SaveFolders(private val context: Context, private val tree: Uri?) {
  private val folders = mutableMapOf<String, SaveFolder>()
  private val directories = mutableMapOf<String, DocumentFile>()
  private val volume = MediaStore.VOLUME_EXTERNAL_PRIMARY

  fun forItem(type: String, relative: String): SaveFolder {
    if (tree != null) return folders.getOrPut("tree/$relative") {
      val document = directory(relative)
      val rootLabel = DocumentsContract.getTreeDocumentId(tree).replace(':', '/')
      DocumentFolder(context.contentResolver, tree, document, "$rootLabel/$relative")
    }
    return when (type) {
      "photo", "sticker", "gif" -> mediaFolder(MediaStore.Images.Media.getContentUri(volume), "Pictures", relative)
      "video" -> mediaFolder(MediaStore.Video.Media.getContentUri(volume), "Pictures", relative)
      "audio", "voice" -> mediaFolder(MediaStore.Audio.Media.getContentUri(volume), "Music", relative)
      else -> mediaFolder(MediaStore.Files.getContentUri(volume), "Documents", relative)
    }
  }

  fun forDownload(relative: String): SaveFolder = mediaFolder(MediaStore.Downloads.getContentUri(volume), "Download", relative)

  private fun mediaFolder(collection: Uri, root: String, relative: String): SaveFolder {
    val path = "$root/chatStamp/$relative/"
    return folders.getOrPut("$collection|$path") { MediaStoreFolder(context, collection, path) }
  }

  private fun directory(path: String): DocumentFile = directories.getOrPut(path) {
    if (path.isEmpty()) {
      requireNotNull(DocumentFile.fromTreeUri(context, requireNotNull(tree)))
    } else {
      val parent = directory(path.substringBeforeLast('/', ""))
      val name = path.substringAfterLast('/')
      val existing = parent.findFile(name)
      requireNotNull(existing ?: parent.createDirectory(name)).also { check(it.isDirectory) }
    }
  }
}

private fun JSONObject.optionalMillis(key: String): Instant? =
  if (isNull(key)) null else Instant.ofEpochMilli(getLong(key))

private fun toBridgeMap(result: JSONObject): Map<String, Any?> =
  result.keys().asSequence().associateWith { key -> result.get(key).takeUnless { it == JSONObject.NULL } }

private fun baseResult(item: ScopedSaveItem, outcome: String) = JSONObject()
  .put("entryId", item.entryId).put("filename", item.filename).put("mediaType", item.mediaType)
  .put("mimeType", item.mimeType).put("outcome", outcome).put("ok", outcome == "saved")
  .put("dateVerification", "unverified")
  .let { echoDateContext(it, item) }

internal fun echoDateContext(result: JSONObject, item: ScopedSaveItem): JSONObject = result
  .put("whatsAppDateIso", item.whatsAppDateIso ?: JSONObject.NULL)
  .put("dateAmbiguous", item.dateAmbiguous)
  .put("originalTimestampMillis", item.timestampMillis?.takeIf(Double::isFinite) ?: JSONObject.NULL)

private fun chooseName(folder: SaveFolder, filename: String, suffix: String): String {
  var candidate = collisionName(filename, suffix)
  var attempt = 2
  while (folder.existing(candidate) != null) {
    candidate = collisionName(filename, "$suffix-${attempt++}")
  }
  return candidate
}

private fun cleanFilename(value: String): String {
  val normalized = value.replace('\\', '/').substringAfterLast('/').replace(Regex("[:*?\"<>|\\p{Cc}]"), "_")
    .trim().trim('.').ifBlank { "whatsapp-media" }
  val dot = normalized.lastIndexOf('.')
  val ext = if (dot > 0) normalized.substring(dot).take(16) else ""
  return normalized.substringBeforeLast('.', normalized).take(52) + ext
}

private fun hash(value: List<Any?>): String =
  MessageDigest.getInstance("SHA-256").digest(org.json.JSONArray(value).toString().toByteArray(Charsets.UTF_8)).hex()

private fun ByteArray.hex(): String = joinToString("") { "%02x".format(Locale.ROOT, it) }

internal fun hasScratchSpace(bytes: Long, available: Long, format: MediaTimestamps.Format): Boolean {
  val budget = (available - 8L * 1024 * 1024).coerceAtLeast(0)
  return bytes <= if (format == MediaTimestamps.Format.EXIF) budget / 2 else budget
}

data class ScopedSaveItem(
  @Field val entryId: String,
  @Field val sourceUri: String,
  @Field val filename: String,
  @Field val mediaType: String,
  @Field val mimeType: String,
  @Field val timestampMillis: Double? = null,
  @Field val dateSource: String = "none",
  @Field val timeZone: String? = null,
  @Field val relativeFolder: String? = null,
  @Field val whatsAppDateIso: String? = null,
  @Field val dateAmbiguous: Boolean = false,
  @Field val senderName: String? = null
) : Record

data class ScopedSaveOptions(
  @Field val archiveFingerprint: String,
  @Field val chatName: String,
  @Field val treeUri: String? = null,
  @Field val duplicateHandling: String = "skip-existing",
  @Field val timestampFolder: Boolean = false,
  @Field val organizationMode: String = "by-type",
  @Field val alwaysUseMessageDate: Boolean = false,
  @Field val operationId: String,
  @Field val workingDirectory: String,
  @Field val notificationTitle: String,
  @Field val notificationCancelLabel: String,
  @Field val sourceUri: String? = null,
  @Field val folderLabels: OutputFolderLabels? = null,
  @Field val chatFolderName: String? = null
) : Record
