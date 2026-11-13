# Recitation-recognition benchmark: runs the phone's exact pipeline (NvAsr.java: 100 ms VAD pieces, Java features,
# int8 ONNX, greedy CTC) and the app's word matcher (web/app.js reciteHear/rSame/rSkel) on held-out clips, and reports
#   (a) word verification: each expected word judged right/wrong; positives = clip + its true text, negatives = the same
#       clip with one expected word swapped for another Quran word (the app must flag that word);
#   (b) ayah identification: the heard text -> best ayah, top-1;
#   CER (secondary).
# Usage: python -I bench.py --model <model.int8.onnx> --vocab <model.json> --quran <quran_words.json>
#                          --simple <data/quran-simple-search.json> --sets <manifest.json>... --out <dir> [--decoder greedy]
import sys, os, json, re, random, time, argparse, unicodedata, collections, html
import numpy as np, soundfile as sf, onnxruntime as ort

# ---------- text: ports of web/app.js norm / rSkel / rSame ----------
DIAC = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ‌-‏۝۞۩]')
def norm(t):
    t = unicodedata.normalize('NFKD', t); t = DIAC.sub('', t)
    t = re.sub('[ٱأإآ]', 'ا', t); t = re.sub('[ىی]', 'ي', t); t = t.replace('ة', 'ه').replace('ک', 'ك')
    t = re.sub(r'[^ء-ي\s]', '', t); return re.sub(r'\s+', ' ', t).strip()
def skel(w): return re.sub('[اءؤئوي]', '', norm(w))
def lev(a, b):
    m, n = len(a), len(b); d = list(range(n + 1))
    for i in range(1, m + 1):
        p = d[0]; d[0] = i
        for j in range(1, n + 1):
            t = d[j]; d[j] = min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] != b[j - 1])); p = t
    return d[n]
def rsame(a, b):
    if not a or not b: return False
    if a == b: return True
    return 1 - lev(a, b) / max(len(a), len(b)) >= 0.6

REP = 0.2        # the word just matched, said again
MERGE = 0.5      # two heard words read as one expected word: only when it beats aligning them one by one
def recite_dp(heard_pieces, exp, ins=0.5, tail=1.1):
    """Alignment matcher: all heard words vs the expected words in one DP, so an extra (garbage or repeated) heard word
    costs `ins` and is skipped instead of pushing the expected position on. Expected words after the last aligned one are
    unreached (not judged); heard words left after that point cost `tail` (> a wrong word), so a misread word near the end
    is flagged instead of being left unreached. Returns the same verdict list as recite()."""
    H = [skel(w) for t in heard_pieces for w in norm(t).split(' ') if w]; E = exp; n, m = len(E), len(H)
    INF = 1e9
    D = [[INF] * (m + 1) for _ in range(n + 1)]                    # best cost, any last step
    N = [[INF] * (m + 1) for _ in range(n + 1)]                    # best cost whose last step consumed an expected word
    BN = [[None] * (m + 1) for _ in range(n + 1)]
    D[0][0] = N[0][0] = 0
    for j in range(1, m + 1): D[0][j] = j * ins
    for i in range(1, n + 1):
        for j in range(0, m + 1):
            best, b = D[i - 1][j] + 1, 'd'
            if j >= 1:
                ok = rsame(H[j - 1], E[i - 1]); c = D[i - 1][j - 1] + (0 if ok else 1)
                if c <= best: best, b = c, ('m' if ok else 's')
            if j >= 2 and D[i - 1][j - 2] + MERGE < best and rsame(H[j - 2] + H[j - 1], E[i - 1]): best, b = D[i - 1][j - 2] + MERGE, 'j'
            N[i][j], BN[i][j] = best, b
            D[i][j] = min(best, D[i][j - 1] + (REP if rsame(H[j - 1], E[i - 1]) else ins)) if j >= 1 else best
    i, j = min(((i, j) for i in range(n + 1) for j in range(m + 1)), key=lambda t: (N[t[0]][t[1]] + (m - t[1]) * tail, -t[0]))
    v = [None] * n
    while i > 0:
        b = BN[i][j]
        if b == 'd': v[i - 1] = 0; i -= 1
        elif b == 'j': v[i - 1] = 1; i -= 1; j -= 2
        else: v[i - 1] = 1 if b == 'm' else 0; i -= 1; j -= 1
        while i > 0 and j > 0 and N[i][j] > D[i][j]: j -= 1          # undo insertions: walk back to where N is the best
    return v

def recite(heard_pieces, exp):
    """reciteHear over the final pieces, one expected word list. Returns per-word verdict: 1 right, 0 wrong, None unreached."""
    pos, bad = 0, set()
    for text in heard_pieces:
        heard = [skel(w) for w in norm(text).split(' ') if w]
        h = 0
        while h < len(heard) and pos < len(exp):
            if rsame(heard[h], exp[pos]) or (h + 1 < len(heard) and rsame(heard[h] + heard[h + 1], exp[pos]) and [h := h + 1]):
                pos += 1
            elif pos + 1 < len(exp) and rsame(heard[h], exp[pos + 1]): bad.add(pos); pos += 2
            elif pos > 0 and rsame(heard[h], exp[pos - 1]): pass                    # a repeated word
            else: bad.add(pos); pos += 1
            h += 1
    return [None if i >= pos else (0 if i in bad else 1) for i in range(len(exp))]

# ---------- audio: port of NvAsr.java ----------
SR, NF, WIN, HOP, NB, NM = 16000, 512, 400, 160, 257, 80
def _tables():
    win = np.zeros(NF); o = (NF - WIN) // 2; i = np.arange(WIN); win[o:o + WIN] = 0.5 - 0.5 * np.cos(2 * np.pi * i / (WIN - 1))
    hz2mel = lambda f: 3 * f / 200 if f < 1000 else 15 + np.log(f / 1000) / (np.log(6.4) / 27)
    mel2hz = lambda m: 200 * m / 3 if m < 15 else 1000 * np.exp((np.log(6.4) / 27) * (m - 15))
    top = hz2mel(SR / 2.0); pts = [mel2hz(top * i / (NM + 1)) for i in range(NM + 2)]
    fq = np.arange(NB) * SR / NF; mel = np.zeros((NM, NB))
    for m in range(NM):
        lo, c, hi = pts[m], pts[m + 1], pts[m + 2]
        mel[m] = np.maximum(0, np.minimum((fq - lo) / (c - lo), (hi - fq) / (hi - c))) * (2 / (hi - lo))
    return win.astype(np.float32), mel.astype(np.float32)
WINF, MEL = _tables()
def feats(y):
    n, P = len(y), NF // 2; T = n // HOP + 1
    pe = np.zeros(n + 2 * P, np.float32); pe[P] = y[0]; pe[P + 1:P + n] = y[1:] - np.float32(0.97) * y[:-1]
    fr = np.lib.stride_tricks.sliding_window_view(pe, NF)[::HOP][:T] * WINF
    pw = (np.abs(np.fft.rfft(fr, NF)) ** 2).astype(np.float32)
    x = np.log(pw @ MEL.T + 5.960464477539063e-8).T                                      # (NM, T)
    mu = x.mean(1, keepdims=True); sd = np.sqrt(((x - mu) ** 2).sum(1, keepdims=True) / max(1, T - 1)) + 1e-5
    return ((x - mu) / sd).astype(np.float32)

def louder(pc, pgain):
    """NvAsr.louder(): each piece to pgain dBFS (boost only, <= 30x)."""
    if pgain is None: return pc
    r = float(np.sqrt((pc * pc).mean())) or 1e-9; g = 10 ** (pgain / 20) / r
    return np.clip(pc * min(g, 30.0), -1, 1).astype(np.float32) if g > 1 else pc

def vad_pieces(y, preroll=0, quiet_end=0.6, vmin=0.006, pgain=None, kstart=3.0, kstay=None, frise_sp=None,
               minvoiced=0.3, carry=0.0, capcut=False, raw=False, fwin=0.0, cap_s=12.0, fmin=0.0, fcatch=0.0):
    """NvAsr.listen(): 100 ms blocks; a piece ends after 0.6 s quiet or 12 s; kept if > 0.3 s voiced. 2 s of silence are
    appended (the reader stops, then taps the mic off).
    Experimental (defaults = the phone): kstart/kstay = start / stay-in-speech multiples of the floor (hysteresis);
    frise_sp = floor rise rate on speech blocks (None: 0.005 like any block); minvoiced = voiced seconds to keep a piece;
    carry = a piece too short to keep is held (up to `carry` s) and put in front of the next piece instead of dropped;
    fmin = the floor is never below the quietest block of the last fmin s (a lasting noise jump stops counting as speech);
    fcatch = after fcatch s of speech with no quiet block, the floor rises at the normal rate again (frise_sp off);
    capcut = at the 12 s cap, cut at the quietest block of the last 2 s and start the next piece with the rest.
    raw=True returns (pieces before louder(), end sample of each piece in the input)."""
    kstay = kstart if kstay is None else kstay
    q = np.round(np.clip(y, -1, 1 - 1 / 32768) * 32768).astype(np.int16) / 32768.0
    q = np.concatenate([q, np.zeros(2 * SR)]); blk = SR // 10
    out, ends, seg, floor, quiet, voiced = [], [], [], 0.004, 0.0, 0.0
    bl = []                                                                 # (energy, speech) of each block in seg (capcut)
    held = None; insp = False; hist = []; ring = []; run = 0
    cap = int(SR * cap_s)
    for b0 in range(0, len(q) - blk + 1, blk):
        b = q[b0:b0 + blk]; e = float(np.sqrt((b * b).mean()))
        f0 = floor
        if fwin:                                                            # floor = quietest block of the last fwin s
            hist.append(e); hist = hist[-int(fwin * 10):]; floor = max(1e-5, min(hist))
        else: floor = e if e < floor else floor * 0.995 + e * 0.005
        m = 0.0
        if fmin:                                                            # quietest block of the last fmin s (once full)
            ring.append(e); ring = ring[-int(round(fmin * 10)):]
            if len(ring) == int(round(fmin * 10)): m = min(ring); floor = max(floor, m)
        speech = e > max(vmin, floor * (kstay if insp else kstart)); dt = 0.1
        run = run + 1 if speech else 0
        if frise_sp is not None and not fwin and speech and e >= f0 and not (fcatch and run > fcatch * 10): floor = max(f0 * (1 - frise_sp) + e * frise_sp, m)
        insp = speech
        ln = sum(len(s) for s in seg)
        if speech and ln == 0 and preroll:                                  # the blocks just before the voice started
            pre = q[max(0, b0 - preroll * blk):b0]
            if len(pre): seg.append(pre); ln = len(pre); bl += [(0.0, False)] * ((len(pre) + blk - 1) // blk)
        if speech or ln > 0: seg.append(b[:max(0, min(blk, cap - ln))]); ln += len(seg[-1]); bl.append((e, speech))
        if speech: voiced += dt; quiet = 0
        elif ln > 0: quiet += dt
        if ln > 0 and (quiet > quiet_end or ln >= cap):
            rest = None
            if capcut and ln >= cap and quiet <= quiet_end and len(bl) > 22:
                w = list(range(len(bl) - 20, len(bl) - 1)); k = min(w, key=lambda i: bl[i][0]) + 1
                pc = np.concatenate(seg); rest = pc[k * blk:]; restbl = bl[k:]; seg = [pc[:k * blk]]
                voiced -= sum(dt for _, s in restbl if s)
            if voiced > minvoiced:
                pc = np.concatenate(seg).astype(np.float32)
                if held is not None: pc = np.concatenate([held, pc]); held = None
                out.append(pc); ends.append(b0 + blk - (len(rest) if rest is not None else 0))
            elif carry > 0:
                pc = np.concatenate(seg).astype(np.float32)
                held = (pc if held is None else np.concatenate([held, pc]))[-int(carry * SR):]
            seg, quiet, voiced, bl = [], 0.0, 0.0, []
            if rest is not None:
                seg, bl = [rest], restbl; voiced = sum(dt for _, s in restbl if s)
    if raw: return out, ends
    return [louder(p, pgain) for p in out]

def word_delays(lp, n_samples, vocab_len, vocab):
    """Seconds from the end of each greedy word (its last non-blank frame) to the end of the piece."""
    T = lp.shape[0]; fd = n_samples / SR / max(1, T); ids = lp.argmax(-1); ends, prev, cur = [], -1, None
    for t, k in enumerate(ids):
        if k < vocab_len and k != prev:
            if vocab[k].startswith('▁') and cur is not None: ends.append(cur)
            cur = t
        elif k < vocab_len and k == prev: cur = t
        prev = k
    if cur is not None: ends.append(cur)
    return [(T - 1 - f) * fd for f in ends]

class Model:
    def __init__(self, path, vocab_json, threads=0):
        so = ort.SessionOptions(); so.intra_op_num_threads = threads or os.cpu_count() or 4
        self.s = ort.InferenceSession(path, so, providers=['CPUExecutionProvider'])
        self.names = [i.name for i in self.s.get_inputs()]; self.vocab = json.load(open(vocab_json, encoding='utf8'))['vocab']
    def logprobs(self, y):
        f = feats(y); return self.s.run(None, {self.names[0]: f[None], self.names[1]: np.array([f.shape[1]], np.int64)})[0][0]
    def greedy(self, lp):
        out, prev = [], -1
        for t in lp.argmax(-1):
            if t != prev and t < len(self.vocab): out.append(self.vocab[t])
            prev = t
        return re.sub(r'\s+', ' ', ''.join(out).replace('▁', ' ')).strip()

# ---------- Quran ----------
class Quran:
    def __init__(self, words_json, simple_json):
        self.ay = json.load(open(words_json, encoding='utf8'))
        self.flat = [(i, j) for i, x in enumerate(self.ay) for j in range(len(x['k']))]
        self.fk = [self.ay[i]['k'][j] for i, j in self.flat]
        self.start = {}; n = 0
        for i, x in enumerate(self.ay): self.start[i] = n; n += len(x['k'])
        self.byk = collections.defaultdict(list)
        for p, k in enumerate(self.fk): self.byk[k].append(p)
        self.idx = {(x['s'], x['a']): i for i, x in enumerate(self.ay)}
        simp = json.load(open(simple_json, encoding='utf8'))['quran']
        self.simple = {(v['chapter'], v['verse']): norm(v['text']) for v in simp}
        self.ask = [''.join(x['k']) for x in self.ay]                                   # ayah skeleton strings
        self.tri = collections.defaultdict(set)
        for i, s in enumerate(self.ask):
            for g in range(len(s) - 2): self.tri[s[g:g + 3]].add(i)
    def locate(self, text):
        """Flat word span (p0, p1) where the text's skeleton words match the Quran; exact first, then >= 80% words."""
        ks = [skel(w) for w in norm(text).split(' ') if skel(w)]
        if not ks: return None
        best = None
        for p in self.byk.get(ks[0], []) + ([] if len(ks) < 2 else [q - 1 for q in self.byk.get(ks[1], [])]):
            if p < 0 or p + len(ks) > len(self.fk): continue
            hit = sum(a == b or rsame(a, b) for a, b in zip(ks, self.fk[p:p + len(ks)]))
            if best is None or hit > best[0]: best = (hit, p)
            if hit == len(ks): break
        if best and best[0] >= 0.8 * len(ks): return (best[1], best[1] + len(ks))
        return None
    def span_ayat(self, p0, p1): return sorted({self.flat[p][0] for p in range(p0, p1)})
    def identify(self, text, top=30):
        """Free-text search, the baseline way: hyp skeleton -> ayah with the smallest substring edit distance."""
        h = ''.join(skel(w) for w in norm(text).split(' ') if w)
        if len(h) < 3: return None
        cnt = collections.Counter()
        for g in range(len(h) - 2):
            for i in self.tri.get(h[g:g + 3], ()): cnt[i] += 1
        best = None
        for i, _ in cnt.most_common(top):
            a = self.ask[i]; d = sub_dist(h, a) if len(h) <= len(a) else sub_dist(a, h)
            sc = d / max(1, min(len(h), len(a))) - 0.001 * min(len(h), len(a))
            if best is None or sc < best[0]: best = (sc, i)
        return best[1] if best else None

def sub_dist(p, t):
    """Smallest edit distance between p and any substring of t (Sellers)."""
    d = list(range(len(p) + 1)); best = d[-1]
    for c in t:
        prev, d[0] = d[0], 0
        for i in range(1, len(p) + 1):
            cur = d[i]; d[i] = min(d[i] + 1, d[i - 1] + 1, prev + (p[i - 1] != c)); prev = cur
        best = min(best, d[-1])
    return best

def ed(a, b): return lev(a, b)

# ---------- main ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True); ap.add_argument('--vocab', required=True)
    ap.add_argument('--quran', required=True); ap.add_argument('--simple', required=True)
    ap.add_argument('--sets', nargs='+', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--limit', type=int, default=0); ap.add_argument('--tag', default='greedy')
    ap.add_argument('--preroll', type=int, default=0, help='100 ms blocks kept from before the voice starts (phone: 0)')
    ap.add_argument('--quiet', type=float, default=0.6, help='seconds of quiet that end a piece (phone: 0.6)')
    ap.add_argument('--dump', default='', help='dir: save each clip piece log-probs (float16 npz) for offline decoders (ctc.py)')
    ap.add_argument('--vmin', type=float, default=0.006, help='VAD minimum block RMS (phone 5.3: 0.006)')
    ap.add_argument('--pgain', type=float, default=None, help='raise each piece to this RMS dBFS before the model (phone 5.3: none)')
    ap.add_argument('--noise', default='', help="'white' or 'babble' (another clip of the sets mixed in) at --snr dB")
    ap.add_argument('--snr', type=float, default=10.0)
    ap.add_argument('--gain', default='-31', help="target speech RMS in dBFS before the VAD (the donated phone clip was -31.4), or 'none'")
    # VAD experiments (defaults = today's phone logic; see vad_pieces)
    ap.add_argument('--kstart', type=float, default=3.0, help='speech starts above floor x kstart (phone: 3)')
    ap.add_argument('--kstay', type=float, default=None, help='stays speech above floor x kstay (phone: = kstart)')
    ap.add_argument('--frise_sp', type=float, default=None, help='floor rise rate on speech blocks (phone: 0.005 always)')
    ap.add_argument('--minvoiced', type=float, default=0.3, help='voiced seconds to keep a piece (phone: 0.3)')
    ap.add_argument('--carry', type=float, default=0.0, help='hold a too-short piece (<= s) for the next one (phone: drop)')
    ap.add_argument('--cap', type=float, default=12.0, help='longest piece in s (phone: 12)')
    ap.add_argument('--fwin', type=float, default=0.0, help='floor = quietest 100 ms block of the last fwin s (phone: 0 = min/rise tracker)')
    ap.add_argument('--fmin', type=float, default=0.0, help='floor >= quietest block of the last fmin s (phone: 0 = off)')
    ap.add_argument('--fcatch', type=float, default=0.0, help='after this many s of unbroken speech the floor rises at the normal rate (phone: 0 = off)')
    ap.add_argument('--capcut', action='store_true', help='at 12 s cut at the quietest block of the last 2 s (phone: hard cut)')
    ap.add_argument('--merge_empty', type=float, default=0.0, help='a piece that decodes empty (<= s) goes in front of the next (phone: drop)')
    ap.add_argument('--dump_nonempty', action='store_true', help='dump only pieces with text (p1b_port_eval then skips no clip)')
    ap.add_argument('--threads', type=int, default=0, help='onnxruntime intra-op threads (0: all cores)')
    ap.add_argument('--ids', default='', help='json list of clip ids to run (dev/hold split)')
    a = ap.parse_args()
    Qr = Quran(a.quran, a.simple); M = Model(a.model, a.vocab, a.threads); rnd = random.Random(1)
    os.makedirs(a.out, exist_ok=True)
    clips = []
    for m in a.sets: clips += json.load(open(m, encoding='utf8'))
    if a.limit: clips = clips[:a.limit]
    if a.ids: keep = set(json.load(open(a.ids))); clips = [c for c in clips if c['id'] in keep]
    rows, t0 = [], time.time()
    for c in clips:
        # where the clip is in the Quran
        if 's' in c: i = Qr.idx[(c['s'], c['a'])]; span = (Qr.start[i], Qr.start[i] + len(Qr.ay[i]['k']))
        else: span = Qr.locate(c['text'])
        if not span: rows.append({'id': c['id'], 'set': c['set'], 'skip': 'not located'}); continue
        p0, p1 = span; exp = Qr.fk[p0:p1]; ayat = Qr.span_ayat(p0, p1)
        full = len(ayat) == 1 and p0 == Qr.start[ayat[0]] and p1 - p0 == len(Qr.ay[ayat[0]]['k'])
        ref = Qr.simple[(Qr.ay[ayat[0]]['s'], Qr.ay[ayat[0]]['a'])] if full else norm(c.get('text', ''))
        y, sr = sf.read(c['wav'], dtype='float32')
        if y.ndim > 1: y = y.mean(1)
        assert sr == SR, c['wav']
        raw_lost = not vad_pieces(y)
        if a.gain != 'none':
            r = float(np.sqrt((y * y).mean())) or 1e-9; y = np.clip(y * (10 ** (float(a.gain) / 20) / r), -1, 1).astype(np.float32)
        if a.noise:
            if a.noise == 'white': nz = np.random.RandomState(7).randn(len(y)).astype(np.float32)
            else:
                o = clips[(clips.index(c) + 17) % len(clips)]; nz, _ = sf.read(o['wav'], dtype='float32')
                if nz.ndim > 1: nz = nz.mean(1)
                nz = np.resize(nz, len(y))
            ry = float(np.sqrt((y * y).mean())) or 1e-9; rn = float(np.sqrt((nz * nz).mean())) or 1e-9
            y = np.clip(y + nz * (ry / rn) * 10 ** (-a.snr / 20), -1, 1).astype(np.float32)
        rp, pends = vad_pieces(y, a.preroll, a.quiet, a.vmin, a.pgain, a.kstart, a.kstay, a.frise_sp, a.minvoiced,
                               a.carry, a.capcut, raw=True, fwin=a.fwin, cap_s=a.cap, fmin=a.fmin, fcatch=a.fcatch)
        lps, plen, wdel, held, td = [], [], [], None, time.time()
        for p in rp:
            if held is not None: p = np.concatenate([held, p]); held = None
            l = M.logprobs(louder(p, a.pgain))
            if a.merge_empty and not M.greedy(l): held = p[-int(a.merge_empty * SR):]; continue   # decoded empty: in front of the next
            lps.append(l); plen.append(len(p)); wdel += word_delays(l, len(p), len(M.vocab), M.vocab)
        td = time.time() - td
        texts = [M.greedy(l) for l in lps]
        if a.dump:
            os.makedirs(a.dump, exist_ok=True)
            dl = [l for l, t in zip(lps, texts) if t] if a.dump_nonempty else lps
            np.savez_compressed(os.path.join(a.dump, c['id'] + '.npz'), *[l.astype(np.float16) for l in dl])
        pieces = [p for p in texts if p]
        hyp = ' '.join(pieces)
        pos = recite(pieces, exp)
        # negative: one expected word swapped for another Quran word of about the same length that the matcher must reject
        j = rnd.randrange(len(exp)); cand = None
        for _ in range(200):
            w = Qr.fk[rnd.randrange(len(Qr.fk))]
            if abs(len(w) - len(exp[j])) <= 1 and len(w) >= 2 and not rsame(w, exp[j]): cand = w; break
        neg_exp = exp[:j] + [cand] + exp[j + 1:]; neg = recite(pieces, neg_exp)
        guess = Qr.identify(hyp)
        rows.append({'id': c['id'], 'set': c['set'], 'ref': ref, 'hyp': hyp, 'pieces': len(pieces),
                     'exp': ' '.join(Qr.ay[Qr.flat[p][0]]['w'][Qr.flat[p][1]] for p in range(p0, p1)),
                     'pos': pos, 'neg': neg, 'piece_texts': pieces, 'raw_vad_lost': raw_lost,
                     'plen': [n / SR for n in plen], 'wdel': [round(x, 3) for x in wdel], 'dsec': round(td, 3), 'asec': len(y) / SR, 'neg_j': j, 'neg_w': cand,
                     'cer_e': ed(norm(hyp), ref), 'cer_n': len(ref),
                     'ayat': [[Qr.ay[i]['s'], Qr.ay[i]['a']] for i in ayat],
                     'guess': [Qr.ay[guess]['s'], Qr.ay[guess]['a']] if guess is not None else None,
                     'id_ok': guess is not None and (guess in ayat or Qr.ask[guess] in {Qr.ask[i] for i in ayat})})
        if len(rows) % 25 == 0: print('%d/%d  %.0f s' % (len(rows), len(clips), time.time() - t0), flush=True)
    json.dump(rows, open(os.path.join(a.out, 'rows-%s.json' % a.tag), 'w', encoding='utf8'), ensure_ascii=False)
    summ = summarize(rows); summ['tag'] = a.tag; summ['model'] = a.model; summ['sec'] = round(time.time() - t0)
    json.dump(summ, open(os.path.join(a.out, 'summary-%s.json' % a.tag), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    report(rows, summ, os.path.join(a.out, 'report-%s.html' % a.tag))
    print(json.dumps(summ, ensure_ascii=False))

def summarize(rows):
    out = {}
    for s in sorted({r['set'] for r in rows}) + ['ALL']:
        R = [r for r in rows if (s == 'ALL' or r['set'] == s)]; ok = [r for r in R if 'skip' not in r]
        if not ok: continue
        pw = [v for r in ok for v in r['pos']]                                  # truth: all right
        tp = sum(v == 1 for v in pw)
        nw = [(r['neg'][r['neg_j']]) for r in ok]                               # truth: wrong
        tn = sum(v == 0 for v in nw)
        nrest = [v for r in ok for i, v in enumerate(r['neg']) if i != r['neg_j']]
        out[s] = {'clips': len(ok), 'skipped': len(R) - len(ok),
                  'word_accept_correct_%': round(100 * tp / max(1, len(pw)), 1),       # correct words judged right
                  'word_unreached_%': round(100 * sum(v is None for v in pw) / max(1, len(pw)), 1),
                  'wrong_word_caught_%': round(100 * tn / max(1, len(nw)), 1),           # swapped word flagged
                  'verify_acc_%': round(100 * (tp + tn) / max(1, len(pw) + len(nw)), 1),  # metric (a), balanced-ish
                  'clip_perfect_%': round(100 * sum(all(v == 1 for v in r['pos']) for r in ok) / len(ok), 1),
                  'ayah_id_top1_%': round(100 * sum(r['id_ok'] for r in ok) / len(ok), 1),  # metric (b)
                  'vad_lost_raw_level_%': round(100 * sum(r['raw_vad_lost'] for r in ok) / len(ok), 1),
                  'cer_%': round(100 * sum(r['cer_e'] for r in ok) / max(1, sum(r['cer_n'] for r in ok)), 1)}
    return out

def report(rows, summ, path):
    e = html.escape
    h = ['<!doctype html><meta charset="utf-8"><title>ASR bench %s</title><style>body{font-family:Segoe UI,Tahoma;margin:20px}'
         'table{border-collapse:collapse;margin:10px 0}td,th{border:1px solid #ccc;padding:4px 8px}.ar{direction:rtl;font-size:18px}'
         '.ok{color:#080}.bad{color:#c00;font-weight:bold}.un{color:#999}</style>' % e(summ['tag'])]
    h.append('<h2>Benchmark: %s</h2><p>%s · %s s</p><table><tr><th>set</th>' % (e(summ['tag']), e(summ['model']), summ['sec']))
    keys = list(next(v for k, v in summ.items() if isinstance(v, dict)).keys())
    h.append(''.join('<th>%s</th>' % e(k) for k in keys) + '</tr>')
    for s, v in summ.items():
        if isinstance(v, dict): h.append('<tr><td>%s</td>%s</tr>' % (e(s), ''.join('<td>%s</td>' % v[k] for k in keys)))
    h.append('</table><p>verify_acc = (correct words judged right + swapped words flagged) / all judgments. '
             'Unreached words count as not right.</p><h3>Clips</h3><table><tr><th>id</th><th>expected (green right, red wrong, grey unreached)</th><th>heard</th><th>id</th></tr>')
    for r in rows:
        if 'skip' in r: h.append('<tr><td>%s</td><td colspan=3>%s</td></tr>' % (e(r['id']), e(r['skip']))); continue
        ws = r['exp'].split(' ')
        if len(ws) != len(r['pos']): ws = ['?'] * len(r['pos'])
        cells = ' '.join('<span class="%s">%s</span>' % ({1: 'ok', 0: 'bad', None: 'un'}[v], e(w)) for w, v in zip(ws, r['pos']))
        h.append('<tr><td>%s</td><td class="ar">%s</td><td class="ar">%s</td><td>%s</td></tr>' % (e(r['id']), cells, e(r['hyp']), '✓' if r['id_ok'] else '✗ %s' % r['guess']))
    h.append('</table>')
    open(path, 'w', encoding='utf8').write('\n'.join(h))

if __name__ == '__main__':
    main()
