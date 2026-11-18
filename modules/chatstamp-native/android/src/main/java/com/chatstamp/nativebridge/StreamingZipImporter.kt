package com.chatstamp.nativebridge

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.FilterInputStream
import java.io.InputStream
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.DigestInputStream
import java.security.MessageDigest
import java.time.Instant
import java.util.Locale
import java.util.zip.ZipException
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import org.apache.commons.compress.archivers.zip.ZipArchiveEntry
import org.apache.commons.compress.archivers.zip.ZipArchiveInputStream

internal class StreamingZipImporter(private val context: Context, private val limits: ArchiveLimits = ArchiveLimits()) {
  suspend fun extract(sourceUri: String, outputDirectoryUri: String, operationId: String): Map<String, Any?> = withContext(Dispatchers.IO) {
    val outputUri = Uri.parse(outputDirectoryUri)
    val output = outputUri.path?.let(::File)?.canonicalFile
      ?: throw OperationFailure("IO_ERROR", "Invalid extraction directory.")
    if (outputUri.scheme != "file") throw OperationFailure("IO_ERROR", "Invalid extraction directory.")
    val directory = jobDirectory(context, Uri.fromFile(output.parentFile).toString())
    if (output.exists() && output.listFiles().orEmpty().isNotEmpty()) {
      throw OperationFailure("IO_ERROR", "The extraction directory is already in use.")
    }
    val operation = NativeOperations.begin(context, operationId, "import", Uri.fromFile(directory).toString(), sourceUri)
    operation.worker = currentCoroutineContext()[Job]
    val media = mutableListOf<Map<String, Any?>>()
    val text = mutableListOf<Map<String, Any?>>()
    val skipped = mutableListOf<Map<String, Any?>>()
    val digest = MessageDigest.getInstance("SHA-256")
    var count = 0
    var totalBytes = 0L
    var sampleBytes = 0L
    try {
      if (!output.isDirectory && !output.mkdirs()) throw OperationFailure("IO_ERROR", "Could not create the extraction directory.")
      val source = Uri.parse(sourceUri)
      val input = when (source.scheme) {
        ContentResolver.SCHEME_CONTENT -> context.contentResolver.openInputStream(source)
        ContentResolver.SCHEME_FILE -> source.path?.let { FileInputStream(File(it)) }
        else -> null
      } ?: throw OperationFailure("PERMISSION_LOST", "The source archive is no longer readable.")
      operation.register(input)
      try {
        val tail = ZipStreamTail(input)
        DigestInputStream(tail, digest).use { hashed ->
          val buffered = BufferedInputStream(hashed, 128 * 1024)
          buffered.mark(4)
          val signature = ByteArray(4)
          var signatureBytes = 0
          while (signatureBytes < signature.size) {
            val read = buffered.read(signature, signatureBytes, signature.size - signatureBytes)
            if (read < 0) break
            signatureBytes += read
          }
          if (signatureBytes != 4 || !signature.contentEquals(byteArrayOf(0x50, 0x4b, 0x03, 0x04))) {
            throw OperationFailure("ZIP_INVALID", "The source is not a non-empty ZIP archive.")
          }
          buffered.reset()
          // Keep STORED data-descriptor buffering disabled: every entry must remain bounded and streamed.
          ZipArchiveInputStream(buffered, "UTF-8", true, false).use { zip ->
            val buffer = ByteArray(128 * 1024)
            var previousEntry: EntryValidation? = null
            while (true) {
              operation.checkCancelled()
              currentCoroutineContext().ensureActive()
              val entry = readZip(operation) { zip.nextEntry }
              // Advancing finalizes the preceding data descriptor before CRC/size comparison.
              previousEntry?.verify()
              previousEntry = null
              if (entry == null) break
              limits.checkEntryCount(++count)
              val path = entry.name.orEmpty()
              if (path.length > 4096) throw OperationFailure("ARCHIVE_LIMIT", "An archive entry name is too long.")
              if (entry.method !in setOf(ZipEntry.STORED, ZipEntry.DEFLATED) || !zip.canReadEntryData(entry)) {
                throw OperationFailure("ZIP_INVALID", "The ZIP uses unsupported compression or encryption.")
              }
              val filename = path.replace('\\', '/').substringAfterLast('/')
              val extension = filename.substringAfterLast('.', "").lowercase(Locale.ROOT)
              val unsafe = unsafePath(path)
              val supported = !entry.isDirectory && !unsafe && extension in supportedExtensions
              if (unsafe || !supported) skipped.add(mapOf("sourcePath" to path,
                "reason" to if (unsafe) "unsafe-path" else "unsupported-type"))
              if (entry.size >= 0) limits.checkWrite(0, totalBytes, entry.size, if (supported) output.usableSpace else Long.MAX_VALUE)
              val destination = if (supported) File(output, "$count-${safeFilename(filename)}") else null
              val sample = if (supported && extension == "txt") ByteArrayOutputStream() else null
              var entryBytes = 0L
              val crc = CRC32()
              operation.advance(operation.progress.copy(phase = "extracting", currentFileName = filename))
              val sink = destination?.let(::FileOutputStream)
              try {
                sink?.let { operation.register(it) }
                while (true) {
                  operation.checkCancelled()
                  currentCoroutineContext().ensureActive()
                  val read = readZip(operation) { zip.read(buffer, 0, buffer.size) }
                  if (read < 0) break
                  limits.checkWrite(entryBytes, totalBytes, read.toLong(), if (sink != null) output.usableSpace else Long.MAX_VALUE)
                  sink?.write(buffer, 0, read)
                  crc.update(buffer, 0, read)
                  if (sample != null && sample.size() < textSampleLimit) {
                    val length = minOf(read, textSampleLimit - sample.size())
                    if (sampleBytes + length > totalSampleLimit) throw OperationFailure("ARCHIVE_LIMIT", "The archive has too much transcript sample data.")
                    sample.write(buffer, 0, length)
                    sampleBytes += length
                  }
                  entryBytes += read
                  totalBytes += read
                  operation.advance(operation.progress.copy(phase = "extracting", bytesDone = totalBytes, currentFileName = filename))
                }
              } finally {
                sink?.let { operation.unregister(it); it.close() }
              }
              previousEntry = EntryValidation(entry, crc.value, entryBytes)
              if (destination != null) {
                val modified = entry.time.takeIf { it > earliestZipTime }?.let { Instant.ofEpochMilli(it).toString() }
                val details = mapOf("filename" to filename, "uri" to Uri.fromFile(destination).toString(),
                  "sourcePath" to path, "modificationTime" to modified, "sizeBytes" to entryBytes)
                if (sample == null) media.add(details)
                else {
                  val decoder = Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.IGNORE)
                    .onUnmappableCharacter(CodingErrorAction.IGNORE)
                  text.add(details + mapOf("sample" to decoder.decode(ByteBuffer.wrap(sample.toByteArray())).toString()))
                }
              }
              operation.advance(operation.progress.copy(phase = "extracting", filesDone = count, bytesDone = totalBytes))
            }
            if (count == 0) throw OperationFailure("ZIP_INVALID", "The archive has no entries.")
            // The reader consumes the central directory; hash any unread trailing source bytes before closing it.
            while (true) {
              operation.checkCancelled()
              currentCoroutineContext().ensureActive()
              if (hashed.read(buffer) < 0) break
            }
            tail.verifyEnd(count)
          }
        }
      } finally {
        operation.unregister(input)
        input.close()
      }
      operation.checkCancelled()
      val fingerprint = digest.digest().joinToString("") { "%02x".format(Locale.ROOT, it) }
      operation.archiveFingerprint = fingerprint
      operation.progress = operation.progress.copy(filesDone = count, totalFiles = count, bytesDone = totalBytes, totalBytes = totalBytes)
      val result = mapOf("operationId" to operationId, "archiveFingerprint" to fingerprint,
        "mediaFiles" to media, "transcriptCandidates" to text, "skippedEntries" to skipped,
        "extractedCount" to media.size + text.size, "skippedCount" to skipped.size, "extractionMode" to "native-selective")
      NativeOperations.finish(context, operation, "completed")
      result
    } catch (error: Throwable) {
      val failure = failureFor(error, operation.cancelled.get())
      withContext(NonCancellable) {
        val removed = !output.exists() || output.deleteRecursively()
        val finalError = if (removed) failure else OperationFailure("IO_ERROR", "Partial extraction files could not be removed.", cause = failure)
        NativeOperations.finish(context, operation, if (finalError.code == "CANCELLED") "cancelled" else "failed", error = finalError)
      }
      throw failure
    }
  }

  private data class EntryValidation(val entry: ZipArchiveEntry, val crc: Long, val bytes: Long) {
    fun verify() {
      if (entry.crc < 0 || entry.crc != crc || entry.size < 0 || entry.size != bytes) {
        throw OperationFailure("ZIP_INVALID", "An archive entry failed its CRC or size verification.")
      }
    }
  }

  companion object {
    private const val textSampleLimit = 64 * 1024
    private const val totalSampleLimit = 16L * 1024 * 1024
    private const val earliestZipTime = 315_619_200_000L
    private val supportedExtensions = setOf(
      "txt", "jpg", "jpeg", "png", "heic", "webp", "mp4", "mov", "m4v", "3gp",
      "opus", "ogg", "m4a", "mp3", "aac", "gif", "pdf", "doc", "docx", "vcf", "xls", "xlsx", "ppt", "pptx", "zip"
    )
    private fun unsafePath(path: String): Boolean {
      val normalized = path.replace('\\', '/')
      return normalized.startsWith('/') || Regex("^[A-Za-z]:").containsMatchIn(normalized) ||
        normalized.split('/').any { it == ".." } || '\u0000' in normalized
    }
    private fun safeFilename(name: String): String = name.replace(Regex("[\\\\/:*?\"<>|\\p{Cc}]"), "_")
      .trim().trim('.').take(180).ifBlank { "attachment" }
  }
}

internal suspend fun <T> readZip(operation: NativeOperation, block: () -> T): T {
  operation.checkCancelled()
  currentCoroutineContext().ensureActive()
  return try {
    val value = block()
    operation.checkCancelled()
    currentCoroutineContext().ensureActive()
    value
  } catch (error: IOException) {
    // Closing a blocked source read is part of cancellation, not proof of a damaged archive.
    operation.checkCancelled()
    currentCoroutineContext().ensureActive()
    throw OperationFailure("ZIP_INVALID", "The ZIP archive is damaged or incomplete.", cause = error)
  }
}

internal fun failureFor(error: Throwable, cancelled: Boolean = false): OperationFailure = when {
  error is OperationFailure -> error
  cancelled || error is CancellationException -> OperationFailure("CANCELLED", "The operation was cancelled.", cause = error)
  error is SecurityException -> OperationFailure("PERMISSION_LOST", "Source or destination permission is no longer available.", cause = error)
  error is ZipException || error is EOFException -> OperationFailure("ZIP_INVALID", "The ZIP archive is damaged or incomplete.", cause = error)
  else -> OperationFailure("IO_ERROR", error.message ?: "The file operation failed.", cause = error)
}

/** Retains only the bounded end record while raw bytes pass through the single digest stream. */
private class ZipStreamTail(input: InputStream) : FilterInputStream(input) {
  private val tail = ByteArray(65_557)
  private var position = 0
  private var size = 0

  override fun read(): Int {
    val value = `in`.read()
    if (value >= 0) append(byteArrayOf(value.toByte()), 0, 1)
    return value
  }

  override fun read(bytes: ByteArray, offset: Int, length: Int): Int {
    val read = `in`.read(bytes, offset, length)
    if (read > 0) append(bytes, offset, read)
    return read
  }

  private fun append(bytes: ByteArray, offset: Int, length: Int) {
    if (length >= tail.size) {
      System.arraycopy(bytes, offset + length - tail.size, tail, 0, tail.size)
      position = 0
      size = tail.size
      return
    }
    val first = minOf(length, tail.size - position)
    System.arraycopy(bytes, offset, tail, position, first)
    if (first < length) System.arraycopy(bytes, offset + first, tail, 0, length - first)
    position = (position + length) % tail.size
    size = minOf(tail.size, size + length)
  }

  fun verifyEnd(entryCount: Int) {
    val bytes = ByteArray(size)
    val start = if (size == tail.size) position else 0
    val first = minOf(size, tail.size - start)
    System.arraycopy(tail, start, bytes, 0, first)
    if (first < size) System.arraycopy(tail, 0, bytes, first, size - first)
    for (index in bytes.size - 22 downTo 0) {
      if (bytes[index] == 0x50.toByte() && bytes[index + 1] == 0x4b.toByte() &&
        bytes[index + 2] == 0x05.toByte() && bytes[index + 3] == 0x06.toByte()) {
        fun word(offset: Int): Int = (bytes[index + offset].toInt() and 255) or
          ((bytes[index + offset + 1].toInt() and 255) shl 8)
        if (index + 22 + word(20) != bytes.size) continue
        if (word(4) != 0 || word(6) != 0 || (word(10) != entryCount && word(10) != 0xffff)) {
          throw OperationFailure("ZIP_INVALID", "The ZIP end record does not match its entries.")
        }
        return
      }
    }
    throw OperationFailure("ZIP_INVALID", "The ZIP archive has no complete end record.")
  }
}
