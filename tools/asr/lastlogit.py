# The app decodes without a cache, so the decoder sees every token each step; only the last one's logits are needed.
# Slicing the hidden states to the last position before proj_out saves the 512 x 51865 product for every other token.
import sys, onnx
from onnx import helper, TensorProto
m = onnx.load(sys.argv[1])
g = m.graph
pj = [n for n in g.node if n.name.startswith('/proj_out/')][0]
src = pj.input[0]
for name, v in (('ll_s', [-1]), ('ll_e', [2 ** 31 - 1]), ('ll_a', [1])):
    g.initializer.append(helper.make_tensor(name, TensorProto.INT64, [1], v))
g.node.insert(list(g.node).index(pj), helper.make_node('Slice', [src, 'll_s', 'll_e', 'll_a'], ['ll_last'], name='last_token'))
pj.input[0] = 'll_last'
o = g.output[0]; o.type.tensor_type.shape.dim[1].dim_value = 1
onnx.save(m, sys.argv[2]); print('ok', pj.name, pj.op_type)
