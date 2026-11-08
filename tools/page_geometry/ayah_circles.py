# Checks (and with --fix, re-measures) the ayah line pieces of web/editions/<id>.js against the ayah-end circles on the
# scans: on some pages (586) the pieces sat a word off the print, so the app's ayah highlight and the word boxes missed.
# Each ayah's piece that holds its end must start (on its left) at the left edge of a circle on that line; when it does
# not, the boundary moves to that circle (and the next ayah's piece on the line moves with it).
#   geo-env\Scripts\python.exe ayah_circles.py FONT.ttf kfgqpc [--fix]
import sys, os, json
from multiprocessing import Pool
import cv2, numpy as np
from PIL import Image
import uharfbuzz as hb, freetype

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]; FONT, ED = ARGS[0], ARGS[1]
PAGE = ROOT + '/web/editions/%s/%%03d.avif' % ED
SRC = ROOT + '/web/editions/%s.js' % ED
src = open(SRC, encoding='utf8').read(); i0 = src.index('=') + 1
DATA = json.loads(src[i0:].rstrip().rstrip(';')); R = DATA['r']
TOL = 12   # per mille


def circle(h):
    """The ayah-end circle (font glyph for the Arabic digit 5) as a grey template h pixels high."""
    face = freetype.Face(FONT); face.set_pixel_sizes(0, 200)
    f = hb.Font(hb.Face(hb.Blob.from_file_path(FONT))); buf = hb.Buffer(); buf.add_str('٥'); buf.guess_segment_properties()
    hb.shape(f, buf, {}); face.load_glyph(buf.glyph_infos[0].codepoint, freetype.FT_LOAD_RENDER); bm = face.glyph.bitmap
    a = np.array(bm.buffer, np.uint8).reshape(bm.rows, bm.pitch)[:, :bm.width]
    return cv2.resize(a, (max(4, int(round(h * bm.width / bm.rows))), h), interpolation=cv2.INTER_AREA)


def page(p):
    img = np.asarray(Image.open(PAGE % p).convert('L')); H, W = img.shape; ink = (255 - img).astype(np.float32)
    lines = {}
    for s, sur in enumerate(R):
        for a, bs in enumerate(sur):
            for j, b in enumerate(bs or []):
                if b[0] == p: lines.setdefault((b[2], b[4]), []).append([s, a, j, len(bs)])
    out, fixes = [], []
    for (y0, y1), pcs in lines.items():
        t, bt = int(y0 * H / 1000), int(y1 * H / 1000); band = ink[t:bt]
        best = None
        for fr in (0.54, 0.57, 0.6, 0.63, 0.66):
            tp = circle(int((bt - t) * fr)).astype(np.float32)
            if tp.shape[0] >= band.shape[0] or tp.shape[1] >= band.shape[1]: continue
            m = cv2.matchTemplate(band, tp, cv2.TM_CCOEFF_NORMED).max(0)
            if best is None or m.max() > best[0].max(): best = (m, tp.shape[1])
        m, tw = best; cs = []
        while m.max() > 0.38:
            x = int(m.argmax()); cs.append(x * 1000 / W); m[max(0, x - tw):x + tw] = -1
        fixes += fix_line(pcs, sorted(cs, reverse=True))
        ends = [q for q in pcs if q[2] == q[3] - 1]   # pieces holding their ayah's end
        for s, a, j, n in ends:
            x0 = R[s][a][j][1]
            near = min(cs, key=lambda c: abs(c - x0)) if cs else None
            if near is None or abs(near - x0) > TOL: out.append((p, y0, s + 1, a + 1, x0, None if near is None else round(near)))
    return p, out, fixes


MAXMOVE, SKIP = 150, 45
def fix_line(pcs, cs):
    """Interior boundaries of a line (right to left) moved onto the detected circles, matched in order (DP); a boundary
    with no circle near enough keeps its place. Returns [(s, a, j, new x0), (s, a, j, new x1)] changes."""
    pcs = sorted(pcs, key=lambda q: -R[q[0]][q[1]][q[2]][3])
    bd = [q for q in pcs[:-1]]
    if not bd or any(q[2] != q[3] - 1 for q in bd): return []
    xs = [R[q[0]][q[1]][q[2]][1] for q in bd]; k, n = len(xs), len(cs)
    INF = 1e9; D = [[INF] * (n + 1) for _ in range(k + 1)]; B = [[None] * (n + 1) for _ in range(k + 1)]
    for j in range(n + 1): D[0][j] = 0
    for i in range(1, k + 1):
        for j in range(n + 1):
            # boundary i keeps its place (circles up to j used) or takes circle j-1
            if D[i - 1][j] + SKIP < D[i][j]: D[i][j] = D[i - 1][j] + SKIP; B[i][j] = (j, None)
            if j > 0:
                for jj in range(j):
                    c = abs(cs[j - 1] - xs[i - 1]); c = c * 0.25 if c <= MAXMOVE else INF
                    if D[i - 1][jj] + c < D[i][j]: D[i][j] = D[i - 1][jj] + c; B[i][j] = (jj, j - 1)
    j = min(range(n + 1), key=lambda j: D[k][j]); ch = [None] * k
    for i in range(k, 0, -1):
        pj, c = B[i][j]; ch[i - 1] = c; j = pj
    out = []
    for i, c in enumerate(ch):
        if c is None or abs(cs[c] - xs[i]) <= 3: continue
        q, nx = bd[i], pcs[i + 1]; ov = R[nx[0]][nx[1]][nx[2]][3] - xs[i]; x = int(round(cs[c]))
        out.append((q[0], q[1], q[2], 1, x)); out.append((nx[0], nx[1], nx[2], 3, x + ov))
    return out


if __name__ == '__main__':
    with Pool(max(1, os.cpu_count() - 2)) as pool: res = sorted(pool.map(page, range(1, 605)))
    bad = [(p, o) for p, o, f in res if o]
    if '--fix' in sys.argv:
        nf = 0
        for p, o, f in res:
            for si, ai, j, at, v in f: R[si][ai][j][at] = v; nf += 1
        open(SRC, 'w', encoding='utf8', newline='\n').write(src[:i0] + json.dumps(DATA, ensure_ascii=False, separators=(',', ':')) + ';\n')
        print('moved', nf // 2, 'boundaries; wrote', SRC)
    tot = sum(len(o) for _, o in bad)
    print('ayah ends off a circle:', tot, 'on', len(bad), 'pages')
    json.dump(bad, open(os.environ.get('OUTJ', 'circ.json'), 'w'))
    d = [o[5] - o[4] for _, oo in bad for o in oo if o[5] is not None]
    print('none', sum(1 for _, oo in bad for o in oo if o[5] is None), 'hist', np.histogram(d, [-200, -60, -30, -12, 12, 30, 60, 200])[0])
    print('pages with >=3 off', [p for p, o in bad if len(o) >= 3])
