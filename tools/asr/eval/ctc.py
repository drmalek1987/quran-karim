# CTC decoding constrained to the Quran text, on the phone model's log-probs (P1b).
# The model's 1024 BPE tokens are mapped to their letters after the app's norm() (diacritics, punctuation and the word
# marker dropped); tokens with no letters left (pure diacritics, '▁', '،') count like blank. A target text is the
# normalised letters without spaces, so word splits/merges by the model do not matter.
# local_align(): best path that reads a contiguous stretch of the target (start/end anywhere), with frames before/after
# it explained as "garbage" at (best token log-prob - g) each -> (score vs. free decoding, start char, end char).
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bench

NEG = np.float32(-1e30)

class Lex:
    def __init__(self, vocab, fold=None):
        forms, fid = {'': 0}, []
        self.fold = fold or (lambda s: s)
        for t in vocab:
            f = self.fold(bench.norm(t.replace('▁', ' ')).replace(' ', ''))
            fid.append(forms.setdefault(f, len(forms)))
        self.forms = forms; self.V = len(vocab); self.F = len(forms)
        self.maxlen = max(len(f) for f in forms)
        M = np.zeros((self.V, self.F), np.float32); M[np.arange(self.V), fid] = 1; self.M = M

    def text(self, s):
        return self.fold(bench.norm(s).replace(' ', ''))

    def group(self, lp):
        """lp (T, V+1) log-probs -> G (T, F+1) log prob of each letter-form (last column NEG = no such form),
        stay (T,) log prob of blank + letterless tokens, mx (T,) best single token log prob."""
        lp = lp.astype(np.float32); P = np.exp(lp)
        S = P[:, :self.V] @ self.M
        stay = np.log(P[:, self.V] + S[:, 0] + 1e-30)
        G = np.log(S + 1e-30); G[:, 0] = NEG
        G = np.concatenate([G, np.full((len(G), 1), NEG, np.float32)], 1)
        return G, stay, lp.max(1)

class Target:
    """A long letter string; F[l][p] = form id of chars [p-l, p) (or -1 -> the NEG column)."""
    def __init__(self, lex, s):
        self.s = s; L = len(s); self.L = L; ml = lex.maxlen
        self.Fl = np.full((ml + 1, L + 1), -1, np.int32)
        for l in range(1, ml + 1):
            for p in range(l, L + 1):
                f = lex.forms.get(s[p - l:p])
                if f is not None and f != 0: self.Fl[l, p] = f
        self.ls = [l for l in range(1, ml + 1) if (self.Fl[l] >= 0).any()]

def local_align(G, stay, mx, tg, g=3.0):
    """Viterbi over frames; returns (score - free score, start char, end char)."""
    T = len(G); L = tg.L; Fl = tg.Fl
    A = np.full(L + 1, NEG, np.float32); St = np.zeros(L + 1, np.int64); B = np.float32(0); idx = np.arange(L + 1)
    gar = mx - g; suf = np.concatenate([np.cumsum(gar[::-1])[::-1], [0]]).astype(np.float32)
    best = (NEG, 0, 0)
    for t in range(T):
        Gt = G[t]
        useA = A >= B; src = np.where(useA, A, B); sst = np.where(useA, St, idx)
        R = np.full(L + 1, NEG, np.float32)                       # repeat of a chunk that ends at p (CTC repeat)
        nA = np.full(L + 1, NEG, np.float32); nS = St.copy()
        for l in tg.ls:
            e = Gt[Fl[l]]; R = np.maximum(R, e)
            c = np.full(L + 1, NEG, np.float32); c[l:] = src[:-l] + e[l:]
            w = c > nA; nA = np.where(w, c, nA); nS[l:] = np.where(w[l:], sst[:-l], nS[l:])
        sc = A + np.logaddexp(stay[t], R)
        w = sc >= nA; nS = np.where(w, St, nS); nA = np.where(w, sc, nA)
        A, St = nA, nS; B = B + gar[t]
        p = int(A.argmax()); tot = A[p] + suf[t + 1]
        if tot > best[0]: best = (tot, int(St[p]), p)
    return float(best[0] - mx.sum()), best[1], best[2]

class QuranText:
    """The whole Quran (simple imla'i text, as the model was trained on) as one letter string; '|' between suras."""
    def __init__(self, lex, simple_json):
        simp = json.load(open(simple_json, encoding='utf8'))['quran']
        parts, own, prev = [], [], None
        self.keys = []
        for v in simp:
            if prev is not None and v['chapter'] != prev: parts.append('|'); own.append(-1)
            k = len(self.keys); self.keys.append((v['chapter'], v['verse'])); t = lex.text(v['text'])
            parts.append(t); own += [k] * len(t); prev = v['chapter']
        self.text = {k: lex.text(v['text']) for k, v in zip(self.keys, simp)}
        self.s = ''.join(parts); self.own = np.array(own)
        self.tg = Target(lex, self.s)

    def ayah_of(self, a, b):
        """The ayah owning most chars of [a, b)."""
        o = self.own[a:max(b, a + 1)]; o = o[o >= 0]
        if not len(o): return None
        return self.keys[int(np.bincount(o).argmax())]

def forced_words(G, stay, mx, lex, words, g=3.0, d=4.0, spans=False):
    """Align the expected words (letter strings) over all frames. Between words (and before/after) frames may be garbage
    at (mx - g); a word may be skipped at cost d (it was not said / said wrong). Returns per word: None if skipped, else
    (sum over its frames of path log-prob - mx, frames). spans=True adds (first frame, last frame) to each tuple."""
    s = ''.join(words); L = len(s); tg = Target(lex, s); Fl = tg.Fl; T = len(G)
    bnd = np.cumsum([0] + [len(w) for w in words]); isb = np.zeros(L + 1, bool); isb[bnd] = True
    owner = np.zeros(L + 1, np.int64)
    for i in range(len(words)): owner[bnd[i] + 1:bnd[i + 1] + 1] = i
    def eps(A):
        src = np.full(L + 1, -1, np.int64)
        for i in range(len(words)):
            a, b = bnd[i], bnd[i + 1]
            if A[a] - d > A[b]: A[b] = A[a] - d; src[b] = a
        return A, src
    A = np.full(L + 1, NEG, np.float32); A[0] = 0; A, e0 = eps(A)
    BP = np.zeros((T, L + 1), np.int64); EM = np.zeros((T, L + 1), np.float32); KIND = np.zeros((T, L + 1), np.int8)
    EPS = [e0]
    for t in range(T):
        Gt = G[t]; R = np.full(L + 1, NEG, np.float32); nA = np.full(L + 1, NEG, np.float32)
        bp = np.arange(L + 1); em = np.zeros(L + 1, np.float32); kind = np.zeros(L + 1, np.int8)
        for l in tg.ls:
            e = Gt[Fl[l]]; R = np.maximum(R, e)
            c = np.full(L + 1, NEG, np.float32); c[l:] = A[:-l] + e[l:]
            w = c > nA; nA = np.where(w, c, nA); bp = np.where(w, np.arange(L + 1) - l, bp); em = np.where(w, e, em); kind[w] = 1
        st = np.logaddexp(stay[t], R); sc = A + st
        w = sc >= nA; nA = np.where(w, sc, nA); bp = np.where(w, np.arange(L + 1), bp); em = np.where(w, st, em); kind[w] = 2
        gb = np.where(isb, A + (mx[t] - g), NEG)                  # garbage frame at a word boundary
        w = gb > nA; nA = np.where(w, gb, nA); bp = np.where(w, np.arange(L + 1), bp); kind[w] = 3
        nA, ep = eps(nA); BP[t], EM[t], KIND[t] = bp, em, kind; EPS.append(ep); A = nA
    conf = [0.0] * len(words); nfr = [0] * len(words); skipped = [False] * len(words); f0 = [T] * len(words); f1 = [-1] * len(words)
    p = L
    def unskip(ep, p):
        while ep[p] >= 0:
            a = ep[p]
            for i in range(len(words)):
                if bnd[i] >= a and bnd[i + 1] <= p: skipped[i] = True
            p = a
        return p
    for t in range(T - 1, -1, -1):
        p = unskip(EPS[t + 1], p)
        k = KIND[t, p]
        if k in (1, 2) and p > 0:
            # a frame staying at a word's end after its last letter belongs to that word; at p == boundary of the next
            # word's start it is the previous word's tail
            i = owner[p]; conf[i] += float(EM[t, p] - mx[t]); nfr[i] += 1; f0[i] = min(f0[i], t); f1[i] = max(f1[i], t)
        p = int(BP[t, p])
    unskip(EPS[0], p)
    if spans: return [None if skipped[i] or not nfr[i] else (conf[i], nfr[i], f0[i], f1[i]) for i in range(len(words))]
    return [None if skipped[i] else (conf[i], nfr[i]) for i in range(len(words))]

def cand_text(Q, keys):
    """A Target over a few candidate ayat (sorted, consecutive ones joined, '|' between runs) + char->ayah owners."""
    pos = {k: i for i, k in enumerate(Q.keys)}; ids = sorted({pos[k] for k in keys})
    parts, own, prev = [], [], None
    for i in ids:
        if prev is not None and (i != prev + 1 or Q.keys[i][0] != Q.keys[prev][0]): parts.append('|'); own.append(-1)
        t = Q.text[Q.keys[i]]; parts.append(t); own += [i] * len(t); prev = i
    return ''.join(parts), np.array(own)
