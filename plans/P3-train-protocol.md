# P3 — curriculum fine-tune on the user's long recordings (plan, 2026-11-05)

Goal link: >95% recitation recognition for any reader. P0b showed the gap is noise (SNR 10: 87.6, SNR 5: 81.1) and new
voices (94.0). These 23.6 h of real mosque/home recordings are exactly that gap.

- Model: `nvidia/stt_ar_fastconformer_hybrid_large_pcd_v1.0` (CC BY 4.0), CTC branch, as shipped in 5.7.
- Kit: `tools/asr/gpu/nv_train.py`, already written for the voice donations. It is extended with a curriculum mode.
- Data: `تلاوات مختلفة/`, 64 files: the user and mosque imams, recorded by the user, consent given for training.
- No synthetic noise. The recordings' own noise is binned by estimated SNR.

---------------------------------------------------------------------------------------------------------------------
## A. Material conditions (every train clip must pass all of them; each check is logged with a count)

| # | Condition | Check | Fail → |
|---|---|---|---|
| A1 | Rights | user recorded, readers consent (2026-11-05) | — |
| A2 | Audio sane | 16 kHz mono; clipping < 0.5% of samples; not silent; 1.0–20 s long | drop |
| A3 | Quran only | prayer phrases (takbir, سمع الله لمن حمده, ربنا ولك الحمد, آمين, تسليم), du'a, and talk are skipped: no Quran alignment means skip | drop |
| A4 | Label placed right | trigram + continuity window + CTC `local_align`; the piece's place must agree with reading order (neighbours) | review |
| A5 | Label matches audio | CER(model text, label) ≤ 0.15, and `forced_words` finds **every** word | review |
| A6 | No reader mistake | A5, plus no word missing, repeated or self-corrected (repeated text inside one piece means review); harakat-only mistakes are a known blind spot, covered by A9 | review → real-mistakes test set |
| A7 | Clean edges | the first and last words are whole (not cut by the VAD); otherwise trim to the word boundaries with the forced alignment, or drop | trim/drop |
| A8 | One main voice | overlap: a second voice stronger than −6 dB of the main one in > 30% of the piece (energy outside the forced-aligned speech) means the clip moves to the "hard" level, never to "easy" | re-level |
| A9 | Human audit | 100 random train clips per level, on a listen page (the user marks ✓/✗); label precision must be ≥ 98%, else tighten A4–A8 and redo | block level |
| A10 | Balance | each reader ≤ 35% of training seconds; each ayah ≤ 8 clips per reader (al-Fatiha repeats in every rak'a); the rest is down-sampled | cap |
| A11 | No leakage | test files are split **by whole file** (and by date: two files of the same night stay together); the P0b sets and RetaSy are never trained on | — |
| A12 | Text form | the label is the simple imla'i text the model was trained on, with the same norm as `bench.norm`; the tokenizer is unchanged | — |
| A13 | Feature parity | the training features are the same as the phone's (`bench.feats` parity check on 20 clips, max abs diff < 1e-3) | stop |

## B. Model conditions

| # | Condition | Check |
|---|---|---|
| B1 | Right base | 5.7's exact checkpoint; its ONNX int8 output matches the shipped `model.int8.onnx` on 20 clips (same greedy text) |
| B2 | Baseline first | base measured on every eval set before step 1 (this is the "before" of all deltas) |
| B3 | Fits 6 GB | DRY=1 run: no OOM at BATCH_SEC; fp16 |
| B4 | Gentle update | LR 1e-5 peak, 200-step warm-up, linear decay; lower half of the encoder frozen at L1, unfrozen to 2/3 at L2/L3 only if L1 passed; weight decay 1e-3; SpecAugment kept on (masking, not added noise) |
| B5 | No forgetting | replay in every batch: ≥ 30% original clean pro data (tlog plus everyayah reciters not in P0b) |
| B6 | No overfitting | train CER vs held-out CER gap ≤ 5 pts; held-out not improving for 3 evals means early stop of that level |
| B7 | Readiness per clip ("learnable zone") | base CER on the clip: < 3% means already known (down-sample ×0.3); 3–60% means learnable (keep); > 60% or no alignment means doubtful (drop); the share per level is reported before training |
| B8 | Reproducible | seed fixed; data lists and checkpoint hashes saved per level |
| B9 | Export check | best checkpoint → ONNX int8; re-benched with phone settings (bench.py 5.7 flags + p1b_port_eval `ctc_up`); the PyTorch and ONNX results must agree within 0.3 pt |
| B10 | Phone check | speed on the phone not slower than 5.7 by more than 10%; model size unchanged |

## C. Levels (curriculum)

The level of each train clip is set by its own noise and by how hard it is for the base model:

| Level | Noise (est. SNR of the piece) | Base CER on clip | Other |
|---|---|---|---|
| **L1 easy** | ≥ 15 dB (user, 2026-11-05; was 20) | ≤ 10% | one voice (A8) |
| **L2 medium** | 10–20 dB (pieces 15–20 dB with base CER > 10% stay here) | ≤ 30% | — |
| **L3 hard** | < 10 dB, or overlap (A8) | ≤ 60% | includes the gap labels (C1) |

C1. **Gap labels** (for L3 only). A hard piece between two A5-passing neighbours, in reading order, takes the Quran text
between them. It is accepted only if `forced_words` aligns every word with score ≥ −1.0 per frame, and its seconds per
letter lie within that reader's own 5–95% range. All of them go through the A9 audit like the rest.

Held-out per level: the held-out files are cut the same way, giving test-L1, test-L2 and test-L3, each ≥ 15 min.

Mix per level, as a share of the seconds in each batch:
- **L1:** 70% L1 + 30% replay.
- **L2:** 50% L2 + 20% L1 + 30% replay.
- **L3:** 45% L3 + 15% L2 + 10% L1 + 30% replay.

## D. Pass measures per level (the learning curve)

Eval every 400 steps on test-L1/L2/L3, the P0b sets, and the real-mistakes set. One row per eval goes to `nv_results.json`;
the report plots verify %, wrong-caught %, and train/held-out CER per step, with the level changes marked.

A level **passes** only when all of the following hold at the same checkpoint:

| Gate | L1 easy | L2 medium | L3 hard |
|---|---|---|---|
| Its own test level: verify % vs base | ≥ +1.0 pt **and** ≥ 96% | ≥ +3.0 pt **and** ≥ 93% | ≥ +3.0 pt **and** ≥ 88% |
| Earlier levels | — | test-L1 stays within −0.3 of the L1 pass | test-L1/L2 within −0.3 of their pass |
| P0b clean (ho_reciters, ho_retasy) | ≥ base − 0.5 | ≥ base − 0.5 | ≥ base − 0.5 |
| P0b noisy (SNR 20/10/5) | ≥ base | ≥ base, SNR 10 ≥ +1 | ≥ base, SNR 5 ≥ +2 |
| Wrong word caught (every set) | ≥ 98% | ≥ 98% | ≥ 98% |
| Overfit gap (B6) | ≤ 5 pts | ≤ 5 pts | ≤ 5 pts |
| Curve | stable: 2 evals in a row pass | same | same |

- The budget per level is 3,000 steps.
- A level that has not passed within its budget does **not** advance. Stop, report what failed, then fix the data, LR or mix and retry once. A second fail ends P3 with the best passed level.
- The best passed checkpoint of each level is kept, so falling back is always possible.
- The numeric targets are checked against the measured base (B2) before training starts. A target already met by the base is raised to base + the delta, and any change is written here before step 1, never after.

## E. Ship gates (after L3, or the last passed level)
- Every gate of the last passed level holds on the exported int8 model (B9).
- Real-mistakes set: caught % ≥ base.
- Phone (B10), then the full release QA, a versioned APK, and signer 7d8b31d2.

## F. Order of work (checkpoints, each with a Resume line in progress.md)
1. **CP1 data:** long_pseudo (running), long_noise, long_wordcheck, then A7 trim, A8 overlap, A10 balance, levels, held-out split, and a yield report per level/reader.
2. **CP2 audit:** a listen page per level (100 clips each). The user marks them, then A9 is met.
3. **CP3 kit:** nv_train.py curriculum mode (levels, mix, gates, per-level budget, curve report); B1, B3, A13 parity; DRY run; B2 baseline.
4. **CP4 L1** train → gate. **CP5 L2** → gate. **CP6 L3** → gate. Each one ends with a curve report to the user.
5. **CP7** export, phone bench, ship decision (on the user's word).

## G. Gaps found before start (2026-11-05 review)
| # | Gap | Action |
|---|---|---|
| G1 | No file→reader/mic/place map; A10 balance and A11 split need it | the user fills a sheet (file, reader, mic yes/no, place, date) |
| G2 | Qira'a | user confirmed 2026-11-05: all files are Hafs |
| G3 | Base checkpoint: no .nemo on this PC, NeMo not installed; unknown if 5.7 = stock NVIDIA | install NeMo in its own venv, download the .nemo, export, B1 compare with the shipped int8 |
| G4 | Self-training bias: the labels come from the same model, so it can learn its own blind spots | A9 audit, gap labels, and the gates on P0b (external voices) |
| G5 | Piece length: the phone caps pieces at 12 s, here ≤ 20 s | cap train pieces at 15 s; eval with the phone VAD (bench.py) |
| G6 | Reverb (mosque echo) is not captured by SNR | add a C50/decay estimate; strong reverb → level L3 |
| G7 | Loudspeaker clipping in mosque files | A2 clipping check per piece (not per file) |
| G8 | Voice variety: only adult men → the result says nothing for women/children | report it; P0b/RetaSy stay the cross-voice check |
| G9 | Privacy: recordings stay on this PC; nv_train's HF report uploads only progress.txt/results json, never audio | DATASET upload disabled for this run |
| G10 | Rollback: users re-download the model (asrnv zips) | new model → new asset version; 5.7 model kept for rollback |
| G11 | User time: A9 (300 clips) + real-mistakes marking | listen pages fast (keyboard ✓/✗), ~30–40 min total |
| G12 | Exact-duplicate files | checked: none (md5) |

## H. Decisions after CP1 (2026-11-05)
- Reader balance by sampling weight `w` (≤35% per reader per epoch), no clips dropped (long_split.py); nv_train must sample by `w`.
- Test sizes stay below 15 min (test-L1 6.6, test-L3 11; test-L2 17). Their level gates in D are **indicative only**
  (±1–2 pt noise per clip); a level passes on the P0b gates (clean + noisy SNR 20/10/5) plus test-L2, with test-L1/L3
  required not to drop by more than 2 pt.
- **Levels re-defined by base CER (user, 2026-11-05)**, replacing table C: L1 ≤ 5%, L2 5–20%, L3 20–60% (+ overlap > 30%
  and gap labels → L3); > 60% dropped. Reason: in these recordings the median SNR is ~14 dB at every CER level, so noise
  does not drive model difficulty; the RT60 estimator is unproven (logged only). L1 is ~78% "known" → a short warm-up
  (budget 1,000 steps). Noise robustness is judged on P0b noisy (SNR 20/10/5).
