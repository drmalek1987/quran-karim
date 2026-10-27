"""Makes the scanned pages easier to read: source/pages-original/NNN.jpg -> web/pages/NNN.avif.

1. 2x super-resolution (ESPCN, tools/models/ESPCN_x2.pb, from github.com/fannymonori/TF-ESPCN), then down to 1.5x:
   strokes and tashkeel get sharp edges instead of the blur of a 413-px scan stretched over a phone screen.
2. The paper is set to pure white and the ink darkened, so the app can colour the page background
   (white, grey, black or any colour) by blending, see .page-box in style.css.
3. Mild unsharp mask. Decorated pages (strong colour, e.g. al-Fatiha) skip step 2 to keep their colours.
4. Saved as AVIF: at the same sharpness of strokes and tashkeel it is under half the size of WebP for these pages
   (quality 40 for plain pages, 50 for the decorated ones). Android System WebView reads AVIF from version 85.

Needs: pip install opencv-contrib-python-headless pillow (Pillow 11.3+ for AVIF)
"""
import os, sys
import cv2
import numpy as np
from concurrent.futures import ProcessPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "source", "pages-original")
OUT = os.path.join(ROOT, "web", "pages")
SCALE = 0.75  # of the 2x model output, i.e. 1.5x the scan


def enhance(path, info=None):
    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(os.path.join(HERE, "models", "ESPCN_x2.pb"))
    sr.setModel("espcn", 2)
    im = sr.upsample(cv2.imread(path))
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    f = im.astype(np.float32)
    paper = np.array([np.percentile(f[..., c][g > np.percentile(g, 40)], 75) for c in range(3)])
    sat = float(np.median(cv2.cvtColor(im, cv2.COLOR_BGR2HSV)[..., 1][g > np.percentile(g, 40)]))
    plain = paper.min() > 150 and sat < 60
    if info is not None: info["plain"] = plain
    if plain:  # plain paper page
        f = np.clip(f * (255.0 / paper), 0, 255)
        lab = cv2.cvtColor(f.astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
        L = lab[..., 0] / 255.0
        lab[..., 0] = np.clip((L - 0.08) / 0.80, 0, 1) ** 1.6 * 255  # darker strokes, speckle-free white paper
        im = cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR)
    blur = cv2.GaussianBlur(im, (0, 0), 1.2)
    im = cv2.addWeighted(im, 1.6, blur, -0.6, 0)
    h, w = im.shape[:2]
    return cv2.resize(im, (round(w * SCALE), round(h * SCALE)), interpolation=cv2.INTER_AREA)


def one(name):
    from PIL import Image
    info = {}
    im = enhance(os.path.join(SRC, name), info)
    Image.fromarray(cv2.cvtColor(im, cv2.COLOR_BGR2RGB)).save(os.path.join(OUT, name.replace(".jpg", ".avif")),
                                                           quality=40 if info["plain"] else 50, speed=4)
    return name


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    names = sorted(n for n in os.listdir(SRC) if n.endswith(".jpg"))
    with ProcessPoolExecutor() as ex:
        for i, n in enumerate(ex.map(one, names)):
            if i % 50 == 0: print(i, n, flush=True)
    print("done", len(names))
