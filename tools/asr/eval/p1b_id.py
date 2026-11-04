# P1b ayah identification: Quran-constrained CTC search over the whole Quran, on log-probs cached by bench.py --dump.
# Usage: python -I p1b_id.py rows-<tag>.json <lp dir> <model.json> <quran-simple-search.json> [exclude_ids.json] [g]
import sys, os, json, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ctc

rows = json.load(open(sys.argv[1], encoding='utf8')); lpd = sys.argv[2]
vocab = json.load(open(sys.argv[3], encoding='utf8'))['vocab']
ex = set(json.load(open(sys.argv[5]))) if len(sys.argv) > 5 and sys.argv[5] != '-' else set()
g = float(sys.argv[6]) if len(sys.argv) > 6 else 3.0
lex = ctc.Lex(vocab); t0 = time.time(); Q = ctc.QuranText(lex, sys.argv[4])
print('quran letters', Q.tg.L, 'forms', lex.F, 'maxlen', lex.maxlen, '%.0f s' % (time.time() - t0), flush=True)
res, t0 = {}, time.time()
for r in rows:
    if 'skip' in r or r['id'] in ex: continue
    z = np.load(os.path.join(lpd, r['id'] + '.npz')); lps = [z[k] for k in z.files]
    truth = {Q.text[tuple(a)] for a in r['ayat']}
    if not lps: res[r['id']] = (r['set'], False, r['id_ok'], None); continue
    G, stay, mx = lex.group(np.concatenate(lps))
    sc, a, b = ctc.local_align(G, stay, mx, Q.tg, g)
    k = Q.ayah_of(a, b)
    res[r['id']] = (r['set'], k is not None and Q.text[k] in truth, r['id_ok'], k, sc, a, b)
    if len(res) % 50 == 0: print(len(res), '%.0f s' % (time.time() - t0), flush=True)
for s in ['ha', 'tlog', 'reciters', 'ALL']:
    R = [v for v in res.values() if s == 'ALL' or v[0] == s]
    print(s, len(R), 'ctc id %.1f' % (100 * sum(v[1] for v in R) / len(R)), 'old id %.1f' % (100 * sum(v[2] for v in R) / len(R)),
          'ctc-only %d old-only %d' % (sum(v[1] and not v[2] for v in R), sum(v[2] and not v[1] for v in R)))
json.dump(res, open(sys.argv[1].replace('.json', '-ctcid-g%s.json' % g), 'w', encoding='utf8'), ensure_ascii=False)
