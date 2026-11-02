# Voice donation v2: progress

Branch: `donations-v2` (one commit per checkpoint, not pushed). Full plan: `C:\Users\Compumarts\.claude\plans\pasted-content-id-fa69-mighty-bubble.md`.
To resume: open Claude in `D:\Quran App\quran-karim` and say «كمّل من progress.md»; start at the first checkpoint not `done`.
Decisions: train the NVIDIA FastConformer only; FLAC; free protection only (no Play Integrity); no gender or age questions.
Models: Opus for relay, Java, audio and training; qk-dev (Sonnet) for UI, i18n and text; qk-qa (Haiku) for builds and tests.

| CP | What | Status | Date | Verified |
|----|------|--------|------|----------|
| 0 | Branch + this file | done | 2026-11-02 | - |
| 1 | Relay: HMAC, persistent limits, server ASR check, batched commits, /delete, legacy /clip | todo | | |
| 2 | Android: seq-matched audio, quality + trim, FLAC, JobScheduler batch upload, forget, version | todo | | |
| 3 | Web: v2 labels (s/a/w, hyp, model, app), «أنا قريت صح», settings counters, mobile data, delete | todo | | |
| 4 | Privacy policy AR/EN, store/data-safety.md, PLAY-REVIEW, SRS | todo | | |
| 5 | tools/asr/gpu/nv_train.py (donations + tlog, device split, gate), export_onnx --ckpt, migrate_legacy.py | todo | | |
| 6 | Verification: pytest, FLAC round-trip, APK build, ui.js mock, emulator smoke, nv_train --dry-run | todo | | |
| 7 | Deploy relay, migrate, bump 4.9: only with the user's OK | todo | | |

## Wire protocol (shared by relay and app)
- `POST /batch` multipart: `device`, `ts` (unix seconds), `sig`, then per clip i: `meta<i>` (JSON) and `audio<i>` (FLAC).
  `sig = hex(HMAC-SHA256(APP_KEY, ts + "|" + device + "|" + sha256hex(meta0) + sha256hex(audio0) + ...))`.
  Reply 200 `{"results":[{"i":0,"ok":true}|{"i":0,"ok":false,"reason":"..."}]}`: the phone deletes every listed clip and counts rejects.
  401 bad sig/ts, 429 limit, 5xx: keep everything and retry later.
- `POST /delete` form: `device`, `ts`, `sig = HMAC(APP_KEY, ts|device|delete)`.

## Log
- CP0 2026-11-02: branch created from main 5980c5c.
