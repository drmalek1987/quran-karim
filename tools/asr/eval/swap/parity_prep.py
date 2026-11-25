# Writes a copy of the v5 rows whose pos/neg are bench.recite_dp verdicts with the strict P8 rsame (strict.py = twin of app.js rSim),
# for: node ../parity.js web/app.js <out>  (must say diff 0). Does not touch bench.py.
import sys, os, json
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H); sys.path.insert(0, os.path.dirname(H))
import bench, strict
bench.rsame = strict.make_rsame(strict.VARIANTS[sys.argv[3] if len(sys.argv) > 3 else 'P8'])
rows = [r for r in json.load(open(sys.argv[1], encoding='utf8')) if 'skip' not in r]
for r in rows:
    E = [bench.skel(w) for w in r['exp'].split()]; N = list(E); N[r['neg_j']] = r['neg_w']
    r['pos'] = bench.recite_dp(r["piece_texts"], E, ins=1.0); r['neg'] = bench.recite_dp(r["piece_texts"], N, ins=1.0)
json.dump(rows, open(sys.argv[2], 'w', encoding='utf8'), ensure_ascii=False)
