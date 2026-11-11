# Code review plan – Quran Karim (source revision, post v5.19b)

## Context
The user asked: "revise the source code of the app, correct any problem". Scope: `web/app.js`, `asr.js`, `azkar.js`,
`i18n.js`, `sw.js`, `style.css`, `index.html`, `android/src/com/quran/karim/*.java`, `AndroidManifest.xml`,
`build-win.py`, `build.sh` (~10.5k lines). Out of scope: generated data, `tools/asr/gpu`, page-geometry tools.
The W-track/G10 plan stays paused and the `wip-kfold` stash is not touched.

How the findings were produced: 5 Sonnet reviewers read every in-scope line (findings only); Fable read
`MainActivity`, `EdStore`, `AudioCache`, `AppBridge`, `ShareProvider`, `sw.js`, the manifest itself, then re-read
the code behind every high/medium finding. Status below: **V** = verified in the code by Fable, **C** = must be
confirmed at fix time (cheap check named), dropped findings are listed at the end.

Goal check: this serves "a near-complete Quran app" (stability, privacy, mic lifecycle) and removes mic/ASR
lifecycle bugs that hurt the recitation feature. It does not touch model accuracy.

## Groups, easiest → hardest

Each group = one small commit (explicit file paths only), pushed to `main` as the project does; LF endings kept
(`git diff --stat` + `file web/app.js` before each commit). No version bump, no release.

### G1 – trivial JS fixes (effort low, qk-dev Sonnet, Fable reviews the diff) – risk very low
| # | Where | Problem | Fix |
|---|---|---|---|
| 1 V | `app.js:2050` `hifzTestDone` | `hifzMark` per ayah = parse+stringify of the whole `q.hifzAyat` per ayah (freezes on a long surah) | build one map, call existing `hifzMarks` (`app.js:2042`) |
| 2 V | `app.js:259/1031` | `thmOn` declared after `applySettings()` first runs → thematic toggle shows no state | move the `var` above first use |
| 3 V | `app.js:261` | click listeners re-added to `#langSet` on every `applySettings()` | bind once |
| 4 V | `app.js:3708`, `4503`, `1806` | `createObjectURL` never revoked (backup export, test recording, skipped audio) | revoke after use / on stop |
| 5 C | `app.js:5380` | saved `q.dict` no longer in `BK.lex` → prints "undefined" | fall back to `BK.lex[0]` |
| 6 C | `app.js:4017` | imsakia `rows[0]` with empty `rows` (no umalqura calendar) throws | guard + hint |
| 7 V | `app.js:2497/2500` | recogniser words inserted as HTML unescaped | `esc()` (`app.js:43`) |
| 8 V | dead code | `hifzStats`, `isDark`, `PRE_MIN`, `dlState`/`sleepState` exports, 6 orphan CSS classes | delete (grep-confirm each first) |
Check: `ED=kfgqpc node tools/qa/ui.js` (0 FAIL, 287) + `tools/qa/data.py web`.

### G2 – untrusted input in the page (effort medium, Fable) – risk low
| # | Where | Problem | Fix |
|---|---|---|---|
| 1 V | `app.js:4157,4177-4183` family code `QK1:` | pasted JSON merged unvalidated; `m.j` goes raw into `data-j="…"`/text → markup injection in a WebView that has the bridges; persists in `q.family` | validate on import: `members` array, `n` string ≤ 40, `j`/`d` integer arrays 1–30; reject otherwise |
| 2 V | `app.js:4211,4237` teacher code `QK2:` | `r.miss` entries go into `href` unescaped; malformed `r.r`/`r.d` saved to `q.students` can break the screen for good | validate (`miss` = `^\d+:\d+$`, `d` date, `r` in range, `sc` 0–100); render defensively so a bad saved row is skipped |
| 3 V | `app.js:3704-3718` backup | export/import copies `q.donate`, `q.donateId`, `q.modelConsent` → restoring on another phone turns voice donation on without consent | skip those keys on export and import |
| 4 C | `app.js:4177,4222,4970,4974` | 4 `prompt()` calls; the code's own comment (`app.js:2865`) says `prompt()` does nothing in the Android WebView | confirm on the emulator; replace with the existing `askText` sheet |
Check: new ui.js cases (crafted QK1/QK2 codes → rejected, nothing rendered; backup round-trip keeps donation off);
all four editions.

### G3 – mic / timer lifecycle in the page (effort medium, Fable) – risk medium
| # | Where | Problem | Fix |
|---|---|---|---|
| 1 V | `app.js:4603-4607`, `4796-4798`, `route()` 5527 | leaving the hifz voice test / mutashabihat test leaves the mic on; the stale handler then kills the next session's first event | in `route()`: `htv.on=false`, `mtv.on=false`, `Mic.stop()` when leaving those views |
| 2 V | `app.js:4494-4507` | test `MediaRecorder` keeps recording after re-render/navigation | keep it module-level, stop tracks in `route()` |
| 3 V | app-wide | nothing stops the mic when the app goes to the background (`visibilitychange` only syncs alarms) | on `document.hidden`: stop recitation/voice/test mics (native side in G5) |
| 4 V | `app.js:3995` | prayer countdown interval survives every re-render (one more per toggle, stale closure) | one module-level timer, cleared at the start of `showPrayer` |
| 5 V | `app.js:1048` + `1325` | `lastSpread` never updated in vertical mode → full 604-page re-render on every resize on tablets | set it in `showPagesV` / skip when `turnMode==="v"` |
| 6 V | `app.js:1153` | stale `place()` rAF loop clears `vHold` of the new render → vertical view reopens on the wrong page | generation counter |
| 7 V | `app.js:546` | edition switches by itself when a download finishes, even minutes later on another screen | switch only if the settings sheet is still open; otherwise toast "ready" |
| 8 C | `app.js:2780-2799` | cancelling the index mic leaves the button highlighted | clear the class in the cancel path |
| 9 C | `app.js:1000`, `3985`, `5109`, `1114`, `3351` | late callbacks (search voice, GPS fix, azkar audio, scroll timeouts) act on a screen that is gone; qibla GPS overwrites a chosen city name | "view still current" guards; skip auto-GPS when a labelled place is saved |
Check: ui.js (all four editions) + Maestro/phone: start voice test → Home → mic indicator off; rotate tablet AVD in
vertical mode.

### G4 – small Java hardening (effort medium, Fable) – risk low
| # | Where | Problem | Fix |
|---|---|---|---|
| 1 V | `NvAsr.java:84`, `ReciteBridge.java:44` | `checkSelfPermission`/`requestPermissions` (API 23) without guard, minSdk 21 → crash on Android 5.x when the mic is tapped | `SDK_INT >= 23` guard as `MainActivity:70` does |
| 2 V | `QiblaBridge.java:69-73` | "Approximate location" only: `getLastKnownLocation("gps")` throws, the catch reports "denied" and returns → qibla/prayer location fails | try/catch per provider, continue |
| 3 V | `Alarms.java:48,66,73`, `QuranWidget.java:52`, `AlarmReceiver.java:11-14` | a non-object element in stored JSON → NPE inside the BroadcastReceiver (every boot/alarm); one failing step skips the widgets | null checks; each step in its own try/catch |
| 4 V | `Alarms.java:45,70` | clock set backwards leaves `last` in the future → adhans skipped until real time passes it | clamp `last = min(last, now)` in `schedule()` |
| 5 V | `MainActivity.java:148-149` | `hash` extra appended to the start URL without the `#/` check that `onNewIntent` has (exported activity) | same `startsWith("#/")` check; also `setAllowFileAccess(false)` if the emulator smoke test passes |
| 6 V | `AppBridge.java:97-107,133-173` | `previewAdhan(null)` NPE on the UI thread; adhan preview keeps playing after leaving; streams not closed on error | null guard, release in `onPause`, try/finally |
| 7 V | `MainActivity.java:183` | `onDestroy` never destroys the WebView / stops the adhan preview | `web.destroy()` after shutdowns |
| 8 C | `SpeechBridge.java:33,52-62` | hand-written `quote()` misses newlines; `tts.speak` errors never reach the page | `JSONObject.quote`; report error |
| 9 C | `PrayerWidget.java` | countdown runs negative when adhan alerts are off (no refresh at prayer time) | schedule a widget refresh at `next.at` |
Check: `build-win.py` → `Phone_API35` emulator: launch, widget add, alarm fire (set a reminder 2 min ahead), qibla
with approximate location, notification tap opens the right screen. API 21–22 path by code review only (no AVD).

### G5 – NvAsr session lifecycle (effort high, Fable) – risk medium-high, the recitation core
| # | Where | Problem | Fix |
|---|---|---|---|
| 1 V | `NvAsr.java:82-98,238-276` | stop → start inside one 100 ms read: the old thread sees `on` true again and keeps going, a second `AudioRecord` starts → two recorders, every piece decoded twice | session generation counter captured by the thread and by queued `emit`s; `listen()` refuses while a thread is alive |
| 2 V | `NvAsr.java:244` | `mic.startRecording()` outside the try → uncaught exception on a raw thread = app crash when another app holds the mic | inside the try, report `state:error:mic`, reset `on` |
| 3 V | `NvAsr.java:249-250` | negative `read()` (dead object) spins at 100% CPU forever | break + `state:error:mic` |
| 4 V | `MainActivity.onPause/onStop` | native mic keeps recording in the background | `nv.stop()`/`recite.stop()` in `onStop` |
| 5 V | `NvAsr.java:181` | `shutdown()` closes the ORT session while the worker may be inside `run` | close on the worker / await termination |
| 6 V | `NvAsr.java:192-216` | failed join leaves `nv.onnx.part`; a model that fails `createSession` stays "ready" forever | delete tmp on failure; delete `nv.onnx` when the session cannot be created so the page offers the download again |
| 7 C | `NvAsr.java:336-341`, `ReciteBridge.java:40-73` | tensors leak on a throwing decode; double `start()`/pending `later()` restarts | try/finally; ignore start when on, cancel pending callbacks |
Check: emulator + **phone test by the user** (needs the real mic and the model pack): rapid mic on/off ×10, start
while another recorder app holds the mic, Home during recitation → mic indicator off, one decode per piece
(`window.nvSeq` increments by 1). Word-verdict numbers must not move (no change to audio math).

### G6 – downloads and donation queue (effort high, Fable) – risk medium
| # | Where | Problem | Fix |
|---|---|---|---|
| 1 V | `EdStore.java:29,79-107` | `busy` is per instance: exit with Back during a download, reopen, resume → two threads write the same `.zip.part` | process-wide (static) download state + current-WebView reference for `tell` |
| 2 V | `EdStore.java:99-103` | disk-full `IOException` is treated as a network drop: 40 retries (~18 min) before "error" | check free space before `setLength`; fail fast with an "error:space" the page can show |
| 3 V | `Donations.java:121-167` | a 200 answer that names no clip re-uploads the same batch forever; any 4xx blocks the queue head until it fills | stop when a pass deletes nothing; drop the batch on 400/413 |
| 4 V | `DonateJob.java:19-41` | rescheduling during an upload starts a second upload thread on the same files | static lock around `upload` |
| 5 C | `Donations.java:73-84` | clip id = milliseconds (collision), flac written before json | json first, unique id |
Check: emulator: start edition download → Back ×2 → reopen → resume → finishes once and opens; airplane-mode
toggle mid-download; fill-disk case by code review. Donation paths by code review + relay dry run only if the
user's key is present (never committed).

### G7 – build scripts and web build (effort low-medium, Sonnet + Fable review) – risk low
| # | Where | Problem | Fix |
|---|---|---|---|
| 1 V | `build.sh:47` | under `set -e`, no `keys/donate-key.txt` → script dies silently before its own warning | `|| true` in the substitution |
| 2 V | `sw.js:3` | precache list misses scripts `index.html` loads (`editions/*.js`, `books/index.js`) and lazy files → web build breaks offline | add them; bump cache name |
| 3 C | `build-win.py:19`, `build.sh` default jar, `:71` | lexicographic platform sort (`android-9` > `android-36`), default `android-23` jar cannot compile, `| head` under pipefail | numeric sort, default android-34, drop the pipe |
| 4 C | both scripts | a missing edition folder is skipped without a word | print a clear warning (not fatal: Play build drops harmain on purpose) |
Check: `build-win.py` builds and `apksigner verify` passes; `sw.js` list checked by a 5-line script against `web/`.

### G8 – deferred, needs measuring or the user's decision (not fixed in this pass unless approved separately)
- Performance: `reciteHear` re-normalises the whole surah per partial in text mode (`app.js:860,2384`), `rdPick` scans
  6236 rows per alternative (`2639`), vertical view builds 604 pages at once (`1055`). Measure on the phone first.
- `asr.js` is unreachable since 5.4 (`asrModel()` returns null, `app.js:2656`): its bugs are not fixed; removing the
  file and its `<script>` is a separate decision.
- i18n: ~13 `confirm()`/`prompt()` texts and 3 toasts miss the English table; ~121 table keys look unused
  (`tools/qa/i18n_scan.js` to confirm). Landscape left/right safe-area insets.
- Auto-resume of a partial edition download on mobile data (`app.js:476`); native consent flag for donations.

## Dropped after verification
- "Home mic stops right after finding the ayah in text view" (`app.js:2558/2686`): intended, the comment says following
  runs on the mushaf only.
- Permission request-code collisions, PendingIntent flags, notification channels, `ShareProvider` path handling,
  `EdStore` zip-slip, `AudioCache` path check: checked, correct.
- Exact-alarm permission never requested: false, `#prExact` → `AppBridge.askExactAlarms()` (`app.js:3979`).

## Execution rules (after approval)
- Order G1 → G7; a checkpoint + Resume line in `progress.md` after each group; `get_usage` between groups, stop and
  save at 99% weekly. Copy this plan to `plans/code-review-plan.md` and add it to «اللي لسه» in `progress.md` first.
- Models: G1/G7 edits qk-dev (Sonnet), every diff reviewed by Fable; G2–G6 written by Fable; QA runs qk-qa (Haiku).
- QA per group touching `web/`: `ED=<edition> node tools/qa/ui.js` one edition at a time in the background, all four
  0 FAIL (kfgqpc/harmain 287, kfold/shamarly 280; new cases raise the totals) + `python tools/qa/data.py web`.
  Java groups: `build-win.py` + `Phone_API35` smoke; results in `QA-checklist.md`.
- Never commit APKs, keys, models, `tools/qa/ui-results.json`, or the untracked logs/screenshots already in the tree.
- Needs the user afterwards: phone test of G5 (mic) and the decision on G8. No release without full QA, signer
  7d8b31d2 and the user's word.
