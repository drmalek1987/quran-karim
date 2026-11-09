# G10b noise pool (2026-11-09): real background noise from the user's own phone recordings (qtrain/long/all/wav pieces),
# i.e. the gaps between words/ayat. Frames (20 ms) more than 18 dB under the piece's loud speech (95th pct) and runs >= 0.2 s
# are kept, joined per recording file, and written to qtrain/g10b/noise/<file>.wav when >= 3 s. The held-out DEMAND noise
# (eval/heldout/demand) is NOT used, so the noisy gate stays fair. Any other real noise wavs (MUSAN, other DEMAND rooms)
# can be dropped into the same folder later; nv_curr.py G10b reads every wav there.
# Run: D:\nemo-env\Scripts\python.exe -X utf8 g10b_noise.py
import os, glob, collections, numpy as np, soundfile as sf
ROOT = os.environ.get('QROOT', r'D:\Quran App'); OUT = os.path.join(ROOT, 'qtrain', 'g10b', 'noise')
os.makedirs(OUT, exist_ok=True)
F = 320
by = collections.defaultdict(list)
for p in sorted(glob.glob(os.path.join(ROOT, 'qtrain', 'long', 'all', 'wav', '*.wav'))):
    y, sr = sf.read(p, dtype='float32', always_2d=True); y = y.mean(1)
    if sr != 16000 or len(y) < 16000: continue
    n = len(y) // F; fr = y[:n * F].reshape(n, F); db = 10 * np.log10((fr ** 2).mean(1) + 1e-12)
    q = db < np.percentile(db, 95) - 18; i = 0
    while i < n:
        if not q[i]: i += 1; continue
        j = i
        while j < n and q[j]: j += 1
        if j - i >= 10: by[os.path.basename(p).rsplit('-', 1)[0]].append(fr[i + 2:j - 2].reshape(-1))   # trim 40 ms edges
        i = j
tot = 0
for f, segs in by.items():
    z = np.concatenate(segs)
    if len(z) < 3 * 16000: continue
    sf.write(os.path.join(OUT, f.replace(',', '').replace(' ', '_') + '.wav'), z, 16000, subtype='PCM_16'); tot += len(z)
print('noise files', len(os.listdir(OUT)), 'minutes %.1f' % (tot / 16000 / 60))
