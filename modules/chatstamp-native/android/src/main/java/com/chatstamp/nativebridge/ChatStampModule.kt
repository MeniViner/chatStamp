package com.chatstamp.nativebridge

import android.app.Activity
import android.content.ClipData
import android.content.ContentResolver
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Parcelable
import android.provider.BaseColumns
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.provider.OpenableColumns
import androidx.core.content.FileProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.util.Locale
import java.util.UUID
import java.util.zip.ZipInputStream

private const val OPEN_DOCUMENT_TREE_REQUEST = 9401
private const val SHARE_CACHE_FOLDER = "shared-zips"
private const val ZIP_SAMPLE_LIMIT = 20
private const val TRANSCRIPT_SAMPLE_BYTES = 64 * 1024

class ChatStampModule : Module() {
  private var pendingFolderPromise: Promise? = null
  private var lastConsumedIntentSignature: String? = null

  private val context: Context
    get() = appContext.reactContext ?: appContext.throwingActivity.applicationContext

  override fun definition() = ModuleDefinition {
    Name("ChatStampNative")

    AsyncFunction("extractSupportedZipEntriesAsync") Coroutine { zipUri: String, outputDirectoryUri: String ->
      extractSupportedZipEntries(zipUri, outputDirectoryUri)
    }

    AsyncFunction("getPendingSharedZipAsync") {
      resolveShareIntent(consume = false)
    }

    AsyncFunction("consumePendingSharedZipAsync") {
      resolveShareIntent(consume = true)
    }

    AsyncFunction("getShareIntentDebugStatusAsync") {
      val intent = appContext.currentActivity?.intent
      mapOf(
        "hasActivity" to (appContext.currentActivity != null),
        "action" to intent?.action,
        "type" to intent?.type,
        "data" to intent?.dataString,
        "extras" to intent?.extras?.keySet()?.sorted(),
        "lastConsumedIntentSignature" to lastConsumedIntentSignature
      )
    }

    AsyncFunction("saveMediaAsync") Coroutine { items: List<ScopedSaveItem>, options: ScopedSaveOptions ->
      ScopedMediaSaver(context).save(items, options)
    }

    AsyncFunction("openOutputFolderPickerAsync") { promise: Promise ->
      if (pendingFolderPromise != null) {
        promise.reject("ERR_FOLDER_PICKER_BUSY", "A folder picker is already open.", null)
        return@AsyncFunction
      }
      pendingFolderPromise = promise
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
      }
      appContext.throwingActivity.startActivityForResult(intent, OPEN_DOCUMENT_TREE_REQUEST)
    }

    AsyncFunction("openFolderTargetAsync") { target: FolderTarget ->
      openFolderTarget(target)
    }

    AsyncFunction("shareOutputFilesAsync") { files: List<ShareOutputFile> ->
      shareOutputFiles(files)
    }

    AsyncFunction("deleteOutputFilesAsync") Coroutine { files: List<DeleteOutputFile> ->
      deleteOutputFiles(files)
    }

    AsyncFunction("openScannedMediaAsync") { contentUri: String, mimeType: String? ->
      openScannedMedia(contentUri, mimeType)
    }

    OnActivityResult { _, (requestCode, resultCode, intent) ->
      if (requestCode != OPEN_DOCUMENT_TREE_REQUEST || pendingFolderPromise == null) return@OnActivityResult
      val promise = pendingFolderPromise
      pendingFolderPromise = null

      if (resultCode != Activity.RESULT_OK || intent?.data == null) {
        promise?.resolve(null)
        return@OnActivityResult
      }

      val uri = intent.data!!
      val flags = intent.flags and (
        Intent.FLAG_GRANT_READ_URI_PERMISSION or
          Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
          Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
        )
      try {
        context.contentResolver.takePersistableUriPermission(
          uri,
          flags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        )
      } catch (_: Exception) {
        // Some providers grant transient access only. Return the folder so JS can surface the limitation.
      }

      promise?.resolve(
        mapOf(
          "treeUri" to uri.toString(),
          "displayName" to readableTreeName(uri),
          "persistedPermission" to hasPersistedPermission(uri),
          "readablePathLabel" to readableTreeLabel(uri)
        )
      )
    }
  }

  private fun extractSupportedZipEntries(zipUriString: String, outputDirectoryUri: String): Map<String, Any?> {
    val outputDirectory = fileFromUriString(outputDirectoryUri)
    outputDirectory.mkdirs()

    val mediaFiles = mutableListOf<Map<String, Any?>>()
    val txtCandidates = mutableListOf<TxtCandidate>()
    var skipped = 0
    val usedNames = mutableSetOf<String>()

    openInputStream(zipUriString).use { rawInput ->
      ZipInputStream(BufferedInputStream(rawInput)).use { zip ->
        while (true) {
          val entry = zip.nextEntry ?: break
          val entryName = entry.name ?: ""
          if (entry.isDirectory || isUnsafeZipPath(entryName)) {
            skipped += 1
            zip.closeEntry()
            continue
          }

          val extension = extensionOf(entryName)
          if (extension == "txt") {
            val filename = basename(entryName).ifBlank { "_chat.txt" }
            val tempFile = uniqueFile(outputDirectory, "txt-${UUID.randomUUID()}-${sanitizeFilename(filename)}", mutableSetOf())
            FileOutputStream(tempFile).use { out -> zip.copyTo(out) }
            val sample = readTextSample(tempFile)
            txtCandidates.add(TxtCandidate(filename, entryName, tempFile, sample, scoreTranscript(filename, sample)))
          } else if (isSupportedMediaExtension(extension)) {
            val filename = basename(entryName).ifBlank { "whatsapp-media.$extension" }
            val outputFile = uniqueFile(outputDirectory, sanitizeFilename(filename), usedNames)
            FileOutputStream(outputFile).use { out -> zip.copyTo(out) }
            mediaFiles.add(
              mapOf(
                "filename" to filename,
                "uri" to Uri.fromFile(outputFile).toString(),
                "sourcePath" to entryName
              )
            )
          } else {
            skipped += 1
          }
          zip.closeEntry()
        }
      }
    }

    val selected = chooseTranscript(txtCandidates)
    txtCandidates
      .filter { it !== selected }
      .forEach { it.tempFile.delete() }

    val transcriptCandidates = txtCandidates.map {
      mapOf(
        "filename" to it.filename,
        "sourcePath" to it.sourcePath,
        "score" to it.score.score,
        "messageLineCount" to it.score.messageLineCount,
        "selected" to (it === selected),
        "reason" to it.score.reason
      )
    }

    val extractedCount = mediaFiles.size + if (selected != null) 1 else 0
    return mapOf(
      "chatFileUri" to selected?.tempFile?.let { Uri.fromFile(it).toString() },
      "chatFilename" to selected?.filename,
      "txtFiles" to txtCandidates.map { it.filename },
      "transcriptCandidates" to transcriptCandidates,
      "mediaFiles" to mediaFiles,
      "extractedCount" to extractedCount,
      "skippedCount" to skipped + txtCandidates.count { it !== selected },
      "extractionMode" to "native-selective"
    )
  }

  private fun resolveShareIntent(consume: Boolean): Map<String, Any?> {
    val activity = appContext.currentActivity ?: return mapOf("received" to false)
    val intent = activity.intent ?: return mapOf("received" to false)
    val signature = intentSignature(intent)

    if (!isRelevantShareIntent(intent)) return mapOf("received" to false)
    if (consume && signature == lastConsumedIntentSignature) return mapOf("received" to false)

    val candidates = urisFromIntent(intent)
    if (candidates.isEmpty()) {
      if (consume) clearShareIntent(activity, signature)
      return mapOf(
        "received" to true,
        "sourceAction" to intent.action,
        "mimeType" to intent.type,
        "validZip" to false,
        "error" to "No ZIP file URI was provided by Android."
      )
    }

    var lastError: Map<String, Any?>? = null
    for (uri in candidates) {
      val result = copyAndValidateSharedZip(intent, uri)
      if (result["copiedUri"] != null) {
        if (consume) clearShareIntent(activity, signature)
        return result
      }
      lastError = result
    }

    if (consume) clearShareIntent(activity, signature)
    return lastError ?: mapOf("received" to true, "validZip" to false, "error" to "The shared file could not be opened.")
  }

  private fun copyAndValidateSharedZip(intent: Intent, sourceUri: Uri): Map<String, Any?> {
    val details = readUriDetails(sourceUri)
    val displayName = details.name?.takeIf { it.isNotBlank() } ?: "shared-whatsapp-export.zip"
    val safeName = ensureZipExtension(sanitizeFilename(displayName))
    val cacheDir = File(context.cacheDir, SHARE_CACHE_FOLDER).apply { mkdirs() }
    val outputFile = uniqueFile(cacheDir, "${System.currentTimeMillis()}-$safeName", mutableSetOf())

    return try {
      context.contentResolver.openInputStream(sourceUri).use { input ->
        if (input == null) throw IllegalArgumentException("Android did not grant readable access to the shared ZIP.")
        FileOutputStream(outputFile).use { out -> input.copyTo(out) }
      }
      val validation = inspectZipFile(outputFile)
      if (!validation.valid) {
        outputFile.delete()
        mapOf(
          "received" to true,
          "filename" to displayName,
          "mimeType" to (details.mimeType ?: intent.type),
          "sourceAction" to intent.action,
          "sourceUri" to sourceUri.toString(),
          "sourceSizeBytes" to details.size,
          "copiedSizeBytes" to null,
          "validZip" to false,
          "zipEntryCount" to validation.entryCount,
          "firstZipEntries" to validation.firstEntries,
          "error" to (validation.error ?: "The shared file is not a readable ZIP.")
        )
      } else {
        mapOf(
          "received" to true,
          "copiedUri" to Uri.fromFile(outputFile).toString(),
          "filename" to displayName,
          "mimeType" to (details.mimeType ?: intent.type ?: "application/zip"),
          "sourceAction" to intent.action,
          "sourceUri" to sourceUri.toString(),
          "sourceSizeBytes" to details.size,
          "copiedSizeBytes" to outputFile.length(),
          "validZip" to true,
          "zipEntryCount" to validation.entryCount,
          "firstZipEntries" to validation.firstEntries
        )
      }
    } catch (error: Throwable) {
      outputFile.delete()
      mapOf(
        "received" to true,
        "filename" to displayName,
        "mimeType" to (details.mimeType ?: intent.type),
        "sourceAction" to intent.action,
        "sourceUri" to sourceUri.toString(),
        "sourceSizeBytes" to details.size,
        "validZip" to false,
        "error" to (error.message ?: "The shared ZIP could not be copied.")
      )
    }
  }

  private fun openFolderTarget(target: FolderTarget): Map<String, Any?> {
    val exactUris = buildFolderViewUris(target)
    for (uri in exactUris) {
      if (tryOpenDirectoryUri(uri)) {
        return mapOf("opened" to true, "activity" to "ACTION_VIEW", "attempted" to uri.toString())
      }
    }

    val initialUri = exactUris.firstOrNull()
    if (initialUri != null && tryOpenDocumentNavigator(initialUri)) {
      return mapOf(
        "opened" to false,
        "reason" to "Android did not allow direct folder opening, so the folder navigator was opened at the closest location.",
        "activity" to "ACTION_OPEN_DOCUMENT_TREE",
        "attempted" to initialUri.toString(),
        "fallbackUsed" to true
      )
    }

    return mapOf(
      "opened" to false,
      "reason" to "Android does not guarantee opening arbitrary folders directly.",
      "attempted" to (target.documentUri ?: target.treeUri ?: target.path),
      "fallbackUsed" to true
    )
  }

  private fun buildFolderViewUris(target: FolderTarget): List<Uri> {
    val uris = mutableListOf<Uri>()
    target.documentUri?.takeIf { it.isNotBlank() }?.let { value ->
      runCatching { Uri.parse(value) }.getOrNull()?.let { uris.add(it) }
    }

    val treeUri = target.treeUri?.takeIf { it.isNotBlank() }?.let { value ->
      runCatching { Uri.parse(value) }.getOrNull()
    }
    val documentId = target.documentId?.takeIf { it.isNotBlank() }
      ?: target.relativeFolderDocumentId?.takeIf { it.isNotBlank() }
    if (treeUri != null && documentId != null) {
      runCatching { DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId) }
        .getOrNull()
        ?.let { uris.add(it) }
    }

    target.path?.let { publicFolderDocumentUri(it) }?.let { uris.add(it) }
    return uris.distinctBy { it.toString() }
  }

  private fun tryOpenDirectoryUri(uri: Uri): Boolean {
    val attempts = listOf(
      Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, DocumentsContract.Document.MIME_TYPE_DIR)
      },
      Intent(Intent.ACTION_VIEW).apply {
        data = uri
      }
    )
    return attempts.any { tryStartActivity(it) }
  }

  private fun tryOpenDocumentNavigator(initialUri: Uri): Boolean {
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
      putExtra(DocumentsContract.EXTRA_INITIAL_URI, initialUri)
    }
    return tryStartActivity(intent)
  }

  private fun publicFolderDocumentUri(path: String): Uri? {
    val normalized = path.replace('\\', '/').trimEnd('/')
    val prefixes = listOf(
      "/storage/emulated/0/",
      "${Environment.getExternalStorageDirectory().absolutePath.trimEnd('/')}/",
      "/sdcard/"
    )
    val prefix = prefixes.firstOrNull { normalized.startsWith(it) } ?: return null
    val relativePath = normalized.removePrefix(prefix).trim('/')
    val documentId = if (relativePath.isBlank()) "primary:" else "primary:$relativePath"
    return runCatching {
      DocumentsContract.buildDocumentUri("com.android.externalstorage.documents", documentId)
    }.getOrNull()
  }

  private fun shareOutputFiles(files: List<ShareOutputFile>): Map<String, Any?> {
    val candidates = files.take(100)
    val uris = candidates.mapNotNull(::shareUriForFile).distinct()
    if (uris.isEmpty()) return mapOf("opened" to false, "shared" to 0, "reason" to "No shareable files were available.")

    val mimeType = candidates.mapNotNull { it.mimeType }.distinct().singleOrNull() ?: "*/*"
    val intent = if (uris.size == 1) {
      Intent(Intent.ACTION_SEND).apply {
        type = mimeType
        putExtra(Intent.EXTRA_STREAM, uris.first())
      }
    } else {
      Intent(Intent.ACTION_SEND_MULTIPLE).apply {
        type = mimeType
        putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList<Parcelable>(uris))
      }
    }.apply {
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      clipData = ClipData.newUri(context.contentResolver, "chatStamp", uris.first()).also { clip ->
        uris.drop(1).forEach { clip.addItem(ClipData.Item(it)) }
      }
    }

    return try {
      context.startActivity(Intent.createChooser(intent, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      mapOf("opened" to true, "shared" to uris.size)
    } catch (error: Throwable) {
      mapOf("opened" to false, "shared" to 0, "reason" to (error.message ?: "No app could share these files."))
    }
  }

  private fun deleteOutputFiles(files: List<DeleteOutputFile>): Map<String, Any?> {
    val resolver = context.contentResolver
    val results = files.map { file ->
      val uri = file.uri?.let(Uri::parse) ?: file.path?.let(::ownedMediaUriForPath)
      val deleted = runCatching {
        when {
          uri == null -> false
          DocumentsContract.isDocumentUri(context, uri) ->
            resolver.getType(uri)?.let { it != DocumentsContract.Document.MIME_TYPE_DIR } == true &&
              DocumentsContract.deleteDocument(resolver, uri)
          uri.authority == MediaStore.AUTHORITY && uri.lastPathSegment?.toLongOrNull() != null && ownsMedia(uri) ->
            resolver.delete(uri, null, null) == 1
          else -> false
        }
      }.getOrDefault(false)
      mapOf("target" to (uri?.toString() ?: file.path), "deleted" to deleted,
        "reason" to if (deleted) null else "The file is unavailable or Android requires permission to delete it.")
    }
    return mapOf("deleted" to results.count { it["deleted"] == true },
      "failed" to results.count { it["deleted"] != true }, "results" to results)
  }

  private fun ownsMedia(uri: Uri): Boolean = context.contentResolver.query(
    uri, arrayOf(MediaStore.MediaColumns.OWNER_PACKAGE_NAME), null, null, null
  )?.use { it.moveToFirst() && it.getString(0) == context.packageName } == true

  private fun ownedMediaUriForPath(path: String): Uri? = runCatching {
    val collection = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
    context.contentResolver.query(collection, arrayOf(BaseColumns._ID),
      "${MediaStore.MediaColumns.DATA}=? AND ${MediaStore.MediaColumns.OWNER_PACKAGE_NAME}=?",
      arrayOf(path, context.packageName), null
    )?.use { if (it.moveToFirst()) ContentUris.withAppendedId(collection, it.getLong(0)) else null }
  }.getOrNull()

  private fun openScannedMedia(contentUri: String, mimeType: String?): Map<String, Any?> {
    val uri = Uri.parse(contentUri)
    val intent = Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(uri, mimeType ?: "*/*")
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    val opened = tryStartActivity(intent)
    return mapOf("opened" to opened, "uri" to contentUri, "reason" to if (opened) null else "No activity could open this media item.")
  }

  private fun openInputStream(uriString: String): InputStream {
    val uri = Uri.parse(uriString)
    return when (uri.scheme) {
      ContentResolver.SCHEME_CONTENT -> context.contentResolver.openInputStream(uri)
        ?: throw IllegalArgumentException("Could not open content URI: $uriString")
      ContentResolver.SCHEME_FILE -> FileInputStream(File(uri.path ?: throw IllegalArgumentException("Missing file path: $uriString")))
      null, "" -> FileInputStream(File(uriString))
      else -> throw IllegalArgumentException("Unsupported URI scheme: ${uri.scheme}")
    }
  }

  private fun fileFromUriString(uriString: String): File {
    val uri = Uri.parse(uriString)
    val path = if (uri.scheme == ContentResolver.SCHEME_FILE) uri.path else uriString
    return File(path ?: uriString)
  }

  private fun readUriDetails(uri: Uri): UriDetails {
    var name: String? = null
    var size: Long? = null
    runCatching {
      context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) {
          val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
          if (nameIndex >= 0 && !cursor.isNull(nameIndex)) name = cursor.getString(nameIndex)
          val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
          if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) size = cursor.getLong(sizeIndex)
        }
      }
    }
    if (name == null && uri.scheme == ContentResolver.SCHEME_FILE) name = File(uri.path ?: "").name
    return UriDetails(name, size, context.contentResolver.getType(uri))
  }

  private fun inspectZipFile(file: File): ZipInspection {
    val firstEntries = mutableListOf<String>()
    var count = 0
    return try {
      ZipInputStream(BufferedInputStream(FileInputStream(file))).use { zip ->
        while (true) {
          val entry = zip.nextEntry ?: break
          count += 1
          if (firstEntries.size < ZIP_SAMPLE_LIMIT) firstEntries.add(entry.name ?: "")
          zip.closeEntry()
        }
      }
      ZipInspection(valid = count > 0, entryCount = count, firstEntries = firstEntries, error = if (count > 0) null else "ZIP file has no entries.")
    } catch (error: Throwable) {
      ZipInspection(valid = false, entryCount = count, firstEntries = firstEntries, error = error.message)
    }
  }

  private fun isRelevantShareIntent(intent: Intent): Boolean {
    val action = intent.action ?: return false
    if (action == Intent.ACTION_SEND || action == Intent.ACTION_SEND_MULTIPLE) return true
    if (action == Intent.ACTION_VIEW) {
      val data = intent.data ?: return false
      if (data.scheme == "chatstamp" || data.scheme == "exp" || data.scheme == "http" || data.scheme == "https") return false
      return true
    }
    return false
  }

  private fun urisFromIntent(intent: Intent): List<Uri> {
    val action = intent.action
    if (action == Intent.ACTION_VIEW) return listOfNotNull(intent.data)

    val single = intent.getParcelableExtraCompat<Uri>(Intent.EXTRA_STREAM)
    if (single != null) return listOf(single)

    val clip = intent.clipData
    if (clip != null) {
      return (0 until clip.itemCount).mapNotNull { clip.getItemAt(it).uri }
    }
    return emptyList()
  }

  private inline fun <reified T : Parcelable> Intent.getParcelableExtraCompat(name: String): T? {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      getParcelableExtra(name, T::class.java)
    } else {
      @Suppress("DEPRECATION")
      getParcelableExtra(name)
    }
  }

  private fun clearShareIntent(activity: Activity, signature: String) {
    lastConsumedIntentSignature = signature
    activity.intent = Intent(Intent.ACTION_MAIN)
  }

  private fun intentSignature(intent: Intent): String {
    val uris = urisFromIntent(intent).joinToString("|") { it.toString() }
    return listOf(intent.action, intent.type, intent.dataString, uris).joinToString("::")
  }

  private fun readTextSample(file: File): String {
    val bytes = file.inputStream().use { input ->
      val buffer = ByteArray(TRANSCRIPT_SAMPLE_BYTES)
      val read = input.read(buffer)
      if (read <= 0) ByteArray(0) else buffer.copyOf(read)
    }
    return bytes.toString(Charsets.UTF_8)
  }

  private fun chooseTranscript(candidates: List<TxtCandidate>): TxtCandidate? {
    val exact = candidates.firstOrNull { it.filename.equals("_chat.txt", ignoreCase = true) && it.score.messageLineCount > 0 }
    if (exact != null) return exact
    return candidates.filter { it.score.messageLineCount > 0 }.maxByOrNull { it.score.score }
  }

  private fun scoreTranscript(filename: String, sample: String): TranscriptScore {
    val messageLines = sample.lineSequence().count { line ->
      val clean = line.replace(Regex("[\\u200E\\u200F\\u202A-\\u202E]"), "").trim()
      WHATSAPP_LINE_PATTERNS.any { it.containsMatchIn(clean) }
    }
    val lower = filename.lowercase(Locale.ROOT)
    val score = messageLines * 20 +
      if (lower == "_chat.txt") 100 else 0 +
        if (lower.contains("whatsapp")) 15 else 0 +
        if (lower.contains("chat") || filename.contains("צ׳אט") || filename.contains("צ'אט")) 8 else 0
    return TranscriptScore(score, messageLines, if (messageLines > 0) "contains WhatsApp-style message lines" else "no WhatsApp-style message lines found")
  }

  private fun isUnsafeZipPath(path: String): Boolean {
    val normalized = path.replace('\\', '/')
    return normalized.startsWith("/") || normalized.split('/').any { it == ".." }
  }

  private fun extensionOf(name: String): String = basename(name).substringAfterLast('.', "").lowercase(Locale.ROOT)

  private fun basename(path: String): String = path.replace('\\', '/').substringAfterLast('/')

  private fun isSupportedMediaExtension(extension: String): Boolean {
    return extension in setOf(
      "jpg", "jpeg", "png", "heic", "webp", "mp4", "mov", "m4v", "3gp",
      "opus", "ogg", "m4a", "mp3", "aac", "gif", "pdf", "doc", "docx",
      "vcf", "xls", "xlsx", "ppt", "pptx", "zip"
    )
  }

  private fun sanitizeFilename(value: String): String {
    val base = basename(value).trim().replace(Regex("[\\\\/:*?\"<>|\\u0000-\\u001F]"), "_").trim('.').trim()
    return base.ifBlank { "whatsapp-media" }
  }

  private fun uniqueFile(directory: File, requestedName: String, usedNames: MutableSet<String>): File {
    directory.mkdirs()
    val safeName = sanitizeFilename(requestedName)
    val dot = safeName.lastIndexOf('.')
    val base = if (dot > 0) safeName.substring(0, dot) else safeName
    val extension = if (dot > 0) safeName.substring(dot) else ""
    var candidate = safeName
    var index = 1
    while (usedNames.contains(candidate.lowercase(Locale.ROOT)) || File(directory, candidate).exists()) {
      candidate = "$base-$index$extension"
      index += 1
    }
    usedNames.add(candidate.lowercase(Locale.ROOT))
    return File(directory, candidate)
  }

  private fun ensureZipExtension(filename: String): String {
    return if (filename.lowercase(Locale.ROOT).endsWith(".zip")) filename else "$filename.zip"
  }

  private fun shareUriForFile(file: ShareOutputFile): Uri? = runCatching {
    val content = file.uri?.let(Uri::parse)?.takeIf { it.scheme == ContentResolver.SCHEME_CONTENT }
    if (content != null) {
      return@runCatching context.contentResolver.openInputStream(content)?.use { content }
    }
    val path = file.path ?: file.uri?.let(Uri::parse)?.path ?: return@runCatching null
    val diskFile = File(path).canonicalFile
    val cache = File(context.cacheDir, "chatstamp").canonicalPath + File.separator
    if (diskFile.path.startsWith(cache) && diskFile.isFile) {
      FileProvider.getUriForFile(context, "${context.packageName}.ChatStampFileProvider", diskFile)
    } else ownedMediaUriForPath(diskFile.path)
  }.getOrNull()

  private fun tryStartActivity(intent: Intent): Boolean {
    return try {
      val launchIntent = intent.apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
      if (launchIntent.resolveActivity(context.packageManager) == null) return false
      context.startActivity(launchIntent)
      true
    } catch (_: Throwable) {
      false
    }
  }

  private fun readableTreeName(uri: Uri): String? = readableTreeLabel(uri)?.substringAfterLast('/')

  private fun readableTreeLabel(uri: Uri): String? {
    return runCatching { DocumentsContract.getTreeDocumentId(uri).replace(':', '/') }.getOrNull()
  }

  private fun hasPersistedPermission(uri: Uri): Boolean {
    return context.contentResolver.persistedUriPermissions.any { it.uri == uri && it.isReadPermission && it.isWritePermission }
  }

  private data class TxtCandidate(
    val filename: String,
    val sourcePath: String,
    val tempFile: File,
    val sample: String,
    val score: TranscriptScore
  )

  private data class TranscriptScore(val score: Int, val messageLineCount: Int, val reason: String)
  private data class UriDetails(val name: String?, val size: Long?, val mimeType: String?)
  private data class ZipInspection(val valid: Boolean, val entryCount: Int, val firstEntries: List<String>, val error: String?)

  companion object {
    private val WHATSAPP_LINE_PATTERNS = listOf(
      Regex("^\\s*\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4},?\\s+\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s*[AP]M)?\\s+-\\s+.+?:\\s+.+", RegexOption.IGNORE_CASE),
      Regex("^\\s*\\[\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4},?\\s+\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s*[AP]M)?\\]\\s+(?:-\\s*)?.+?:\\s+.+", RegexOption.IGNORE_CASE)
    )
  }
}

data class FolderTarget(
  @Field val treeUri: String? = null,
  @Field val documentUri: String? = null,
  @Field val documentId: String? = null,
  @Field val relativeFolderDocumentId: String? = null,
  @Field val displayName: String? = null,
  @Field val path: String? = null
) : Record

data class ShareOutputFile(
  @Field val uri: String? = null,
  @Field val path: String? = null,
  @Field val mimeType: String? = null,
  @Field val mediaType: String? = null,
  @Field val filename: String? = null
) : Record

data class DeleteOutputFile(
  @Field val uri: String? = null,
  @Field val path: String? = null
) : Record
