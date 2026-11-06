# P3 level gate (plans/P3-train-protocol.md D/H, B9): a checkpoint -> CTC ONNX -> int8 (same recipe as export_onnx.py,
# no upload), then the phone pipeline on every gate set: bench.py with the 5.7 settings (pre-roll 3, quiet 1.0,
# vmin 0.0015, pgain -30, --dump) + p1b_port_eval ctc_up (the app's hybrid verify). Sets: test-L1/L2/L3 (long recordings,
# held-out files) + P0b ho_reciters, ho_retasy, ho_retasy_wrong, ho_noisy (SNR 20/10/5).
# Usage (nemo-env): python nv_gate.py <tag> <ckpt.nemo | base | shipped> [--limit N]
#   base    = stock NVIDIA .nemo exported here (must equal shipped: B1)   shipped = qtrain/gpu-train/phone (5.7's files)
# Out: qtrain/eval/out/gate_<tag>/ (bench.log, port.log, gate.json)
import os, sys, json, subprocess, shutil
ROOT = r'D:\Quran App'; QT = os.path.join(ROOT, 'qtrain'); QK = os.path.join(ROOT, 'quran-karim')
EV = os.path.join(QK, 'tools', 'asr', 'eval')
tag, src = sys.argv[1], sys.argv[2]
limit = sys.argv[sys.argv.index('--limit') + 1] if '--limit' in sys.argv else '0'
PY = sys.executable
out = os.path.join(QT, 'eval', 'out', 'gate_' + tag); os.makedirs(out, exist_ok=True)

def export(ckpt, P):
    import nemo.collections.asr as A
    from onnxruntime.quantization import quantize_dynamic, QuantType
    if ckpt == 'base':
        from huggingface_hub import hf_hub_download
        ckpt = hf_hub_download('nvidia/stt_ar_fastconformer_hybrid_large_pcd_v1.0', 'stt_ar_fastconformer_hybrid_large_pcd_v1.0.nemo')
    os.makedirs(P, exist_ok=True)
    m = A.models.ASRModel.restore_from(ckpt, map_location='cpu').eval(); m.change_decoding_strategy(decoder_type='ctc')
    shipped = json.load(open(os.path.join(QT, 'gpu-train', 'phone', 'model.json'), encoding='utf8'))
    vocab = [m.tokenizer.ids_to_tokens([i])[0] for i in range(m.tokenizer.vocab_size)]
    assert vocab == shipped['vocab'], 'tokenizer changed'
    json.dump(shipped, open(os.path.join(P, 'model.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    m.set_export_config({'decoder_type': 'ctc'}); m.export(os.path.join(P, 'model.fp32.onnx'))
    quantize_dynamic(os.path.join(P, 'model.fp32.onnx'), os.path.join(P, 'model.int8.onnx'), weight_type=QuantType.QUInt8)
    print('exported', P, '%.0f MB int8' % (os.path.getsize(os.path.join(P, 'model.int8.onnx')) / 1e6), flush=True)

def test_manifests():
    clips = json.load(open(os.path.join(QT, 'long', 'all', 'clips.json'), encoding='utf8'))
    paths = []
    for L in ('L1', 'L2', 'L3'):
        p = os.path.join(QT, 'eval', 'heldout', 'test_%s.json' % L); paths.append(p)
        if os.path.exists(p): continue
        rows = [{'id': c['id'], 'wav': os.path.join(ROOT, c['wav']), 'set': 'test_' + L, 'text': c['text']}
                for c in clips if c['split'] == 'test' and c['level'] == L and 'drop' not in c]
        json.dump(rows, open(p, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
    return paths

if src == 'shipped': P = os.path.join(QT, 'gpu-train', 'phone')
else:
    P = os.path.join(QT, 'gpu-train', 'phone_' + tag)
    if not os.path.exists(os.path.join(P, 'model.int8.onnx')): export(src, P)
ho = os.path.join(QT, 'eval', 'heldout')
sets = test_manifests() + [os.path.join(ho, n + '.json') for n in ('ho_reciters', 'ho_retasy', 'ho_retasy_wrong', 'ho_noisy')]
qw, simple = os.path.join(QT, 'eval', 'quran_words.json'), os.path.join(QK, 'data', 'quran-simple-search.json')
lp = os.path.join(out, 'lp')
cmd = [PY, '-X', 'utf8', '-I', os.path.join(EV, 'bench.py'), '--model', os.path.join(P, 'model.int8.onnx'), '--vocab', os.path.join(P, 'model.json'),
       '--quran', qw, '--simple', simple, '--sets', *sets, '--out', out, '--tag', tag, '--limit', limit,
       '--preroll', '3', '--quiet', '1.0', '--vmin', '0.0015', '--pgain', '-30', '--dump', lp]
env = dict(os.environ, PYTHONIOENCODING='utf-8')
rows = os.path.join(out, 'rows-%s.json' % tag)
if not os.path.exists(rows):
  with open(os.path.join(out, 'bench.log'), 'w', encoding='utf8') as f: subprocess.run(cmd, stdout=f, stderr=subprocess.STDOUT, env=env, check=True)
rows = os.path.join(out, 'rows-%s.json' % tag)
# p1b_port_eval (ctc_up) takes hours on this CPU -> only with PORT=1 (final model); the level gate uses bench verify%
if os.environ.get('PORT') == '1':
 with open(os.path.join(out, 'port.log'), 'w', encoding='utf8') as f:
    subprocess.run([PY, '-X', 'utf8', '-I', os.path.join(EV, 'p1b_port_eval.py'), rows, lp, os.path.join(P, 'model.json'), qw, simple,
                    os.path.join(QK, 'web', 'app.js')], stdout=f, stderr=subprocess.STDOUT, env=dict(env, VARIANTS='ctc_up'), check=True)
res = {}
for line in (open(os.path.join(out, 'port.log'), encoding='utf8') if os.path.exists(os.path.join(out, 'port.log')) else []):
    if line.startswith('ctc_up '): res['ctc_up'] = json.loads(line[7:])
sm = os.path.join(out, 'summary-%s.json' % tag)
if os.path.exists(sm): res['bench'] = json.load(open(sm, encoding='utf8'))
json.dump(res, open(os.path.join(out, 'gate.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
for k, v in res.get('ctc_up', {}).items(): print(k, v)
