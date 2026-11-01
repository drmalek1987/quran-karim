# Turns the NVIDIA Arabic FastConformer into a phone model: CTC branch -> ONNX -> int8, plus the token list and the
# feature settings. Then checks the int8 model end to end with plain numpy features (the same maths the app will do)
# on HA's clips and 150 held-out tlog ayahs, and uploads everything for Claude.
import os, json, time, numpy as np, soundfile as sf, torch
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from gpu_train import norm, ed, log, WTOK
from huggingface_hub import hf_hub_download, HfApi
import nemo.collections.asr as A
os.makedirs('phone', exist_ok=True)
m = A.models.ASRModel.restore_from(hf_hub_download('nvidia/stt_ar_fastconformer_hybrid_large_pcd_v1.0', 'stt_ar_fastconformer_hybrid_large_pcd_v1.0.nemo'), map_location='cpu').eval()
m.change_decoding_strategy(decoder_type='ctc')
pp = m.cfg.preprocessor; cfg = {k: (v if isinstance(v, (int, float, str, bool)) or v is None else str(v)) for k, v in dict(pp).items()}
vocab = [m.tokenizer.ids_to_tokens([i])[0] for i in range(m.tokenizer.vocab_size)]
json.dump({'preprocessor': cfg, 'vocab': vocab, 'blank': len(vocab)}, open('phone/model.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
log('export: preprocessor %s, %d tokens' % (cfg, len(vocab)))
if not os.path.exists('phone/model.fp32.onnx'):
    m.set_export_config({'decoder_type': 'ctc'}); m.export('phone/model.fp32.onnx')
from onnxruntime.quantization import quantize_dynamic, QuantType
if not os.path.exists('phone/model.int8.onnx'):
    quantize_dynamic('phone/model.fp32.onnx', 'phone/model.int8.onnx', weight_type=QuantType.QUInt8)
log('export: sizes MB fp32 %.0f, int8 %.0f' % (os.path.getsize('phone/model.fp32.onnx') / 1e6, os.path.getsize('phone/model.int8.onnx') / 1e6))

# numpy features, written the way the app will compute them
import librosa
SR, NF = 16000, int(cfg.get('n_fft') or 512); WIN = int(float(cfg.get('window_size', 0.025)) * SR); HOP = int(float(cfg.get('window_stride', 0.01)) * SR)
FB = librosa.filters.mel(sr=SR, n_fft=NF, n_mels=int(cfg.get('features', 80)), fmin=0, fmax=SR / 2, norm='slaney', htk=False).astype(np.float32)
np.save('phone/melbank.npy', FB)
HANN = np.hanning(WIN + 1)[:-1] if False else torch.hann_window(WIN, periodic=False).numpy()
def feats(y):
    y = np.append(y[0], y[1:] - 0.97 * y[:-1]).astype(np.float32)
    y = np.pad(y, NF // 2); n = 1 + (len(y) - NF) // HOP
    w = np.zeros(NF, np.float32); o = (NF - WIN) // 2; w[o:o + WIN] = HANN
    fr = np.stack([y[i * HOP:i * HOP + NF] * w for i in range(n)])
    p = np.abs(np.fft.rfft(fr, NF)) ** 2; x = np.log(p @ FB.T + 2 ** -24).T
    L = 1 + len(y[NF // 2:-NF // 2]) // HOP; x = x[:, :max(L, 1)]
    mu = x.mean(1, keepdims=True); sd = x.std(1, ddof=1, keepdims=True) + 1e-5
    return ((x - mu) / sd).astype(np.float32)
y0 = sf.read('ha_test/' + json.load(open('ha_test/meta-ha.json', encoding='utf8'))[0]['id'] + '.wav', dtype='float32')[0]
with torch.no_grad(): ref, rl = m.preprocessor(input_signal=torch.tensor(y0)[None], length=torch.tensor([len(y0)]))
mine = feats(y0); ref = ref[0, :, :rl[0]].numpy()
log('export: feature check numpy vs NeMo: shapes %s %s, max diff %.4f' % (mine.shape, ref.shape, float(np.abs(mine[:, :ref.shape[1]] - ref[:, :mine.shape[1]]).max())))
import onnxruntime as ort
res = {}
for kind in ('int8', 'fp32'):
    s = ort.InferenceSession('phone/model.%s.onnx' % kind, providers=['CPUExecutionProvider']); names = [i.name for i in s.get_inputs()]
    for tag, items, folder in (('ha', json.load(open('ha_test/meta-ha.json', encoding='utf8')), 'ha_test'), ('tlog_test', json.load(open('data/test.json', encoding='utf8'))[:150], 'data/clips')):
        E = L = 0; t0 = time.time(); samp = []
        for x in items:
            y = sf.read(os.path.join(folder, x['id'] + '.wav'), dtype='float32')[0]; f = feats(y)
            lp = s.run(None, {names[0]: f[None], names[1]: np.array([f.shape[1]], np.int64)})[0][0]
            ids = lp.argmax(-1); prev = -1; toks = []
            for t in ids:
                if t != prev and t < len(vocab): toks.append(int(t))
                prev = t
            h = m.tokenizer.ids_to_text(toks); t_ = norm(x['text']); E += min(ed(norm(h), t_), len(t_)); L += len(t_)
            if len(samp) < 10: samp.append([x['text'], h])
        res['%s_%s' % (kind, tag)] = round(100 * E / L, 1); res['%s_%s_sec_per_clip' % (kind, tag)] = round((time.time() - t0) / len(items), 3); res['%s_%s_samples' % (kind, tag)] = samp
    log('export: %s errors %% your voice %s, tlog %s (CPU %.2f s per clip)' % (kind, res[kind + '_ha'], res[kind + '_tlog_test'], res[kind + '_ha_sec_per_clip']))
json.dump(res, open('phone/check.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
if WTOK:
    api = HfApi(token=WTOK); repo = api.whoami()['name'] + '/quran-train-progress'
    for f in ('phone/model.json', 'phone/check.json', 'phone/model.int8.onnx'):
        api.upload_file(path_or_fileobj=f, path_in_repo=f, repo_id=repo, repo_type='dataset')
    log('export: DONE, uploaded phone model')
