# Plan: shrink the on-phone recitation model (Z-track), merged into the 5.16→5.17 schedule

## Context
The user asked whether the recognition model can take less space on the phone. Measured on bee81250:
- The model uses 146.6 MB:
  - `files/ed/asr/nv.onnx` is 128.7 MB.
  - The ORT libs are 17.9 MB.
- I analysed `nv.onnx` (asrnv a.bin + asrnvp b.bin joined):
  - 109 MB is int8 weights (114.6M params, `quantize_dynamic` QUInt8 in `tools/asr/gpu/export_onnx.py:23`).
  - **20.5 MB is one float32 Constant of shape (1, 9999, 512)**: the rel-pos table, NeMo `pos_emb_max_len=5000` → 2·5000−1.
  - `NvAsr.java:218` caps a segment at 12 s, so about 150 encoder frames (8× subsampling, 10 ms hop).
  - So only about 299 rows of the table are ever used.
- `libonnxruntime.so` is a full 18.2 MB build.

The goals stay first: recognition >95% and latency not worse. Size work that can't hurt accuracy goes first. Anything that can hurt accuracy goes through the same gate as any new model (`nv_gate.py`).

## Restore point (done)
- Git tag `v5.16c-restore` on c7a06f1, pushed.
- The shipped model zips are copied to `D:\Quran App\quran-karim-data\restore-asr-5.16c\` (asrnv.zip, asrnvp.zip).

## Checkpoints

| # | Step | How | Saves | Accuracy risk | Model / effort | Time |
|---|------|-----|-------|---------------|----------------|------|
| Z1 | Trim the pos table | Re-export from the shipped L2 checkpoint (`nv_out/P3_FINAL_L2.nemo`) with a smaller pos table. NeMo side: `m.encoder.pos_emb_max_len = 512` + re-create `pos_enc.pe`, or `set_max_audio_length`, before `m.export`. Fallback: ONNX surgery that keeps the centre rows of the Constant and moves the Slice start constant to match. A new flag `--posmax N` in `export_onnx.py`. | ≈16–20 MB | none expected | Opus / medium | 1–2 h |
| Z1v | Parity check | Old vs new `nv.onnx` on `tools/asr/eval` + `nv_gate.py shipped`: logits max-abs-diff ≈ 0, and the same WER on clean/noisy/held-out. RTF must not be slower. Test the longest 12 s segment and a long whole-surah CTC alignment. | — | — | Haiku (qk-qa) runs, Opus reads | 30 min |
| Z2 | int4 weights experiment | `onnxruntime.quantization` MatMul 4-bit (`MatMulNBitsQuantizer`, block 32/64) on the fp32 export. Conv/other stay int8. Run on CPU ORT, then on the phone (ORT Android must support MatMulNBits, so check the shipped ORT version first). | ≈40–50 MB | **yes** | Opus / high | 2–3 h |
| Z2g | Gate for Z2 | `nv_gate.py`: verify ALL not lower, clean not worse, wrong-caught not more, **latency/RTF on the phone not worse**. Ship only if all pass, otherwise drop Z2 and write down why. | — | — | Opus | 1 h |
| Z3 | Minimal ORT build (optional, later) | Build ORT for arm64 with `--minimal_build` / reduced ops from the model's op list (Android NDK; WSL or the CI runner). Replace `asr/asrnv/lib/libonnxruntime.so`. | ≈8–10 MB | none | Opus + Sonnet / high | 3–4 h |
| Z4 | Smaller model (backlog) | Distil to ≈40–60M params. Also faster latency. Only after the G10 recipe rethink, and it needs the full gate. | ≈60 MB | yes | Opus / high | days |

### Shipping rule (important)
Any new `nv.onnx` makes every user download the model pack again (about 108 MB). So:
- Z1 is **not shipped alone**. It ships in one new model pack together with Z2 (if Z2 passes) or with the next G10 model.
- The pack gets a new name/version (like the existing `asrnv2.zip` / `asrnvp2.zip` on the `editions` branch), so old packs keep working.
- The app deletes the old `nv.onnx` after the new one checks out. Check `EdStore` / `NvAsr` load path for leftovers.
- No GitHub release or Play upload unless the user asks.

## Merge with the current schedule (`plans/5.16-schedule.md`)
Order after this plan is approved:
1. 5.16c is done (on bee81250).
2. **Z1 + Z1v**: CPU only, no app change, runs now.
3. **Z2 + Z2g**: GPU/CPU, while the G10 recipe is rethought.
4. S6 «مش متأكد»: Java, 5.16b plan → next app release.
5. **Model pack v3** = Z1 (+Z2 if it passes, + G10 if it ever passes). Phone test on bee81250, then upload the pack to the `editions` branch only with the user's OK.
6. Sprint C (S3, S5, S8) = 5.17.
7. Z3 / Z4 go to the backlog (`plans/5.11-plan.md` roadmap P6).

Files to touch:
- `tools/asr/gpu/export_onnx.py` (`--posmax`, optional `--int4`)
- a new `tools/asr/gpu/nv_shrink.py` (ONNX surgery fallback + int4)
- `tools/asr/gpu/nv_gate.py` (only to point at the new onnx)
- `plans/5.16-schedule.md` (add the Z rows + the order above)
- `progress.md` (checkpoint + Resume line)

No change to `web/app.js` or `NvAsr.java` unless Z1/Z2 needs a new pack name in the download list.

## Workflow rules applied
- Goal check written in progress.md before each Z step.
- Checkpoint + Resume line after each step.
- Check usage between steps and stop at 75%.
- No GPU job while another runs. Commit + push each step.
- Never commit model files, keys or APKs.
- Short HTML report in Egyptian Arabic at the end, with the sizes and gate numbers.

## Verification
- Z1: the new `nv.onnx` size, the logits diff ≈ 0 on the eval set, `nv_gate.py` numbers equal to shipped, RTF equal.
- Z2: the full gate table vs shipped, and phone latency measured on bee81250 (load time + RTF).
- Model pack v3: on the phone, delete + download the pack, recite a page on the mushaf test, check that `files/ed/asr` size dropped and the old file is gone. Full QA (ui.js, data.py, matrix, donate, i18n_scan, Maestro 4 AVDs) if the app changes.
