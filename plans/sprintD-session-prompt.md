# Sprint D: session prompt (2026-11-08)

Keep working on Quran Karim (`D:\Quran App\quran-karim`) in **Sprint D = release 5.18**.

## Rules
The rules are in memory and in the SessionStart hook. In short:
- First reply: restate the session rules briefly.
- Write to the user in Egyptian Arabic in Arabic script. Technical terms only in English.
- The user often follows on the phone through Remote Control. Keep each message short and readable on a phone.
- Pick the model and effort per step.
- Do a goal check before each step.
- Write checkpoints and the Resume line in `progress.md`.
- **Stop when usage reaches 82%.** Check `get_usage` first.
  - The weekly limit resets on 2026-11-10 19:00 UTC.
  - If the weekly usage is already 80% or more, tell the user. Then only prepare: read the code and write the plan into `progress.md` until the reset.
- At 300k context, back up and move to a new session.
- **Latency and recognition speed matter as much as accuracy.** Do not ship anything that makes recognition slower.

## Authority
The user gave full authority to finish Sprint D without asking. That covers:
- design choices
- commits and pushes to `main`
- building
- installing on the phone bee81250
- full QA

Still not without the user's own word:
- a GitHub release (the user asked for one for 5.17 and 5.17b, so ask at the end)
- Play Console
- iOS
- G8 upload
- changing the model pack on `editions`

## State now
- **5.17b** is pushed (`821d357`) and released on GitHub (v5.17b).
  - versionCode 64, sw `quran-v59`, signer 7d8b31d2.
  - Full QA passed: ui.js 271/0.
  - bee81250 was not on adb, so it is not installed from the PC. The user downloads it from GitHub.
- The user has not yet reported the phone test of:
  - pack v3 + S6
  - 5.17/5.17b (`QA-checklist.md`, sections 5.17 and 5.17b)
- **If the user reports a problem, fix it first.**
- The user's notes on 5.17 were applied in 5.17b. Read `progress.md`, the «Sprint C = 5.17» part.
  - S3 mutashabihat: letter-exact choices, the ayah before as context, word-for-word repeats ask for the next ayah, telling words marked.
  - S5 talqin on a group of ayat.
- G10 (noise training) failed its gate. Its recipe needs a rethink, as a separate track on the GPU.

## Sprint D (in this order)
Specs are in `plans/5.11-plan.md`, items 10–12 («تفاصيل كل بند»).

1. **S9: word meaning on tap.** Effort medium.
   - In the text view, tapping a word opens a popup from `books/words/<s>.js` and `books/lex`, using the same lookup as `wordsTab`.
   - On kfgqpc pages, use the word boxes if they exist. Otherwise text only.
   - It must not break the existing tap actions (the ayah menu, the hifz reveal, the recite flows).
2. **S10: backup reminder.** Effort low.
   - `exportBackup` uses `AppBridge.shareFile`, and Drive is reachable from the share sheet.
   - Add a monthly reminder through `syncAlarms`.
   - Show «آخر نسخة من # يوم» in Settings.
3. **S11: teacher and student.** Effort medium.
   - A `QK2:` code in the same style as `familyCode`/`shareText`. It carries the test result, the range and the wrong ayat.
   - A «طلابي» screen where the teacher pastes codes. Keep it offline-first: no server.

For every feature:
- Add a Playwright check in `tools/qa/ui.js` (group `G518`).
- Add i18n strings in `web/i18n.js` (a `D518` block), then check with `tools/qa/i18n_scan.js`.
- Add phone-test lines to `QA-checklist.md`.

## Release 5.18 (effort low)
- Bump the version:
  - `android/AndroidManifest.xml`: versionName 5.18, versionCode 65
  - the version text in `web/index.html` (2 places)
  - `web/sw.js` → `quran-v60`
- Build: `.venv\Scripts\python.exe -I build-win.py`.
  - The output is `quran-karim-v5.18.apk`.
  - Verify the signer is 7d8b31d2 with `apksigner verify --print-certs`.
- Full QA. Set `NODE_PATH=$(npm root -g)/@playwright/test/node_modules`.
  - `py -3.11 tools/qa/data.py web`
  - `ED=kfgqpc node tools/qa/ui.js`
  - `matrix.js`, `donate.js`, `recite_sim.js`, `i18n_scan.js`
  - Maestro: `bash tools/qa/maestro/avds.sh <apk>`
    - Kill any running emulator first.
    - Afterwards, kill the Phone_API35 emulator it leaves running.
- Install on bee81250 with `adb install -r` (data kept). If the phone is not on adb, say so and leave the APK ready.
- Write a short HTML report in Egyptian Arabic at `plans/5.18-report.html` and send it with SendUserFile.
- Commit + push. Then ask whether to publish a GitHub release.

## Pitfalls
- Never commit model files, keys or APKs.
- Keep CRLF in the Java files. Check `git diff --stat`.
- In Git Bash, a heredoc with `'''` inside a `py - <<'EOF'` failed once. Write longer Python patch scripts to the scratchpad and run them from there.
- Multi-line patches: assert each `old` string occurs exactly once before replacing it.
