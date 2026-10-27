"""Page and line plan of the Shamarly-layout mushaf (522 pages, 15 lines), for render.js.

The King Fahd Complex prints a Madinah mushaf in Uthman Taha's script laid out to match the Egyptian Shamarly
print page for page ("مصحف المدينة النبوية الموافق لطبعة الشمرلي"). Its page files can't be fetched here, so the
pages are typeset with the Complex's Hafs font (KFGQPC Uthmanic Script HAFS, free for software and digital
publishing) to the Shamarly layout: every ayah ends on the same page and line, at about the same point, as in
the Shamarly print. Where each ayah ends is taken from shamerly.db of github.com/Mr-DDDAlKilanny/Shamarly
(table mushaf: page, sura, ayah, x, y of each end-of-ayah mark); no page image is used.

Layout facts read from those marks: 15 lines a page, line k centred at y = 45 + 90k; x runs 0 (left) .. ~870
(right, where lines start). A surah title takes 2 lines and the basmala 1 (none for at-Tawba), right after the
line where the previous surah ends, carried over to the next page when the page runs out. Pages 2 and 3 (al-Fatiha
and the start of al-Baqarah) are the decorated opening pages and are laid out on their own.

Usage: python3 -I prep.py shamerly.db OUT.json
Output: {"ayat": [[s, a, page, g0, g1], ...] for pages 4..522, where g0/g1 = where the ayah starts/ends in line
units counted from the first line of page 4 (whole part = line, fraction = how far along the line from its right
end); "heads": [[s, line], ...] the global line of each surah title (basmala follows); "open": {"2": [[s, a]...],
"3": [...]} the ayat of the two opening pages.
"""
import json, sqlite3, sys

DB, OUT = sys.argv[1], sys.argv[2]
R = 870.0   # right end of the lines in the marks' x units
rows = sqlite3.connect(DB).execute("select page, sura, ayah, x, y from mushaf where ayah > 0 order by sura, ayah").fetchall()
assert len(rows) == 6236

def g_of(p, x, y):
    line = min(14, max(0, round((y - 45) / 90)))
    u = min(0.995, max(0.02, (R - x) / R))
    return (p - 4) * 15 + line + u

ayat, heads, opening = [], [], {"2": [], "3": []}
prev_end = None
for p, s, a, x, y in rows:
    if p < 4:
        opening[str(p)].append([s, a])
        continue
    g1 = g_of(p, x, y)
    if a == 1:
        if s == 2:
            raise SystemExit("al-Baqarah 1 expected on page 3")
        # The title takes the 2 lines after the previous surah's last line, then the basmala.
        start = int(prev_end) + 1 if prev_end is not None else 0
        heads.append([s, start])
        g0 = start + (2 if s == 9 else 3)
    else:
        g0 = prev_end if prev_end is not None else 0.0
    assert g1 > g0, (s, a, p, g0, g1)
    ayat.append([s, a, p, round(g0, 4), round(g1, 4)])
    prev_end = g1

json.dump({"ayat": ayat, "heads": heads, "open": opening}, open(OUT, "w"))
print(len(ayat), "ayat,", len(heads), "titles")
