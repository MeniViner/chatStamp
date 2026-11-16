package com.chatstamp.nativebridge

import android.util.AtomicFile
import org.json.JSONObject
import java.io.File
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

internal class SaveRecords(directory: File, key: String, timestampFolder: Boolean) {
  private val file = AtomicFile(File(directory, "$key.json"))
  private val data = try {
    JSONObject(file.openRead().use { it.readBytes().toString(Charsets.UTF_8) })
  } catch (_: java.io.FileNotFoundException) {
    JSONObject()
  }
  private val entries = data.optJSONObject("entries") ?: JSONObject().also { data.put("entries", it) }

  val folder: String = data.optString("folder", "").ifEmpty {
    if (timestampFolder) {
      val now = ZonedDateTime.now().format(DateTimeFormatter.ofPattern("uuuu-MM-dd HH-mm", Locale.ROOT))
      "Export $now-${key.take(8)}"
    } else ""
  }

  init {
    data.put("folder", folder)
    if (!directory.isDirectory) check(directory.mkdirs()) { "Could not create save records" }
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

internal fun collisionName(filename: String, suffix: String): String {
  val dot = filename.lastIndexOf('.')
  return if (dot > 0) filename.substring(0, dot) + "-$suffix" + filename.substring(dot) else "$filename-$suffix"
}

internal fun mayRemoveReplacedFile(
  bytesVerified: Boolean, hasTarget: Boolean, dateVerification: String, needsCaptureDate: Boolean
): Boolean = bytesVerified && (!hasTarget || dateVerification == "verified" ||
  (!needsCaptureDate && dateVerification == "mtime-only"))
