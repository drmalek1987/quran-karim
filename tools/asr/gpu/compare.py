# Measures other ready-made Quran/Arabic speech models on the same held-out tlog ayahs and HA's clips, with the same
# error measure as gpu_train.py, and uploads compare.json (scores + sample transcripts) for Claude.
import os, sys, json, time
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from gpu_train import norm, ed, log, WTOK
from huggingface_hub import hf_hub_download, HfApi
import nemo.collections.asr as A
MODELS = {'nvidia-fastconformer-ar': ('nvidia/stt_ar_fastconformer_hybrid_large_pcd_v1.0', 'stt_ar_fastconformer_hybrid_large_pcd_v1.0.nemo'),
          'fastconformer-quran': ('Muno459/fastconformer-quran', 'nemo/fastconformer-quran.nemo'),
          'mohammed-quran-everyayah': ('mohammed/fastconformer-quran-ar', 'phase3_full/phase3_full_wer0.0014.nemo')}
test = json.load(open('data/test.json', encoding='utf8')); ha = json.load(open('ha_test/meta-ha.json', encoding='utf8'))
out = json.load(open('compare.json', encoding='utf8')) if os.path.exists('compare.json') else {}
for name, (repo, fn) in MODELS.items():
    if name in out: continue
    try: path = hf_hub_download(repo, fn, token=os.environ.get('HF_TOKEN') or None)
    except Exception as e: log('compare: %s not available yet (%s)' % (name, str(e)[:80])); continue
    m = A.models.ASRModel.restore_from(path, map_location='cuda').eval(); r = {}
    for tag, items, folder in (('tlog_test', test, 'data/clips'), ('ha', ha, 'ha_test')):
        t0 = time.time(); hy = m.transcribe([os.path.join(folder, x['id'] + '.wav') for x in items], batch_size=8)
        if isinstance(hy, tuple): hy = hy[0]
        hy = [h.text if hasattr(h, 'text') else h for h in hy]; E = L = 0
        for x, h in zip(items, hy): t = norm(x['text']); E += min(ed(norm(h), t), len(t)); L += len(t)
        r[tag] = round(100 * E / L, 1); r[tag + '_sec'] = round(time.time() - t0, 1)
        r[tag + '_samples'] = [[x['text'], h] for x, h in zip(items[:25], hy[:25])]
    out[name] = r; json.dump(out, open('compare.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    log('COMPARE %s: errors %% tlog test %s, your voice %s' % (name, r['tlog_test'], r['ha']))
    del m
if WTOK:
    api = HfApi(token=WTOK); repo = api.whoami()['name'] + '/quran-train-progress'
    api.upload_file(path_or_fileobj='compare.json', path_in_repo='compare.json', repo_id=repo, repo_type='dataset'); print('uploaded compare.json')
