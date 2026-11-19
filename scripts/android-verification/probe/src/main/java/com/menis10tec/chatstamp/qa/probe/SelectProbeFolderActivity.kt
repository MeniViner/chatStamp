package com.menis10tec.chatstamp.qa.probe

import android.app.Activity
import android.content.Intent
import android.provider.DocumentsContract
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@Suppress("DEPRECATION")
class SelectProbeFolderActivity : Activity() {
    private val completed = CountDownLatch(1)
    private var selection: Intent? = null

    fun openPicker() {
        val documents = DocumentsContract.buildDocumentUri(
            "com.android.externalstorage.documents",
            "primary:Documents",
        )
        val picker = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            putExtra(DocumentsContract.EXTRA_INITIAL_URI, documents)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
        }
        startActivityForResult(picker, 1)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 1) {
            if (resultCode == RESULT_OK) selection = data
            completed.countDown()
        }
    }

    fun awaitPicker(): Intent? = if (completed.await(2, TimeUnit.MINUTES)) selection else null
}
