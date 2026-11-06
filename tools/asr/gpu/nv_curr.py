# P3 CP3-CP6: curriculum fine-tune of the phone model (NVIDIA Arabic FastConformer hybrid, CTC branch only) on the user's
# long recordings (qtrain/long/all/clips.json + extra_train.json), one level per run (plans/P3-train-protocol.md C/D/H).
#   LEVEL=L1|L2|L3  INIT=<.nemo of the previous level> (default: stock NVIDIA base)  DRY=1 (2 tiny steps, memory check)
# Mix per batch (share of picks): L1 70% L1 + 30% replay; L2 50/20 L1 +30; L3 45 L3/15 L2/10 L1 +30. Replay = tlog train
# (clips not in any eval set). Clips are picked by weight w (reader cap) x 0.3 when 'known' (B7).
# Freeze: pre_encode + lower 1/2 of the encoder at L1, lower 1/3 at L2/L3 (B4). LR peak 1e-5, 200 warm-up, linear decay.
# In-loop eval every EVAL steps = greedy-CTC CER (app norm) on test-L1/L2/L3, P0b clean/noisy, tlog test, train sample.
# This is a PROXY: the level gate (verify %, wrong caught) is decided after the run by exporting best.nemo to int8 and
# running bench.py + p1b_port_eval (nv_gate step). Best = lowest own-level test CER with no clean set worse than
# base + 0.3 CER and no noisy set worse than base. Nothing is uploaded (G9). Output: nv_out/<LEVEL>/, nv_curr.json.
import os, sys, json, random, time, re, hashlib, unicodedata
import numpy as np, soundfile as sf, torch
D = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get('QROOT', r'D:\Quran App')
QT = os.path.join(ROOT, 'qtrain')
LEVEL = os.environ.get('LEVEL', 'L1'); DRY = os.environ.get('DRY') == '1'
INIT = os.environ.get('INIT', '')
STEPS = int(os.environ.get('STEPS', {'L1': 1000, 'L2': 3000, 'L3': 3000}[LEVEL]))
EVAL = int(os.environ.get('EVAL', 200 if LEVEL == 'L1' else 400))
LR, WARM = float(os.environ.get('LR', 1e-5)), 200
BATCH_SEC, ACC = float(os.environ.get('BATCH_SEC', 60)), int(os.environ.get('ACC', 2))
SEED = 11
# fp16 autocast gives NaN in this encoder on the Turing GPU (checked 2026-11-06: fp32 decodes right) -> fp32 by default
AMP = os.environ.get('AMP') == '1'
MIX = {'L1': {'L1': .7, 'replay': .3}, 'L2': {'L2': .5, 'L1': .2, 'replay': .3},
       'L3': {'L3': .45, 'L2': .15, 'L1': .1, 'replay': .3}}[LEVEL]
FREEZE = 1 / 2 if LEVEL == 'L1' else 1 / 3
# retry knob (plan D: one retry per failed level): REPLAY=0.4 scales the other shares down to fill 60%
if os.environ.get('REPLAY'):
    r = float(os.environ['REPLAY']); o = {k: v for k, v in MIX.items() if k != 'replay'}; t = sum(o.values())
    MIX = {**{k: v / t * (1 - r) for k, v in o.items()}, 'replay': r}
SAVE_ALL = os.environ.get('SAVE_ALL') == '1'   # keep a .nemo at every eval step (to gate several on the phone pipeline)
BASE = ('nvidia/stt_ar_fastconformer_hybrid_large_pcd_v1.0', 'stt_ar_fastconformer_hybrid_large_pcd_v1.0.nemo')
OUT = os.path.join(D, 'nv_out', LEVEL); RES = os.path.join(D, 'nv_curr.json')

def log(*a):
    s = time.strftime('%H:%M:%S ') + ' '.join(map(str, a)); print(s, flush=True)
    open(os.path.join(D, 'nv_curr.log'), 'a', encoding='utf8').write(s + '\n')

# ---- text ----
# eval norm = the app's norm (bench.norm): no diacritics, alef/yaa/taa-marbuta folded
DIAC = re.compile('[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u08d3-\u08ff\u0640\u200c-\u200f\u06dd\u06de\u06e9]')
def norm(t):
    t = unicodedata.normalize('NFKD', t); t = DIAC.sub('', t)
    t = re.sub('[ٱأإآ]', 'ا', t); t = re.sub('[ىی]', 'ي', t); t = t.replace('ة', 'ه').replace('ک', 'ك')
    t = re.sub(r'[^ء-ي\s]', '', t); return re.sub(r'\s+', ' ', t).strip()
# train target = the model's own writing style (it outputs diacritised imla'i text, e.g. زُلْفَى not زُلْفَىٰ):
# Uthmani-only signs are mapped/removed, normal harakat are kept, so the output style does not drift.
UTH = re.compile('[\u0670\u06d6-\u06ed\u08d3-\u08ff\u0640\u06dd\u06de\u06e9]')
# 2026-11-06 fix: dagger alif was deleted (الْعَلِمُونَ) and maddah/small signs became spaces (كَفَرُو ا) in ~70% of tlog
# replay targets. Now each word with a dagger alif takes the spelling found in the imla'i Quran text (quran-simple-search):
# with alif (الْعَالَمِينَ, رَاعُونَ) or without (هَذَا, ذَلِكَ, الرَّحْمَنِ); other signs are deleted, never spaced.
SIMPLE = None
def _vocab():
    global SIMPLE
    if SIMPLE is None:
        q = J(os.path.join(ROOT, 'quran-karim', 'data', 'quran-simple-search.json'))['quran']
        SIMPLE = {norm(w) for v in q for w in v['text'].split()}
    return SIMPLE
def _dagger(w):
    if 'ٰ' not in w: return w
    drop, alif = w.replace('ٰ', ''), w.replace('ٰ', 'ا')
    if re.search('ى[ً-ْ]*ٰ', w): return drop
    V = _vocab()
    if norm(alif) in V and norm(drop) not in V: return alif
    if norm(drop) in V: return drop
    waw = re.sub('و([ً-ْ]*)ٰ', 'ا', w)   # الصَّلَوٰةَ -> الصَّلَاةَ, ٱلزَّكَوٰةَ, ٱلْحَيَوٰةَ
    return waw if norm(waw) in V else alif
def _target(t):
    t = t.replace('ٱ', 'ا'); t = ' '.join(_dagger(w) for w in t.split())
    t = UTH.sub('', t); t = re.sub(r'[^ء-يً-ْ\s]', '', t); return re.sub(r'\s+', ' ', t).strip()
# v5 (2026-11-06): PLAIN=1 (default) trains on letters only, no harakat. With harakat the model stuttered on unclear amateur
# audio (الرَّحَّحِ, اللَّهَِّحَِّح, empty) where the base answers plain text; the app strips harakat anyway (norm/rSkel/CTC fold).
PLAIN = os.environ.get('PLAIN', '1') == '1'
def target(t):
    t = _target(t)
    return re.sub(r'\s+', ' ', re.sub('[ً-ْ]', '', t)).strip() if PLAIN else t
def ed(a, b):
    p = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        c = [i]
        for j, y in enumerate(b, 1): c.append(min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (x != y)))
        p = c
    return p[-1]

# ---- data ----
def J(p): return json.load(open(p, encoding='utf8'))
def wav(p): return p if os.path.isabs(p) else os.path.join(ROOT, p)
QW = {(x['s'], x['a']): ' '.join(x['w']) for x in J(os.path.join(QT, 'eval', 'quran_words.json'))}
def data():
    cl = [c for c in J(os.path.join(QT, 'long', 'all', 'clips.json')) if 'drop' not in c]
    ex = os.path.join(QT, 'long', 'all', 'extra_train.json')
    cl += J(ex) if os.path.exists(ex) else []
    for c in cl: c['path'] = wav(c['wav']); c['pw'] = c.get('w', 1.0) * (0.3 if c.get('zone') == 'known' else 1.0)
    tr = {L: [c for c in cl if c['split'] == 'train' and c['level'] == L] for L in ('L1', 'L2', 'L3')}
    ev = {'test_' + L: [c for c in cl if c['split'] == 'test' and c['level'] == L] for L in ('L1', 'L2', 'L3')}
    ho = os.path.join(QT, 'eval', 'heldout')
    for name in ('ho_reciters', 'ho_retasy'):
        ev[name] = [dict(x, path=wav(x['wav']), text=QW[(x['s'], x['a'])]) for x in J(os.path.join(ho, name + '.json'))]
    nz = J(os.path.join(ho, 'ho_noisy.json')); rnd = random.Random(SEED)
    by = {}   # the same 100 clip+noise pairs at every SNR, so SNR 20/10/5 compare like with like
    for x in nz: by.setdefault(x['id'].rsplit('-', 1)[0], {})[x['set'][8:]] = x
    keys = sorted(k for k, v in by.items() if len(v) == 3); rnd.shuffle(keys)
    for snr in ('20', '10', '5'):
        ev['noisy' + snr] = [dict(by[k][snr], path=wav(by[k][snr]['wav']), text=QW[(by[k][snr]['s'], by[k][snr]['a'])]) for k in keys[:100]]
    tl_eval = J(os.path.join(QT, 'eval', 'tlog.json'))
    ev['tlog'] = [dict(x, path=wav(x['wav'])) for x in tl_eval]
    banned = {x['id'] for x in tl_eval} | {x['id'] for x in J(os.path.join(QT, 'gpu-train', 'data', 'test.json'))}
    rep = [dict(x, path=os.path.join(QT, 'gpu-train', 'data', 'clips', x['id'] + '.wav'), pw=1.0)
           for x in J(os.path.join(QT, 'gpu-train', 'data', 'train.json')) if x['id'] not in banned]
    tr['replay'] = rep
    ev['train_' + LEVEL] = random.Random(SEED).sample(tr[LEVEL], min(150, len(tr[LEVEL])))   # B6 overfit gap
    return tr, ev

sys.path.insert(0, os.path.join(ROOT, 'quran-karim', 'tools', 'asr', 'eval'))
import bench as PHONE   # the phone pipeline port (VAD pieces, gains) used by nv_gate

# 2026-11-06 fix: train clips were cut tight at the word edges (A7), so after L1 the model returned EMPTY text when a piece
# ended with ~1 s of quiet - which is what the phone VAD always gives (quiet_end 1.0 s, pre-roll 0.3 s). Every train clip
# now gets random lead/trail quiet at a random noise floor and a random level (p=0.85).
AUG = os.environ.get('AUG', '1') == '1'
def augment(y, rnd):
    if not AUG or rnd.random() > 0.85: return y
    y = y * (10 ** (rnd.uniform(-40, -20) / 20) / max(1e-6, float(np.sqrt((y ** 2).mean()))))
    fl = 10 ** (rnd.uniform(-80, -50) / 20)
    pre = np.random.default_rng(rnd.randrange(1 << 30)).normal(0, fl, int(16000 * rnd.uniform(0.05, 0.5)))
    post = np.random.default_rng(rnd.randrange(1 << 30)).normal(0, fl, int(16000 * rnd.uniform(0.3, 1.6)))
    return np.concatenate([pre, y, post]).astype(np.float32)

def phone_pieces(y):
    # same as bench.py main with the 5.7 settings: speech to -31 dBFS, VAD pieces (pre-roll 3, quiet 1.0, vmin 0.0015, pgain -30)
    y = (y * (10 ** (-31 / 20) / max(1e-9, float(np.sqrt((y ** 2).mean()))))).astype(np.float32)
    P = PHONE.vad_pieces(y, preroll=3, quiet_end=1.0, vmin=0.0015, pgain=-30)
    return [p.astype(np.float32) for p in P if len(p) >= 1600] or [y]

def load(p, cap=16000 * 16):
    y, sr = sf.read(p, dtype='float32', always_2d=True); y = y.mean(1)
    if sr != 16000:
        import librosa; y = librosa.resample(y, orig_sr=sr, target_sr=16000)
    return y[:cap]

# ---- model ----
def forward(m, ys, train):
    L = torch.tensor([len(y) for y in ys], device='cuda'); X = torch.zeros(len(ys), int(L.max()), device='cuda')
    for i, y in enumerate(ys): X[i, :len(y)] = torch.from_numpy(y)
    f, fl = m.preprocessor(input_signal=X, length=L)
    if train and m.spec_augmentation is not None: f = m.spec_augmentation(input_spec=f, length=fl)
    e, el = m.encoder(audio_signal=f, length=fl)
    return m.ctc_decoder(encoder_output=e), el

def decode(m, lp, el):
    out, V = [], m.tokenizer.vocab_size
    for row, n in zip(lp.argmax(-1).tolist(), el.tolist()):
        ids, prev = [], -1
        for t in row[:n]:
            if t != prev and t < V: ids.append(t)
            prev = t
        out.append(m.tokenizer.ids_to_text(ids))
    return out

def train_mode(m):
    # BatchNorm running stats would drift in train mode (even in frozen layers) with our small batches: found in the DRY run
    # (CER moved a lot after 2 steps at lr 1e-7). Keep every BatchNorm in eval mode = stats of the base model.
    m.train()
    for mod in m.modules():
        if isinstance(mod, torch.nn.modules.batchnorm._BatchNorm): mod.eval()

def cer(m, items):
    if not items: return None
    m.eval(); E = N = 0
    with torch.no_grad(), torch.autocast('cuda', dtype=torch.float16, enabled=AMP):
        for x in items:   # eval through the phone pipeline: VAD pieces, each decoded alone, texts joined
            ps = phone_pieces(load(x['path'], 16000 * 60)); hs = []
            for i in range(0, len(ps), 8):
                lp, el = forward(m, ps[i:i + 8], False); hs += decode(m, lp.float(), el)
            r = norm(target(x['text'])); E += min(ed(norm(' '.join(hs)), r), len(r)); N += len(r)
    train_mode(m); return round(100 * E / max(N, 1), 2)

def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()[:16]

def main():
    import nemo.collections.asr as A
    # keep PyTorch inside dedicated VRAM (no spill to Windows shared GPU memory, which is slow): MEMFRAC of the 6 GB
    torch.cuda.set_per_process_memory_fraction(float(os.environ.get('MEMFRAC', 0.85)))
    random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED)
    os.makedirs(OUT, exist_ok=True)
    tr, ev = data()
    if DRY:
        tr = {k: v[:16] for k, v in tr.items()}; ev = {k: v[:4] for k, v in ev.items()}
    for k in tr:
        for x in tr[k]:
            if 'dur' not in x:
                try: x['dur'] = sf.info(x['path']).duration
                except Exception: x['dur'] = 6
    log('LEVEL %s init=%s steps=%d mix=%s freeze=%.2f | train %s | eval %s' % (LEVEL, INIT or 'base', STEPS, MIX, FREEZE,
        {k: '%d/%.2fh' % (len(v), sum(x['dur'] for x in v) / 3600) for k, v in tr.items()}, {k: len(v) for k, v in ev.items()}))
    json.dump({k: [x['id'] for x in v] for k, v in tr.items()}, open(os.path.join(OUT, 'train_ids.json'), 'w'), indent=0)  # B8
    if INIT: m = A.models.ASRModel.restore_from(INIT, map_location='cuda')
    else:
        from huggingface_hub import hf_hub_download
        m = A.models.ASRModel.restore_from(hf_hub_download(*BASE), map_location='cuda')
    m.change_decoding_strategy(decoder_type='ctc')
    for p in m.parameters(): p.requires_grad = True
    for p in m.preprocessor.parameters(): p.requires_grad = False
    for p in m.encoder.pre_encode.parameters(): p.requires_grad = False
    n = len(m.encoder.layers)
    for layer in m.encoder.layers[:int(n * FREEZE)]:
        for p in layer.parameters(): p.requires_grad = False
    for name in ('decoder', 'joint'):   # RNNT branch, unused on the phone
        if hasattr(m, name):
            for p in getattr(m, name).parameters(): p.requires_grad = False
    res = J(RES) if os.path.exists(RES) and not DRY else {}
    key = 'base' if not INIT else 'init_' + LEVEL
    if key not in res or DRY:
        res[key] = {k: cer(m, v) for k, v in ev.items()}; log('MEASURE %s %s' % (key, res[key]))
        if not DRY: json.dump(res, open(RES, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    ref = res[key]; R = res.setdefault(LEVEL, {}) if not DRY else {}
    params = [p for p in m.parameters() if p.requires_grad]
    log('trainable %.1fM of %.1fM' % (sum(p.numel() for p in params) / 1e6, sum(p.numel() for p in m.parameters()) / 1e6))
    opt = torch.optim.AdamW(params, lr=LR, weight_decay=1e-3)
    steps = 2 if DRY else STEPS
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1.0, (s + 1) / WARM) * max(0.0, 1 - max(0, s - WARM) / max(1, steps - WARM)))
    scaler = torch.amp.GradScaler('cuda', enabled=AMP); rnd = random.Random(SEED)
    srcs, shares = list(MIX), [MIX[k] for k in MIX]
    def batch():
        b, t = [], 0.0
        while t < BATCH_SEC:
            s = rnd.choices(srcs, shares)[0]; x = rnd.choices(tr[s], [c['pw'] for c in tr[s]])[0]
            b.append(x); t += x['dur']
        return b
    best = None; train_mode(m); t0 = time.time()
    for step in range(1, steps + 1):
        for _ in range(ACC):
            b = batch(); tg = [m.tokenizer.text_to_ids(target(x['text'])) for x in b]
            with torch.autocast('cuda', dtype=torch.float16, enabled=AMP):
                lp, el = forward(m, [augment(load(x['path']), rnd) for x in b], True)
            T = torch.tensor([len(t) for t in tg]); Y = torch.tensor([i for t in tg for i in t])
            loss = torch.nn.functional.ctc_loss(lp.float().transpose(0, 1), Y, el.cpu(), T,
                                                blank=m.tokenizer.vocab_size, zero_infinity=True) / ACC
            scaler.scale(loss).backward()
        scaler.unscale_(opt); torch.nn.utils.clip_grad_norm_(params, 1.0); scaler.step(opt); scaler.update(); opt.zero_grad(); sched.step()
        if step % 50 == 0 or DRY:
            log('step %d/%d loss %.3f lr %.2e %.1f s/step GPU %.2f GB' % (step, steps, loss.item() * ACC, sched.get_last_lr()[0],
                (time.time() - t0) / step, torch.cuda.max_memory_allocated() / 1e9))
        if step % EVAL == 0 or step == steps:
            r = {k: cer(m, v) for k, v in ev.items()}; R['step%d' % step] = r; log('MEASURE step %d %s' % (step, r))
            own = 'test_' + LEVEL
            clean_ok = all(r[k] <= ref[k] + 0.3 for k in ('ho_reciters', 'ho_retasy', 'tlog') if r.get(k) is not None)
            noisy_ok = all(r[k] <= ref[k] for k in ('noisy20', 'noisy10', 'noisy5') if r.get(k) is not None)
            if clean_ok and noisy_ok and r[own] < ref[own] and (best is None or r[own] < best[1]):
                best = (step, r[own])
                if not DRY:
                    p = os.path.join(OUT, 'best.nemo'); m.save_to(p); R['best_sha'] = sha(p)
                log('best = step %d (%s CER %.2f, ref %.2f)' % (step, own, r[own], ref[own]))
            if SAVE_ALL and not DRY: m.save_to(os.path.join(OUT, 'step%d.nemo' % step))
            R['best'] = best
            if not DRY: json.dump(res, open(RES, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    if not DRY: m.save_to(os.path.join(OUT, 'last.nemo'))   # kept for diagnosis even when no step passed the proxy gate
    log('DONE %s: %s' % (LEVEL, 'best step %d -> %s; next: nv_gate (export int8 + bench)' % (best[0], OUT + '\\best.nemo')
                          if best else 'no step passed the proxy gate'))

if __name__ == '__main__':
    main()
