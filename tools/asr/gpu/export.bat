@echo off
cd /d "%~dp0"
chcp 65001 >nul
call uv pip install --python .venv\Scripts\python.exe onnx onnxruntime onnxscript
set /p HF_TOKEN=<hf_token.txt
.venv\Scripts\python.exe export_onnx.py
pause
