# Z1: trims the relative-position table in an exported FastConformer ONNX (nv.onnx).
# NeMo exports pe as a float32 Constant (1, 2*5000-1, 512) and slices rows [C-T, C+T-1) with C=5000 baked in.
# We keep rows [C-K, C+K-1) and rewrite both C constants to K, so output is bit-identical for any T <= K
# (T = encoder frames = audio_s * 12.5; the app caps a segment at 12 s = 150 frames).
# usage: python -I nv_shrink.py in.onnx out.onnx [--posmax 1000]
import sys, onnx, numpy as np
from onnx import numpy_helper as nh
src, dst = sys.argv[1], sys.argv[2]
K = int(sys.argv[sys.argv.index('--posmax') + 1]) if '--posmax' in sys.argv else 1000
m = onnx.load(src); g = m.graph
sl = next(n for n in g.node if n.op_type == 'Slice' and n.name == '/pos_enc/Slice')
pe = next(n for n in g.node if n.op_type == 'Constant' and sl.input[0] in n.output)
a = nh.to_array(pe.attribute[0].t); C = (a.shape[1] + 1) // 2
assert a.ndim == 3 and a.shape[1] == 2 * C - 1 and K < C, a.shape
pe.attribute[0].t.CopyFrom(nh.from_array(np.ascontiguousarray(a[:, C - K:C + K - 1]), pe.attribute[0].t.name))
fixed = 0
for n in g.node:
    if n.name in ('/pos_enc/Constant_2', '/pos_enc/Constant_3'):
        v = nh.to_array(n.attribute[0].t); assert int(v) == C, (n.name, v)
        n.attribute[0].t.CopyFrom(nh.from_array(np.array(K, v.dtype), n.attribute[0].t.name)); fixed += 1
assert fixed == 2, fixed
onnx.save(m, dst)
print('pe %s -> %s, C %d -> %d' % (a.shape, (1, 2 * K - 1, a.shape[2]), C, K))
