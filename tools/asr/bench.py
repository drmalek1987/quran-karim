# Benchmark Quran ASR models on ayah clips of many reciters, clean and with real background noise at several strengths.
# Scores: WER/CER after Arabic normalisation, and the share of clips whose ayah is found (what the app needs).
# usage: bench.py MODEL_ID [n_clips]
import sys, os, json, re, glob, time, random, collections
import numpy as np, soundfile as sf, torch, jiwer
from transformers import WhisperProcessor, WhisperForConditionalGeneration
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL, N = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 150
torch.set_num_threads(4)
TASHKEEL = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]')
def norm(t):
    t = TASHKEEL.sub('', t)
    t = re.sub('[ٱأإآ]', 'ا', t); t = re.sub('[ىی]', 'ي', t); t = t.replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي')
    t = re.sub('[^ء-ي ]', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()
# the Quran (Tanzil simple) to name the ayah of each clip and of each transcript
Q = json.loads(open('/mnt/project-files/quran-app/web/quran-data.js', encoding='utf8').read().split('=', 1)[1].rstrip().rstrip(';'))['q']
AY = [(s + 1, a + 1, ' ' + norm(t) + ' ') for s, sur in enumerate(Q) for a, t in enumerate(sur)]
def find(text):
    ws = [w for w in norm(text).split() if len(w) > 1]
    if len(ws) < 2: return None
    best, bk = 0, None
    for i, (s, a, tx) in enumerate(AY):
        win = tx + ''.join(AY[i + d][2] for d in (1, 2) if i + d < len(AY) and AY[i + d][0] == s)
        h, pos = 0, 0
        for w in ws:
            j = win.find(' ' + w, pos)
            if j >= 0: h += 1; pos = j + 1
        own = sum(1 for w in ws if (' ' + w) in tx)
        sc = (h / len(ws), (' ' + ws[0] + ' ') in tx, own)
        if bk is None or sc > best: best, bk = sc, (s, a)
    return bk if best[0] >= 0.6 else None
meta = {}
CL = os.environ.get('CLIPS', 'clips')
for f in sorted(glob.glob(D + '/' + CL + '/meta-*.json')):
    for m in json.load(open(f)): meta[m['id']] = m
ids = sorted(meta); random.seed(1)
by = collections.defaultdict(list)
for k in ids: by[meta[k]['reciter']].append(k)
pick = []
while len(pick) < N and any(by.values()):
    for r in sorted(by):
        if by[r] and len(pick) < N: pick.append(by[r].pop(random.randrange(len(by[r]))))
noises = [sf.read(f, dtype='float32')[0] for f in sorted(glob.glob(D + '/noise/*.wav'))]
noises = [n.mean(1) if n.ndim > 1 else n for n in noises]
def mix(y, n, snr):
    if len(n) < len(y): n = np.tile(n, len(y) // len(n) + 1)
    o = random.randrange(len(n) - len(y) + 1); n = n[o:o + len(y)]
    py, pn = (y ** 2).mean() + 1e-9, (n ** 2).mean() + 1e-9
    return y + n * np.sqrt(py / (pn * 10 ** (snr / 10)))
def babble(y, k, snr):
    pool = [os.path.basename(f)[:-4] for f in glob.glob(D + '/clips/*.wav')]
    others = [sf.read(D + '/clips/' + o + '.wav', dtype='float32')[0] for o in random.sample(pool, 4)]
    b = np.zeros_like(y)
    for o in others: b[:min(len(b), len(o))] += o[:len(b)]
    return mix(y, b, snr)
CONDS = [('clean', None), ('noise 20dB', 20), ('noise 10dB', 10), ('noise 5dB', 5), ('noise 0dB', 0), ('people talking 5dB', 'b5')]
proc = WhisperProcessor.from_pretrained(MODEL); model = WhisperForConditionalGeneration.from_pretrained(MODEL).eval()
if not hasattr(model.generation_config, 'lang_to_id'):   # older fine-tunes: take the generation config of the same-size OpenAI model
    from transformers import GenerationConfig
    base = {384: 'tiny', 512: 'base', 768: 'small', 1024: 'medium', 1280: 'large-v3'}[model.config.d_model]
    model.generation_config = GenerationConfig.from_pretrained('openai/whisper-' + base)
def asr(y):
    f = proc(y, sampling_rate=16000, return_tensors='pt').input_features
    with torch.no_grad(): ids_ = model.generate(f, language='ar', task='transcribe', max_new_tokens=200)
    return proc.batch_decode(ids_, skip_special_tokens=True)[0]
res = {}; t0 = time.time(); secs = 0
for name, c in CONDS:
    random.seed(11); refs, hyps, ok = [], [], 0; samples = []
    for k in pick:
        y = sf.read(D + '/' + CL + '/' + k + '.wav', dtype='float32')[0]
        if c is not None: y = babble(y, k, 5) if c == 'b5' else mix(y, random.choice(noises), c)
        y = (y / (np.abs(y).max() + 1e-9) * 0.9).astype(np.float32)
        ts = time.time(); h = asr(y); secs += time.time() - ts
        r = meta[k]['text']; refs.append(norm(r)); hyps.append(norm(h) or '-')
        g = find(r); ok += g is not None and find(h) == g
        if len(samples) < 3: samples.append((r, h))
    res[name] = dict(wer=round(jiwer.wer(refs, hyps) * 100, 1), cer=round(jiwer.cer(refs, hyps) * 100, 1), ayah=round(ok / len(pick) * 100, 1), samples=samples)
    print(MODEL, name, res[name]['wer'], res[name]['cer'], res[name]['ayah'], flush=True)
out = dict(model=MODEL, clips=len(pick), reciters=len({meta[k]['reciter'] for k in pick}), sec_per_clip=round(secs / (len(pick) * len(CONDS)), 2), res=res)
json.dump(out, open(D + '/results-' + ('' if CL == 'clips' else CL + '-') + MODEL.replace('/', '__') + '.json', 'w'), ensure_ascii=False, indent=1)
