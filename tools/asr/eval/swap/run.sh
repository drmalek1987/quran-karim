#!/bin/bash
# usage: bash run.sh <out.json> [extra swap_eval args]   (stage 1+2 raw records for model v5 phone-pipeline rows)
cd "$(dirname "$0")"; QT="D:/Quran App/qtrain"; QK="D:/Quran App/quran-karim"; O="$QT/eval/out/mode_f1s9w5_n"; PY="$USERPROFILE/ml-env/Scripts/python.exe"; out=$1; shift
"$PY" -X utf8 swap_eval.py "$O/rows-s.json" "$O/lp" "$QT/gpu-train/phone_f1s9w5/gate/model.json" "$QT/eval/quran_words.json" "$QK/data/quran-simple-search.json" "$QK/web/app.js" "$out" "$@"
