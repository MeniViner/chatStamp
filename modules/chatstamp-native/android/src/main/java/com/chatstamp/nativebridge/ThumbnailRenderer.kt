package com.chatstamp.nativebridge

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ImageDecoder
import android.graphics.Matrix
import android.graphics.pdf.PdfRenderer
import android.media.MediaMetadataRetriever

internal data class RenderedThumbnail(val bitmap: Bitmap, val kind: String, val durationMillis: Long? = null)

internal fun interface ThumbnailRenderer {
  fun render(source: PreviewSource, size: Int): RenderedThumbnail
}

internal class PlatformThumbnailRenderer(private val context: Context) : ThumbnailRenderer {
  override fun render(source: PreviewSource, size: Int): RenderedThumbnail = when (source.kind) {
    "video" -> video(source, size)
    "pdf" -> pdf(source, size)
    "image" -> image(source, size)
    else -> throw IllegalArgumentException("Unsupported thumbnail source.")
  }

  private fun video(source: PreviewSource, size: Int): RenderedThumbnail {
    val retriever = MediaMetadataRetriever()
    var bitmap: Bitmap? = null
    var released = false
    try {
      retriever.setDataSource(context, source.uri)
      val duration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()?.takeIf { it >= 0 }
      val frame = retriever.getScaledFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC, size, size)
        ?: throw IllegalArgumentException("No video frame is available.")
      bitmap = frame
      retriever.release()
      released = true
      return RenderedThumbnail(frame, "video", duration)
    } catch (error: Throwable) { bitmap?.recycle(); throw error }
    finally { if (!released) runCatching { retriever.release() } }
  }

  private fun image(source: PreviewSource, size: Int): RenderedThumbnail {
    val input = ImageDecoder.createSource(context.contentResolver, source.uri)
    val bitmap = ImageDecoder.decodeBitmap(input) { decoder, info, _ ->
      val (width, height) = ThumbnailPolicy.fit(info.size.width, info.size.height, size)
      decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
      decoder.setTargetSize(width, height)
    }
    return RenderedThumbnail(bitmap, "image")
  }

  private fun pdf(source: PreviewSource, size: Int): RenderedThumbnail {
    val descriptor = context.contentResolver.openFileDescriptor(source.uri, "r")
      ?: throw IllegalArgumentException("PDF is unavailable.")
    val renderer = try { PdfRenderer(descriptor) } catch (error: Throwable) { descriptor.close(); throw error }
    renderer.use {
      if (it.pageCount < 1) throw IllegalArgumentException("PDF has no pages.")
      it.openPage(0).use { page ->
        val (width, height) = ThumbnailPolicy.fit(page.width, page.height, size)
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        try {
          bitmap.eraseColor(Color.WHITE)
          val matrix = Matrix().apply { setScale(width.toFloat() / page.width, height.toFloat() / page.height) }
          page.render(bitmap, null, matrix, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
          return RenderedThumbnail(bitmap, "pdf")
        } catch (error: Throwable) { bitmap.recycle(); throw error }
      }
    }
  }
}

internal fun opaqueThumbnail(bitmap: Bitmap): Bitmap {
  if (!bitmap.hasAlpha()) return bitmap
  val opaque = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
  try {
    Canvas(opaque).apply { drawColor(Color.WHITE); drawBitmap(bitmap, 0f, 0f, null) }
    opaque.setHasAlpha(false)
    return opaque
  } catch (error: Throwable) { opaque.recycle(); throw error }
}
