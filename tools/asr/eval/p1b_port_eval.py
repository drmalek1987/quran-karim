# P1b-port check: the app's hybrid — rLocal places each final piece (on the greedy text), then CTC forced alignment of the
# words in that piece's span on that piece's log-probs re-judges them. Same clips/negatives as p1b_verify.py.
# Usage: python -I p1b_port_eval.py rows-<tag>.json <lp dir> <model.json> <quran_words.json> <quran-simple-search.json>
#                                   <app.js> [exclude_ids.json|-] [g] [d]
import sys, os, json, random, subprocess, tempfile, shutil
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
A = sys.argv
_t = os.path.join(tempfile.mkdtemp(), 'rows.json'); shutil.copy(A[1], _t)   # p1b_verify writes its dump beside its input
sys.argv = [A[0], _t, A[2], A[3], A[4], A[5], A[7] if len(A) > 7 else '-', '3', '4', '1']
import p1b_verify as V          # reuses its units()/negatives (runs one clip on import; harmless)
import bench, ctc
rows = json.load(open(A[1], encoding='utf8')); lpd = A[2]; appjs = A[6]
ex = set(json.load(open(A[7]))) if len(A) > 7 and A[7] != '-' else set()
g = float(A[8]) if len(A) > 8 else 3.0; d = float(A[9]) if len(A) > 9 else 4.0
lex = V.lex; fk = V.fk; ay = V.ay; flat = V.flat
fw = [ay[i]['w'][j] for i, j in flat]
rnd = random.Random(1); jobs, meta = [], []
for r in rows:
    if 'skip' in r or r['id'] in ex: continue
    p0 = V.span_of(r)
    if p0 is None: continue
    nE = len(r['pos']); j = r['neg_j']
    while True:
        q = rnd.randrange(len(fk)); w = fk[q]
        if abs(len(w) - len(fk[p0 + j])) <= 1 and len(w) >= 2 and not bench.rsame(w, fk[p0 + j]) and V.unit_at(q)[0]: break
    z = np.load(os.path.join(lpd, r['id'] + '.npz')); lps = [z[k] for k in z.files]
    if len(lps) != len(r['piece_texts']): print('pieces?', r['id'], len(lps), len(r['piece_texts'])); continue
    for name, swap in (('pos', False), ('neg', True)):
        idxs = [q if (swap and k == j) else p0 + k for k in range(nE)]
        jobs.append({'H': r['piece_texts'], 'E': [fw[x] for x in idxs]})
        meta.append((r, name, idxs, lps, j))
tmp = tempfile.mkdtemp(); jf, of = os.path.join(tmp, 'j.json'), os.path.join(tmp, 'o.json')
json.dump(jobs, open(jf, 'w', encoding='utf8'), ensure_ascii=False)
subprocess.run(['node', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rlocal_spans.js'), appjs, jf, of], check=True)
spans = json.load(open(of, encoding='utf8'))

def units_for(idxs, a, b):
    """Units (simple letters) for words idxs[a:b]; consecutive words of one group share a unit. -> (units, owner)"""
    us, own, prev = [], [], None
    for k in range(a, b):
        t, gid = V.unit_at(idxs[k]); key = (flat[idxs[k]][0], gid)
        if prev == key and k > a and idxs[k] == idxs[k - 1] + 1: own.append(own[-1]); continue
        us.append(t); own.append(len(us) - 1); prev = key
    return us, own

G_cache = {}
def run(variant):
    res = {}
    for (r, name, idxs, lps, j), sp in zip(meta, spans):
        n = len(idxs); Vd = {}
        for pi, s in enumerate(sp):
            if s is None: continue
            v = {int(k): x for k, x in s['v'].items()}
            if variant != 'rlocal':
                a, b = s['a'], s['b']
                if variant in ('ctc_pm1', 'ctc_up_pm1'): a, b = max(0, a - 1), min(n, b + 1)
                us, own = units_for(idxs, a, b)
                key = (id(lps), pi)
                if key not in G_cache: G_cache[key] = lex.group(lps[pi].astype(np.float32))
                Gm, stay, mx = G_cache[key]
                fr = ctc.forced_words(Gm, stay, mx, lex, us, g, d)
                for k in range(a, b):
                    ok = 1 if fr[own[k - a]] is not None else 0
                    inside = s['a'] <= k < s['b']
                    if variant.startswith('ctc_up'): v[k] = max(v.get(k, 0), ok) if inside else v.get(k)
                    elif inside: v[k] = ok
                    elif ok: v[k] = 1                     # edge word outside the span: only turns right
                v = {k: x for k, x in v.items() if x is not None}
            Vd.update(v)
        res.setdefault(r['set'], []).append((name, j, [Vd.get(k) == 1 for k in range(n)]))
    out = {}
    for s in sorted(res) + ['ALL']:
        R = [x for k, L in res.items() if s in (k, 'ALL') for x in L]
        pw = [ok for name, j, vs in R if name == 'pos' for ok in vs]; nw = [not vs[j] for name, j, vs in R if name == 'neg']
        out[s] = {'verify': round(100 * (sum(pw) + sum(nw)) / (len(pw) + len(nw)), 1),
                  'right_acc': round(100 * sum(pw) / len(pw), 1), 'wrong_caught': round(100 * sum(nw) / len(nw), 1)}
    return out
for variant in os.environ.get('VARIANTS', 'rlocal ctc ctc_up ctc_pm1 ctc_up_pm1').split():
    print(variant, json.dumps(run(variant)), flush=True)
