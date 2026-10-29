# Takes a few ayahs per reciter from an everyayah test shard: 16 kHz mono wav + text, into clips/
import sys, os, io, random, json, collections
import pyarrow.parquet as pq, soundfile as sf, librosa, numpy as np
src, out, per = sys.argv[1], sys.argv[2], int(sys.argv[3])
os.makedirs(out, exist_ok=True)
pf = pq.ParquetFile(src); seen = collections.Counter(); meta = []
random.seed(7)
for b in pf.iter_batches(batch_size=64, columns=['audio', 'text', 'reciter', 'duration']):
    for r in b.to_pylist():
        if seen[r['reciter']] >= per or not (3 <= r['duration'] <= 20) or random.random() > 0.15: continue
        y, sr = sf.read(io.BytesIO(r['audio']['bytes']), dtype='float32')
        if y.ndim > 1: y = y.mean(1)
        y = librosa.resample(y, orig_sr=sr, target_sr=16000)
        k = '%s_%s_%03d' % (r['reciter'], os.path.basename(src).split('.')[0], seen[r['reciter']]); seen[r['reciter']] += 1
        sf.write(os.path.join(out, k + '.wav'), y, 16000)
        meta.append({'id': k, 'reciter': r['reciter'], 'text': r['text'], 'dur': r['duration']})
with open(os.path.join(out, 'meta-%s.json' % os.path.basename(src)), 'w') as f: json.dump(meta, f, ensure_ascii=False)
print(dict(seen))
