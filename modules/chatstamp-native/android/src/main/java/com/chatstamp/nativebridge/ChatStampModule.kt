package com.chatstamp.nativebridge

import android.app.Activity
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.os.Parcelable
import android.provider.DocumentsContract
import android.provider.MediaStore
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

private const val OPEN_DOCUMENT_TREE_REQUEST = 9401

class ChatStampModule : Module() {
  private var pendingFolderPromise: Promise? = null
  private var thumbnails: ThumbnailManager? = null

  private val context: Context
    get() = appContext.reactContext ?: appContext.throwingActivity.applicationContext

  override fun definition() = ModuleDefinition {
    Name("ChatStampNative")

    Events("onImportProgress", "onSaveProgress", "onSharedZip")

    OnCreate {
      thumbnails = ThumbnailManager.get(context.applicationContext)
      NativeOperations.addListener(this@ChatStampModule) { name, value -> sendEvent(name, value) }
      SharedZipInbox.captureLaunch(context, appContext.currentActivity?.intent)
    }
    OnDestroy {
      NativeOperations.removeListener(this@ChatStampModule)
      thumbnails?.cancelAll()
    }
    OnActivityEntersForeground { SharedZipInbox.captureLaunch(context, appContext.currentActivity?.intent) }
    OnNewIntent { intent -> SharedZipInbox.captureNew(context, intent) }
    OnStartObserving("onSharedZip") {
      SharedZipInbox.captureLaunch(context, appContext.currentActivity?.intent)
      SharedZipInbox.notifySubscribers()
    }

    AsyncFunction("extractSupportedZipEntriesAsync") Coroutine { sourceUri: String, outputDirectoryUri: String, operationId: String ->
      nativeCall { StreamingZipImporter(context.applicationContext).extract(sourceUri, outputDirectoryUri, operationId) }
    }
    AsyncFunction("consumePendingSharedZipAsync") { SharedZipInbox.consume() }
    AsyncFunction("getShareIntentDebugStatusAsync") { SharedZipInbox.debug() }
    AsyncFunction("saveMediaAsync") Coroutine { items: List<ScopedSaveItem>, options: ScopedSaveOptions ->
      nativeCall { SaveForegroundService.start(context.applicationContext, items, options) }
    }
    AsyncFunction("cancelOperationAsync") Coroutine { operationId: String ->
      nativeCall { NativeOperations.cancelAndAwait(operationId) }
    }
    AsyncFunction("getOperationSnapshotAsync") { NativeOperations.snapshot(context.applicationContext) }
    AsyncFunction("acknowledgeOperationAsync") { operationId: String ->
      nativeCallSync { NativeOperations.acknowledge(context.applicationContext, operationId) }
    }
    AsyncFunction("canReadSourceAsync") { sourceUri: String ->
      runCatching { context.contentResolver.openInputStream(Uri.parse(sourceUri))?.use { true } == true }.getOrDefault(false)
    }
    AsyncFunction("releaseSourceAsync") { sourceUri: String ->
      nativeCallSync { NativeOperations.releaseSource(context.applicationContext, sourceUri) }
    }
    AsyncFunction("releaseImportAsync") Coroutine { operationId: String, workingDirectory: String, sourceUri: String ->
      nativeCall { NativeOperations.releaseImport(context.applicationContext, operationId, workingDirectory, sourceUri) }
    }
    AsyncFunction("cleanupStaleJobsAsync") Coroutine { ->
      nativeCall { NativeOperations.cleanupStaleJobs(context.applicationContext) }
    }
    AsyncFunction("readStoreFileAsync") { name: String -> nativeCallSync { LocalJsonStore(context).read(name) } }
    AsyncFunction("writeStoreFileAtomicAsync") { name: String, contents: String ->
      nativeCallSync { LocalJsonStore(context).write(name, contents) }
    }
    AsyncFunction("listStoreFilesAsync") { prefix: String -> nativeCallSync { LocalJsonStore(context).list(prefix) } }
    AsyncFunction("deleteStoreFileAsync") { name: String -> nativeCallSync { LocalJsonStore(context).delete(name) } }

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
    AsyncFunction("getThumbnailAsync") Coroutine { uri: String, sizePx: Double ->
      nativeCall { ThumbnailManager.get(context.applicationContext).get(uri, ThumbnailPolicy.normalizedSize(sizePx)) }
    }
    AsyncFunction("invalidateThumbnailAsync") { uri: String ->
      nativeCallSync { ThumbnailManager.get(context.applicationContext).invalidate(uri) }
    }
    AsyncFunction("openFileInOtherAppAsync") Coroutine { file: PreviewFileRecord ->
      nativeCall { ExternalFileOpener(context.applicationContext).open(file) }
    }
    AsyncFunction("awaitMediaReleaseAsync") Coroutine { ->
      nativeCall { awaitMediaRelease() }
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

  private fun ownedMediaUriForPath(path: String): Uri? = PreviewFileAccess(context).ownedMediaUriForPath(path)

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

  private fun shareUriForFile(file: ShareOutputFile): Uri? = PreviewFileAccess(context).shareableUri(file.uri, file.path)

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

  private suspend fun <T> nativeCall(block: suspend () -> T): T = try { block() }
  catch (error: Throwable) { throw bridgeFailure(error) }

  private fun <T> nativeCallSync(block: () -> T): T = try { block() }
  catch (error: Throwable) { throw bridgeFailure(error) }

  private fun bridgeFailure(error: Throwable): CodedException {
    val failure = failureFor(error)
    return CodedException(failure.code, failure.message, error)
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
