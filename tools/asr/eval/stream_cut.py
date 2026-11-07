# 5.11 G7 (items 20/21): continuous recitation — does cutting long pieces early keep the word verdicts and cut the decode work?
# NvAsr decodes the WHOLE piece so far on every partial, and a piece ends only after 1.0 s of quiet or at 12 s, so a reader
# who does not pause makes every decode longer (the text lags more and more). Variant "cut": a piece longer than CUT_AT s
# is cut at the quietest 100 ms block of its last 2 s (a breath between words) and the rest starts the next piece.
# Streams: consecutive held-out ayat of one reciter joined with only GAP s of silence (continuous reading).
# Reports per variant: word verdicts on the true text (recite_dp, the app's matcher), wrong-word detection (one word per
# ayah swapped), piece lengths, and the mean audio length a partial decode has to process (latency ~ that length).
# Usage: python -I stream_cut.py --model <int8.onnx> --vocab <model.json> --quran <quran_words.json>
#                               --simple <quran-simple-search.json> --sets <ho_*.json>... [--out res.json]
import sys, os, json, time, random, argparse, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, soundfile as sf
from bench import Quran, Model, recite_dp, rsame, SR

QUIET_END, VMIN, PGAIN, PRE = 1.0, 0.0015, -30.0, 3          # NvAsr.java 5.11: 1.0 s quiet, VMIN, louder() to -30 dBFS, 0.3 s pre
GAP = 0.12

def pieces(y, cut_at=None, look=2.0, dip=0.6):
    """NvAsr.listen() (100 ms blocks, 0.3 s pre-roll, end after QUIET_END quiet or 12 s, kept if > 0.3 s voiced), plus the
    optional soft cut: once a piece is longer than cut_at s, it is cut at the quietest block of its last `look` s when that
    block is below `dip` x the piece's median block level; the rest stays as the start of the next piece."""
    q = np.round(np.clip(y, -1, 1 - 1 / 32768) * 32768).astype(np.int16) / 32768.0
    q = np.concatenate([q, np.zeros(2 * SR)]); blk = SR // 10
    out, seg, en, floor, quiet, voiced = [], [], [], 0.004, 0.0, 0.0
    cap = 120                                                                       # blocks = 12 s
    def emit(blocks):
        pc = np.concatenate(blocks).astype(np.float32)
        r = float(np.sqrt((pc * pc).mean())) or 1e-9; g = 10 ** (PGAIN / 20) / r
        if g > 1: pc = np.clip(pc * min(g, 30.0), -1, 1).astype(np.float32)
        out.append(pc)
    for b0 in range(0, len(q) - blk + 1, blk):
        b = q[b0:b0 + blk]; e = float(np.sqrt((b * b).mean()))
        floor = e if e < floor else floor * 0.995 + e * 0.005
        speech = e > max(VMIN, floor * 3)
        if speech and not seg:
            for k in range(PRE, 0, -1):
                if b0 - k * blk >= 0: pb = q[b0 - k * blk:b0 - (k - 1) * blk]; seg.append(pb); en.append(float(np.sqrt((pb * pb).mean())))
        if speech or seg: seg.append(b); en.append(e)
        if speech: voiced += 0.1; quiet = 0
        elif seg: quiet += 0.1
        if seg and (quiet > QUIET_END or len(seg) >= cap):
            if voiced > 0.3: emit(seg)
            seg, en, quiet, voiced = [], [], 0.0, 0.0
        elif cut_at and len(seg) > cut_at * 10:
            w0 = max(1, len(seg) - int(look * 10)); w1 = len(seg) - 2                # not the newest 0.2 s
            if w1 > w0:
                i = w0 + int(np.argmin(en[w0:w1])); med = float(np.median(en))
                if en[i] < dip * med:
                    emit(seg[:i + 1]); seg, en = seg[i + 1:], en[i + 1:]
                    voiced = 0.1 * sum(1 for x in en if x > max(VMIN, floor * 3)); quiet = 0.0
    return out

def partial_lengths(ps):
    """A partial is decoded about every 1 s of a piece, on the whole piece so far: the audio length of each decode."""
    L = []
    for p in ps:
        T = len(p) / SR
        L += [float(t) for t in range(1, int(T) + 1)]
    return L

def freeze_partial(M, p, W=6.0, look=2.0, dip=0.6):
    """Variant "f": the FINAL piece stays as today; only partials are bounded. Once the audio after the frozen point is
    longer than W s, the part up to the quietest block of the last `look` s (below `dip` x median) is decoded once and its
    text frozen; later partials decode only the audio after it and add the frozen text in front. Returns the text the last
    partial would show and the audio length of every partial decode."""
    blk = SR // 10; n = len(p) // blk; en = [float(np.sqrt((p[k * blk:(k + 1) * blk] ** 2).mean())) for k in range(n)]
    F, frozen, lens = 0, [], []
    for t in range(10, n + 1, 10):
        if t - F > W * 10:
            w0 = max(F + 1, t - int(look * 10)); w1 = t - 2
            if w1 > w0:
                i = w0 + int(np.argmin(en[w0:w1])); med = float(np.median(en[F:t]))
                if en[i] < dip * med:
                    frozen.append(M.greedy(M.logprobs(p[F * blk:(i + 1) * blk]))); lens.append((i + 1 - F) / 10); F = i + 1; continue
        lens.append((t - F) / 10)
    last = ' '.join([x for x in frozen + [M.greedy(M.logprobs(p[F * blk:]))] if x])
    return last, lens

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True); ap.add_argument('--vocab', required=True); ap.add_argument('--quran', required=True)
    ap.add_argument('--simple', required=True); ap.add_argument('--sets', nargs='+', required=True); ap.add_argument('--out', default='')
    ap.add_argument('--cuts', default='0,6,5'); ap.add_argument('--min_stream', type=float, default=25.0)
    a = ap.parse_args()
    Qr = Quran(a.quran, a.simple); M = Model(a.model, a.vocab); rnd = random.Random(3)
    clips = []
    for m in a.sets: clips += json.load(open(m, encoding='utf8'))
    by = collections.defaultdict(list)
    for c in clips:
        if 's' in c: by[c['reciter']].append(c)
    # clips of one reciter chained into streams of >= min_stream s: continuous reading, the true text of each part known
    joined = []
    for rec, cs in by.items():
        cs.sort(key=lambda c: (c['s'], c['a'])); cur, dur = [], 0.0
        for c in cs:
            info = sf.info(c['wav']); cur.append(c); dur += info.duration
            if dur >= a.min_stream: joined.append(cur); cur, dur = [], 0.0
    streams = joined
    print('streams', len(streams), 'clips', sum(len(s) for s in streams), flush=True)
    cuts = [float(x) for x in a.cuts.split(',') if not x.startswith('f')]
    fw = [float(x[1:]) for x in a.cuts.split(',') if x.startswith('f')]
    res = {str(c): {'right': 0, 'words': 0, 'neg_ok': 0, 'neg': 0, 'pieces': [], 'partials': [], 'dec_s': 0.0, 'audio_s': 0.0} for c in cuts}
    for si, st in enumerate(streams):
        ys, exp = [], []
        for c in st:
            y, sr = sf.read(c['wav'], dtype='float32')
            if y.ndim > 1: y = y.mean(1)
            assert sr == SR
            r = float(np.sqrt((y * y).mean())) or 1e-9; y = np.clip(y * (10 ** (-31 / 20) / r), -1, 1).astype(np.float32)
            ys += [y, np.zeros(int(GAP * SR), np.float32)]
            i = Qr.idx[(c['s'], c['a'])]; exp += Qr.ay[i]['k']
        y = np.concatenate(ys)
        # negatives: one expected word in ~every 12 swapped for another Quran word of about the same length
        neg_exp, swaps = list(exp), []
        for j in range(5, len(exp), 12):
            for _ in range(200):
                w = Qr.fk[rnd.randrange(len(Qr.fk))]
                if abs(len(w) - len(exp[j])) <= 1 and len(w) >= 2 and not rsame(w, exp[j]): neg_exp[j] = w; swaps.append(j); break
        for cut in cuts:
            ps = pieces(y, cut or None)
            t0 = time.time(); texts = [M.greedy(M.logprobs(p)) for p in ps]; dt = time.time() - t0
            texts = [t for t in texts if t]
            v = recite_dp(texts, exp, ins=1.0); vn = recite_dp(texts, neg_exp, ins=1.0)
            R = res[str(cut)]
            R['right'] += sum(1 for x in v if x == 1); R['words'] += len(exp)
            R['neg_ok'] += sum(1 for j in swaps if vn[j] == 0); R['neg'] += len(swaps)
            R['pieces'] += [len(p) / SR for p in ps]; R['partials'] += partial_lengths(ps)
            R['dec_s'] += dt; R['audio_s'] += len(y) / SR
        for W in fw:
            ps = pieces(y, None); texts, lens = [], []
            for pc in ps:
                tx, ln = freeze_partial(M, pc, W); lens += ln
                if tx: texts.append(tx)
            R = res.setdefault('f' + str(W), {'right': 0, 'words': 0, 'neg_ok': 0, 'neg': 0, 'pieces': [], 'partials': [], 'dec_s': 0.0, 'audio_s': 1e-9})
            v = recite_dp(texts, exp, ins=1.0); vn = recite_dp(texts, neg_exp, ins=1.0)
            R['right'] += sum(1 for x in v if x == 1); R['words'] += len(exp)
            R['neg_ok'] += sum(1 for j in swaps if vn[j] == 0); R['neg'] += len(swaps)
            R['pieces'] += [len(p) / SR for p in ps]; R['partials'] += lens
        print(si, ' '.join('%s:%.3f' % (k, res[k]['right'] / max(1, res[k]['words'])) for k in res), flush=True)
    rep = {}   # for 'f' variants word_right/wrong_flagged are those of the LAST PARTIAL text (the finals are today's)
    for k, R in res.items():
        P = np.array(R['pieces']); L = np.array(R['partials'])
        rep[k] = {'word_right': round(R['right'] / max(1, R['words']), 4), 'wrong_flagged': round(R['neg_ok'] / max(1, R['neg']), 4),
                  'pieces': len(P), 'piece_mean_s': round(float(P.mean()), 2), 'piece_max_s': round(float(P.max()), 2),
                  'partial_mean_s': round(float(L.mean()), 2) if len(L) else 0, 'partial_p90_s': round(float(np.percentile(L, 90)), 2) if len(L) else 0,
                  'final_decode_rtf': round(R['dec_s'] / R['audio_s'], 4), 'words': R['words'], 'neg': R['neg']}
    print(json.dumps(rep, indent=1))
    if a.out: json.dump({'streams': len(streams), 'gap_s': GAP, 'res': rep}, open(a.out, 'w'), indent=1)

if __name__ == '__main__': main()
