"""Packs the pages drawn by render.js into the app: OUT/png/NNN.png -> web/editions/kfgqpc/NNN.avif, and
OUT/rects.json -> web/editions/kfgqpc.js (window.ED_KFGQPC = {p, r, first, last, count}), the same shape as the
scanned edition's data in quran-data.js: p[s-1][a-1] = page of the ayah, r[s-1][a-1] = its boxes [page, x0, y0, x1, y1].

Usage: python3 make_edition.py OUT
"""
import json, os, sys
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

OUT = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DST = os.environ.get("DST") or os.path.join(ROOT, "web", "editions", "kfgqpc")
COUNTS = [s["total_verses"] for s in json.load(open(os.path.join(ROOT, "data", "quran-uthmani-quranenc.json"), encoding="utf-8"))]


def one(n):
    # Drawn 1.6x, kept at 1.28x (794 px wide): AVIF quality 35 keeps strokes and marks sharp at about 50 KB a page.
    im = Image.open(os.path.join(OUT, "png", "%03d.png" % n)).convert("RGB")
    im.resize((794, round(im.height * 794 / im.width)), Image.LANCZOS).save(os.path.join(DST, "%03d.avif" % n), quality=28, speed=4)
    return n


if __name__ == "__main__":
    os.makedirs(DST, exist_ok=True)
    rects = json.load(open(os.path.join(OUT, "rects.json")))
    assert sorted(map(int, rects)) == list(range(1, 605)), "missing pages"
    r = [[[] for _ in range(c)] for c in COUNTS]
    for n in range(1, 605):
        for s, a, x0, y0, x1, y1 in rects[str(n)]:
            r[s - 1][a - 1].append([n, x0, y0, x1, y1])
    missing = [(s + 1, a + 1) for s in range(114) for a in range(COUNTS[s]) if not r[s][a]]
    assert not missing, missing[:10]
    p = [[boxes[0][0] for boxes in sur] for sur in r]
    with open(os.path.join(ROOT, "web", "editions", "kfgqpc.js"), "w", encoding="utf-8") as f:
        f.write("window.ED_KFGQPC=")
        json.dump({"p": p, "r": r, "first": 1, "last": 604, "count": 605}, f, separators=(",", ":"))
        f.write(";\n")
    with ProcessPoolExecutor() as ex:
        for n in ex.map(one, range(1, 605)):
            if n % 100 == 0: print(n, flush=True)
    print("done")
