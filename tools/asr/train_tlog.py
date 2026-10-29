# Fine-tunes a Quran Whisper model so it copes with ordinary voices and noisy rooms: each step takes reciter clips
# (and HA's own training clips), changes the voice (pitch, speed), the room (echo, phone band) and adds noise or other
# people talking, then trains on the plain (undiacritised) text. Saves a checkpoint every SAVE steps and resumes from it.
# usage: train.py BASE_MODEL OUT_DIR STEPS
import sys, os, json, glob, random, re, time
import numpy as np, soundfile as sf, librosa, torch, scipy.signal as ss
from transformers import WhisperProcessor, WhisperForConditionalGeneration, GenerationConfig
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE, OUT, STEPS = sys.argv[1], sys.argv[2], int(sys.argv[3])
BS, ACC, LR, SAVE = 8, 2, 1e-5, 50
torch.set_num_threads(3); torch.set_flush_denormal(True); random.seed(int(time.time()))
TASHKEEL = re.compile(open(D + '/scripts/bench.py', encoding='utf8').read().split("TASHKEEL = re.compile('")[1].split("')")[0])
def norm(t):
    t = TASHKEEL.sub('', t); t = re.sub('[ٱأإآ]', 'ا', t); t = re.sub('[ىی]', 'ي', t)
    t = t.replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي'); t = re.sub('[^ء-ي ]', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()
def load(dirs):
    out = []
    for d in dirs:
        for f in glob.glob(D + '/' + d + '/meta-*.json'):
            out += [(D + '/' + d + '/' + m['id'] + '.wav', norm(m['text'])) for m in json.load(open(f))]
    return out
REC, HA = load(['clips-bal']), load(['clips-ha-train'])
print('reciter clips', len(REC), 'HA clips', len(HA), flush=True)
NOISE = [n.mean(1) if n.ndim > 1 else n for n in (sf.read(f, dtype='float32')[0] for f in glob.glob(D + '/noise/*.wav'))]
def mix(y, n, snr):
    if len(n) < len(y): n = np.tile(n, len(y) // len(n) + 1)
    o = random.randrange(len(n) - len(y) + 1); n = n[o:o + len(y)]
    return y + n * np.sqrt(((y ** 2).mean() + 1e-9) / (((n ** 2).mean() + 1e-9) * 10 ** (snr / 10)))
def augment(y):
    if random.random() < 0.8: return y.astype(np.float32)
    if random.random() < 0.6: y = librosa.effects.pitch_shift(y, sr=16000, n_steps=random.uniform(-4, 4))
    if random.random() < 0.6: y = librosa.resample(y, orig_sr=16000, target_sr=int(16000 * random.uniform(0.87, 1.15)))
    if random.random() < 0.4:   # a room: exponentially decaying noise as the echo
        t = random.uniform(0.15, 0.6); ir = np.random.randn(int(t * 16000)) * np.exp(-6.9 * np.arange(int(t * 16000)) / (t * 16000)); ir[0] = 1
        y = ss.fftconvolve(y, ir / np.abs(ir).sum() * 4)[:len(y)]
    if random.random() < 0.3:   # a phone line
        b, a = ss.butter(4, [random.uniform(200, 400), random.uniform(3000, 3800)], btype='band', fs=16000); y = ss.lfilter(b, a, y)
    r = random.random()
    if r < 0.6: y = mix(y, random.choice(NOISE), random.uniform(-2, 20))
    elif r < 0.8:
        b = np.zeros_like(y)
        for _ in range(random.randint(1, 3)):
            o = sf.read(random.choice(REC)[0], dtype='float32')[0]; b[:min(len(b), len(o))] += o[:len(b)]
        y = mix(y, b, random.uniform(3, 15))
    y = y.astype(np.float32); return y / (np.abs(y).max() + 1e-9) * random.uniform(0.3, 0.95)
src = OUT if os.path.exists(OUT + '/config.json') else BASE
proc = WhisperProcessor.from_pretrained(BASE); model = WhisperForConditionalGeneration.from_pretrained(src)
if not hasattr(model.generation_config, 'lang_to_id'):
    model.generation_config = GenerationConfig.from_pretrained('openai/whisper-' + {384: 'tiny', 512: 'base', 768: 'small'}[model.config.d_model])
model.config.forced_decoder_ids = None; model.generation_config.forced_decoder_ids = None
opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=0.01)
st = json.load(open(OUT + '/state.json')) if os.path.exists(OUT + '/state.json') else {'step': 0, 'loss': []}
if os.path.exists(OUT + '/opt.pt'): opt.load_state_dict(torch.load(OUT + '/opt.pt'))
prefix = proc.tokenizer.convert_tokens_to_ids(['<|startoftranscript|>', '<|ar|>', '<|transcribe|>', '<|notimestamps|>'])
eot = proc.tokenizer.eos_token_id
model.train(); t0 = time.time()
while st['step'] < STEPS:
    for g in opt.param_groups: g['lr'] = LR * min(1, (st['step'] + 1) / 30) * max(0.1, 1 - st['step'] / STEPS)
    tot = 0
    for _ in range(ACC):
        batch = [random.choice(HA) if HA and random.random() < 0.15 else random.choice(REC) for _ in range(BS)]
        auds = [augment(sf.read(f, dtype='float32')[0]) for f, _ in batch]
        feats = proc.feature_extractor(auds, sampling_rate=16000, return_tensors='pt').input_features
        toks = [prefix + proc.tokenizer.encode(' ' + t, add_special_tokens=False)[:400] + [eot] for _, t in batch]
        L = max(map(len, toks)); ids = torch.full((BS, L), eot); lab = torch.full((BS, L), -100)
        for i, t in enumerate(toks): ids[i, :len(t)] = torch.tensor(t); lab[i, :len(t) - 1] = torch.tensor(t[1:])
        out = model(input_features=feats, decoder_input_ids=ids[:, :-1], labels=None)
        lg = out.logits; loss = torch.nn.functional.cross_entropy(lg.reshape(-1, lg.size(-1)), lab[:, :-1].reshape(-1), ignore_index=-100)
        (loss / ACC).backward(); tot += loss.item() / ACC
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step(); opt.zero_grad()
    st['step'] += 1; st['loss'].append(round(tot, 4))
    if st["step"] % 10 == 0 or st["step"] <= 3: print('step', st['step'], 'loss', round(np.mean(st['loss'][-10:]), 3), 's/step', round((time.time() - t0) / 10, 1), flush=True); t0 = time.time()
    if st['step'] % SAVE == 0 or st['step'] == STEPS:
        model.save_pretrained(OUT); proc.save_pretrained(OUT); model.generation_config.save_pretrained(OUT)
        torch.save(opt.state_dict(), OUT + '/opt.pt'); json.dump(st, open(OUT + '/state.json', 'w'))
print('done', st['step'])
