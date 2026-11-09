#!/bin/sh
# G10b LR sweep (2026-11-09): 3 LRs x 300 steps from the shipped L2 model, MEASURE at 150/300, no .nemo saved.
# Log: g10b_sweep.log (nv_curr.py lines), results in nv_curr.json keys G10b_lr*. Run: nohup sh g10b_sweep.sh &
cd "$(dirname "$0")"
PY=/d/nemo-env/Scripts/python.exe
for LR in 3e-5 6e-5 1e-4; do
  LEVEL=G10b INIT=nv_out/P3_FINAL_L2.nemo LR=$LR STEPS=300 WARM=50 EVAL=150 SAVE=0 TAG=_lr$LR LOG=g10b_sweep.log \
    $PY -X utf8 nv_curr.py > nv_out_G10b_lr$LR.stdout 2>&1 || echo "FAILED $LR" >> g10b_sweep.log
done
echo "SWEEP DONE $(date +%H:%M:%S)" >> g10b_sweep.log
