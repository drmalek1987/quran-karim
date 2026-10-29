# Cuts a long recitation at its pauses into pieces of up to ~20 s and transcribes each with a Quran Whisper model.
import sys, json, numpy as np, soundfile as sf, librosa, torch
from transformers import WhisperProcessor, WhisperForConditionalGeneration, GenerationConfig
src, out, M = sys.argv[1], sys.argv[2], sys.argv[3]
torch.set_num_threads(4)
y, sr = sf.read(src, dtype='float32')
iv = librosa.effects.split(y, top_db=32, frame_length=2048, hop_length=512)
segs, cur = [], None
for a, b in iv:
    if cur and (a - cur[1] < 0.35 * sr) and (b - cur[0] < 20 * sr): cur[1] = b; continue
    if cur: segs.append(cur)
    cur = [a, b]
segs.append(cur)
segs = [s for s in segs if s[1] - s[0] > 0.8 * sr]
# long stretches without a pause are cut into 20 s pieces
fin = []
for a, b in segs:
    while b - a > 22 * sr: fin.append([a, a + 20 * sr]); a += 20 * sr
    fin.append([a, b])
proc = WhisperProcessor.from_pretrained(M); model = WhisperForConditionalGeneration.from_pretrained(M).eval()
if not hasattr(model.generation_config, 'lang_to_id'):
    base = {384: 'tiny', 512: 'base', 768: 'small'}[model.config.d_model]
    model.generation_config = GenerationConfig.from_pretrained('openai/whisper-' + base)
import os
res = json.load(open(out)) if os.path.exists(out) else []
done_to = res[-1]['b'] * sr if res else 0
for i, (a, b) in enumerate(fin):
    if a < done_to - 1: continue
    f = proc(y[a:b], sampling_rate=sr, return_tensors='pt').input_features
    with torch.no_grad(): t = proc.batch_decode(model.generate(f, language='ar', task='transcribe', max_new_tokens=220), skip_special_tokens=True)[0]
    res.append({'a': round(a / sr, 2), 'b': round(b / sr, 2), 'hyp': t})
    if i % 20 == 0: print(i, len(fin), res[-1], flush=True); json.dump(res, open(out, 'w'), ensure_ascii=False)
json.dump(res, open(out, 'w'), ensure_ascii=False)
print('done', len(res))
