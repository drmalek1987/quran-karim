# Clears the tajweed layer over the ayah-number medallions of the older King Fahd scans (found by markers.py).
import sys, os, cv2, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from markers import find
W = '/mnt/project-files/quran-app/web/editions/'
def run(n):
    a = np.asarray(Image.open(W + 'kfold/%03d.avif' % n).convert('RGB')).astype(int)
    tp = W + 'kfold-tj/%03d.webp' % n
    if not os.path.exists(tp): return 0
    t = np.array(Image.open(tp).convert('RGBA'))
    m = np.zeros(a.shape[:2], np.uint8); k = 0
    for x, y, w, h in find(W + 'kfold/%03d.avif' % n, n): cv2.rectangle(m, (x - 1, y - 1), (x + w + 1, y + h + 1), 255, -1); k += 1
    t[m > 0, 3] = 0
    Image.fromarray(t).save(tp, lossless=True, method=6)
    return k
if __name__ == '__main__':
    a, b = int(sys.argv[1]), int(sys.argv[2])
    for n in range(a, b + 1): print(n, run(n))
