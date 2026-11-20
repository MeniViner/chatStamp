package com.chatstamp.nativebridge

import android.content.Context
import android.net.Uri
import java.io.File

internal data class ImportTarget(val output: File, val job: File)

internal fun importTarget(context: Context, outputDirectoryUri: String): ImportTarget {
  val uri = Uri.parse(outputDirectoryUri)
  val output = uri.path?.let(::File)?.canonicalFile ?: throw OperationFailure("IO_ERROR", "Invalid extraction directory.")
  if (uri.scheme != "file") throw OperationFailure("IO_ERROR", "Invalid extraction directory.")
  val job = jobDirectory(context, Uri.fromFile(output.parentFile).toString())
  if (output.exists() && output.listFiles().orEmpty().isNotEmpty()) {
    throw OperationFailure("IO_ERROR", "The extraction directory is already in use.")
  }
  return ImportTarget(output, job)
}
