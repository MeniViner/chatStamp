# Stage E API36 release preflight

This newly captured output set belongs to QA release **0.2.0 / code5**, source **0db5579**, APK SHA256 **b468452850f952b314fae00ea9000753743f7bfa388c84ea2135ade984431470**. It is preflight evidence; the later save-policy correction and Stage F source cleanup are outside this installed build. [Machine-readable receipt](e-emulator-runtime.json).

Actual minified same-bundle Restart now worked English→Hebrew→English with native root and organization Modal mirroring, without starting Metro. Fresh onboarding had exactly two pages and no permission request. The three-step flow saved only the active filter: three photos in English, then two videos in Hebrew. Both notification prompts were denied; all five saved outputs passed MediaStore and embedded-date readback. The original three row IDs and paths remained stable after the Hebrew video save.

Reset and Apply were actually tapped in all eight EN/HE ×100/130% ×411/600dp configurations. Reset retained the deliberately unchecked hidden transcript. Viewer, sheet, Settings, History, Results-details, discard/start-over and localized error Back paths were exercised. Cancelling the Android folder picker retained the destination and active Photos filter.

Dynamic ON rendered Android native primary **#475d92** and surface **#fefbff**. OFF rendered fallback primary **#8b5433**, surface **#fffaf4** and background **#fbf6ef**, confirmed by native resource readback and same-region screenshot pixel counts. The switch was restored ON.

The full all-screens visual matrix, transient saving/partial states, custom-provider profiles, rebuilt save-policy fix and physical phone/API33 gate remain open. No Play upload was performed. One shell UiAutomation failure during a permission-dialog dump is recorded separately from app behavior; the QA-process error scan found no matching fatal, JS, Fabric, OOM or ANR candidates.

Cleanup is complete: QA and helper removed; five output rows, fixture Downloads and scratch files absent; font1.0, physical density420/no override, size1080×2400, stay-awake1, locale/timezone/navigation/animation values match initial state. Emulator lease released.

New screenshots, inspected at capture resolution:

- [English filtered results, phone width,130% font](results-filtered-en-phone130.png)
- [Hebrew organization Modal,600dp,130% font](organization-he-wide130.png)
- [Hebrew onboarding page2, phone width,130% font](onboarding2-he-phone130.png)
- [Hebrew filter Reset/Apply, phone width,130% font](filter-he-phone130.png)
