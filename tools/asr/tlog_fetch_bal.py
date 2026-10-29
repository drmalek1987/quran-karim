# balanced tlog sample: up to K recordings per ayah over all shards (clean first), read by row group over HTTP
import sys, os, io, json, random, ssl, collections, fsspec, pyarrow.parquet as pq, soundfile as sf, librosa
from concurrent.futures import ThreadPoolExecutor
K, OUT = 2, 'clips-bal'; os.makedirs(OUT, exist_ok=True); random.seed(5)
fs = fsspec.filesystem('https', client_kwargs={'trust_env': True}, ssl=ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt'))
sv = json.load(open('survey.json')); need = collections.Counter(); plan = []
for key in sorted(sv, key=lambda k: (k.startswith('unclean'), random.random())):
    if isinstance(sv[key], dict) and any(need[l] < K + 1 for l in sv[key]):
        plan.append(key); [need.update({l: 0}) for l in []]
        for l in sv[key]: need[l] = min(K + 1, need[l] + sv[key][l])
def url(k):
    sp, i = k.split('-'); return 'https://huggingface.co/datasets/tarteel-ai/tlog/resolve/main/data/%s-%05d-of-%05d.parquet' % (sp, int(i), 411 if sp == 'clean' else 332)
got = collections.Counter(); lock = __import__('threading').Lock()
def one(k):
    if os.path.exists(f'{OUT}/meta-{k}.json'): return k, 0
    meta = []
    try:
        with fs.open(url(k), block_size=2**22) as fh:
            pf = pq.ParquetFile(fh)
            for g in range(pf.num_row_groups):
                labs = pf.read_row_group(g, columns=['label']).column('label').to_pylist()
                with lock:
                    take = []
                    for j, l in enumerate(labs):
                        if got[l] < K + 1: got[l] += 1; take.append(j)
                if not take: continue
                aud = pf.read_row_group(g, columns=['audio']).column('audio').to_pylist()
                for j in take:
                    try: y, sr = sf.read(io.BytesIO(aud[j]['bytes']), dtype='float32')
                    except Exception: continue
                    if y.ndim > 1: y = y.mean(1)
                    if not (1.0 <= len(y) / sr <= 28): continue
                    kk = '%s_%d_%d' % (k, g, j); sf.write(f'{OUT}/{kk}.wav', librosa.resample(y, orig_sr=sr, target_sr=16000), 16000)
                    meta.append({'id': kk, 'text': labs[j]})
    except Exception as e: print(k, 'fail', e, flush=True); return k, -1
    json.dump(meta, open(f'{OUT}/meta-{k}.json', 'w'), ensure_ascii=False); return k, len(meta)
n = 0
with ThreadPoolExecutor(8) as ex:
    for k, c in ex.map(one, plan): n += max(c, 0); print(k, c, 'total', n, flush=True)
