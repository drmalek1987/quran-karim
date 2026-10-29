# Fine-tunes the Quran Whisper model (deepdml/whisper-base-ar-quran-mix-norm) on tarteel-ai/tlog on an NVIDIA GPU.
# Steps (each resumes if stopped): 1 fetch a balanced tlog sample (up to 3 recordings per ayah, 300 ayahs held out),
# 2 measure the base model, 3 train, measuring every EVAL steps on the held-out ayahs and on HA's own 99 clips
# (exactly as recorded), keeping the best checkpoint in out/best. Progress goes to progress.txt and results.json.
import os, sys, io, json, random, re, time, glob, collections, threading
import numpy as np, soundfile as sf, librosa, torch
D = os.path.dirname(os.path.abspath(__file__)); os.chdir(D)
STEPS, BS, LR, EVAL, K = int(os.environ.get('STEPS', 6000)), 16, 1e-5, 500, 3
TOKEN = os.environ.get('HF_TOKEN', '').strip()
BASE = 'deepdml/whisper-base-ar-quran-mix-norm'
WTOK = open('hf_write_token.txt').read().strip() if os.path.exists('hf_write_token.txt') else ''
_last = [0]
def report(force=False):   # copies progress.txt and results.json to a private Hugging Face repo so Claude can follow along
    if not WTOK or (not force and time.time() - _last[0] < 600): return
    _last[0] = time.time()
    def up():
        try:
            from huggingface_hub import HfApi
            api = HfApi(token=WTOK); repo = api.whoami()['name'] + '/quran-train-progress'
            api.create_repo(repo, repo_type='dataset', private=True, exist_ok=True)
            for f in ('progress.txt', 'results.json'):
                if os.path.exists(f): api.upload_file(path_or_fileobj=f, path_in_repo=f, repo_id=repo, repo_type='dataset')
        except Exception as e: print('report failed:', e, flush=True)
    threading.Thread(target=up, daemon=True).start()
def log(*a):
    s = time.strftime('%H:%M:%S ') + ' '.join(map(str, a)); print(s, flush=True)
    open('progress.txt', 'a', encoding='utf8').write(s + '\n'); report('MEASURE' in s or 'DONE' in s)
T = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]')
def norm(t):
    t = T.sub('', t); t = re.sub('[ٱأإآ]', 'ا', t); t = re.sub('[ىی]', 'ي', t)
    t = t.replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي'); t = re.sub('[^ء-ي ]', ' ', t); return re.sub(r'\s+', ' ', t).strip()

def fetch():
    import fsspec, pyarrow.parquet as pq
    from concurrent.futures import ThreadPoolExecutor
    os.makedirs('data/clips', exist_ok=True)
    fs = fsspec.filesystem('https', headers={'Authorization': 'Bearer ' + TOKEN}, client_kwargs={'trust_env': True, 'timeout': __import__('aiohttp').ClientTimeout(total=None, sock_connect=30, sock_read=60)})
    sv = {k: v for k, v in json.load(open('survey.json', encoding='utf8')).items() if k.startswith('clean') and isinstance(v, dict)}
    got = collections.Counter(); lock = threading.Lock()
    for f in glob.glob('data/clips/meta-*.json'):
        for m in json.load(open(f, encoding='utf8')): got[m['text']] += 1
    todo = [k for k in sorted(sv)[:int(os.environ.get('MAXSHARDS', 9999))] if not os.path.exists('data/clips/meta-%s.json' % k)]
    log('fetch: %d of %d shards left' % (len(todo), len(sv)))
    def one(k):
        meta = []; i = int(k.split('-')[1])
        url = 'https://huggingface.co/datasets/tarteel-ai/tlog/resolve/main/data/clean-%05d-of-00411.parquet' % i
        for attempt in range(4):
            try:
                with fs.open(url, block_size=2 ** 22) as fh:
                    pf = pq.ParquetFile(fh)
                    for g in range(pf.num_row_groups):
                        labs = pf.read_row_group(g, columns=['label']).column('label').to_pylist()
                        with lock:
                            take = [j for j, l in enumerate(labs) if got[l] < K + 1 and not got.update([l])]
                        if not take: continue
                        aud = pf.read_row_group(g, columns=['audio']).column('audio').to_pylist()
                        for j in take:
                            try: y, sr = sf.read(io.BytesIO(aud[j]['bytes']), dtype='float32')
                            except Exception: continue
                            if y.ndim > 1: y = y.mean(1)
                            if not (1.0 <= len(y) / sr <= 28): continue
                            kk = '%s_%d_%d' % (k, g, j); sf.write('data/clips/%s.wav' % kk, librosa.resample(y, orig_sr=sr, target_sr=16000), 16000)
                            meta.append({'id': kk, 'text': labs[j]})
                json.dump(meta, open('data/clips/meta-%s.json' % k, 'w', encoding='utf8'), ensure_ascii=False); return k, len(meta)
            except Exception as e:
                err = e; time.sleep(5 * (attempt + 1))
        return k, 'failed: %s' % err
    n = 0
    with ThreadPoolExecutor(8) as ex:
        for d, (k, c) in enumerate(ex.map(one, todo)):
            n += c if isinstance(c, int) else 0
            log('fetch %d/%d shards, %d clips' % (d + 1, len(todo), n), '' if isinstance(c, int) else k + ' ' + c)

def split():
    if os.path.exists('data/train.json'): return
    m = [x for f in glob.glob('data/clips/meta-*.json') for x in json.load(open(f, encoding='utf8')) if isinstance(x['text'], str)]
    by = collections.defaultdict(list)
    for x in m: by[x['text']].append(x)
    random.seed(9); keys = [k for k, v in by.items() if len(v) >= 2]; random.shuffle(keys)
    test = [by[k].pop() for k in keys[:300]]
    json.dump([x for v in by.values() for x in v], open('data/train.json', 'w', encoding='utf8'), ensure_ascii=False)
    json.dump(test, open('data/test.json', 'w', encoding='utf8'), ensure_ascii=False)
    log('data: %d training clips, %d ayahs, %d held-out test clips' % (len(m) - len(test), len(by), len(test)))

def ed(a, b):
    p = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        c = [i]
        for j, y in enumerate(b, 1): c.append(min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (x != y)))
        p = c
    return p[-1]
def cer(model, proc, items, folder):
    model.eval(); E = L = 0
    for i in range(0, len(items), 16):
        ch = items[i:i + 16]
        f = proc.feature_extractor([sf.read(os.path.join(folder, x['id'] + '.wav'), dtype='float32')[0] for x in ch], sampling_rate=16000, return_tensors='pt').input_features.to('cuda', torch.float16)
        with torch.no_grad(), torch.autocast('cuda', dtype=torch.float16):
            out = proc.batch_decode(model.generate(f, language='ar', task='transcribe', max_new_tokens=200, no_repeat_ngram_size=3), skip_special_tokens=True)
        for x, h in zip(ch, out): r = norm(x['text']); E += min(ed(norm(h), r), len(r)); L += len(r)
    model.train(); return round(100 * E / L, 1)

def keep(b): return b

class DS(torch.utils.data.Dataset):
    def __init__(s, items, proc, noise): s.items, s.proc, s.noise = items, proc, noise
    def __len__(s): return len(s.items)
    def __getitem__(s, i):
        x = s.items[i]; y = sf.read('data/clips/%s.wav' % x['id'], dtype='float32')[0]
        if random.random() < 0.2:   # light changes only: tlog is already real phones and rooms
            r = random.random()
            if r < 0.4: y = librosa.resample(y, orig_sr=16000, target_sr=int(16000 * random.uniform(0.9, 1.1)))
            elif r < 0.7: y = librosa.effects.pitch_shift(y, sr=16000, n_steps=random.uniform(-2, 2))
            else:
                n = s.noise[random.randrange(len(s.noise))]; n = np.tile(n, len(y) // len(n) + 1)[:len(y)]
                y = y + n * np.sqrt((y ** 2).mean() / ((n ** 2).mean() + 1e-9) / 10 ** (random.uniform(5, 25) / 10))
        f = s.proc.feature_extractor(y.astype(np.float32), sampling_rate=16000, return_tensors='pt').input_features[0]
        return f, norm(x['text'])

def main():
    from transformers import WhisperProcessor, WhisperForConditionalGeneration, GenerationConfig
    from huggingface_hub import snapshot_download
    assert torch.cuda.is_available(), 'No NVIDIA GPU found by PyTorch'
    log('GPU:', torch.cuda.get_device_name(0))
    fetch(); split()
    base = snapshot_download(BASE, token=TOKEN or None)
    proc = WhisperProcessor.from_pretrained(base)
    src = 'out/last' if os.path.exists('out/last/config.json') else base
    model = WhisperForConditionalGeneration.from_pretrained(src).cuda()
    model.generation_config = GenerationConfig.from_pretrained('openai/whisper-base')
    model.config.forced_decoder_ids = None; model.generation_config.forced_decoder_ids = None
    train, test = json.load(open('data/train.json', encoding='utf8')), json.load(open('data/test.json', encoding='utf8'))
    ha = json.load(open('ha_test/meta-ha.json', encoding='utf8'))
    res = json.load(open('results.json')) if os.path.exists('results.json') else {}
    if 'base' not in res:
        log('measuring the base model ...')
        bm = WhisperForConditionalGeneration.from_pretrained(base).cuda(); bm.generation_config = model.generation_config
        res['base'] = {'tlog_test': cer(bm, proc, test, 'data/clips'), 'ha': cer(bm, proc, ha, 'ha_test')}; del bm
        json.dump(res, open('results.json', 'w'), indent=1); log('base model: errors %% tlog test %s, your voice %s' % (res['base']['tlog_test'], res['base']['ha']))
    rng = np.random.default_rng(1); noise = [rng.standard_normal(16000 * 10).astype(np.float32), np.cumsum(rng.standard_normal(16000 * 10)).astype(np.float32)]
    noise[1] -= np.convolve(noise[1], np.ones(400) / 400, 'same')
    dl = torch.utils.data.DataLoader(DS(train, proc, noise), batch_size=BS, shuffle=True, num_workers=4, drop_last=True, persistent_workers=True, collate_fn=keep)
    opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=0.01); scaler = torch.cuda.amp.GradScaler()
    st = json.load(open('out/last/state.json')) if os.path.exists('out/last/state.json') else {'step': 0}
    if os.path.exists('out/last/opt.pt'): opt.load_state_dict(torch.load('out/last/opt.pt'))
    prefix = proc.tokenizer.convert_tokens_to_ids(['<|startoftranscript|>', '<|ar|>', '<|transcribe|>', '<|notimestamps|>']); eot = proc.tokenizer.eos_token_id
    best = min([v['tlog_test'] for v in res.values()]); t0 = time.time(); losses = []
    model.train()
    while st['step'] < STEPS:
        for b in dl:
            if st['step'] >= STEPS: break
            s = st['step']
            for g in opt.param_groups: g['lr'] = LR * min(1, (s + 1) / 200) * max(0.05, 1 - s / STEPS)
            feats = torch.stack([f for f, _ in b]).to('cuda')
            toks = [prefix + proc.tokenizer.encode(' ' + t, add_special_tokens=False)[:400] + [eot] for _, t in b]
            Lm = max(map(len, toks)); ids = torch.full((len(b), Lm), eot); lab = torch.full((len(b), Lm), -100)
            for i, t in enumerate(toks): ids[i, :len(t)] = torch.tensor(t); lab[i, :len(t) - 1] = torch.tensor(t[1:])
            with torch.autocast('cuda', dtype=torch.float16):
                lg = model(input_features=feats, decoder_input_ids=ids[:, :-1].cuda()).logits
                loss = torch.nn.functional.cross_entropy(lg.float().reshape(-1, lg.size(-1)), lab[:, :-1].reshape(-1).cuda(), ignore_index=-100)
            scaler.scale(loss).backward(); scaler.unscale_(opt); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(opt); scaler.update(); opt.zero_grad(); st['step'] += 1; losses.append(loss.item())
            if st['step'] % 50 == 0:
                left = (time.time() - t0) / 50 * (STEPS - st['step']) / 3600; t0 = time.time()
                log('step %d/%d  loss %.3f  about %.1f h left' % (st['step'], STEPS, np.mean(losses[-50:]), left))
            if st['step'] % EVAL == 0 or st['step'] == STEPS:
                r = {'tlog_test': cer(model, proc, test, 'data/clips'), 'ha': cer(model, proc, ha, 'ha_test')}; res['step %d' % st['step']] = r
                json.dump(res, open('results.json', 'w'), indent=1)
                log('MEASURE step %d: errors %% tlog test %s (base %s), your voice %s (base %s)' % (st['step'], r['tlog_test'], res['base']['tlog_test'], r['ha'], res['base']['ha']))
                os.makedirs('out/last', exist_ok=True); model.save_pretrained('out/last'); proc.save_pretrained('out/last')
                torch.save(opt.state_dict(), 'out/last/opt.pt'); json.dump(st, open('out/last/state.json', 'w'))
                if r['tlog_test'] < best:
                    best = r['tlog_test']; model.save_pretrained('out/best'); proc.save_pretrained('out/best'); log('  new best model saved in out\\best')
    log('DONE. Send Claude the file results.json (or the last lines above).')

if __name__ == '__main__': main()
