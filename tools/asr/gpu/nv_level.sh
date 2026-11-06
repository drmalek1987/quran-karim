#!/bin/sh
# One curriculum level end to end: nv_curr.py (train, proxy CER evals) then nv_gate.py on its best.nemo (int8 phone bench).
# Usage: sh nv_level.sh L1 [INIT .nemo] [extra env, e.g. LR=5e-6]
cd "$(dirname "$0")"
L=$1; INIT=${2:-}
PY=/d/nemo-env/Scripts/python.exe
LEVEL=$L INIT=$INIT $PY -X utf8 nv_curr.py > nv_out_$L.stdout 2>&1 || { echo "TRAIN FAILED $L"; tail -20 nv_out_$L.stdout; exit 1; }
grep -a "DONE $L" nv_curr.log | tail -1
if [ -f nv_out/$L/best.nemo ]; then
  rm -rf "/d/Quran App/qtrain/gpu-train/phone_$L"
  $PY -X utf8 nv_gate.py $L nv_out/$L/best.nemo > nv_gate_$L.stdout 2>&1 || { echo "GATE FAILED $L"; tail -20 nv_gate_$L.stdout; exit 1; }
  tail -12 nv_gate_$L.stdout
fi
