package com.chatstamp.nativebridge

import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import android.content.pm.ApplicationInfo
import android.os.LocaleList
import androidx.test.platform.app.InstrumentationRegistry
import com.facebook.react.modules.i18nmanager.I18nUtil
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.io.IOException
import java.util.Locale
import java.util.UUID

/** Real Android preferences/storage, isolated from the installed app's settings. */
class LaunchDirectionIntegrationTest {
  private val base = InstrumentationRegistry.getInstrumentation().targetContext
  private lateinit var root: File
  private lateinit var context: OwnedContext
  private lateinit var settings: File
  private val preferences = mutableSetOf<String>()

  private inner class OwnedContext(private val files: File, private val namespace: String) : ContextWrapper(base) {
    var unreadable = false
    override fun getApplicationContext(): Context = this
    override fun getFilesDir(): File {
      if (unreadable) throw IOException("Synthetic unreadable settings storage")
      return files
    }
    override fun getSharedPreferences(name: String, mode: Int): SharedPreferences {
      val ownedName = "$namespace-$name"
      preferences.add(ownedName)
      return base.getSharedPreferences(ownedName, mode)
    }
  }

  @Before fun prepare() {
    val id = UUID.randomUUID().toString()
    root = File(base.cacheDir, "launch-policy-test-$id").apply { check(mkdirs()) }
    context = OwnedContext(root, "launch-policy-test-$id")
    settings = File(root, "chatstamp-store/settings.v1.json")
    assertTrue("The actual manifest must support native RTL", base.applicationInfo.flags and ApplicationInfo.FLAG_SUPPORTS_RTL != 0)
  }

  @After fun cleanup() {
    preferences.forEach { base.deleteSharedPreferences(it) }
    if (::root.isInitialized) root.deleteRecursively()
  }

  private fun nativeDirection(rtl: Boolean) {
    I18nUtil.instance.allowRTL(context, rtl)
    I18nUtil.instance.forceRTL(context, rtl)
  }

  private fun assertNativeDirection(rtl: Boolean) {
    assertEquals(rtl, I18nUtil.instance.isRTL(context))
    val stored = context.getSharedPreferences("com.facebook.react.modules.i18nmanager.I18nUtil", Context.MODE_PRIVATE)
    assertEquals(rtl, stored.getBoolean("RCTI18nUtil_allowRTL", !rtl))
    assertEquals(rtl, stored.getBoolean("RCTI18nUtil_forceRTL", !rtl))
  }

  private fun write(contents: String): ByteArray {
    settings.parentFile!!.mkdirs()
    val bytes = contents.toByteArray(Charsets.UTF_8)
    settings.writeBytes(bytes)
    return bytes
  }

  @Test fun freshHebrewAppliesRealNativeRtlWithoutCreatingCommittedSettings() {
    nativeDirection(false)
    assertTrue(NativeLanguagePolicy.apply(context, "he-IL"))
    assertNativeDirection(true)
    assertFalse("Startup must not persist JS defaults", settings.exists())
  }

  @Test fun freshEnglishAndUnsupportedLocalesClearStaleRtlFlags() {
    for (tag in listOf("en-US", "fr-FR", "ar-SA", "fa-IR")) {
      nativeDirection(true)
      assertTrue(NativeLanguagePolicy.apply(context, tag))
      assertNativeDirection(false)
      assertFalse(settings.exists())
    }
  }

  @Test fun committedAppPreferenceWinsAndSystemPreferenceFollowsLocaleWithoutRewritingData() {
    val cases = listOf(
      Triple("en", "he-IL", false), Triple("he", "en-US", true),
      Triple("system", "he-IL", true), Triple("system", "en-US", false),
      Triple("system", "ar-SA", false)
    )
    for ((preference, tag, expected) in cases) {
      val original = write("""{ "languagePreference": "$preference", "alwaysUseMessageDate": false, "retained": {"value":7} }""")
      nativeDirection(!expected)
      assertTrue(NativeLanguagePolicy.apply(context, tag))
      assertNativeDirection(expected)
      assertArrayEquals(original, settings.readBytes())
    }
  }

  @Test fun missingAndInvalidPreferenceFieldsFollowSystemWithoutOverwritingTheObject() {
    for (contents in listOf(
      """{"alwaysUseMessageDate":false}""", """{"languagePreference":"unknown"}""",
      """{"languagePreference":null}""", """{"languagePreference":false}"""
    )) {
      val original = write(contents)
      nativeDirection(false)
      assertTrue(NativeLanguagePolicy.apply(context, "he-IL"))
      assertNativeDirection(true)
      assertArrayEquals(original, settings.readBytes())
    }
  }

  @Test fun malformedNonobjectAndOversizedSettingsPreserveBytesAndPreviouslyAppliedFlags() {
    val invalid = listOf("{", "null", "[]", "\"he\"", """{"languagePreference":"he"} trailing""",
      """{"languagePreference":"he","large":"${"x".repeat(65536)}"}""")
    for (contents in invalid) {
      val original = write(contents)
      for (previous in listOf(false, true)) {
        nativeDirection(previous)
        assertFalse("Invalid settings must not be treated as absent", NativeLanguagePolicy.apply(context, "he-IL"))
        assertNativeDirection(previous)
        assertArrayEquals(original, settings.readBytes())
      }
    }
  }

  @Test fun unreadableSettingsPreserveCommittedBytesAndExistingNativeFlags() {
    val original = write("""{"languagePreference":"en","alwaysUseMessageDate":false}""")
    for (previous in listOf(false, true)) {
      nativeDirection(previous)
      context.unreadable = true
      try {
        assertFalse(NativeLanguagePolicy.apply(context, "he-IL"))
        assertNativeDirection(previous)
        assertArrayEquals(original, settings.readBytes())
      } finally { context.unreadable = false }
    }
  }

  @Test fun readsOnlyCommittedSettingsAndIgnoresAnUncommittedTemporaryPreference() {
    val original = write("""{"languagePreference":"en","alwaysUseMessageDate":false}""")
    val temporary = File(settings.parentFile, ".settings.v1.json.synthetic.tmp")
    val pending = """{"languagePreference":"he"}""".toByteArray()
    temporary.writeBytes(pending)
    nativeDirection(true)
    assertTrue(NativeLanguagePolicy.apply(context, "he-IL"))
    assertNativeDirection(false)
    assertArrayEquals(original, settings.readBytes())
    assertArrayEquals(pending, temporary.readBytes())
  }

  @Test fun publicStartupEntryUsesTheActualNativeLocaleListBeforeJavascript() {
    val previousLocales = LocaleList.getDefault()
    val previousDefault = Locale.getDefault()
    try {
      for ((tag, expected) in listOf("he-IL" to true, "en-US" to false, "ar-SA" to false)) {
        LocaleList.setDefault(LocaleList(Locale.forLanguageTag(tag)))
        nativeDirection(!expected)
        assertTrue(NativeLanguagePolicy.apply(context))
        assertNativeDirection(expected)
        assertFalse(settings.exists())
      }
    } finally {
      LocaleList.setDefault(previousLocales)
      Locale.setDefault(previousDefault)
    }
  }
}
