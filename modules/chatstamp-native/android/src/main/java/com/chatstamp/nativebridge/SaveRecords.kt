package com.chatstamp.nativebridge

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.nio.channels.FileChannel
import java.nio.file.Files
import java.nio.file.NoSuchFileException
import java.nio.file.Path
import java.nio.file.StandardCopyOption.ATOMIC_MOVE
import java.nio.file.StandardCopyOption.REPLACE_EXISTING
import java.nio.file.StandardOpenOption.READ
import java.security.MessageDigest
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

internal class SaveRecords(
  directory: File,
  key: String,
  timestampFolder: Boolean,
  canonicalChatName: String,
  requestedChatFolderName: String? = null,
  requestedLabels: OutputFolderLabels? = null,
  private val syncDirectory: (Path) -> Unit = ::syncRecordDirectory
) {
  private val profile = directory.toPath().toAbsolutePath().resolve("$key.json")
  private val entries = profile.resolveSibling("$key.entries")
  val labels: OutputFolderLabels
  val chatFolderName: String
  val folder: String

  init {
    ensureDirectory(profile.parent)
    // Android AtomicFile gives a legacy backup precedence over its base file.
    val backup = profile.resolveSibling("${profile.fileName}.bak")
    if (Files.exists(backup)) {
      Files.move(backup, profile, ATOMIC_MOVE, REPLACE_EXISTING)
      syncDirectory(profile.parent)
    }
    val data = readJson(profile)
    labels = if (data == null) (requestedLabels ?: OutputFolderLabels()).safe()
      else data.optJSONObject("folderLabels")?.let(OutputFolderLabels::fromJson) ?: OutputFolderLabels()
    chatFolderName = if (data != null) cleanSegment(data.optString("chatFolderName", canonicalChatName))
      else if (requestedChatFolderName == null) cleanSegment(canonicalChatName)
      else cleanLabel(requestedChatFolderName, labels.importedChat)
    folder = if (data?.has("folder") == true) data.getString("folder") else if (timestampFolder) {
      val now = ZonedDateTime.now().format(DateTimeFormatter.ofPattern("uuuu-MM-dd HH-mm", Locale.ROOT))
      "${labels.export} $now-${key.take(8)}"
    } else ""

    if (data?.has("entryStorageVersion") == true) {
      check(data.getInt("entryStorageVersion") == 2) { "Unsupported save record version" }
      check(Files.isDirectory(entries)) { "Missing save record directory" }
    } else {
      ensureDirectory(entries)
      val metadata = data ?: JSONObject()
      if (metadata.has("entries")) {
        // The monolith remains authoritative until every shard is durable.
        // A restart before the profile rename safely repeats this migration.
        val legacy = metadata.getJSONObject("entries")
        for (id in legacy.keys()) {
          writeJson(entryPath(id), legacy.getJSONObject(id), syncParent = false)
        }
        syncDirectory(entries)
        metadata.remove("entries")
      }
      metadata.put("folder", folder).put("chatFolderName", chatFolderName)
        .put("folderLabels", labels.toJson()).put("folderProfileVersion", 1)
        .put("entryStorageVersion", 2)
      writeJson(profile, metadata)
    }
  }

  fun completed(id: String): JSONObject? = readJson(entryPath(id))?.optJSONObject("completed")
  fun writing(id: String): JSONObject? = readJson(entryPath(id))?.optJSONObject("writing")

  fun updateWriting(id: String, value: JSONObject?) {
    val path = entryPath(id)
    val entry = readJson(path) ?: JSONObject()
    writeJson(path, entry.put("writing", value))
  }

  fun complete(id: String, result: JSONObject) {
    val path = entryPath(id)
    val entry = readJson(path) ?: JSONObject()
    entry.put("completed", result).remove("writing")
    writeJson(path, entry)
  }

  private fun entryPath(id: String): Path {
    val digest = MessageDigest.getInstance("SHA-256").digest(id.toByteArray(Charsets.UTF_8))
    val name = digest.joinToString("") { (it.toInt() and 255).toString(16).padStart(2, '0') }
    return entries.resolve("$name.json")
  }

  private fun readJson(path: Path): JSONObject? = try {
    JSONObject(String(Files.readAllBytes(path), Charsets.UTF_8))
  } catch (missing: NoSuchFileException) {
    null
  }

  // ScopedMediaSaver serializes writers. A killed writer may leave .new,
  // which readers ignore and the next write to this record truncates.
  private fun writeJson(path: Path, value: JSONObject, syncParent: Boolean = true) {
    val temporary = path.resolveSibling("${path.fileName}.new")
    FileOutputStream(temporary.toFile()).use { stream ->
      stream.write(value.toString().toByteArray(Charsets.UTF_8))
      stream.fd.sync()
    }
    Files.move(temporary, path, ATOMIC_MOVE, REPLACE_EXISTING)
    if (syncParent) syncDirectory(path.parent)
  }

  private fun ensureDirectory(path: Path) {
    if (Files.isDirectory(path)) return
    ensureDirectory(path.parent)
    Files.createDirectories(path)
    syncDirectory(path.parent)
  }
}

private fun syncRecordDirectory(path: Path) {
  FileChannel.open(path, READ).use { it.force(true) }
}

data class OutputFolderLabels(
  @Field val importedChat: String = "Imported Chat",
  @Field val unknownSender: String = "Unknown sender",
  @Field val media: String = "Media",
  @Field val voice: String = "Voice notes",
  @Field val stickers: String = "Stickers",
  @Field val documents: String = "Documents",
  @Field val other: String = "Other",
  @Field val export: String = "Export"
) : Record {
  internal fun safe(): OutputFolderLabels = OutputFolderLabels(
    cleanLabel(importedChat, "Imported Chat"), cleanLabel(unknownSender, "Unknown sender"),
    cleanLabel(media, "Media"), cleanLabel(voice, "Voice notes"), cleanLabel(stickers, "Stickers"),
    cleanLabel(documents, "Documents"), cleanLabel(other, "Other"), cleanLabel(export, "Export")
  )

  internal fun toJson(): JSONObject = JSONObject().put("importedChat", importedChat).put("unknownSender", unknownSender)
    .put("media", media).put("voice", voice).put("stickers", stickers).put("documents", documents)
    .put("other", other).put("export", export)

  companion object {
    internal fun fromJson(value: JSONObject): OutputFolderLabels {
      val defaults = OutputFolderLabels()
      return OutputFolderLabels(
        value.opt("importedChat") as? String ?: defaults.importedChat,
        value.opt("unknownSender") as? String ?: defaults.unknownSender,
        value.opt("media") as? String ?: defaults.media,
        value.opt("voice") as? String ?: defaults.voice,
        value.opt("stickers") as? String ?: defaults.stickers,
        value.opt("documents") as? String ?: defaults.documents,
        value.opt("other") as? String ?: defaults.other,
        value.opt("export") as? String ?: defaults.export
      ).safe()
    }
  }
}

internal fun relativeOutputFolder(
  item: ScopedSaveItem, mode: String, labels: OutputFolderLabels, structured: Boolean
): String {
  if (!structured) return item.relativeFolder.orEmpty().split('/').filter(String::isNotBlank).joinToString("/", transform = ::cleanSegment)
  val parts = mutableListOf<String>()
  if (mode == "by-sender" || mode == "by-sender-and-type") {
    parts.add(if (item.senderName == null) labels.unknownSender else cleanSegment(cleanLabel(item.senderName, labels.importedChat)))
  }
  if (mode != "all-in-one" && mode != "by-sender") parts.add(when (item.mediaType) {
    "photo", "video" -> labels.media
    "voice", "audio" -> labels.voice
    "sticker", "gif" -> labels.stickers
    "document" -> labels.documents
    else -> labels.other
  })
  return parts.joinToString("/")
}

// Keep the original sanitizer and limit: these values feed existing per-file record keys.
internal fun cleanSegment(value: String): String = value.replace(Regex("[\\\\/:*?\"<>|\\p{Cc}]"), "_")
  .trim().trim('.').ifBlank { "Imported Chat" }.take(54)

private fun cleanLabel(value: String, fallback: String): String = value
  .replace(Regex("[\\\\/:*?\"<>|\\u0000-\\u001F]"), "_")
  .replace(Regex("[\\s\\p{Z}\\uFEFF]+"), " ")
  .trim().trim('.').ifBlank { fallback }.let(::cleanSegment)

internal fun collisionName(filename: String, suffix: String): String {
  val dot = filename.lastIndexOf('.')
  return if (dot > 0) filename.substring(0, dot) + "-$suffix" + filename.substring(dot) else "$filename-$suffix"
}

internal fun mayRemoveReplacedFile(
  bytesVerified: Boolean, hasTarget: Boolean, dateVerification: String, needsCaptureDate: Boolean
): Boolean = bytesVerified && (!hasTarget || dateVerification == "verified" ||
  (!needsCaptureDate && dateVerification == "mtime-only"))
