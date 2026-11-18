package com.chatstamp.nativebridge

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.DataInputStream
import java.io.File
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class SharedZipInboxTest {
  private val context: Context = InstrumentationRegistry.getInstrumentation().targetContext
  private lateinit var job: File
  private lateinit var zip: File
  private val ownedUris = mutableSetOf<String>()

  @Before fun prepare() {
    // Do not consume or discard a source that belongs to another test/session.
    assertEquals(0, SharedZipInbox.debug()["pendingCount"])
    job = File(context.cacheDir, "chatstamp/share-inbox-test-${UUID.randomUUID()}").apply { check(mkdirs()) }
    zip = File(job, "synthetic-export.zip")
    ZipOutputStream(zip.outputStream()).use {
      it.putNextEntry(ZipEntry("_chat.txt"))
      it.write("2019-02-26, 12:00 - QA Dana: Synthetic share fixture".toByteArray())
      it.closeEntry()
    }
  }

  @After fun cleanup() {
    try {
      assertEquals(0, SharedZipInbox.debug()["pendingCount"])
    } finally {
      ownedUris.forEach { SharedZipInbox.release(context, it) }
      if (::job.isInitialized) job.deleteRecursively()
    }
  }

  @Test fun ignoresDevelopmentAndNetworkViewIntentsWithoutQueueingAnImport() {
    val navigation = listOf(
      "chatstamp://expo-development-client/?url=http://localhost:8081",
      "exp://192.168.1.20:8081",
      "http://localhost:8081/index.bundle?platform=android",
      "http://192.168.1.20:8081/index.bundle?platform=android",
      "https://example.invalid/export.zip"
    )
    navigation.forEach { value ->
      SharedZipInbox.captureNew(context, Intent(Intent.ACTION_VIEW, Uri.parse(value)))
      assertEquals(false, SharedZipInbox.consume()["received"])
    }
  }

  @Test fun acceptsOriginalFileAndContentSourcesAndDeduplicatesExtraStreamWithClipData() {
    val content = FileProvider.getUriForFile(context, "${context.packageName}.ChatStampFileProvider", zip)
    listOf(Uri.fromFile(zip), content).forEach { uri ->
      val delivery = capture(uri)
      assertEquals(true, delivery["received"])
      assertEquals(uri.toString(), delivery["sourceUri"])
      assertEquals(zip.name, delivery["filename"])
      assertEquals("application/zip", delivery["mimeType"])
      assertFalse(delivery.containsKey("errorCode"))
      assertEquals(false, SharedZipInbox.consume()["received"])
    }
    assertTrue(zip.isFile)
    assertEquals(setOf(zip.name), job.listFiles()!!.map { it.name }.toSet())
  }

  @Test fun acceptsOpaqueContentNamesAndLeavesZipByteValidationToTheExtractor() {
    val opaque = File(job, "opaque-export").also { zip.copyTo(it) }
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.ChatStampFileProvider", opaque)
    val delivery = capture(uri)
    assertEquals(true, delivery["received"])
    assertEquals(uri.toString(), delivery["sourceUri"])
    assertEquals("opaque-export", delivery["filename"])
    assertFalse(delivery.containsKey("errorCode"))
    val header = ByteArray(4)
    context.contentResolver.openInputStream(uri)!!.use { DataInputStream(it).readFully(header) }
    assertEquals(listOf(0x50, 0x4b, 0x03, 0x04), header.map { it.toInt() and 255 })
  }

  @Test fun unsupportedSendSchemeProducesACodedFailureWithoutAnImportSource() {
    val delivery = capture(Uri.parse("https://example.invalid/export.zip"))
    assertEquals(true, delivery["received"])
    assertEquals("PERMISSION_LOST", delivery["errorCode"])
    assertFalse(delivery.containsKey("sourceUri"))
  }

  private fun capture(uri: Uri): Map<String, Any?> {
    if (uri.scheme in setOf("file", "content")) ownedUris.add(uri.toString())
    val intent = Intent(Intent.ACTION_SEND).apply {
      type = "application/zip"
      putExtra(Intent.EXTRA_STREAM, uri)
      clipData = ClipData.newRawUri("Synthetic ZIP", uri)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    SharedZipInbox.captureNew(context, intent)
    return SharedZipInbox.consume()
  }
}
