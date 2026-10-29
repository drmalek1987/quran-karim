# CER on held-out tlog clips, clean and with noise at 10 dB
import sys, json, glob, re, random, numpy as np, soundfile as sf, torch
from transformers import WhisperProcessor, WhisperForConditionalGeneration, GenerationConfig
M, D, N = sys.argv[1], sys.argv[2], int(sys.argv[3]); torch.set_num_threads(int(__import__("os").environ.get("NT","4"))); random.seed(3)
T = re.compile('[ً-ٰٟۖ-ۭـ]')
def norm(t):
    t = T.sub('', t); t = re.sub('[ٱأإآ]', 'ا', t); t = re.sub('[ىی]', 'ي', t)
    t = t.replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي'); t = re.sub('[^ء-ي ]', ' ', t); return re.sub(r'\s+', ' ', t).strip()
def ed(a, b):
    p = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        c = [i]
        for j, y in enumerate(b, 1): c.append(min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (x != y)))
        p = c
    return p[-1]
meta = sum((json.load(open(f)) for f in glob.glob(D + '/meta-*.json')), [])[:N]
noise = sf.read(sys.argv[4] if len(sys.argv) > 4 else '/tmp/claude-0/asrw/noise/n1.wav', dtype='float32')[0]
proc = WhisperProcessor.from_pretrained(M); m = WhisperForConditionalGeneration.from_pretrained(M).eval()
if not hasattr(m.generation_config, 'lang_to_id'): m.generation_config = GenerationConfig.from_pretrained('openai/whisper-base')
res = {}
for cond in (['clean'] if __import__('os').environ.get('CLEANONLY') else ['clean', '10dB']):
    E = L = 0
    for i in range(0, len(meta), 1):
        ch = meta[i:i + 1]; auds = []
        for x in ch:
            y = sf.read(f"{D}/{x['id']}.wav", dtype='float32')[0]
            if cond != 'clean':
                n = np.tile(noise, len(y) // len(noise) + 1)[:len(y)]; y = y + n * np.sqrt((y ** 2).mean() / ((n ** 2).mean() * 10))
            auds.append(y)
        f = proc.feature_extractor(auds, sampling_rate=16000, return_tensors='pt').input_features
        with torch.no_grad(): out = proc.batch_decode(m.generate(f, language='ar', task='transcribe', max_new_tokens=200, no_repeat_ngram_size=3), skip_special_tokens=True)
        for x, h in zip(ch, out): r = norm(x['text']); E += min(ed(norm(h), r), len(r)); L += len(r)
    res[cond] = round(100 * E / L, 1); print(cond, 'CER%', res[cond], flush=True)
print(json.dumps(res))
