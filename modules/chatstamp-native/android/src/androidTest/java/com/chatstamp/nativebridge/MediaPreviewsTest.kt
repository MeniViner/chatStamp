package com.chatstamp.nativebridge

import android.content.Context
import android.content.ContextWrapper
import android.content.ContentProvider
import android.content.ContentResolver
import android.content.ContentValues
import android.content.Intent
import android.content.pm.ProviderInfo
import android.database.Cursor
import android.database.MatrixCursor
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import androidx.exifinterface.media.ExifInterface
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.io.File
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class MediaPreviewsTest {
  private val context: Context = InstrumentationRegistry.getInstrumentation().targetContext
  private lateinit var job: File
  private lateinit var extracted: File
  private lateinit var manager: ThumbnailManager

  @Before fun prepare() {
    job = File(context.cacheDir, "chatstamp/thumb-test-${UUID.randomUUID()}")
    extracted = File(job, "extracted").apply { check(mkdirs()) }
    manager = ThumbnailManager.get(context)
  }

  @After fun cleanup() {
    manager.discardJob(job)
    job.deleteRecursively()
  }

  @Test fun videoUsesBoundedJpegAndRetainsDurationOnCacheHit() = runBlocking {
    val source = File(extracted, "clip.mp4")
    context.assets.open("dated-video.mp4").use { input -> source.outputStream().use { input.copyTo(it) } }
    val first = thumbnail(source, 128)
    assertEquals("video", first["kind"])
    assertEquals(false, first["cacheHit"])
    assertTrue((first["durationMillis"] as Number).toLong() > 0)
    decoded(first).useBitmap { assertTrue(it.width <= 128 && it.height <= 128) }
    val again = thumbnail(source, 128)
    assertEquals(true, again["cacheHit"])
    assertEquals(first["uri"], again["uri"])
    assertEquals(first["durationMillis"], again["durationMillis"])
  }

  @Test fun largeImageDownsamplesAndChangedSourceInvalidatesTheKey() = runBlocking {
    val source = image("large.png", 4000, 3000, Color.RED)
    val first = thumbnail(source, 256)
    decoded(first).useBitmap { assertEquals(256, it.width); assertEquals(192, it.height) }
    val previousTime = source.lastModified()
    image(source.name, 400, 300, Color.BLUE)
    check(source.setLastModified(previousTime + 2000))
    val changed = thumbnail(source, 256)
    assertNotEquals(first["cacheKey"], changed["cacheKey"])
    assertEquals(false, changed["cacheHit"])
    decoded(changed).useBitmap { assertTrue(Color.blue(it.getPixel(10, 10)) > 220) }
  }

  @Test fun exifRotationIsAppliedBeforeSizingAndTransparentPixelsBecomeWhite() = runBlocking {
    val source = image("rotated.jpg", 320, 160, Color.RED, Bitmap.CompressFormat.JPEG)
    ExifInterface(source.path).apply {
      setAttribute(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_ROTATE_90.toString()); saveAttributes()
    }
    decoded(thumbnail(source, 128)).useBitmap { assertEquals(64, it.width); assertEquals(128, it.height) }
    val transparent = image("alpha.png", 100, 50, Color.TRANSPARENT)
    decoded(thumbnail(transparent, 128)).useBitmap {
      assertEquals(100, it.width); assertEquals(50, it.height)
      val pixel = it.getPixel(20, 20)
      assertTrue(Color.red(pixel) > 245 && Color.green(pixel) > 245 && Color.blue(pixel) > 245)
    }
  }

  @Test fun animatedGifReturnsItsFirstFrameWithoutAPlayer() = runBlocking {
    val source = File(extracted, "two-frames.gif")
    val bytes = byteArrayOf(71,73,70,56,57,97, 1,0,1,0,-128,0,0,
      -1,0,0, 0,0,-1,
      33,-7,4,0,10,0,0,0, 44,0,0,0,0,1,0,1,0,0, 2,2,68,1,0,
      33,-7,4,0,10,0,0,0, 44,0,0,0,0,1,0,1,0,0, 2,2,76,1,0,59)
    source.writeBytes(bytes)
    decoded(thumbnail(source, 128)).useBitmap {
      assertEquals(1, it.width); assertEquals(1, it.height)
      assertTrue(Color.red(it.getPixel(0, 0)) > 220)
      assertTrue(Color.blue(it.getPixel(0, 0)) < 30)
    }
  }

  @Test fun webpStickerUsesOpaqueJpeg() = runBlocking {
    val source = image("sticker.webp", 160, 80, Color.GREEN, Bitmap.CompressFormat.WEBP_LOSSLESS)
    decoded(thumbnail(source, 128)).useBitmap {
      assertEquals(128, it.width); assertEquals(64, it.height)
      assertTrue(Color.green(it.getPixel(20, 20)) > 220)
    }
  }

  @Test fun pdfRendersOnlyItsFirstPageAndClosesSourceForDeletion() = runBlocking {
    val source = File(extracted, "two-pages.pdf")
    val document = PdfDocument()
    try {
      for ((index, color) in listOf(Color.RED, Color.BLUE).withIndex()) {
        val page = document.startPage(PdfDocument.PageInfo.Builder(400, 600, index + 1).create())
        page.canvas.drawColor(color)
        document.finishPage(page)
      }
      source.outputStream().use(document::writeTo)
    } finally { document.close() }
    val result = thumbnail(source, 128)
    assertEquals("pdf", result["kind"])
    decoded(result).useBitmap {
      assertTrue(it.width <= 128 && it.height == 128)
      assertTrue(Color.red(it.getPixel(it.width / 2, it.height / 2)) > 220)
    }
    assertTrue(source.delete())
    assertEquals(false, manager.get(Uri.fromFile(source).toString(), 128)["available"])
  }

  @Test fun invalidAndUnsupportedInputsRemainNonfatalAndLeaveNoPartials() = runBlocking {
    val corrupt = File(extracted, "broken.pdf").apply { writeText("Not a PDF") }
    val result = manager.get(Uri.fromFile(corrupt).toString(), 128)
    assertEquals(false, result["available"])
    assertEquals("decode-failed", result["reason"])
    val document = File(extracted, "document.docx").apply { writeText("Synthetic document") }
    assertEquals("unsupported", manager.get(Uri.fromFile(document).toString(), 128)["reason"])
    assertEquals(false, manager.get("https://example.invalid/video.mp4", 128)["available"])
    assertFalse(File(context.cacheDir, "chatstamp-thumbnails").listFiles().orEmpty().any { it.name.endsWith(".tmp") })
  }

  @Test fun releaseImportPurgesDerivedFilesBeforeDeletingItsSource() = runBlocking {
    val source = image("release.png", 40, 40, Color.RED)
    val result = thumbnail(source, 64)
    val cached = File(Uri.parse(result["uri"] as String).path!!)
    assertTrue(cached.isFile)
    NativeOperations.releaseImport(context, job.name, Uri.fromFile(job).toString(), "")
    assertFalse(job.exists())
    assertFalse(cached.exists())
  }

  @Test fun explicitInvalidationRegeneratesMissingAndCorruptJpegs() = runBlocking {
    val source = image("recover.png", 100, 50, Color.RED)
    val first = thumbnail(source, 64)
    val cached = File(Uri.parse(first["uri"] as String).path!!)
    val bytes = cached.readBytes()
    val scan = (0 until bytes.size - 3).first { bytes[it] == (-1).toByte() && bytes[it + 1] == 0xda.toByte() }
    val headerLength = ((bytes[scan + 2].toInt() and 255) shl 8) or (bytes[scan + 3].toInt() and 255)
    val bodyStart = scan + 2 + headerLength
    check(bodyStart < bytes.size - 2)
    bytes.fill((-1).toByte(), bodyStart, bytes.size - 2)
    cached.writeBytes(bytes)
    manager.invalidate(first["uri"] as String)
    assertFalse(cached.exists())
    assertFalse(File(cached.parentFile, "${first["cacheKey"]}.properties").exists())
    val repaired = thumbnail(source, 64)
    assertEquals(false, repaired["cacheHit"])
    decoded(repaired).useBitmap { assertTrue(Color.red(it.getPixel(10, 10)) > 220) }
    val removed = File(Uri.parse(repaired["uri"] as String).path!!)
    assertTrue(removed.delete())
    manager.invalidate(repaired["uri"] as String)
    manager.invalidate(repaired["uri"] as String)
    assertEquals(false, thumbnail(source, 64)["cacheHit"])
  }

  @Test fun thumbnailInvalidationRejectsArbitraryPrivatePaths() {
    val private = File(context.filesDir, "thumb-invalidate-${UUID.randomUUID()}.json").apply { writeText("keep") }
    try {
      for (uri in listOf(Uri.fromFile(private).toString(), "content://chatstamp.preview.fixture/file.jpg",
          Uri.fromFile(File(context.cacheDir, "chatstamp-thumbnails/arbitrary.jpg")).toString())) {
        try { manager.invalidate(uri); fail("Invalid thumbnail deletion accepted") }
        catch (error: OperationFailure) { assertEquals("IO_ERROR", error.code) }
      }
      assertEquals("keep", private.readText())
    } finally { private.delete() }
  }

  @Test fun activeLateRendererCannotPublishAfterDiscard() = runBlocking {
    val started = CountDownLatch(1)
    val finish = CountDownLatch(1)
    val source = File(extracted, "slow.png").apply { writeText("Synthetic renderer boundary") }
    val controlled = ThumbnailManager(context, renderer = ThumbnailRenderer { _, _ ->
      started.countDown()
      check(finish.await(5, TimeUnit.SECONDS))
      RenderedThumbnail(Bitmap.createBitmap(40, 40, Bitmap.Config.ARGB_8888), "image")
    })
    val request = async(Dispatchers.IO) { controlled.get(Uri.fromFile(source).toString(), 64) }
    try {
      assertTrue(started.await(5, TimeUnit.SECONDS))
      val stopped = controlled.discardJob(job)
      job.deleteRecursively()
      finish.countDown()
      try { request.await(); fail("Discarded active work returned a thumbnail") }
      catch (_: CancellationException) { }
      stopped.forEach { it.join() }
      assertFalse(job.exists())
      val owner = job.canonicalPath
      assertFalse(File(context.cacheDir, "chatstamp-thumbnails").listFiles().orEmpty()
        .filter { it.extension == "properties" }.any { it.readText().contains(owner) })
    } finally { finish.countDown(); controlled.cancelAll() }
  }

  @Test fun externalOpenUsesNarrowFileProviderAndReadOnlyGrant() {
    val file = File(extracted, "contact.vcf").apply { writeText("BEGIN:VCARD\nFN:QA Dana\nTEL:000000\nEND:VCARD\n") }
    val intent = ExternalFileOpener(context).intent(PreviewFileRecord().apply {
      uri = Uri.fromFile(file).toString(); filename = file.name; mimeType = "text/x-vcard"
    })
    assertEquals(Intent.ACTION_VIEW, intent.action)
    assertEquals("content", intent.data!!.scheme)
    assertEquals("${context.packageName}.ChatStampFileProvider", intent.data!!.authority)
    assertEquals(intent.data, intent.clipData!!.getItemAt(0).uri)
    assertTrue(intent.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION != 0)
    assertEquals(0, intent.flags and (Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
      Intent.FLAG_GRANT_PREFIX_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION))
    assertEquals(file.readText(), context.contentResolver.openInputStream(intent.data!!)!!.bufferedReader().use { it.readText() })
  }

  @Test fun externalOpenRefusesPrivatePathsAndReportsNoHandler() = runBlocking {
    val private = File(context.filesDir, "thumb-test-${UUID.randomUUID()}.json").apply { writeText("private") }
    try {
      val denied = ExternalFileOpener(context).open(PreviewFileRecord().apply { uri = Uri.fromFile(private).toString() })
      assertEquals(false, denied["opened"])
      assertEquals("invalid-uri", denied["reason"])
      val link = File(extracted, "private-link.pdf")
      android.system.Os.symlink(private.path, link.path)
      val linked = ExternalFileOpener(context).open(PreviewFileRecord().apply { uri = Uri.fromFile(link).toString() })
      assertEquals("invalid-uri", linked["reason"])
    } finally { private.delete() }
    val file = image("no-handler.png", 10, 10, Color.RED)
    var launched = false
    val missing = ExternalFileOpener(context, hasHandler = { false }, launch = { launched = true })
      .open(PreviewFileRecord().apply { uri = Uri.fromFile(file).toString() })
    assertEquals("no-handler", missing["reason"])
    assertFalse(launched)
  }

  @Test fun mainReleaseBarrierRunsAfterEarlierMainCallbacks() = runBlocking {
    val order = java.util.concurrent.CopyOnWriteArrayList<String>()
    val main = Handler(Looper.getMainLooper())
    main.post { order.add("release-one") }
    main.post { order.add("release-two") }
    awaitMediaRelease()
    assertEquals(listOf("release-one", "release-two"), order.toList())
  }

  @Test fun revokedContentGrantDoesNotReturnPreviouslyCachedData() = runBlocking {
    val file = image("granted.png", 40, 40, Color.GREEN)
    val provider = FixtureProvider(file, "image/png", pipe = false)
    val controlled = ThumbnailManager(providerContext(provider))
    val first = controlled.get("content://chatstamp.preview.fixture/granted.png", 64)
    assertEquals(true, first["available"])
    try {
      provider.allowRead = false
      val revoked = controlled.get("content://chatstamp.preview.fixture/granted.png", 64)
      assertEquals(false, revoked["available"])
      assertEquals("unreadable", revoked["reason"])
    } finally { removeResult(first); controlled.cancelAll() }
  }

  @Test fun nonseekablePdfFallsBackWithoutCopyingTheSource() = runBlocking {
    val file = File(extracted, "streamed.pdf")
    val document = PdfDocument()
    try {
      val page = document.startPage(PdfDocument.PageInfo.Builder(40, 40, 1).create())
      page.canvas.drawColor(Color.RED); document.finishPage(page)
      file.outputStream().use(document::writeTo)
    } finally { document.close() }
    val provider = FixtureProvider(file, "application/pdf", pipe = true)
    val controlled = ThumbnailManager(providerContext(provider))
    val before = File(context.cacheDir, "chatstamp-thumbnails").listFiles().orEmpty().map { it.name }.toSet()
    try {
      val result = controlled.get("content://chatstamp.preview.fixture/streamed.pdf", 64)
      assertEquals(false, result["available"])
      assertEquals("decode-failed", result["reason"])
      val after = File(context.cacheDir, "chatstamp-thumbnails").listFiles().orEmpty().map { it.name }.toSet()
      assertEquals(before, after)
      assertEquals(listOf("streamed.pdf"), extracted.listFiles().orEmpty().map { it.name })
    } finally { controlled.cancelAll() }
  }

  @Test fun unknownProviderModificationTimeCannotReuseAPersistentHit() = runBlocking {
    val file = image("unknown-version.png", 10, 10, Color.GREEN)
    val provider = FixtureProvider(file, "image/png", pipe = true)
    val controlled = ThumbnailManager(providerContext(provider), renderer = ThumbnailRenderer { _, _ ->
      RenderedThumbnail(Bitmap.createBitmap(10, 10, Bitmap.Config.ARGB_8888), "image")
    })
    val results = mutableListOf<Map<String, Any?>>()
    try {
      repeat(2) { results.add(controlled.get("content://chatstamp.preview.fixture/unknown-version.png", 64)) }
      assertTrue(results.all { it["available"] == true && it["cacheHit"] == false })
      assertNotEquals(results[0]["cacheKey"], results[1]["cacheKey"])
    } finally { results.forEach(::removeResult); controlled.cancelAll() }
  }

  private suspend fun thumbnail(file: File, size: Int): Map<String, Any?> = manager.get(Uri.fromFile(file).toString(), size).also {
    assertEquals("Thumbnail unavailable for ${file.name}: $it", true, it["available"])
  }

  private fun decoded(result: Map<String, Any?>): Bitmap = BitmapFactory.decodeFile(Uri.parse(result["uri"] as String).path)
    ?: error("Unreadable JPEG")

  private fun image(name: String, width: Int, height: Int, color: Int,
                    format: Bitmap.CompressFormat = Bitmap.CompressFormat.PNG): File {
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    return try {
      bitmap.eraseColor(color)
      File(extracted, name).also { file -> file.outputStream().use { check(bitmap.compress(format, 100, it)) } }
    } finally { bitmap.recycle() }
  }

  private inline fun <T> Bitmap.useBitmap(block: (Bitmap) -> T): T = try { block(this) } finally { recycle() }

  private fun removeResult(result: Map<String, Any?>) {
    val key = result["cacheKey"] as? String ?: return
    ThumbnailDiskCache(File(context.cacheDir, "chatstamp-thumbnails")).remove(key)
  }

  private fun providerContext(provider: FixtureProvider): Context {
    provider.attachInfo(context, ProviderInfo().apply { authority = "chatstamp.preview.fixture"; exported = false })
    val resolver = ContentResolver.wrap(provider)
    return object : ContextWrapper(context) {
      override fun getApplicationContext(): Context = this
      override fun getContentResolver(): ContentResolver = resolver
    }
  }

  private class FixtureProvider(private val file: File, private val type: String, private val pipe: Boolean) : ContentProvider() {
    @Volatile var allowRead = true
    override fun onCreate() = true
    override fun getType(uri: Uri): String = type
    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor {
      val columns = projection ?: arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
      return MatrixCursor(columns).apply { addRow(columns.map { column -> when (column) {
        OpenableColumns.DISPLAY_NAME -> file.name
        OpenableColumns.SIZE -> file.length()
        else -> null
      } }.toTypedArray()) }
    }
    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
      if (!allowRead) throw SecurityException("Synthetic grant revoked")
      check(mode == "r")
      if (!pipe) return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
      val ends = ParcelFileDescriptor.createPipe()
      Thread {
        runCatching { ParcelFileDescriptor.AutoCloseOutputStream(ends[1]).use { output -> file.inputStream().use { it.copyTo(output) } } }
      }.apply { isDaemon = true; start() }
      return ends[0]
    }
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
  }
}
