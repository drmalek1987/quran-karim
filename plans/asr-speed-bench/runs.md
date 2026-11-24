# ASR item #2 runs (2026-11-24) — model G10b.int8 untouched (sha256 e3294079…592eb)

Tools: speed bench `tools/asr/speedbench/bench_speed.py` (+ `--slowq --slow_wps --mcap --tcps --ttarget --tmax`), runner
`qtrain/speedbench/run_cfg.sh`, tables `qtrain/speedbench/table.py`; full gate `qtrain/eval/out/gate_mode.sh` (bench.py 5.22
settings: preroll 3, quiet 0.5, vmin 0.0015, pgain -30, frise_sp 0.0005, fcatch 5 + p1b_port_eval ctc_up), table `mode_table.py`.
New code: `bench.py` `speed_post()` / `atempo()` (defaults off = phone). Outputs: `qtrain/speedbench/c_<cfg>/`, `qtrain/eval/out/mode_<cfg>/`.
Latency columns (ms per piece, PC) from runs done while the GPU job and other benches shared the CPU are inflated; compare within a run batch.

## Data
- New real eval set (EVAL ONLY, never train): everyayah Abdul_Basit_Mujawwad_128kbps + Minshawy_Mujawwad_192kbps, surahs 1:2-7, 97, 93, 86
  = 78 clips, mean 0.42 words/s, 52 MB, `qtrain/speedbench/mujawwad/`, manifest `manifest_real2.json` (set `real_mujawwad_ea`),
  script `tools/asr/speedbench/fetch_mujawwad.py`. Labels = repo quran_words.json by surah/ayah.
- Hadr on everyayah: 8 candidates probed (Qatami, Budair, Ali Jaber, AbdulKareem, Juhaynee, Alaqimy, Qahtani, Neana) = 0.79-1.08 w/s → none is hadr; no fast set added.

## Speed bench (WERskel / tracking), G10b int8
| set | base | A1 auto 0.8 | **A1 auto 1.0** | A1 forced slow | A2 auto (7.5 l/s) | A2 forced | AUTO A1+A2 | G10s (B) |
|---|---|---|---|---|---|---|---|---|
| real_murattal | 7.9/97.0 | 7.9/97.0 | 7.9/97.0 | 6.9/97.2 | 8.4/96.7 | 8.2/97.2 | 8.4/96.7 | 7.5/97.3 |
| real_hadr | 11.0/96.6 | 11.0/96.6 | 11.0/96.6 | 11.0/96.6 | 13.8/92.2 | 14.4/92.2 | 13.8/92.2 | 10.4/96.6 |
| real_hadr_trainseen | 6.0/97.3 | 6.0/97.3 | 6.0/97.3 | 6.1/97.2 | 10.3/92.7 | 10.6/92.3 | 10.3/92.7 | 5.9/97.6 |
| real_mujawwad (held-out) | 11.4/97.6 | 10.8/97.8 | **8.8/98.0** | 7.4/98.4 | 11.4/97.6 | 11.4/97.0 | 10.8/97.8 | 11.8/97.6 |
| real_mujawwad_ea (new) | 14.7/96.5 | 12.8* | **11.2/98.7** | 10.9/99.0 | 14.7/96.5 | 18.3/95.5 | 11.2/98.7 | 14.7/96.5 |
| syn 0.5x | 14.9/95.2 | 9.7/95.5 | 9.2/95.4 | 8.9/94.9 | 14.9/95.2 | 21.9/88.8 | 9.7/95.5 | 14.8/95.5 |
| syn 1x | 5.6/98.8 | 5.6/98.8 | 5.2/98.9 | 3.7/99.2 | 5.5/98.8 | 5.3/99.3 | 5.5/98.8 | 5.5/98.9 |
| syn 1.5x | 7.7/97.3 | 7.7/97.3 | 7.7/97.3 | 6.8/97.4 | 4.4/98.9 | 5.1/98.5 | 4.4/98.9 | 7.5/97.5 |
| syn 2x | 14.5/88.1 | 14.5/88.1 | 14.5/88.1 | 14.5/88.1 | 9.3/94.9 | 8.9/95.1 | 9.3/94.9 | 14.3/88.0 |
| syn 3x | 46.0/57.0 | = | = | = | 30.3/69.5 | 25.8/73.0 | 30.3/69.5 | 44.8/57.7 |
(*12.8 = slowq 1.3 mcap 12; 11.9 with mcap 20; 11.2 slowq 2 mcap 30.)
A1 sweep on real_mujawwad_ea: slowq 1.3/2/3 at mcap 12 = 12.8 (cap-bound); mcap 20 = 11.9; slowq 2 + mcap 30 = 11.2.

Auto detector (clips with >= 1 held/stretched piece) = confusion vs true class:
- slow rule @1.0 w/s: murattal 1%, hadr 0%, hadr_trainseen 0%, mujawwad 44%, syn 0.5x 77%, 0.75x 38%, 1x 11%, >=1.5x 0%.
- fast rule @7.5 letters/s: hadr 87%, murattal 13%, syn 1x 12%, 1.5x 45%, 2x 88%, mujawwad 2%.

## Full non-regression gate (ctc_up verify %, phone pipeline int8)
| cfg | ALL | L1 | L2 | L3 | reciters | retasy | retasy_wrong | SNR20 | SNR10 | SNR5 | wrong-caught ALL / L2 | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G10b shipped (gate_G10b_ship) | 97.3 | 99.3 | 98.3 | 97.9 | 99.5 | 98.3 | 94.8 | 98.3 | 96.8 | 93.8 | 99.1 / 96.9 | baseline |
| mode normal (reproduction) | 97.3 | 99.3 | 98.3 | 97.9 | 99.5 | 98.3 | 94.8 | 98.3 | 96.8 | 93.8 | 99.1 / 96.9 | identical |
| A1 auto 0.8 (slowA) | 97.5 | 99.3 | 98.3 | 97.9 | 99.5 | 98.7 | 94.8 | 98.4 | 97.0 | 94.3 | 99.1 / 96.9 | pass |
| **A1 auto 1.0 (slowA_w1)** | **97.6** | 99.3 | 98.3 | 97.9 | 99.6 | 98.7 | 94.8 | 98.6 | 97.3 | 94.6 | 99.1 / 96.9 | **pass = WINNER** |
| A1 forced slow (slowF) | 97.8 | 99.3 | 98.3 | 97.9 | 99.8 | 98.7 | 95.0 | 98.9 | 97.4 | 95.0 | 99.1 / 96.9 | pass, but +1.5 s wait for everyone |
| A2 auto (fastA) | 96.9 | 99.0 | 97.3 | 96.6 | 99.5 | 97.5 | 94.0 | 97.9 | 96.5 | 93.6 | 99.2 / 98.5 | FAIL |
| A2 forced (fastF) | 96.7 | 99.2 | 97.1 | 95.9 | 99.3 | 97.7 | 92.0 | 97.6 | 96.6 | 93.6 | 99.1 / 98.5 | FAIL |
| AUTO A1+A2 | 97.0 | 99.0 | 97.3 | 96.6 | 99.5 | 98.0 | 94.0 | 98.1 | 96.7 | 94.1 | 99.2 / 98.5 | FAIL (A2 part) |
| B G10s int8 | 97.4 | 99.5 | 98.4 | 97.8 | 99.5 | 98.5 | 94.2 | 98.3 | 96.8 | 93.9 | 99.0 / 96.9 | FAIL (retasy_wrong -0.6, L3 -0.1, wc -0.1) and no speed gain |

## Fine-tune runs (B), env D:\nemo-env, fp32, BN eval, PLAIN letters, BATCH_SEC 40 ACC 3 MEMFRAC 0.85, freeze 1/2, mix G10b (L2 .4 / L1 .2 / replayT .4) + G10b on-the-fly noise aug
- New LEVEL `G10s` in tools/asr/gpu/nv_curr.py (backup nv_curr.py.bak_g10s): tempo (ffmpeg atempo, pitch kept) on SPD_P of clips: 2/3 at 1.3-2.2x, 1/3 at 0.6-0.8x (slow only <= 8 s). In-loop eval adds fast18 / slow07 (test_L2 at 1.8x / 0.7x); pick = fast18 CER with clean <= +0.2 and every noisy <= +0.2.
- G10s: INIT G10b best.nemo, LR 1e-5, warm 100, 1200 steps, SPD_P 0.3, 06:06-07:14 (~1 h 8 min). fast18 23.10 → 21.71 (best step 800), slow07 7.57 → 7.21, clean/noisy within ±0.2. Export = nv_gate.export (QUInt8) + nv_shrink posmax 1000 → qtrain/gpu-train/phone_G10s/model.shrunk.int8.onnx (115268336 B, same size as G10b). Int8 gate: FAIL (table). Speed bench: no real gain (syn 2x 88.0).
- G10sb: LR 3e-5, SPD_P 0.5, 07:30-08:08. fast18 → 19.74 at step 1200, but noisy proxy gate fails from step 400, clean fails at 600/1200; only step 200 passed (fast18 21.54 ≈ G10s). Not exported (no gain over G10s, which already failed).
- Conclusion B: the 80 ms frame limit on real hadr is not fixed by tempo augmentation at a safe LR; at a higher LR noise robustness drops. Not continued.

## Verdict
- Winner: A1 slow-merge, auto, slow_wps 1.0, slowq 2.0 s, mcap 30 s (pipeline only, one model). Proposal: plans/asr-speed-bench/nvasr-pace-slow.patch.md.
- Speed targets: slow/mujawwad WERskel within 3 of murattal 7.9: held-out mujawwad 8.8 ✓, everyayah mujawwad 11.2 (3.3, ✗ by 0.3; was 14.7). Fast ≥ 2.5 w/s / 2x: NOT met by any safe candidate (A2 helps synthetic only, hurts real hadr; B no gain). Real hadr is already OK at 96.6 tracking (2.2 w/s median).
- No fine-tuned model to ship. Keep G10b.

## Phase 3: Deban hadr (real, whole mushaf) — level G10d (2026-11-24)
Data (qtrain/deban, outside git): 7:28:33 webm -> 16 kHz wav; G10b fp32 emissions (2 passes: 30 s/4 s overlap and 24 s/3 s offset 7 s);
chunked CTC Viterbi with free end (qtrain/deban/align.py) over the verified Uthmani text (quran-uthmani-quranenc -> nv_curr.target);
basmala before every surah except 9; isti'adha not detected. 6236 ayat aligned; passes agree within 0.2 s on 6235; kept 4955 (79.5%,
6.26 h) after conf >= -1.0 (mean token log-prob) and 0.035-0.2 s/letter; greedy CER kept 6.1% vs dropped 24.5%. w/s p10/25/50/75/90 =
2.34/2.64/3.03/3.53/4.09. Hold-out (EVAL ONLY) surahs 8 12 18 30 36 50 56 67 78 87 93 100 112 = 565 clips 0.65 h; train 4300 clips <= 14.4 s = 5.12 h.
Fix found on the way: quran_words.json 'w' is rasm-like (السموت, يمعشر); the first alignment with it drifted in surah 55. Labels now from the Uthmani file.
Baseline G10b int8 (bench.py 5.22 phone settings, no ctc_up) Deban HO: verify 94.5, wrong caught 97.7, ayah id 95.4, CER 5.4; speed bench WERskel 10.4 / track 95.3.
Re-export of G10b best.nemo via qtrain/deban/exp.py = sha e3294079 (bit-exact with the shipped file), so candidates are exported the same way.

Short proxy runs (600 steps, eval 300, init G10b, warm 100; nv_curr cer on vad_pieces; ref = init_G10d). Gate = G10S-style +0.2 on clean/noisy/hadr_other.
| tag | knobs | test_L1 | test_L2 | ho_rec | ho_retasy | n20 | n10 | n5 | tlog | hadr_other | deban_ho | proxy |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ref G10b | - | 3.36 | 6.73 | 8.95 | 5.21 | 7.43 | 16.11 | 22.88 | 5.88 | 7.76 | 9.09 | - |
| p1base | DEB_P .2 LR 3e-5 | 3.20 | 6.69 | 8.97 | 5.06 | 7.37 | 16.23 | 22.97 | 5.78 | 7.86 | 8.57 | pass @600 |
| p2rep65 | DEB_P .35 | 3.51 | 6.99 | 8.95 | 4.88 | 7.43 | 16.14 | 22.76 | 5.66 | 8.10 | 8.39 | fail (L1/L2/hadr_other) |
| p3lr1 | LR 1e-5 | 3.38 | 6.84 | 9.02 | 5.25 | 7.52 | 16.26 | 22.94 | 5.88 | 8.30 | 8.70 | fail (hadr_other) |
| p4top | FREEZE .75 | 3.49 | 6.93 | 9.21 | 5.06 | 7.49 | 16.17 | 23.00 | 5.88 | 8.68 | 8.74 | fail |
| p5kd | KD 1.0 (LwF) | 3.04 | 6.48 | 9.27 | 5.43 | 7.65 | 17.32 | 23.57 | 5.70 | 7.42 | 8.72 | fail (noisy10, retasy) |
| p6l2sp | L2SP 1.0 | 3.33 | 6.82 | 9.12 | 5.14 | 7.43 | 16.17 | 22.85 | 5.86 | 8.13 | 8.71 | fail (hadr_other) |
| p7ema | EMA .995 | 3.24 | 6.78 | 9.04 | 5.06 | 7.40 | 16.26 | 23.03 | 5.74 | 8.10 | 8.65 | fail (hadr_other) |
| p8tempo | Deban tempo 0.9-1.3 p.3 | 3.29 | 6.61 | 8.97 | 4.99 | 7.46 | 16.50 | 22.91 | 5.75 | 8.00 | 8.36 | fail (noisy10) |
Note: 82-160-clip sets move +-0.3 between steps by themselves; gains on deban_ho are small (-0.4..-0.7 CER).

Int8 phone-pipeline gate (bench.py verify %, 5.22 settings, no ctc_up; ALL here includes deban_ho), WiSE pNwK = G10b + 0.K*(p1base - G10b):
| metric | G10b_ref | p1base | p1w5 | p1w3 |
|---|---|---|---|---|
| ALL verify | 94.5 | 94.8 (+0.3) | 94.7 (+0.2) | 94.6 (+0.1) |
| ALL wc | 95.5 | 95.5 (+0.0) | 95.6 (+0.1) | 95.7 (+0.2) |
| test_L1 verify | 98.3 | 98.5 (+0.2) | 98.4 (+0.1) | 98.4 (+0.1) |
| test_L2 verify | 95.9 | 95.9 (+0.0) | 96.0 (+0.1) | 96.0 (+0.1) |
| test_L2 wc | 97.4 | 97.4 (+0.0) | 97.4 (+0.0) | 97.9 (+0.5) |
| test_L3 verify | 94.9 | 95.7 (+0.8) | 95.6 (+0.7) | 94.8 (-0.1) |
| ho_reciters verify | 97.0 | 97.1 (+0.1) | 96.9 (-0.1) | 97.0 (+0.0) |
| ho_retasy verify | 95.3 | 94.9 (-0.4) | 95.3 (+0.0) | 95.1 (-0.2) |
| ho_retasy_wrong verify | 90.7 | 89.7 (-1.0) | 89.7 (-1.0) | 90.1 (-0.6) |
| ho_noisy20 verify | 95.8 | 95.6 (-0.2) | 95.7 (-0.1) | 95.7 (-0.1) |
| ho_noisy10 verify | 93.4 | 93.4 (+0.0) | 93.3 (-0.1) | 93.5 (+0.1) |
| ho_noisy5 verify | 90.7 | 90.6 (-0.1) | 90.7 (+0.0) | 90.9 (+0.2) |
| deban_ho verify | 94.5 | 95.3 (+0.8) | 95.0 (+0.5) | 94.7 (+0.2) |
| deban_ho wc | 97.7 | 98.2 (+0.5) | 98.2 (+0.5) | 98.2 (+0.5) |
| deban_ho ayah_id_top1_% | 95.4 | 96.3 | 95.9 | 95.8 |
| deban_ho cer_% | 5.4 | 5.0 | 5.1 | 5.2 |
| speed real_hadr WERskel/track | 11.0/96.6 | 10.4/97.1 | 10.4/97.0 | - |
| speed deban_ho WERskel/track | 10.4/95.3 | 9.9/96.1 | 10.0/95.8 | - |
| speed real_murattal WERskel/track | 7.9/97.0 | 7.7/97.0 | 7.7/97.0 | - |
| speed real_mujawwad WERskel/track | 11.4/97.6 | 11.6/97.4 | 12.0/97.0 | - |
| speed syn_1x WERskel/track | 5.6/98.8 | 5.3/98.9 | 5.7/98.6 | - |
| speed syn_2x WERskel/track | 14.5/88.1 | 13.9/89.6 | 13.7/89.1 | - |
- f1 (p1base config, 1500 steps): deban_ho proxy 8.11 @900 but noisy proxy fails at every eval -> not exported.


Final int8 table (f2w5 = f2mix step1500 WiSE .5, f1s9w5 = f1 step900 WiSE .5):
| metric | G10b_ref | p1base | p1w7 | p1w5 | p1w3 | f2w5 | f1s9w5 |
|---|---|---|---|---|---|---|---|
| ALL verify | 94.5 | 94.8 (+0.3) | 94.8 (+0.3) | 94.7 (+0.2) | 94.6 (+0.1) | 94.7 (+0.2) | 94.8 (+0.3) |
| ALL wc | 95.5 | 95.5 (+0.0) | 95.7 (+0.2) | 95.6 (+0.1) | 95.7 (+0.2) | 95.3 (-0.2) | 95.6 (+0.1) |
| test_L1 verify | 98.3 | 98.5 (+0.2) | 98.6 (+0.3) | 98.4 (+0.1) | 98.4 (+0.1) | 98.4 (+0.1) | 98.5 (+0.2) |
| test_L2 verify | 95.9 | 95.9 (+0.0) | 96.1 (+0.2) | 96.0 (+0.1) | 96.0 (+0.1) | 96.0 (+0.1) | 96.3 (+0.4) |
| test_L2 wc | 97.4 | 97.4 (+0.0) | 97.9 (+0.5) | 97.4 (+0.0) | 97.9 (+0.5) | 97.4 (+0.0) | 97.9 (+0.5) |
| test_L3 verify | 94.9 | 95.7 (+0.8) | 95.6 (+0.7) | 95.6 (+0.7) | 94.8 (-0.1) | 94.9 (+0.0) | 94.9 (+0.0) |
| ho_reciters verify | 97.0 | 97.1 (+0.1) | 97.1 (+0.1) | 96.9 (-0.1) | 97.0 (+0.0) | 96.3 (-0.7) | 96.9 (-0.1) |
| ho_retasy verify | 95.3 | 94.9 (-0.4) | 95.1 (-0.2) | 95.3 (+0.0) | 95.1 (-0.2) | 95.1 (-0.2) | 95.2 (-0.1) |
| ho_retasy_wrong verify | 90.7 | 89.7 (-1.0) | 90.1 (-0.6) | 89.7 (-1.0) | 90.1 (-0.6) | 89.5 (-1.2) | 90.3 (-0.4) |
| ho_noisy20 verify | 95.8 | 95.6 (-0.2) | 95.6 (-0.2) | 95.7 (-0.1) | 95.7 (-0.1) | 95.5 (-0.3) | 95.7 (-0.1) |
| ho_noisy10 verify | 93.4 | 93.4 (+0.0) | 93.5 (+0.1) | 93.3 (-0.1) | 93.5 (+0.1) | 93.1 (-0.3) | 93.4 (+0.0) |
| ho_noisy5 verify | 90.7 | 90.6 (-0.1) | 90.8 (+0.1) | 90.7 (+0.0) | 90.9 (+0.2) | 90.5 (-0.2) | 90.8 (+0.1) |
| deban_ho verify | 94.5 | 95.3 (+0.8) | 95.2 (+0.7) | 95.0 (+0.5) | 94.7 (+0.2) | 95.5 (+1.0) | 95.3 (+0.8) |
| deban_ho wc | 97.7 | 98.2 (+0.5) | 98.1 (+0.4) | 98.2 (+0.5) | 98.2 (+0.5) | 98.1 (+0.4) | 98.1 (+0.4) |
| deban_ho ayah_id_top1_% | 95.4 | 96.3 | 95.9 | 95.9 | 95.8 | 95.6 | 95.9 |
| deban_ho cer_% | 5.4 | 5.0 | 5.1 | 5.1 | 5.2 | 5.0 | 5.0 |
| speed real_hadr WERskel/track | 11.0/96.6 | 10.4/97.1 | 10.9/96.8 | 10.4/97.0 | 10.7/96.8 | 10.6/97.0 | 10.6/97.0 |
| speed deban_ho WERskel/track | 10.4/95.3 | 9.9/96.1 | 10.0/95.9 | 10.0/95.8 | 10.0/95.5 | 9.7/96.0 | 9.8/96.1 |
| speed real_murattal WERskel/track | 7.9/97.0 | 7.7/97.0 | 7.8/97.2 | 7.7/97.0 | 7.9/96.8 | 7.5/96.8 | 7.4/97.2 |
| speed real_mujawwad WERskel/track | 11.4/97.6 | 11.6/97.4 | 11.6/97.2 | 12.0/97.0 | 11.8/97.6 | 12.6/97.2 | 11.6/97.2 |
| speed syn_1x WERskel/track | 5.6/98.8 | 5.3/98.9 | 5.5/98.8 | 5.7/98.6 | 5.6/98.6 | 6.0/98.4 | 5.3/98.8 |
| speed syn_2x WERskel/track | 14.5/88.1 | 13.9/89.6 | 13.5/89.9 | 13.7/89.1 | 14.3/88.7 | 13.9/89.8 | 14.1/89.6 |
Verdict phase 3: NO WINNER (every candidate ho_retasy_wrong -0.4..-1.2). Keep G10b. Report: plans/asr-speed-bench/report.html#phase3.

