package com.chatstamp.nativebridge

import android.content.ContentResolver
import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.BaseColumns
import android.provider.MediaStore
import android.provider.MediaStore.MediaColumns
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.io.File
import java.security.MessageDigest
import java.util.UUID

class SaveFolderProfileTest {
  private val context: Context = InstrumentationRegistry.getInstrumentation().targetContext
  private val hebrew = OutputFolderLabels("שיחה מיובאת", "שולח לא ידוע", "מדיה", "הודעות קוליות", "מדבקות", "מסמכים", "אחר", "ייצוא")
  private lateinit var job: File
  private lateinit var chat: String
  private val created = mutableSetOf<Uri>()
  private val records = mutableSetOf<File>()
  private val nativeRecords get() = File(context.filesDir, "chatstamp-store/save-records")

  @Before fun prepare() {
    chat = "chatstamp-e-" + UUID.randomUUID().toString().take(8)
    job = File(context.cacheDir, "chatstamp/$chat").apply { check(mkdirs()) }
  }

  @After fun cleanup() {
    created.forEach { context.contentResolver.delete(it, null, null) }
    records.forEach { it.delete(); File(it.path + ".bak").delete(); File(it.path + ".new").delete() }
    job.deleteRecursively()
  }

  @Test fun profileAndLocalizedTimestampAreDurableBeforeAnyFileIsSaved() {
    val directory = File(job, "records")
    val first = SaveRecords(directory, "new", true, chat, "$chat עברית", hebrew)
    assertTrue(File(directory, "new.json").isFile)
    assertTrue(first.folder.startsWith("ייצוא "))
    val reopened = SaveRecords(directory, "new", true, chat, "$chat English", OutputFolderLabels())
    assertEquals(first.folder, reopened.folder)
    assertEquals("$chat עברית", reopened.chatFolderName)
    assertEquals(hebrew, reopened.labels)
  }

  @Test fun oldRecordRetainsItsEmptyOrNamedExportFolderAndCompletedPath() {
    val directory = File(job, "records").apply { check(mkdirs()) }
    for ((index, folder) in listOf("", "Export 2019-02-15 10-30-oldkey").withIndex()) {
      val oldPath = "Pictures/chatStamp/$chat/$folder/Dana/Media/photo.jpg"
      File(directory, "legacy$index.json").writeText(JSONObject().put("folder", folder)
        .put("entries", JSONObject().put("old-entry-key", JSONObject().put("completed", JSONObject()
          .put("outputPath", oldPath).put("insertedUri", "content://media/owned/11")))).toString())
      val migrated = SaveRecords(directory, "legacy$index", true, chat, "עברית", hebrew)
      assertEquals(folder, migrated.folder)
      assertEquals(chat, migrated.chatFolderName)
      assertEquals(OutputFolderLabels(), migrated.labels)
      assertEquals(oldPath, migrated.completed("old-entry-key")!!.getString("outputPath"))
    }
  }

  @Test fun invalidStoredProfileFallsBackByFieldWithoutChangingItsRoot() {
    val directory = File(job, "records").apply { check(mkdirs()) }
    File(directory, "partial.json").writeText(JSONObject().put("folder", "").put("chatFolderName", chat)
      .put("folderLabels", JSONObject().put("media", "../Media").put("voice", " "))
      .put("entries", JSONObject()).toString())
    val profile = SaveRecords(directory, "partial", false, chat, "עברית", hebrew)
    assertEquals(chat, profile.chatFolderName)
    assertEquals("_Media", profile.labels.media)
    assertEquals("Voice notes", profile.labels.voice)
    assertEquals("Documents", profile.labels.documents)
  }

  @Test fun unreadableExistingRecordIsNotReplacedWithAnEmptyProfile() {
    val directory = File(job, "records").apply { check(mkdirs()) }
    val record = File(directory, "broken.json").apply { writeText("{\"entries\":") }
    val original = record.readText()
    val error = runCatching { SaveRecords(directory, "broken", true, chat, "עברית", hebrew) }.exceptionOrNull()
    assertNotNull(error)
    assertEquals(original, record.readText())
  }

  @Test fun legacyMediaStoreRecordKeepsTheSameUriWhenTheLanguageChanges() = runBlocking {
    val file = File(job, "notes.txt").apply { writeText("Legacy record transport") }
    val options = options().copy(organizationMode = "by-sender-and-type", timestampFolder = true)
    val old = ScopedSaveItem("entry", Uri.fromFile(file).toString(), file.name, "document", "text/plain", relativeFolder = "Dana/Documents")
    val saved = save(listOf(old), options).single()
    val recordFile = legacyRecordFile(options)
    assertTrue(recordFile.isFile)
    val data = JSONObject(recordFile.readText()).apply {
      remove("folderLabels"); remove("chatFolderName"); remove("folderProfileVersion")
    }
    val exportFolder = data.getString("folder")
    assertTrue(exportFolder.startsWith("Export "))
    val expectedDirectory = "Documents/chatStamp/$chat/$exportFolder/Dana/Documents"
    assertEquals("${Environment.getExternalStorageDirectory().absolutePath}/$expectedDirectory", saved["outputDirectory"])
    assertMediaStoreRows("$expectedDirectory/", setOf("notes.txt"))
    recordFile.writeText(data.toString())
    val repeated = save(listOf(old.copy(relativeFolder = null, senderName = "Dana")), options.copy(
      folderLabels = hebrew, chatFolderName = "$chat עברית")).single()
    assertEquals("skipped", repeated["outcome"])
    assertEquals(saved["insertedUri"], repeated["insertedUri"])
    assertEquals(saved["outputDirectory"], repeated["outputDirectory"])
    assertEquals("${Environment.getExternalStorageDirectory().absolutePath}/$expectedDirectory", repeated["outputDirectory"])
    assertMediaStoreRows("$expectedDirectory/", setOf("notes.txt"))
  }

  @Test fun partialHebrewExportKeepsItsProfileForCompletedAndNewEntries() = runBlocking {
    val first = File(job, "first.txt").apply { writeText("First") }
    val second = File(job, "second.txt").apply { writeText("Second") }
    val options = options().copy(folderLabels = hebrew, chatFolderName = "$chat עברית",
      organizationMode = "by-sender-and-type", timestampFolder = true)
    val a = ScopedSaveItem("a", Uri.fromFile(first).toString(), first.name, "document", "text/plain")
    val b = ScopedSaveItem("b", Uri.fromFile(second).toString(), second.name, "document", "text/plain")
    val saved = save(listOf(a), options).single()
    val exportFolder = JSONObject(legacyRecordFile(options).readText()).getString("folder")
    assertTrue(exportFolder.startsWith("ייצוא "))
    val expectedDirectory = "Documents/chatStamp/$chat עברית/$exportFolder/שולח לא ידוע/מסמכים"
    assertEquals("${Environment.getExternalStorageDirectory().absolutePath}/$expectedDirectory", saved["outputDirectory"])
    assertMediaStoreRows("$expectedDirectory/", setOf("first.txt"))
    val repeated = save(listOf(a, b), options.copy(folderLabels = OutputFolderLabels(), chatFolderName = "$chat English"))
    assertEquals("skipped", repeated[0]["outcome"])
    assertEquals(saved["insertedUri"], repeated[0]["insertedUri"])
    assertEquals("saved", repeated[1]["outcome"])
    assertEquals(saved["outputDirectory"], repeated[1]["outputDirectory"])
    repeated.forEach { assertEquals("${Environment.getExternalStorageDirectory().absolutePath}/$expectedDirectory", it["outputDirectory"]) }
    assertMediaStoreRows("$expectedDirectory/", setOf("first.txt", "second.txt"))
  }

  @Test fun firstFailedAttemptStillKeepsItsChosenProfileForRetry() = runBlocking {
    val file = File(job, "retry.txt")
    val item = ScopedSaveItem("retry", Uri.fromFile(file).toString(), file.name, "document", "text/plain")
    val options = options().copy(folderLabels = hebrew, chatFolderName = "$chat עברית", organizationMode = "by-type")
    val failed = save(listOf(item), options).single()
    assertEquals("failed", failed["outcome"])
    assertEquals("מדיה", OutputFolderLabels.fromJson(JSONObject(legacyRecordFile(options).readText()).getJSONObject("folderLabels")).media)
    val expectedDirectory = "Documents/chatStamp/$chat עברית/מסמכים"
    assertMediaStoreRows("$expectedDirectory/", emptySet())
    file.writeText("Retry uses original profile")
    val retried = save(listOf(item), options.copy(folderLabels = OutputFolderLabels(), chatFolderName = "$chat English")).single()
    assertEquals("saved", retried["outcome"])
    assertEquals("${Environment.getExternalStorageDirectory().absolutePath}/$expectedDirectory", retried["outputDirectory"])
    assertMediaStoreRows("$expectedDirectory/", setOf("retry.txt"))
  }

  @Test fun serviceInputRoundTripsNewLabelsAndAcceptsOldRelativeFolders() {
    val item = ScopedSaveItem("entry", "file:///cache/item", "item.txt", "document", "text/plain", senderName = "Dana")
    val options = options().copy(folderLabels = hebrew, chatFolderName = "$chat עברית")
    val json = SaveForegroundService.encodeInput(listOf(item), options)
    val decoded = SaveForegroundService.decodeInput(json)
    assertEquals("Dana", decoded.first.single().senderName)
    assertEquals(hebrew, decoded.second.folderLabels)
    assertEquals(options.chatFolderName, decoded.second.chatFolderName)
    json.getJSONArray("items").getJSONObject(0).apply { remove("senderName"); put("relativeFolder", "Dana/Documents") }
    json.getJSONObject("options").apply { remove("folderLabels"); remove("chatFolderName"); put("alwaysUseMessageDate", false) }
    val legacy = SaveForegroundService.decodeInput(json)
    assertEquals("Dana/Documents", legacy.first.single().relativeFolder)
    assertNull(legacy.second.folderLabels)
    assertFalse(legacy.second.alwaysUseMessageDate)
  }

  private fun options(): ScopedSaveOptions {
    val fingerprint = MessageDigest.getInstance("SHA-256").digest(chat.toByteArray()).joinToString("") { "%02x".format(it) }
    return ScopedSaveOptions(fingerprint, chat, operationId = "$chat-save", workingDirectory = Uri.fromFile(job).toString(),
      notificationTitle = "Saving test files", notificationCancelLabel = "Cancel")
  }

  private fun legacyRecordFile(options: ScopedSaveOptions): File {
    val legacyIdentity = JSONArray(listOf(options.archiveFingerprint, options.treeUri, chat, options.organizationMode, options.timestampFolder)).toString()
    val key = MessageDigest.getInstance("SHA-256").digest(legacyIdentity.toByteArray()).joinToString("") { "%02x".format(it) }
    return File(nativeRecords, "$key.json")
  }

  private fun assertMediaStoreRows(expectedPath: String, expectedNames: Set<String>) {
    val collection = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
    val columns = arrayOf(BaseColumns._ID, MediaColumns.RELATIVE_PATH, MediaColumns.DISPLAY_NAME, MediaColumns.IS_PENDING)
    val args = Bundle().apply {
      putInt(MediaStore.QUERY_ARG_MATCH_PENDING, MediaStore.MATCH_INCLUDE)
      putString(ContentResolver.QUERY_ARG_SQL_SELECTION, "${MediaColumns.RELATIVE_PATH} LIKE ? AND ${MediaColumns.OWNER_PACKAGE_NAME}=?")
      putStringArray(ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS, arrayOf("%/chatStamp/$chat%", context.packageName))
    }
    val rows = mutableListOf<Triple<String, String, Int>>()
    val cursor = context.contentResolver.query(collection, columns, args, null)
    assertNotNull("The owned test rows must be queryable", cursor)
    cursor!!.use {
      while (it.moveToNext()) {
        created.add(ContentUris.withAppendedId(collection, it.getLong(0)))
        rows.add(Triple(it.getString(1), it.getString(2), it.getInt(3)))
      }
    }
    assertEquals("No duplicate or alternate-language rows may remain", expectedNames.size, rows.size)
    assertEquals(expectedNames, rows.map { it.second }.toSet())
    rows.forEach { (path, _, pending) ->
      assertEquals(expectedPath, path)
      assertEquals("Every result must be published", 0, pending)
    }
  }

  @Suppress("UNCHECKED_CAST")
  private suspend fun save(items: List<ScopedSaveItem>, options: ScopedSaveOptions): List<Map<String, Any?>> {
    val before = nativeRecords.listFiles().orEmpty().map { it.name }.toSet()
    try {
      val result = ScopedMediaSaver(context).save(items, options)["results"] as List<Map<String, Any?>>
      result.mapNotNull { it["insertedUri"] as? String }.map(Uri::parse).forEach(created::add)
      return result
    } finally { nativeRecords.listFiles().orEmpty().filter { it.name !in before }.forEach(records::add) }
  }
}
