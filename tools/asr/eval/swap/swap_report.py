# Tables from swap_eval.py raw records (+ python recite columns). Usage: py -3.11 -X utf8 -I swap_report.py full.json <rows-s.json>
import sys, os, json, collections
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H); sys.path.insert(0, os.path.dirname(H))
import bench, strict
R = json.load(open(sys.argv[1], encoding='utf8')); rows = {r['id']: r for r in json.load(open(sys.argv[2], encoding='utf8')) if 'skip' not in r}
VAR = ['base', 'P4', 'P8', 'app']; U = 1.0
def pct(a, b): return '%.1f' % (100 * a / b) if b else '-'
def status(rec, k, mode):
    """right / unsure / wrong / None (unreached counts as wrong, p1b convention)"""
    if mode == 'rl': return 'R' if rec['rl'][k] == 1 else 'W'
    if rec['cu'][k] == 1: return 'R'
    m = rec['M'].get(str(k), rec['M'].get(k))
    return 'U' if (m is not None and m < U) else 'W'
MODES = [('recite', 'recite() no CTC (bench.py)'), ('rl', 'rLocal no CTC'), ('cu', 'rLocal + CTC ctc_up'), ('cuU', 'ctc_up + unsure')]
def verdict(r, var, mode):
    """-> list of statuses for word j or all words"""
    return None
out = []
def P(s=''): out.append(s); print(s)
# --- standard bench: pos (false red) and neg (wrong_word_caught) ---
P('### Standard bench (p1b negatives, phone pipeline, %d clips)' % sum(1 for x in R if x['kind'] == 'pos'))
P('| rsame | matcher | right words judged right % | false red % (wrong or unsure) | false red hard % | neg word caught % (wrong or unsure) | neg caught hard % |')
P('|---|---|---|---|---|---|---|')
for var in VAR:
    conf = strict.VARIANTS.get(var, strict.VARIANTS['P8']); rs = strict.make_rsame(conf); bench.rsame = rs
    for mode, name in MODES:
        ok = tot = fred = hard = ncau = nhard = nn = 0
        for x in R:
            if x['kind'] not in ('pos', 'neg'): continue
            r = rows[x['id']]
            if mode == 'recite':
                ex = [bench.skel(w) for w in r['exp'].split()]
                if x['kind'] == 'pos': v = bench.recite(r['piece_texts'], ex); tot += len(v); ok += sum(t == 1 for t in v)
                else:
                    ne = list(ex); ne[r['neg_j']] = r['neg_w']; v = bench.recite(r['piece_texts'], ne)[r['neg_j']]; nn += 1; ncau += v == 0; nhard += v == 0
                continue
            rec = x['rec'][var]; m = 'rl' if mode == 'rl' else 'cu'
            if x['kind'] == 'pos':
                for k in range(x['n']):
                    s = status(rec, k, m) if mode != 'cu' else ('R' if rec['cu'][k] == 1 else 'W')
                    tot += 1; ok += s == 'R'; hard += s == 'W'
            else:
                s = status(rec, x['j'], m) if mode != 'cu' else ('R' if rec['cu'][x['j']] == 1 else 'W')
                nn += 1; ncau += s != 'R'; nhard += s == 'W'
        if mode == 'recite': P('| %s | %s | %s | %s | %s | %s | %s |' % (var, name, pct(ok, tot), pct(tot - ok, tot), '-', pct(ncau, nn), '-'))
        elif mode == 'cuU': P('| %s | %s | %s | %s | %s | %s | %s |' % (var, name, pct(ok, tot), pct(tot - ok, tot), pct(hard, tot), pct(ncau, nn), pct(nhard, nn)))
        else: P('| %s | %s | %s | %s | %s | %s | %s |' % (var, name, pct(ok, tot), pct(tot - ok, tot), pct(tot - ok, tot), pct(ncau, nn), pct(ncau, nn)))
bench.rsame = bench.rsame  # (patched above; fine, script ends)
# --- near-miss items ---
def nm_table(kind, title, groups):
    P(); P('### ' + title)
    P('| group | n | ' + ' | '.join('%s %s' % (v, n.split(' (')[0]) for v in VAR for n in ('recite', 'rLocal', 'ctc_up', 'ctc_up+unsure(hard)')) + ' |')
    P('|---|---|' + '---|' * 12)
    items = [x for x in R if x['kind'] == kind]
    for gname, f in groups:
        S = [x for x in items if f(x['item'])]
        if not S: continue
        cells = []
        for var in VAR:
            rs = strict.make_rsame(strict.VARIANTS.get(var, strict.VARIANTS['P8'])); bench.rsame = rs
            c = {'recite': 0, 'rl': 0, 'cu': 0, 'cuU': 0}
            for x in S:
                it = x['item']; r = rows[x['id']]; ex = [bench.skel(w) for w in r['exp'].split()]; ex[it['j']] = it['nm']
                c['recite'] += bench.recite(r['piece_texts'], ex)[it['j']] == 0
                rec = x['rec'][var]; j = it['j']
                c['rl'] += rec['rl'][j] != 1; c['cu'] += rec['cu'][j] != 1; c['cuU'] += status(rec, j, 'cu') != 'R'
            hard = sum(status(x['rec'][var], x['item']['j'], 'cu') == 'W' for x in S)
            cells += [pct(c['recite'], len(S)), pct(c['rl'], len(S)), pct(c['cu'], len(S)), '%s (%s)' % (pct(c['cuU'], len(S)), pct(hard, len(S)))]
        P('| %s | %d | %s |' % (gname, len(S), ' | '.join(cells)))
nm_table('nm', 'Near-miss TEST (nm_items.json split=test) - % caught (wrong or unsure)',
         [('ALL', lambda i: True), ('vocab', lambda i: i['kind'] == 'vocab'), ('one P4 pair', lambda i: i['cls'] == 'P4'), ('one P8-extra pair', lambda i: i['cls'] == 'P8x'), ('other one-sub', lambda i: i['cls'] == 'other1')])
nm_table('sw', 'NEW swap items (TEST clips; one-letter confusion swap in a 3+ letter word that baseline rSame ACCEPTS)',
         [('ALL', lambda i: True), ('P4 pairs', lambda i: i['cls'] == 'P4'), ('P8-extra pairs', lambda i: i['cls'] == 'P8x')] + [('set ' + s, (lambda s: lambda i: i['set'] == s)(s)) for s in sorted({x['set'] for x in R if x['kind'] == 'sw'})])
open(sys.argv[3] if len(sys.argv) > 3 else os.devnull, 'w', encoding='utf8').write('\n'.join(out))
