# Diagnosis: per-clip hyps of base vs a checkpoint on one eval set, through the phone pipeline (nv_curr.phone_pieces).
# Usage: python nv_probe.py <ckpt.nemo> [set=ho_retasy] [n=150]  -> worst clips + error-type counts
import sys, os, collections
os.environ.setdefault('LEVEL', 'L1')
import nv_curr as N, torch, nemo.collections.asr as A
from huggingface_hub import hf_hub_download
ck = sys.argv[1]; S = sys.argv[2] if len(sys.argv) > 2 else 'ho_retasy'; n = int(sys.argv[3]) if len(sys.argv) > 3 else 150
_, ev = N.data(); items = ev[S][:n]
def hyps(path):
    m = A.models.ASRModel.restore_from(path, map_location='cuda').eval(); m.change_decoding_strategy(decoder_type='ctc')
    out = []
    with torch.no_grad():
        for x in items:
            ps = N.phone_pieces(N.load(x['path'], 16000 * 60)); lp, el = N.forward(m, ps, False)
            out.append(' '.join(N.decode(m, lp.float(), el)))
    del m; torch.cuda.empty_cache(); return out
hb, hc = hyps(hf_hub_download(*N.BASE)), hyps(ck)
rows, kinds = [], collections.Counter()
for x, a, b in zip(items, hb, hc):
    r = N.norm(N.target(x['text'])); ea, eb = N.ed(N.norm(a), r), N.ed(N.norm(b), r)
    rows.append((eb - ea, x['id'], r, a, b))
    if eb > ea:
        nb = N.norm(b)
        kinds['empty' if not nb else 'shorter' if len(nb) < 0.7 * len(r) else 'longer' if len(nb) > 1.3 * len(r) else 'same-len']+= 1
rows.sort(reverse=True)
print('worse %d better %d same %d | worse kinds %s' % (sum(r[0] > 0 for r in rows), sum(r[0] < 0 for r in rows), sum(r[0] == 0 for r in rows), dict(kinds)))
for d, i, r, a, b in rows[:12]: print('%+d %s\n  ref : %s\n  base: %s\n  ckpt: %s' % (d, i, r, a, b))
