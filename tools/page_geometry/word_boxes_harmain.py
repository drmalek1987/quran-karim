# Word boxes on the Haramain scans (web/pages/NNN.avif): web/editions/harmain-w/NNN.js, same rows as word_boxes.py.
#
# The Haramain pages are photos with perspective, so the words are aligned in the straightened frame tajweed_pages.py
# paints the tajweed layer in (quads.json -> warp(), ayah spans from words.py, rendering + DTW from align()). The columns
# of each word are carried through the map onto its line in that frame, and the box (one line slot high) goes back onto
# the scan through the inverse of the page's homography; its bounding box in per mille of the scan is the row.
#
#   geo-env\Scripts\python.exe word_boxes_harmain.py SRC [first last]     (run from this folder; SRC/fonts holds
#                                                                          UthmanicHafs1Ver18.ttf)
#   then:  geo-env\Scripts\python.exe word_boxes.py FONT.ttf harmain --review 60     (contact sheet of 60 words)
# Output rows: [s, a, w, x0, y0, x1, y1]  (w = place of the word among the ayah's words without the pause marks).
import sys, os, json
from multiprocessing import Pool
import cv2, numpy as np
import tajweed_pages as tp

OUT = tp.ROOT + '/web/editions/harmain-w'
HALF = 40     # half a line slot (80 px pitch in the straightened frame)


def real(tok):
    return any('ء' <= c <= 'ي' or 'ٱ' <= c <= 'ۓ' or 'ۺ' <= c <= 'ۿ' for c in tok)


def ayah_rows(x, n):
    R = tp.align(x)
    if R is None: return [], None
    text = tp.Q[x['s'] - 1]['verses'][x['a'] - 1]['text']
    spans, at, wi = [], 0, 0
    for t in text.split(' '):
        if real(t): spans.append((wi, at, at + len(t))); wi += 1
        at += len(t) + 1
    lab, mp = R['lab'], R['mp']
    cols = np.full(lab.shape[1], -1, np.int64)
    hit = lab >= 0
    for c in np.nonzero(hit.any(0))[0]: cols[c] = lab[hit[:, c], c].min()
    rows = []
    for w, cs, ce in spans:
        xs = np.nonzero((cols >= cs) & (cols < ce))[0]
        if len(xs) == 0: continue
        sx = mp[xs]
        # the print never splits a word over two lines: the piece that holds most of its columns is the word, a few
        # columns spilled onto the end of the line before (or page before) are dropped
        cnt = [((sx >= m[3]) & (sx < m[4])).sum() for m in R['meta']]
        if max(cnt) < 2: continue
        p, c, z, o0, o1, k = R['meta'][int(np.argmax(cnt))]
        if p == n:
            sel = sx[(sx >= o0) & (sx < o1)]
            xa, xb = z - 1 - (sel.max() - o0) * k, z - 1 - (sel.min() - o0) * k
            rows.append([x['s'], x['a'], w, xa, c - HALF * k, xb + 1, c + HALF * k, c])
    return rows, R['cost']


def page(n):
    rows, costs = [], []
    for x in tp.SP.get(n, []):
        rw, cost = ayah_rows(x, n)
        if cost is not None: costs.append(cost)
        rows += rw
    out = []
    if rows:
        P = tp.pb(n); H, W = P['img'].shape[:2]; Mi = np.linalg.inv(P['M'])
        for s, a, w, x0, y0, x1, y1, c in rows:
            q = cv2.perspectiveTransform(np.array([[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]], np.float32), Mi)[0]
            out.append([s, a, w, int(round(q[:, 0].min() / W * 1000)), int(round(q[:, 1].min() / H * 1000)),
                        int(round(q[:, 0].max() / W * 1000)) + 1, int(round(q[:, 1].max() / H * 1000)), int(c)])
    # a word squeezed to a sliver shares its neighbour's span on that line, split by letter count (earlier word right)
    ln = {}
    for x in tp.SP.get(n, []):
        toks = [t for t in tp.Q[x['s'] - 1]['verses'][x['a'] - 1]['text'].split(' ') if real(t)]
        for i, t in enumerate(toks): ln[(x['s'], x['a'], i)] = len(t)
    for r in out:
        if r[5] - r[3] >= 6: continue
        nb = [q for q in out if q is not r and q[7] == r[7] and q[:2] == r[:2] and abs(q[2] - r[2]) == 1 and q[5] - q[3] >= 6]
        if not nb: continue
        q = max(nb, key=lambda q: q[5] - q[3]); x0, x1 = min(q[3], r[3]), max(q[5], r[5])
        Rr, Ll = (r, q) if r[2] < q[2] else (q, r)
        lr, ll = ln[tuple(Rr[:3])], ln[tuple(Ll[:3])]
        cut = int(round(x1 - (x1 - x0) * lr / (lr + ll)))
        Rr[3], Rr[5], Ll[3], Ll[5] = cut, x1, x0, cut
    tp._pb.clear()
    with open(os.path.join(OUT, '%03d.js' % n), 'w', encoding='utf8') as f:
        f.write('QWB("harmain",%d,%s);\n' % (n, json.dumps([r[:7] for r in out], separators=(',', ':'))))
    return n, len(out), costs, sum(1 for r in out if r[5] - r[3] < 6)


def init(src):
    tp.FONT = os.path.join(src, 'fonts', 'UthmanicHafs1Ver18.ttf'); tp.init()


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    src = sys.argv[1]
    a, b = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (2, 541)
    tot = sq = 0
    with Pool(max(1, os.cpu_count() - 2), initializer=init, initargs=(src,)) as pool:
        for n, k, costs, s in pool.imap_unordered(page, range(a, b + 1)):
            tot += k; sq += s
            if costs and max(costs) > 1.3: print('page', n, 'weak alignment', round(max(costs), 3), flush=True)
    print('boxes', tot, 'squeezed', sq, '%.3f%%' % (100 * sq / max(tot, 1)))
