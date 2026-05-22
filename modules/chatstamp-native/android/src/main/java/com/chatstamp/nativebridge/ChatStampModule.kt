package com.chatstamp.nativebridge

import android.app.Activity
import android.content.ContentResolver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Parcelable
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.provider.Settings
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import androidx.documentfile.provider.DocumentFile
import androidx.exifinterface.media.ExifInterface
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.zip.ZipInputStream
import kotlin.coroutines.resume

private const val OPEN_DOCUMENT_TREE_REQUEST = 9401
private const val SHARE_CACHE_FOLDER = "shared-zips"
private const val TERMUX_BASE_FOLDER = "/storage/emulated/0/Pictures/chatStamp"
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

    AsyncFunction("saveMediaWithOriginalDatesAsync") Coroutine { items: List<NativeSaveMediaItem>, options: BasicSaveOptions? ->
      saveMediaTermuxParity(items, TermuxParitySaveOptions(chatName = options?.albumName ?: "Imported Chat"))
    }

    AsyncFunction("saveMediaTermuxParityAsync") Coroutine { items: List<NativeSaveMediaItem>, options: TermuxParitySaveOptions? ->
      saveMediaTermuxParity(items, options ?: TermuxParitySaveOptions())
    }

    AsyncFunction("saveMediaToSafFolderAsync") Coroutine { items: List<NativeSaveMediaItem>, options: SafCustomFolderSaveOptions ->
      saveMediaToSafFolder(items, options)
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

    AsyncFunction("testPickedFolderTimestampSupportAsync") Coroutine { treeUri: String ->
      testPickedFolderTimestampSupport(treeUri)
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

    AsyncFunction("isExternalStorageManagerAsync") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) Environment.isExternalStorageManager() else true
    }

    AsyncFunction("openAllFilesAccessSettingsAsync") {
      openAllFilesAccessSettings()
    }

    AsyncFunction("openScannedMediaAsync") { contentUri: String, mimeType: String? ->
      openScannedMedia(contentUri, mimeType)
    }

    AsyncFunction("setMediaStoreDatesAsync") Coroutine { assetId: String, localUri: String, mediaType: String, takenAtMillis: Double, displayName: String? ->
      setMediaStoreDates(assetId, localUri, mediaType, takenAtMillis.toLong(), displayName)
    }

    AsyncFunction("debugInspectMp4DatesAsync") { fileUriOrPath: String, targetTimestampMillis: Double? ->
      mapOf(
        "supported" to false,
        "fileUriOrPath" to fileUriOrPath,
        "targetTimestampMillis" to targetTimestampMillis,
        "reason" to "MP4 box diagnostics are not included in this release build."
      )
    }

    AsyncFunction("debugRewriteMp4DateAsync") { inputUriOrPath: String, targetTimestampMillis: Double ->
      mapOf(
        "supported" to false,
        "inputUriOrPath" to inputUriOrPath,
        "targetTimestampMillis" to targetTimestampMillis,
        "reason" to "MP4 box rewrite diagnostics are not included in this release build."
      )
    }

    OnActivityResult { _, (requestCode, resultCode, intent) ->
      if (requestCode != OPEN_DOCUMENT_TREE_REQUEST || pendingFolderPromise == null) return@OnActivityResult
      val promise = pendingFolderPromise
      pendingFolderPromise = null

      if (resultCode != Activity.RESULT_OK || intent?.data == null) {
        promise?.resolve(mapOf("treeUri" to "", "persistedPermission" to false))
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

  private suspend fun saveMediaTermuxParity(items: List<NativeSaveMediaItem>, options: TermuxParitySaveOptions): Map<String, Any?> {
    val organization = options.organization ?: OutputOrganizationOptions()
    val baseFolder = options.baseFolder?.trim()?.ifBlank { null } ?: TERMUX_BASE_FOLDER
    val chatName = sanitizePathSegment(options.chatName?.trim()?.ifBlank { null } ?: "Imported Chat")
    val root = File(baseFolder, chatName)
      .let { if (organization.createExportTimestampFolder != false) File(it, "Export ${sanitizePathSegment(options.exportTimestamp ?: timestampFolderName())}") else it }
    val duplicateHandling = options.duplicateHandling ?: organization.duplicateHandling ?: "keep-both"

    val results = mutableListOf<Map<String, Any?>>()
    for (item in items) {
      results.add(saveOneFileToPublicFolder(item, root, duplicateHandling))
    }
    return buildSaveBatchResult(results, mode = "termux-parity", outputDirectory = root.absolutePath)
  }

  private suspend fun saveOneFileToPublicFolder(item: NativeSaveMediaItem, root: File, duplicateHandling: String): Map<String, Any?> {
    val timestamp = item.originalTimestampMillis.toLong()
    val mimeType = item.mimeType ?: guessMimeType(item.filename, item.mediaType)
    val outputDir = item.relativeFolder
      ?.split("/")
      ?.filter { it.isNotBlank() }
      ?.fold(root) { parent, segment -> File(parent, sanitizePathSegment(segment)) }
      ?: root
    outputDir.mkdirs()

    val safeName = sanitizeFilename(item.filename).ifBlank { "whatsapp-media" }
    val outputFile = resolveOutputFile(outputDir, safeName, duplicateHandling)
      ?: return failedSaveResult(item, "File already exists and duplicate handling is skip-existing.")

    return try {
      openInputStream(item.sourceUri).use { input ->
        FileOutputStream(outputFile).use { output -> input.copyTo(output) }
      }

      val exifWritten = writeExifTimestampIfSupported(outputFile, timestamp, mimeType)
      val setLastModifiedReturned = outputFile.setLastModified(timestamp)
      val actualLastModified = outputFile.lastModified()
      val filesystemTimestampFixed = withinTimestampTolerance(actualLastModified, timestamp)
      val scannedUri = scanFileBlocking(outputFile.absolutePath, mimeType)
      val mediaStoreValues = scannedUri?.let { queryMediaStoreValues(Uri.parse(it)) }
      val dateVerified = filesystemTimestampFixed && scannedUri != null

      mapOf(
        "filename" to item.filename,
        "ok" to true,
        "insertedUri" to scannedUri,
        "outputPath" to outputFile.absolutePath,
        "collection" to "public-filesystem",
        "displayName" to outputFile.name,
        "mimeType" to mimeType,
        "mediaType" to item.mediaType,
        "originalTimestampMillis" to timestamp,
        "whatsAppTimestampMillis" to timestamp,
        "whatsAppDateIso" to Date(timestamp).toInstant().toString(),
        "copied" to true,
        "setLastModifiedReturned" to setLastModifiedReturned,
        "actualLastModifiedMillis" to actualLastModified,
        "filesystemTimestampFixed" to filesystemTimestampFixed,
        "mediaScannerCompleted" to (scannedUri != null),
        "scannedUri" to scannedUri,
        "dateCorrectionSupported" to true,
        "dateCorrectionVerified" to dateVerified,
        "galleryMaySortByImportTime" to !dateVerified,
        "metadataWritten" to filesystemTimestampFixed,
        "exifWritten" to exifWritten,
        "mp4MetadataFixed" to false,
        "mediaStoreIndexedExpectedDate" to (mediaStoreValues?.get("dateModifiedMillis")?.let { withinTimestampTolerance(it as Long, timestamp) } ?: false),
        "mediaStoreValues" to mediaStoreValues,
        "sourcePath" to item.sourceUri,
        "insertedSourcePath" to outputFile.absolutePath
      )
    } catch (error: Throwable) {
      outputFile.delete()
      failedSaveResult(item, error.message ?: "Could not save file.")
    }
  }

  private fun saveMediaToSafFolder(items: List<NativeSaveMediaItem>, options: SafCustomFolderSaveOptions): Map<String, Any?> {
    val treeUri = Uri.parse(options.treeUri)
    val root = DocumentFile.fromTreeUri(context, treeUri)
      ?: return buildSaveBatchResult(items.map { failedSaveResult(it, "Selected folder is not available.") }, "saf-custom-folder", options.treeUri)
    val organization = options.organization ?: OutputOrganizationOptions()
    val chatFolder = findOrCreateDirectory(root, sanitizePathSegment(options.chatName ?: "Imported Chat"))
    val exportFolder = if (organization.createExportTimestampFolder != false) {
      findOrCreateDirectory(chatFolder, "Export ${sanitizePathSegment(options.exportTimestamp ?: timestampFolderName())}")
    } else {
      chatFolder
    }
    val duplicateHandling = options.duplicateHandling ?: organization.duplicateHandling ?: "keep-both"

    val results = items.map { item ->
      saveOneFileToSafFolder(item, exportFolder, duplicateHandling)
    }
    return buildSaveBatchResult(results, mode = "saf-custom-folder", outputDirectory = options.treeUri)
  }

  private fun saveOneFileToSafFolder(item: NativeSaveMediaItem, root: DocumentFile, duplicateHandling: String): Map<String, Any?> {
    return try {
      val mimeType = item.mimeType ?: guessMimeType(item.filename, item.mediaType)
      val targetDir = item.relativeFolder
        ?.split("/")
        ?.filter { it.isNotBlank() }
        ?.fold(root) { parent, segment -> findOrCreateDirectory(parent, sanitizePathSegment(segment)) }
        ?: root
      val displayName = resolveSafName(targetDir, sanitizeFilename(item.filename), duplicateHandling)
        ?: return failedSaveResult(item, "File already exists and duplicate handling is skip-existing.")
      val targetFile = targetDir.createFile(mimeType, displayName)
        ?: return failedSaveResult(item, "Could not create file in selected folder.")

      context.contentResolver.openOutputStream(targetFile.uri).use { output ->
        if (output == null) throw IllegalStateException("Could not open selected folder output stream.")
        openInputStream(item.sourceUri).use { input -> input.copyTo(output) }
      }

      val timestamp = item.originalTimestampMillis.toLong()
      mapOf(
        "filename" to item.filename,
        "ok" to true,
        "insertedUri" to targetFile.uri.toString(),
        "outputPath" to targetFile.uri.toString(),
        "collection" to "saf",
        "displayName" to displayName,
        "mimeType" to mimeType,
        "mediaType" to item.mediaType,
        "originalTimestampMillis" to timestamp,
        "whatsAppTimestampMillis" to timestamp,
        "whatsAppDateIso" to Date(timestamp).toInstant().toString(),
        "copied" to true,
        "setLastModifiedReturned" to false,
        "actualLastModifiedMillis" to null,
        "filesystemTimestampFixed" to false,
        "mediaScannerCompleted" to false,
        "scannedUri" to null,
        "dateCorrectionSupported" to false,
        "dateCorrectionVerified" to false,
        "galleryMaySortByImportTime" to true,
        "metadataWritten" to false,
        "sourcePath" to item.sourceUri,
        "insertedSourcePath" to targetFile.uri.toString(),
        "warning" to "Android SAF folders do not expose reliable filesystem timestamp writes."
      )
    } catch (error: Throwable) {
      failedSaveResult(item, error.message ?: "Could not save file.")
    }
  }

  private fun buildSaveBatchResult(results: List<Map<String, Any?>>, mode: String, outputDirectory: String): Map<String, Any?> {
    val saved = results.count { it["ok"] == true }
    val failed = results.size - saved
    val filesystemFixed = results.count { it["filesystemTimestampFixed"] == true }
    val scanned = results.count { it["mediaScannerCompleted"] == true }
    val exifFixed = results.count { it["exifWritten"] == true }
    val mp4Fixed = results.count { it["mp4MetadataFixed"] == true }
    val fallbackRisk = results.count { it["galleryMaySortByImportTime"] == true }
    return mapOf(
      "mode" to mode,
      "outputDirectory" to outputDirectory,
      "copied" to saved,
      "saved" to saved,
      "failed" to failed,
      "filesystemTimestampFixed" to filesystemFixed,
      "dateCorrected" to filesystemFixed,
      "dateCorrectionFailed" to (saved - filesystemFixed).coerceAtLeast(0),
      "exifFixed" to exifFixed,
      "mp4MetadataFixed" to mp4Fixed,
      "scanned" to scanned,
      "fallbackImportTimeRisk" to fallbackRisk,
      "results" to results
    )
  }

  private fun testPickedFolderTimestampSupport(treeUriString: String): Map<String, Any?> {
    val treeUri = Uri.parse(treeUriString)
    val root = DocumentFile.fromTreeUri(context, treeUri)
    val canWrite = root?.canWrite() == true
    var canCreateSubfolders = false
    var cleanupSucceeded = false
    try {
      val probeDir = root?.createDirectory(".chatstamp-probe-${System.currentTimeMillis()}")
      canCreateSubfolders = probeDir != null
      cleanupSucceeded = probeDir?.delete() ?: false
    } catch (_: Exception) {
      canCreateSubfolders = false
    }
    return mapOf(
      "treeUri" to treeUriString,
      "canWriteFile" to canWrite,
      "canCreateSubfolders" to canCreateSubfolders,
      "canSetFilesystemTimestamp" to false,
      "timestampVerified" to false,
      "cleanupSucceeded" to cleanupSucceeded,
      "displayName" to readableTreeName(treeUri),
      "readablePathLabel" to readableTreeLabel(treeUri),
      "reason" to "Android folder picker access does not expose a reliable last-modified timestamp API."
    )
  }

  private fun openFolderTarget(target: FolderTarget): Map<String, Any?> {
    val uri = target.treeUri?.let { Uri.parse(it) }
    if (uri != null) {
      val opened = tryStartActivity(Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, DocumentsContract.Document.MIME_TYPE_DIR)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
      })
      if (opened) return mapOf("opened" to true, "activity" to "ACTION_VIEW_TREE", "attempted" to uri.toString())
    }

    return mapOf(
      "opened" to false,
      "reason" to "Android does not guarantee opening arbitrary public folders.",
      "attempted" to (target.treeUri ?: target.path),
      "fallbackUsed" to true
    )
  }

  private fun shareOutputFiles(files: List<ShareOutputFile>): Map<String, Any?> {
    val uris = files.mapNotNull { shareUriForFile(it) }
    if (uris.isEmpty()) return mapOf("opened" to false, "shared" to 0, "reason" to "No shareable files were available.")

    val mimeType = files.mapNotNull { it.mimeType }.distinct().singleOrNull() ?: "*/*"
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
    }

    return try {
      context.startActivity(Intent.createChooser(intent, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      mapOf("opened" to true, "shared" to uris.size)
    } catch (error: Throwable) {
      mapOf("opened" to false, "shared" to 0, "reason" to (error.message ?: "No app could share these files."))
    }
  }

  private fun deleteOutputFiles(files: List<DeleteOutputFile>): Map<String, Any?> {
    val results = files.map { file ->
      val target = file.uri ?: file.path
      val deleted = try {
        when {
          file.uri?.startsWith("content://") == true -> context.contentResolver.delete(Uri.parse(file.uri), null, null) > 0
          !file.path.isNullOrBlank() -> File(file.path).delete()
          else -> false
        }
      } catch (_: Throwable) {
        false
      }
      mapOf("target" to target, "deleted" to deleted, "reason" to if (deleted) null else "Delete failed or target was unavailable.")
    }
    return mapOf(
      "deleted" to results.count { it["deleted"] == true },
      "failed" to results.count { it["deleted"] != true },
      "results" to results
    )
  }

  private fun openAllFilesAccessSettings(): Map<String, Any?> {
    val packageUri = Uri.parse("package:${context.packageName}")
    val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, packageUri)
    } else {
      Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri)
    }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    val opened = tryStartActivity(intent)
    return mapOf("opened" to opened, "activity" to intent.action)
  }

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

  private fun setMediaStoreDates(assetId: String, localUri: String, mediaType: String, takenAtMillis: Long, displayName: String?): Map<String, Any?> {
    val uri = if (localUri.startsWith("content://")) Uri.parse(localUri) else null
    var rowsUpdated = 0
    if (uri != null) {
      val values = ContentValues().apply {
        put(MediaStore.MediaColumns.DATE_MODIFIED, takenAtMillis / 1000)
        if (mediaType == "photo" || mediaType == "video") {
          put(MediaStore.MediaColumns.DATE_TAKEN, takenAtMillis)
        }
      }
      rowsUpdated = runCatching { context.contentResolver.update(uri, values, null, null) }.getOrDefault(0)
    }
    return mapOf(
      "mediaStoreRowsUpdated" to rowsUpdated,
      "fileModified" to false,
      "exifWritten" to false,
      "dateCorrectionVerified" to (rowsUpdated > 0),
      "collection" to mediaType,
      "contentUri" to uri?.toString(),
      "originalTimestampMillis" to takenAtMillis,
      "warning" to if (rowsUpdated > 0) null else "MediaStore date update could not be verified for $displayName ($assetId)."
    )
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

  private fun sanitizePathSegment(value: String): String {
    return value.trim().replace(Regex("[\\\\/:*?\"<>|\\u0000-\\u001F]"), "_").replace(Regex("\\s+"), " ").trim('.').trim()
      .ifBlank { "Imported Chat" }
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

  private fun resolveOutputFile(directory: File, requestedName: String, duplicateHandling: String): File? {
    val target = File(directory, sanitizeFilename(requestedName))
    if (!target.exists()) return target
    if (duplicateHandling == "skip-existing") return null
    if (duplicateHandling == "replace-existing") {
      target.delete()
      return target
    }
    return uniqueFile(directory, requestedName, mutableSetOf())
  }

  private fun resolveSafName(directory: DocumentFile, requestedName: String, duplicateHandling: String): String? {
    val safeName = sanitizeFilename(requestedName)
    if (directory.findFile(safeName) == null) return safeName
    if (duplicateHandling == "skip-existing") return null
    if (duplicateHandling == "replace-existing") {
      directory.findFile(safeName)?.delete()
      return safeName
    }
    val dot = safeName.lastIndexOf('.')
    val base = if (dot > 0) safeName.substring(0, dot) else safeName
    val extension = if (dot > 0) safeName.substring(dot) else ""
    var index = 1
    while (true) {
      val candidate = "$base-$index$extension"
      if (directory.findFile(candidate) == null) return candidate
      index += 1
    }
  }

  private fun findOrCreateDirectory(parent: DocumentFile, name: String): DocumentFile {
    return parent.findFile(name)?.takeIf { it.isDirectory } ?: parent.createDirectory(name)
    ?: throw IllegalStateException("Could not create folder: $name")
  }

  private fun guessMimeType(filename: String, mediaType: String?): String {
    val ext = extensionOf(filename)
    if (ext == "txt") return "text/plain"
    if (ext == "opus") return "audio/ogg"
    if (ext == "heic") return "image/heic"
    if (ext == "3gp") return "video/3gpp"
    if (ext == "mov") return "video/quicktime"
    val guessed = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext)
    if (guessed != null) return guessed
    return when (mediaType) {
      "photo" -> "image/jpeg"
      "video" -> "video/mp4"
      "voice", "audio" -> "audio/mpeg"
      "sticker" -> "image/webp"
      "gif" -> "image/gif"
      "document" -> "application/octet-stream"
      else -> "application/octet-stream"
    }
  }

  private fun writeExifTimestampIfSupported(file: File, timestamp: Long, mimeType: String): Boolean {
    if (mimeType != "image/jpeg" && !file.name.lowercase(Locale.ROOT).let { it.endsWith(".jpg") || it.endsWith(".jpeg") }) return false
    return try {
      val utcFormat = SimpleDateFormat("yyyy:MM:dd HH:mm:ss", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
      ExifInterface(file).apply {
        setAttribute(ExifInterface.TAG_DATETIME_ORIGINAL, utcFormat.format(Date(timestamp)))
        setAttribute(ExifInterface.TAG_DATETIME_DIGITIZED, utcFormat.format(Date(timestamp)))
        setAttribute(ExifInterface.TAG_OFFSET_TIME_ORIGINAL, "+00:00")
        saveAttributes()
      }
      true
    } catch (_: Throwable) {
      false
    }
  }

  private suspend fun scanFileBlocking(path: String, mimeType: String): String? = suspendCancellableCoroutine { continuation ->
    MediaScannerConnection.scanFile(context, arrayOf(path), arrayOf(mimeType)) { _, uri ->
      if (continuation.isActive) continuation.resume(uri?.toString())
    }
  }

  private fun queryMediaStoreValues(uri: Uri): Map<String, Any?>? {
    return runCatching {
      context.contentResolver.query(
        uri,
        arrayOf(MediaStore.MediaColumns.DATE_MODIFIED, MediaStore.MediaColumns.DATE_ADDED, MediaStore.MediaColumns.DATE_TAKEN),
        null,
        null,
        null
      )?.use { cursor ->
        if (!cursor.moveToFirst()) return@use null
        val modifiedSeconds = getLongColumn(cursor, MediaStore.MediaColumns.DATE_MODIFIED)
        val addedSeconds = getLongColumn(cursor, MediaStore.MediaColumns.DATE_ADDED)
        val takenMillis = getLongColumn(cursor, MediaStore.MediaColumns.DATE_TAKEN)
        mapOf(
          "dateModified" to modifiedSeconds,
          "dateModifiedMillis" to modifiedSeconds?.times(1000),
          "dateAdded" to addedSeconds,
          "dateAddedMillis" to addedSeconds?.times(1000),
          "dateTaken" to takenMillis
        )
      }
    }.getOrNull()
  }

  private fun getLongColumn(cursor: android.database.Cursor, name: String): Long? {
    val index = cursor.getColumnIndex(name)
    if (index < 0 || cursor.isNull(index)) return null
    return cursor.getLong(index)
  }

  private fun withinTimestampTolerance(actual: Long, expected: Long): Boolean {
    return kotlin.math.abs(actual - expected) <= 2000L
  }

  private fun failedSaveResult(item: NativeSaveMediaItem, reason: String): Map<String, Any?> {
    val timestamp = item.originalTimestampMillis.toLong()
    return mapOf(
      "filename" to item.filename,
      "ok" to false,
      "mediaType" to item.mediaType,
      "originalTimestampMillis" to timestamp,
      "whatsAppTimestampMillis" to timestamp,
      "whatsAppDateIso" to Date(timestamp).toInstant().toString(),
      "copied" to false,
      "dateCorrectionSupported" to false,
      "dateCorrectionVerified" to false,
      "galleryMaySortByImportTime" to true,
      "metadataWritten" to false,
      "filesystemTimestampFixed" to false,
      "mediaScannerCompleted" to false,
      "failureReason" to reason,
      "error" to reason
    )
  }

  private fun shareUriForFile(file: ShareOutputFile): Uri? {
    file.uri?.takeIf { it.startsWith("content://") }?.let { return Uri.parse(it) }
    val path = file.path ?: file.uri?.takeIf { it.startsWith("file://") }?.let { Uri.parse(it).path }
    if (path.isNullOrBlank()) return null
    val diskFile = File(path)
    if (!diskFile.exists()) return null
    return FileProvider.getUriForFile(context, "${context.packageName}.ChatStampFileProvider", diskFile)
  }

  private fun tryStartActivity(intent: Intent): Boolean {
    return try {
      val launchIntent = intent.apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
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

  private fun timestampFolderName(): String {
    return SimpleDateFormat("yyyy-MM-dd HH-mm", Locale.US).format(Date())
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

data class NativeSaveMediaItem(
  @Field val sourceUri: String,
  @Field val filename: String,
  @Field val mediaType: String,
  @Field val mimeType: String?,
  @Field val originalTimestampMillis: Double,
  @Field val sender: String?,
  @Field val albumName: String?,
  @Field val relativeFolder: String?
) : Record

data class OutputOrganizationOptions(
  @Field val mode: String? = null,
  @Field val createExportTimestampFolder: Boolean? = null,
  @Field val duplicateHandling: String? = null
) : Record

data class TermuxParitySaveOptions(
  @Field val chatName: String? = null,
  @Field val baseFolder: String? = null,
  @Field val exportTimestamp: String? = null,
  @Field val organization: OutputOrganizationOptions? = null,
  @Field val duplicateHandling: String? = null
) : Record

data class BasicSaveOptions(
  @Field val albumName: String? = null,
  @Field val keepFailedDebugFiles: Boolean? = null
) : Record

data class SafCustomFolderSaveOptions(
  @Field val treeUri: String,
  @Field val chatName: String? = null,
  @Field val exportTimestamp: String? = null,
  @Field val organization: OutputOrganizationOptions? = null,
  @Field val duplicateHandling: String? = null
) : Record

data class FolderTarget(
  @Field val treeUri: String? = null,
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
