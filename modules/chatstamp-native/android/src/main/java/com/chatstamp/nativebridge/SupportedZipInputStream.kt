package com.chatstamp.nativebridge

import java.io.InputStream
import org.apache.commons.compress.archivers.zip.ZipArchiveInputStream

/** Reject optional codecs before Commons Compress constructs them in nextEntry. */
internal class SupportedZipInputStream(input: InputStream) : ZipArchiveInputStream(input, "UTF-8", true, false) {
  override fun createZstdInputStream(inputStream: InputStream): InputStream {
    throw OperationFailure("ZIP_INVALID", "The ZIP uses unsupported compression.")
  }
}
