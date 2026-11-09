#!/bin/sh
# G10b long run (2026-11-09): LR 6e-5 picked by g10b_sweep.sh, 3000 steps, MEASURE every 300, .nemo at every eval
# (SAVE_ALL) for the phone gate. Log g10b.log, stdout nv_out_G10b.stdout, out nv_out/G10b/. No export, no ship.
cd "$(dirname "$0")"
LEVEL=G10b INIT=nv_out/P3_FINAL_L2.nemo LR=6e-5 STEPS=3000 WARM=200 EVAL=300 SAVE_ALL=1 LOG=g10b.log \
  /d/nemo-env/Scripts/python.exe -X utf8 nv_curr.py > nv_out_G10b.stdout 2>&1 || echo "FAILED G10b" >> g10b.log
