package com.menis10tec.chatstamp.qa.probe

import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.DocumentsContract.Document
import androidx.test.platform.app.InstrumentationRegistry

internal class ProbeDocuments(private val run: ProbeRun) {
    private val resolver = run.context.contentResolver
    private val directoryId = "primary:Documents/${run.stem}-saf"
    private val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION

    fun checkPicker(ids: List<String>) {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        run.record("waiting-for-folder", "document_id" to directoryId)
        val activity = instrumentation.startActivitySync(
            Intent(run.context, SelectProbeFolderActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        ) as SelectProbeFolderActivity
        try {
            instrumentation.runOnMainSync { activity.openPicker() }
            val response = requireNotNull(activity.awaitPicker()) { "SAF selection cancelled or timed out" }
            val tree = requireNotNull(response.data)
            require(isProbeTree(tree)) { "Select Documents/${run.stem}-saf in the system picker" }
            check(response.flags and flags == flags) { "Missing read/write tree grant" }
            resolver.takePersistableUriPermission(tree, flags)
            try {
                val parent = DocumentsContract.buildDocumentUriUsingTree(tree, directoryId)
                for (id in ids) {
                    val fixture = run.fixtures.getValue(id)
                    val uri = requireNotNull(DocumentsContract.createDocument(resolver, parent, fixture.mime, fixture.name))
                    requireNotNull(resolver.openOutputStream(uri)).use { output ->
                        run.open(fixture).use { it.copyTo(output) }
                    }
                    val expected = run.open(fixture).use { it.sha256() }
                    val bytesMatch = requireNotNull(resolver.openInputStream(uri)).use { it.sha256() } == expected
                    val dateModified = resolver.query(uri, arrayOf(Document.COLUMN_LAST_MODIFIED), null, null, null)?.use {
                        if (it.moveToFirst() && !it.isNull(0)) it.getLong(0) else null
                    }
                    run.record("saf-readback", "id" to id, "uri" to uri.toString(), "destination" to directoryId,
                        "expected_utc" to fixture.expected.toString(), "date_modified_ms" to dateModified,
                        "bytes_match" to bytesMatch, "date_verified" to false)
                    check(bytesMatch)
                }
            } finally {
                cleanup()
            }
        } finally {
            instrumentation.runOnMainSync { activity.finish() }
        }
    }

    private fun isProbeTree(uri: Uri): Boolean =
        uri.authority == "com.android.externalstorage.documents" && DocumentsContract.isTreeUri(uri) &&
            DocumentsContract.getTreeDocumentId(uri) == directoryId

    fun cleanup() {
        for (permission in resolver.persistedUriPermissions.filter { isProbeTree(it.uri) }) {
            val tree = permission.uri
            for (uri in findDocuments(tree)) {
                check(DocumentsContract.deleteDocument(resolver, uri))
                run.record("deleted-saf", "uri" to uri.toString())
            }
            check(findDocuments(tree).isEmpty()) { "Probe files remain in the selected SAF folder" }
            resolver.releasePersistableUriPermission(tree, flags)
        }
        run.record("cleanup-saf", "owned_documents_remaining" to 0)
    }

    private fun findDocuments(tree: Uri): List<Uri> {
        val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, directoryId)
        return requireNotNull(resolver.query(children, arrayOf(Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME),
            null, null, null)).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    if (cursor.getString(1).startsWith("${run.stem}-")) {
                        add(DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(0)))
                    }
                }
            }
        }
    }
}
