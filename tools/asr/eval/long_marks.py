# P3 CP2 (A9): read the user's listen marks. Prints precision per CURRENT level (clips.json 'level', CER levels) and
# writes extra_train.json = imam review pieces the user marked ✓ (untrimmed pieces; level by base CER
# L1 <=0.05 / L2 <=0.20 / L3 <=0.60, w=1). nv_train merges extra_train.json with clips.json train.
# Usage: python -I long_marks.py <long out dir>
import sys, os, json, glob, math, collections
od = sys.argv[1]
clips = {c['id']: c for c in json.load(open(os.path.join(od, 'clips.json'), encoding='utf8'))}
M = {}
for f in glob.glob(os.path.join(od, 'marks', 'marks-*.json')):
    M.update(json.load(open(f, encoding='utf8')))
lv = collections.defaultdict(collections.Counter)
for k, v in M.items():
    if k in clips: lv[clips[k]['level']][v] += 1
for L in sorted(lv):
    ok, n = lv[L][1], lv[L][1] + lv[L][0]
    lo = (0.05 ** (1 / n)) if ok == n else None  # one-sided 95% lower bound when no errors
    print('A9 %s: %d/%d ✓ = %.1f%%%s' % (L, ok, n, 100 * ok / n, ' (95%% low %.1f%%)' % (100 * lo) if lo else ''))
lvl = lambda c: 'L1' if c <= 0.05 else 'L2' if c <= 0.20 else 'L3' if c <= 0.60 else None
split = json.load(open(os.path.join(od, 'split.json'), encoding='utf8'))
ex = []
for base, s in split.items():
    if s['split'] != 'train': continue
    p = os.path.join(od, base + '.json')
    if not os.path.exists(p): continue
    for r in json.load(open(p, encoding='utf8')):
        if isinstance(r, dict) and M.get(r.get('id')) == 1 and r['id'] not in clips and lvl(r['cer']):
            ex.append({'id': r['id'], 'reader': s['reader'], 'file': base, 'dur': round(r['t1'] - r['t0'], 2),
                       'snr': r['snr'], 'text': r['text'], 'from': r['from'], 'to': r['to'], 'hyp': r['hyp'],
                       'cer': r['cer'], 'level': lvl(r['cer']), 'wav': r['wav'], 'split': 'train', 'w': 1.0, 'src': 'imam-ear'})
json.dump(ex, open(os.path.join(od, 'extra_train.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=0)
H = collections.Counter()
for c in ex: H[c['level']] += c['dur'] / 60
print('imam ✓ -> extra_train.json: %d clips, %.1f min' % (len(ex), sum(H.values())), {k: round(v, 1) for k, v in sorted(H.items())})
