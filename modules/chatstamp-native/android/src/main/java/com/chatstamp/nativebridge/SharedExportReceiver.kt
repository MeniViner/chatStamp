package com.chatstamp.nativebridge

import android.content.Context
import android.content.Intent

/** Generated MainActivity captures shares before React startup or dispatch. */
object SharedExportReceiver {
  @JvmStatic fun capture(context: Context, intent: Intent?) {
    SharedZipInbox.captureLaunch(context.applicationContext, intent)
  }
}
