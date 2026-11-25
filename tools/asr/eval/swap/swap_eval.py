# Sprint 5b B experiment: rsame (base) vs rsame_strict (P4 / P8) x CTC rescue (ctc_up + "unsure" margin<1.0), on the shipped
# model v5 (G10d_f1s9w5) bench rows + log-probs. Pipeline = p1b_port_eval.py (rLocal from app.js piece by piece, then ctc_up forced
# alignment) + s6_calib.py margins. Never edits web/ or the bench defaults.
# Stage 1 (main): jobs -> node rlocal_spans_swap.js per variant. Stage 2 (pool, per clip): forced alignment + margins.
# Output: per-job raw records (json); swap_report.py turns them into tables.
# Usage: py -3.11 -X utf8 -I swap_eval.py <rows-s.json> <lp dir> <model.json> <quran_words.json> <quran-simple-search.json> <app.js> <out.json> [--limit N] [--workers N]
import sys, os, json, random, subprocess, tempfile, hashlib, collections, pickle, time
H = os.path.dirname(os.path.abspath(__file__)); EV = os.path.dirname(H); sys.path.insert(0, H); sys.path.insert(0, EV)
import numpy as np
A = list(sys.argv[1:])
def opt(name, d):
    if name in A:
        i = A.index(name); v = A[i + 1]; del A[i:i + 2]; return type(d)(v)
    return d
LIMIT = opt('--limit', 0); WORKERS = opt('--workers', 10)
ROWS, LPD, MODEL, QW, SIMP, APPJS, OUT = A[:7]
NM = 'D:/Quran App/qtrain/deban/p4/nm_items.json'
CONFUSE = {'P4': ('ضد', 'صس', 'حه', 'قك'), 'P8x': ('ذز', 'ثس', 'ظض', 'طت')}
VAR = ['base', 'P4', 'P8', 'app']   # app = the real web/app.js code (strict P8 + no rescue of pair-swap reds)
G = {}   # per-process globals

def setup():
    if G: return
    import p1b_verify_hack
    G.update(p1b_verify_hack.load(ROWS, LPD, MODEL, QW, SIMP))

def edit_ops(w, nm):
    m, n = len(w), len(nm); d = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1): d[i][0] = i
    for j in range(n + 1): d[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1): d[i][j] = min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (w[i-1] != nm[j-1]))
    ops, i, j = [], m, n
    while i or j:
        if i and j and d[i][j] == d[i-1][j-1] + (w[i-1] != nm[j-1]): ops.append(('m' if w[i-1] == nm[j-1] else 's', i - 1, nm[j-1])); i -= 1; j -= 1
        elif i and d[i][j] == d[i-1][j] + 1: ops.append(('d', i - 1, None)); i -= 1
        else: ops.append(('i', i, nm[j-1])); j -= 1
    return ops[::-1]

def unit_edit(t, w, nm):
    """The unit text t (simple spelling, letters incl. vowel letters) with the skeleton edit w -> nm applied; None if skel(t) != w."""
    pos = [i for i, ch in enumerate(t) if ch not in 'اءؤئوي']
    if ''.join(t[i] for i in pos) != w: return None
    out, cur = [], 0; ins = collections.defaultdict(list); rep = {}; dele = set()
    for op, i, ch in edit_ops(w, nm):
        if op == 's': rep[i] = ch
        elif op == 'd': dele.add(i)
        elif op == 'i': ins[i].append(ch)
    for si in range(len(w) + 1):
        stop = pos[si] if si < len(w) else len(t)
        out.append(t[cur:stop]); cur = stop
        out.extend(ins.get(si, []))
        if si < len(w):
            if si not in dele: out.append(rep.get(si, t[pos[si]]))
            cur = pos[si] + 1
    return ''.join(out)

def pair_class(w, nm):
    ops = [o for o in edit_ops(w, nm) if o[0] != 'm']
    if len(ops) == 1 and ops[0][0] == 's':
        a, b = w[ops[0][1]], ops[0][2]
        for k, ps in CONFUSE.items():
            if a + b in ps or b + a in ps: return k
        return 'other1'
    return 'other'

def units_for(idxs, over, a, b):
    V = G['V']; us, own, prev = [], [], None
    for k in range(a, b):
        if k in over: us.append(over[k]); own.append(len(us) - 1); prev = None; continue
        t, gid = V.unit_at(idxs[k]); key = (V.flat[idxs[k]][0], gid)
        if prev == key and k > a and idxs[k] == idxs[k - 1] + 1 and (k - 1) not in over: own.append(own[-1]); continue
        us.append(t); own.append(len(us) - 1); prev = key
    return us, own

def work(task):
    import ctc
    setup()
    rid, jobs = task; lex = G['lex']; gd, dd = 3.0, 4.0
    z = np.load(os.path.join(LPD, rid + '.npz')); lps = [z[k] for k in z.files]
    Gc, FR, MG = {}, {}, {}
    res = []
    for (ji, idxs, over, spans) in jobs:      # spans: {variant: [per piece]}
        n = len(idxs); rec = {}
        for var in VAR:
            Vr, Vd, M = {}, {}, {}
            for pi, s in enumerate(spans[var]):
                if s is None: continue
                v = {int(k): x for k, x in s['v'].items() if x is not None}; Vr.update(v)
                a, b = s['a'], s['b']; us, own = units_for(idxs, over, a, b)
                if pi not in Gc: Gc[pi] = lex.group(lps[pi].astype(np.float32))
                Gm, stay, mx = Gc[pi]; key = (pi, tuple(us))
                if key not in FR: FR[key] = ctc.forced_words(Gm, stay, mx, lex, us, gd, dd)
                fr = FR[key]
                swk = {int(x) for x in (s.get('sw') or {})}
                for k in range(a, b):
                    if k in swk and v.get(k, 0) == 0: continue          # app: a pair-swap red is never rescued nor unsure
                    ok = 1 if fr[own[k - a]] is not None else 0; v[k] = max(v.get(k, 0), ok)
                    if v[k] == 0:
                        mk = key + (own[k - a],)
                        if mk not in MG:
                            if (key, 'best') not in MG: MG[(key, 'best')] = ctc.best_score(Gm, stay, mx, lex, us, gd, dd)
                            MG[mk] = MG[(key, 'best')] - ctc.best_score(Gm, stay, mx, lex, us, gd, dd, no_skip=own[k - a])
                        M[k] = MG[mk]
                Vd.update(v)
            rec[var] = {'rl': [Vr.get(k) for k in range(n)], 'cu': [Vd.get(k) for k in range(n)], 'M': {k: M[k] for k in M}}
        res.append((ji, rec))
    return rid, res

def main():
    setup(); V = G['V']; import bench
    rows = json.load(open(ROWS, encoding='utf8')); fk = V.fk; fw = G['fw']
    nm_items = [i for i in json.load(open(NM, encoding='utf8')) if i['split'] == 'test']
    nm_by = collections.defaultdict(list)
    for i in nm_items: nm_by[i['id']].append(i)
    rnd = random.Random(1); rs = random.Random(5); meta = []
    lens = {'nm_w_mismatch': 0, 'nm_unit_nomap': 0}; ntmpl = 0
    for r in rows:
        if 'skip' in r: continue
        p0 = V.span_of(r)
        if p0 is None: continue
        if LIMIT and ntmpl >= LIMIT: break
        nE = len(r['pos']); j = r['neg_j']
        for tries in range(50000):
            q = rnd.randrange(len(fk)); w = fk[q]
            if abs(len(w) - len(fk[p0 + j])) <= (1 if tries < 20000 else 3) and len(w) >= 2 and not bench.rsame(w, fk[p0 + j]) and V.unit_at(q)[0]: break
        else: continue
        if not os.path.exists(os.path.join(LPD, r['id'] + '.npz')): continue
        ntmpl += 1
        base = [p0 + k for k in range(nE)]; Eb = [fw[x] for x in base]
        meta.append(dict(row=r, kind='pos', j=j, idxs=base, over={}, E=Eb))
        idn = list(base); idn[j] = q; meta.append(dict(row=r, kind='neg', j=j, idxs=idn, over={}, E=[fw[x] for x in idn]))
        ex = r['exp'].split(); sp = 'dev' if int(hashlib.md5(r['id'].encode()).hexdigest(), 16) % 2 == 0 else 'test'
        for it in nm_by.get(r['id'], []):
            jj = it['j']
            if len(ex) != nE or bench.skel(ex[jj]) != it['w']: lens['nm_w_mismatch'] += 1; continue
            E = list(Eb); E[jj] = it['nm']; t = V.unit_at(base[jj])[0]; u = unit_edit(t, it['w'], it['nm'])
            if u is None: lens['nm_unit_nomap'] += 1; continue
            meta.append(dict(row=r, kind='nm', j=jj, idxs=base, over={jj: u}, E=E, item=dict(it, cls=pair_class(it['w'], it['nm']))))
        if sp == 'test' and r['set'] != 'ho_retasy_wrong':          # NEW accepted-by-baseline one-letter swap items (test clips only)
            order = list(range(nE)); rs.shuffle(order); k = 0
            for jj in order:
                if k >= 3: break
                w = bench.skel(ex[jj]) if len(ex) == nE else None
                if not w or len(w) < 3: continue
                C = []
                for pr in CONFUSE['P4'] + CONFUSE['P8x']:
                    for x, y in ((pr[0], pr[1]), (pr[1], pr[0])):
                        for ii, ch in enumerate(w):
                            if ch == x:
                                c = w[:ii] + y + w[ii + 1:]
                                if c != w and bench.rsame(c, w): C.append((c, pr))
                if not C: continue
                c, pr = C[rs.randrange(len(C))]
                t = V.unit_at(base[jj])[0]; u = unit_edit(t, w, c)
                if u is None: lens['nm_unit_nomap'] += 1; continue
                E = list(Eb); E[jj] = c
                meta.append(dict(row=r, kind='sw', j=jj, idxs=base, over={jj: u}, E=E, item={'id': r['id'], 'set': r['set'], 'j': jj, 'w': w, 'nm': c, 'cls': 'P4' if pr in CONFUSE['P4'] else 'P8x', 'split': 'test'})); k += 1
    print('jobs', len(meta), dict(collections.Counter(m['kind'] for m in meta)), lens, flush=True)
    tmp = tempfile.mkdtemp(); jf = os.path.join(tmp, 'j.json')
    json.dump([{'H': m['row']['piece_texts'], 'E': m['E']} for m in meta], open(jf, 'w', encoding='utf8'), ensure_ascii=False)
    SP = {}
    for var in VAR:
        of = os.path.join(tmp, 'o_%s.json' % var)
        subprocess.run(['node', os.path.join(H, 'rlocal_spans_swap.js'), APPJS, jf, of, var], check=True); SP[var] = json.load(open(of, encoding='utf8'))
    tasks = collections.OrderedDict()
    for ji, m in enumerate(meta): tasks.setdefault(m['row']['id'], []).append((ji, m['idxs'], m['over'], {v: SP[v][ji] for v in VAR}))
    ck = OUT + '.part'; done = pickle.load(open(ck, 'rb')) if os.path.exists(ck) else {}
    todo = [(rid, js) for rid, js in tasks.items() if rid not in done]; print('clips', len(tasks), 'todo', len(todo), flush=True)
    import multiprocessing as mp; t0 = time.time()
    with mp.Pool(WORKERS) as pool:
        for c, (rid, res) in enumerate(pool.imap_unordered(work, todo, chunksize=1)):
            done[rid] = res
            if c % 50 == 0: pickle.dump(done, open(ck, 'wb')); print('..', c, len(todo), int(time.time() - t0), 's', flush=True)
    pickle.dump(done, open(ck, 'wb'))
    byj = {}
    for rid, res in done.items():
        for ji, rec in res: byj[ji] = rec
    out = [{'id': m['row']['id'], 'set': m['row']['set'], 'kind': m['kind'], 'j': m['j'], 'n': len(m['idxs']), 'item': m.get('item'), 'rec': byj[ji]}
           for ji, m in enumerate(meta) if ji in byj]
    json.dump(out, open(OUT, 'w'), ensure_ascii=False); print('wrote', OUT, len(out))

if __name__ == '__main__': main()
