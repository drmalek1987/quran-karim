# Z2: fp32 nv ONNX -> MatMul weights int4 (MatMulNBits, ORT>=1.17 CPU) + the rest dynamic int8 (as export_onnx.py).
# usage: python -I nv_int4.py in.fp32.onnx out.onnx [--block 32] [--asym] [--acc 4 (int8 compute)]
import sys, os, onnx
from onnxruntime.quantization import quantize_dynamic, QuantType
from onnxruntime.quantization.matmul_nbits_quantizer import MatMulNBitsQuantizer
src, dst = sys.argv[1], sys.argv[2]
blk = int(sys.argv[sys.argv.index('--block') + 1]) if '--block' in sys.argv else 32
q = MatMulNBitsQuantizer(onnx.load(src), block_size=blk, is_symmetric='--asym' not in sys.argv, accuracy_level=int(sys.argv[sys.argv.index('--acc') + 1]) if '--acc' in sys.argv else None)
q.process(); tmp = dst + '.nbits.onnx'; q.model.save_model_to_file(tmp, use_external_data_format=False)
ops = sorted({n.op_type for n in onnx.load(tmp).graph.node if n.op_type in ('MatMul', 'Conv', 'Gemm')})
print('left for int8:', ops)
quantize_dynamic(tmp, dst, weight_type=QuantType.QUInt8, op_types_to_quantize=[o for o in ops if o != 'MatMul'] or None)
os.remove(tmp); print('MB', round(os.path.getsize(dst) / 1e6, 1))
