# Tajweed colours on the scanned pages: writes web/tjpages/NNN.webp, a transparent layer with the ink of each tajweed letter
# recoloured, drawn by the app over the page scan.
#
# The scans have no text layer, so each ayah of the verified text (data/quran-uthmani-quranenc.json, the encoding the
# KFGQPC Uthmanic Hafs font is made for) is rendered with that font, which follows the same Madinah calligraphy as the
# printed mushaf. The rendering is aligned to the ayah's lines on the scan (spans from words.py, i.e. the geometry behind
# data/ayah-rects.json) with dynamic time warping over per-column ink profiles. Every rendered glyph knows which character
# it draws (HarfBuzz clusters), so the pixels of each letter in web/tajweed-data.js are carried through the alignment onto
# the scan, and the scan's own ink under them is coloured. Nothing is drawn that is not ink on the page.
#
# Needs: pip install opencv-python-headless numpy numba uharfbuzz freetype-py, and the font UthmanicHafs1Ver18.ttf
# (downloaded by tools/fetch_books.sh into SRC/fonts). Run from this folder (it reads quads.json, scan2.json and seq.json,
# the intermediate files of the steps in README.md):  python3 tajweed_pages.py SRC [first last]
import sys, os, json
from multiprocessing import Pool
import cv2, numpy as np
from PIL import Image
import pipe
ROOT = '/mnt/project-files/quran-app'
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'build-src')
QUADS = json.load(open('quads.json'))
PAGE = ROOT + '/web/pages/%03d.avif'
OUT = ROOT + '/web/tjpages'


def warp(n):
    """The enhanced page, straightened into the frame the geometry was measured in (quads are on the 413x664 scans)."""
    img = cv2.cvtColor(np.asarray(Image.open(PAGE % n).convert('RGB')), cv2.COLOR_RGB2BGR)
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    q = np.array(QUADS[str(n)], np.float32) * np.array([img.shape[1] / 413, img.shape[0] / 664], np.float32)
    MG, NW, NH = pipe.MG, pipe.NW, pipe.NH
    dst = np.array([[MG, MG], [MG + NW, MG], [MG + NW, MG + NH], [MG, MG + NH]], np.float32)
    M = cv2.getPerspectiveTransform(q, dst)
    wg = cv2.warpPerspective(g, M, (NW + 2 * MG, NH + 2 * MG), flags=cv2.INTER_CUBIC, borderValue=255)
    return img, M, wg


pipe.warp = warp
import words
import uharfbuzz as hb, freetype
from numba import njit

FONT = os.path.join(SRC, 'fonts', 'UthmanicHafs1Ver18.ttf')
Q = json.load(open(ROOT + '/data/quran-uthmani-quranenc.json', encoding='utf8'))
TJ = json.loads(open(ROOT + '/web/tajweed-data.js', encoding='utf8').read()[len('window.TAJWEED='):].rstrip().rstrip(';'))
# Same colours as the text view (style.css --tj-*), light theme; the app brightens the layer in dark mode.
HEX = {'grey': '9aa1a8', '246': 'c68a00', 'munf': 'ef6c00', 'mutt': 'd63031', '6': '8e0e0e', 'ghun': '2b8a3e', 'ikh': '0b9a73',
       'ikhs': 'b0389b', 'iql': '1488a8', 'idg': '5c940d', 'idgs': '7a9a0b', 'qal': '1c6fd6'}
RULE_COL = ['grey', 'grey', 'grey', '246', 'munf', 'mutt', '6', 'ghun', 'ikh', 'ikhs', 'iql', 'idg', 'grey', 'idgs', 'grey', 'grey', 'qal']
COL = [tuple(int(HEX[c][i:i + 2], 16) for i in (0, 2, 4)) for c in RULE_COL]
SIZE = 46            # font pixel size that matches the calligraphy at the 80 px line pitch of the straightened page
TOP, BOT = 50, 34    # strip rows around a line centre
GAP = 14             # blank columns put between the lines of one ayah
# Pages 2 and 3 (al-Fatiha, start of al-Baqara) sit inside a wide ornamental frame and were measured on a scan framed a
# little differently: x' = ax*x + bx, y' = ay*y + by, text never right of xmax.
FIX = {2: (.908, -17, 1.0, 6.5, 707), 3: (.901, -17.5, 1.024, 9, 711)}

_hb = None


def render(text):
    """Ink and per-pixel character index of the ayah rendered in one line, columns in reading order; and the baseline row."""
    global _hb
    if _hb is None:
        face = hb.Face(hb.Blob.from_file_path(FONT))
        _hb = (hb.Font(face), face.upem, freetype.Face(FONT))
    font, upm, ft = _hb
    buf = hb.Buffer()
    buf.add_codepoints([ord(c) for c in text])
    buf.guess_segment_properties()
    buf.cluster_level = hb.BufferClusterLevel.MONOTONE_CHARACTERS
    hb.shape(font, buf, {})
    sc = SIZE / upm
    ft.set_pixel_sizes(0, SIZE)
    W = int(sum(p.x_advance for p in buf.glyph_positions) * sc) + 20
    H = int(SIZE * 2.2); base = int(SIZE * 1.3)
    ink = np.zeros((H, W), np.uint8); lab = np.full((H, W), -1, np.int32)
    pen = 10.0
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
    ink, lab = ink[:, ::-1], lab[:, ::-1]
    nz = np.nonzero(ink.sum(0))[0]
    return ink[:, nz[0]:nz[-1] + 1].copy(), lab[:, nz[0]:nz[-1] + 1].copy(), base


@njit
def dtw(A, B, band):
    """Maps each column of A (rendering) to a column of B (scan); returns the map and the mean cost."""
    n, m = A.shape[0], B.shape[0]
    D = np.full((n + 1, m + 1), 1e18)
    P = np.zeros((n + 1, m + 1), np.int8)
    D[0, 0] = 0
    for i in range(1, n + 1):
        c = i * m / n
        lo = max(1, int(c - band)); hi = min(m, int(c + band))
        for j in range(lo, hi + 1):
            d = 0.0
            for k in range(A.shape[1]): d += abs(A[i - 1, k] - B[j - 1, k])
            best = D[i - 1, j - 1]; p = 0
            if D[i - 1, j] + 0.05 < best: best = D[i - 1, j] + 0.05; p = 1
            if D[i, j - 1] + 0.05 < best: best = D[i, j - 1] + 0.05; p = 2
            D[i, j] = best + d; P[i, j] = p
    mp = np.zeros(n, np.float64); cnt = np.zeros(n, np.float64)
    i, j = n, m
    while i > 0 and j > 0:
        mp[i - 1] += j - 1; cnt[i - 1] += 1
        p = P[i, j]
        if p == 0: i -= 1; j -= 1
        elif p == 1: i -= 1
        else: j -= 1
    return mp / np.maximum(cnt, 1), D[n, m] / (n + m)


HL = cv2.getStructuringElement(cv2.MORPH_RECT, (60, 1))
_pb = {}


def pb(p):
    if p not in _pb:
        img, M, wg = warp(p)
        b = cv2.adaptiveThreshold(wg, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 41, 12)
        hl = cv2.dilate(cv2.morphologyEx(b, cv2.MORPH_OPEN, HL), np.ones((3, 3), np.uint8))  # frame rules
        ink = (255 - wg).astype(np.uint8); ink[hl > 0] = 0; b = b.copy(); b[hl > 0] = 0
        _pb[p] = dict(img=img, M=M, wg=wg, b=b, ink=ink)
    return _pb[p]


def scan_strip(x):
    """The ayah's lines cut from the scan and laid end to end in reading order, at the 80 px pitch."""
    segs = list(x['segs']); m = x['m']
    p, sl, xr, xl = segs[-1]
    segs[-1] = [p, sl, xr, m[1] + m[3] + (1 if p not in FIX else -3)]  # leave out the ayah-end circle
    pieces, meta, off = [], [], 0
    for p, sl, xr, xl in segs:
        P = pb(p); c = int(words.center(p, sl)); k = words.slotsize(p) / 80
        if p in FIX:
            ax, bx, ay, by, xmax = FIX[p]
            xr, xl, c, k = min(ax * xr + bx, xmax), max(ax * xl + bx, 24), int(ay * c + by), k * ay
        col = (P['b'][c - int(26 * k):c + int(20 * k), int(xl):int(xr)] > 0).sum(0); nz = np.nonzero(col)[0]
        if xr - xl < 4 or len(nz) == 0: continue
        a, z = int(xl) + nz[0], int(xl) + nz[-1] + 1
        pc = P['ink'][c - int(TOP * k):c - int(TOP * k) + int((TOP + BOT) * k), a:z][:, ::-1]
        w = int(round((z - a) / k))
        if k != 1: pc = cv2.resize(pc, (w, TOP + BOT), interpolation=cv2.INTER_AREA)
        pieces.append(pc); meta.append((p, c, z, off, off + w, k)); off += w + GAP
    if not pieces: return None, None
    S = np.zeros((TOP + BOT, off - GAP), np.uint8)
    for pc, mt in zip(pieces, meta): S[:, mt[3]:mt[4]] = pc[:, :mt[4] - mt[3]]
    return S, meta


def feat(band, nb=16):
    f = band.astype(np.float32) / 255
    h = band.shape[0] // nb
    return cv2.blur(f[:h * nb].reshape(nb, h, -1).mean(1).T, (1, 3))


def rband(ink, rb, dy):
    """Rendered rows placed so that the baseline sits at strip row TOP+dy."""
    out = np.zeros((TOP + BOT, ink.shape[1]), np.uint8)
    y0 = rb - (TOP + dy)
    for r in range(TOP + BOT):
        if 0 <= y0 + r < ink.shape[0]: out[r] = ink[y0 + r]
    return out


def align(x):
    S, meta = scan_strip(x)
    if S is None: return None
    ink, lab, rb = render(Q[x['s'] - 1]['verses'][x['a'] - 1]['text'])
    B = feat(S); best = None
    # vertical placement: best match of the row profiles, then the alignment is tried around it
    sp = S.astype(np.float32).sum(1); sp /= sp.max() + 1e-6
    def rowfit(dy):
        rp = rband(ink, rb, dy).astype(np.float32).sum(1); return float((rp / (rp.max() + 1e-6) * sp).sum())
    d0 = max(range(-8, 27), key=rowfit)
    for dy in (d0 - 3, d0, d0 + 3):
        mp, cost = dtw(feat(rband(ink, rb, dy)), B, max(80, int(0.3 * max(ink.shape[1], S.shape[1]))))
        if best is None or cost < best[1]: best = (mp, cost, dy)
    return dict(meta=meta, lab=lab, rb=rb, mp=best[0], cost=best[1], dy=best[2])


def paint(R, spans, canvas):
    lab, mp, rb, dy = R['lab'], R['mp'], R['rb'], R['dy']
    for st, en, r in spans:
        ys, xs = np.nonzero((lab >= st) & (lab < en))
        if len(ys) == 0: continue
        sx = mp[xs]; sy = ys - rb + dy   # rows from the line centre
        for p, c, z, o0, o1, k in R['meta']:
            sel = (sx >= o0 - 1) & (sx < o1 + 1)
            if not sel.any(): continue
            P = pb(p); H, W = P['wg'].shape
            if p not in canvas: canvas[p] = np.full((H, W), -1, np.int16)
            px = np.clip((z - 1 - (sx[sel] - o0) * k).round().astype(int), 0, W - 1)
            py = np.clip((c + sy[sel] * k).round().astype(int), 0, H - 1)
            mk = np.zeros((H, W), np.uint8); mk[py, px] = 1
            mk = cv2.dilate(mk, np.ones((5, 3) if k == 1 else (7, 5), np.uint8))
            canvas[p][(mk > 0) & (P['b'] > 0)] = r


SP = None


def spans_by_page():
    out = {}
    for x in words.spans():
        if not x['segs']: continue
        for p in sorted({s[0] for s in x['segs']}): out.setdefault(p, []).append(x)
    return out


def page(n):
    canvas, costs = {}, []
    for x in SP.get(n, []):
        R = align(x)
        if R is None: continue
        costs.append(R['cost'])
        fl = TJ['q'][x['s'] - 1][x['a'] - 1]
        paint(R, [(fl[i], fl[i + 1], fl[i + 2]) for i in range(0, len(fl), 3)], canvas)
    cv = canvas.get(n)
    _pb.clear()
    if cv is None: return n, 0, costs
    P = pb(n); img = P['img']; h, w = img.shape[:2]
    # back to the page image; the layer's alpha is the darkness of the scan's own ink, so letter edges stay smooth
    lab = cv2.warpPerspective((cv + 1).astype(np.uint8), np.linalg.inv(P['M']), (w, h), flags=cv2.INTER_NEAREST, borderValue=0)
    lab = cv2.dilate(lab, np.ones((3, 3), np.uint8))
    dark = 255 - cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.int32)
    alpha = np.clip(dark * 1.6 - 40, 0, 255).astype(np.uint8)
    out = np.zeros((h, w, 4), np.uint8)
    for r, col in enumerate(COL):
        m = lab == r + 1
        out[m, 0], out[m, 1], out[m, 2] = col[2], col[1], col[0]
    out[:, :, 3] = np.where(lab > 0, (alpha.astype(np.int32) + 8) // 17 * 17, 0)  # 16 alpha levels: same look, ~40% of the size
    Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGRA2RGBA)).save(os.path.join(OUT, '%03d.webp' % n), lossless=True, method=6)
    return n, int((lab > 0).sum()), costs


def init():
    global SP
    SP = spans_by_page()


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    a, b = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (2, 541)
    with Pool(os.cpu_count(), initializer=init) as pool:
        for n, px, costs in pool.imap_unordered(page, range(a, b + 1)):
            if costs and max(costs) > 1.3: print('page', n, 'weak alignment', round(max(costs), 3), flush=True)
    print('pages', len(os.listdir(OUT)), 'size', round(sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) / 1e6, 2), 'MB')
