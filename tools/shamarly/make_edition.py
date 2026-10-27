"""Packs the Shamarly-layout pages drawn by render.js into the app: OUT/png/NNN.png (pages 2..522) -> web/editions/shamarly/NNN.avif, and
OUT/tj/NNN.png -> web/editions/shamarly-tj/NNN.webp,
OUT/rects.json -> web/editions/shamarly.js (window.ED_SHAMARLY = {p, r, first, last, count}), the same shape as the
scanned edition's data in quran-data.js: p[s-1][a-1] = page of the ayah, r[s-1][a-1] = its boxes [page, x0, y0, x1, y1].

Usage: python3 make_edition.py OUT
"""
import json, os, sys
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

OUT = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DST = os.environ.get("DST") or os.path.join(ROOT, "web", "editions", "shamarly")
TJ_DST = DST.rstrip("/") + "-tj"
COUNTS = [s["total_verses"] for s in json.load(open(os.path.join(ROOT, "data", "quran-uthmani-quranenc.json"), encoding="utf-8"))]


def one(n):
    # Drawn 1.6x, kept at 1.28x (794 px wide): AVIF quality 35 keeps strokes and marks sharp at about 50 KB a page.
    im = Image.open(os.path.join(OUT, "png", "%03d.png" % n)).convert("RGB")
    im.resize((794, round(im.height * 794 / im.width)), Image.LANCZOS).save(os.path.join(DST, "%03d.avif" % n), quality=28, speed=4)
    # The tajweed layer (render.js TJ=1: OUT/tj/NNN.png, only the coloured letters) -> web/editions/shamarly-tj/NNN.webp,
    # lossless with 16 alpha levels, as the other editions' layers.
    tp = os.path.join(OUT, "tj", "%03d.png" % n)
    if os.path.exists(tp):
        t = Image.open(tp).convert("RGBA")
        t = t.resize((794, round(t.height * 794 / t.width)), Image.LANCZOS)
        a = t.split()[3].point(lambda v: (v // 16) * 17)
        t.putalpha(a)
        t.save(os.path.join(TJ_DST, "%03d.webp" % n), lossless=True, method=6)
    return n


if __name__ == "__main__":
    os.makedirs(DST, exist_ok=True); os.makedirs(TJ_DST, exist_ok=True)
    rects = json.load(open(os.path.join(OUT, "rects.json")))
    assert sorted(map(int, rects)) == list(range(2, 523)), "missing pages"
    r = [[[] for _ in range(c)] for c in COUNTS]
    for n in range(2, 523):
        for s, a, x0, y0, x1, y1 in rects[str(n)]:
            r[s - 1][a - 1].append([n, x0, y0, x1, y1])
    missing = [(s + 1, a + 1) for s in range(114) for a in range(COUNTS[s]) if not r[s][a]]
    assert not missing, missing[:10]
    p = [[boxes[0][0] for boxes in sur] for sur in r]
    with open(os.path.join(ROOT, "web", "editions", "shamarly.js"), "w", encoding="utf-8") as f:
        f.write("window.ED_SHAMARLY=")
        json.dump({"p": p, "r": r, "first": 2, "last": 522, "count": 523}, f, separators=(",", ":"))
        f.write(";\n")
    with ProcessPoolExecutor() as ex:
        for n in ex.map(one, range(2, 523)):
            if n % 100 == 0: print(n, flush=True)
    print("done")
