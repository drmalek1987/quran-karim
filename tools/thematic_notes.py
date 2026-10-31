# Cuts the bottom margin of every page of the thematic mushaf («مصحف التفصيل الموضوعي», Dar al-Fajr, published with
# permission) into web/thmnotes/NNN.webp, NNN = King Fahd page (PDF page = mushaf page + 6). The margin lies between two
# ornamental bands at the bottom of the page: the inner frame under the text and the outer page border; both show as
# runs of 15+ rows that are mostly not white. Usage: python3 tools/thematic_notes.py "<pdf>" [first last]
import os, subprocess, sys, tempfile
import numpy as np
from PIL import Image

def box(im):
    a = np.asarray(im.convert('RGB')).astype(int); h, w, _ = a.shape
    nw = (a[:, int(w * .12):int(w * .72)].min(2) < 215).mean(1)
    runs, y = [], int(h * .70)
    while y < h:
        if nw[y] > .55:
            s0 = y
            while y < h and (nw[y] > .55 or (y + 2 < h and nw[y + 2] > .55)): y += 1
            if y - s0 >= 15: runs.append((s0, y))
        y += 1
    if len(runs) < 2: return None
    top, lo = runs[-2][1] + 1, runs[-1][0] - 1
    return (int(w * .045), top, int(w * .955), lo) if lo - top >= 15 else None

if __name__ == '__main__':
    pdf = sys.argv[1]; first, last = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1, 604)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'thmnotes'); os.makedirs(out, exist_ok=True)
    tmp = tempfile.mkdtemp(); bad = []
    for n in range(first, last + 1):
        p = n + 6
        subprocess.run(['pdftoppm', '-r', '150', '-f', str(p), '-l', str(p), '-png', pdf, tmp + '/a'], check=True)
        im = Image.open('%s/a-%03d.png' % (tmp, p)); b = box(im)
        if not b: bad.append(n); continue
        c = im.crop(b).convert('RGB'); c = c.resize((c.width * 3 // 4, c.height * 3 // 4), Image.LANCZOS)
        c.save(os.path.join(out, '%03d.webp' % n), quality=72)
    print('pages without a margin found:', bad)
