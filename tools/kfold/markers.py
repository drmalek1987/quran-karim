# Finds the ayah-number medallions on the older King Fahd scans: inside the text frame the only coloured ink is the
# medallions (pink, teal and pale cyan), so dilated colour blobs of medallion size are them. Returns boxes in pixels.
import cv2, numpy as np
from PIL import Image
def find(path, n):
    a = np.asarray(Image.open(path).convert('RGB')).astype(int); h, w, _ = a.shape
    sat = ((a.max(2) - a.min(2)) > 16).astype(np.uint8) * 255
    fx = (129, 788) if n % 2 else (214, 873)
    m = np.zeros_like(sat); y0, y1 = int(h * .105), int(h * .89); x0, x1 = int(w * fx[0] / 1000) - 4, int(w * fx[1] / 1000) + 4
    m[y0:y1, x0:x1] = sat[y0:y1, x0:x1]
    m = cv2.dilate(m, np.ones((9, 9), np.uint8))
    k, lab, st, _ = cv2.connectedComponentsWithStats(m)
    return [tuple(int(v) for v in st[i][:4]) for i in range(1, k) if 20 <= st[i][2] <= 48 and 26 <= st[i][3] <= 56]
if __name__ == '__main__':
    import sys
    for n in map(int, sys.argv[1:]): print(n, find('/mnt/project-files/quran-app/web/editions/kfold/%03d.avif' % n, n))
