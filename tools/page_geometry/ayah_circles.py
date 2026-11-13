# Checks (and with --fix, re-measures) the ayah line pieces of web/editions/<id>.js against the ayah-end circles on the
# scans: on some pages (586) the pieces sat a word off the print, so the app's ayah highlight and the word boxes missed.
# Each ayah's piece that holds its end must start (on its left) at the left edge of a circle on that line; when it does
# not, the boundary moves to that circle (and the next ayah's piece on the line moves with it).
#   geo-env\Scripts\python.exe ayah_circles.py FONT.ttf kfgqpc [--fix]
#   ... kfold --rebuild    lays every ayah out again between the medallions found on the scan (see rebuild())
# kfold (the older King Fahd print): its ornate medallions are not the font's circle, so the template is the mean
# medallion cut from the scans (kfold_medallion.npy, 34x44 px grey, from tools/kfold/medallion.py; ring at columns 2-31).
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
MK = np.load(os.path.join(HERE, 'kfold_medallion.npy')).astype(np.float32) if ED == 'kfold' else None


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
    gray = 255 - ink
    for (y0, y1), pcs in lines.items():
        t, bt = int(y0 * H / 1000), int(y1 * H / 1000); band = ink[t:bt]
        if MK is not None:   # scores: >= 0.62 on a medallion, <= 0.45 elsewhere (pages 3-604)
            m = cv2.matchTemplate(gray[max(0, t - 6):bt + 6], MK, cv2.TM_CCOEFF_NORMED).max(0); cs = []
            while m.max() > 0.55:
                x = int(m.argmax()); cs.append((x + 2) * 1000 / W); m[max(0, x - 30):x + 30] = -1
            fixes += fix_line(pcs, sorted(cs, reverse=True)); check(p, y0, pcs, cs, out); continue
        best = None
        for fr in (0.54, 0.57, 0.6, 0.63, 0.66):
            tp = circle(int((bt - t) * fr)).astype(np.float32)
            if tp.shape[0] >= band.shape[0] or tp.shape[1] >= band.shape[1]: continue
            m = cv2.matchTemplate(band, tp, cv2.TM_CCOEFF_NORMED).max(0)
            if best is None or m.max() > best[0].max(): best = (m, tp.shape[1])
        m, tw = best; cs = []
        while m.max() > 0.38:
            x = int(m.argmax()); cs.append(x * 1000 / W); m[max(0, x - tw):x + tw] = -1
        fixes += fix_line(pcs, sorted(cs, reverse=True)); check(p, y0, pcs, cs, out)
    return p, out, fixes


def check(p, y0, pcs, cs, out):
    ends = [q for q in pcs if q[2] == q[3] - 1]   # pieces holding their ayah's end
    for s, a, j, n in ends:
        x0 = R[s][a][j][1]
        near = min(cs, key=lambda c: abs(c - x0)) if cs else None
        if near is None or abs(near - x0) > TOL: out.append((p, y0, s + 1, a + 1, x0, None if near is None else round(near)))


GRID = [(112, 164), (164, 216), (216, 268), (268, 318), (318, 370), (370, 422), (422, 474), (474, 526), (526, 578),
        (578, 630), (630, 682), (682, 732), (732, 784), (784, 836), (836, 888)]   # kfold's 15 line slots (per mille)


def medallions(img, bands):
    """kfold: the medallions on the given line bands in reading order, [(band index, left x per mille)]."""
    H, W = img.shape; out = []
    for i, (y0, y1) in enumerate(bands):
        t, bt = int(y0 * H / 1000), int(y1 * H / 1000)
        m = cv2.matchTemplate(img[max(0, t - 6):bt + 6], MK, cv2.TM_CCOEFF_NORMED).max(0); cs = []
        while m.max() > 0.55:   # >= 0.62 on a medallion, <= 0.45 elsewhere (pages 3-604)
            x = int(m.argmax()); cs.append((x + 2) * 1000 / W); m[max(0, x - 30):x + 30] = -1
        out += [(i, c) for c in sorted(cs, reverse=True)]
    return out


# kfold pages 1-2 sit in a circle (Hough: centre 395.5,569.5 px): their lines are found from the ink inside it, their small pale
# medallions (the template scores them barely above the ornament) were measured once on the 794x1139 scans: (left x, centre y) px
DISC12 = (395.5, 569.5, 154)   # text ink ends at radius 151, the rope starts at 157
MED12 = {1: [(318, 450), (287, 490), (412, 528), (254, 528), (311, 568), (392, 606), (336, 684)],
         2: [(472, 490), (472, 529), (393, 567), (258, 605), (334, 684)]}


def frame12(p, rgb):
    """kfold pages 1-2: line bands (per mille), medallions [(band index, left x per mille)] in reading order, each line's
    ink ends (per mille) and the dark-ink mask inside the circle."""
    H, W, _ = rgb.shape; cx, cy, r = DISC12
    yy, xx = np.mgrid[:H, :W]; disc = (xx - cx) ** 2 + (yy - cy) ** 2 < r * r
    dark = (rgb.max(2) < 110) & disc; ext = (rgb.max(2) < 150) & disc   # line ends: the small script's thin strokes (ٱ) too
    rows = dark.sum(1); runs = []
    for y in np.nonzero(rows > 2)[0]:
        if runs and y <= runs[-1][1] + 3: runs[-1][1] = y
        else: runs.append([y, y])
    runs = [q for q in runs if rows[q[0]:q[1] + 1].sum() > 100]   # text lines, not a stray dot
    cut = [runs[0][0] - 6] + [(a[1] + b[0]) // 2 for a, b in zip(runs, runs[1:])] + [runs[-1][1] + 6]
    bands = [(int(round(cut[i] * 1000 / H)), int(round(cut[i + 1] * 1000 / H))) for i in range(len(runs))]
    meds, Ll, Lr = [], [], []
    for i, (y0, y1) in enumerate(bands):
        ms = sorted((x * 1000 / W for x, y in MED12[p] if y0 <= y * 1000 / H < y1), reverse=True)
        meds += [(i, m) for m in ms]
        nz = np.nonzero(ext[int(y0 * H / 1000):int(y1 * H / 1000)].sum(0) >= 2)[0]
        Ll.append(min([nz[0] * 1000 / W - 1] + [m - 1 for m in ms])); Lr.append((nz[-1] + 1) * 1000 / W + 1)
    return bands, meds, Ll, Lr, dark


def rebuild(p):
    """kfold: the old print breaks some lines differently from the King Fahd font print its boxes were mapped from
    (page 370: 26:64-65 a line off), and puts some surah headers on the next page (76/77: Al-Nisa' header). So the page
    is laid out again from the scan: its text lines = the 15 slots without the surah headers (coloured frames) and the
    basmala after each, and every ayah runs from the medallion before it to its own. Only when the medallions found are
    exactly as many as the ayat ending on the page: {(s, a): [pieces on page p]}, else None (page left as it was)."""
    rgb = np.asarray(Image.open(PAGE % p).convert('RGB')).astype(np.int16); H, W, _ = rgb.shape
    ay = [(s, a) for s, sur in enumerate(R) for a, bs in enumerate(sur) if any(b[0] == p for b in bs or [])]
    if not ay: return None
    ends = [(s, a) for s, a in ay if R[s][a][-1][0] == p]
    if p < 3:
        bands, meds, Ll, Lr, dark = frame12(p, rgb); keep = list(range(len(bands))); L1 = max(Lr)
        first = {0: 0} if p == 1 else {1: 1}   # Al-Fatiha starts with its basmala (ayah 1); Al-Baqarah after it
    else:
        xs = [b for s, a in ay for b in R[s][a] if b[0] == p]
        L0 = max(set(b[1] for b in xs), key=[b[1] for b in xs].count); L1 = max(set(b[3] for b in xs), key=[b[3] for b in xs].count)
        sat = (rgb.max(2) - rgb.min(2)) > 40; dark = rgb.max(2) < 110
        hdr = [i for i, (y0, y1) in enumerate(GRID) if sat[int(y0 * H / 1000):int(y1 * H / 1000), int(L0 * W / 1000):int(L1 * W / 1000)].mean() > 0.2]
        starts = [s for s, a in ay if a == 0]
        if len(hdr) == len(starts) + 1 and hdr[-1] == len(GRID) - 1: hdr = hdr[:-1]; tail = True   # next surah's header
        else: tail = False
        if len(hdr) == len(starts): own = list(hdr)
        elif len(hdr) == len(starts) - 1 and ay[0][1] == 0: own = [-1] + hdr   # header at the foot of the page before
        else: return None
        skip, first = set(hdr) | ({len(GRID) - 1} if tail else set()), {}
        for s, h in zip(starts, own):
            b = h + 1 if s == 8 else h + 2   # At-Tawba has no basmala
            if s != 8: skip.add(h + 1)
            first[s] = b
        keep = [i for i in range(len(GRID)) if i not in skip]; bands = [GRID[i] for i in keep]
        meds = medallions(np.asarray(Image.open(PAGE % p).convert("L")).astype(np.float32), bands)
        # each line's own ends from the ink (the mapped frame is up to 10 per mille short on the right, page 585), inside
        # the page's coloured frame
        sc = sat[np.concatenate([np.arange(int(y0 * H / 1000), int(y1 * H / 1000)) for y0, y1 in bands])].mean(0)
        c0 = int((L0 + L1) / 2 * W / 1000); fr = c0 + int(np.argmax(sc[c0:] > 0.3)); fl = c0 - int(np.argmax(sc[:c0][::-1] > 0.3))
        Ll, Lr = [], []
        for y0, y1 in bands:
            col = dark[int(y0 * H / 1000):int(y1 * H / 1000), fl + 3:fr - 3].sum(0); nz = np.nonzero(col >= 2)[0]
            Ll.append((fl + 3 + nz[0]) * 1000 / W - 1 if len(nz) else L0); Lr.append((fl + 3 + nz[-1] + 1) * 1000 / W + 1 if len(nz) else L1)
    if len(meds) != len(ends): return None
    def inked(x0, x1, b):   # no box over the blank part of a short (centred) line, as on page 604
        return dark[int(b[0] * H / 1000):int(b[1] * H / 1000), int(x0 * W / 1000):int(x1 * W / 1000)].mean() > 0.01
    out, k, pos = {}, 0, (0, Lr[0])   # pos: (band index, x) where the next ayah starts
    for s, a in ay:
        if a == 0:
            if first[s] not in keep: return None
            pos = (keep.index(first[s]), Lr[keep.index(first[s])])
        i, x = pos
        if (s, a) in ends:
            j, c = meds[k]; k += 1
            if j < i or (j == i and c > x + 2): return None   # out of order: leave the page alone
            pcs = []
            for q in range(i, j + 1):
                hi = x if q == i else Lr[q]; lo = c if q == j else Ll[q]
                if hi - lo >= 4 and inked(lo, hi, bands[q]): pcs.append([p, int(round(lo)), bands[q][0], int(round(hi)), bands[q][1]])
            out[(s, a)] = pcs
            # the next ayah starts after the medallion when a word follows it on the line (إذ: 24), not frame ink (page 187: 11)
            pos = (j, c) if c - Ll[j] > 16 else (j + 1, Lr[j + 1] if j + 1 < len(bands) else L1)
        else:   # runs on to the next page
            out[(s, a)] = [b for b in ([p, int(round(Ll[q])), bands[q][0], int(round(x if q == i else Lr[q])), bands[q][1]] for q in range(i, len(bands))) if b[3] - b[1] >= 4]
    return out


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
    if '--rebuild' in sys.argv and MK is not None:
        with Pool(max(1, os.cpu_count() - 2)) as pool: rb = dict(zip(range(1, 605), pool.map(rebuild, range(1, 605))))
        done = [p for p in rb if rb[p] is not None]
        for s, sur in enumerate(R):
            for a, bs in enumerate(sur):
                if not bs: continue
                nb = []
                for p in sorted({b[0] for b in bs}):
                    nb += rb[p][(s, a)] if rb.get(p) is not None and (s, a) in rb[p] else [b for b in bs if b[0] == p]
                if nb: sur[a] = nb
        open(SRC, 'w', encoding='utf8', newline='\n').write(src[:i0] + json.dumps(DATA, ensure_ascii=False, separators=(',', ':')) + ';\n')
        print('rebuilt', len(done), 'pages; left as they were:', [p for p in rb if rb[p] is None]); sys.exit()
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
