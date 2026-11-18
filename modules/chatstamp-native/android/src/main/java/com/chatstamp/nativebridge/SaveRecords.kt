package com.chatstamp.nativebridge

import android.util.AtomicFile
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import org.json.JSONObject
import java.io.File
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

internal class SaveRecords(
  directory: File,
  key: String,
  timestampFolder: Boolean,
  canonicalChatName: String,
  requestedChatFolderName: String? = null,
  requestedLabels: OutputFolderLabels? = null
) {
  private val baseFile = File(directory, "$key.json")
  private val file = AtomicFile(baseFile)
  private val existing = baseFile.exists() || File(baseFile.path + ".bak").exists()
  private val data = try {
    JSONObject(file.openRead().use { it.readBytes().toString(Charsets.UTF_8) })
  } catch (error: java.io.FileNotFoundException) {
    if (existing) throw error
    JSONObject()
  }
  private val entries = if (data.has("entries")) data.getJSONObject("entries")
    else JSONObject().also { data.put("entries", it) }

  // A legacy record's English paths are part of duplicate identity.
  val labels: OutputFolderLabels = if (existing) {
    data.optJSONObject("folderLabels")?.let { OutputFolderLabels.fromJson(it) } ?: OutputFolderLabels()
  } else (requestedLabels ?: OutputFolderLabels()).safe()

  val chatFolderName: String = if (existing) {
    data.optString("chatFolderName", canonicalChatName).let(::cleanSegment)
  } else if (requestedChatFolderName == null) cleanSegment(canonicalChatName)
    else cleanLabel(requestedChatFolderName, labels.importedChat)

  val folder: String = if (data.has("folder")) data.getString("folder") else {
    if (timestampFolder) {
      val now = ZonedDateTime.now().format(DateTimeFormatter.ofPattern("uuuu-MM-dd HH-mm", Locale.ROOT))
      "${labels.export} $now-${key.take(8)}"
    } else ""
  }

  init {
    if (!directory.isDirectory) check(directory.mkdirs()) { "Could not create save records" }
    data.put("folder", folder).put("chatFolderName", chatFolderName)
      .put("folderLabels", labels.toJson()).put("folderProfileVersion", 1)
    // Pin even a failed/cancelled first attempt to this profile before creating destinations.
    persist()
  }

  fun completed(id: String): JSONObject? = entries.optJSONObject(id)?.optJSONObject("completed")
  fun writing(id: String): JSONObject? = entries.optJSONObject(id)?.optJSONObject("writing")

  fun updateWriting(id: String, value: JSONObject?) {
    entry(id).put("writing", value)
    persist()
  }

  fun complete(id: String, result: JSONObject) {
    entry(id).put("completed", result).remove("writing")
    persist()
  }

  private fun entry(id: String): JSONObject = entries.optJSONObject(id)
    ?: JSONObject().also { entries.put(id, it) }

  private fun persist() {
    val output = file.startWrite()
    try {
      output.write(data.toString().toByteArray(Charsets.UTF_8))
      file.finishWrite(output)
    } catch (error: Exception) {
      file.failWrite(output)
      throw error
    }
  }
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
