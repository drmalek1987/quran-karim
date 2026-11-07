# G10 data prep (Patch 3 S4, plan items 30/31): noisy / reverberant / fast / slow copies of the train clips, CPU only.
# Writes qtrain/g10/wav/*.wav and qtrain/g10/aug.json (same fields as long/all/clips.json, split=train, level=G10,
# plus 'aug' = the params used). The held-out DEMAND noise (eval/heldout/demand) is NOT used, so the noisy gate stays fair:
# noise here is babble (3-6 other train clips summed, other readers) and coloured noise (white/pink/brown).
# Labels are unchanged (speed / noise / reverb do not change the words). Lead/trail quiet is kept (P3 lesson: VAD silence).
# Run: D:\nemo-env\Scripts\python.exe g10_prep.py [N_PER_CLIP=2] [REPLAY_N=3000]   (resumable: skips files that exist)
import os, sys, json, random, subprocess, zlib, multiprocessing as mp
import numpy as np, soundfile as sf

ROOT = os.environ.get('QROOT', r'D:\Quran App'); QT = os.path.join(ROOT, 'qtrain'); OUT = os.path.join(QT, 'g10')
NPC = int(sys.argv[1]) if len(sys.argv) > 1 else 2
REPLAY_N = int(sys.argv[2]) if len(sys.argv) > 2 else 3000
SR = 16000

def J(p): return json.load(open(p, encoding='utf8'))
def wav(p): return p if os.path.isabs(p) else os.path.join(ROOT, p)

def load(p):
    y, sr = sf.read(p, dtype='float32', always_2d=True); y = y.mean(1)
    if sr != SR: y = ff(y, sr, f'aresample={SR}')
    return y

def ff(y, sr, af):   # run an ffmpeg audio filter on a float32 mono array (used for atempo / resample)
    p = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', 'pipe:0', '-af', af,
                        '-f', 'f32le', '-ar', str(SR), '-ac', '1', 'pipe:1'], input=y.astype(np.float32).tobytes(),
                       capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32).copy()

def rms(y): return float(np.sqrt((y ** 2).mean()) + 1e-9)

def coloured(n, kind, rng):
    w = rng.standard_normal(n)
    if kind == 'white': return w
    f = np.fft.rfft(w); k = np.arange(len(f)); k[0] = 1
    f = f / (np.sqrt(k) if kind == 'pink' else k)
    return np.fft.irfft(f, n)

def rir(rt60, rng):
    n = int(SR * min(1.2, rt60 * 1.2)); t = np.arange(n) / SR
    h = rng.standard_normal(n) * np.exp(-6.9 * t / rt60); h[0] = 1.0
    return h / np.sqrt((h ** 2).sum())

def conv(y, h):
    n = len(y) + len(h) - 1; L = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(y, L) * np.fft.rfft(h, L), L)[:len(y)]

POOL = None
def job(a):
    c, k, seed, pool = a
    dst = os.path.join(OUT, 'wav', f"{c['id']}~g{k}.wav")
    rnd = random.Random(seed); rng = np.random.default_rng(seed)
    aug = {}
    if not os.path.exists(dst):
        y = load(c['path'])
        r = rnd.random()   # speed: 40% fast (hadr 1.1-1.5), 15% slow (mujawwad-ish 0.7-0.9)
        if r < 0.40: aug['tempo'] = round(rnd.uniform(1.1, 1.5), 2)
        elif r < 0.55: aug['tempo'] = round(rnd.uniform(0.7, 0.9), 2)
        if 'tempo' in aug: y = ff(y, SR, f"atempo={aug['tempo']}")
        if rnd.random() < 0.35:
            aug['rt60'] = round(rnd.uniform(0.3, 1.0), 2); y = conv(y, rir(aug['rt60'], rng)).astype(np.float32)
        if rnd.random() < 0.8:
            snr = rnd.uniform(0, 20); aug['snr'] = round(snr, 1)
            if rnd.random() < 0.6:
                aug['noise'] = 'babble'; nz = np.zeros(len(y))
                for p in rnd.sample(pool, rnd.randint(3, 6)):
                    b = load(p)
                    if len(b) < len(y): b = np.tile(b, len(y) // max(1, len(b)) + 1)
                    o = rnd.randrange(0, len(b) - len(y) + 1); b = b[o:o + len(y)]; nz += b / rms(b)
            else:
                aug['noise'] = rnd.choice(['white', 'pink', 'pink', 'brown']); nz = coloured(len(y), aug['noise'], rng)
            y = y + nz * (rms(y) / rms(nz)) * 10 ** (-snr / 20)
        pk = float(np.abs(y).max())
        if pk > 0.98: y = y * (0.98 / pk)
        sf.write(dst, y.astype(np.float32), SR, subtype='PCM_16')
    else:
        return None
    d = {kk: c[kk] for kk in ('id', 'text', 'reader', 'w') if kk in c}
    d.update(id=f"{c['id']}~g{k}", wav=dst, split='train', level='G10', src_level=c.get('level', 'replay'), aug=aug)
    return d

def main():
    os.makedirs(os.path.join(OUT, 'wav'), exist_ok=True)
    cl = [c for c in J(os.path.join(QT, 'long', 'all', 'clips.json')) if 'drop' not in c]
    ex = os.path.join(QT, 'long', 'all', 'extra_train.json'); cl += J(ex) if os.path.exists(ex) else []
    tr = [dict(c, path=wav(c['wav'])) for c in cl if c.get('split') == 'train']
    banned = {x['id'] for x in J(os.path.join(QT, 'eval', 'tlog.json'))} | {x['id'] for x in J(os.path.join(QT, 'gpu-train', 'data', 'test.json'))}
    rep = [dict(x, path=os.path.join(QT, 'gpu-train', 'data', 'clips', x['id'] + '.wav'))
           for x in J(os.path.join(QT, 'gpu-train', 'data', 'train.json')) if x['id'] not in banned]
    rep = random.Random(7).sample(rep, min(REPLAY_N, len(rep)))
    src = tr + rep
    pool = [c['path'] for c in random.Random(8).sample(src, min(800, len(src)))]   # babble sources (train only)
    jobs = [(c, k, zlib.crc32(f"{c['id']}~{k}".encode()), pool) for c in src for k in range(NPC)]
    print(f'clips {len(tr)} + replay {len(rep)} -> {len(jobs)} variants into {OUT}', flush=True)
    man = os.path.join(OUT, 'aug.json'); old = {x['id']: x for x in J(man)} if os.path.exists(man) else {}
    done = 0
    with mp.Pool(max(1, (os.cpu_count() or 4) - 3)) as P:
        for d in P.imap_unordered(job, jobs, chunksize=8):
            done += 1
            if d: old[d['id']] = d
            if done % 500 == 0:
                json.dump(list(old.values()), open(man, 'w', encoding='utf8'), ensure_ascii=False)
                print(f'{done}/{len(jobs)}', flush=True)
    json.dump(list(old.values()), open(man, 'w', encoding='utf8'), ensure_ascii=False)
    print(f'DONE {len(old)} entries -> {man}', flush=True)

if __name__ == '__main__':
    main()
