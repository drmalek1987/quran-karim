# P1b ayah id, phone-sized: trigram retrieval (bench.Quran) of the top-N ayat from the greedy text, each with its
# neighbours, then Quran-constrained CTC (ctc.local_align) over just those. Same args as p1b_id.py + N.
import sys, os, json, time, collections
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bench, ctc
rows = json.load(open(sys.argv[1], encoding='utf8')); lpd = sys.argv[2]
vocab = json.load(open(sys.argv[3], encoding='utf8'))['vocab']
ex = set(json.load(open(sys.argv[5]))) if len(sys.argv) > 5 and sys.argv[5] != '-' else set()
g = float(sys.argv[6]) if len(sys.argv) > 6 else 3.0; N = int(sys.argv[7]) if len(sys.argv) > 7 else 50
lex = ctc.Lex(vocab)
class QT:                                                       # QuranText without the whole-Quran Target
    pass
simp = json.load(open(sys.argv[4], encoding='utf8'))['quran']
Q = QT(); Q.keys = [(v['chapter'], v['verse']) for v in simp]; Q.text = {(v['chapter'], v['verse']): lex.text(v['text']) for v in simp}
sk = [''.join(bench.skel(w) for w in bench.norm(v['text']).split()) for v in simp]
tri = collections.defaultdict(set)
for i, s in enumerate(sk):
    for k in range(len(s) - 2): tri[s[k:k + 3]].add(i)
res, t0 = {}, time.time()
for r in rows:
    if 'skip' in r or r['id'] in ex: continue
    z = np.load(os.path.join(lpd, r['id'] + '.npz')); lps = [z[k] for k in z.files]
    truth = {Q.text[tuple(a)] for a in r['ayat']}
    h = ''.join(bench.skel(w) for w in bench.norm(r['hyp']).split())
    cnt = collections.Counter()
    for k in range(len(h) - 2):
        for i in tri.get(h[k:k + 3], ()): cnt[i] += 1
    top = [i for i, _ in cnt.most_common(N)]
    if not lps or not top: res[r['id']] = (r['set'], False, r['id_ok']); continue
    keys = [Q.keys[j] for i in top for j in (i - 1, i, i + 1) if 0 <= j < len(Q.keys)]
    s, own = ctc.cand_text(Q, keys); tg = ctc.Target(lex, s)
    G, stay, mx = lex.group(np.concatenate(lps))
    sc, a, b = ctc.local_align(G, stay, mx, tg, g)
    o = own[a:max(b, a + 1)]; o = o[o >= 0]; k = Q.keys[int(np.bincount(o).argmax())] if len(o) else None
    res[r['id']] = (r['set'], k is not None and Q.text[k] in truth, r['id_ok'], k, a, b, len(s))
    if len(res) % 50 == 0: print(len(res), '%.0f s' % (time.time() - t0), flush=True)
for st in ['ha', 'tlog', 'reciters', 'ALL']:
    R = [v for v in res.values() if st == 'ALL' or v[0] == st]
    print(st, len(R), 'ctc id %.1f' % (100 * sum(v[1] for v in R) / len(R)), 'old id %.1f' % (100 * sum(v[2] for v in R) / len(R)),
          'ctc-only %d old-only %d' % (sum(v[1] and not v[2] for v in R), sum(v[2] and not v[1] for v in R)), flush=True)
print('sec %.0f' % (time.time() - t0))
json.dump(res, open(sys.argv[1].replace('.json', '-ctcidc-g%s-n%d.json' % (g, N)), 'w', encoding='utf8'), ensure_ascii=False)
