"""Cold-start benchmark for Quran Karim (stdlib only).

Each run: force-stop -> sleep 3 s -> logcat -c -> am start -W -> logcat -d for "Displayed".
Run 1 is a warm-up: kept in the JSON, excluded from the stats.

Usage: py -3.11 -I tools/qa/sprint6/coldstart.py --serial emulator-5554 --label 5.38-emu --runs 11
"""
import argparse
import json
import math
import re
import statistics
import subprocess
import time
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent / "out"
DISPLAYED_RE = re.compile(r"Displayed\s+(\S+?)/\S*.*?\+(?:(\d+)s)?(\d+)ms")
TOTAL_RE = re.compile(r"TotalTime:\s*(\d+)")
WAIT_RE = re.compile(r"WaitTime:\s*(\d+)")


def adb(serial, *args):
    cmd = ["adb", "-s", serial, *args]
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return res.stdout.replace("\r", "")


def one_run(serial, pkg, run_no):
    adb(serial, "shell", "am", "force-stop", pkg)
    time.sleep(3)
    adb(serial, "logcat", "-c")
    start_out = adb(serial, "shell", "am", "start", "-W", "-n", f"{pkg}/com.quran.karim.MainActivity")
    total = TOTAL_RE.search(start_out)
    wait = WAIT_RE.search(start_out)
    log = adb(serial, "logcat", "-d", "-s", "ActivityTaskManager:I")
    disp = None
    for line in log.splitlines():
        m = DISPLAYED_RE.search(line)
        if m and pkg in m.group(1):
            secs = int(m.group(2) or 0)
            disp = secs * 1000 + int(m.group(3))
            break
    return {
        "run": run_no,
        "total_ms": int(total.group(1)) if total else None,
        "wait_ms": int(wait.group(1)) if wait else None,
        "displayed_ms": disp,
        "am_output_ok": total is not None,
    }


def p90(values):
    s = sorted(values)
    return s[max(0, math.ceil(0.9 * len(s)) - 1)]


def stats(values):
    if not values:
        return {"n": 0, "min": None, "median": None, "p90": None}
    return {
        "n": len(values),
        "min": min(values),
        "median": statistics.median(values),
        "p90": p90(values),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--serial", required=True)
    ap.add_argument("--pkg", default="com.quran.karim")
    ap.add_argument("--runs", type=int, default=10)
    ap.add_argument("--label", required=True)
    args = ap.parse_args()

    runs = []
    for i in range(1, args.runs + 1):
        r = one_run(args.serial, args.pkg, i)
        runs.append(r)
        tag = " (warm-up)" if i == 1 else ""
        print(f"run {i:>2}{tag}: TotalTime={r['total_ms']} WaitTime={r['wait_ms']} "
              f"Displayed={r['displayed_ms']}")

    measured = runs[1:]
    total_vals = [r["total_ms"] for r in measured if r["total_ms"] is not None]
    disp_vals = [r["displayed_ms"] for r in measured if r["displayed_ms"] is not None]
    wait_vals = [r["wait_ms"] for r in measured if r["wait_ms"] is not None]
    summary = {
        "TotalTime": stats(total_vals),
        "WaitTime": stats(wait_vals),
        "Displayed": stats(disp_vals),
    }

    print("\nstats (run 1 excluded):")
    print(f"{'metric':<12}{'n':>4}{'min':>8}{'median':>10}{'p90':>8}")
    for name, s in summary.items():
        print(f"{name:<12}{s['n']:>4}{str(s['min']):>8}{str(s['median']):>10}{str(s['p90']):>8}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"coldstart-{args.label}.json"
    payload = {
        "label": args.label,
        "serial": args.serial,
        "pkg": args.pkg,
        "runs_requested": args.runs,
        "warmup_runs_dropped": 1,
        "runs": runs,
        "stats_excluding_warmup": summary,
    }
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"\nwrote {out_path}")


if __name__ == "__main__":
    main()
