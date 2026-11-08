# S6 calibration: for every word still red after the app's hybrid (rLocal + CTC ctc_up), its CTC margin
# (ctc.best_score - best_score with that word forced read). pos rows: red = false red; neg row word j red = true catch.
# Prints, per threshold m, how many false reds turn «مش متأكد» and how many true catches are lost.
# Usage: same args as p1b_port_eval.py  [--every N]
import sys, os, json
os.environ['VARIANTS'] = ''
EV = int(sys.argv[sys.argv.index('--every') + 1]) if '--every' in sys.argv else 1
sys.argv = [a for a in sys.argv if a not in ('--every', str(EV))]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, p1b_port_eval as P, ctc
fr_m, tc_m, per_set = [], [], {}
for ji, ((r, name, idxs, lps, j), sp) in enumerate(zip(P.meta, P.spans)):
    if (ji // 2) % EV: continue
    n = len(idxs); Vd, M = {}, {}
    for pi, s in enumerate(sp):
        if s is None: continue
        v = {int(k): x for k, x in s['v'].items()}; a, b = s['a'], s['b']
        us, own = P.units_for(idxs, a, b)
        key = (id(lps), pi)
        if key not in P.G_cache: P.G_cache[key] = P.lex.group(lps[pi].astype(np.float32))
        Gm, stay, mx = P.G_cache[key]
        fr = ctc.forced_words(Gm, stay, mx, P.lex, us, P.g, P.d); best = None
        for k in range(a, b):
            ok = 1 if fr[own[k - a]] is not None else 0; v[k] = max(v.get(k, 0), ok)
            if v[k] == 0:
                if best is None: best = ctc.best_score(Gm, stay, mx, P.lex, us, P.g, P.d)
                M[k] = best - ctc.best_score(Gm, stay, mx, P.lex, us, P.g, P.d, no_skip=own[k - a])
        Vd.update(v)
    for k in range(n):
        if Vd.get(k) == 1 or k not in M: continue
        (tc_m if (name == 'neg' and k == j) else fr_m).append(M[k]); per_set.setdefault(r['set'], []).append((name == 'neg' and k == j, M[k]))
    if ji % 200 == 0: print('..', ji, len(P.meta), flush=True)
fr_m, tc_m = np.array(fr_m), np.array(tc_m)
nneg = sum(1 for m in P.meta if m[1] == 'neg') // EV
print(json.dumps({'false_red': len(fr_m), 'true_catch_red': len(tc_m), 'neg_rows': nneg}))
for th in (0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8):
    print('m<%.1f: false reds -> unsure %d (%.1f%%), true catches lost %d (%.1f%% of neg)' % (
        th, (fr_m < th).sum(), 100 * (fr_m < th).mean(), (tc_m < th).sum(), 100 * (tc_m < th).sum() / max(1, nneg)))
json.dump({'fr': fr_m.tolist(), 'tc': tc_m.tolist(), 'sets': per_set}, open(os.path.join(os.environ.get('TEMP', '.'), 's6_margins.json'), 'w'))
