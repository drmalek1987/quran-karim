"""Writes every icon size from make-icon.js output. .venv\\Scripts\\python.exe -I store\\icon-options\\make-icon.py
- store/icon-512.png + store/play/icon-512.png (Play: 512x512, 32-bit PNG with alpha)
- android/res/mipmap-*/ic_launcher.png (legacy, rounded square) and ic_launcher_fg.png (adaptive 108dp layer, opaque)
- store/icon-options/launcher-preview.png (circle / squircle / rounded-square masks as launchers show them)"""
import os
from PIL import Image, ImageDraw

D = os.path.dirname(os.path.abspath(__file__)); R = os.path.dirname(os.path.dirname(D))
icon = Image.open(os.path.join(D, "icon-1024.png")).convert("RGBA")
fg = Image.open(os.path.join(D, "adaptive-fg-1024.png")).convert("RGBA")

def rounded(im, size, radius=.18):
    im = im.resize((size, size), Image.LANCZOS)
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius=int(size * 4 * radius), fill=255)
    im.putalpha(m.resize((size, size), Image.LANCZOS)); return im

for p in ("store/icon-512.png", "store/play/icon-512.png"):
    icon.resize((512, 512), Image.LANCZOS).save(os.path.join(R, p))
for d, legacy, layer in (("mdpi", 48, 108), ("hdpi", 72, 162), ("xhdpi", 96, 216), ("xxhdpi", 144, 324), ("xxxhdpi", 192, 432)):
    base = os.path.join(R, "android", "res", "mipmap-" + d)
    rounded(icon, legacy).save(os.path.join(base, "ic_launcher.png"))
    fg.resize((layer, layer), Image.LANCZOS).save(os.path.join(base, "ic_launcher_fg.png"))

# preview: the adaptive layer shows its centre 72 of 108 dp, cut to the launcher's mask
L = fg.resize((324, 324), Image.LANCZOS).crop((54, 54, 270, 270))
out = Image.new("RGB", (216 * 3 + 40, 216 + 20), (238, 240, 244))
for i, shape in enumerate(("circle", "squircle", "rounded")):
    m = Image.new("L", (864, 864), 0); dr = ImageDraw.Draw(m)
    if shape == "circle": dr.ellipse([0, 0, 863, 863], fill=255)
    else: dr.rounded_rectangle([0, 0, 863, 863], radius=300 if shape == "squircle" else 140, fill=255)
    t = L.copy(); t.putalpha(m.resize((216, 216), Image.LANCZOS)); out.paste(t, (10 + i * 226, 10), t)
out.save(os.path.join(D, "launcher-preview.png")); print("ok")
