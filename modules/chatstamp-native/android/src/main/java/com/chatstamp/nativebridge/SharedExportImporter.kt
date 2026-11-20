package com.chatstamp.nativebridge

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.os.CancellationSignal
import android.provider.OpenableColumns
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.MessageDigest
import java.util.Locale

/** Adapts one granted WhatsApp share to the existing bounded import result. */
internal class SharedExportImporter(private val context: Context, private val limits: ArchiveLimits = ArchiveLimits()) {
  private data class Source(val uri: Uri, val filename: String, val mimeType: String?, val size: Long?) {
    val extension: String get() = filename.substringAfterLast('.', "").lowercase(Locale.ROOT)
  }

  suspend fun extract(sourceUri: String, outputDirectoryUri: String, operationId: String): Map<String, Any?> = withContext(Dispatchers.IO) {
    if (Uri.parse(sourceUri).scheme != "chatstamp-share") {
      return@withContext StreamingZipImporter(context, limits).extract(sourceUri, outputDirectoryUri, operationId)
    }
    val batch = SharedZipInbox.resolve(sourceUri)
      ?: throw OperationFailure("PERMISSION_LOST", "Share the chat export again from WhatsApp.")
    limits.checkEntryCount(batch.sources.size)
    val target = importTarget(context, outputDirectoryUri)
    val operation = NativeOperations.begin(context, operationId, "import", Uri.fromFile(target.job).toString(), sourceUri)
    operation.worker = currentCoroutineContext()[Job]
    try {
      val sources = batch.sources.map { uri ->
        operation.checkCancelled(); currentCoroutineContext().ensureActive()
        describe(uri, operation).also { operation.checkCancelled(); currentCoroutineContext().ensureActive() }
      }
      val hasTranscript = sources.any { it.extension == "txt" }
      if (!hasTranscript) {
        val archive = sources.singleOrNull()?.takeIf {
          it.extension == "zip" || it.mimeType in setOf("application/zip", "application/x-zip-compressed") ||
            it.extension !in StreamingZipImporter.supportedExtensions
        }
        if (archive != null) {
          return@withContext StreamingZipImporter(context, limits).extract(archive.uri.toString(), outputDirectoryUri, operationId, sourceUri, operation)
        }
        if (sources.any { it.extension == "zip" }) throw OperationFailure("SHARE_INVALID", "Share one complete chat export at a time.")
        throw OperationFailure("NO_TRANSCRIPT", "Export the WhatsApp chat, including its transcript and media.")
      }
      extractFiles(sourceUri, sources, target, operation)
    } catch (error: Throwable) {
      val failure = failureFor(error, operation.cancelled.get())
      if (!operation.progress.terminal) withContext(NonCancellable) {
        val removed = !target.output.exists() || target.output.deleteRecursively()
        val finalError = if (removed) failure else OperationFailure("IO_ERROR", "Partial shared files could not be removed.", cause = failure)
        NativeOperations.finish(context, operation, if (finalError.code == "CANCELLED") "cancelled" else "failed", error = finalError)
      }
      throw failure
    }
  }

  fun canReadSource(sourceUri: String): Boolean = runCatching {
    val parsed = Uri.parse(sourceUri)
    val sources = if (parsed.scheme == "chatstamp-share") SharedZipInbox.resolve(sourceUri)?.sources ?: return false else listOf(parsed)
    sources.isNotEmpty() && sources.all { open(it).use { true } }
  }.getOrDefault(false)

  private suspend fun extractFiles(sourceUri: String, sources: List<Source>, target: ImportTarget, operation: NativeOperation): Map<String, Any?> {
    val output = target.output
    val operationId = operation.id
    check(operation.sourceUri == sourceUri)
    operation.progress = operation.progress.copy(totalFiles = sources.size)
    val media = mutableListOf<Pair<String, Map<String, Any?>>>()
    val text = mutableListOf<Pair<String, Map<String, Any?>>>()
    val skipped = mutableListOf<Map<String, Any?>>()
    val entries = mutableListOf<String>()
    var totalBytes = 0L
    var sampleBytes = 0L
    try {
      if (!output.isDirectory && !output.mkdirs()) throw OperationFailure("IO_ERROR", "Could not create the extraction directory.")
      val buffer = ByteArray(128 * 1024)
      sources.forEachIndexed { index, source ->
        operation.checkCancelled()
        currentCoroutineContext().ensureActive()
        limits.checkEntryCount(index + 1)
        val unsafe = StreamingZipImporter.unsafePath(source.filename)
        if (unsafe || source.extension !in StreamingZipImporter.supportedExtensions) {
          val reason = if (unsafe) "unsafe-path" else "unsupported-type"
          skipped.add(mapOf("sourcePath" to source.filename, "reason" to reason))
          entries.add(hashDescriptor(source.filename, 0, "skipped:$reason"))
        } else {
          source.size?.let { limits.checkWrite(0, totalBytes, it, output.usableSpace) }
          // Keep untrusted and potentially long Unicode names out of cache paths.
          val destination = File(output, "${index + 1}.${source.extension}")
          val sample = if (source.extension == "txt") ByteArrayOutputStream() else null
          val digest = MessageDigest.getInstance("SHA-256")
          var entryBytes = 0L
          operation.advance(operation.progress.copy(phase = "extracting", currentFileName = source.filename))
          operation.checkCancelled()
          currentCoroutineContext().ensureActive()
          val input = operation.register(open(source.uri))
          try {
            input.use { stream ->
              val sink = operation.register(FileOutputStream(destination))
              try {
                sink.use { target ->
                  while (true) {
                    operation.checkCancelled()
                    currentCoroutineContext().ensureActive()
                    val read = stream.read(buffer)
                    if (read < 0) break
                    limits.checkWrite(entryBytes, totalBytes, read.toLong(), output.usableSpace)
                    target.write(buffer, 0, read)
                    digest.update(buffer, 0, read)
                    if (sample != null && sample.size() < StreamingZipImporter.textSampleLimit) {
                      val length = minOf(read, StreamingZipImporter.textSampleLimit - sample.size())
                      if (sampleBytes + length > StreamingZipImporter.totalSampleLimit) throw OperationFailure("ARCHIVE_LIMIT", "Too much transcript sample data.")
                      sample.write(buffer, 0, length)
                      sampleBytes += length
                    }
                    entryBytes += read
                    totalBytes += read
                    operation.advance(operation.progress.copy(phase = "extracting", bytesDone = totalBytes, currentFileName = source.filename))
                  }
                }
              } finally { operation.unregister(sink) }
            }
          } finally { operation.unregister(input) }
          val details = mapOf("filename" to source.filename, "uri" to Uri.fromFile(destination).toString(),
            "sourcePath" to source.filename, "modificationTime" to null, "sizeBytes" to entryBytes)
          val descriptor = hashDescriptor(source.filename, entryBytes, digest.digest().hex())
          if (sample == null) media.add(descriptor to details) else {
            val decoder = Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.IGNORE).onUnmappableCharacter(CodingErrorAction.IGNORE)
            text.add(descriptor to (details + ("sample" to decoder.decode(ByteBuffer.wrap(sample.toByteArray())).toString())))
          }
          entries.add(descriptor)
        }
        operation.advance(operation.progress.copy(phase = "extracting", filesDone = index + 1, bytesDone = totalBytes))
      }
      operation.checkCancelled()
      val digest = MessageDigest.getInstance("SHA-256")
      digest.update("chatstamp-shared-files-v1\u0000".toByteArray(Charsets.UTF_8))
      entries.sorted().forEach { digest.update(it.toByteArray(Charsets.US_ASCII)) }
      val fingerprint = digest.digest().hex()
      operation.archiveFingerprint = fingerprint
      operation.progress = operation.progress.copy(filesDone = sources.size, bytesDone = totalBytes, totalBytes = totalBytes)
      val result = mapOf("operationId" to operationId, "archiveFingerprint" to fingerprint,
        // Stable ordering also keeps duplicate-filename occurrence IDs consistent
        // with the order-independent fingerprint when Android reorders a share.
        "mediaFiles" to media.sortedBy { it.first }.map { it.second },
        "transcriptCandidates" to text.sortedBy { it.first }.map { it.second }, "skippedEntries" to skipped,
        "extractedCount" to media.size + text.size, "skippedCount" to skipped.size, "extractionMode" to "native-selective")
      NativeOperations.finish(context, operation, "completed")
      return result
    } catch (error: Throwable) {
      val failure = failureFor(error, operation.cancelled.get())
      withContext(NonCancellable) {
        val removed = !output.exists() || output.deleteRecursively()
        val finalError = if (removed) failure else OperationFailure("IO_ERROR", "Partial shared files could not be removed.", cause = failure)
        NativeOperations.finish(context, operation, if (finalError.code == "CANCELLED") "cancelled" else "failed", error = finalError)
      }
      throw failure
    }
  }

  private fun describe(uri: Uri, operation: NativeOperation): Source {
    var filename: String? = null
    var size: Long? = null
    val mime = if (uri.scheme == ContentResolver.SCHEME_CONTENT) runCatching { context.contentResolver.getType(uri) }.getOrNull() else null
    if (uri.scheme == ContentResolver.SCHEME_FILE) {
      val file = uri.path?.let(::File) ?: throw OperationFailure("PERMISSION_LOST", "The shared source is unavailable.")
      filename = file.name
      size = file.length()
    } else if (uri.scheme == ContentResolver.SCHEME_CONTENT) {
      val signal = CancellationSignal()
      val cancellation = operation.register(Closeable { signal.cancel() })
      try {
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null, signal)?.use { cursor ->
          if (cursor.moveToFirst()) {
            val nameColumn = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            val sizeColumn = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (nameColumn >= 0 && !cursor.isNull(nameColumn)) filename = runCatching { cursor.getString(nameColumn) }.getOrNull()
            if (sizeColumn >= 0 && !cursor.isNull(sizeColumn)) size = runCatching { cursor.getLong(sizeColumn) }.getOrNull()?.takeIf { it >= 0 }
          }
        }
      } finally { operation.unregister(cancellation) }
    }
    var name = filename?.takeIf(String::isNotBlank) ?: uri.lastPathSegment?.takeIf(String::isNotBlank) ?: "export"
    if (name.length > 4096) throw OperationFailure("ARCHIVE_LIMIT", "A shared file name is too long.")
    if (name.substringAfterLast('.', "").isEmpty() && mime == "text/plain") name += ".txt"
    return Source(uri, name, mime, size)
  }

  private fun open(uri: Uri): InputStream = when (uri.scheme) {
    ContentResolver.SCHEME_CONTENT -> context.contentResolver.openInputStream(uri)
    ContentResolver.SCHEME_FILE -> uri.path?.let { FileInputStream(File(it)) }
    else -> null
  } ?: throw OperationFailure("PERMISSION_LOST", "The shared source is no longer readable.")

  private fun hashDescriptor(name: String, bytes: Long, contentHash: String): String {
    val digest = MessageDigest.getInstance("SHA-256")
    val nameBytes = name.toByteArray(Charsets.UTF_8)
    digest.update(ByteBuffer.allocate(4).putInt(nameBytes.size).array())
    digest.update(nameBytes)
    digest.update(ByteBuffer.allocate(8).putLong(bytes).array())
    digest.update(contentHash.toByteArray(Charsets.US_ASCII))
    return digest.digest().hex()
  }

  private fun ByteArray.hex(): String = joinToString("") { "%02x".format(Locale.ROOT, it) }
}
