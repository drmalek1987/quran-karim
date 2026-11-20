# 5.26 phone test feedback (2026-11-20, bee81250)

Result: 19 pass, 2 with notes.

| # | Verdict | What the user wants |
|---|---|---|
| #47 | small bug | Long-press on a map box shows «file:///» (WebView link preview of the box). Long-press must do nothing at all. |
| #11 | small bug | The hifz test bottom bar covers the dark-mode moon button of the mushaf nav row. |

Also open: 5.26 Playwright renderer crash (cumulative leak) under investigation; fix before release.

## New request (user, 2026-11-20): mask style setting
Settings option for the hiding style used in hifz + review, picked from a COLOUR PANEL (swatches that show the look, not a text list):
1. Current = default (5.24 grey boxes)
2. Haze with soft edges (preview E: s3/masks variants.js/inj.js — blurred page image per mask + feathered edges)
3. Dots instead of words (preview F: clean paper + dotted line showing the word length)
4. Gold with border (colors2: light `color-mix(in srgb,var(--pbg) 40%,#cba84d)` + inset 1px `color-mix(... 45%,#ad8625)`, `0 0 0 1px #ad862566`; dark `52%,#cfad59` / `#ddc588`)
5. Complementary #b86f99 (light 72% pbg + inset 45% #a23f77; dark 70% #bc769e / #d09fbb)
6. Analogous #52ada7 (light 70% pbg + inset 45% #328680; dark 68% #66b7b2 / #90cbc7)
All keep the 5.24 per-run box geometry + speck widening; ayah markers visible; light + dark.
