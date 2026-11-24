"""Page-load measurements inside the Android WebView over raw CDP (bug #25). No taps, no input events:
navigation = location.hash, scrolling = window.scrollBy, the turn mode is switched with the app's own #flip handler
(and put back at the end).  Same payload.js as run-playwright.mjs.

  uv venv .venv --python 3.11 && uv pip install --python .venv\\Scripts\\python.exe websocket-client
  .venv\\Scripts\\python.exe -I run-cdp.py --serial emulator-5554 [--pkg com.lawh.quran] [--secs 8] [--trace-secs 10] [--meminfo]
  .venv\\Scripts\\python.exe -I run-cdp.py --serial bee81250 --pkg com.lawh.quran      # the phone (release build is NOT debuggable:
                                                                                      # needs a -cdp build, DEBUGGABLE=1 APK_SUFFIX=-cdp build-win.py)
Every adb call carries -s <serial>; nothing is ever sent to another device.  Needs the page-image edition already open
in the app (the current edition is measured; --edition X switches q.edition and reloads, then restores it).
"""
import argparse, json, os, re, subprocess, sys, time, urllib.request

try:
    import websocket
except ImportError:
    sys.exit("pip install websocket-client (see the docstring)")

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument("--serial", required=True)
ap.add_argument("--pkg", default="com.lawh.quran")
ap.add_argument("--port", type=int, default=9222)
ap.add_argument("--secs", type=float, default=8)
ap.add_argument("--trace-secs", type=float, default=10)
ap.add_argument("--edition")
ap.add_argument("--meminfo", action="store_true", help="adb shell dumpsys meminfo <pkg> before/after (read-only)")
ap.add_argument("--no-trace", action="store_true")
ap.add_argument("--out", default=os.path.join(HERE, "out", "cdp"))
A = ap.parse_args()
os.makedirs(A.out, exist_ok=True)


def adb(*a):
    return subprocess.run(["adb", "-s", A.serial, *a], capture_output=True, text=True, timeout=60).stdout


def find_socket():
    pid = adb("shell", "pidof", A.pkg).strip().split()
    unix = adb("shell", "cat", "/proc/net/unix")
    socks = re.findall(r"@(webview_devtools_remote_(\d+))", unix)
    for name, p in socks:
        if p in pid:
            return name
    sys.exit("no webview_devtools_remote socket for %s (pid %s). The normal release build is not WebView-debuggable: "
             "build a -cdp APK (DEBUGGABLE=1 APK_SUFFIX=-cdp build-win.py, see the task notes). Sockets seen: %s" % (A.pkg, pid, socks))


class Cdp:
    def __init__(self, url):
        self.ws = websocket.create_connection(url, timeout=120, suppress_origin=True)
        self.i = 0
        self.events = []

    def send(self, method, **params):
        self.i += 1
        self.ws.send(json.dumps({"id": self.i, "method": method, "params": params}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get("id") == self.i:
                if "error" in m:
                    raise RuntimeError("%s: %s" % (method, m["error"]))
                return m.get("result", {})
            self.events.append(m)

    def js(self, expr, await_=True):
        r = self.send("Runtime.evaluate", expression=expr, awaitPromise=await_, returnByValue=True, timeout=180000)
        if "exceptionDetails" in r:
            raise RuntimeError(json.dumps(r["exceptionDetails"])[:400])
        return r["result"].get("value")


def pct(a, q):
    a = sorted(x for x in a if x is not None)
    return a[min(len(a) - 1, int(q * len(a)))] if a else None


sock = find_socket()
adb("forward", "tcp:%d" % A.port, "localabstract:" + sock)
tabs = json.load(urllib.request.urlopen("http://127.0.0.1:%d/json" % A.port))
tab = next(t for t in tabs if t.get("type") == "page")
c = Cdp(tab["webSocketDebuggerUrl"])
c.send("Runtime.enable"); c.send("Performance.enable")
payload = open(os.path.join(HERE, "payload.js"), encoding="utf8").read()
c.js(payload, False)
res = {"serial": A.serial, "pkg": A.pkg, "socket": sock}
orig_turn = c.js("localStorage.getItem('q.turn')"); orig_ed = c.js("localStorage.getItem('q.edition')")
if A.edition:
    c.js("localStorage.setItem('q.edition', %s); location.reload()" % json.dumps(json.dumps(A.edition)), False)
    time.sleep(4); c.js(payload, False)


def metrics():
    return {m["name"]: m["value"] for m in c.send("Performance.getMetrics")["metrics"]}


def go(p, wait=1.5):
    c.js("location.hash='#/p/%d'" % p, False); time.sleep(wait)


info0 = c.js("window.__qk.info()")
res["info0"] = info0
if A.meminfo:
    res["meminfo_before"] = adb("shell", "dumpsys", "meminfo", A.pkg)[:1800]
try:
    # ---- single view
    c.js("window.__qk.setTurn('h')", False); time.sleep(1.5)
    go(10)
    res["info_h"] = c.js("window.__qk.info()")
    seq, jump = [20, 21, 22, 23, 24, 25, 26, 27], [100, 200, 300, 400, 150, 250, 350, 450]
    for name, pages in (("seq", seq), ("jump", jump), ("warm", jump + seq)):
        res[name] = c.js("window.__qk.single(%s, 700)" % json.dumps(pages))
    res["decodeBench"] = c.js("window.__qk.decodeBench(window.__qk.info().dir, [10,100,200,300,400,500])")
    res["metrics_h"] = metrics()
    # ---- vertical view
    c.js("window.__qk.setTurn('v')", False); time.sleep(2)
    res["vert"] = []
    for pps, secs in ((1, A.secs), (3, A.secs), (8, max(A.secs, 7))):
        go(30, 2.5)
        r = c.js("window.__qk.vertical({pps:%s,secs:%s})" % (pps, secs)); r["metrics"] = metrics(); res["vert"].append(r)
        if A.meminfo and pps == 8:
            res["meminfo_after_50p"] = adb("shell", "dumpsys", "meminfo", A.pkg)[:1800]
    # ---- trace of 10 s vertical scroll (3 pages/s)
    if not A.no_trace:
        go(60, 2.5)
        cats = "devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,blink,cc,gpu"
        c.send("Tracing.start", categories=cats, transferMode="ReturnAsStream")
        res["trace_scroll"] = c.js("window.__qk.vertical({pps:3,secs:%s})" % A.trace_secs)
        c.send("Tracing.end"); ev = []; stream = None
        t0 = time.time()
        while time.time() - t0 < 120 and stream is None:
            m = json.loads(c.ws.recv())
            if m.get("method") == "Tracing.tracingComplete":
                stream = m["params"].get("stream")
        data = ""
        while stream:
            r = c.send("IO.read", handle=stream, size=1 << 20); data += r.get("data", "")
            if r.get("eof"):
                break
        tp = os.path.join(A.out, "trace-%s.json" % A.serial)
        open(tp, "w", encoding="utf8").write(data)
        try:
            evs = json.loads(data); evs = evs.get("traceEvents", evs)
            agg = {}
            for e in evs:
                if e.get("ph") == "X" and e.get("name") in ("Decode Image", "ImageDecodeTask", "Decode LazyPixelRef", "Draw LazyPixelRef", "ImageResourceContent::DecodeImage", "RunTask", "FunctionCall", "Layout", "UpdateLayoutTree", "Paint", "Commit", "RasterTask", "ImageDecodeTask"):
                    a = agg.setdefault(e["name"], []); a.append(e["dur"] / 1000)
            res["trace_summary"] = {k: {"n": len(v), "totalMs": round(sum(v), 1), "p95Ms": round(pct(v, .95), 2), "maxMs": round(max(v), 2)} for k, v in agg.items()}
            res["trace_file"] = tp
        except Exception as e:
            res["trace_summary_error"] = str(e)
finally:
    # put the reader's settings back
    try:
        if orig_turn:
            c.js("window.__qk.setTurn(%s)" % json.dumps(json.loads(orig_turn)), False)
        if A.edition and orig_ed:
            c.js("localStorage.setItem('q.edition', %s); location.reload()" % json.dumps(orig_ed), False)
    except Exception as e:
        res["restore_error"] = str(e)
    adb("forward", "--remove", "tcp:%d" % A.port)
fn = os.path.join(A.out, "cdp-%s.json" % A.serial)
json.dump(res, open(fn, "w", encoding="utf8"), indent=1, ensure_ascii=False)
f = lambda a: "%s/%s" % (pct([x["paint"] for x in a], .5), pct([x["paint"] for x in a], .95))
print("single paint ms p50/p95: seq", f(res["seq"]), "jump", f(res["jump"]), "warm", f(res["warm"]))
for v in res["vert"]:
    print("vertical %spps blank p50/p95/max %s/%s/%s  blankFrames %s/%s  nodes %s  jsHeapMB %s" % (v["pps"], v["blankP50"], v["blankP95"], v["blankMax"], v["blankFrames"], v["frames"], v["mem"]["nodes"], v["mem"]["jsHeapMB"]))
print("wrote", fn)
