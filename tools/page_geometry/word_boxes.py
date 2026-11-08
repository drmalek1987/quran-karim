# Word boxes on the printed scans (King Fahd, Shamarly, old King Fahd): web/editions/<id>-w/NNN.js, one small file per
# page that the app loads when it needs it (word meaning on a long press, recite following, wrong-word colouring).
#
# Same alignment as tajweed_scans.py / tajweed_pages.py: each ayah of the verified text is rendered with the KFGQPC
# Uthmanic Hafs font (HarfBuzz clusters give the character under every rendered pixel), the rendering is aligned to the
# ayah's line pieces on the scan (boxes of web/editions/<id>.js) by dynamic time warping over column ink profiles, and
# the columns of each word are carried through the map back onto the page. A word split over two lines gets two boxes.
# Standalone (no import of tajweed_pages, whose Haramain helpers read Linux paths).
#
#   geo-env\Scripts\python.exe word_boxes.py FONT.ttf kfgqpc [first last]      (run from this folder)
#   ... --review 60    writes word-review-<id>.html: 60 random words cut from the scan next to their text
# Output rows: [s, a, w, x0, y0, x1, y1]  (w = place of the word among the ayah's words without the pause marks, as
# rWords() in app.js; x/y per mille of the page width/height).
import sys, os, json, random, base64
from multiprocessing import Pool
import cv2, numpy as np
from PIL import Image
import uharfbuzz as hb, freetype
from numba import njit

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
FONT, ED = ARGS[0], ARGS[1]
REVIEW = int(sys.argv[sys.argv.index('--review') + 1]) if '--review' in sys.argv else 0
PAGE = ROOT + '/web/editions/%s/%%03d.avif' % ED
OUT = ROOT + '/web/editions/%s-w' % ED
Q = json.load(open(ROOT + '/data/quran-uthmani-quranenc.json', encoding='utf8'))
src = open(ROOT + '/web/editions/%s.js' % ED, encoding='utf8').read()
R = json.loads(src[src.index('=') + 1:].rstrip().rstrip(';'))['r']
SIZE, TOP, BOT, GAP = 46, 50, 34, 14
_hb = None


def real(tok):   # a word, not a pause mark on its own (same rule as rWords: something left after norm)
    return any('ء' <= c <= 'ي' or 'ٱ' <= c <= 'ۓ' or 'ۺ' <= c <= 'ۿ' for c in tok)


def render(text):
    global _hb
    if _hb is None:
        face = hb.Face(hb.Blob.from_file_path(FONT))
        _hb = (hb.Font(face), face.upem, freetype.Face(FONT))
    font, upm, ft = _hb
    buf = hb.Buffer(); buf.add_codepoints([ord(c) for c in text]); buf.guess_segment_properties()
    buf.cluster_level = hb.BufferClusterLevel.MONOTONE_CHARACTERS
    hb.shape(font, buf, {})
    sc = SIZE / upm; ft.set_pixel_sizes(0, SIZE)
    W = int(sum(p.x_advance for p in buf.glyph_positions) * sc) + 20
    H = int(SIZE * 2.2); base = int(SIZE * 1.3)
    ink = np.zeros((H, W), np.uint8); lab = np.full((H, W), -1, np.int32); pen = 10.0
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


@njit(cache=True)
def dtw(A, B, band):
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
    mp = np.zeros(n, np.float64); cnt = np.zeros(n, np.float64); i, j = n, m
    while i > 0 and j > 0:
        mp[i - 1] += j - 1; cnt[i - 1] += 1; p = P[i, j]
        if p == 0: i -= 1; j -= 1
        elif p == 1: i -= 1
        else: j -= 1
    return mp / np.maximum(cnt, 1), D[n, m] / (n + m)


def feat(band, nb=16):
    f = band.astype(np.float32) / 255; h = band.shape[0] // nb
    return cv2.blur(f[:h * nb].reshape(nb, h, -1).mean(1).T, (1, 3))


def rband(ink, rb, dy):
    out = np.zeros((TOP + BOT, ink.shape[1]), np.uint8); y0 = rb - (TOP + dy)
    for r in range(TOP + BOT):
        if 0 <= y0 + r < ink.shape[0]: out[r] = ink[y0 + r]
    return out


_pb = {}
def pb(p):
    if p not in _pb:
        img = cv2.cvtColor(np.asarray(Image.open(PAGE % p).convert('RGB')), cv2.COLOR_RGB2BGR)
        wg = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        b = cv2.adaptiveThreshold(wg, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 27, 12)
        hl = cv2.dilate(cv2.morphologyEx(b, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))), np.ones((3, 3), np.uint8))
        ink = (255 - wg).astype(np.uint8); ink[hl > 0] = 0; b = b.copy(); b[hl > 0] = 0
        # the ayah-end circles and their numbers are coloured, the text is black: left out, so no word is stretched over a
        # circle onto the next ayah (the 3 misses of the first 60-word review)
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV); col = cv2.dilate(((hsv[:, :, 1] > 70) & (hsv[:, :, 2] > 60)).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        ink[col] = 0; b[col] = 0
        _pb[p] = dict(img=img, wg=wg, b=b, ink=ink)
    return _pb[p]


def scan_strip(boxes):
    pieces, meta, off = [], [], 0
    for i, (p, x0, y0, x1, y1) in enumerate(boxes):
        P = pb(p); H, W = P['wg'].shape
        xl, xr = x0 * W / 1000, x1 * W / 1000; t, bt = y0 * H / 1000, y1 * H / 1000
        k = (bt - t) / 80; c = int((t + bt) / 2)
        if i == len(boxes) - 1: xl += 0.62 * (bt - t)   # not the ayah-end circle
        col = (P['b'][int(c - 26 * k):int(c + 20 * k), int(xl):int(xr)] > 0).sum(0); nz = np.nonzero(col)[0]
        if xr - xl < 4 or len(nz) == 0: continue
        a, z = int(xl) + nz[0], int(xl) + nz[-1] + 1
        top = c - int(TOP * k)
        pc = P['ink'][max(0, top):top + int((TOP + BOT) * k), a:z][:, ::-1]
        w = int(round((z - a) / k))
        pc = cv2.resize(pc, (w, TOP + BOT), interpolation=cv2.INTER_CUBIC)
        pieces.append(pc); meta.append((p, z, off, off + w, k, y0, y1, W)); off += w + GAP
    if not pieces: return None, None
    S = np.zeros((TOP + BOT, off - GAP), np.uint8)
    for pc, mt in zip(pieces, meta): S[:, mt[2]:mt[3]] = pc[:, :mt[3] - mt[2]]
    return S, meta


def align(text, boxes):
    S, meta = scan_strip(boxes)
    if S is None: return None
    ink, lab, rb = render(text)
    B = feat(S); best = None
    sp = S.astype(np.float32).sum(1); sp /= sp.max() + 1e-6
    def rowfit(dy):
        rp = rband(ink, rb, dy).astype(np.float32).sum(1); return float((rp / (rp.max() + 1e-6) * sp).sum())
    d0 = max(range(-8, 27), key=rowfit)
    for dy in (d0 - 3, d0, d0 + 3):
        mp, cost = dtw(feat(rband(ink, rb, dy)), B, max(80, int(0.3 * max(ink.shape[1], S.shape[1]))))
        if best is None or cost < best[1]: best = (mp, cost)
    return dict(meta=meta, lab=lab, mp=best[0], cost=best[1])


def ayah_words(s, a, boxes):
    text = Q[s - 1]['verses'][a - 1]['text']
    A = align(text, boxes)
    if A is None: return [], None
    toks = text.split(' '); spans, at, wi = [], 0, 0
    for t in toks:
        if real(t): spans.append((wi, at, at + len(t))); wi += 1
        at += len(t) + 1
    lab, mp, rows = A['lab'], A['mp'], []
    cols = np.full(lab.shape[1], -1, np.int64)   # the character drawn in each rendered column (the lowest one)
    hit = lab >= 0
    for x in np.nonzero(hit.any(0))[0]: cols[x] = lab[hit[:, x], x].min()
    for w, cs, ce in spans:
        xs = np.nonzero((cols >= cs) & (cols < ce))[0]
        if len(xs) == 0: continue
        sx = mp[xs]
        for p, z, o0, o1, k, y0, y1, W in A['meta']:
            sel = sx[(sx >= o0) & (sx < o1)]
            if len(sel) < 2: continue
            xa, xb = z - 1 - (sel.max() - o0) * k, z - 1 - (sel.min() - o0) * k
            rows.append([s, a, w, int(round(xa / W * 1000)), y0, int(round(xb / W * 1000)) + 1, y1])
    return rows, A['cost']


BY = {}
for s, sur in enumerate(R):
    for a, bs in enumerate(sur):
        for p in sorted({b[0] for b in bs or []}): BY.setdefault(p, []).append((s + 1, a + 1, bs))


def page(n):
    rows, costs, miss = [], [], []
    for s, a, bs in BY.get(n, []):
        rw, cost = ayah_words(s, a, bs)
        if cost is not None: costs.append(cost)
        nw = sum(1 for t in Q[s - 1]['verses'][a - 1]['text'].split(' ') if real(t))
        got = {r[2] for r in rw}
        # an ayah running over pages: only its words with a box on this page count here (checked across pages later)
        rows += [r for r in rw if any(b[0] == n and b[2] == r[4] for b in bs)]
        if len(got) < nw: miss.append('%d:%d %d/%d' % (s, a, len(got), nw))
    _pb.clear()
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, '%03d.js' % n), 'w', encoding='utf8') as f:
        f.write('QWB(%s,%d,%s);\n' % (json.dumps(ED), n, json.dumps(rows, separators=(',', ':'))))
    return n, len(rows), costs, miss


def review(k):
    """k random words cut from the scans, next to the word they should be."""
    files = sorted(os.listdir(OUT)); random.seed(int(os.environ.get('SEED', '518'))); cells = []
    for _ in range(k):
        f = random.choice(files); n = int(f[:3])
        rows = json.loads(open(os.path.join(OUT, f), encoding='utf8').read().split(',', 2)[2].rsplit(')', 1)[0])
        if not rows: continue
        s, a, w, x0, y0, x1, y1 = random.choice(rows)
        img = np.asarray(Image.open(PAGE % n).convert('RGB')); H, W = img.shape[:2]
        X0, X1, Y0, Y1 = int(x0 * W / 1000), int(x1 * W / 1000), int(y0 * H / 1000), int(y1 * H / 1000)
        pad = int(0.6 * (Y1 - Y0)); cut = img[Y0:Y1, max(0, X0 - pad):min(W, X1 + pad)].copy()
        cv2.rectangle(cut, (X0 - max(0, X0 - pad), 0), (X1 - max(0, X0 - pad), Y1 - Y0 - 1), (220, 30, 30), 2)
        ok, jp = cv2.imencode('.jpg', cv2.cvtColor(cut, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 85])
        word = [t for t in Q[s - 1]['verses'][a - 1]['text'].split(' ') if real(t)][w]
        cells.append('<div class="c"><img src="data:image/jpeg;base64,%s"><b>%s</b><small>%d · %d:%d · word %d</small></div>' % (base64.b64encode(jp).decode(), word, n, s, a, w + 1))
    html = ('<!DOCTYPE html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>word boxes %s</title><style>body{font-family:sans-serif;background:#f4f2ec}'
            '.c{display:inline-flex;flex-direction:column;align-items:center;gap:4px;background:#fff;margin:6px;padding:8px;border-radius:10px}'
            '.c img{max-height:70px}.c b{font-family:"Amiri Quran",serif;font-size:24px}.c small{color:#777;direction:ltr}</style>'
            '<h3>%s: %d random words (red box = what the app will take for the word below it)</h3>%s</html>') % (ED, ED, len(cells), ''.join(cells))
    out = os.path.join(HERE, 'word-review-%s.html' % ED)
    open(out, 'w', encoding='utf8').write(html); print('review', out)


if __name__ == '__main__':
    if REVIEW: review(REVIEW); sys.exit()
    a, b = (int(ARGS[2]), int(ARGS[3])) if len(ARGS) > 3 else (min(BY), max(BY))
    tot, miss = 0, []
    with Pool(max(1, os.cpu_count() - 2)) as pool:
        for n, k, costs, ms in pool.imap_unordered(page, range(a, b + 1)):
            tot += k; miss += ms
            if costs and max(costs) > 1.3: print('page', n, 'weak alignment', round(max(costs), 3), flush=True)
    print('boxes', tot, 'ayat with missing words', len(miss), ' '.join(miss[:12]))
