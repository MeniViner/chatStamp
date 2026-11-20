package com.chatstamp.nativebridge

import android.content.Context
import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.util.UUID

internal class LocalJsonStore(context: Context) {
  private val directory = File(context.filesDir, "chatstamp-store").apply {
    if (!isDirectory && !mkdirs()) throw OperationFailure("IO_ERROR", "Could not create local storage.")
  }.canonicalFile

  fun read(name: String, maxBytes: Int? = null): String? = guarded {
    val file = file(name)
    if (!file.exists()) null
    else {
      if (!file.isFile) throw OperationFailure("IO_ERROR", "Local storage is not a regular file.")
      if (maxBytes == null) file.readText(Charsets.UTF_8)
      else {
        require(maxBytes > 0 && maxBytes < Int.MAX_VALUE)
        file.inputStream().use { stream ->
          val bytes = ByteArray(maxBytes + 1)
          var count = 0
          while (count < bytes.size) {
            val read = stream.read(bytes, count, bytes.size - count)
            if (read < 0) break
            count += read
          }
          if (count > maxBytes) throw OperationFailure("IO_ERROR", "Local storage exceeds its read limit.")
          String(bytes, 0, count, Charsets.UTF_8)
        }
      }
    }
  }

  fun write(name: String, contents: String) = guarded {
    val destination = file(name)
    val temporary = File(directory, ".${destination.name}.${UUID.randomUUID()}.tmp")
    try {
      FileOutputStream(temporary).use { stream ->
        stream.write(contents.toByteArray(Charsets.UTF_8))
        stream.fd.sync()
      }
      Files.move(temporary.toPath(), destination.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
      Unit
    } finally {
      temporary.delete()
    }
  }

  fun list(prefix: String): List<String> = guarded {
    if (prefix.isNotEmpty()) validate(prefix)
    directory.listFiles().orEmpty().filter { it.isFile && it.name.startsWith(prefix) }.map { it.name }.sorted()
  }

  fun delete(name: String) = guarded {
    val file = file(name)
    if (file.exists() && !file.delete()) throw OperationFailure("IO_ERROR", "Could not remove a local storage file.")
    Unit
  }

  private fun file(name: String): File {
    validate(name)
    return File(directory, name).canonicalFile.also {
      if (it.parentFile != directory) throw OperationFailure("IO_ERROR", "Invalid local storage path.")
    }
  }

  private fun validate(name: String) {
    if (!Regex("[A-Za-z0-9._-]{1,180}").matches(name) || name == "." || name == "..") {
      throw OperationFailure("IO_ERROR", "Invalid local storage filename.")
    }
  }

  private fun <T> guarded(block: () -> T): T = synchronized(lock) {
    try { block() } catch (error: OperationFailure) { throw error }
    catch (error: Exception) { throw OperationFailure("IO_ERROR", "Local storage could not be updated.", cause = error) }
  }

  companion object { private val lock = Any() }
}
