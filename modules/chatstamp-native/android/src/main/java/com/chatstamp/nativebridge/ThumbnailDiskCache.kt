package com.chatstamp.nativebridge

import java.io.File
import java.io.ByteArrayOutputStream
import java.io.FilterOutputStream
import java.io.IOException
import java.io.OutputStream
import java.io.RandomAccessFile
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.util.Properties
import java.util.UUID

internal data class ThumbnailCacheRecord(
  val width: Int, val height: Int, val kind: String, val durationMillis: Long?,
  val ownerJob: String?, val reusable: Boolean
)

internal class ThumbnailDiskCache(private val root: File, private val limits: ThumbnailLimits = ThumbnailLimits()) {
  private val guard = Any()
  private val keyPattern = Regex("[a-f0-9]{64}")
  private val metadataReserve = 4096L

  fun read(key: String): ThumbnailCacheRecord? = synchronized(guard) {
    require(keyPattern.matches(key))
    val record = record(key)
    if (record == null || !validJpeg(image(key))) { remove(key); return@synchronized null }
    if (!record.reusable) return@synchronized null
    metadata(key).setLastModified(System.currentTimeMillis())
    record
  }

  fun file(key: String): File = image(key)

  fun put(key: String, record: ThumbnailCacheRecord, write: (OutputStream) -> Boolean): File = synchronized(guard) {
    require(keyPattern.matches(key))
    if (!root.isDirectory && !root.mkdirs()) throw IOException("Thumbnail cache is unavailable.")
    cleanup()
    remove(key)
    val reserve = limits.maxJpegBytes + metadataReserve
    if (reserve > limits.maxBytes) throw IOException("Thumbnail cache budget is too small.")
    trim(reserve, 1)
    if (totalBytes() + reserve > limits.maxBytes) throw IOException("Thumbnail cache budget is unavailable.")
    val suffix = UUID.randomUUID().toString()
    val temporary = File(root, "$key.$suffix.jpg.tmp")
    val temporaryMetadata = File(root, "$key.$suffix.properties.tmp")
    try {
      temporary.outputStream().use { stream ->
        val bounded = object : FilterOutputStream(stream) {
          var count = 0L
          override fun write(value: Int) {
            if (count >= limits.maxJpegBytes) throw IOException("Thumbnail JPEG exceeds its limit.")
            out.write(value); count++
          }
          override fun write(buffer: ByteArray, offset: Int, length: Int) {
            if (length < 0 || count > limits.maxJpegBytes - length) throw IOException("Thumbnail JPEG exceeds its limit.")
            out.write(buffer, offset, length); count += length
          }
        }
        if (!write(bounded)) throw IOException("Thumbnail encoding failed.")
        bounded.flush()
        stream.fd.sync()
      }
      if (!validJpeg(temporary)) throw IOException("Thumbnail JPEG is incomplete.")
      val properties = Properties().apply {
        setProperty("version", "1")
        setProperty("width", record.width.toString()); setProperty("height", record.height.toString())
        setProperty("kind", record.kind); setProperty("reusable", record.reusable.toString())
        record.durationMillis?.let { setProperty("durationMillis", it.toString()) }
        record.ownerJob?.let { setProperty("ownerJob", it) }
      }
      val encodedMetadata = ByteArrayOutputStream().use { stream -> properties.store(stream, null); stream.toByteArray() }
      if (encodedMetadata.size > metadataReserve) throw IOException("Thumbnail metadata exceeds its limit.")
      temporaryMetadata.outputStream().use { stream -> stream.write(encodedMetadata); stream.fd.sync() }
      Files.move(temporary.toPath(), image(key).toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
      Files.move(temporaryMetadata.toPath(), metadata(key).toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
      image(key)
    } catch (error: Throwable) {
      remove(key)
      throw error
    } finally { temporary.delete(); temporaryMetadata.delete() }
  }

  fun invalidateOwner(owner: String) = synchronized(guard) {
    cleanup()
    keys().filter { record(it)?.ownerJob == owner }.forEach(::remove)
  }

  fun invalidateFile(file: File) = synchronized(guard) {
    val canonical = file.canonicalFile
    val key = canonical.name.removeSuffix(".jpg")
    if (canonical.parentFile != root.canonicalFile || canonical.name != "$key.jpg" || !keyPattern.matches(key)) {
      throw OperationFailure("IO_ERROR", "The file is outside the thumbnail cache.")
    }
    remove(key)
  }

  fun remove(key: String) = synchronized(guard) { delete(image(key)); delete(metadata(key)); Unit }

  fun cleanup() = synchronized(guard) {
    root.listFiles().orEmpty().filter { it.name.endsWith(".tmp") }.forEach(::delete)
    root.listFiles().orEmpty().forEach { file ->
      val key = file.name.substringBefore('.')
      if (!keyPattern.matches(key) || record(key) == null || !validJpeg(image(key))) {
        delete(file)
        if (keyPattern.matches(key)) remove(key)
      }
    }
    trim(0, 0)
  }

  fun totalBytes(): Long = synchronized(guard) { root.listFiles().orEmpty().filter { it.isFile }.sumOf { it.length() } }
  fun entryCount(): Int = synchronized(guard) { keys().size }

  private fun trim(reserveBytes: Long, reserveEntries: Int) {
    val oldest = keys().sortedBy { metadata(it).lastModified() }.iterator()
    while ((totalBytes() + reserveBytes > limits.maxBytes || entryCount() + reserveEntries > limits.maxEntries) && oldest.hasNext()) {
      remove(oldest.next())
    }
  }

  private fun keys(): List<String> = root.listFiles().orEmpty().filter { it.name.endsWith(".properties") }
    .map { it.name.removeSuffix(".properties") }.filter(keyPattern::matches)

  private fun record(key: String): ThumbnailCacheRecord? = runCatching {
    if (metadata(key).length() !in 1..metadataReserve) return@runCatching null
    val values = Properties().apply { metadata(key).inputStream().use { load(it) } }
    val width = values.getProperty("width").toInt()
    val height = values.getProperty("height").toInt()
    val kind = values.getProperty("kind")
    if (values.getProperty("version") != "1" || width !in 1..512 || height !in 1..512 || kind !in setOf("image", "video", "pdf")) return@runCatching null
    ThumbnailCacheRecord(width, height, kind, values.getProperty("durationMillis")?.toLongOrNull()?.takeIf { it >= 0 },
      values.getProperty("ownerJob"), values.getProperty("reusable") == "true")
  }.getOrNull()

  private fun validJpeg(file: File): Boolean = runCatching {
    if (file.length() !in 4..limits.maxJpegBytes) return@runCatching false
    RandomAccessFile(file, "r").use { stream ->
      val start = stream.readUnsignedShort()
      stream.seek(file.length() - 2)
      start == 0xffd8 && stream.readUnsignedShort() == 0xffd9
    }
  }.getOrDefault(false)

  private fun image(key: String) = File(root, "$key.jpg")
  private fun metadata(key: String) = File(root, "$key.properties")
  private fun delete(file: File) { if (file.exists() && !file.delete()) throw IOException("Thumbnail cache file could not be removed.") }
}
