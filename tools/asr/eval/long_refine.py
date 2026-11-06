# P3 CP1 rest: turns long_pseudo/long_noise/long_wordcheck pieces into train/test clips (plans/P3-train-protocol.md).
#  A7  trim each clip to its forced-aligned word edges; a first/last word touching the piece edge (maybe cut by the VAD) is dropped
#  G5  clips > 15 s are split at the widest gap between words (each part >= 3 s)
#  A2/G7 per-clip clipping (|x| >= 0.99) < 0.5% and 1-15 s, else drop
#  G6  reverb: EDT-style decay after word ends (time to fall 20 dB, x3 = T60 estimate); logged only (estimator unproven)
#  C   levels by base CER: L1 <= 5%, L2 5-20%, L3 20-60% (+ overlap, gap labels)
#  A8  overlap: share of the clip outside word spans whose energy is within 6 dB of the speech median; > 30% -> L3
#  C1  gap labels: a 'review' piece between two 'train' neighbours gets the Quran text between them, accepted only if every
#      word aligns >= -1.0 per frame and its sec/letter is inside that reader's 5-95% range; always L3
#  B7  base CER on the final clip: < 3% known, 3-60% learnable, > 60% drop
# Output: <od>/refined/<file>.json (clips) + <od>/wav2/*.wav + refine.json summary.
# Usage: python -I long_refine.py <long out dir> <model.onnx> <model.json> <quran-simple-search.json> <readers-sheet.csv>
import sys, os, json, csv, collections
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bench, ctc
SR, FR = bench.SR, 0.08                      # model frame = 80 ms
WTH, GAP_WTH, CAP, MINP, RT_HARD = -1.5, -1.0, 15.0, 3.0, 1.8
od = sys.argv[1]; M = bench.Model(sys.argv[2], sys.argv[3]); lex = ctc.Lex(M.vocab)
simp = json.load(open(sys.argv[4], encoding='utf8'))['quran']
keys = [(v['chapter'], v['verse']) for v in simp]; kidx = {k: i for i, k in enumerate(keys)}
flat = [(i, j) for i, v in enumerate(simp) for j in range(len(v['text'].split()))]; fidx = {p: n for n, p in enumerate(flat)}
WORDS = [v['text'].split() for v in simp]
sheet = {os.path.splitext(r[0])[0].strip().replace(' ', ''): r[2].strip().lower()
         for r in list(csv.reader(open(sys.argv[5], encoding='utf-8-sig')))[1:]}
os.makedirs(os.path.join(od, 'refined'), exist_ok=True); os.makedirs(os.path.join(od, 'wav2'), exist_ok=True)

def boost(y):
    r = float(np.sqrt((y * y).mean())) or 1e-9; g = 10 ** (-30 / 20) / r
    return np.clip(y * min(g, 30.0), -1, 1).astype(np.float32) if g > 1 else y

def align(y, words):
    lp = M.logprobs(boost(y)); G, stay, mx = lex.group(lp)
    return lp, ctc.forced_words(G, stay, mx, lex, [lex.text(w) for w in words], spans=True)

def rt60(y, ends):
    """median EDT*3 over word ends followed by >= 0.25 s of lower energy."""
    blk = SR // 100; n = len(y) // blk
    if n < 30: return None
    e = 10 * np.log10((y[:n * blk].reshape(n, blk) ** 2).mean(1) + 1e-10); floor = np.percentile(e, 10); out = []
    for t in ends:
        a = int(t * 100); s = max(0, a - 10)
        if a + 25 >= n: continue
        pk = s + int(np.argmax(e[s:a + 3])); top = e[pk]
        if top - floor < 15: continue
        drop = min(20.0, top - floor - 3); tail = e[pk:pk + 150]
        k = np.argmax(tail <= top - drop) if (tail <= top - drop).any() else None
        if k: out.append(k / 100 * 60 / drop)
    return round(float(np.median(out)), 2) if out else None

def overlap(y, spans):
    blk = SR // 100; n = len(y) // blk
    e = 10 * np.log10((y[:n * blk].reshape(n, blk) ** 2).mean(1) + 1e-10); inw = np.zeros(n, bool)
    for a, b in spans: inw[int(a * 100):int(b * 100)] = True
    if inw.sum() < 10 or (~inw).sum() == 0: return 0.0
    ref = np.median(e[inw]); return round(float(((~inw) & (e > ref - 6)).sum() / n), 3)

def cut(fw, words, T):
    """word spans (s) after dropping edge-touching / failed edge words; returns list of parts [(w0, w1)] (inclusive)."""
    ok = [f is not None for f in fw]
    if not any(ok): return []
    w0, w1 = ok.index(True), len(ok) - 1 - ok[::-1].index(True)
    if fw[w0][2] <= 1: w0 += 1
    if w1 >= w0 and fw[w1][3] >= T - 2: w1 -= 1
    if w1 - w0 + 1 < 2 or any(f is None for f in fw[w0:w1 + 1]): return []
    def split(a, b):
        if (fw[b][3] + 1 - fw[a][2]) * FR <= CAP: return [(a, b)]
        best = None
        for k in range(a, b):
            l, r = (fw[k][3] + 1 - fw[a][2]) * FR, (fw[b][3] + 1 - fw[k + 1][2]) * FR
            if l >= MINP and r >= MINP:
                g = fw[k + 1][2] - fw[k][3]
                if best is None or g > best[0]: best = (g, k)
        return [] if best is None else split(a, best[1]) + split(best[1] + 1, b)
    return split(w0, w1)

def clip_rows(r, y, words, fw, T, gap, reader, base):
    out = []
    for pi, (a, b) in enumerate(cut(fw, words, T)):
        s0 = max(0.0, fw[a][2] * FR - 0.12); s1 = min(len(y) / SR, (fw[b][3] + 1) * FR + 0.12)
        z = y[int(s0 * SR):int(s1 * SR)]; dur = len(z) / SR
        rec = {'id': '%s-%d' % (r['id'], pi), 'reader': reader, 'file': base, 't0': round(r['t0'] + s0, 2), 't1': round(r['t0'] + s1, 2),
               'dur': round(dur, 2), 'snr': r.get('snr'), 'gap': gap}
        sub = words[a:b + 1]; rec['text'] = ' '.join(sub)
        st = fidx[(kidx[tuple(r['from'][:2])], r['from'][2])] + a; en = st + len(sub) - 1
        rec['from'] = list(keys[flat[st][0]]) + [flat[st][1]]; rec['to'] = list(keys[flat[en][0]]) + [flat[en][1]]
        rec['clip'] = round(float((np.abs(z) >= 0.99).mean()), 4)
        if rec['clip'] >= 0.005 or not 1.0 <= dur <= CAP + 0.3: rec['drop'] = 'A2 clip/len'; out.append(rec); continue
        hyp = M.greedy(M.logprobs(boost(z))); lt = lex.text(rec['text'])
        rec['hyp'] = hyp; rec['cer'] = round(bench.lev(bench.norm(hyp).replace(' ', ''), lt) / max(1, len(lt)), 3)
        rec['spl'] = round(sum((fw[k][3] + 1 - fw[k][2]) * FR for k in range(a, b + 1)) / max(1, len(lt)), 4)
        rec['rt60'] = rt60(z, [(fw[k][3] + 1) * FR - s0 for k in range(a, b + 1)])
        rec['ovl'] = overlap(z, [(fw[k][2] * FR - s0, (fw[k][3] + 1) * FR - s0) for k in range(a, b + 1)])
        rec['zone'] = 'known' if rec['cer'] < 0.03 else 'learnable' if rec['cer'] <= 0.60 else 'doubtful'
        if rec['zone'] == 'doubtful': rec['drop'] = 'B7 doubtful'
        # levels by difficulty FOR THE MODEL (base CER), user 2026-11-05; snr/rt60 are logged only. Overlap and gap labels -> L3
        rec['level'] = 'L3' if rec['ovl'] > 0.30 or gap or rec['cer'] > .20 else 'L1' if rec['cer'] <= .05 else 'L2'
        if 'drop' not in rec:
            p = os.path.join(od, 'wav2', rec['id'] + '.wav'); rec['wav'] = p
            if not os.path.exists(p): sf.write(p, z, SR, subtype='PCM_16')    # same clip id = same audio; keeps open listen pages safe
        out.append(rec)
    return out

mfs = sorted(f for f in os.listdir(od) if f.endswith('.json') and f not in ('noise.json', 'split.json', 'refine.json', 'clips.json'))
data, spl = {}, collections.defaultdict(list)
for mf in mfs:                                                  # pass 1: train pieces
    base = mf[:-5]; reader = sheet[base.replace(' ', '')]; rows = json.load(open(os.path.join(od, mf), encoding='utf8'))
    clips = []
    for r in rows:
        if r.get('use') != 'train': continue
        y, _ = sf.read(r['wav'], dtype='float32'); words = r['text'].split()
        lp, fw = align(y, words); clips += clip_rows(r, y, words, fw, len(lp), False, reader, base)
    spl[reader] += [c['spl'] for c in clips if 'spl' in c and 'drop' not in c]
    data[mf] = (rows, clips); print('p1', len(clips), flush=True)
rng = {k: np.percentile(v, [5, 95]) for k, v in spl.items() if len(v) >= 20}
gstat = collections.Counter()
for mf in mfs:                                                  # pass 2: gap labels
    rows, clips = data[mf]; base = mf[:-5]; reader = sheet[base.replace(' ', '')]
    for k in range(1, len(rows) - 1):
        r, p, q = rows[k], rows[k - 1], rows[k + 1]
        if r.get('use') != 'review' or p.get('use') != 'train' or q.get('use') != 'train': continue
        gstat['cand'] += 1
        a = fidx[(kidx[tuple(p['to'][:2])], p['to'][2])] + 1; b = fidx[(kidx[tuple(q['from'][:2])], q['from'][2])]
        if not 1 <= b - a <= 60: gstat['span'] += 1; continue
        words = [WORDS[flat[i][0]][flat[i][1]] for i in range(a, b)]
        y, _ = sf.read(r['wav'], dtype='float32'); lp, fw = align(y, words)
        if any(f is None or f[0] / max(1, f[1]) < GAP_WTH for f in fw): gstat['align'] += 1; continue
        g = dict(r, **{'from': list(keys[flat[a][0]]) + [flat[a][1]]})
        new = clip_rows(g, y, words, fw, len(lp), True, reader, base)
        lo, hi = rng.get(reader, (0, 9))
        for c in new:
            if 'drop' not in c and not lo <= c['spl'] <= hi: c['drop'] = 'C1 tempo'; os.remove(c.pop('wav'))
        gstat['ok'] += sum('drop' not in c for c in new); clips += new
    json.dump(clips, open(os.path.join(od, 'refined', mf), 'w', encoding='utf8'), ensure_ascii=False, indent=0)
S = collections.Counter(); D = collections.Counter(); H = collections.defaultdict(float)
allc = [c for mf in mfs for c in data[mf][1]]
for c in allc:
    if 'drop' in c: D[c['drop']] += 1; continue
    S[c['level']] += 1; H[c['level']] += c['dur'] / 3600; H['zone ' + c['zone']] += c['dur'] / 3600
    if c['gap']: H['gap'] += c['dur'] / 3600
    if c['ovl'] > .3: H['overlap'] += c['dur'] / 3600
    if (c['rt60'] or 0) >= RT_HARD: H['reverb'] += c['dur'] / 3600
rts = [c['rt60'] for c in allc if c.get('rt60')]
summ = {'clips': dict(S), 'hours': {k: round(v, 2) for k, v in H.items()}, 'dropped': dict(D), 'gap': dict(gstat),
        'rt60_pct': [round(float(x), 2) for x in np.percentile(rts, [10, 50, 90, 98])] if rts else None,
        'spl_range': {k: [round(float(x), 3) for x in v] for k, v in rng.items()}}
json.dump(summ, open(os.path.join(od, 'refine.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(json.dumps(summ, ensure_ascii=False), flush=True)
