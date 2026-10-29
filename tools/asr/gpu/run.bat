@echo off
rem One-command GPU training. Run again after any stop: it continues where it left off.
cd /d "%~dp0"
chcp 65001 >nul
where uv >nul 2>nul || goto nouv
if exist .venv\Scripts\python.exe goto token
echo [1/3] Installing Python packages, about 3 GB, once only ...
call uv venv .venv --python 3.11
call uv pip install --python .venv\Scripts\python.exe torch --index-url https://download.pytorch.org/whl/cu121
call uv pip install --python .venv\Scripts\python.exe "transformers<5" huggingface_hub soundfile librosa pyarrow fsspec aiohttp numpy
:token
if exist hf_token.txt goto run
echo.
set /p TOK=Paste your Hugging Face token (starts with hf_) and press Enter: 
>hf_token.txt echo %TOK%
:run
set /p HF_TOKEN=<hf_token.txt
echo [2/3] Downloading tlog sample, then [3/3] training. Progress is also written to progress.txt
.venv\Scripts\python.exe gpu_train.py
echo.
echo Finished or stopped. Send Claude the file results.json, or a photo of this window.
pause
exit /b
:nouv
echo uv is not installed. Run in PowerShell: winget install astral-sh.uv
pause
