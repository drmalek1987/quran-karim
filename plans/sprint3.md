# Sprint 3: the mushaf screen and settings

The user approved this split on 2026-11-19 (session 12f5d8f2). Sprint 1 and Sprint 2 shipped through 5.29. Sprint 4 is review scheduling (#51) and goes on its own.

| # | Item | Priority | Size | Notes |
|---|---|---|---|---|
| 10 | Remove «السابقة/التالية» (previous/next) from the mushaf page | 🟠 | S | Keep swipe and flip. |
| 13 | Make the right page look different from the left page | 🟠 | S | |
| 14 | Keep the phone status bar visible in fullscreen | 🟠 | S | The #qMk bookmark button and the top bar sit **under** the status bar with no overlap. Each keeps one position in every mode (normal, fs, hifz). Sprint 1 lesson: a button that moved under auto-fullscreen made the first tap land on the page. |
| 15 | Keep the screen on | 🟠 | S | Setting plus FLAG_KEEP_SCREEN_ON. |
| 19 | Fullscreen: Stretch or Fit width option, also switched by pinch zoom-out | 🟠 | M | |
| 20 | Toggle for marking the ayah/word on tap | 🟠 | S | |
| 41 | Option to open the app at the last mushaf position or at the home screen | 🟠 | S | |
| 39 | Choose an external mic (USB / Bluetooth) | 🔴 | M | Recitation mic: NvAsr / ReciteBridge. |
| 46 | Remove the «جرب الأذان بعد دقيقة» button and the help text under it that starts with «لو التجربة ماوصلتش …» | 🟢 | S | Keep the adhan settings and the #23 adhan-sounds fix. |

After the items: full QA (tools/qa/run-parallel.js), QA-checklist update, versioned APK with signer 7d8b31d2, and a phone checklist in plans/ with a copy-results button.
Later (not this sprint): 17, 12, 24, 33, 3, 21, 22, 30, 18, 34; #32 hifz programme (design doc first); Sprint 4 #51.
