# Sprint C, session prompt (2026-11-08)

Keep working on Quran Karim (`D:\Quran App\quran-karim`) in **Sprint C = release 5.17**.

The rules are in memory and in the SessionStart hook:
- Write to the user in Egyptian Arabic in Arabic script. Technical terms only in English.
- The user is outdoors and follows this session on the phone through Remote Control. Keep each message short and readable on a phone.
- Pick the model and effort per step.
- Do a goal check before each step.
- Write checkpoints and the Resume line in `progress.md`.
- **Stop when usage reaches 82%.** Back up and write the next session prompt yourself.
- At 300k context, back up and move to a new session.
- **Latency and recognition speed matter as much as accuracy.** Do not ship anything that makes recognition slower.

**Authority:** the user gave this session full authority to finish Sprint C without asking. That covers: design choices, commits and pushes to `main`, building, installing on the phone bee81250, and full QA.

Still not without the user's own word:
- a GitHub release
- Play Console
- iOS
- G8 upload
- changing the model pack on `editions`

## State now
- 5.16d is built, QA passed, and it is installed on bee81250.
  - versionCode 62, sw `quran-v57`, signer 7d8b31d2.
  - It contains S6 «مش متأكد» (yellow, `CTC_UNSURE = 1.0` in `web/app.js`) and model pack v3.
  - Model pack v3 = L2 + Z1, 115 MB, in `asrnv3.zip` + `asrnvp3.zip`, already on `editions`.
- The user has not yet tested the model update on the phone (Settings › Downloads › «تحديث»). If they report a problem with it, fix that first.
- Z2 (int4) was rejected: the phone was 19–63% slower.
- Report: `plans/5.16d-report.html`. Checklist: `QA-checklist.md`.

## Sprint C (in this order; specs in `plans/5.11-plan.md`, sections 5, 6 and 8)
1. **S3: test on mutashabihat (similar ayat).** Effort high.
   - Data: `window.MUTASH` via `need("mut")`, the same way `mutashTab` loads it.
   - Question: the start of an ayah plus 3 choices for how it continues (the right one and the similar ones). Or by mic, using the existing matcher.
   - Errors go into `q.hifzAyat`, so they feed S1 and S2.
2. **S5: talqin mode.** Effort medium.
   - The reciter plays the ayah N times (`player.playRange`).
   - The ayah is shown and the user reads it.
   - The ayah is hidden and the user recites it by mic (reuse the `htv` voice path from `showHifzTest`).
   - Then the next ayah.
3. **S8: offline audio for a surah or juz, plus a sleep timer.** Effort medium.
   - The download goes through the `AudioCache.java` path, with progress and cancel.
   - Sleep timer options: 15, 30 or 60 minutes, or «آخر السورة». It stops `player`.

For every feature:
- Add a Playwright check in `tools/qa/ui.js`.
- Add i18n strings (`web/i18n.js`, then check with `i18n_scan`).
- Add phone-test lines to `QA-checklist.md`.

## Release 5.17 (effort low)
- Bump `versionName`/`versionCode` (63) in `android/AndroidManifest.xml`, the version text in `web/index.html`, and `web/sw.js` to `quran-v58`.
- Build: `.venv\Scripts\python.exe -I build-win.py`. The output is `quran-karim-v5.17.apk`. Verify the signer is 7d8b31d2.
- Full QA. The two Playwright scripts need `NODE_PATH` set to `$(npm root -g)` or `@playwright/test/node_modules`.
  - `tools/qa/data.py web`
  - `ED=kfgqpc node tools/qa/ui.js`
  - `matrix.js`
  - `donate.js`
  - `recite_sim.js`
  - `i18n_scan.js`
  - Maestro: `bash tools/qa/maestro/avds.sh <apk>`
- Install on bee81250 with `adb install -r` (data kept). If the phone is not on adb, say so and leave the APK ready.
- Write a short HTML report in Egyptian Arabic at `plans/5.17-report.html` and send it to the user with SendUserFile, since they are on mobile.
- Commit + push.

Never commit model files, keys or APKs. On Windows, keep CRLF in the Java files: a `sed -i` or a plain Python write turns `NvAsr.java` to LF, so check `git diff --stat`.
