# Re-judges a bench run's cached heard pieces with another matcher, without running the model again.
# Usage: python -I rescore.py rows.json <matcher: app|dp> [ins] [exclude_ids.json]
import sys, json, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bench
rows = json.load(open(sys.argv[1], encoding='utf8')); kind = sys.argv[2]; ins = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
ex = set(json.load(open(sys.argv[4]))) if len(sys.argv) > 4 else set()
f = (lambda p, e: bench.recite(p, e)) if kind == 'app' else (lambda p, e: bench.recite_dp(p, e, ins))
out = []
for r in rows:
    if 'skip' in r or r['id'] in ex: continue
    exp = [bench.skel(w) for w in r['exp'].split(' ')]
    if len(exp) != len(r['pos']): continue
    neg = exp[:r['neg_j']] + [r['neg_w']] + exp[r['neg_j'] + 1:]
    r = dict(r, pos=f(r['piece_texts'], exp), neg=f(r['piece_texts'], neg)); out.append(r)
s = bench.summarize(out)
json.dump(out, open(sys.argv[1].replace('.json', '-%s%s.json' % (kind, ins if kind == 'dp' else '')), 'w', encoding='utf8'), ensure_ascii=False)
for k, v in s.items(): print(k, {x: v[x] for x in ('clips', 'word_accept_correct_%', 'wrong_word_caught_%', 'verify_acc_%', 'clip_perfect_%')})
