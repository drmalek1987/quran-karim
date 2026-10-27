"""Tajweed colour layer for the King Fahd edition: web/editions/kfgqpc-tj/NNN.webp, a transparent image with the ink of each
tajweed letter recoloured, drawn by the app over the page (the same way as the scanned edition's layer).

The QPC V2 page fonts draw a whole word as one glyph, so a letter can't be coloured in the font itself. Instead each word
is also rendered with the Complex's Hafs font (same Madinah calligraphy, one glyph per letter, HarfBuzz clusters give the
character of every pixel), its columns are aligned to the page word's columns by dynamic time warping over ink profiles,
and every ink pixel of the page word takes the rule of the nearest Hafs letter at the matching place. Only ink that is on
the page is coloured.

Usage: python3 tajweed.py PNG_DIR WORDS_JSON OUT_DIR [first last]
  PNG_DIR = render.js output (png/NNN.png, drawn 1.6x), WORDS_JSON = render.js with WORDS=1 (word boxes in CSS px).
"""
import sys, os, json
from multiprocessing import Pool
import cv2, numpy as np
from PIL import Image
import uharfbuzz as hb, freetype
from numba import njit

PNG, WORDS, OUT = sys.argv[1:4]
FIRST, LAST = (int(sys.argv[4]), int(sys.argv[5])) if len(sys.argv) > 5 else (1, 604)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'UthmanicHafs1Ver18.ttf')
SCALE = 1.6           # render.js deviceScaleFactor
OUT_W = 794           # width of the app's page images
QT = [[v['text'].strip() for v in s['verses']] for s in json.load(open(os.path.join(ROOT, 'data/quran-uthmani-quranenc.json'), encoding='utf8'))]
_t = open(os.path.join(ROOT, 'web/tajweed-data.js'), encoding='utf8').read()
TJ = json.loads(_t[_t.index('=') + 1:].strip().rstrip(';'))
# Same colours as the text view (style.css --tj-*, light theme); the app brightens the layer on dark pages.
HEX = ['9aa1a8', '9aa1a8', '9aa1a8', 'c68a00', 'ef6c00', 'd63031', '8e0e0e', '2b8a3e', '0b9a73', 'b0389b', '1488a8', '5c940d', '9aa1a8', '7a9a0b', '9aa1a8', '9aa1a8', '1c6fd6']
COL = np.array([[int(h[i:i + 2], 16) for i in (0, 2, 4)] for h in HEX], np.uint8)
SIZE = 64
_hb = None


def render(text):
    """Ink and per-pixel character index of a word in the Hafs font, columns left to right as drawn."""
    global _hb
    if _hb is None:
        face = hb.Face(hb.Blob.from_file_path(FONT))
        _hb = (hb.Font(face), face.upem, freetype.Face(FONT))
    font, upm, ft = _hb
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    buf.cluster_level = hb.BufferClusterLevel.MONOTONE_CHARACTERS
    hb.shape(font, buf, {})
    sc = SIZE / upm; ft.set_pixel_sizes(0, SIZE)
    W = int(sum(p.x_advance for p in buf.glyph_positions) * sc) + 40
    H = int(SIZE * 2.4); base = int(SIZE * 1.45)
    ink = np.zeros((H, W), np.uint8); lab = np.full((H, W), -1, np.int32)
    pen = 20.0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        ft.load_glyph(info.codepoint, freetype.FT_LOAD_RENDER)
        g = ft.glyph; bm = g.bitmap
        if bm.width and bm.rows:
            a = np.array(bm.buffer, np.uint8).reshape(bm.rows, bm.pitch)[:, :bm.width]
            x0 = int(round(pen + pos.x_offset * sc)) + g.bitmap_left
            y0 = base - int(round(pos.y_offset * sc)) - g.bitmap_top
            ys, xs = slice(max(0, y0), min(H, y0 + bm.rows)), slice(max(0, x0), min(W, x0 + bm.width))
            aa = a[ys.start - y0:ys.stop - y0, xs.start - x0:xs.stop - x0]
            ink[ys, xs] = np.maximum(ink[ys, xs], aa)
            lab[ys, xs] = np.where(aa > 100, info.cluster, lab[ys, xs])
        pen += pos.x_advance * sc
    # RTL: HarfBuzz returns glyphs in visual order (left to right) already for the run, so the bitmap is as drawn.
    return ink, lab


def trim(ink):
    ys, xs = np.nonzero(ink > 60)
    return (ys.min(), ys.max() + 1, xs.min(), xs.max() + 1) if len(ys) else None


@njit
def dtw(A, B, band):
    """For each column of A, the matching column of B."""
    n, m = A.shape[0], B.shape[0]
    D = np.full((n + 1, m + 1), 1e18); P = np.zeros((n + 1, m + 1), np.int8); D[0, 0] = 0
    for i in range(1, n + 1):
        c = i * m / n; lo = max(1, int(c - band)); hi = min(m, int(c + band))
        for j in range(lo, hi + 1):
            d = 0.0
            for k in range(A.shape[1]): d += abs(A[i - 1, k] - B[j - 1, k])
            best = D[i - 1, j - 1]; p = 0
            if D[i - 1, j] + 0.05 < best: best = D[i - 1, j] + 0.05; p = 1
            if D[i, j - 1] + 0.05 < best: best = D[i, j - 1] + 0.05; p = 2
            D[i, j] = best + d; P[i, j] = p
    mp = np.zeros(n); cnt = np.zeros(n); i, j = n, m
    while i > 0 and j > 0:
        mp[i - 1] += j - 1; cnt[i - 1] += 1
        p = P[i, j]
        if p == 0: i -= 1; j -= 1
        elif p == 1: i -= 1
        else: j -= 1
    return mp / np.maximum(cnt, 1)


def feat(ink, nb=12):
    f = ink.astype(np.float32) / 255
    h = max(1, ink.shape[0] // nb)
    return np.ascontiguousarray(cv2.blur(f[:h * nb].reshape(nb, h, -1).mean(1).T, (1, 3)))


def drop_ornament(crop, lh):
    """On some lines the ayah-end ornament is drawn inside the ayah's last word box: blank it (a ring about as wide as tall)."""
    n, lab, st, _ = cv2.connectedComponentsWithStats((crop > 70).astype(np.uint8), 8)
    for i in range(1, n):
        x, y, cw, ch = st[i, :4]
        if cw > lh * 0.45 and ch > lh * 0.45 and abs(cw - ch) < 0.3 * max(cw, ch) and x < crop.shape[1] * 0.5:
            crop[y:y + ch, x:x + cw] = 0


def word_rules(s, a, w):
    """The word's text and, for each of its characters, the tajweed rule (-1 = none)."""
    t = QT[s - 1][a - 1]; parts = []; off = 0
    for tok in t.split(' '):
        if tok: parts.append((off, tok))
        off += len(tok) + 1
    if w > len(parts): return None, None
    o, tok = parts[w - 1]
    rule = np.full(len(tok), -1, np.int32); sp = TJ['q'][s - 1][a - 1] or []
    for i in range(0, len(sp), 3):
        for c in range(max(sp[i], o), min(sp[i + 1], o + len(tok))): rule[c - o] = sp[i + 2]
    return tok, rule


def page(n):
    img = np.asarray(Image.open(os.path.join(PNG, '%03d.png' % n)).convert('L'))
    H, W = img.shape
    layer = np.zeros((H, W, 4), np.uint8)
    for k, x0, y0, x1, y1 in WORDS_OF[str(n)]:
        s, a, w = map(int, k.split(':'))
        tok, rule = word_rules(s, a, w)
        if tok is None or (rule < 0).all(): continue
        X0, X1 = int(x0 * SCALE), int(x1 * SCALE) + 1
        cy = (y0 + y1) / 2 * SCALE; Y0, Y1 = int(cy - 34 * SCALE), int(cy + 30 * SCALE)
        X0, Y0, X1, Y1 = max(0, X0), max(0, Y0), min(W, X1), min(H, Y1)
        crop = 255 - img[Y0:Y1, X0:X1]
        if w == len(QT[s - 1][a - 1].split()):
            crop = crop.copy(); drop_ornament(crop, (y1 - y0) * SCALE)
        bb = trim(crop)
        if bb is None: continue
        ink, lab = render(tok)
        rb = trim(ink)
        if rb is None: continue
        # The Hafs word scaled to the page word's ink box.
        ry0, ry1, rx0, rx1 = rb; cy0, cy1, cx0, cx1 = bb
        hw, hh = cx1 - cx0, cy1 - cy0
        if hw < 4 or hh < 12: continue
        ri = cv2.resize(ink[ry0:ry1, rx0:rx1], (hw, hh), interpolation=cv2.INTER_AREA)
        rl = cv2.resize(lab[ry0:ry1, rx0:rx1].astype(np.float32), (hw, hh), interpolation=cv2.INTER_NEAREST).astype(np.int32)
        pi = crop[cy0:cy1, cx0:cx1]
        mp = dtw(feat(pi), feat(ri), max(8, hw // 4))   # page column -> Hafs column
        # Nearest Hafs letter to every place, and how far it is.
        has = (rl >= 0).astype(np.uint8)
        dist, lbl = cv2.distanceTransformWithLabels(1 - has, cv2.DIST_L2, 3, labelType=cv2.DIST_LABEL_PIXEL)
        ys, xs = np.nonzero(has); idx = np.zeros(lbl.max() + 1, np.int32); idx[lbl[ys, xs]] = rl[ys, xs]
        near = idx[lbl]
        pys, pxs = np.nonzero(pi > 70)
        hx = np.clip(np.round(mp[pxs]).astype(int), 0, hw - 1)
        ok = dist[pys, hx] < max(3, hh * 0.08)
        ch = np.where(ok, near[pys, hx], -1)
        rr = np.where((ch >= 0) & (ch < len(rule)), rule[np.clip(ch, 0, len(rule) - 1)], -1)
        sel = rr >= 0
        Ys, Xs = pys[sel] + Y0 + cy0, pxs[sel] + X0 + cx0
        layer[Ys, Xs, :3] = COL[rr[sel]]
        layer[Ys, Xs, 3] = pi[pys[sel], pxs[sel]]
    # The ayah-end ornaments are words of their own; nothing in them is coloured.
    for k, x0, y0, x1, y1 in WORDS_OF[str(n)]:
        s, a, w = map(int, k.split(':'))
        if word_rules(s, a, w)[0] is None: layer[max(0, int(y0 * SCALE) - 20):int(y1 * SCALE) + 20, max(0, int(x0 * SCALE) - 1):int(x1 * SCALE) + 2] = 0
    im = Image.fromarray(layer, 'RGBA')
    im = im.resize((OUT_W, round(H * OUT_W / W)), Image.LANCZOS)
    # 16 alpha levels keep the lossless WebP small (as the scanned edition's layer).
    arr = np.asarray(im).copy(); arr[..., 3] = (arr[..., 3] // 16) * 17
    Image.fromarray(arr, 'RGBA').save(os.path.join(OUT, '%03d.webp' % n), lossless=True, method=6)
    return n


WORDS_OF = json.load(open(WORDS))
if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    with Pool() as pool:
        for n in pool.imap_unordered(page, range(FIRST, LAST + 1)):
            if n % 50 == 0: print(n, flush=True)
