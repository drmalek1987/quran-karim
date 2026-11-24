#!/bin/bash
# G10d recipe study, short proxy runs (600 steps, eval 300), resumable: a TAG whose log has its DONE line is skipped.
cd "$(dirname "$0")"; PY=D:/nemo-env/Scripts/python.exe; export PYTHONIOENCODING=utf-8 LEVEL=G10d INIT="nv_out/G10b/best.nemo" STEPS=${STEPS:-600} EVAL=${EVAL:-300} WARM=100
run() { tag=$1; shift; grep -q "DONE G10d$tag" g10d.log 2>/dev/null && return; env TAG=$tag LOG=g10d.log "$@" $PY -X utf8 nv_curr.py > nv_out_G10d$tag.stdout 2>&1; }
run _p1base DEB_P=0.2 LR=3e-5
run _p2rep65 DEB_P=0.35 LR=3e-5
run _p3lr1 DEB_P=0.2 LR=1e-5
run _p4top DEB_P=0.2 LR=3e-5 FREEZE=0.75
run _p5kd DEB_P=0.2 LR=3e-5 KD=1.0
run _p6l2sp DEB_P=0.2 LR=3e-5 L2SP=1.0
run _p7ema DEB_P=0.2 LR=3e-5 EMA=0.995
run _p8tempo DEB_P=0.2 LR=3e-5 DEB_TEMPO=1
echo MATRIX_DONE >> g10d.log
