# ASR item #2 phase 4 - wrong-word caught (2026-11-24)

## 1. How "wrong caught" is judged (bench.py)
- No posterior threshold in bench verify: greedy CTC text per VAD piece -> recite() (port of web/app.js reciteHear) with rSame
  = skeleton similarity >= 0.6 (web/app.js:2631-2635). Phone adds ctc_up (Ctc.java G=3, D=4) only via p1b_port_eval.
- verify_acc_% = (canonical words judged right + one random swapped Quran word flagged) / all judgments.
- ho_retasy_wrong = 100 RetaSy clips labelled `in_correct` (real human-judged mistakes, single ayah; make_heldout.py:89).
  Positives there are the CANONICAL ayah words, although the reciter said some of them wrong.
- Decomposition (int8 gate rows): wrong_word_caught_% on ho_retasy_wrong = 92.0 for G10b and every phase-3 candidate
  (p1base 91.0). The -0.4..-1.2 loss is ALL on the accept side: word_accept_correct 90.4 -> 88.9-89.9.
  G10b vs f1s9w5 differ in 2 words of 2 clips, both clips the reciter misread (rt-bad-109006-725 «ولي دين», rt-bad-001002-1874
  «لله»: G10b heard «للهخر»). Rejecting a canonical word on a mis-recited clip may be CORRECT -> the gate penalises it.
- More real wrong-recitation audio: only RetaSy in_correct (no licence: eval only, never train) -> B4 impossible.

## 2. Near-miss text-mutation eval (qtrain/deban/p4/nearmiss.py, items nm_items.json)
- From each model's own bench rows (piece_texts), no audio rerun: up to 3 words per clip replaced by a near-miss that the matcher
  can reject (Quran vocab skeleton, lev <= 2, length +-1, NOT rSame to the true word). All sets except ho_retasy_wrong.
- Learner swaps (ض/د ص/س ح/ه ق/ك ة/ه, ف/ب/ل prefix) are almost always rSame (>= 0.6) -> the APP MATCHER accepts them on any
  word of >= 3 skeleton letters, whatever the model hears (only 2 such items survive). This is a matcher design limit, not a model one.
- 6202 items / 2364 clips; split by md5(clip id): DEV 3115, TEST 3087.
- Caught % DEV / TEST: G10b 95.9/95.4, p1base 96.0/95.5, p1w7 95.9/95.5, p1w5 96.0/95.4, p1w3 95.9/95.4, f2w5 95.7/95.2,
  f1s9w5 95.9/95.5. Std error ~0.4 -> all equal to G10b except f2w5 (-0.2, also worst in phase 3 = ranking agrees there).
- Validation vs real ho_retasy_wrong wrong-caught: that metric is flat (92.0 all) so no ranking to match; consistent with it:
  hadr candidates do not become lenient to wrong words.

## 3. Candidates
- B1 (threshold): there is no verify threshold in the gated pipeline (greedy + rSame 0.6); the only knobs are Ctc.java G/D
  (ctc_up, hours of CPU per model). Not run: nothing to recover, wrong-caught is already = G10b.
- B2/B3/B4: not run. The problem they target (model lenient to near-misses) is not present on 6202 near-miss items.

## Verdict
No model shipped under the rule as written (ho_retasy_wrong verify still -0.4 for f1s9w5). The rule's failing number measures
canonical-word acceptance on mis-recited clips. Decision for the user: gate ho_retasy_wrong on wrong_word_caught_% (+ the new
near-miss TEST) instead of verify_acc. Under that gate f1s9w5 (f1 step 900, WiSE .5) passes every set (worst -0.1) and is better
on hadr (Deban verify +0.8, real hadr WERskel 11.0 -> 10.6). Before shipping it: ctc_up p1b_port_eval, q.asrPace slow, pack v5.

## 4. Revised gate (user approved): retasy_wrong judged by wrong_caught + near-miss TEST. Candidate f1s9w5
ctc_up (p1b_port_eval, G=3 D=4; qtrain/eval/out/mode_f1s9w5_n vs mode_normal = shipped G10b), verify %:
ALL 97.3=97.3, L1 99.3=, L2 98.3->98.5, L3 97.9=, reciters 99.5=, retasy 98.3=, rwrong 94.8->95.1 (wrong_caught 100=100),
noisy20/10/5 98.3->98.2 / 96.8->96.7 / 93.8=, wrong-caught ALL 99.1=99.1. Worst -0.1 -> PASS.
q.asrPace slow (mode_f1s9w5_slowF vs mode_slowF): ALL 97.8 = 97.8 (worst set noisy5 -0.1) -> PASS.
Int8 bench + near-miss TEST + hadr: section 2 / phase 3 (Deban verify +0.8, real hadr WERskel 11.0 -> 10.6, near-miss TEST 95.5 vs 95.4).
VERDICT: WINNER f1s9w5 (G10d f1 step 900, WiSE 0.5 to G10b).

## 5. Files (nothing uploaded, app not edited)
- qtrain/gpu-train/z1/G10d_f1s9w5.int8.onnx 115268336 B sha256 b6856868d5e94cc067613ef015461f0610eab9239c0392d25e9cf92350207ca1
  (same exp.py export that re-made G10b bit-exact; G10b.int8.onnx untouched e3294079...).
- qtrain/deban/p4/pack_v5/asrnv5.zip 50132498 B sha256 7ee13e00a4ec39e5fd24a86cfb0f796edf404142a35ffac364b85c584e7f1edd
  = v4 layout: asr/asrnv/a.bin (first 57634168 B), vocab.json (v4 bytes; token list identical to the model's), ver.txt "5",
  lib/*.so copied from v4.  asrnvp5.zip 42741013 B sha256 9ffd5a4fbccead369188021f31b2c9698754b0293da955f5fe990ff089853964 = asr/asrnvp/b.bin.
  Join test a.bin+b.bin -> sha b6856868... OK. Builder: qtrain/deban/p4/pack_v5.py.
## 6. App change for 5.37 (to do by the coordinator)
- web/app.js:395 `ver: 4` -> `ver: 5` (comment: v5 (5.37): G10d_f1s9w5, hadr). edUrl() then fetches asrnv5.zip / asrnvp5.zip;
  mb stays 93 (sizes ~ v4). No threshold change (Ctc.java G/D unchanged), no EdStore.java change (it handles any asrnv* id).
- Upload asrnv5.zip + asrnvp5.zip to the `editions` branch of drmalek1987/quran-karim (beside asrnv4/asrnvp4, which stay for rollback).
- Then release checklist + full QA + phone test (asrUpdate path 4 -> 5).
