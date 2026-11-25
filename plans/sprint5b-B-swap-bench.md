# Sprint 5b B - one-letter swap bench (rsame_strict P4 / P8 x CTC rescue)

Experiment only: nothing in web/, android/ or the bench defaults changed. Code: `tools/asr/eval/swap/`. Model v5 (G10d_f1s9w5), phone pipeline rows
`D:\Quran App\qtrain\eval\out\mode_f1s9w5_n` (rows-s.json + lp/, the gate that gave ctc_up ALL 97.3). Raw records: `plans/swap-scratch/full.json`.

## Method
- rsame_strict = rsame, and False when SOME optimal edit alignment of the two skeletons has a substitution whose pair is in the set (ties OR-ed). JS twin inside `rlocal_spans_swap.js` (loads web/app.js read-only, swaps rSame in memory). `parity.py`: JS == Python on 20k pairs (0 mismatches); P4 flips 225 pairs, P8 378, of the 20k test pairs.
- Rescue = the app's hybrid: rLocal places each piece, then `ctc_up` (forced alignment, g=3 d=4, word is right if CTC reads it), then red words with margin < 1.0 (CTC_UNSURE) become unsure (margins as in s6_calib.py: `best_score - best_score(no_skip)`). The bench rows DO carry the log-probs (lp/*.npz) so margins were computed for every red word; no Java port needed.
- Columns: `recite` = bench.py recite() on the greedy text, no CTC (what bench.py / nearmiss.py score); `rLocal` = app matcher no CTC; `ctc_up` = + CTC rescue; `+unsure` = caught counts wrong OR unsure (hard = wrong only). "Caught" counts words not judged right, unreached included (p1b convention) except the `recite` column (v==0 only, nearmiss.py convention).
- Near-miss TEST = nm_items.json split=test (2220 items usable of 3087 test: rows exist for them; 0 w-mismatch, 5 CTC-unit-unmappable dropped). CTC units for the near-miss word = the original word's simple-spelling unit with the same skeleton edit applied.
- NEW set "swap items" (2011, test clips, 3 per clip, seed 5): one-letter P4/P8 swap in a 3+ letter word that BASELINE rSame accepts. Needed because of the finding below.

## Finding 0: nm_items.json cannot measure this
nearmiss.py build keeps only candidates with `not rsame(c, w)`, so every item is already rejected by the baseline matcher. Only 1 test item is a P4 pair swap. Hence P4/P8 change nothing there (99.0 / 94.3 identical in all variants). The swap set above is the right test.

## Results
### Standard bench (p1b negatives, phone pipeline, 1906 clips)
| rsame | matcher | right words judged right % | false red % (wrong or unsure) | false red hard % | neg word caught % (wrong or unsure) | neg caught hard % |
|---|---|---|---|---|---|---|
| base | recite() no CTC (bench.py) | 94.6 | 5.4 | - | 95.0 | - |
| base | rLocal no CTC | 95.8 | 4.2 | 4.2 | 99.6 | 99.6 |
| base | rLocal + CTC ctc_up | 97.0 | 3.0 | 3.0 | 99.1 | 99.1 |
| base | ctc_up + unsure | 97.0 | 3.0 | 2.9 | 99.1 | 98.8 |
| P4 | recite() no CTC (bench.py) | 94.6 | 5.4 | - | 95.0 | - |
| P4 | rLocal no CTC | 95.8 | 4.2 | 4.2 | 99.6 | 99.6 |
| P4 | rLocal + CTC ctc_up | 97.0 | 3.0 | 3.0 | 99.1 | 99.1 |
| P4 | ctc_up + unsure | 97.0 | 3.0 | 2.9 | 99.1 | 98.8 |
| P8 | recite() no CTC (bench.py) | 94.6 | 5.4 | - | 95.0 | - |
| P8 | rLocal no CTC | 95.8 | 4.2 | 4.2 | 99.6 | 99.6 |
| P8 | rLocal + CTC ctc_up | 97.0 | 3.0 | 3.0 | 99.1 | 99.1 |
| P8 | ctc_up + unsure | 97.0 | 3.0 | 2.9 | 99.1 | 98.8 |

### Near-miss TEST (nm_items.json split=test) - % caught (wrong or unsure)
| group | n | base recite | base rLocal | base ctc_up | base ctc_up+unsure(hard) | P4 recite | P4 rLocal | P4 ctc_up | P4 ctc_up+unsure(hard) | P8 recite | P8 rLocal | P8 ctc_up | P8 ctc_up+unsure(hard) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ALL | 2220 | 94.3 | 99.8 | 99.0 | 99.0 (99.0) | 94.3 | 99.8 | 99.0 | 99.0 (99.0) | 94.3 | 99.8 | 99.0 | 99.0 (99.0) |
| vocab | 2219 | 94.3 | 99.8 | 99.0 | 99.0 (99.0) | 94.3 | 99.8 | 99.0 | 99.0 (99.0) | 94.3 | 99.8 | 99.0 | 99.0 (99.0) |
| one P4 pair | 1 | 100.0 | 100.0 | 100.0 | 100.0 (100.0) | 100.0 | 100.0 | 100.0 | 100.0 (100.0) | 100.0 | 100.0 | 100.0 | 100.0 (100.0) |
| other one-sub | 33 | 97.0 | 100.0 | 90.9 | 90.9 (90.9) | 97.0 | 100.0 | 90.9 | 90.9 (90.9) | 97.0 | 100.0 | 90.9 | 90.9 (90.9) |

### NEW swap items (TEST clips; one-letter confusion swap in a 3+ letter word that baseline rSame ACCEPTS)
| group | n | base recite | base rLocal | base ctc_up | base ctc_up+unsure(hard) | P4 recite | P4 rLocal | P4 ctc_up | P4 ctc_up+unsure(hard) | P8 recite | P8 rLocal | P8 ctc_up | P8 ctc_up+unsure(hard) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ALL | 2011 | 5.5 | 6.2 | 5.6 | 5.6 (5.4) | 68.6 | 73.4 | 66.1 | 66.1 (63.4) | 94.0 | 98.9 | 86.3 | 86.3 (82.3) |
| P4 pairs | 1459 | 6.0 | 6.6 | 6.0 | 6.0 (5.8) | 93.0 | 99.2 | 89.4 | 89.4 (85.7) | 93.0 | 99.2 | 89.4 | 89.4 (85.7) |
| P8-extra pairs | 552 | 4.2 | 5.1 | 4.7 | 4.7 (4.3) | 4.2 | 5.1 | 4.7 | 4.7 (4.3) | 96.6 | 98.0 | 78.1 | 78.1 (73.2) |
| set ho_noisy10 | 373 | 5.1 | 6.4 | 6.2 | 6.2 (6.2) | 67.8 | 73.7 | 66.2 | 66.2 (64.3) | 92.8 | 98.4 | 86.9 | 86.9 (83.6) |
| set ho_noisy20 | 359 | 3.3 | 3.6 | 3.3 | 3.3 (3.1) | 70.5 | 75.8 | 69.6 | 69.6 (67.4) | 94.7 | 99.7 | 87.5 | 87.5 (84.4) |
| set ho_noisy5 | 360 | 8.1 | 11.9 | 11.7 | 11.7 (11.7) | 70.0 | 77.8 | 71.9 | 71.9 (68.9) | 90.6 | 98.9 | 87.5 | 87.5 (83.3) |
| set ho_reciters | 207 | 4.8 | 1.4 | 1.0 | 1.0 (1.0) | 70.0 | 70.0 | 62.3 | 62.3 (61.4) | 99.0 | 99.5 | 87.0 | 87.0 (85.0) |
| set ho_retasy | 162 | 3.1 | 4.3 | 4.3 | 4.3 (3.7) | 67.9 | 80.2 | 77.8 | 77.8 (75.3) | 87.7 | 100.0 | 94.4 | 94.4 (91.4) |
| set test_L1 | 143 | 6.3 | 7.0 | 5.6 | 5.6 (4.9) | 69.9 | 70.6 | 60.8 | 60.8 (55.2) | 97.2 | 97.9 | 80.4 | 80.4 (72.0) |
| set test_L2 | 233 | 6.4 | 5.2 | 3.9 | 3.9 (3.9) | 65.7 | 66.5 | 54.5 | 54.5 (51.9) | 96.1 | 97.9 | 80.3 | 80.3 (76.4) |
| set test_L3 | 174 | 6.3 | 6.9 | 5.7 | 5.7 (5.2) | 65.5 | 67.8 | 60.3 | 60.3 (55.2) | 96.6 | 98.9 | 84.5 | 84.5 (77.6) |

## Extra counts (diag.py)
- Right words (11,779 pos words, 1906 clips incl. noisy 5/10/20 dB, retasy): word verdicts base vs P4 vs P8 are identical for rLocal and for ctc_up: **0 flips**, so strict costs 0 false reds here (95% upper bound ~0.03%). This bench has no recited-with-slip confusion pairs the model mishears, so the "CTC turns model slips back to right" benefit cannot show up either (the 95.8 -> 97.0 gain from ctc_up is the same for all variants).
- Standard negatives (random Quran word): wrong_word_caught unchanged (recite 95.0, rLocal 99.6, ctc_up 99.1, +unsure hard 98.8) for all variants.
- Swap items, rLocal no CTC: base accepts 93.8% (1887/2011 right). P4 leaves 535 accepted (P8-only pairs + 12 P4), P8 leaves 22.
- CTC rescue undoes part of the gain: it re-accepts 10.6% of P4-pair swaps and 21.9% of P8-extra swaps (forced alignment of the swapped word still "reads" it: skip cost d=4 > one wrong letter). Margin<1.0 «unsure» adds ~0 (hard 85.7 vs 89.4 only because unsure is rare; the "caught or unsure" column barely moves).

## Recommendation
1. Adopt rsame_strict. P8 over P4: same 0 measured false-red cost, catches 98.9% (rLocal) / 86.3% (with rescue) of swaps vs 73.4 / 66.1 for P4. Baseline: 6.2 / 5.6.
2. Keep ctc_up for ordinary reds (it is worth +1.2 pt right_acc) but do NOT let it override a red that came from the strict rule: otherwise ~11-22% of swaps are re-accepted (86.3 vs 98.9). Cost of that exemption is unmeasurable on this bench (no confusion-pair slips among right words), so it needs real mis-hearing data (learner/ho_retasy_wrong style clips with ض/د, ص/س audio) before deciding; a middle road is rescue only when the forced margin of the heard letter path is high (a threshold sweep like s6_calib on the sw items, not done here).
3. Caveat: dialect users who say ث as س / ذ as ز / ظ as ض will now be flagged red (that is the point for a tajweed learner app) but the P8-extra pairs are the likeliest to annoy; P4 is the conservative pick.
Not measured: real learner audio, Java/JS app wiring, speed (strict DP is the same O(mn)).

## Reproduce
```
py -3.11 -X utf8 -I D:\Quran App\quran-karim\tools\asr\eval\swap\parity.py
bash "D:/Quran App/quran-karim/tools/asr/eval/swap/run.sh" "D:/Quran App/quran-karim/plans/swap-scratch/full.json"     # ~3 min, 10 workers
%USERPROFILE%\ml-env\Scripts\python.exe -X utf8 -I D:\Quran App\quran-karim\tools\asr\eval\swap\swap_report.py plans\swap-scratch\full.json D:\Quran App\qtrain\eval\out\mode_f1s9w5_n\rows-s.json out.md
%USERPROFILE%\ml-env\Scripts\python.exe -X utf8 -I D:\Quran App\quran-karim\tools\asr\eval\swap\diag.py plans\swap-scratch\full.json
```

## Update: real app code path (P8 strict in web/app.js, pair-swap reds not rescued)
web/app.js was patched by the coordinator with `tools/asr/eval/swap/apply_app_edit.py` (rSim/R_PAIRS/rSame at ~2640, `sw` marks in rLocal, ctcJudge skip). I did NOT edit bench.py (edit was refused by the permission system); the Python twin is `swap/strict.py` (monkeypatched onto bench.rsame by `swap/parity_prep.py`). If bench.py should carry it, copy `rsim` from strict.py.
- Parity: `swap/parity_prep.py` (recite_dp with ins=1.0 + strict P8) -> `node swap/parity_app.js web/app.js plans/swap-scratch/rows-dp-P8.json` = **same 3812 diff 0**; loose control (LOOSE=1 vs Python loose) also diff 0. (parity.js itself cannot load the new app.js: it does not grab rSim/R_PAIRS; parity_app.js does.)
- Variant `app` in swap_eval = rLocal taken from the real app.js (`sw` marks used to skip rescue and unsure). Raw: plans/swap-scratch/full2.json, tables: plans/swap-scratch/tables2.md.
- Standard bench, app vs base: identical (recite 94.6 right / 95.0 neg caught; rLocal 95.8 / 99.6; ctc_up 97.0 / 99.1; +unsure hard 98.8). 0 right-word flips.
- Swap items (2011), app: rLocal 98.9 caught, ctc_up 98.0, ctc_up+unsure 98.0 (hard 97.6); P4 pairs 98.5, P8-extra 96.6 (base 5.6). The 0.9 pt left between rLocal and ctc_up is reds not marked as pair swaps (word dropped/unaligned), which keep the normal rescue.
- recite_sim.js: exit 0, "errs":[].
- Repro: `bash swap/run.sh plans/swap-scratch/full2.json`; `swap_report.py full2.json rows-s.json out.md`.
