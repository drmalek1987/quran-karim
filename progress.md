# Voice donation v2: progress

Branch: `donations-v2` (one commit per checkpoint, not pushed). Full plan: `C:\Users\Compumarts\.claude\plans\pasted-content-id-fa69-mighty-bubble.md`.
To resume: open Claude in `D:\Quran App\quran-karim` and say «كمّل من progress.md»; start at the first checkpoint not `done`.
Decisions: train the NVIDIA FastConformer only; FLAC; free protection only (no Play Integrity); no gender or age questions.
Models: Opus for relay, Java, audio and training; qk-dev (Sonnet) for UI, i18n and text; qk-qa (Haiku) for builds and tests.

| CP | What | Status | Date | Verified |
|----|------|--------|------|----------|
| 0 | Branch + this file | done | 2026-11-02 | - |
| 1 | Relay: HMAC, persistent limits, server ASR check, batched commits, /delete, legacy /clip | done | 2026-11-02 | pytest 8/8 (tools/relay/test_relay.py) |
| 2 | Android: seq-matched audio, quality + trim, FLAC, JobScheduler batch upload, forget, version | done | 2026-11-02 | FLAC round-trip 5/5 bit-exact; javac of all sources OK (only R missing outside the real build) |
| 3 | Web: v2 labels (s/a/w, hyp, model, app), «أنا قريت صح», settings counters, mobile data, delete | done | 2026-11-02 | node --check app.js/i18n.js; UI run in CP6 |
| 4 | Privacy policy AR/EN, store/data-safety.md, PLAY-REVIEW, SRS | done | 2026-11-02 | text review only |
| 5 | tools/asr/gpu/nv_train.py (donations + tlog, device split, gate), export_onnx --ckpt, migrate_legacy.py | done | 2026-11-02 | py_compile only; GPU dry run in CP6 |
| 6 | Verification: pytest, FLAC round-trip, APK build, ui.js mock, emulator smoke, nv_train --dry-run | done except nv_train DRY | 2026-11-02 | relay 8/8, FLAC 5/5, APK OK (cert 7d8b31d2), donate.js 10/10; NOT done: phone/emulator smoke, nv_train DRY |
| 7 | Deploy relay, migrate, bump 4.9: only with the user's OK | doing | 2026-11-02 | done (Play steps wait for the user) | relay live + verified, legacy migrated, 4.9 APK built with key |

## Wire protocol (shared by relay and app)
- `POST /batch` multipart: `device`, `ts` (unix seconds), `sig`, then per clip i: `meta<i>` (JSON) and `audio<i>` (FLAC).
  `sig = hex(HMAC-SHA256(APP_KEY, ts + "|" + device + "|" + sha256hex(meta0) + sha256hex(audio0) + ...))`.
  Reply 200 `{"results":[{"i":0,"ok":true}|{"i":0,"ok":false,"reason":"..."}]}`: the phone deletes every listed clip and counts rejects.
  401 bad sig/ts, 429 limit, 5xx: keep everything and retry later.
- `POST /delete` form: `device`, `ts`, `sig = HMAC(APP_KEY, ts|device|delete)`.

## Log
- CP0 2026-11-02: branch created from main 5980c5c.
- CP1 2026-11-02: tools/relay/app.py rewritten, test_relay.py added (8 pass, offline fakes). Notes:
  - Legacy /clip (4.8) now stores under the same clips/<devhash16>/ layout (no separate legacy/ folder); meta v=1.
  - Server ASR loads phone/model.json + phone/model.int8.onnx from MODEL_REPO (default DrAbdelraman/quran-train-progress,
    uploaded by export_onnx.py). If it cannot load, clips are stored with srv_cer=null and training must skip them.
  - Space secrets needed at deploy (CP7): HF_TOKEN (write), APP_KEY (same value as the app's key, set in CP2).
  - /delete only covers the new layout; old clips/YYYYMMDD/* need migrate_legacy.py (CP5) first.
  - Phone HTTP read timeout must be >= 60 s: replies wait for the shared commit (WINDOW=20 s).
- CP2 2026-11-02: FlacEncoder.java, Donations.java (trim/quality/save/stats/upload/forget/deviceId), DonateJob.java (JobScheduler),
  manifest <service DonateJob>, NvAsr (finals by seq, window.nvSeq set before each final onRecite; new bridge: donate2(meta,seq) ->
  ""|reason, sendDonations(mobile), donateStats() -> {"waiting","rejected"}, forget(oldIdsCsv) -> window.onDonateForget(ok);
  old donate/upload/donated removed, so the page is broken until CP3), AppBridge.version() -> "4.8 (39)".
  build-win.py / build.sh write <OUT>/gen/com/quran/karim/DonateKey.java from DONATE_KEY+DONATE_URL or keys/donate-key.txt.
  The key is NOT made yet: at CP7 create keys/donate-key.txt (random) and set the same value as APP_KEY in the Space.
- CP3 2026-11-02: app.js donation settings (stats line, #donateMob Wi-Fi/mobile, #donateDel -> NvBridge.forget(q.donateId)
  + window.onDonateForget), donateSend -> NvBridge.sendDonations(mobile); hifz test spans carry data-a/data-w; htvDonate() sends
  v2 meta with window.nvSeq; #htFix «أنا قريت صح» after a piece with red words (unmiss + kind "corrected"). index.html hint
  rewritten + new rows; i18n.js D49 block (English for all donation strings).
- CP4 2026-11-02: privacy-policy.html (AR+EN donation section, dated 2 Nov 2026; says dataset is PRIVATE: change if CP7
  decides public), store/data-safety.md (Play form answers), listing.md + PLAY-REVIEW.md (Data safety must be updated in Console
  and the new policy re-uploaded), SRS.md 4.6.
- CP5 2026-11-02: tools/asr/gpu/nv_train.py + nv_train.bat (CTC-only fine-tune, fp16, lower half of encoder frozen, RNNT
  branch frozen, BATCH_SEC=60 x ACC=2, LR 1e-5, 30% tlog via gpu_train.fetch/split, donations split by device hash 10%,
  targets = norm(text) i.e. undiacritised (the app compares normalised words anyway), gate: don_test better than base and
  tlog/ha/corrected not worse than +0.3 pts -> nv_out/best.nemo). export_onnx.py/export.bat take --ckpt <nemo> -> phone_ft/
  (relay keeps using the base phone/ model as its checker). tools/relay/migrate_legacy.py (dry run default, --apply).
  NeMo is NOT installed on this PC yet (tools/asr/gpu/.venv missing): the .bat installs it on first run.
  Shipping a fine-tuned model to phones = repack phone_ft/model.int8.onnx into the asrnv/asrnvp zips (editions branch): manual.
- CP6 2026-11-02: verified
  - relay: 8/8 (uv run ... pytest -q tools/relay/test_relay.py); FLAC: 5/5 bit-exact (py -3.11 -I tools/qa/flac/flac_roundtrip.py).
  - APK: .venv\Scripts\python.exe -I build-win.py -> quran-karim-v4.8.apk (overwrote the old 4.8 file), signer SHA-256 7d8b31d2...,
    manifest has DonateJob with BIND_JOB_SERVICE. Built WITHOUT a donation key (uploads off) since the key is a CP7 step.
  - UI: NODE_PATH=$(npm root -g) node tools/qa/donate.js -> 10/10 (mocked bridges: v2 label + nvSeq, «أنا قريت صح» incl. a
    misheard LAST word (fixed in app.js: htv.far), phone recogniser never donates, settings stats/mobile/delete).
  - NOT done, needs the user / a phone: (a) real-phone or emulator run with the NVIDIA model downloaded and a key + local relay
    (DONATE_URL=http://10.0.2.2:8000, uvicorn app:app); (b) DRY=1 nv_train.bat (installs NeMo, needs hf_token.txt and clips in the
    dataset); (c) relay server-ASR features vs NeMo on real clips (needs MODEL_REPO access).
- NEXT (CP7, each step needs the user's OK): make keys/donate-key.txt (random 32+ chars) and set the same value as APP_KEY secret
  in the Space; push tools/relay/{app.py,requirements.txt} to the Space; decide dataset private (policy says private);
  run migrate_legacy.py (dry run first); bump to 4.9 (manifest, index.html:153/186, sw.js cache name); re-upload privacy policy;
  update Data safety in Play Console from store/data-safety.md.
- CP7 2026-11-02: user said start. keys/donate-key.txt created (gitignored, random 43 chars). No HF token on this PC, so the
  Space upload waits for the user to run `uvx --from huggingface_hub hf auth login` (write token). After that: upload
  tools/relay/app.py + requirements.txt to Space DrAbdelraman/quran-voice-relay and set Space secret APP_KEY from the key file
  (api.add_space_secret, value never printed), then check GET / and that POST /batch answers 401 to an unsigned request.
- CP7 2026-11-02 (cont.): logged in as DrAbdelraman (write token). Space files were identical to main, so replaced with v2
  (Space commit f44da94dc1); APP_KEY secret set from keys/donate-key.txt. Space RUNNING. Live: GET / 200, bad signature 401,
  but signed /batch and /delete -> 500: the Space secret HF_TOKEN is rejected by HF ("Invalid username or password"),
  so the relay cannot read/write the dataset (the 4.8 relay had the same problem; dataset has only 4 clips, last 2026-10-31;
  4.8 phones keep clips on 5xx, so none were lost). Dataset is private (matches the policy). Model repo has phone/*.
  NEXT: user makes a fine-grained token (write: datasets/DrAbdelraman/quran-voice-donations, read:
  datasets/DrAbdelraman/quran-train-progress) and puts it in the Space secret HF_TOKEN; then rerun the live check
  (signed batch with a 0.2 s + a 2 s sine clip from device qa-test-device-0001 -> expect reasons length + mismatch, then /delete).
- CP7 2026-11-02 (cont.): user replaced the Space HF_TOKEN. Live check OK: signed batch -> 200 with reasons
  [length, mismatch] (the server ASR model loaded and ran), state/limits.json committed, /delete -> 200, no test files left.
  First signed batch took 52 s (20 s commit window + first model use); the phone waits up to 90 s. Not yet checked live: a
  real recitation being ACCEPTED (needs a real clip). Left in CP7: migrate_legacy.py (4 old clips), bump 4.9 + build with the
  key, re-upload privacy policy, Play Data safety.
- CP7 2026-11-02 (cont.): migrate_legacy.py --apply: 4 old clips (one device, 2026-10-31) now under clips/d145050b4b6f346d/,
  labels have no raw device id, audio intact (1.7-12 s, 16 kHz); no old-layout files left. Left: bump 4.9 + build with the key,
  re-upload privacy policy, Play Data safety.
- 2026-11-02: user says the app is NOT on Play Console yet; Play steps (policy upload, Data safety) wait until the user says
  so. Do not treat them as pending blockers.
- CP7 2026-11-02 (cont.): bumped to 4.9 (versionCode 40; index.html about text AR/EN; sw.js quran-v35). Built
  quran-karim-v4.9.apk with keys/donate-key.txt: no "no donation key" warning, key + relay URL present in classes.dex,
  signer SHA-256 7d8b31d2..., badging versionName 4.9 / versionCode 40.
  Still to try on a real phone: download the NVIDIA model, turn donation on, do a voice hifz test on Wi-Fi, then check the
  settings counters and that a clip arrives in the dataset (and that «امسح كل تسجيلاتي» removes it).
  Branch donations-v2 is not merged or pushed.
- Phone test 2026-11-02 (4.9 on the user's phone, device hash 0e04fff5e5115c5a): Wi-Fi upload works. 17:25 one clip refused
  (reason only in the phone's counter), 17:52 one clip stored: kind corrected, s2 a22 w17-22, 4.3 s FLAC, app "4.9 (40)",
  q rms -31.4 / snr 15.2, phone hyp and server srv_hyp both equal the text, srv_cer 0. Not yet confirmed: «امسح كل تسجيلاتي»
  (the clip is still in the dataset). Open question: why the piece was "corrected" when both models heard it right (user may
  have tapped the button just to try it).
- Delete test 2026-11-02 21:21: «امسح كل تسجيلاتي» made two "delete on request" commits (the phone's current id and its old 4.8
  q.donateId). Both 0e04fff5e5115c5a and d145050b4b6f346d (the 4 migrated 4.8 clips, from the same phone) are gone; the dataset
  now holds only .gitattributes + state/limits.json. Phone-side delete flow verified end to end.
  Left: DRY=1 nv_train.bat once clips exist; merging donations-v2 into main (user's call); Play steps when the user says.
- 2026-11-02: donations-v2 merged into local main (merge commit, pushed to origin/main as 3f7459a on 2026-11-02).
- 2026-11-04: user confirmed the 17:52 "corrected" clip was only a button test (not a model issue). Question closed.

# Audit 2026-11-04 (quality check + status report, requested before any new work)
- A1 automated QA (qk-qa, Haiku): data.py, ui.js (kfgqpc), donate.js, relay pytest, APK 4.9 signer/badging. — done: ui.js kfgqpc 153/153 + shamarly 153/153 (needed a scratch copy: hardcoded /mnt path, require('playwright')); donate.js 10/10; relay 7 pass 1 skip; APK 4.9 signer 7d8b31d2 OK, vc 40, target 36; data.py CRASHES when web/pages (Haramain images) is absent -> 0 checks ran.
- A2 docs review (Opus): BACKLOG, SRS, plans/checklist-31-oct, QA-checklist open items, IDEAS. — done (BACKLOG checkboxes for 27/31 Oct are stale: QA-checklist 4.6 says the 31 Oct list is done)
- A3 Play readiness: store/ (listing, policy, data-safety, PLAY-REVIEW, licences, permissions), PLAY build + AAB path. — done. Findings: PLAY=1 drops only Haramain (adhan sounds, Darwish, Ibn Ashur still in); keys/upload.jks not on this PC; build-aab.sh not ported to Windows; ONNX Runtime .so downloaded at runtime (asrnv.zip) = Play policy risk (no executable code from outside Play); CONTACT_EMAIL placeholder in privacy-policy.html and listing.md; PLAY-REVIEW 64-bit note outdated.
- A4 report to the user in Arabic: progress %, open questions, items to improve, what is missing, Play steps. — done (sent in chat 2026-11-04)
Resume: start at the first A-item not marked done. No code changes in this audit.
Resume: audit finished. Next work waits for the user's pick from the report (goal check first, see memory quran-karim-goals).

## 5.4 — phone checklist (17 items) + quranLocate for index/search mics (plan: ~/.claude/plans/wild-pondering-stallman.md)
CPs: CP1 mics->quranLocate, CP2 quiet/noise (bench first), CP3 asrStats, CP4 UI batch (qk-dev), CP5 wird+hifz map auto,
CP6 drop whisper models + HF mirror (ask before upload), CP7 build 5.4 + adb install + QA + HTML report.
- CP1 done (goal check: yes, ayah id is the weakest number). voiceLocate(text) = quranLocate on one-shot text, ayah of
  the first word heard right (quranLocate now also returns f). Index mic adds up utterances until clear (fallback
  voiceAyahs after 3 finals or on end); search mic lists the located ayah first. tools/asr/eval/locate_eval.js on
  rows-pre3 (393 rows with ayat): voiceAyahs 78.6% -> app combined 84.7% (tlog 84.3->93.3, reciters 86.9->93.8,
  HA 57.6->58.6: short fragments, wait for more words); quranLocate when it answers: 259/262 right.
Resume: CP2.
- CP4 done (qk-dev): index result under the header (scrollUnderBar), auto-scroll -> fullscreen after 3 s, fullscreen
  slides (transitions, reduced-motion off), no padding + mic stays, tabs المصحف/الصلاة/الأذكار/المزيد, «مع المغرب»
  fixed (applySettings ran before PR_METHODS existed and overwrote themeNow; sunCheck at start + visibility/focus),
  page crop (EDS.crop %, clip-path, boxes untouched; kfgqpc 3/5/3/5, kfold 5/3.5/5/3.5, shamarly 3/2/6/8.5 from p4).
  Screens in the session scratchpad shots/. Not checked on a phone yet.
- CP5 done: wird page you stay on counts after 20 s (last wird page no longer needs a turn past it); every recited
  ayah -> q.hifzAyat {d, ok} (reciteHear + hifzTestDone), hifz map colours pages from it (partial/review/good).
- CP6 done (HF mirror: user said not now): whisper models dropped (ASRM only asrnv, packs asrnv+asrnvp, asrModel null),
  old asrbase/asrft/asrrt files removed at start, q.asr moved to asrnv/phone.
Resume: CP2 bench results (out/cp2*), then CP3 stats, CP7.
- CP2 done: bench.py --vmin/--pgain/--noise/--snr. NvAsr VMIN 0.006->0.0015 + louder() (piece to -30 dBFS, <=30x) before
  decode. ALL rows (pre3 settings, DP verify): clean 89.9->90.1, quiet -50 dBFS 5.8->73.9 (vmin .003: 66.8), white SNR10
  74.3->74.6, babble SNR5 62.1->62.1 (another reader: needs CTC/training). Logs/summaries in qtrain/eval/out/cp2/.
- CP3 done: q.asrStats per day (u, w, ok/bad, rh/rm, loc/lost), Settings #asrStats line (last 7 days).
- CP7: 5.4 (vc 45, sw quran-v40) built, signer 7d8b31d2, installed on bee81250, opens, dark after maghrib, tabs OK.
  QA: ui.js 153/153 (2 tests updated: page tap point inside the crop; NVIDIA mic test mocks NvBridge), donate.js 15/15,
  data.py web 28/28, smoke 0 JS errors, locate_eval 84.7. parity.js diff 24 is the same on 5.0/HEAD (not a regression).
  Report: D:\Quran App\report-5.4.html. Not committed/pushed yet.
Resume: user tests 5.4 on the phone (report's list); then commit+push; next P1b-port (CTC) for noise/other reader.

## 5.5 — phone feedback on 5.4 (2026-11-04)
User: map not filled after recitation, crop to the frame (drop hizb marks), hifz page re-order + mini map, surah on the
map at the end of a test, last ayah of short surahs, vertical mode: fs moves the page / mic finds ayah but no jump,
back button (<=2 back then home, double back to exit), caption follows reading, "full QA every time" (memory saved).
- done: vertical fs keeps the anchor page (fsSet), far mic jump instant + realign + hash; htv auto-finish at the end
  (ptr >= n-1) -> htDone: hifzMark per ayah + hifzLog surah; mushaf hifz reveals line by line; caption capFollow;
  kfgqpc/kfold crop to frame [8,3,8.6,15]/[5.4,5,6.4,13.3] mirrored on odd pages (cropFrom 3); navBack + MainActivity
  "exit"; QA-checklist 5.0-5.5 + full-QA rule.
- in progress: hifz test page re-order (qk-dev), ui.js G18 tests (qk-dev).
Resume: when both agents finish -> full QA (every feature) -> build 5.5 -> install -> phone pass -> report.
- 5.5 built (vc 46, sw quran-v41), signer 7d8b31d2, installed on bee81250, opens without crash. Hifz test page
  re-ordered (hifzPageColors shared with the map, hifzMini card, review chips). FULL QA: ui.js 166/166 (G18 = 14 new
  checks; 3 old tests updated for the frame crop and the new back), donate.js pass, data.py 28/28, locate 84.7.
Resume: user tests 5.5 on the phone; then commit+push 5.4+5.5; next P1b-port (CTC) for noise / another reader.
- 5.6 (vc 47, sw v42): back = 1 step then home, two backs <1.5 s anywhere exit; auto fs 5 s after opening the mushaf,
  any touch/scroll restarts it; vertical: bar floats (fixed + padding) so fs slides smoothly, pages cropped to the frame
  (vp-c clip box, .page-box keeps image coords); crop leaves ~2 px white outside the frame; page turn (slide/curl)
  shifts the incoming page by cropDx so no margin shows; hifz test adds the surah to the map only when every ayah was
  tested; fixed a CSS brace I broke (rd-cap max-height lost). FULL QA: ui.js 166/166, donate 15/15, data 28/28.
  Installed on bee81250. Not committed.
- RESTORE POINT 2026-11-04: tag v5.6-restore (commit c192094, pushed) + APK copy D:\Quran App\restore\v5.6\.
  Roll back: git checkout v5.6-restore (or git revert the P1b commits) and adb install -r that APK.
Resume: P1b-port in a NEW session after the 5-hour usage reset (this one is at 342k context).

# P1b-port — CTC verdicts in the app (5.7), started 2026-11-05 (plan: ~/.claude/plans/inherited-humming-robin.md)
Goal check: yes — bench CTC 94.5 -> 97.2 word verification, the biggest measured lever. Hybrid: rLocal places a final
NvAsr piece, CTC forced alignment (Java, on the piece's log-probs) re-judges the words of its span.
CPs: CP1 bench hybrid (p1b_port_eval.py) · CP2 Java CTC + bridge + parity · CP3 JS units/ctcJudge + parity ·
CP4 version 5.7 + QA-checklist · CP5 build/signer/full QA/phone · CP6 commit, push, release v5.7.
Resume: CP1.
- CP1 done: tools/asr/eval/p1b_port_eval.py (+ rlocal_spans.js = the app's rLocal piece by piece), 373 clean clips,
  per-piece log-probs (out/lp). verify / right accepted / wrong caught:
  rLocal only 94.7 / 94.2 / 99.7 · CTC overrides span 96.3 / 96.2 / 98.1 · CTC only turns wrong->right **96.9** / 96.8 /
  98.1 (HA 91.4->96.0, tlog 95.8->98.0, reciters 94.5->96.0) · +-1 edge word: no gain. d=3: 96.7, d=5: 97.1 (d=4 kept,
  picked before). Chosen: on a final piece, words rLocal judged wrong in its span become right if CTC matches them.
Resume: CP2 (Java Ctc.java + NvAsr bridge + parity harness).
- CP2 done: android/src/.../Ctc.java (port of ctc.py group + forced_words), NvAsr keeps the grouped log-probs of the last
  4 final pieces; bridge vocab(), ctcSetup(forms), ctc(seq, words) -> [1|0]. tools/asr/eval/ctc_java_parity.py +
  CtcTest.java: Java == Python 80/80 cases, 755/755 words, ~1.3 ms per piece on the PC.
- CP3 done: web/app.js ctcUnits (port of p1b_verify units, Uthmani words -> Q.q simple spelling), ctcReady, ctcJudge
  (final pieces only, rLocal's wrong words in the span turn right when CTC matches; asrStat "ctc"), used by reciteHear
  and the hifz-test voice mode (htv.keys). ctc_units_parity.py/.js: token forms 1024/1024 same; ayat 6123 same, 85 differ
  = Python's simple text has the basmala glued to surah first ayat (+17:110), app's units are the right ones.
Resume: CP3b ui.js test with a mocked NvBridge.ctc, then CP4 version 5.7.
- CP4 done: 5.7 (vc 48, sw quran-v43), QA-checklist 5.7, Settings stats show words fixed by the CTC check.
- CP5 done: APK signer 7d8b31d2 OK; FULL QA: ui.js 168/168 (G19 = 2 new CTC checks), donate.js 15/15, data.py 28/28,
  locate_eval 84.7 (same), parity.js 722/24 (same as 5.0-5.6). Emulator Phone_API35: installs, opens, no crash.
  Phone (bee81250) not connected: NOT verified on a real phone (needs the model + mic).
- CP6: commit + push + GitHub release v5.7.
Resume: user tests 5.7 on the phone (hifz test by voice with a deliberate wrong word; Settings stats "ctc" count).
 Next candidate: CTC for ayah id (p1b_idc) in quranLocate for short fragments (HA ayah id 85.7%).

## Queued (user asked 2026-11-05): 5.8 — drop the duplicate model parts after joining (~132 MB saved on the phone)
Found: NvAsr.load() joins asrnv/a.bin + asrnvp/b.bin into asr/nv.onnx and keeps both parts -> the model is stored twice
(~264 MB instead of ~132). Phone total with one edition + model: ~360-370 MB now -> ~230-240 MB after. APK size unchanged (46.9 MB).
Change (NvAsr.java only):
- load(): if both parts exist (first run or a new model download) join to nv.onnx.part -> rename -> delete a.bin/b.bin;
  else use nv.onnx as is. An interrupted join leaves the parts, so it re-joins next time.
- ready(): libonnxruntime.so + vocab.json exist AND (nv.onnx exists OR both parts exist).
- EdStore install state uses <id>.ok markers (unaffected); remove() already deletes nv.onnx.
QA: full suite + check nothing in Settings reads the part files (grep found none); phone: update over 5.7, mic works,
files/ed/asr has no a.bin/b.bin, storage drops ~132 MB; remove/re-download model still works.
Resume: run as its own step in the workflow (goal check: side work for storage, not recognition — do it after the
5.7 phone test unless the user says otherwise).

## 5.7 phone test — 2026-11-05: user says OK, no notable errors (installed on bee81250, signer 7d8b31d2).
Goal check for next: 5.8 storage fix = side work (cheap, user-queued); P0b held-out + noisy test set = goal work
(needed to prove >95% honestly; 96.9% was tuned on the same 373 clips).
Resume: 5.8 storage fix (NvAsr.java) then P0b — or P0b first, on the user's word.

## 5.8 — storage fix — done 2026-11-05
Goal check: side work (storage, user-queued), cheap; recognition unchanged.
NvAsr.load(): joins a.bin+b.bin only when both exist, deletes them after a size-checked join; ready() accepts nv.onnx alone.
vc 49, sw quran-v44. Signer 7d8b31d2. QA: ui.js 168/168, donate 15/15, data 28/28, javac OK; locate/parity skipped
(rows files not on disk; matcher untouched). Phone bee81250: installed over 5.7, mic used by the user, app storage
(Settings > app info) 422 MB vs 501 MB from diskstats before (stale stat; release build not debuggable, so files not listed).
Resume: push + release v5.8 (needs the user's OK), then P0b held-out + noisy test set.

## 5.11 G3.7 — welcome step: recitation model download — done 2026-11-06
Goal check: offers the recognition model on the first run (no model = no recognition) and starts the consent flow (G3.8) = near-complete app + recognition reach. Effort medium (G3).
Welcome has 4 steps; step 3: terms switch gates «حمّل النموذج», separate unticked donate opt-in, saves q.modelConsent + q.donate, then needAsr("asrnv"). ui.js 181/0. Phone check queued in QA-checklist (5.11).
Resume: G3.8 consent (model blocked until q.modelConsent; donate controls move from Settings into the privacy box + chip), then G3.9 mic tips/test.

## 5.11 G3.8 — model consent + privacy box — done 2026-11-07
Goal check: required, clear consent before the model runs and a separate opt-in for voice donation = trust for the near-complete app and a clean, consented data stream for the >95% recognition work (G8/G10). Effort medium.
consentDlg (terms required, donate separate + unticked) gates micGate on the phone, incl. readers upgrading with the model; donate tools moved to «الخصوصية وتسجيلات الصوت» (+ chip). User edits via a forked session: no «not agreed yet» line, shorter donate hint without the model name. ui.js 183/0; donate.js 14/15 (pre-existing «phone recogniser» check, to fix in 5.11 QA).
Resume: G3.9 mic tips + mic test (micTips, q.micTest, Settings row «اختبار المايك»).
- 2026-11-07 user fix: «امسح كل تسجيلاتي» kept in one place only (privacy box, under the donate choice, small .link-sm); about text (ar+en) now points to Settings › الخصوصية وتسجيلات الصوت. ui.js 183/0.
- 2026-11-07 user fixes (emulator review): no «وافقت على الشروط» line at all (consent kept silently in q.modelConsent); «التعرّف على التلاوة» = closed box (state on the title line, tap -> model card with download/delete; download goes through consentDlg) — also fixes the duplicate id asrDl (button + card); «ألوان المصحف الموضوعي» on/off beside the label like «ألوان التجويد». ui.js 185/0.
Resume (2026-11-07): new session from plans/5.11-session-prompt-3.md — G3.9 next, then the carried-over 5c/5d/G1.8 + donate.js fix, then 5.11 build/QA.
G3.9 ✅ (ui.js 186/0, donate.js all PASS after dropping the obsolete phone-recogniser check). Goal check: mic SNR test cuts noise-caused misrecognitions → toward >95%.
G1.8 ✅ English UI review (i18n_scan.js, 35 strings, harakat-rule fix; ui.js 186/0). Goal check: a complete app for non-Arabic readers.
Resume (2026-11-07): new session from plans/5.11-session-prompt-4.md — G2 5c/5d at effort high (measure headless Playwright + emulator CDP), then the 5.11 build + full QA.

## 5.11 G2 5c/5d — full-screen glide in both flip modes, one way only — done 2026-11-07
Goal check: a calm, jump-free reading screen is core to the near-complete app (user-reported twice). Effort high.
Cause: MainActivity pads the WebView by the system-bar insets, so immersive() grows (and, without a cutout, moves) the WebView after the CSS glide -> second glide the other way. Fix: AppBridge.insets() lets fsSet lay the page out for the final viewport (--vh) and pre-shift it (--fsdy) so ONE glide lands; cleared in the resize frame. Vertical: FLIP on the visible .vp-c, anchor kept. Measured per frame: headless 0/8 -> 8/8, emulator CDP 4/8 -> 8/8. ui.js 194/0. QA-checklist 5.11 section repaired (G3.9 line had been inserted after every line of the file).
Resume: 5.11 version bump (manifest done: 5.11/53; about text ar+en, sw.js cache) -> build quran-karim-v5.11.apk -> full QA (ui.js, donate.js, matrix.js, Maestro 4 AVDs, i18n_scan) -> then G4 (plan written under item 10).

