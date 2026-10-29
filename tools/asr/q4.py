# Shrinks an exported Whisper for the phone: 4-bit block-wise weights for every MatMul (block 32) and 8-bit embeddings.
# Plain 8-bit (one scale per tensor) lost a quarter of the found ayahs on HA's voice; this keeps the full-size accuracy.
import sys, os, onnx
from onnxruntime.quantization.matmul_nbits_quantizer import MatMulNBitsQuantizer, DefaultWeightOnlyQuantConfig
from onnxruntime.quantization import quantize_dynamic, QuantType
src, out = sys.argv[1], sys.argv[2]
q = MatMulNBitsQuantizer(onnx.load(src), algo_config=DefaultWeightOnlyQuantConfig(block_size=32, is_symmetric=True))
q.process(); q.model.save_model_to_file(out + '.tmp', use_external_data_format=False)
quantize_dynamic(out + '.tmp', out, weight_type=QuantType.QInt8, op_types_to_quantize=['Gather']); os.remove(out + '.tmp')
print(out, round(os.path.getsize(out) / 1e6, 1), 'MB')
