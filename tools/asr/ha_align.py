# Labels HA's recording: walks the pieces in order along the known text (Fatiha, Al Imran, Nisa, Maida, An'am),
# finds each confident piece's words in a window ahead of the last anchor, and fills the pieces between two
# anchors with the words in between. Writes ha/labels.json [{a,b,ref,s,a0,conf}].
import json, re, difflib, sys
sys.path.insert(0, __file__.rsplit('/', 1)[0])
D = __file__.rsplit('/', 2)[0]
TASHKEEL = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]')
def norm(t):
    t = TASHKEEL.sub('', t); t = re.sub('[ٱأإآ]', 'ا', t); t = re.sub('[ىی]', 'ي', t)
    t = t.replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي'); t = re.sub('[^ء-ي ]', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()
Q = json.loads(open('/mnt/project-files/quran-app/web/quran-data.js', encoding='utf8').read().split('=', 1)[1].rstrip().rstrip(';'))['q']
W, WA = [], []
for s in (1, 3, 4, 5, 6):
    for a, t in enumerate(Q[s - 1]):
        for w in norm(t).split(): W.append(w); WA.append((s, a + 1))
segs = json.load(open(D + '/ha/segs-small.json'))
ptr, out = 0, []
for g in segs:
    h = norm(g['hyp']).split()
    best = (0, None)
    if len(h) >= 3:
        lo, hi = max(0, ptr - 30), min(len(W), ptr + 600)
        for i in range(lo, hi - len(h) + 1):
            r = difflib.SequenceMatcher(None, ' '.join(h), ' '.join(W[i:i + len(h)])).ratio()
            if r > best[0]: best = (r, i)
    g = dict(g)
    if best[0] >= 0.75: g['i0'], g['i1'] = best[1], best[1] + len(h); ptr = g['i1']
    g['conf'] = round(best[0], 2); out.append(g)
# fill pieces between two anchors with the words between them, in proportion to their duration
anch = [k for k, g in enumerate(out) if 'i0' in g]
for x, y in zip(anch, anch[1:]):
    gap = out[x + 1:y]; e0, s1 = out[x]['i1'], out[y]['i0']
    if not gap or s1 <= e0 or s1 - e0 > 400: continue
    tot = sum(g['b'] - g['a'] for g in gap); c = e0
    for g in gap:
        n = round((s1 - e0) * (g['b'] - g['a']) / tot); g['i0'], g['i1'], g['fill'] = c, c + n, 1; c += n
lab = []
for g in out:
    if 'i0' in g and g['i1'] > g['i0']:
        lab.append(dict(a=g['a'], b=g['b'], ref=' '.join(W[g['i0']:g['i1']]), s=WA[g['i0']][0], ay=WA[g['i0']][1], fill=g.get('fill', 0), conf=g['conf']))
json.dump(lab, open(D + '/ha/labels.json', 'w'), ensure_ascii=False)
print('pieces', len(out), 'anchors', len(anch), 'labelled', len(lab), 'filled', sum(l['fill'] for l in lab), 'words covered', sum(len(l['ref'].split()) for l in lab), 'of', len(W))
print('last', lab[-1]['s'], lab[-1]['ay'])
