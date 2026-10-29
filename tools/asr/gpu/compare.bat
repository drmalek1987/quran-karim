@echo off
cd /d "%~dp0"
chcp 65001 >nul
if exist .venv\Scripts\nemo_ok.txt goto run
echo Installing NVIDIA NeMo, once only ...
call uv pip install --python .venv\Scripts\python.exe "nemo_toolkit[asr]"
echo ok> .venv\Scripts\nemo_ok.txt
:run
set /p HF_TOKEN=<hf_token.txt
.venv\Scripts\python.exe compare.py
pause
