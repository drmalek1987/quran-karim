---
name: qk-impact
description: Change-impact analysis, regression testing and bug tracing for the Quran Karim app (لوْح). Use BEFORE planning any feature, fix or refactor in web/ or android/ (to list the features it can break), AFTER editing (to run only the affected ui.js groups), BEFORE a release (registry check + full run), and whenever a bug, a failing ui.js check, a JS error or a Java crash must be traced to its cause or to a side effect. Also use when adding a feature or a QA check, because features.json and qa-items.json must be updated in the same change.
---

# qk-impact — know what a change touches, test only that, trace bugs fast

The QA system is data plus three scripts (all in `tools/qa/`, no dependencies, LF files):

| File | Role |
|---|---|
| `features.json` | Registry: every feature with anchors (JS function names, `q.*` keys, Java `Class.method`, CSS selectors, whole files), the exact `ui.js` group names that test it, phone-test ids, `risk` (high/med/low) and `stable` (false = recently built, still moving). |
| `qa-items.json` | The QA checklist as data (ISO/IEC 25010 characteristics + Google Play): id, feature, steps, expected, priority P0-P2, how (auto/manual/both), device. |
| `impact.js` | Diff -> functions/selectors/keys -> features -> groups to run + manual items to re-check. |
| `qa_render.js` | Regenerates `QA-checklist.md` and `plans/qa-checklist.html` from the two JSON files. Never edit those two by hand. |

## When to run what
1. **Before planning a change** (and before the analogical-reasoning step): grep the function, route or key in `features.json` to
   find the feature ids, then read their `anchors` and `ui_groups` to see what the change can break, which precedent to copy and
   which items in `qa-items.json` to keep green. (`impact.js` itself needs a diff, so it is for after the first edit.)
2. **After editing**: `node tools/qa/impact.js --run` (add `--ed=kfold` for another edition, `--deep` to include features reached
   through callers). It runs `ONLY="g1|g2|..." node tools/qa/ui.js` once and prints TOTAL/FAIL.
3. **Before a release**: `node tools/qa/impact.js --check-registry` (fails on drift), `node tools/qa/qa_render.js`, then the full
   `node tools/qa/run-parallel.js` (four editions at once; no build or emulator meanwhile), `python3 tools/qa/data.py web`,
   then the phone items printed by `impact.js` (open `plans/qa-checklist.html`, filter device = phone).
4. **A new feature or a new ui.js check**: add/extend the entry in `features.json` (real anchors, group name copied from the
   `const G... = '...'` line in ui.js) and at least two items in `qa-items.json` (main flow + main failure mode) **in the same
   change**, then `--check-registry` and `qa_render.js`. "Unmapped changes" in the impact output means a registry gap.

Reading the impact output: `!!` rows are stable + high risk = regression risk, test them first. "Shared helpers touched" lists
functions with many callers (`askYes`, `save/load`, `applySettings`, `route`, `ayahBar`...): grep their callers and run `--deep`.
Group names match by substring (`ONLY="نسخة 5.16"` also runs 5.16b), so the run is a superset, never a subset.

## Bug tracing method
1. **Reproduce headless first** (cheapest): the `run-quran-karim` skill for a screenshot of the route, or
   `ONLY="<group>" ED=kfgqpc node tools/qa/ui.js`. A failing line is `group \t name \t FAIL \t message`.
2. **JS errors** are tagged by ui.js as `message @ group / check`: that names the check that caused a page error, even when
   the run is filtered. Find the function with `node tools/qa/impact.js` (changed ones first) or `grep -n "function name" web/app.js`.
3. **Java / native**: `adb logcat -d | grep -E "com.quran.karim|com.lawh.quran|FATAL|AndroidRuntime|QKStart"`; clear first with
   `adb logcat -c`. Bridges are in `AppBridge`, `NvAsr`, `EdStore`, `RadioService`; the JS side calls them as `AppBridge.x()`.
4. **Live phone state**: WebView CDP on a debuggable build (raw websocket; see the memory note, not Playwright connectOverCDP).
   Read `localStorage` `q.*` and call app functions through `Runtime.evaluate`.
5. **Bisect**: `git log --oneline -- web/app.js`, then `git stash` / `git checkout <rev> -- web/app.js` + the ui.js group, or
   `git bisect run` with an `ONLY=` script. Compare with `node tools/qa/impact.js <rev>` to see which features moved.
6. Fix, then repeat step 1 plus `impact.js --run`, then add a check for the bug in ui.js and an item in `qa-items.json`.

## Side-effect detection rules
- A change in a **shared helper** (`askYes`, `save`, `load`, `edKey`, `applySettings`, `route`, `showPage`, `ayahBar`, `tabbar`,
  `syncAlarms`) affects every caller: use `--deep`, and run the groups of every `stable` high-risk feature.
- `route()` runs on every hash change (it hides sheets, ends fullscreen, stops the mic): a new route or a new state needs a
  line there and a check that back navigation still works.
- `applySettings()` is re-run on many events: it must stay idempotent (no toggling, no duplicate listeners, no scroll jump).
- **i18n duplicates**: `web/i18n.js` maps Arabic text to English one-to-one, so one Arabic string used in two contexts gets one
  translation (e.g. «إخفاء» as hide vs. mask, «تونس» as country vs. city). Grep the key in i18n.js before adding or changing text, and
  run `node tools/qa/i18n_scan.js` (missing count must not grow).
- A trailing `// comment` after `{` or `;` on a line that later gets joined/minified breaks the code: run `node --check web/<file>.js`
  after each edit (impact.js does it for changed files). Keep files LF (impact.js reports CRLF).
- `localStorage` keys are `q.*`; a new key must go in `anchors.keys`, and in the backup (`bkCollect`) if it is user data.
- Never touch Quran text or generated data (`web/quran-data.js`); impact.js ignores them.
- Shared test state: ui.js groups run in one browser, so a check that leaves state behind can fail a later group. When a filtered
  run fails but the full run passes (or the reverse), suspect leftover `localStorage` and read the check's own setup lines.

## Commands
```
node tools/qa/impact.js                 # vs HEAD, report only
node tools/qa/impact.js HEAD~3 --deep   # vs another base, include caller-reached features
node tools/qa/impact.js --run --ed=kfold
node tools/qa/impact.js --check-registry
node tools/qa/qa_render.js
ONLY="البحث|نسخة 5.30" ED=kfgqpc node tools/qa/ui.js
node tools/qa/run-parallel.js           # full QA, 4 editions in parallel
```
