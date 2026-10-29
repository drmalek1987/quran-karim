@echo off
rem One-command GPU training. Run again after any stop: it continues where it left off.
cd /d "%~dp0"
chcp 65001 >nul
where uv >nul 2>nul || (echo uv is not installed. Run: winget install astral-sh.uv & pause & exit /b 1)
if not exist .venv (
  echo [1/3] Installing Python packages, about 3 GB, once only ...
  uv venv .venv --python 3.11 || (pause & exit /b 1)
  uv pip install --python .venv torch --index-url https://download.pytorch.org/whl/cu121 || (pause & exit /b 1)
  uv pip install --python .venv "transformers<5" huggingface_hub soundfile librosa pyarrow fsspec aiohttp numpy || (pause & exit /b 1)
)
if not exist hf_token.txt (
  set /p TOK=Paste your Hugging Face token (starts with hf_) and press Enter: 
  call echo %%TOK%%> hf_token.txt
)
set /p HF_TOKEN=<hf_token.txt
echo [2/3] Downloading tlog sample and [3/3] training. Progress is also written to progress.txt
.venv\Scripts\python gpu_train.py
echo.
echo Finished or stopped. Send Claude the file results.json
pause
