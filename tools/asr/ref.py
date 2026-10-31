# Reference of what the app will do in JavaScript: log-mel by hand, encoder once, greedy decoder without a cache.
import sys, json, glob, time, numpy as np, soundfile as sf, onnxruntime as ort
sys.argv += [] ; M, CL = sys.argv[1], sys.argv[2]
mel = json.load(open('q/mel.json')); MF = np.array(mel['mel']).reshape(mel['n'][1], mel['n'][0])  # (80, 201)
G = json.load(open('q/gen.json')); SUP = set(G['suppress']); BEG = set(G['begin'])
voc = json.load(open('onnx/base/vocab.json')); inv = {v: k for k, v in voc.items()}
bs = list(range(ord('!'), ord('~') + 1)) + list(range(ord('¡'), ord('¬') + 1)) + list(range(ord('®'), ord('ÿ') + 1)); cs = bs[:]; n = 0
for b in range(256):
    if b not in bs: bs.append(b); cs.append(256 + n); n += 1
BD = {chr(c): b for b, c in zip(bs, cs)}
def logmel(y):
    y = np.pad(y[:480000], (0, max(0, 480000 - len(y))))
    yp = np.pad(y, 200, mode='reflect'); win = np.hanning(401)[:-1]
    fr = np.lib.stride_tricks.sliding_window_view(yp, 400)[::160][:3000] * win
    p = np.abs(np.fft.rfft(fr, 400)) ** 2
    lm = np.log10(np.maximum(MF @ p.T, 1e-10)); lm = np.maximum(lm, lm.max() - 8.0)
    return ((lm + 4.0) / 4.0).astype(np.float32)[None]
so = ort.SessionOptions(); so.intra_op_num_threads = 4
enc = ort.InferenceSession(M + '/onnx/encoder_model_quantized.onnx', so); dec = ort.InferenceSession(M + '/onnx/decoder_model_quantized.onnx', so)
def asr(y):
    h = enc.run(None, {'input_features': logmel(y)})[0]; ids = [50258, 50272, 50359, 50363]
    for i in range(120):
        lg = dec.run(None, {'input_ids': np.array([ids], np.int64), 'encoder_hidden_states': h})[0][0, -1]
        for t in SUP: lg[t] = -1e9
        if i == 0:
            for t in BEG: lg[t] = -1e9
        t = int(lg.argmax())
        if t == 50257: break
        ids.append(t)
    return bytes(BD[c] for t in ids[4:] if t < 50257 for c in inv[t]).decode('utf8', 'replace')
if __name__ == '__main__':
    sys.argv = [sys.argv[0], 'x']; exec(open('scripts/bench.py').read().split('proc = WhisperProcessor')[0].replace("MODEL, N = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 150", "MODEL, N = 'x', 200"))
    ok = n = 0; t0 = time.time()
    for k in pick:
        y = sf.read(D + '/' + CL + '/' + k + '.wav', dtype='float32')[0]; h = asr(y / (np.abs(y).max() + 1e-9) * 0.9)
        g = find(meta[k]['text']); ok += g is not None and find(h) == g; n += 1
    print(M, 'ayah', round(ok / n * 100, 1), 'n', n, 's/clip', round((time.time() - t0) / n, 2))
