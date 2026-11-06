# Recitation-mistake guard for long_pseudo.py labels: CTC forced alignment of the label's words on the piece's log-probs
# (ctc.forced_words). A piece goes to 'train' only if conf is high (CER <= 0.15), no word was skipped and every word's per-frame
# score is above WTH; otherwise 'review' (a possible reader mistake or a model error - a human decides).
# Usage: python -I long_wordcheck.py <long_pseudo out dir> <model.onnx> <model.json>
import sys, os, json
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bench, ctc
WTH = -1.5
od = sys.argv[1]; M = bench.Model(sys.argv[2], sys.argv[3]); lex = ctc.Lex(M.vocab)
tot = {'train': 0.0, 'review': 0.0}
for mf in sorted(f for f in os.listdir(od) if f.endswith('.json') and f not in ('noise.json', 'split.json')):
    rows = json.load(open(os.path.join(od, mf), encoding='utf8'))
    for r in rows:
        if 'id' not in r: continue
        y, _ = sf.read(r['wav'], dtype='float32')
        rr = float(np.sqrt((y * y).mean())) or 1e-9; g = 10 ** (-30 / 20) / rr
        if g > 1: y = np.clip(y * min(g, 30.0), -1, 1).astype(np.float32)
        G, stay, mx = lex.group(M.logprobs(y))
        ws = [lex.text(w) for w in r['text'].split()]
        fr = ctc.forced_words(G, stay, mx, lex, ws)
        sc = [None if f is None else round(f[0] / max(1, f[1]), 2) for f in fr]
        r['wscore'] = sc
        bad = [i for i, s in enumerate(sc) if s is None or s < WTH]
        r['bad_words'] = bad
        r['use'] = 'train' if r['conf'] == 'high' and not bad else 'review'
        tot[r['use']] += (r['t1'] - r['t0']) / 3600
    json.dump(rows, open(os.path.join(od, mf), 'w', encoding='utf8'), ensure_ascii=False, indent=0)
    print(mf.encode('unicode_escape').decode()[:30], {k: round(v, 2) for k, v in tot.items()}, flush=True)
