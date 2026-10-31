---
name: run-quran-karim
description: Run, start, drive or screenshot the Quran Karim app's UI (the web/ page the Android WebView shows) in headless Chromium, to check a change in the real app.
---

# Run quran-karim

The app is an Android WebView wrapper; everything the reader sees is `web/index.html` + `web/app.js`. The agent path
opens that page in headless Chromium with Playwright (pre-installed globally) and screenshots routes. Paths are
relative to the repo root.

## Run (agent path)

```bash
NODE_PATH=$(npm root -g) node .claude/skills/run-quran-karim/driver.mjs
NODE_PATH=$(npm root -g) SETTINGS=1 node .claude/skills/run-quran-karim/driver.mjs '#/' '#/s/1/1' '#/a/2/255'
```

- Each argument is a route hash: `#/` home, `#/s/S/A` surah S at ayah A (text view), `#/a/S/A` ayah screen
  (tafsir, i'rab…), `#/p/N` mushaf page N (needs page images, see Gotchas). `SETTINGS=1` also shots the settings sheet.
- Screenshots go to `$OUT` (default `/tmp/qk-shots`), 390×844 phone viewport. The script prints each title and
  any page JS errors (`page errors: none` is the pass signal). Look at the PNGs.

## Gotchas

- Routes are `#/s/1/1`, not `#/s/1`: a bare surah hash silently stays on home.
- The driver forces `q.mode = "text"`: the mushaf page images are not in git (`web/editions/*/`, `web/pages/` are
  ignored) — the app downloads them as zips from the `editions` branch at runtime, which `file://` can't do.
  To view pages, unzip an edition pack (e.g. `kfgqpc.zip` from the `editions` branch) into `web/`.
- `window.QA_NOFS = true` is set before load; without it the app requests full screen on a page and hides the nav.
- Android-only bridges (`EdBridge`, `NvBridge`, `ReciteBridge`) don't exist in Chromium; features behind them
  (downloads, voice) show a toast or do nothing — not an error.
- The full UI suite is `tools/qa/ui.js` (Playwright, ~140 checks); it hardcodes the working copy
  `/mnt/project-files/quran-app/web` and needs the page images, so it does not run from a bare clone.
