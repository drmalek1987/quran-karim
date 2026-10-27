"""Similar verses (mutashabihat) for the verse screen: data/mutashabiha_data.json -> web/mutashabihat.js.

Source: github.com/Waqar144/Quran_Mutashabihat_Data (CC0 1.0), the verses that huffaz most often confuse, after the work of
Qari Idrees al-Asim. It names verses only (absolute verse numbers); their text in the app is the verified mushaf text.
Output: window.MUTASH = {"s:a": [[[s, a], ...], ...]}: for each verse, the passages similar to it (a passage is one or more
verses), both ways (if A is listed as similar to B, B is also listed under A).
"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
COUNTS = [s["total_verses"] for s in json.load(open(os.path.join(ROOT, "data", "quran-uthmani-quranenc.json"), encoding="utf-8"))]
ABS = []
for s, c in enumerate(COUNTS):
    for a in range(c): ABS.append([s + 1, a + 1])
assert len(ABS) == 6236
data = json.load(open(os.path.join(ROOT, "data", "mutashabiha_data.json"), encoding="utf-8"))
out = {}


def verses(x):
    x = x["ayah"]
    return [ABS[i] for i in (x if isinstance(x, list) else [x])]


def add(src, passage):
    for s, a in src:
        k = "%d:%d" % (s, a)
        if [s, a] in passage: continue
        lst = out.setdefault(k, [])
        if passage not in lst: lst.append(passage)


for juz in data.values():
    for m in juz:
        src = verses(m["src"])
        for mu in m["muts"]:
            p = verses(mu)
            add(src, p); add(p, src)
for k in out: out[k].sort()
with open(os.path.join(ROOT, "web", "mutashabihat.js"), "w", encoding="utf-8") as f:
    f.write("// Similar verses, from Quran_Mutashabihat_Data (CC0). Made by tools/mutashabihat/make.py.\nwindow.MUTASH=")
    json.dump(out, f, separators=(",", ":"))
    f.write(";\n")
print(len(out), "verses,", sum(len(v) for v in out.values()), "links")
