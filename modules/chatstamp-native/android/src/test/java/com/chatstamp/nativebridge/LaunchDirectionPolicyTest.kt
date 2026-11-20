package com.chatstamp.nativebridge

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LaunchDirectionPolicyTest {
  @Test fun freshHebrewAndLegacyHebrewResolveRtlBeforeAnyJavascriptRuns() {
    for (tag in listOf("he", "he-IL", "HE-il", "iw", "iw-IL")) {
      assertTrue("Fresh Hebrew tag $tag", resolveLaunchRtl(null, tag))
    }
  }

  @Test fun freshEnglishAndUnsupportedLocalesResolveLtr() {
    for (tag in listOf(null, "", "en", "en-US", "fr-FR", "ar-SA", "fa-IR", "ur-PK")) {
      assertFalse("Unsupported languages must use the supported English fallback: $tag", resolveLaunchRtl(null, tag))
    }
  }

  @Test fun committedEnglishOverridesHebrewSystemLanguage() {
    for (tag in listOf("he-IL", "iw-IL", "en-US", "ar-SA", null)) {
      assertFalse("Committed EN wins over $tag", resolveLaunchRtl("en", tag))
    }
  }

  @Test fun committedHebrewOverridesEnglishOrUnsupportedSystemLanguage() {
    for (tag in listOf("en-US", "fr-FR", "ar-SA", null)) {
      assertTrue("Committed HE wins over $tag", resolveLaunchRtl("he", tag))
    }
  }

  @Test fun systemPreferenceFollowsTheSupportedSystemLanguage() {
    assertTrue(resolveLaunchRtl("system", "he-IL"))
    assertTrue(resolveLaunchRtl("system", "iw-IL"))
    assertFalse(resolveLaunchRtl("system", "en-US"))
    assertFalse(resolveLaunchRtl("system", "ar-SA"))
    assertFalse(resolveLaunchRtl("system", null))
  }

  @Test fun unknownPreferencesFollowSystemWithoutInventingAnExplicitLanguage() {
    for (preference in listOf("", "fr", "HE", "EN", "not-a-language")) {
      assertTrue("Unknown preference follows Hebrew system: $preference", resolveLaunchRtl(preference, "he-IL"))
      assertFalse("Unknown preference follows English system: $preference", resolveLaunchRtl(preference, "en-US"))
    }
  }
}
