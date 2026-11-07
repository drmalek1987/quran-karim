#!/bin/bash
# Usage: bash tools/qa/maestro/avds.sh [apk]  (default: newest quran-karim-v*.apk). On each API35 AVD: boot, install the APK, Maestro smoke, shut down.
cd "/d/Quran App/quran-karim"
APK="${1:-$(ls -t quran-karim-v*.apk | head -1)}"
EMU="$LOCALAPPDATA/Android/Sdk/emulator/emulator.exe"
for A in Small_API35 Fold_API35 Tablet_API35 Phone_API35; do
  "$EMU" -avd $A -no-snapshot -no-audio -no-window > /dev/null 2>&1 &
  adb -s emulator-5554 wait-for-device
  for i in $(seq 1 120); do [ "$(adb -s emulator-5554 shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break; sleep 3; done
  sleep 10
  adb -s emulator-5554 install -r --no-incremental "$APK" 2>&1 | tail -1
  echo "== $A version: $(adb -s emulator-5554 shell dumpsys package com.quran.karim | grep versionName | tr -d '\r')"
  out=$(maestro --device emulator-5554 test tools/qa/maestro/smoke.yaml 2>&1); echo "$out" | tail -3
  echo "$out" | grep -q "Flow Passed\|COMPLETED\|\[Passed\]" && echo "== $A MAESTRO PASS" || echo "== $A MAESTRO CHECK"
  # keep the last one (Phone_API35) running for the CDP checks
  [ $A = Phone_API35 ] || { adb -s emulator-5554 emu kill; sleep 15; }
done
echo ALLDONE
