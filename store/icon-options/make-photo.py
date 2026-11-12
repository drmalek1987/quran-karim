"""Icon options from a real Quran binding: The Met, 56.222 "Qur'an Bookbinding Inset with Turquoise", 16th c., Rogers Fund 1956,
Open Access (CC0). Usage: .venv\\Scripts\\python.exe -I store\\icon-options\\make-photo.py <path to DP137555.jpg>
Writes P1..P4 base images (the word is added by make-photo.js in Chromium, for proper Arabic shaping)."""
import sys, os
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw

src = Image.open(sys.argv[1]).convert("RGB")
D = os.path.dirname(os.path.abspath(__file__))
W, H = src.size                     # 3903 x 3171
k = W / 900.0
front = src.crop((int(388 * k), int(22 * k), int(812 * k), int(712 * k)))   # the front board only
front = ImageEnhance.Contrast(front).enhance(1.08)

def navy_bg():
    bg = Image.new("RGB", (512, 512)); px = bg.load()
    for y in range(512):
        for x in range(512):
            t = (x + y) / 1022
            c0, c1, c2 = (15, 30, 53), (30, 58, 95), (43, 82, 131)
            a, b, u = (c0, c1, t / .55) if t < .55 else (c1, c2, (t - .55) / .45)
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * u) for i in range(3))
    return bg

def shadow_paste(bg, im, xy, blur=14, off=(6, 12), alpha=110):
    sh = Image.new("RGBA", bg.size, (0, 0, 0, 0)); d = ImageDraw.Draw(sh)
    d.rectangle([xy[0] + off[0], xy[1] + off[1], xy[0] + im.width + off[0], xy[1] + im.height + off[1]], fill=(0, 0, 0, alpha))
    sh = sh.filter(ImageFilter.GaussianBlur(blur)); bg.paste(sh, (0, 0), sh); bg.paste(im, xy)

# P1/P2: the whole front board on navy, like a book lying on the screen
b = front.copy(); b.thumbnail((300, 400), Image.LANCZOS)
bg = navy_bg().convert("RGBA"); shadow_paste(bg, b, ((512 - b.width) // 2, (512 - b.height) // 2))
bg.convert("RGB").save(os.path.join(D, "P1.png")); bg.convert("RGB").save(os.path.join(D, "P2.png"))

# P3/P4: the central medallion filling the icon
fw, fh = front.size; side = int(fw * .62)
med = front.crop(((fw - side) // 2, (fh - side) // 2, (fw + side) // 2, (fh + side) // 2)).resize((512, 512), Image.LANCZOS)
med.save(os.path.join(D, "P3.png")); med.save(os.path.join(D, "P4.png"))
# final icon bases (1024): the medallion framing, and a 1.5x wider framing for Android's adaptive layer (108dp, of which the
# launcher shows about the centre 72dp)
for name, f in (("base-1024.png", .60), ("adaptive-1024.png", .90)):
    side = int(fw * f)
    front.crop(((fw - side) // 2, (fh - side) // 2, (fw + side) // 2, (fh + side) // 2)).resize((1024, 1024), Image.LANCZOS).save(os.path.join(D, name))
print(front.size, b.size)
