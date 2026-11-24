# Speech-rate survey of every labelled clip we have (words per second of speech span = first..last voiced 100 ms block).
# Out: <work>/rates.json  [{id, wav, set, src, split, words, span_s, wps, label_src}]
# Labels: held-out sets carry (surah, ayah) from the repo data; long-recording clips carry the verified Uthmani text
# located in the Quran by the P3 pipeline (clips.json 'from'/'to'), never an ASR hypothesis.
import os, sys, json, numpy as np, soundfile as sf
ROOT = r'D:\Quran App'; QT = os.path.join(ROOT, 'qtrain'); W = os.path.join(QT, 'speedbench'); os.makedirs(W, exist_ok=True)
qw = json.load(open(os.path.join(QT, 'eval', 'quran_words.json'), encoding='utf8')); ix = {(x['s'], x['a']): x for x in qw}

def span(y, sr=16000):
    blk = sr // 10; n = len(y) // blk
    e = np.array([np.sqrt((y[i * blk:(i + 1) * blk] ** 2).mean()) for i in range(n)])
    if n < 3: return len(y) / sr
    thr = max(1e-3, 0.08 * np.percentile(e, 90)); v = np.where(e > thr)[0]
    return max(0.3, (v[-1] - v[0] + 1) * 0.1) if len(v) else len(y) / sr

rows = []
ho = os.path.join(QT, 'eval', 'heldout')
for n in ('test_L1', 'test_L2', 'test_L3', 'ho_reciters', 'ho_retasy'):
    for x in json.load(open(os.path.join(ho, n + '.json'), encoding='utf8')):
        if x.get('label', 'correct') != 'correct': continue
        rows.append(dict(id=x['id'], wav=x['wav'], set=n, src=x.get('reciter') or x['id'].split('-0')[0], split='heldout',
                         words=len(ix[(int(x['s']), int(x['a']))]['k']) if 's' in x else len(x['text'].split()),
                         s=x.get('s'), a=x.get('a'), text=x.get('text')))
# user clips in the training split: the model has seen them -> flagged, used only as extra evidence
clips = json.load(open(os.path.join(QT, 'long', 'all', 'clips.json'), encoding='utf8'))
for c in clips:
    if c['split'] == 'train' and 'drop' not in c and c.get('cer', 1) <= 0.1:
        rows.append(dict(id=c['id'], wav=os.path.join(ROOT, c['wav']), set='user_train', src=c['file'], split='train',
                         words=len(c['text'].split()), text=c['text']))
out = []
for r in rows:
    try: y, sr = sf.read(r['wav'], dtype='float32')
    except Exception: continue
    if y.ndim > 1: y = y.mean(1)
    if sr != 16000: continue
    r['span_s'] = round(float(span(y)), 2); r['dur_s'] = round(len(y) / sr, 2); r['wps'] = round(r['words'] / r['span_s'], 2); out.append(r)
json.dump(out, open(os.path.join(W, 'rates.json'), 'w', encoding='utf8'), ensure_ascii=False)
w = np.array([r['wps'] for r in out]); print(len(out), np.percentile(w, [5, 25, 50, 75, 95]).round(2))
for sp in ('heldout', 'train'):
    v = np.array([r['wps'] for r in out if r['split'] == sp and r['words'] >= 4])
    print(sp, len(v), np.percentile(v, [5, 25, 50, 75, 95]).round(2), [(lo, int(((v >= lo) & (v < hi)).sum())) for lo, hi in ((0, .8), (.8, 1.2), (1.2, 1.8), (1.8, 2.4), (2.4, 3), (3, 99))])
for n in ('ho_reciters', 'ho_retasy', 'test_L1', 'test_L2', 'test_L3'):
    v = np.array([r['wps'] for r in out if r['set'] == n]); print(n, len(v), np.percentile(v, [5, 50, 95]).round(2))
