# Fine-tunes the phone's recogniser, NVIDIA's Arabic FastConformer (nvidia/stt_ar_fastconformer_hybrid_large_pcd_v1.0),
# on the readers' donated clips (DrAbdelraman/quran-voice-donations, from the app's voice hifz test), mixed with tlog so it
# keeps working for every voice. Only the CTC branch is trained (the app runs CTC), on 6 GB: fp16, the lower half of the
# encoder frozen, batches of about BATCH_SEC seconds of audio.
# Donations are split BY DEVICE (10% of devices held out), so no reader is in both training and test; their "corrected"
# clips (the model's hard cases, marked «أنا قريت صح») are measured separately. The best checkpoint is kept only if the
# held-out donations improve and tlog / HA's voice / corrected do not get worse by more than GATE points; then
# export.bat --ckpt nv_out/best.nemo makes the phone model. Progress goes to progress.txt like gpu_train.py.
# Run: nv_train.bat (DRY=1 for one tiny step to check memory and data).
import os, sys, io, json, glob, random, time, hashlib, collections
import numpy as np, soundfile as sf, librosa, torch
D = os.path.dirname(os.path.abspath(__file__)); os.chdir(D)
import gpu_train as G
from gpu_train import norm, ed, log
DRY = os.environ.get('DRY') == '1'
STEPS, EVAL = int(os.environ.get('STEPS', 4000)), int(os.environ.get('EVAL', 400))
LR, BATCH_SEC, ACC = float(os.environ.get('LR', 1e-5)), float(os.environ.get('BATCH_SEC', 60)), int(os.environ.get('ACC', 2))
TLOG_SHARE, GATE = float(os.environ.get('TLOG_SHARE', 0.3)), float(os.environ.get('GATE', 0.3))
REPO = os.environ.get('DATASET', 'DrAbdelraman/quran-voice-donations')
BASE = ('nvidia/stt_ar_fastconformer_hybrid_large_pcd_v1.0', 'stt_ar_fastconformer_hybrid_large_pcd_v1.0.nemo')
OUT, RES = 'nv_out', 'nv_results.json'
MAX_CER = {'auto': 0.35, 'corrected': 0.6}   # same limits as the relay

def h16(s): return hashlib.sha256(s.encode()).hexdigest()[:16]

def fetch_donations():
    """Downloads the dataset and returns [{path, text, dev, kind, srv_cer, dur}] for usable clips."""
    from huggingface_hub import snapshot_download
    root = snapshot_download(REPO, repo_type='dataset', token=G.TOKEN or None, local_dir='data/don', allow_patterns=['clips/**'])
    out, skipped = [], collections.Counter()
    for j in glob.glob(os.path.join(root, 'clips', '**', '*.json'), recursive=True):
        parts = os.path.relpath(j, root).replace('\\', '/').split('/')
        try: m = json.load(open(j, encoding='utf8'))
        except Exception: skipped['json'] += 1; continue
        a = next((j[:-5] + e for e in ('.flac', '.wav') if os.path.exists(j[:-5] + e)), None)
        if not a or not isinstance(m.get('text'), str): skipped['audio'] += 1; continue
        # new layout clips/<devhash16>/<date>/<id>; 4.8's layout clips/<date>/<id> kept the raw id in the json
        dev = parts[1] if len(parts) == 4 and len(parts[1]) == 16 else h16(str(m.get('device') or 'anon'))
        kind = 'corrected' if m.get('kind') == 'corrected' else 'auto'
        c = m.get('srv_cer')
        if c is not None and c > MAX_CER[kind]: skipped['cer'] += 1; continue
        q = m.get('q') or {}
        if q and (q.get('rms', 0) < -40 or q.get('clip', 0) > 0.005 or q.get('snr', 99) < 10): skipped['quality'] += 1; continue
        out.append({'path': a, 'text': m['text'], 'dev': dev, 'kind': kind, 'srv_cer': c})
    log('donations: %d usable clips from %d devices, skipped %s' % (len(out), len({x['dev'] for x in out}), dict(skipped)))
    return out

def split_by_device(clips):
    devs = sorted({x['dev'] for x in clips}); random.Random(9).shuffle(devs)
    test = set(devs[:max(1, len(devs) // 10)]) if len(devs) >= 2 else set()
    tr = [x for x in clips if x['dev'] not in test]
    te = [x for x in clips if x['dev'] in test and x['kind'] == 'auto']
    corr = [x for x in clips if x['dev'] in test and x['kind'] == 'corrected']
    log('split by device: %d train clips (%d devices), test %d auto + %d corrected clips (%d devices)' % (len(tr), len(devs) - len(test), len(te), len(corr), len(test)))
    return tr, te, corr

def load(x):
    y, sr = sf.read(x['path'], dtype='float32', always_2d=True); y = y.mean(1)
    if sr != 16000: y = librosa.resample(y, orig_sr=sr, target_sr=16000)
    return y[:16000 * 20]

def batches(items, sec):
    """Random batches of about `sec` seconds of audio."""
    b, t = [], 0.0
    for x in items:
        b.append(x); t += x.get('dur') or 6
        if t >= sec: yield b; b, t = [], 0.0
    if b: yield b

def forward(m, ys, train):
    L = torch.tensor([len(y) for y in ys], device='cuda'); X = torch.zeros(len(ys), int(L.max()), device='cuda')
    for i, y in enumerate(ys): X[i, :len(y)] = torch.from_numpy(y)
    f, fl = m.preprocessor(input_signal=X, length=L)
    if train and m.spec_augmentation is not None: f = m.spec_augmentation(input_spec=f, length=fl)
    e, el = m.encoder(audio_signal=f, length=fl)
    return m.ctc_decoder(encoder_output=e), el   # log-probs (B, T, V+1), blank = V

def decode(m, lp, el):
    out, V = [], m.tokenizer.vocab_size
    for row, n in zip(lp.argmax(-1).tolist(), el.tolist()):
        ids, prev = [], -1
        for t in row[:n]:
            if t != prev and t < V: ids.append(t)
            prev = t
        out.append(m.tokenizer.ids_to_text(ids))
    return out

def cer(m, items):
    if not items: return None
    m.eval(); E = Ln = 0
    with torch.no_grad(), torch.autocast('cuda', dtype=torch.float16):
        for i in range(0, len(items), 8):
            ch = items[i:i + 8]; lp, el = forward(m, [load(x) for x in ch], False)
            for x, h in zip(ch, decode(m, lp.float(), el)): r = norm(x['text']); E += min(ed(norm(h), r), len(r)); Ln += len(r)
    m.train(); return round(100 * E / max(Ln, 1), 2)

def main():
    import nemo.collections.asr as A
    from huggingface_hub import hf_hub_download
    os.makedirs(OUT, exist_ok=True)
    don = fetch_donations()
    if not don: log('nv_train: no usable donations yet, nothing to train'); return
    tr_d, te_d, te_c = split_by_device(don)
    if not os.environ.get('NO_TLOG'):
        G.fetch(); G.split()
    tl_tr = [dict(x, path=os.path.join('data/clips', x['id'] + '.wav')) for x in json.load(open('data/train.json', encoding='utf8'))] if os.path.exists('data/train.json') else []
    tl_te = [dict(x, path=os.path.join('data/clips', x['id'] + '.wav')) for x in json.load(open('data/test.json', encoding='utf8'))[:150]] if os.path.exists('data/test.json') else []
    ha = [dict(x, path=os.path.join('ha_test', x['id'] + '.wav')) for x in json.load(open('ha_test/meta-ha.json', encoding='utf8'))] if os.path.exists('ha_test/meta-ha.json') else []
    if DRY: tr_d, te_d, te_c, tl_tr, tl_te, ha = tr_d[:16], te_d[:8], te_c[:8], tl_tr[:16], tl_te[:8], ha[:8]
    for x in tr_d + tl_tr:
        try: x['dur'] = sf.info(x['path']).duration
        except Exception: x['dur'] = 6
    m = A.models.ASRModel.restore_from(hf_hub_download(*BASE), map_location='cuda'); m.change_decoding_strategy(decoder_type='ctc')
    # frozen: the feature front end and the lower half of the encoder (less forgetting, fits in 6 GB)
    for p in m.encoder.pre_encode.parameters(): p.requires_grad = False
    n = len(m.encoder.layers)
    for layer in m.encoder.layers[:n // 2]:
        for p in layer.parameters(): p.requires_grad = False
    if hasattr(m, 'decoder'):
        for p in m.decoder.parameters(): p.requires_grad = False   # RNNT branch, unused on the phone
    if hasattr(m, 'joint'):
        for p in m.joint.parameters(): p.requires_grad = False
    sets = {'don_test': te_d, 'corrected_test': te_c, 'tlog_test': tl_te, 'ha': ha}
    def measure(tag):
        r = {k: cer(m, v) for k, v in sets.items()}; log('MEASURE %s: %s' % (tag, r)); return r
    res = json.load(open(RES, encoding='utf8')) if os.path.exists(RES) and not DRY else {}
    res['base'] = base = measure('base'); json.dump(res, open(RES, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    params = [p for p in m.parameters() if p.requires_grad]
    opt = torch.optim.AdamW(params, lr=LR, weight_decay=1e-3); scaler = torch.cuda.amp.GradScaler()
    steps = 2 if DRY else STEPS; best = None; rnd = random.Random(1)
    def pool():
        while True:
            src = tl_tr if (tl_tr and rnd.random() < TLOG_SHARE) else tr_d
            items = rnd.sample(src, min(len(src), 64)); yield from batches(items, BATCH_SEC)
    it = pool(); m.train(); t0 = time.time()
    for step in range(1, steps + 1):
        for _ in range(ACC):
            b = next(it)
            tg = [m.tokenizer.text_to_ids(norm(x['text'])) for x in b]
            with torch.autocast('cuda', dtype=torch.float16):
                lp, el = forward(m, [load(x) for x in b], True)
            T = torch.tensor([len(t) for t in tg]); Y = torch.tensor([i for t in tg for i in t])
            loss = torch.nn.functional.ctc_loss(lp.float().transpose(0, 1), Y, el.cpu(), T, blank=m.tokenizer.vocab_size, zero_infinity=True) / ACC
            scaler.scale(loss).backward()
        scaler.unscale_(opt); torch.nn.utils.clip_grad_norm_(params, 1.0); scaler.step(opt); scaler.update(); opt.zero_grad()
        if step % 50 == 0 or DRY: log('step %d/%d loss %.3f, %.1f s/step, GPU %.1f GB' % (step, steps, loss.item() * ACC, (time.time() - t0) / step, torch.cuda.max_memory_allocated() / 1e9))
        if step % EVAL == 0 or step == steps:
            r = measure('step %d' % step); res['step%d' % step] = r
            ok = all(r[k] is None or base[k] is None or r[k] <= base[k] + GATE for k in ('tlog_test', 'ha', 'corrected_test'))
            if ok and r['don_test'] is not None and r['don_test'] < base['don_test'] and (best is None or r['don_test'] < best[1]):
                best = (step, r['don_test'])
                if not DRY: m.save_to(os.path.join(OUT, 'best.nemo'))
                log('kept step %d as best (held-out donations %.2f%%, base %.2f%%)' % (step, r['don_test'], base['don_test']))
            res['best'] = best; json.dump(res, open(RES, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    log('nv_train DONE: %s' % ('best step %d, held-out donations %.2f%% (base %.2f%%); export with: export.bat --ckpt %s' % (best[0], best[1], base['don_test'], OUT + '/best.nemo') if best else 'no checkpoint passed the gate, keep the current phone model'))
    G.report(True)

if __name__ == '__main__':
    main()
