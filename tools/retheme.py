"""One-off: green theme -> navy + gold (5.21). Rewrites colours in web/, android/res and recolours the launcher/store icons.
Run: .venv\\Scripts\\python.exe -I tools\\retheme.py  (needs pillow in the venv). Safe to read; kept for the record."""
import os, re, glob
from PIL import Image

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def sub(f, pairs, regex=False):
    p = os.path.join(R, f)
    raw = open(p, "rb").read().decode("utf-8")
    s = raw
    for a, b in pairs:
        s = re.sub(a, b, s) if regex else s.replace(a, b)
    if s != raw:
        open(p, "wb").write(s.encode("utf-8"))
    return s != raw

# --- web/style.css: the :root light theme, the two dark blocks, and literal greens
css = os.path.join(R, "web", "style.css")
s = open(css, "rb").read().decode("utf-8")
light = [("--accent: #0f6b4f;", "--accent: #1e3a5f;"), ("--soft: #e9f3ee;", "--soft: #e7edf5;"),
         ("--gold: #b48a33;", "--gold: #c09a2e;"), ("--gold-soft: #f7efdc;", "--gold-soft: #f7f0da;"),
         ("--bg: #f4f2ec;", "--bg: #f2f3f6;"), ("--hl: #f6ecc9;", "--hl: #f3ecc8;"),
         ("--grad: linear-gradient(135deg, #0a4535 0%, #0f6b4f 55%, #16876a 100%);",
          "--grad: linear-gradient(135deg, #122540 0%, #1e3a5f 55%, #2b5283 100%);")]
for a, b in light:
    assert s.count(a) == 1, a
    s = s.replace(a, b)
dark = [("--bg: #0b1210; --card: #141d1a; --text: #e8eee9; --muted: #92a09a; --line: #222e2a;",
         "--bg: #0b0f17; --card: #141a26; --text: #e8ebf1; --muted: #97a0ae; --line: #222b3a;"),
        ("--accent: #23a079; --soft: #16302a;", "--accent: #6b9bd8; --soft: #16233a;"),
        ("--grad: linear-gradient(135deg, #0a4535 0%, #0e6b50 60%, #15876a 100%);",
         "--grad: linear-gradient(135deg, #0f1e35 0%, #1e3a5f 60%, #2b5283 100%);")]
for a, b in dark:
    assert s.count(a) == 2, a
    s = s.replace(a, b)
s = s.replace("#3fc79a", "#5b8fd6").replace("#0f6b4f", "#1e3a5f")
s = re.sub(r"rgba\(15, ?107, ?79,", lambda m: "rgba(30, 58, 95," if " " in m.group(0) else "rgba(30,58,95,", s)
s = s.replace("rgba(46, 160, 110, .28)", "rgba(80, 130, 200, .26)")
assert "0f6b4f" not in s and not re.search(r"15, ?107, ?79", s)
open(css, "wb").write(s.encode("utf-8"))

sub("web/index.html", [('<meta name="theme-color" content="#0a4535">', '<meta name="theme-color" content="#122540">')])
sub("web/app.js", [('"#0f6b4f"', '"#1e3a5f"'), ('"rgba(15,107,79,.07)"', '"rgba(30,58,95,.07)"')])
sub("web/manifest.webmanifest", [(r'"(theme_color|background_color)": "#[0-9a-fA-F]{6}"', r'"\1": "#122540"')], regex=True)
sub("android/res/values/styles.xml", [("#1f5a46", "#1e3a5f")])
sub("android/res/drawable/ic_launcher_bg.xml", [('android:startColor="#0a4535"', 'android:startColor="#122540"'),
    ('android:centerColor="#0f6b4f"', 'android:centerColor="#1e3a5f"'), ('android:endColor="#18906f"', 'android:endColor="#2b5283"')])
sub("android/res/drawable/widget_bg.xml", [("#ff0f6b4f", "#ff1e3a5f"), ("#ff0a4535", "#ff122540")])
sub("android/res/layout/widget.xml", [("#ff0f6b4f", "#ff1e3a5f")])

# --- icons: every green-dominant pixel -> the same lightness in navy (gold, cream and white stay)
def navy(img):
    img = img.convert("RGBA"); px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a and g > r + 12 and g >= b - 4:          # green / teal family
                l = (0.30 * r + 0.59 * g + 0.11 * b) / 255.0   # keep the original brightness
                # navy ramp: dark #0d1b30 .. mid #1e3a5f .. light #3a6aa8
                k = min(1.0, l / 0.55)
                nr = int(13 + (58 - 13) * k); ng = int(27 + (106 - 27) * k); nb = int(48 + (168 - 48) * k)
                px[x, y] = (nr, ng, nb, a)
    return img
for p in glob.glob(os.path.join(R, "android", "res", "mipmap-*", "*.png")) + [os.path.join(R, "store", "icon-512.png")]:
    navy(Image.open(p)).save(p)
print("ok")
