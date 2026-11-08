# Z1v: logits parity + speed of a trimmed nv.onnx (nv_shrink.py) vs the original, on real VAD pieces from the gate sets.
# usage: python -I nv_shrink_parity.py orig.onnx trimmed.onnx [N]
import sys, os, json, time, numpy as np, onnxruntime as ort, soundfile as sf
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'eval')); import bench
A, B = sys.argv[1], sys.argv[2]; N = int(sys.argv[3]) if len(sys.argv) > 3 else 80
ho = r'D:\Quran App\qtrain\eval\heldout'
rows = []
for n in ('ho_reciters', 'test_L1', 'ho_noisy'):
    rows += json.load(open(os.path.join(ho, n + '.json'), encoding='utf8'))[:N // 3]
so = ort.SessionOptions(); so.intra_op_num_threads = 4
sa, sb = (ort.InferenceSession(p, so, providers=['CPUExecutionProvider']) for p in (A, B))
nm = [i.name for i in sa.get_inputs()]
mx = 0.0; arg = 0; tot = 0; ta = tb = 0.0; T = 0; maxT = 0
for r in rows:
    y = sf.read(r['wav'], dtype='float32')[0]
    if y.ndim > 1: y = y.mean(1)
    for p in bench.vad_pieces(y, 3, 1.0, 0.0015, -30) or [y[:16000 * 12]]:
        f = bench.feats(p[:16000 * 12])[None]; L = np.array([f.shape[2]], np.int64)
        t0 = time.perf_counter(); la = sa.run(None, {nm[0]: f, nm[1]: L})[0]; t1 = time.perf_counter()
        lb = sb.run(None, {nm[0]: f, nm[1]: L})[0]; t2 = time.perf_counter()
        ta += t1 - t0; tb += t2 - t1; T += len(p) / 16000; maxT = max(maxT, la.shape[1])
        mx = max(mx, float(np.abs(la - lb).max())); arg += int((la.argmax(-1) != lb.argmax(-1)).sum()); tot += la.shape[1]
print(json.dumps({'pieces_audio_s': round(T, 1), 'max_frames': maxT, 'max_abs_logit_diff': mx, 'argmax_diff_frames': arg,
                  'frames': tot, 'rtf_orig': round(ta / T, 4), 'rtf_trim': round(tb / T, 4)}))
