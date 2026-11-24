# Proposed change (NOT applied): reading pace modes, slow rule = A1 slow-merge

Evidence: plans/asr-speed-bench/runs.md (bench.py `speed_post`, tools/asr/eval/bench.py; options `--slowq 2.0 --mcap 30 --slow_wps 1.0` (0.8 also passes: ALL 97.5)).
Rule sets (one model file, G10b unchanged):

| q.asrPace | rule | gate (ctc_up ALL) | note |
|---|---|---|---|
| `normal` (default) | today's 5.22 pipeline, bit-identical (bench `mode_normal` = 97.3, same as gate_G10b_ship) | 97.3 | |
| `slow` | every piece is held: joined with the next piece if it starts within 2.0 s of quiet, up to 30 s | 97.8 | everyone waits up to +1.5 s for a final |
| `auto` (recommended default after a phone test) | same, but only when the piece's own decode is < 1.0 words/s | 97.6, every gate >= G10b | murattal 1% / hadr 0% / mujawwad 44% of clips touched |
| `fast` | NOT recommended: tempo normalisation (A2) helps synthetic 2x (tracking 88.1 -> 94.9) but hurts real hadr (96.6 -> 92.2) and the gate (ALL 96.7-96.9) | — | keep the setting value but map it to `normal` |

## NvAsr.java

1. Constants / state
```java
private static final double SLOW_Q = 2.0;      // s of quiet that end a held slow piece
private static final double SLOW_WPS = 1.0;    // a piece decoded slower than this (words / (s - 0.8)) is held
private static final int MCAP = SR * 30;        // longest joined piece (model pos table: 80 s)
private volatile int pace = 0;                  // 0 normal, 1 slow, 2 auto  (fast -> 0)
@JavascriptInterface public void setPace(String p) { pace = "slow".equals(p) ? 1 : "auto".equals(p) ? 2 : 0; }
```
2. `listen()`: `seg = new float[pace == 0 ? SR * 12 : MCAP]` (normal keeps the 12 s cap exactly), `be = new float[seg.length / BLK + 1]`.
   Keep a `int held = 0` (samples of seg already judged slow) and `boolean probing`.
3. End rule (line 382 today):
```java
boolean capHit = len >= (pace == 0 ? SR * 12 : (held > 0 ? MCAP : SR * 12));
boolean end = len > 0 && (quiet > (held > 0 ? SLOW_Q : QUIET_END) || capHit);
```
   - `pace == 0`: unchanged path (emit final, reset).
   - `pace == 1`: at `quiet > QUIET_END` with `held == 0` and no cap: do not reset; set `held = len` and keep recording
     (the piece is now held, it ends at SLOW_Q quiet or at MCAP); at that end emit the whole seg[0..len] as one final.
   - `pace == 2`: at `quiet > QUIET_END` post a probe to `work`: decode seg[0..len] (the same decode the final needs anyway).
     If words/(len/SR - 0.8) >= SLOW_WPS (or the text is empty) the probe emits it as the final (no extra cost) and the
     recorder drops seg[0..probeLen) keeping any newer samples; else the probe sets `held = probeLen` and the recorder keeps
     appending; a held piece is re-probed at the next QUIET_END quiet after new speech (the bench re-checks the joined
     piece: `speed_post` loop) and emitted at SLOW_Q quiet or MCAP. The recorder never blocks on the probe (it keeps
     reading blocks; `probing` stops a second probe).
   - partials/freeze keep working on the held seg (freezeAt uses `be`, sized for MCAP).
4. `emit(..., "final")` unchanged (CTC group, finals map). Decode cost: a 30 s piece ~1.2 s int8 on the phone; only
   slow readers reach it (mujawwad: ~44% of clips at 1.0 w/s).
5. Stop flush (line 397) unchanged: a held piece is flushed as one final.

## web/app.js
- Setting `q.asrPace` = `normal|slow|auto|fast` (default `normal`; `auto` after the phone test passes), UI in the
  recitation settings: «عادي» / «مجوّد / بطيء» / «تلقائي» (and «حدر / سريع» hidden until a fast rule wins).
- Before each `NvAsr.start()`: `window.NvAsr && NvAsr.setPace && NvAsr.setPace(localStorage['q.asrPace'] || 'normal')`.
- The 3 s flush judge window in recite/htv/mtv should allow SLOW_Q (2 s) + decode for held pieces.

## Verification before shipping
- Java/Python parity of the probe/hold rule on the gate clips (like ctc_java_parity.py), then phone test with a
  mujawwad reciter and with the user's normal reading (no extra wait in `normal`/`auto` on murattal).
