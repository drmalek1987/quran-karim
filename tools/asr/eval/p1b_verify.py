# P1b word verification on log-probs: forced alignment of the expected words (ctc.forced_words) vs the P1a DP matcher on
# the greedy text, same clips, same negatives (one expected word swapped for another Quran word).
# Usage: python -I p1b_verify.py rows-<tag>.json <lp dir> <model.json> <quran_words.json> <quran-simple-search.json>
#                                [exclude_ids.json|-] [g] [d] [limit]
import sys, os, json, time, random
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bench, ctc

rows = json.load(open(sys.argv[1], encoding='utf8')); lpd = sys.argv[2]
vocab = json.load(open(sys.argv[3], encoding='utf8'))['vocab']
ay = json.load(open(sys.argv[4], encoding='utf8'))
simp = {(v['chapter'], v['verse']): v['text'] for v in json.load(open(sys.argv[5], encoding='utf8'))['quran']}
ex = set(json.load(open(sys.argv[6]))) if len(sys.argv) > 6 and sys.argv[6] != '-' else set()
g = float(sys.argv[7]) if len(sys.argv) > 7 else 3.0; d = float(sys.argv[8]) if len(sys.argv) > 8 else 4.0
lim = int(sys.argv[9]) if len(sys.argv) > 9 else 0
lex = ctc.Lex(vocab); idx = {(x['s'], x['a']): i for i, x in enumerate(ay)}

def units(i):
    """Map an ayah's Uthmani words to its simple-text spelling: per Uthmani word the simple letters (a group of Uthmani
    words read as one simple word shares it; group id says which words share)."""
    U = ay[i]['k']; S = simp[(ay[i]['s'], ay[i]['a'])].split(); Sk = [bench.skel(w) for w in S]
    n, m = len(U), len(S); INF = 1e9
    D = [[INF] * (m + 1) for _ in range(n + 1)]; B = [[None] * (m + 1) for _ in range(n + 1)]; D[0][0] = 0
    cost = lambda a, b: bench.lev(a, b) / max(1, len(a), len(b))
    for x in range(n + 1):
        for y in range(m + 1):
            if D[x][y] >= INF: continue
            for du, ds in ((1, 1), (1, 2), (1, 3), (2, 1), (3, 1)):
                if x + du <= n and y + ds <= m:
                    c = D[x][y] + cost(''.join(U[x:x + du]), ''.join(Sk[y:y + ds])) + 0.3 * (du + ds - 2)
                    if c < D[x + du][y + ds]: D[x + du][y + ds] = c; B[x + du][y + ds] = (du, ds)
    out = [None] * n; x, y = n, m
    while x > 0:
        du, ds = B[x][y]; t = lex.text(' '.join(S[y - ds:y]))
        for k in range(x - du, x): out[k] = (t, x - du)
        x -= du; y -= ds
    return out

flat = [(i, j) for i, x in enumerate(ay) for j in range(len(x['k']))]
UN = {}
def unit_at(fp):
    i, j = flat[fp]
    if i not in UN: UN[i] = units(i)
    return UN[i][j]
start = {}; n = 0
for i, x in enumerate(ay): start[i] = n; n += len(x['k'])
fk = [ay[i]['k'][j] for i, j in flat]

def span_of(r):
    """Flat word range of the row's expected Uthmani words inside its ayat."""
    ws = r['exp'].split(' '); a0 = idx[tuple(r['ayat'][0])]; a1 = idx[tuple(r['ayat'][-1])]
    p, q = start[a0], start[a1] + len(ay[a1]['k'])
    W = [ay[i]['w'][j] for i, j in flat[p:q]]
    for s in range(len(W) - len(ws) + 1):
        if W[s:s + len(ws)] == ws: return p + s
    return None

rnd = random.Random(1)
stat = {}; t0 = time.time(); done = 0; dump = []
for r in rows:
    if 'skip' in r or r['id'] in ex: continue
    p0 = span_of(r)
    if p0 is None: print('no span', r['id']); continue
    nE = len(r['pos']); E = [fk[p0 + k] for k in range(nE)]
    # negative: same position as bench, a new random word (we need its simple spelling too)
    j = r['neg_j']
    while True:
        q = rnd.randrange(len(fk)); w = fk[q]
        if abs(len(w) - len(E[j])) <= 1 and len(w) >= 2 and not bench.rsame(w, E[j]) and unit_at(q)[0]: break
    # units for the CTC: consecutive words of one group become one unit
    def mk(swap):
        us, own = [], []
        for k in range(nE):
            if swap and k == j: us.append(unit_at(q)[0]); own.append(len(us) - 1); continue
            t, gid = unit_at(p0 + k)
            if k > 0 and own and not (swap and k - 1 == j) and unit_at(p0 + k - 1)[1] == gid and flat[p0 + k - 1][0] == flat[p0 + k][0]:
                own.append(own[-1]); continue
            us.append(t); own.append(len(us) - 1)
        return us, own
    z = np.load(os.path.join(lpd, r['id'] + '.npz')); lps = [z[k] for k in z.files]
    out = {}
    for name, swap in (('pos', False), ('neg', True)):
        us, own = mk(swap)
        if lps:
            G, stay, mx = lex.group(np.concatenate(lps)); res = ctc.forced_words(G, stay, mx, lex, us, g, d)
        else: res = [None] * len(us)
        out[name] = [None if res[o] is None else res[o] for o in own]
    dp_pos = bench.recite_dp(r['piece_texts'], E, 1.0); dp_neg = bench.recite_dp(r['piece_texts'], E[:j] + [fk[q]] + E[j + 1:], 1.0)
    dump.append({'id': r['id'], 'set': r['set'], 'j': j, 'pos': out['pos'], 'neg': out['neg'], 'dp_pos': dp_pos, 'dp_neg': dp_neg})
    done += 1
    if lim and done >= lim: break
    if done % 50 == 0: print(done, '%.0f s' % (time.time() - t0), flush=True)

def judge(v, th): return v is not None and v[0] >= th
def summ(th):
    res = {}
    for s in ['ha', 'tlog', 'reciters', 'ALL']:
        R = [x for x in dump if s == 'ALL' or x['set'] == s]
        if not R: continue
        pw = [judge(v, th) for x in R for v in x['pos']]; nw = [not judge(x['neg'][x['j']], th) for x in R]
        dpw = [v == 1 for x in R for v in x['dp_pos']]; dnw = [x['dp_neg'][x['j']] == 0 for x in R]
        res[s] = {'clips': len(R), 'ctc_verify': round(100 * (sum(pw) + sum(nw)) / (len(pw) + len(nw)), 1),
                  'ctc_right_acc': round(100 * sum(pw) / len(pw), 1), 'ctc_wrong_caught': round(100 * sum(nw) / len(nw), 1),
                  'dp_verify': round(100 * (sum(dpw) + sum(dnw)) / (len(dpw) + len(dnw)), 1),
                  'dp_right_acc': round(100 * sum(dpw) / len(dpw), 1), 'dp_wrong_caught': round(100 * sum(dnw) / len(dnw), 1)}
    return res
for th in (-1e9, -40, -20, -12, -8, -5):
    print('th', th, json.dumps(summ(th)))
json.dump(dump, open(sys.argv[1].replace('.json', '-ctcv-g%s-d%s.json' % (g, d)), 'w', encoding='utf8'), ensure_ascii=False)
