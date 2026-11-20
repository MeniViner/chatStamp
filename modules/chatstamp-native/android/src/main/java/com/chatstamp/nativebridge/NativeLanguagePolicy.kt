package com.chatstamp.nativebridge

import android.content.Context
import android.util.JsonReader
import android.util.JsonToken
import androidx.core.os.LocaleListCompat
import com.facebook.react.modules.i18nmanager.I18nUtil
import java.io.StringReader

/** Install the committed language direction before React creates its first surface. */
object NativeLanguagePolicy {
  @JvmStatic
  fun apply(context: Context): Boolean = apply(context, LocaleListCompat.getDefault()[0]?.toLanguageTag())

  internal fun apply(context: Context, systemLanguageTag: String?): Boolean {
    val preference = try {
      readPreference(LocalJsonStore(context).read("settings.v1.json", maxBytes = 64 * 1024))
    } catch (_: Exception) {
      // A failed settings read must preserve the last native policy, not publish defaults.
      return false
    }
    val rtl = resolveLaunchRtl(preference, systemLanguageTag)
    I18nUtil.instance.allowRTL(context, rtl)
    I18nUtil.instance.forceRTL(context, rtl)
    return true
  }

  private fun readPreference(contents: String?): String? {
    if (contents == null) return null
    return JsonReader(StringReader(contents)).use { reader ->
      reader.isLenient = false
      reader.beginObject()
      var preference: String? = null
      while (reader.hasNext()) {
        val name = reader.nextName()
        if (name == "languagePreference") {
          preference = if (reader.peek() == JsonToken.STRING) reader.nextString() else {
            reader.skipValue()
            null
          }
        } else reader.skipValue()
      }
      reader.endObject()
      check(reader.peek() == JsonToken.END_DOCUMENT)
      preference
    }
  }
}

internal fun resolveLaunchRtl(preference: String?, systemLanguageTag: String?): Boolean = when (preference) {
  "he" -> true
  "en" -> false
  else -> Regex("^(he|iw)(?:[-_]|$)", RegexOption.IGNORE_CASE).containsMatchIn(systemLanguageTag?.trim().orEmpty())
}
