import sys, json, fsspec, pyarrow.parquet as pq, ssl, collections
from concurrent.futures import ThreadPoolExecutor
fs = fsspec.filesystem('https', client_kwargs={'trust_env': True}, ssl=ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt'))
def one(i):
    for sp, n in (('clean', 411), ('unclean', 332)):
        pass
    sp, i = i
    try:
        with fs.open('https://huggingface.co/datasets/tarteel-ai/tlog/resolve/main/data/%s-%05d-of-%05d.parquet' % (sp, i, 411 if sp == 'clean' else 332), block_size=2**20) as fh:
            return sp, i, collections.Counter(pq.ParquetFile(fh).read(columns=['label']).column('label').to_pylist())
    except Exception as e: return sp, i, str(e)
jobs = [('clean', i) for i in range(411)] + [('unclean', i) for i in range(332)]
res = {}
with ThreadPoolExecutor(16) as ex:
    for sp, i, c in ex.map(one, jobs): res['%s-%d' % (sp, i)] = c if isinstance(c, str) else dict(c)
json.dump(res, open('survey.json', 'w'), ensure_ascii=False)
allc = collections.Counter()
for v in res.values():
    if isinstance(v, dict): allc.update(v)
print('shards', len(res), 'fails', sum(isinstance(v, str) for v in res.values()), 'rows', sum(allc.values()), 'distinct ayahs', len(allc))
