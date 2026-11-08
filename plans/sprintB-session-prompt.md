# Sprint B, session prompt (2026-11-08)

Keep working on Quran Karim (`D:\Quran App\quran-karim`) in **Sprint B**. The rules are in memory and in the SessionStart hook:
- Write to the user in Egyptian Arabic in Arabic script. Technical terms only in English.
- Pick the model and effort per step.
- Do a goal check before each step.
- Write checkpoints and the Resume line in `progress.md`.
- **Stop when usage reaches 82%** (it was 75% before).
- At 300k context, back up and move to a new session.

## State now
- 5.16c is on bee81250 (versionCode 60+, signer 7d8b31d2).
- Restore point: tag `v5.16c-restore`, plus the model zips in `quran-karim-data/restore-asr-5.16c/`.
- Done: U1–U8 (U9 put off), U3 word-by-word reveal, U4 fast jump, «قلب تلقائي» in map/«اختبار الحفظ» tests.
- G10 did not pass the gate. It was not shipped, and its recipe needs a rethink.
- The schedule is in `plans/5.16-schedule.md`. The Z-track plan is in `plans/asr-size-plan.md`.

## What is left in Sprint B (in this order)
1. **Z1: trim the pos table.**
   - `nv.onnx` holds a float32 Constant of shape (1, 9999, 512), about 20.5 MB. A segment is at most 12 s, so about 150 frames and about 299 rows are used.
   - Add `--posmax N` to `tools/asr/gpu/export_onnx.py`: set NeMo `pos_emb_max_len` / pos_enc pe before `m.export`.
   - Fallback: ONNX surgery in `tools/asr/gpu/nv_shrink.py`.
   - Source: `nv_out/P3_FINAL_L2.nemo`, the shipped model. The python env for onnx is `D:\Quran App\qtrain\gpu-train\.venv`.
2. **Z1v: parity check.**
   - Logits diff ≈ 0 on `tools/asr/eval`.
   - `nv_gate.py` must give the same numbers as the shipped model, and RTF must not be slower.
3. **Z2: int4 MatMul weights** (MatMulNBits).
   - Check first that the shipped ORT Android build supports it.
   - It gets the full gate, plus load time and RTF on the phone. Ship only if it passes.
4. **S6 «مش متأكد» instead of red** (Opus high, Java): `Ctc.java forced()` margin, `NvAsr.ctc()`, `ctcJudge`, calibrated on the bench.
5. **Model pack v3** = Z1 (+Z2 if it passed).
   - Never Z1 alone, because a new pack means a ~108 MB re-download for every user.
   - Give it a new pack name.
   - The app deletes the old `nv.onnx`.
   - Test on the phone. Upload to the `editions` branch only with the user's OK.
6. App release (S6 + pack v3):
   - Bump versionCode and the sw cache name.
   - Full QA: ui.js, data.py, matrix, donate, i18n_scan, Maestro: `bash tools/qa/maestro/avds.sh <apk>`.
   - Install on bee81250.
   - Short HTML report in Egyptian Arabic.
   - Commit + push.

After Sprint B comes Sprint C (S3, S5, S8 in `plans/5.11-plan.md`) = 5.17.

Never commit model files, keys or APKs. No GitHub release or Play unless the user asks.
