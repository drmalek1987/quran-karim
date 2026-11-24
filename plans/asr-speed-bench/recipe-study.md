# ASR item #2 phase 3 — training recipe study (Deban hadr, 2026-11-24)

Goal: adapt G10b (FastConformer hybrid, CTC head, phone int8) to real hadr (Sheikh Ahmed Deban, whole mushaf, 3.0 w/s median)
without losing anything on the old gates. Hard rule: G10b.int8.onnx / pack-v4 untouched; a candidate ships only if it is
>= G10b on every gate (at most -0.2 on a single metric, none on ALL verify) AND improves hadr.

## 3a. What past runs changed and what it did

| run | change vs previous | result | lesson |
|---|---|---|---|
| L1/L2/L3 (P3, 11-06) | fine-tune stock base on user long recordings, LR 1e-5, freeze 1/3, replay 30% (unfiltered tlog) | L2 ALL verify 83.3 -> 87.8 (shipped pack v3); L3 failed | own-domain data helps; fp16 NaN, BN drift, Uthmani labels, harakat stutter, tight clips -> lessons 1-5 |
| G10 run 2 (11-08) | pre-baked noisy/reverb/speed copies (13k), mix G10 .35 | flat 3000 steps, no step passed | 40% of replay targets were wrong (misaligned tlog); aug too extreme; LR too low |
| G10b (11-09) | trusted labels only (replayT CER<=5), on-the-fly moderate noise, freeze 1/2, LR 6e-5 (sweep 3e-5/6e-5/1e-4), BATCH_SEC 40 ACC 3 | shipped (pack v4): ALL 97.3 ctc_up | clean labels + moderate aug + higher LR moved what G10 never moved |
| G10c (11-13) | + DEMAND/MUSAN noise by source | not better than G10b | more noise sources did not add |
| G10s (11-24, phase 2) | + ffmpeg tempo 1.3-2.2x / 0.6-0.8x on 30%, LR 1e-5, 1200 steps | fast18 23.1 -> 21.7 proxy, int8 gate FAIL (retasy_wrong -0.6), no real-hadr gain | synthetic tempo is not real hadr (80 ms frames, coarticulation) |
| G10sb | LR 3e-5, SPD_P .5 | noisy proxy fails from step 400 | higher LR + strong aug costs noise robustness |
| A1 slow merge (pipeline) | no training | won phase 2 (ALL 97.6) | pipeline fixes are free of forgetting |

## 3b. Research (sources)
- Replay / rehearsal is the most practical anti-forgetting method for E2E ASR; even small buffers beat regularisers
  (Vander Eeckt & Van hamme, "Rehearsal revealed", arXiv 2306.10860; "Weight averaging ...", arXiv 2210.15282).
- Weight averaging of old and adapted model (= WiSE-FT, Wortsman et al., CVPR 2022, arXiv 2109.01903) keeps both
  tasks; KD on top can add a bit (arXiv 2210.15282).
- LwF (KL to the old model's posteriors) was the best no-replay regulariser for ASR, then EWC/MAS (arXiv 2508.06280).
- Adapters (NeMo): frozen base + small modules, low forgetting (NVIDIA blog "controlled adaption of speech recognition
  models to new domains"; Eeckt & Van hamme arXiv 2203.16082; damage control arXiv 2210.03255: 0.25-0.5% params).
  Not usable here without changing the ONNX graph/export (adapters can be merged only if linear) -> not tested.
- Speed perturbation 0.9/1.0/1.1 (Ko et al., Interspeech 2015) is standard; already in G10b aug.
- L2-SP (Li et al., ICML 2018), EMA of weights / checkpoint averaging: standard fine-tune regularisers.

## 3c. Own ideas
- Real-rate data instead of synthetic tempo (this phase): forced-aligned real hadr (Deban) labelled from the verified text.
- Tempo-matched pairs with CTC consistency: frames of the slowed and native copy do not map 1:1 at 80 ms (CTC peaks move),
  a frame-level KL is not defined; would need sequence-level consistency -> not tested (cost/benefit).
- Rate-balanced sampling: DEB_P is the rate share (Deban = the only >2.5 w/s source), swept .2 vs .35.
- Piece-level training: every train clip already gets 0.3-1.6 s trailing quiet (phone VAD tail) and the proxy evaluates on
  vad_pieces.

## 3d. Test matrix (short runs, 600 steps, eval 300, init G10b best.nemo, proxy = nv_curr cer on vad_pieces)
Knobs added to nv_curr.py level G10d: DEB_P, KD, L2SP, EMA, DEB_TEMPO (+ LR, FREEZE). Runner tools/asr/gpu/g10d_matrix.sh.
WiSE-FT: qtrain/deban/exp.py --wise ALPHA (theta = G10b + ALPHA*(ft - G10b)).

## Results
Proxy (600 steps; full table in runs.md "Phase 3"): every recipe lowered Deban held-out CER (9.09 -> 8.36-8.74) and every one moved some
old set by > +0.2 (clean, noisy or the other 82 real-hadr clips). Only p1base (DEB_P .2, LR 3e-5, freeze 1/2) passed at step 600.
- higher Deban share (.35): best Deban (8.39) but test_L1/L2 and hadr_other worse -> more forgetting.
- LR 1e-5: less Deban gain, hadr_other still worse (no cleaner).
- freeze 3/4 (top quarter + decoder): worst hadr_other (8.68) -> the lower-middle blocks need to move for rate.
- KD (LwF, KL to G10b on replay): best clean L1/L2 and hadr_other (7.42) but noisy10 +1.2 (KD on noisy replay copies pulls toward G10b's noisy errors? and fewer CTC updates there).
- L2-SP / EMA: neutral vs base; no protection beyond noise.
- Deban tempo 0.9-1.3: best Deban (8.36), noisy10 +0.4.
- Full schedule 1500 steps (f1 = p1base; f2mix = .35 + KD + EMA): Deban 8.1-8.2 but proxy fails every eval (noisy).
Int8 phone gate (bench verify %, G10b_ref = re-export, bit-exact with shipped):
- p1base: Deban verify +0.8, CER 5.4->5.0, ayah id 95.4->96.3; other real hadr WERskel 11.0->10.4 (generalises beyond Deban);
  L3 +0.8; BUT ho_retasy_wrong -1.0, ho_retasy -0.4 -> FAIL.
- WiSE-FT alpha 0.7/0.5/0.3: retasy_wrong -0.6/-1.0/-0.6 -> FAIL; Deban gain shrinks with alpha (+0.7/+0.5/+0.2).
- f2mix / f1 with WiSE 0.5: see runs.md.
Reading: the failing metric is the WRONG-word set (100 clips of users reciting with mistakes): a model tuned to fluent fast recitation
accepts more near-miss words. It is a 1-2 word change on 100 clips, but the rule is strict and the direction is consistent in every candidate.

- f2w5: retasy_wrong -1.2, ho_reciters -0.7 (KD+EMA+.35 is worse); f1s9w5: closest, retasy_wrong -0.4, Deban +0.8, other hadr 11.0->10.6.
## Chosen recipe
None ships. Best family = p1base (DEB_P .2, LR 3e-5, freeze 1/2) + WiSE; to pass, the training must also see wrong-word (negative) recitation so the model does not become lenient. Next idea: add retasy-style wrong-word clips / a penalty on accepting near-miss words; enlarge ho_retasy_wrong (100 clips, 1 word ~0.5 pt).
