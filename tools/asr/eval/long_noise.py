# Estimated SNR per labelled piece of long_pseudo.py output, from the recording itself: noise = 10th percentile of 100 ms
# block RMS in a +-30 s window around the piece (pauses between ayat), speech = mean power of the piece's top 30% blocks.
# Bins: clean >= 25 dB, light 15-25, medium 8-15, heavy < 8. Writes snr + bin into each manifest and a summary.
# Usage: python -I long_noise.py <long_pseudo out dir> <recordings dir>
import sys, os, json, subprocess
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from long_pseudo import load, SR

od, rd = sys.argv[1], sys.argv[2]
src = {os.path.splitext(f)[0].replace('​', '').strip(): os.path.join(rd, f) for f in os.listdir(rd)}
BIN = lambda s: 'clean' if s >= 25 else 'light' if s >= 15 else 'medium' if s >= 8 else 'heavy'
summ = {}
for mf in sorted(f for f in os.listdir(od) if f.endswith('.json') and f != 'noise.json'):
    base = mf[:-5]; rows = json.load(open(os.path.join(od, mf), encoding='utf8'))
    y = load(src[base]); blk = SR // 10; n = len(y) // blk
    e = (y[:n * blk].reshape(n, blk) ** 2).mean(1) + 1e-12
    fs = []
    for r in rows:
        a, b = int(r['t0'] * 10), max(int(r['t0'] * 10) + 1, int(r['t1'] * 10))
        nz = np.percentile(e[max(0, a - 300):min(n, b + 300)], 10)
        pc = np.sort(e[a:b])[::-1]; sp = pc[:max(1, len(pc) * 3 // 10)].mean()
        r['snr'] = round(float(10 * np.log10(max(sp - nz, 1e-12) / nz)), 1); r['bin'] = BIN(r['snr'])
        if 'id' in r: fs.append(r['snr'])
    json.dump(rows, open(os.path.join(od, mf), 'w', encoding='utf8'), ensure_ascii=False, indent=0)
    summ[base] = {'median_snr': round(float(np.median(fs)), 1) if fs else None,
                  **{k: round(sum(r['t1'] - r['t0'] for r in rows if r.get('bin') == k and r.get('conf') in ('high', 'mid')) / 60, 1)
                     for k in ('clean', 'light', 'medium', 'heavy')}}
    print(base.encode('unicode_escape').decode()[:40], summ[base], flush=True)
json.dump(summ, open(os.path.join(od, 'noise.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
