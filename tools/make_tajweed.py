"""Builds web/tajweed-data.js: tajweed colouring for the app's Uthmani text (riwayat Hafs).

Input (downloaded by tools/fetch_books.sh into SRC/tajweed):
  tajweed.hafs.embeded.txt  tarekeldeeb/quran-tajweed-embedded (fork of cpfair/quran-tajweed, CC BY 4.0): Tanzil's Uthmani
                            text with one a-z letter written right after each base letter a rule applies to.
                            (The same project's JSON ranges are measured on an older copy of the text and drift.)

The app shows the quranenc text, whose marks differ from Tanzil's, so each rule is carried over letter by letter:
both texts are cut into letters (a base letter with the marks that follow it), the letter sequences are aligned, and
the matching letter is coloured. Output per ayah: flat [start, end, rule, ...] in UTF-16 offsets of the app's text.
"""
import difflib, json, os, re, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "build-src")

# Order = index used in the output. madd_2 (natural madd) is left uncoloured, as in the printed tajweed mushafs.
RULES = ["hamzat_wasl", "lam_shamsiyyah", "silent", "madd_246", "madd_munfasil", "madd_muttasil", "madd_6",
         "ghunnah", "ikhfa", "ikhfa_shafawi", "iqlab", "idghaam_ghunnah", "idghaam_no_ghunnah", "idghaam_shafawi",
         "idghaam_mutajanisayn", "idghaam_mutaqaribayn", "qalqalah"]
SMALL = "ۥۦ"  # small waw / small yaa: written as letters but carried like marks


def is_mark(c):
    return unicodedata.combining(c) or unicodedata.category(c) == "Mn" or c in SMALL


def letters(t):
    """[(start, end, base)] for each letter with its marks; spaces are skipped."""
    out = []
    for i, c in enumerate(t):
        if c == " ":
            continue
        if is_mark(c) and out and out[-1][1] == i:
            out[-1] = (out[-1][0], i + 1, out[-1][2])
        else:
            out.append((i, i + 1, c))
    return out


def norm(c):
    if c in "أإآٱءؤئـ": return "ا"
    if c == "ى": return "ي"
    if c == "ة": return "ه"
    return c


CODE = {"h": "hamzat_wasl", "l": "lam_shamsiyyah", "e": "silent", "m": "madd_246", "s": "madd_munfasil",
        "t": "madd_muttasil", "x": "madd_6", "g": "ghunnah", "k": "ikhfa", "w": "ikhfa_shafawi", "i": "iqlab",
        "d": "idghaam_ghunnah", "n": "idghaam_no_ghunnah", "f": "idghaam_shafawi", "j": "idghaam_mutajanisayn",
        "b": "idghaam_mutaqaribayn", "q": "qalqalah", "o": "madd_2"}


def main():
    quran = json.load(open(os.path.join(ROOT, "data", "quran-uthmani-quranenc.json"), encoding="utf8"))
    out = [[[] for _ in v["verses"]] for v in quran]
    total = kept = 0
    for line in open(os.path.join(SRC, "tajweed", "tajweed.hafs.embeded.txt"), encoding="utf8"):
        if line.count("|") < 2: continue
        s, a, emb = line.rstrip("\n").split("|", 2)
        s, a = int(s), int(a)
        T, rule_at = "", {}  # rule_at: Tanzil codepoint of the base letter -> rule
        for c in emb:
            if "a" <= c <= "z":
                i = len(T) - 1
                while i > 0 and is_mark(T[i]): i -= 1
                rule_at.setdefault(i, CODE[c])
            else:
                T += c
        U = quran[s - 1]["verses"][a - 1]["text"]
        lt, lu = letters(T), letters(U)
        m = {}  # Tanzil letter -> app letter
        sm = difflib.SequenceMatcher(None, [norm(x[2]) for x in lt], [norm(x[2]) for x in lu], autojunk=False)
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op == "equal" or (op == "replace" and i2 - i1 == j2 - j1):
                for d in range(i2 - i1): m[i1 + d] = j1 + d
        spans = []
        for k, (b, e, _) in enumerate(lt):
            r = rule_at.get(b)
            if r not in RULES: continue
            total += 1
            if k not in m: continue
            kept += 1
            spans.append([lu[m[k]][0], lu[m[k]][1], RULES.index(r)])
        out[s - 1][a - 1] = [v for sp in sorted(spans) for v in sp]
    path = os.path.join(ROOT, "web", "tajweed-data.js")
    with open(path, "w", encoding="utf8") as f:
        f.write("window.TAJWEED=" + json.dumps({"rules": RULES, "q": out}, separators=(",", ":")) + ";\n")
    print(f"rules placed {kept}/{total} ({kept / total:.2%}), {os.path.getsize(path) / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
