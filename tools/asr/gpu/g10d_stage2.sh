#!/bin/bash
# G10d stage 2: full schedule (1500 steps, ckpt every 300) of the best short configs; resumable like g10d_matrix.sh
cd "$(dirname "$0")"; until grep -q MATRIX_DONE g10d.log; do sleep 30; done
PY=D:/nemo-env/Scripts/python.exe; export PYTHONIOENCODING=utf-8 LEVEL=G10d INIT="nv_out/G10b/best.nemo" STEPS=1500 EVAL=300 WARM=100 SAVE_ALL=1
run() { tag=$1; shift; grep -q "DONE G10d$tag" g10d.log 2>/dev/null && return; env TAG=$tag LOG=g10d.log "$@" $PY -X utf8 nv_curr.py > nv_out_G10d$tag.stdout 2>&1; }
run _f1 DEB_P=0.2 LR=3e-5
run _f2mix DEB_P=0.35 LR=3e-5 KD=1.0 EMA=0.995
echo STAGE2_DONE >> g10d.log
