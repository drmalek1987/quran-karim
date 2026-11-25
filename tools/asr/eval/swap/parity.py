# JS strict rSame == Python strict rsame on random Quran-skeleton pairs (+ swapped variants). Run: ml-env python -X utf8 -I parity.py
import sys, os, json, random, subprocess, tempfile
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H); sys.path.insert(0, os.path.dirname(H))
import bench, strict
q = json.load(open('D:/Quran App/qtrain/eval/quran_words.json', encoding='utf8'))
W = sorted({bench.skel(w) for x in q for w in x['k']} - {''}) if isinstance(q, list) else None
rnd = random.Random(7); L = 'ضدصسحهقكذزثظطت'; P = []
for _ in range(20000):
    a = rnd.choice(W); b = a
    r = rnd.random()
    if r < .6 and a:
        i = rnd.randrange(len(a)); b = a[:i] + rnd.choice(L) + a[i + 1:]
    elif r < .8: b = rnd.choice(W)
    else: i = rnd.randrange(len(a) + 1); b = a[:i] + rnd.choice(L) + a[i:]
    P.append((a, b))
tmp = tempfile.mkdtemp(); pf, of = tmp + '/p.json', tmp + '/o.json'; json.dump(P, open(pf, 'w', encoding='utf8'), ensure_ascii=False)
for v, conf in strict.VARIANTS.items():
    subprocess.run(['node', H + '/rlocal_spans_swap.js', 'D:/Quran App/quran-karim/web/app.js', pf, of, v, 'parity'], check=True)
    js = json.load(open(of)); f = strict.make_rsame(conf); py = [f(a, b) for a, b in P]
    nb = sum(bench.rsame(a, b) != x for (a, b), x in zip(P, py))
    print(v, 'js==py', all(x == y for x, y in zip(js, py)), 'mismatch', sum(x != y for x, y in zip(js, py)), 'rsame-flips-vs-bench', nb, 'true', sum(py))
