"""Drive the user's real phone safely for the 5.39 phone checklist.

Safety (see memory phone-test-safety): before EVERY tap the call state must be idle (mCallState=0)
and the focused window must belong to the expected package; otherwise stop. Elements are found
by text / content-desc in a fresh uiautomator dump, never by stale coordinates.

Usage: py -3.11 phone.py <cmd> [args]
  shot <name>            screenshot -> out/phone/<name>.png
  dump                   print visible nodes (text|desc|bounds)
  tap <text>             tap the first node whose text/desc contains <text>
  longpress <text>       same, 800 ms press
  key <KEYCODE>          send a key event (BACK, HOME, ...)
  start                  cold start the app (force-stop + launcher intent)
"""
import os, re, subprocess, sys, time, xml.etree.ElementTree as ET

DEV = "bee81250"
PKG = "com.quran.karim"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out", "phone")


def adb(*a, binary=False):
    r = subprocess.run(["adb", "-s", DEV, *a], capture_output=True)
    return r.stdout if binary else r.stdout.decode("utf-8", "replace")


def safe(pkg=PKG):
    """Abort unless no call is active and our app is in front."""
    calls = re.findall(r"mCallState=(\d)", adb("shell", "dumpsys telephony.registry"))
    if any(c != "0" for c in calls):
        sys.exit("STOP: call state " + ",".join(calls))
    focus = re.search(r"mCurrentFocus=.*", adb("shell", "dumpsys window windows")) or \
        re.search(r"mCurrentFocus=.*", adb("shell", "dumpsys window"))
    f = focus.group(0) if focus else ""
    if pkg and pkg not in f:
        sys.exit("STOP: focus is " + f)


def nodes():
    adb("shell", "uiautomator dump /sdcard/qk-ui.xml")
    xml = adb("shell", "cat /sdcard/qk-ui.xml")
    xml = xml[xml.find("<?xml"):]
    out = []
    for n in ET.fromstring(xml).iter("node"):
        t, d, b = n.get("text", ""), n.get("content-desc", ""), n.get("bounds", "")
        if (t or d) and b:
            x1, y1, x2, y2 = map(int, re.findall(r"\d+", b))
            if x2 <= x1 or y2 <= y1:
                continue  # off-screen
            out.append((t, d, (x1, y1, x2, y2), n.get("package", "")))
    return out


def find(q):
    for t, d, b, p in nodes():
        if q == t or q == d:
            return b
    for t, d, b, p in nodes():
        if q in t or q in d:
            return b
    sys.exit("NOT FOUND: " + q)


def press(q, ms=None):
    b = find(q)
    safe()  # re-check right before touching the screen
    x, y = (b[0] + b[2]) // 2, (b[1] + b[3]) // 2
    if ms:
        adb("shell", "input", "swipe", str(x), str(y), str(x), str(y), str(ms))
    else:
        adb("shell", "input", "tap", str(x), str(y))
    print("pressed", q, (x, y), b)


def shot(name):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name + ".png")
    open(p, "wb").write(adb("exec-out", "screencap", "-p", binary=True))
    print(p)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    c, a = sys.argv[1], sys.argv[2:]
    if c == "shot": shot(a[0])
    elif c == "dump":
        for t, d, b, p in nodes(): print(f"{t!r}|{d!r}|{b}|{p}")
    elif c == "tap": press(a[0])
    elif c == "longpress": press(a[0], 800)
    elif c == "scrollto":  # swipe up (content moves up) until <text> is on screen, max 12 swipes
        for i in range(12):
            if any(a[0] in t or a[0] in d for t, d, b, p in nodes() if b[1] > 250 and b[3] < 2150):
                print("visible", a[0]); break
            safe(); adb("shell", "input", "swipe", "540", "1700", "540", "900", "300"); time.sleep(0.8)
        else:
            sys.exit("NOT FOUND after scrolling: " + a[0])
    elif c == "key":
        safe(None); adb("shell", "input", "keyevent", a[0]); print("key", a[0])
    elif c == "start":
        safe(None)
        adb("shell", "am", "force-stop", PKG)
        print(adb("shell", "am", "start", "-W", "-n", PKG + "/.MainActivity"))
