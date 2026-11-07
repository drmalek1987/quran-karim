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

## 5.11 G4 + G5 — More menu in groups, one Stats screen — done 2026-11-07
Goal check: findable tools (hifz first) and one place for reading/hifz/recognition numbers = near-complete app; the recognition rings show where recognition is weak (noise, mic) -> supports >95%. Folded into the 5.11 build (not delivered yet) so the user gets one APK and one full QA. Effort: session at high (≥ low/medium needed).
G4: titled groups, odd group's first tile spans. G5: #/stats (reading, hifz, recognition, voice recordings on the phone), khatma link card, i18n for all new text + hifz-test strings (tr() matches «١٢. يوسف»). ui.js 196/0, i18n_scan clean (adds #/stats).
Resume: build quran-karim-v5.11.apk (manifest 5.11/53, about ar+en, sw quran-v48 already bumped) -> full QA (ui.js done 196/0, donate.js, data.py, matrix.js, Maestro on Phone/Small/Fold/Tablet API35) -> deliver phone list; then G6 (hifz redesign, high).
5.11 build ✅ quran-karim-v5.11.apk (53, signer 7d8b31d2): ui.js 196/0, donate 14/0, data 28/0, matrix 40/0, i18n clean, Maestro 4 AVDs PASS. Installed on Phone_API35. No GitHub release (ask the user first).
Resume: deliver the 5.11 phone list (QA-checklist § 5.11) to the user; next G6 hifz redesign (effort high).

## 5.11 G6 — hifz hub: test first, map boxes per surah, start ayah, follow, auto flip — done 2026-11-07
Goal check: the hifz test is the main use of recitation recognition; a hub around it with a start ayah and page following = near-complete app + more real recognition use. Effort high.
ui.js 201/0, i18n clean. Phone check pending (follow scroll with real recitation). Not in an APK yet (5.11 APK built before G6).
Resume: G7 (recitation following/timing engine) — needs real recitation audio; then rebuild an APK with G6/G7 for the user.

## 5.11 G7 — recitation following and timing — done 2026-11-07 (JS + NvAsr), phone check pending
Goal check: the biggest user-felt gap; measured with recite_sim.js (8 scenarios) and stream_cut.py (52 continuous streams). Partial-only freeze chosen because cutting pieces lowered word verdicts (0.6–2.5 pt) — rejected against the >95% goal.
Resume: full QA + rebuild quran-karim-v5.11.apk (G1–G7) -> deliver phone list; then G10 (noise/speed retrain, GPU, hours) only if usage allows; G8 waits for the user (backend + consent wording).
5.11 FINAL build ✅ quran-karim-v5.11.apk (G1–G7; 53; signer 7d8b31d2): ui.js 210/0, donate 0 FAIL, data 28/0, matrix 40/0, i18n clean, recite_sim ✓, Maestro 4 AVDs PASS. Installed on Phone_API35. No GitHub release (ask first).
Goal check for G10: needs hours of GPU training and the user's phone gate; the user asked to shut the PC down at the end of this session -> plan written under items 30/31, not started.
Resume (2026-11-07): new session from plans/5.11-session-prompt-5.md — the user's phone review of 5.11 (QA-checklist § 5.11, G7 a–h + G3.9), then G10 (GPU), G8 waits for the user.


- 2026-11-07: 5.11 installed on the user's phone (M2007J3SY) over USB; 21-item phone list sent. plans/5.11-session-prompt-5.md updated for the next session.
Resume (2026-11-07): new session from plans/5.11-session-prompt-5.md — act on the user's phone feedback for 5.11 (by list item number), then G10 (GPU), G8 waits for the user.

## 5.11 phone feedback (21 items) — in progress 2026-11-07, paused by the user
Goal check: items 2/11/12/16/19 are real phone gaps in hifz/following, the main use of recognition; #16 changes only partial timing (finals untouched -> no accuracy risk).
Done in code (not built/QA'd yet): #2 consent dialogs' donate switch always starts off (was showing the 5.10 choice); #19 vertical hifz: scroll watcher now masks the page reached (vHz; while reciting the page is kept until hifz.next or it leaves the top); #11 words test follows the next word + mic start puts text under the bar; #12 words test «قلب تلقائي» button (q.hifzFlip): last word heard on a partial opens the next 10 ayat with the mic on (rest of the piece skipped via htv.skip), off -> ends with the score; #16 NvAsr partial every 0.5 s (min 2x last decode ms) instead of 1 s. User reported 147 ms/decode at 3.9 s audio (bench 3.7 s).
ui.js: 1 FAIL fixed by editing the G6 vertical check (scroll 230 not 700) + new check «phone #19»; recite_sim.js scenario I first run: flip ON passes (moves to ayah 11, mic stays on, ayah-11 words 3/3 ok, follow keeps word at 253/844); flip OFF FAILS: one partial with all 10 ayat does not end the test (mic still on, htRes empty) — debug endNow (r.v[n-1] on a single long partial from ptr 0?).
Flip-off sim "failure" was the sim (same hash, no re-render); fixed. 5.12 built + full QA green (see QA-checklist 5.12).
Resume: install quran-karim-v5.12.apk on the phone (adb -s bee81250 install -r) when connected, send the 5.12 re-test list (QA-checklist 5.12); then G10 (GPU). No GitHub release without asking.
- 2026-11-07: 5.12 installed on the user's phone (bee81250); re-test list (2, 11, 12, 16, 19) sent. Resume: act on the 5.12 phone results; then G10 (GPU).
- 2026-11-07: user's phone re-test of 5.12: items 2, 11, 12, 16, 19 all PASS. Stats: 149 ms per decode (3.9 s audio) — same per-decode cost as 5.11 (147), as expected: 5.12 decodes twice as often, not slower. Resume: G10 (noise/speed retrain, GPU, hours; plan under items 30/31 of 5.11-plan.md) — only with the PC left on; G8 waits for the user; GitHub release of 5.12 only if the user asks.
- 2026-11-07: GitHub release v5.12 published (user asked) with quran-karim-v5.12.apk (signer 7d8b31d2): https://github.com/drmalek1987/quran-karim/releases/tag/v5.12. Resume: G10 (GPU) only with the PC left on; G8 waits for the user.
Resume (2026-11-07): new session from plans/5.11-session-prompt-6.md — user patch 2 (P2.1–P2.11 in 5.11-plan.md): quick items P2.3/8/11/9 first, then P2.4, P2.5, P2.7, P2.10 (list first), P2.6 (plan first), P2.2; P2.1 waits for G8; then 5.13 build + full QA + phone list; G10 only with the PC left on.
- 2026-11-07 (session 7, patch 2): goal check: P2.3/8/11/9/4/5 are user-asked UX fixes for the near-complete app; cheap, done before the heavier items. Done + pushed: P2.3 «ليس الآن» (3e087ec), P2.8 no hifz-mode button under pages (hifz mode from map/test; window.hifzToggle for QA), P2.11 no thematic margin under pages, P2.9 thematic-margin download row gone + old thmnotes freed on start, P2.4 Stats › privacy opens Settings already at the box (no jump), P2.5 start-ayah select in the hifz test (07db17f). ui.js has ONLY=<group> filter; group «نسخة 5.13 (باتش 2)». Build note: use .venv\Scripts\python.exe -I build-win.py (global py3.11 lacks brotli). User is away and asked to shut the PC down at the end → no G10 this session.
Resume: P2.7 (landscape full screen must not shrink the page), then P2.10 inventory + P2.6 plan (report for the user, no implementation), P2.2, then 5.13 build + full QA; then shutdown.
- 2026-11-07: P2.7 ✅ (ac10f66) landscape fs page width kept (cropped editions were 640→282; fs --W now has the 640px floor). P2.10 inventory + P2.6 plan written for the user: plans/5.13-P2.10-P2.6-report.html (3 questions; nothing implemented). P2.2 ✅ always-visible home mic (rdMicHtml on showHome, rdPage reset, text mode opens #/s/s/a). Goal check P2.2: directly serves recitation recognition in daily use (find any ayah by reciting).
- 5.13 build ✅ quran-karim-v5.13.apk (5.13/55, sw quran-v50, signer 7d8b31d2): ui.js 220/0, donate 0 FAIL, data 28/0, matrix 40/0, i18n clean, fs-motion 8/8, Maestro 4 AVDs PASS, emulator CDP checks PASS. Installed on Phone_API35 only — the user's phone was not connected. No GitHub release (ask first). User was away and asked for a PC shutdown at the end → G10 not started.
Resume: install quran-karim-v5.13.apk on bee81250 (adb -s bee81250 install -r) and send the phone list (QA-checklist § 5.13); get the user's answers on plans/5.13-P2.10-P2.6-report.html, then implement P2.10 + P2.6; P2.1 waits for G8; G10 only with the PC left on.
- 2026-11-07: 5.13 installed on the user's phone (bee81250) over 5.12, data kept; phone list (QA-checklist § 5.13) sent. Resume: act on the 5.13 phone results + the user's answers on plans/5.13-P2.10-P2.6-report.html; P2.1 waits for G8; G10 only with the PC left on.
- 2026-11-07: P2.12 (user note via a side session): harmain page centred in full screen (style.css, non-crop rule). ui.js 5.13 group 8/0, fs-motion 8/8 (harmain, kfgqpc headless; harmain emulator), emulator real fs top/bottom 102/102. Goes into the next build; the phone still has 5.13 without it. Resume: same as above (5.13 phone results + report answers).
Resume (2026-11-07): new session from plans/5.11-session-prompt-7.md — P2.10 done in code but UNTESTED (run full ui.js first); P2.6 draft in plans/wip-5.13-P2.6/ (apply with patch_hz.py), then words-test ranges, CSS, i18n, checks; then 5.14 build + full QA + phone list. User answers: plans/5.13-P2.10-P2.6-answers.md.
- 2026-11-07 (session 7): goal check: P2.10/P2.6 finish the hifz/review flow the user asked for (near-complete app goal); no better alternative, the user's answers fix the design.
  - P2.10 verified: full ui.js 221/0 after 2 checks moved to Stats (376883d).
  - P2.6 applied: «المراجعة» screen (hzlog.js via patch_hz.py), auto ✓ at 80% (hifzAuto), ranges (hzRange from QURAN.h rub'), in order / random 5–12, mushaf test ends at range end, words test with range across surahs + whole-test score (patch_ht.py), CSS, More menu name, i18n D513 (scan clean for the new pages), 7 checks (ui.js 5.13 group 14/0). Screenshots tools/qa/p26-*.png.
  - Note: uncommitted 5.13.1/56/sw v51 bump of unknown origin in manifest/index/sw.js; the 5.14 build sets 5.14/57/v52.
Resume: 5.14 build + full QA (ui.js, data.py, matrix, donate, i18n, fs-motion, Maestro 4 AVDs, emulator screenshots of «المراجعة»), install on bee81250, phone list QA-checklist § 5.14 (P2.6, P2.10, P2.12). No GitHub release unless asked.
- 2026-11-08: user change via side session: «عشوائي» = a random number of places (up to 1 per 30 ayat, max 10, min half), each 3–12 ayat (hzParts); mushaf test moves place to place (hifzNextPlace; context ayat before a later place shown), words test «الموضع اللي بعده» + «الموضع # من #», one score at the end; score saved for every surah tested. 5.14 built (57, sw v52, signer 7d8b31d2), ui.js 229/0, data 28/0, matrix 40/0, donate 0 FAIL, i18n clean, emulator CDP checks PASS.
Resume: Maestro 4 AVDs on the final 5.14 APK, then install on bee81250 (adb -s bee81250 install -r quran-karim-v5.14.apk) and send the phone list (QA-checklist § 5.14). No GitHub release unless asked.
- 2026-11-08: 5.14 final: Maestro 4 AVDs PASS, installed on bee81250. Night report for the user: plans/5.14-night-report.html (changes since G1, what is left, needs, time, usage, 12 suggestions). PC shut down at the user's request.
Resume: act on the user's 5.14 phone results (QA-checklist § 5.14 items 1–10) and their pick from the report's suggestions; G8/P2.1 waits for the user's backend/consent decision; G10 (noise/speed retrain, plan in 5.11-plan.md items 30/31) only on a night with the PC left on; GitHub release v5.14 only if asked.
- 2026-11-08: Patch 3 plan approved (12 night-report suggestions + what is left, by priority, with a token-saving workflow and timeline): appended to plans/5.11-plan.md. Maestro 4-AVD runner saved as tools/qa/maestro/avds.sh.
Resume: new session from plans/5.15-session-prompt.md — Sprint A: 5.14 phone results, S2, S7, S1, G10 data prep on the CPU (training only on a night with the PC left on), then 5.15 build + full QA.
- 2026-11-08 (Sprint A, 5.15): goal check — G10 data first (CPU, no tokens, the biggest gap to 95% outside the house), then S2/S1/S7 (hifz is the main use of recognition). 5.14 phone results not in yet. Done:
  - G10 prep: tools/asr/gpu/g10_prep.py → qtrain/g10/aug.json + wav/ (13302 variants = 2 per train clip + 3000 replay; speed 0.7–0.9 / 1.1–1.5 atempo, babble or white/pink/brown noise at SNR 0–20, synthetic reverb rt60 0.3–1.0; DEMAND held-out noise NOT used so the noisy gate stays fair). Training script does not read it yet (add a G10 mix in nv_curr.py data(), the night training starts).
  - S2: hzParts weights random places to wrong ayat (2/3 of places land on one), «أخطائي بس (#)» = places around wrong-ayah groups (±1 ayah, min 3, max 10); empty → toast.
  - S1: hzDueInfo/hzReviewed/hzDueList/hzWard: q.hifzLog[s].iv (7 first, ≥90% ×2 max 90 once a day, 70–89 same, <70 → 1); map colours, «عليك مراجعة», hifzDue/syncAlarms (per day ahead) use it; q.hzDaily pages ward + «اختبرني في ورد النهارده» (one mushaf test, a place per surah).
  - S7: todayCard() on home under the khatma card (only when a surah is memorised): khatma ward + review ward + «اختبرني».
  - ui.js group 5.15: 7/0 (and 5.11/5.13 groups 0 FAIL; the old «عليك مراجعة» check now expects 113 at 50% today due tomorrow). Screenshots tools/qa/s7-home-today.png, s1-s2-review.png.
Resume: 5.15 build (versionCode 58, sw quran-v53, index.html version, signer 7d8b31d2) → full ui.js + data/matrix/donate/i18n → Maestro 4 AVDs (bash tools/qa/maestro/avds.sh) → install bee81250 → QA-checklist § 5.15 + HTML report. G10 training only if the user says the PC stays on overnight.
