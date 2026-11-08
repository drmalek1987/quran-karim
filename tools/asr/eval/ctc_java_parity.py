# Exports cases for CtcTest.java (android/src/.../Ctc.java vs ctc.forced_words): token forms, then per case the piece
# log-probs, the unit letters and Python's matched flags. Usage: python -I ctc_java_parity.py <lp dir> <model.json>
#   <quran_words.json> <quran-simple-search.json> rows-<tag>.json <out.txt> [n]
import sys, os, json, random, tempfile, shutil
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
A = sys.argv
_t = os.path.join(tempfile.mkdtemp(), 'rows.json'); shutil.copy(A[5], _t)
sys.argv = [A[0], _t, A[1], A[2], A[3], A[4], '-', '3', '4', '1']
import p1b_verify as V, ctc
n = int(A[7]) if len(A) > 7 else 60
rows = [r for r in json.load(open(A[5], encoding='utf8')) if 'skip' not in r]
random.Random(5).shuffle(rows)
out = open(A[6], 'w', encoding='utf8'); vocab = json.load(open(A[2], encoding='utf8'))['vocab']
out.write('%d\n' % len(vocab))
for t in vocab: out.write(V.bench.norm(t.replace('▁', ' ')).replace(' ', '') + '\n')
cases = []; rnd = random.Random(2)
for r in rows:
    p0 = V.span_of(r)
    if p0 is None: continue
    z = np.load(os.path.join(A[1], r['id'] + '.npz')); lps = [z[k] for k in z.files]
    if not lps: continue
    lp = lps[0].astype(np.float32); us = []
    for k in range(len(r['pos'])):
        t = V.unit_at(p0 + k)[0]
        if not us or us[-1] != t: us.append(t)
    if rnd.random() < 0.5 and len(us) > 2:                    # some negatives: one unit swapped for another ayah's
        us[rnd.randrange(len(us))] = V.unit_at(rnd.randrange(len(V.fk)))[0] or us[0]
    G, stay, mx = V.lex.group(lp); res = ctc.forced_words(G, stay, mx, V.lex, us, 3.0, 4.0)
    out.write('%d %d\n' % lp.shape)
    for row in lp: out.write(' '.join('%.6g' % x for x in row) + '\n')
    out.write('|'.join(us) + '\n' + ''.join('0' if x is None else '1' for x in res) + '\n')
    best = ctc.best_score(G, stay, mx, V.lex, us, 3.0, 4.0)                 # S6 margins (-1 = matched)
    out.write(' '.join('-1' if x is not None else '%.4f' % (best - ctc.best_score(G, stay, mx, V.lex, us, 3.0, 4.0, no_skip=i)) for i, x in enumerate(res)) + '\n')
    cases.append(1)
    if len(cases) >= n: break
print('cases', len(cases))
