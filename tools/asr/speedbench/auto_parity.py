# Sprint 5b A: dump the auto-pace decisions (A1 slow-merge, slow_wps 1.0, slowq 2.0, mcap 30) of bench.speed_post per piece,
# for tools/asr/speedbench/AutoParity.java to re-decide with NvAsr.isSlow / NvAsr.canJoin.
# Usage: python -X utf8 -I auto_parity.py --out parity.tsv [--per_set 15] [--real2 40]
# Lines:  S <piece samples> <py slow 0/1> <text>     J <gap samples> <joined samples> <py join 0/1>
# Also re-runs bench.speed_post on the same clips and checks that this loop yields the same pieces (sanity).
import sys, os, json, argparse
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bench_speed as S
B = S.B; SR = B.SR
QT = r'D:\Quran App\qtrain'; QK = r'D:\Quran App\quran-karim'
MCAP, SLOWQ, QUIET, WPS = 30.0, 2.0, 0.5, 1.0

def logged(y, rp, ends, M, out):
    y = np.concatenate([y, np.zeros(2 * SR, np.float32)]).astype(np.float32)
    starts = [e - len(p) for p, e in zip(rp, ends)]; k = 0; lens = []
    while k < len(rp):
        a, b = starts[k], ends[k]; p = rp[k]; l = M.logprobs(B.louder(p, -30)); t = M.greedy(l)
        while True:
            slow = bool(t) and B._wps(t, len(p) / SR) < WPS
            out.append('S\t%d\t%d\t%s' % (len(p), int(slow), t.replace('\t', ' ').replace('\n', ' ')))
            if not (slowq_on and slow and k + 1 < len(rp)): break
            gap = starts[k + 1] - b; joined = ends[k + 1] - a
            join = gap <= (SLOWQ - QUIET) * SR and joined <= MCAP * SR
            out.append('J\t%d\t%d\t%d' % (gap, joined, int(join)))
            if not join: break
            k += 1; b = ends[k]; p = y[max(0, a):b] if a >= 0 else np.concatenate([np.zeros(-a, np.float32), y[:b]])
            l = M.logprobs(B.louder(p, -30)); t = M.greedy(l)
        lens.append(len(p)); k += 1
    return lens
slowq_on = True

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--out', required=True); ap.add_argument('--per_set', type=int, default=15); ap.add_argument('--real2', type=int, default=40)
    ap.add_argument('--model', default=QT + r'\gpu-train\z1\G10b.int8.onnx'); ap.add_argument('--vocab', default=QT + r'\gpu-train\phone_G10b\model.json')
    a = ap.parse_args()
    S.VAD.update(mcap=MCAP, slowq=SLOWQ, slow_wps=WPS, tcps=0.0, quiet_end=QUIET, capcut=False)
    M = B.Model(a.model, a.vocab, 4)
    man = json.load(open(QT + r'\speedbench\manifest.json', encoding='utf8')); seen = {}; sel = []
    for c in man:
        seen[c['set']] = seen.get(c['set'], 0) + 1
        if seen[c['set']] <= a.per_set: sel.append(c)
    sel += json.load(open(QT + r'\speedbench\manifest_real2.json', encoding='utf8'))[:a.real2]
    out, bad = [], 0
    for c in sel:
        y, sr = sf.read(c['wav'], dtype='float32')
        if y.ndim > 1: y = y.mean(1)
        r = float(np.sqrt((y * y).mean())) or 1e-9; y = np.clip(y * (10 ** (-31 / 20) / r), -1, 1).astype(np.float32)
        V = S.VAD
        rp, ends = B.vad_pieces(y, V['preroll'], V['quiet_end'], V['vmin'], None, V['kstart'], None, V['frise_sp'], 0.3, 0.0, False, raw=True, cap_s=V['cap_s'], fcatch=V['fcatch'])
        lens = logged(y, rp, ends, M, out)
        _, ns, _ = B.speed_post(y, rp, ends, M, -30, MCAP, SLOWQ, QUIET, WPS, 0.0, 5.0, 2.0, {})
        if list(ns) != lens: bad += 1
    open(a.out, 'w', encoding='utf8').write('\n'.join(out) + '\n')
    print('clips', len(sel), 'lines', len(out), 'loop-vs-speed_post mismatches', bad)
main()
