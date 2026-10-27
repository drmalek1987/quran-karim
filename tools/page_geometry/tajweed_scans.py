# Tajweed colours on the King Fahd and Shamarly printed scans: writes web/editions/<id>-tj/NNN.webp, the same kind of
# transparent layer tajweed_pages.py makes for the Haramain pages, with the same rendering, alignment and painting.
# The difference is where the ayah lines come from: these scans are flat (no perspective to undo), and each ayah's line
# pieces are the boxes of web/editions/<id>.js (per mille of the page width and height, right to left in reading order).
# Run from this folder:  python3 tajweed_scans.py FONT_DIR kfgqpc|shamarly [first last]
import sys, os, json
from multiprocessing import Pool
import cv2, numpy as np
from PIL import Image

ARGS = sys.argv[1:]
FONT_DIR, ED = ARGS[0], ARGS[1]
sys.argv = [sys.argv[0], os.path.dirname(FONT_DIR.rstrip('/'))]
import tajweed_pages as tp
tp.FONT = os.path.join(FONT_DIR, 'UthmanicHafs1Ver18.ttf')
tp.FIX = {}
ROOT = tp.ROOT
PAGE = ROOT + '/web/editions/%s/%%03d.avif' % ED
OUT = ROOT + '/web/editions/%s-tj' % ED
src = open(ROOT + '/web/editions/%s.js' % ED, encoding='utf8').read()
R = json.loads(src[src.index('=') + 1:].rstrip().rstrip(';'))['r']
_pb = {}


def pb(p):
    if p not in _pb:
        img = cv2.cvtColor(np.asarray(Image.open(PAGE % p).convert('RGB')), cv2.COLOR_RGB2BGR)
        wg = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        b = cv2.adaptiveThreshold(wg, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 27, 12)
        hl = cv2.dilate(cv2.morphologyEx(b, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))), np.ones((3, 3), np.uint8))
        ink = (255 - wg).astype(np.uint8); ink[hl > 0] = 0; b = b.copy(); b[hl > 0] = 0
        _pb[p] = dict(img=img, wg=wg, b=b, ink=ink)
    return _pb[p]


def scan_strip(x):
    """The ayah's line pieces cut from the scan, scaled to the 80 px pitch and laid end to end in reading order."""
    pieces, meta, off = [], [], 0
    for i, (p, x0, y0, x1, y1) in enumerate(x['boxes']):
        P = pb(p); H, W = P['wg'].shape
        xl, xr = x0 * W / 1000, x1 * W / 1000
        t, bt = y0 * H / 1000, y1 * H / 1000
        k = (bt - t) / 80; c = int((t + bt) / 2)
        if i == len(x['boxes']) - 1:   # leave out the ayah-end circle at the left of the last piece
            xl += 0.62 * (bt - t)
        col = (P['b'][int(c - 26 * k):int(c + 20 * k), int(xl):int(xr)] > 0).sum(0); nz = np.nonzero(col)[0]
        if xr - xl < 4 or len(nz) == 0: continue
        a, z = int(xl) + nz[0], int(xl) + nz[-1] + 1
        top = c - int(tp.TOP * k)
        pc = P['ink'][max(0, top):top + int((tp.TOP + tp.BOT) * k), a:z][:, ::-1]
        w = int(round((z - a) / k))
        pc = cv2.resize(pc, (w, tp.TOP + tp.BOT), interpolation=cv2.INTER_CUBIC)
        pieces.append(pc); meta.append((p, c, z, off, off + w, k)); off += w + tp.GAP
    if not pieces: return None, None
    S = np.zeros((tp.TOP + tp.BOT, off - tp.GAP), np.uint8)
    for pc, mt in zip(pieces, meta): S[:, mt[3]:mt[4]] = pc[:, :mt[4] - mt[3]]
    return S, meta


tp.pb, tp.scan_strip = pb, scan_strip
BY = {}
for s, sur in enumerate(R):
    for a, bs in enumerate(sur):
        for p in sorted({b[0] for b in bs or []}): BY.setdefault(p, []).append(dict(s=s + 1, a=a + 1, boxes=bs))


def page(n):
    canvas, costs = {}, []
    for x in BY.get(n, []):
        A = tp.align(x)
        if A is None: continue
        costs.append(A['cost'])
        fl = tp.TJ['q'][x['s'] - 1][x['a'] - 1]
        tp.paint(A, [(fl[i], fl[i + 1], fl[i + 2]) for i in range(0, len(fl), 3)], canvas)
    cv = canvas.get(n)
    if cv is None: _pb.clear(); return n, 0, costs
    img = pb(n)['img']; _pb.clear()
    lab = cv2.dilate((cv + 1).astype(np.uint8), np.ones((2, 2), np.uint8))
    dark = 255 - cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.int32)
    alpha = np.clip(dark * 1.6 - 40, 0, 255)
    h, w = lab.shape; out = np.zeros((h, w, 4), np.uint8)
    for r, col in enumerate(tp.COL):
        m = lab == r + 1
        out[m, 0], out[m, 1], out[m, 2] = col
    out[:, :, 3] = np.where(lab > 0, (alpha + 8) // 17 * 17, 0)
    Image.fromarray(out).save(os.path.join(OUT, '%03d.webp' % n), lossless=True, method=6)
    return n, int((lab > 0).sum()), costs


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    a, b = (int(ARGS[2]), int(ARGS[3])) if len(ARGS) > 3 else (1, max(BY))
    with Pool(os.cpu_count()) as pool:
        for n, px, costs in pool.imap_unordered(page, range(a, b + 1)):
            if costs and max(costs) > 1.3: print('page', n, 'weak alignment', round(max(costs), 3), flush=True)
    print('pages', len(os.listdir(OUT)), 'size', round(sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) / 1e6, 2), 'MB')
