#!/bin/sh
# G10c LR sweep (2026-11-13): 3 LRs x 300 steps from nv_out/G10b/best.nemo, MEASURE at 150/300, no .nemo saved. Log g10c_sweep.log
cd "$(dirname "$0")"
PY=/d/nemo-env/Scripts/python.exe
for LR in 1e-5 3e-5 6e-5; do
  LEVEL=G10c INIT=nv_out/G10b/best.nemo LR=$LR STEPS=300 WARM=50 EVAL=150 SAVE=0 TAG=_lr$LR LOG=g10c_sweep.log \
    $PY -X utf8 nv_curr.py > nv_out_G10c_lr$LR.stdout 2>&1 || echo "FAILED $LR" >> g10c_sweep.log
done
echo "SWEEP DONE $(date +%H:%M:%S)" >> g10c_sweep.log
