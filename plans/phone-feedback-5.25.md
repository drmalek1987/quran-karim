# 5.25 phone test feedback (2026-11-20, bee81250) -> batch 5.26

Result: 13 pass, 10 with notes (user's words summarised; Arabic quotes kept short).

| # | Verdict | What the user wants |
|---|---|---|
| #44/#45 | change | Remove the juz/hizb bar and its settings row. The bookmark stays alone (today's "bar off" look). |
| #11 | bug + design | (a) Mushaf masks are not exact on kfgqpc, shamarly and harmain (surah Abasa): some ayah numbers are partly covered, letter tops and harakat show. (b) The user liked the OLD hiding better; wants an attractive style: different colour, hazy/blurred words, blurry edges, or other ideas. **Give options to choose from.** (c) REGRESSION: in the mushaf the whole page is hidden, not only the chosen ayat. (d) REGRESSION: the mic does not stop by itself at the end of the chosen ayat. Text view is fine. |
| #50 | change | (1) No random button in «اختبار الحفظ». (2) In «المراجعة» under «اختبرني» the label still reads «اختبار عشوائي (٣–١٢ آية لحد نص صفحة)»; rename it. |
| #29 | add | Works 100%. Add vibration + a sound when a skip happens. |
| #38 | redesign | Works, but: in vertical scroll, scroll with the reading so the read line never goes under the caption (caption stays put). In horizontal page flip the caption may cover the page bottom, but limit it to about 2 lines. |
| #47 | regression + redesign | Works 100%. REGRESSION: long-press -> test on the mushaf hides the whole page, not the chosen ayat (same as #11c). NEW FLOW: tap a map box -> mushaf opens on its ayat, highlighted; a «اختبرني» button next to the mic hides the highlighted ayat, opens the mic and starts tasmee. Then the long-press and its dialog are not needed (remove). |
| #48 | bug | Sometimes the highlighted ayat open under the top bar or off screen; the user must scroll down. Scroll the range into view. |
| #1 | change | No resume button on home or in «اختبار الحفظ» (keep it in «المراجعة»). |

Passed: #44 bookmark first tap, #44 fullscreen, #40, #42, #43, #26, #29 normal reading, #49 x3, #35, dark mode, rest of the app.

## User decisions
- #50 label in «المراجعة» -> «اختبار عشوائي» only (no parenthesis).
- #29 vibration + sound: only when a skip is 5 words or more (not for a single skipped word).
- #11 style: user picked the OLD 5.24 boxes (one box per run of hidden words) but in a different colour -> colour previews (s3/masks/colors.html) for the user to pick.
- Regression root cause (qk-dev, headless, 5.24 vs 5.25 diff): map long-press -> #hzMus -> hifzTestPages(s, x) (app.js:4522) sets no end, so hifzMount (2109) hides from the start ayah to the page end (even the next surahs) and hifzBar (2347) never ends the test -> mic stays on. Same in 5.24, but there «خلصت» stopped the mic; #43 removed it. «المراجعة» ranges (end set) work. Fix = the new #47 flow: «اختبرني» next to the mic sets end = last highlighted ayah; drop long-press/hzPick test.
- Mask colour round 2: user wants gold + colour-theory schemes (complementary, analogous, ...) matched to the page frame, keeping the 5.24 word boxes -> s3/masks/colors2.html. Speck fix: hzWbMask widen left edge 8‰ + top/bottom 4‰ (agent measured).
- FINAL #11 style (user, after 2 colour rounds): the OLD 5.24 boxes exactly (grey, one box per run of hidden words). Only addition: speck fix in hzWbMask (left edge +8‰, top/bottom +4‰, clamped 0-1000) so ayah-end letter tails do not show. Restore 5.24 hifzPagesMount masking + style.css mask rule (5.24 app.js/style.css are in quran-karim-v5.24.apk assets/web/; adapted copy with the widening = scratchpad s3/masks/old2/app.js).
