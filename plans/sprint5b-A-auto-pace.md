# Sprint 5b A: «سرعة القراءة» تلقائي (q.asrPace = auto, NvAsr pace 2)

Default stays `normal`; no APK built, no phone test yet.

## Rule (tools/asr/eval/bench.py `speed_post`, config A1 auto: slow_wps 1.0, slowq 2.0, quiet 0.5, mcap 30)
A VAD piece (0.5 s quiet / 12 s cut) is decoded. slow = text non-empty and words / max(0.5, sec - 0.8) < 1.0 (sec includes the preroll and the 0.5 s tail).
If slow and the next piece starts within slowq - quiet = 1.5 s and the joined piece stays <= 30 s: join, re-decode the joined piece, check again.

## Java (android/src/com/quran/karim/NvAsr.java)
- `setPace("auto")` = 2. `isSlow(text, sec)` and `canJoin(gapSamples, joinedSamples)` are pure static methods (the rule).
- Concurrent probe: at the piece's 0.5 s of quiet (or after 12 s of speech in a row, where pace 0 cuts) the recorder copies seg[0..len] and posts
  `launchProbe` to the single worker thread, then keeps recording (it never waits). The worker decodes: fast/empty -> it emits that same decode as the
  final (`emit(..., text, ms)`, so no second decode for fast pieces); slow -> sets `Probe.v = 2`, the recorder holds the piece (as pace 1: ends at
  SLOW_Q 2 s of quiet, emits seg[0..heldAt]) and probes again after the next 0.5 s quiet on the joined piece. On a fast answer the recorder keeps only the audio after the
  probed part if speech already resumed. 30 s cap, stop-flush and cancel are handled (no double final).
- Partials are paused only while a probe is pending (pace 2 only). Pace 0/1 paths: the code is the same expressions (verified by reading; `pz != 0 && heldAt > 0` equals the old `pz == 1 && ...` because only pace 1 sets heldAt outside pace 2).

## Web
web/index.html: third button `data-v="auto"` «تلقائي» in #paceSet (the i18n key already exists). web/app.js: asrPace accepts normal|slow|auto, tailMs 3000 only for normal (5000 for slow/auto), click handler. NvBridge.setPace gets the raw value (already passed).
tools/qa/ui.js (5.36 group): row test now expects 3 buttons; new test for auto (saved, survives reload, setPace("auto") before start).

## Parity (Java vs Python)
`tools/asr/speedbench/auto_parity.py` logs each decision of the speed_post loop on 220 clips (15 per set of manifest.json + 40 real_mujawwad_ea) and checks its loop gives the same pieces as `B.speed_post` (0 mismatches). `tools/asr/speedbench/AutoParity.java` re-decides them with NvAsr.isSlow / canJoin.
Result: isSlow 300 agree / 0 disagree (156 slow); canJoin 62 agree / 0 disagree (56 joins). Not covered off-device: the recorder wiring (timing of the probe, the 30 s/12 s cap cases differ from the bench by design: real time cannot see the next piece's end).

Commands (JDK 17, android.jar = %LOCALAPPDATA%\Android\Sdk\platforms\android-37.0):
```
py: ml-env python -X utf8 -I tools/asr/speedbench/auto_parity.py --out parity.tsv
javac -encoding UTF-8 -cp "android.jar;android/libs/onnxruntime-1.22.0.jar" -sourcepath android/src -d cls android/src/com/quran/karim/NvAsr.java   (only Donations.java errors: generated DonateKey missing, not ours)
javac -cp "android.jar;onnxruntime;cls" -d cls tools/asr/speedbench/AutoParity.java ; java -cp "...;cls" com.quran.karim.AutoParity parity.tsv
```

## Bench rerun (same config, `qtrain/speedbench/run_cfg.sh A1w1_re[2]` + `qtrain/eval/out/gate_mode.sh slowA_w1_re --slowq 2.0 --mcap 30 --slow_wps 1.0`)
Speed bench WERskel/tracking identical to runs.md: real_murattal 7.9/97.0, real_hadr 11.0/96.6, real_mujawwad 8.8/98.0, real_mujawwad_ea 11.2/98.7, syn 0.5x 9.2/95.4, 1x 5.2/98.9, 1.5x 7.7/97.3, 2x 14.5/88.1 (all 12 sets equal).
Gate ctc_up: the gate rerun reproduced bench.py exactly: summary-s.json identical to mode_slowA_w1 (all sets, 1907 clips) and 0 of 1907 rows with different piece texts, so ctc_up ALL 97.6 follows (runs.md). The ctc_up step itself could not be re-run: p1b_port_eval -> tools/asr/eval/rlocal_spans.js fails with "rSim is not defined" because the swap agent moved the matcher (rSim/R_PAIRS) in web/app.js (parity.js was updated, rlocal_spans.js not). Not caused by this change.

## Tests
node tools/qa/recite_sim.js: runs, errs [] (no failures). `ED=kfgqpc ONLY=5.36 node tools/qa/ui.js`: 8 PASS / 0 FAIL.

## Open
- Phone test (mujawwad reciter + normal reading) before making auto the default; a 30 s decode of a held piece on the phone ~1.2 s.
- Decode for a probe that is slow to answer (>1.5 s) lets a resumed piece join even if its quiet exceeded 2 s (rare).
