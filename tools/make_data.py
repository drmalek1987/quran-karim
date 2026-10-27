#!/usr/bin/env python3
"""Builds web/quran-data.js from the two text files in data/.

Display text: Uthmani script from The Noble Qur'an Encyclopedia (quranenc.com),
via the quran-json package (CC BY-SA 4.0).
Search-only text: Tanzil "simple" spelling, used so that normal spelling
(e.g. الصلاة) finds the Uthmani spelling (ٱلصَّلَوٰةَ). It is never displayed.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
uth = json.load(open(os.path.join(ROOT, "data", "quran-uthmani-quranenc.json"), encoding="utf-8"))
simple = json.load(open(os.path.join(ROOT, "data", "quran-simple-search.json"), encoding="utf-8"))["quran"]

assert len(uth) == 114
assert sum(len(s["verses"]) for s in uth) == 6236
assert len(simple) == 6236

# Ayah 1:1 of the simple text is exactly the basmala.
BASMALA = simple[0]["text"].strip() + " "

surahs, text, search = [], [], []
i = 0
for s in uth:
    surahs.append([s["name"], s["transliteration"], 1 if s["type"] == "medinan" else 0, s["total_verses"]])
    text.append([v["text"].strip() for v in s["verses"]])
    row = []
    for v in s["verses"]:
        e = simple[i]
        assert e["chapter"] == s["id"] and e["verse"] == v["id"], (e, s["id"], v["id"])
        t = e["text"].strip()
        # Tanzil simple puts the basmala in front of ayah 1 of most surahs; drop it for search.
        if s["id"] not in (1, 9) and v["id"] == 1 and t.startswith(BASMALA):
            t = t[len(BASMALA):]
        row.append(t)
        i += 1
    search.append(row)

# Page of each ayah in the scanned mushaf. Surah start pages come from the PDF's
# fihris (exact); inside a surah the page is estimated by text length (about +-1 page).
mp = json.load(open(os.path.join(ROOT, "data", "mushaf-pages.json"), encoding="utf-8"))
starts, last_page = mp["surahStart"], mp["lastQuranPage"]
assert len(starts) == 114
pages = []
for i, s in enumerate(uth):
    lens = [len(v["text"]) for v in s["verses"]]
    total = sum(lens)
    end = starts[i + 1] if i < 113 else last_page
    row, done = [], 0
    for n in lens:
        est = starts[i] + done / total * (end + 0.5 - starts[i])
        row.append(min(end, max(starts[i], int(est))))
        done += n
    pages.append(row)

# Exact positions from the page scans (tools/page_geometry.py): each ayah's rectangles as
# [page, x0, y0, x1, y1] in per-mille of the page image. When present they replace the estimate.
rects = None
rp = os.path.join(ROOT, "data", "ayah-rects.json")
if os.path.exists(rp):
    rects = json.load(open(rp, encoding="utf-8"))
    assert [len(r) for r in rects] == [len(s["verses"]) for s in uth]
    pages = [[r[0][0] for r in sur] for sur in rects]

out = os.path.join(ROOT, "web", "quran-data.js")
with open(out, "w", encoding="utf-8") as f:
    f.write("window.QURAN=")
    data = {"s": surahs, "t": text, "q": search, "p": pages, "first": starts[0], "last": last_page, "count": 560}
    if rects:
        data["r"] = rects
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
print("wrote", out, os.path.getsize(out), "bytes")
