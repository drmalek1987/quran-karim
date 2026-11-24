# ASR speed bench driver: the app's 5.35 pipeline (NvAsr VAD -> int8 ONNX -> greedy CTC -> rAlign matcher) on a manifest,
# reusing tools/asr/eval/bench.py (vad_pieces, feats, Model, Quran, recite_dp). Adds per-piece latency, WER/CER, tracking,
# VAD diagnostics (dropped speech, mid-word splits, cap cuts, merges). Rows are bench-compatible (p1b_port_eval reads them).
# Usage: python -X utf8 -I bench_speed.py --model m.int8.onnx --vocab model.json --manifest manifest.json --out dir [--threads 4]
import sys, os, json, time, argparse, random
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'eval'))
import bench as B
SR = B.SR
# NvAsr.java (5.35): PRE 0.3 s, QUIET_END 0.5, VMIN 0.0015, floor*3, RISE_SPEECH 0.0005, CATCH_BLOCKS 50, 12 s hard cut, louder -30 dBFS
STATS = {}
VAD = dict(preroll=3, quiet_end=0.5, vmin=0.0015, kstart=3.0, frise_sp=0.0005, fcatch=5.0, cap_s=12.0)

def walign(R, H):
    """word alignment ref R vs hyp H (lists of skeleton words): counts of ok/sub/del/ins + merge (2 ref -> 1 hyp) + split."""
    n, m = len(R), len(H); INF = 1e9
    D = [[INF] * (m + 1) for _ in range(n + 1)]; P = [[None] * (m + 1) for _ in range(n + 1)]; D[0][0] = 0
    for i in range(n + 1):
        for j in range(m + 1):
            d = D[i][j]
            if d >= INF: continue
            def go(i2, j2, c, op):
                if i2 <= n and j2 <= m and d + c < D[i2][j2]: D[i2][j2] = d + c; P[i2][j2] = (i, j, op)
            go(i + 1, j, 1, 'del'); go(i, j + 1, 1, 'ins')
            if i < n and j < m: go(i + 1, j + 1, 0 if B.rsame(R[i], H[j]) else 1, 'ok' if B.rsame(R[i], H[j]) else 'sub')
            if i + 1 < n and j < m and B.rsame(R[i] + R[i + 1], H[j]) and not B.rsame(R[i], H[j]): go(i + 2, j + 1, 0.6, 'merge')
            if i < n and j + 1 < m and B.rsame(R[i], H[j] + H[j + 1]) and not B.rsame(R[i], H[j]): go(i + 1, j + 2, 0.6, 'split')
    c = dict(ok=0, sub=0, **{'del': 0}, ins=0, merge=0, split=0); i, j = n, m
    while (i, j) != (0, 0):
        pi, pj, op = P[i][j]; c[op] += 1; i, j = pi, pj
    return c

def speech_blocks(y):
    blk = SR // 10; n = len(y) // blk
    e = np.array([np.sqrt((y[i * blk:(i + 1) * blk] ** 2).mean()) for i in range(n)]) if n else np.zeros(0)
    if n < 3: return np.zeros(n, bool)
    return e > max(1e-3, 0.08 * np.percentile(e, 90))

def run_clip(c, Qr, M, rnd):
    if 's' in c: i = Qr.idx[(int(c['s']), int(c['a']))]; span = (Qr.start[i], Qr.start[i] + len(Qr.ay[i]['k']))
    else: span = Qr.locate(c['text'])
    if not span: return {'id': c['id'], 'set': c['set'], 'skip': 'not located'}
    p0, p1 = span; exp = Qr.fk[p0:p1]; ayat = Qr.span_ayat(p0, p1)
    full = len(ayat) == 1 and p0 == Qr.start[ayat[0]] and p1 - p0 == len(Qr.ay[ayat[0]]['k'])
    ref = Qr.simple[(Qr.ay[ayat[0]]['s'], Qr.ay[ayat[0]]['a'])] if full else B.norm(c.get('text', ''))
    y, sr = sf.read(c['wav'], dtype='float32'); assert sr == SR, c['wav']
    if y.ndim > 1: y = y.mean(1)
    r = float(np.sqrt((y * y).mean())) or 1e-9; y = np.clip(y * (10 ** (-31 / 20) / r), -1, 1).astype(np.float32)   # bench default --gain -31
    rp, ends = B.vad_pieces(y, VAD['preroll'], VAD['quiet_end'], VAD['vmin'], None, VAD['kstart'], None, VAD['frise_sp'], 0.3, 0.0, VAD.get('capcut', False),
                            raw=True, cap_s=VAD['cap_s'], fcatch=VAD['fcatch'])
    lps, texts, ms, plen = [], [], [], []
    if VAD.get('slowq') or VAD.get('tcps'):
        st = {}; t0 = time.perf_counter()
        lps, ns, ex = B.speed_post(y, rp, ends, M, -30, VAD['mcap'], VAD['slowq'], VAD['quiet_end'], VAD['slow_wps'], VAD['tcps'], VAD['ttarget'], VAD['tmax'], st)
        tot = (time.perf_counter() - t0) * 1000; texts = [M.greedy(l) for l in lps]; plen = [n / SR for n in ns]
        ms = [tot / max(1, len(lps))] * len(lps); STATS[c['id']] = st
        rp = []
    for p in rp:
        pl = B.louder(p, -30); t0 = time.perf_counter(); l = M.logprobs(pl); ms.append((time.perf_counter() - t0) * 1000)
        lps.append(l); texts.append(M.greedy(l)); plen.append(len(p) / SR)
    # VAD diagnostics
    sb = speech_blocks(y); cov = np.zeros(len(sb), bool)
    for e, p in zip(ends, rp):
        a, b = max(0, (e - len(p)) // (SR // 10)), min(len(sb), e // (SR // 10)); cov[a:b] = True
    dropped = float((sb & ~cov).sum()) * 0.1; speech_s = float(sb.sum()) * 0.1
    pieces = [t for t in texts if t]; nempty = sum(1 for t in texts if not t)
    hyp = ' '.join(pieces)
    # whole clip with no VAD (<= 75 s: the Z1 model's positional table holds 1000 frames)
    hyp_nv, ms_nv = None, None
    if len(y) <= 75 * SR:
        t0 = time.perf_counter(); lnv = M.logprobs(B.louder(y, -30)); ms_nv = (time.perf_counter() - t0) * 1000; hyp_nv = M.greedy(lnv)
    # text metrics
    rw = B.norm(ref).split(); hw = B.norm(hyp).split(); rs = [B.skel(w) for w in exp]; hs = [B.skel(w) for w in B.norm(hyp).split() if B.skel(w)]
    wer = B.lev(rw, hw) / max(1, len(rw)) if full else None
    wer_sk = B.lev(rs, hs) / max(1, len(rs)); cer = B.lev(B.norm(hyp), B.norm(ref)) / max(1, len(B.norm(ref))) if full else None
    cer_sk = B.lev(''.join(rs), ''.join(hs)) / max(1, len(''.join(rs)))
    wer_nv = None
    if hyp_nv is not None:
        hsn = [B.skel(w) for w in B.norm(hyp_nv).split() if B.skel(w)]; wer_nv = B.lev(rs, hsn) / max(1, len(rs))
    al = walign(rs, hs)
    # app matcher (rAlign = recite_dp), whole clip + incremental over the pieces
    pos = B.recite_dp(pieces, exp)
    n = len(exp); right = sum(v == 1 for v in pos); unreached = sum(v is None for v in pos)
    derail = 0; run = 0
    for v in pos:
        run = run + 1 if v == 0 else 0
        if run == 3: derail += 1                         # a run of >= 3 wrong words = the tracker left the reciter
    last = max([k for k, v in enumerate(pos) if v is not None], default=-1)
    stall = 1 if (n - 1 - last) >= 3 else 0              # >= 3 words at the end never reached (fell behind and stayed)
    lostp = 0; reach = []
    for k in range(len(pieces)):
        vk = B.recite_dp(pieces[:k + 1], exp); reach.append(max([q for q, v in enumerate(vk) if v is not None], default=-1) + 1)
        hk = len([w for w in B.norm(pieces[k]).split() if w])
        gain = reach[-1] - (reach[-2] if len(reach) > 1 else 0)
        if hk >= 3 and gain < 0.5 * hk: lostp += 1       # a piece of >= 3 heard words moved the tracker by < half of them
    # boundaries that cut a word (concatenation of the two sides is an expected word, neither side alone is)
    midcut = 0
    for a, b in zip(pieces, pieces[1:]):
        wa, wb = [B.skel(w) for w in B.norm(a).split()], [B.skel(w) for w in B.norm(b).split()]
        if wa and wb and any(B.rsame(wa[-1] + wb[0], e) and not B.rsame(wa[-1], e) and not B.rsame(wb[0], e) for e in rs): midcut += 1
    ncap = sum(1 for p in plen if p >= VAD['cap_s'] - 0.15)
    # negatives for the p1b_port_eval / wrong-word catch
    j = rnd.randrange(len(exp)); cand = None
    for _ in range(200):
        w = Qr.fk[rnd.randrange(len(Qr.fk))]
        if abs(len(w) - len(exp[j])) <= 1 and len(w) >= 2 and not B.rsame(w, exp[j]): cand = w; break
    neg = B.recite_dp(pieces, exp[:j] + [cand] + exp[j + 1:]); guess = Qr.identify(hyp)
    row = {'id': c['id'], 'set': c['set'], 'src': c.get('src'), 'speed': c.get('speed'), 'wps': c.get('wps'), 'ref': ref, 'hyp': hyp, 'hyp_novad': hyp_nv, 'pieces': len(pieces),
           'exp': ' '.join(Qr.ay[Qr.flat[p][0]]['w'][Qr.flat[p][1]] for p in range(p0, p1)), 'pos': pos, 'neg': neg, 'piece_texts': pieces,
           'plen': plen, 'ms': [round(x, 1) for x in ms], 'ms_novad': ms_nv, 'asec': len(y) / SR, 'speech_s': speech_s, 'dropped_speech_s': round(dropped, 2),
           'n_pieces_vad': len(rp), 'n_empty': nempty, 'ncap': ncap, 'midcut': midcut, 'neg_j': j, 'neg_w': cand, 'nwords': n, 'right': right, 'unreached': unreached,
           'derail': derail, 'stall': stall, 'lostp': lostp, 'wer': wer, 'wer_sk': wer_sk, 'wer_sk_novad': wer_nv, 'cer': cer, 'cer_sk': cer_sk, 'align': al,
           'full': full, 'ayat': [[Qr.ay[i]['s'], Qr.ay[i]['a']] for i in ayat], 'guess': [Qr.ay[guess]['s'], Qr.ay[guess]['a']] if guess is not None else None,
           'id_ok': guess is not None and (guess in ayat or Qr.ask[guess] in {Qr.ask[i] for i in ayat})}
    return row, lps, texts

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True); ap.add_argument('--vocab', required=True); ap.add_argument('--manifest', required=True)
    ap.add_argument('--out', required=True); ap.add_argument('--threads', type=int, default=4); ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--groups', default=''); ap.add_argument('--quiet', type=float, default=0.5, help='experiment: seconds of quiet that end a piece (5.35: 0.5)'); ap.add_argument('--capcut', action='store_true', help='experiment: at the 12 s cap cut at the quietest block of the last 2 s')
    ap.add_argument('--slowq', type=float, default=0.0); ap.add_argument('--slow_wps', type=float, default=0.8); ap.add_argument('--mcap', type=float, default=12.0)
    ap.add_argument('--tcps', type=float, default=0.0); ap.add_argument('--ttarget', type=float, default=5.0); ap.add_argument('--tmax', type=float, default=2.0)
    a = ap.parse_args()
    VAD.update(mcap=a.mcap, slowq=a.slowq, slow_wps=a.slow_wps, tcps=a.tcps, ttarget=a.ttarget, tmax=a.tmax)
    QT = r'D:\Quran App\qtrain'; QK = r'D:\Quran App\quran-karim'
    Qr = B.Quran(os.path.join(QT, 'eval', 'quran_words.json'), os.path.join(QK, 'data', 'quran-simple-search.json'))
    VAD['capcut'] = a.capcut; VAD['quiet_end'] = a.quiet
    M = B.Model(a.model, a.vocab, a.threads); rnd = random.Random(1)
    man = json.load(open(a.manifest, encoding='utf8'))
    if a.groups: g = set(a.groups.split(',')); man = [c for c in man if c['set'] in g]
    if a.limit: man = man[:a.limit]
    os.makedirs(a.out, exist_ok=True); lpd = os.path.join(a.out, 'lp'); os.makedirs(lpd, exist_ok=True)
    M.logprobs(np.random.RandomState(0).randn(SR * 3).astype(np.float32) * 0.05)       # warm-up
    rows, t0 = [], time.time()
    for k, c in enumerate(man):
        res = run_clip(c, Qr, M, rnd)
        if isinstance(res, dict): rows.append(res); continue
        row, lps, texts = res; rows.append(row)
        np.savez_compressed(os.path.join(lpd, c['id'].replace('/', '_') + '.npz'), *[l.astype(np.float16) for l, t in zip(lps, texts) if t])
        if k % 25 == 0: print('%d/%d %.0f s' % (k, len(man), time.time() - t0), flush=True)
    json.dump(rows, open(os.path.join(a.out, 'rows.json'), 'w', encoding='utf8'), ensure_ascii=False)
    json.dump(STATS, open(os.path.join(a.out, 'stats.json'), 'w'))
    print('done', len(rows), '%.0f s' % (time.time() - t0))

if __name__ == '__main__': main()
