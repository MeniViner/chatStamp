package com.chatstamp.nativebridge

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.IOException

class SaveRecordsTest {
  @get:Rule val temporary = TemporaryFolder()

  private val directory get() = temporary.root
  private val profile get() = File(directory, "archive.json")
  private val shards get() = File(directory, "archive.entries")
  // The Windows JVM cannot open directory channels. Android and Linux exercise
  // the real directory sync; Windows host tests still exercise file sync and rename.
  private fun reopen(): SaveRecords = if (File.separatorChar == '\\') {
    SaveRecords(directory, "archive", false, "Chat", syncDirectory = {})
  } else {
    SaveRecords(directory, "archive", false, "Chat")
  }

  @Test fun replacementCheckpointsSurviveReopeningAndClearingKeepsThePriorCopy() {
    val id = "folder/notes.txt"
    val previous = "content://owned/old"
    reopen().complete(id, JSONObject().put("insertedUri", previous))
    val writing = JSONObject().put("name", "notes-2.txt")
    val uri = "content://owned/new"
    for (step in 1..3) {
      if (step == 2) writing.put("uri", uri)
      if (step == 3) writing.put("expectedSize", 17)
      reopen().updateWriting(id, writing)
      val restarted = reopen()
      val checkpoint = restarted.writing(id)!!
      assertEquals("notes-2.txt", checkpoint.getString("name"))
      assertEquals(step >= 2, checkpoint.has("uri"))
      if (step >= 2) assertEquals(uri, checkpoint.getString("uri"))
      assertEquals(step >= 3, checkpoint.has("expectedSize"))
      if (step >= 3) assertEquals(17, checkpoint.getInt("expectedSize"))
      assertEquals(previous, restarted.completed(id)!!.getString("insertedUri"))
    }
    reopen().updateWriting(id, null)
    val retry = reopen()
    assertNull(retry.writing(id))
    assertEquals(previous, retry.completed(id)!!.getString("insertedUri"))

    retry.updateWriting(id, writing)
    retry.complete(id, JSONObject().put("insertedUri", uri))
    val finished = reopen()
    assertNull(finished.writing(id))
    assertEquals(uri, finished.completed(id)!!.getString("insertedUri"))
  }

  @Test fun interruptedMigrationReplaysTheLegacySnapshotBeforeCommittingTheNewProfile() {
    val done = JSONObject().put("insertedUri", "content://owned/17").put("dateVerification", "verified")
    val pending = JSONObject().put("uri", "content://owned/18").put("expectedSize", 1234)
    val entries = JSONObject().put("complete", JSONObject().put("completed", done))
      .put("replacement", JSONObject().put("completed", done).put("writing", pending))
    val legacy = JSONObject().put("folder", "Export fixed").put("chatFolderName", "Old Chat")
      .put("entries", entries).toString()
    // The monolith's AtomicFile backup is the only committed metadata. One shard
    // has already been written when the process dies, and the other is absent.
    reopen().complete("complete", JSONObject().put("insertedUri", "content://stale"))
    assertTrue(profile.delete())
    File(profile.path + ".bak").writeText(legacy)
    File(profile.path + ".new").writeText("{")
    val stale = shards.walkTopDown().single { it.isFile }
    val blocker = File(stale.path + ".new").apply { check(mkdir()) }
    File(blocker, "block").writeText("x")
    assertTrue("Migration must report a failed shard commit", runCatching { reopen() }.isFailure)
    assertEquals("The monolith is still authoritative", legacy, profile.readText())
    assertTrue(blocker.deleteRecursively())

    repeat(2) {
      val records = reopen()
      assertEquals("Export fixed", records.folder)
      assertEquals("Old Chat", records.chatFolderName)
      for (id in listOf("complete", "replacement")) {
        assertEquals("content://owned/17", records.completed(id)!!.getString("insertedUri"))
        assertEquals("verified", records.completed(id)!!.getString("dateVerification"))
      }
      assertEquals("content://owned/18", records.writing("replacement")!!.getString("uri"))
      assertEquals(1234, records.writing("replacement")!!.getInt("expectedSize"))
    }
    assertFalse(JSONObject(profile.readText()).has("entries"))
  }

  @Test fun failedDirectorySyncBeforeMigrationCommitLeavesTheLegacyProfileAuthoritative() {
    val saved = JSONObject().put("completed", JSONObject().put("insertedUri", "content://owned/old"))
    val legacy = JSONObject().put("folder", "Old export")
      .put("entries", JSONObject().put("first", saved).put("second", saved)).toString()
    profile.writeText(legacy)
    val failure = runCatching {
      SaveRecords(directory, "archive", false, "Chat", syncDirectory = { path ->
        if (path == shards.toPath()) throw IOException("Synthetic directory sync failure")
      })
    }.exceptionOrNull()
    assertEquals("Synthetic directory sync failure", failure?.message)
    assertEquals(2, shards.walkTopDown().count { it.isFile })
    assertEquals(legacy, profile.readText())
    val resumed = reopen()
    assertEquals("Old export", resumed.folder)
    for (id in listOf("first", "second")) {
      assertEquals("content://owned/old", resumed.completed(id)!!.getString("insertedUri"))
    }
    assertFalse(JSONObject(profile.readText()).has("entries"))
  }

  @Test fun tornEntryWriteOnDiskLeavesTheCommittedCheckpointRecoverable() {
    val records = reopen()
    val id = "partial"
    records.updateWriting(id, JSONObject().put("uri", "content://owned/pending"))
    val entry = shards.walkTopDown().single { it.isFile }
    File(entry.path + ".new").writeText("{\"completed\":")
    val recovered = reopen()
    assertEquals("content://owned/pending", recovered.writing(id)!!.getString("uri"))
    assertNull(recovered.completed(id))
    recovered.complete(id, JSONObject().put("insertedUri", "content://owned/pending"))
    assertNull(reopen().writing(id))
  }

  @Test fun failedCompletionDoesNotAdvanceTheLiveOrReopenedRecord() {
    val records = reopen()
    val id = "retry"
    records.complete(id, JSONObject().put("insertedUri", "content://owned/old"))
    records.updateWriting(id, JSONObject().put("uri", "content://owned/new"))
    val entry = shards.walkTopDown().single { it.isFile }
    // A non-empty directory cannot be used as the atomic writer's temporary file.
    val blocker = File(entry.path + ".new").apply { check(mkdir()) }
    File(blocker, "block").writeText("x")
    val failure = runCatching {
      records.complete(id, JSONObject().put("insertedUri", "content://owned/new"))
    }.exceptionOrNull()
    assertNotNull("A failed commit must reach the caller", failure)
    assertTrue(blocker.deleteRecursively())
    for (store in listOf(records, reopen())) {
      assertEquals("content://owned/new", store.writing(id)!!.getString("uri"))
      assertEquals("content://owned/old", store.completed(id)!!.getString("insertedUri"))
    }
  }

  @Test fun unsupportedStorageVersionDoesNotReinitializeTheProfile() {
    reopen().complete("old", JSONObject().put("insertedUri", "content://owned/old"))
    val shard = shards.walkTopDown().single { it.isFile }
    val original = shard.readText()
    val unknown = JSONObject(profile.readText()).put("entryStorageVersion", 3).toString()
    profile.writeText(unknown)
    assertTrue(runCatching { reopen() }.isFailure)
    assertEquals(unknown, profile.readText())
    assertEquals(original, shard.readText())
  }

  @Test fun corruptShardFailsClosedWithoutLosingTheOtherCompletedCopy() {
    val store = reopen()
    store.complete("broken", JSONObject().put("insertedUri", "content://owned/old"))
    val broken = shards.walkTopDown().single { it.isFile }
    store.complete("intact", JSONObject().put("insertedUri", "content://owned/good"))
    val corrupt = "{\"completed\":"
    broken.writeText(corrupt)
    val restarted = reopen()
    assertTrue(runCatching { restarted.writing("broken") }.isFailure)
    assertTrue(runCatching { restarted.completed("broken") }.isFailure)
    assertTrue(runCatching { restarted.updateWriting("broken", JSONObject()) }.isFailure)
    assertTrue(runCatching { restarted.complete("broken", JSONObject()) }.isFailure)
    assertEquals(corrupt, broken.readText())
    assertEquals("content://owned/good", restarted.completed("intact")!!.getString("insertedUri"))
  }

  @Test fun fiveThousandFourCheckpointSavesKeepWritesLocalToOneEntry() {
    val records = reopen()
    val payload = "x".repeat(1_024)
    val count = 5_000

    fun save(index: Int) {
      val id = "media/$index"
      val writing = JSONObject().put("name", "$index.jpg")
      records.updateWriting(id, writing)
      records.updateWriting(id, writing.put("uri", "content://owned/$index"))
      records.updateWriting(id, writing.put("expectedSize", 64))
      records.complete(id, JSONObject().put("index", index).put("result", payload))
    }

    save(0)
    val first = shards.walkTopDown().single { it.isFile }
    // An atomic rewrite of either file will replace this old timestamp, even if
    // its content is identical. Avoid device-dependent elapsed-time thresholds.
    val marker = 1_600_000_000_000L
    for (stable in listOf(first, profile)) assertTrue(stable.setLastModified(marker))
    for (index in 1 until count) save(index)
    val resumed = reopen()
    for (stable in listOf(first, profile)) assertEquals(stable.name, marker, stable.lastModified())
    assertEquals(count, shards.walkTopDown().count { it.isFile })
    assertTrue(directory.walkTopDown().filter { it.isFile }.all { it.length() < 2_048 })
    for (index in 0 until count) {
      assertEquals(index, resumed.completed("media/$index")!!.getInt("index"))
      assertNull(resumed.writing("media/$index"))
    }
  }
}
