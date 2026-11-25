# Sprint 5b (2026-11-25): continuation of the Sprint 5 batch -> 5.38 (the next batch is Sprint 6)

Base: 5.37 (versionCode 85) on main, Play Alpha, phone bee81250. Target version: **5.38**.
Status: AGREED with the user 2026-11-25: B, then A, then D + C, and the sprint stops there (E and F left for the next batch, Sprint 6).

## Candidates (from the Sprint 5 handoff in progress.md)

| Key | Item | Goal served | Size | Notes |
|---|---|---|---|---|
| A | Auto pace (`q.asrPace` = auto) | ASR >95% | M-L | Concurrent probe in the NvAsr recorder, Java/Python parity, phone test. Bench: auto ALL 97.6, touches murattal by 1%. |
| B | Matcher: one-letter learner swaps | ASR >95% (catching mistakes) | M | `rSame >= 0.6` at `web/app.js:2631-2635` lets ض/د, ص/س, ح/ه, ق/ك, ة/ه through in words of 3+ letters. Idea: a letter-level check on the CTC posteriors. |
| C | #25 phone CDP numbers | Speed (verify) | S | `tools/qa/sprint5/perf/run-cdp.py --serial bee81250` with a `DEBUGGABLE=1 APK_SUFFIX=-cdp` build. Needs a phone install (user's word). |
| D | harmain 5:92 split turn early/late | App | S | li=1, pre-existing. |
| E | Sprint 3 «Later» list: 17, 12, 24, 33, 3, 21, 22, 30, 18, 34 | App / ASR | ? | Titles to confirm with the user (the numbers come from the user's own list, session 12f5d8f2). |
| F | #32 hifz programme | App (hifz) | L | Design doc first. |

## Chosen items and order
1. **B** Matcher letter swaps (largest effect on the goal: catching letter mistakes)
2. **A** Auto pace
3. **D + C** harmain 5:92 + #25 phone CDP numbers (small)

Stop after D + C. Later sprints: E (Sprint 3 «Later» list, titles to confirm), F (#32 hifz programme).

## Per item
Goal check -> analogical-reasoning steps shown before the first edit -> qk-scout / qk-dev / qk-qa -> full QA
(run-parallel.js + data.py + matrix + fs-motion + recite_sim) after the last code change -> 5.38 APK, signer 7d8b31d2.
ASR gates: the shipped model must not get worse on any gate. Install, commit, push, release, Play only on the user's word.
