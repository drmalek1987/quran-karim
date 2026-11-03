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
