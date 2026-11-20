package com.chatstamp.nativebridge

import org.junit.Assert.*
import org.junit.Test

class OutputFolderPolicyTest {
  private val hebrew = OutputFolderLabels("שיחה מיובאת", "שולח לא ידוע", "מדיה", "הודעות קוליות", "מדבקות", "מסמכים", "אחר", "ייצוא")
  private fun item(type: String, sender: String? = null, legacy: String? = null) =
    ScopedSaveItem("entry", "file:///cache/file", "file", type, "application/octet-stream", relativeFolder = legacy, senderName = sender)

  @Test fun newProfilesLocalizeGroupsAndPreserveLiteralSenderNames() {
    assertEquals("Dana/מדיה", relativeOutputFolder(item("photo", "Dana"), "by-sender-and-type", hebrew, true))
    assertEquals("Unknown sender/מסמכים", relativeOutputFolder(item("document", "Unknown sender"), "by-sender-and-type", hebrew, true))
    assertEquals("שולח לא ידוע/מסמכים", relativeOutputFolder(item("document"), "by-sender-and-type", hebrew, true))
    assertEquals("אבי/מדיה", relativeOutputFolder(item("video", "אבי"), "by-sender-and-type", hebrew, true))
  }

  @Test fun organizationModesKeepTheirOriginalStructure() {
    assertEquals("", relativeOutputFolder(item("photo", "Dana"), "all-in-one", hebrew, true))
    assertEquals("Dana", relativeOutputFolder(item("photo", "Dana"), "by-sender", hebrew, true))
    assertEquals("מדיה", relativeOutputFolder(item("video", "Dana"), "by-type", hebrew, true))
    for (type in listOf("voice", "audio")) assertEquals("הודעות קוליות", relativeOutputFolder(item(type), "by-type", hebrew, true))
    for (type in listOf("sticker", "gif")) assertEquals("מדבקות", relativeOutputFolder(item(type), "by-type", hebrew, true))
    assertEquals("אחר", relativeOutputFolder(item("unknown"), "by-type", hebrew, true))
  }

  @Test fun legacyInputRetainsItsExplicitRelativePath() {
    assertEquals("Dana/Media", relativeOutputFolder(item("photo", "Someone else", "Dana/Media"), "by-sender-and-type", hebrew, false))
    assertEquals("", relativeOutputFolder(item("photo", "Dana"), "by-type", hebrew, false))
  }

  @Test fun senderSanitizationPreservesTheLegacyOrderAndLimit() {
    val legacy = OutputFolderLabels()
    assertEquals("A_B/Media", relativeOutputFolder(item("photo", " A/B "), "by-sender-and-type", legacy, true))
    assertEquals("A B/Media", relativeOutputFolder(item("photo", "A\u00a0\u00a0B"), "by-sender-and-type", legacy, true))
    assertEquals("Imported Chat/Media", relativeOutputFolder(item("photo", "..."), "by-sender-and-type", legacy, true))
    assertEquals("x".repeat(54) + "/Media", relativeOutputFolder(item("photo", "x".repeat(90)), "by-sender-and-type", legacy, true))
  }

  @Test fun invalidLabelsCannotIntroducePathsAndUseSafeFieldFallbacks() {
    val labels = OutputFolderLabels(media = "...", documents = "Doc/Unsafe", unknownSender = " ").safe()
    assertEquals("Media", labels.media)
    assertEquals("Doc_Unsafe", labels.documents)
    assertEquals("Unknown sender", labels.unknownSender)
    assertEquals("שיחה מיובאת/מדיה", relativeOutputFolder(item("photo", "..."), "by-sender-and-type", hebrew, true))
  }
}
