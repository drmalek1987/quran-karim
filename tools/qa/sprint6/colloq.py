"""Collect on-screen texts from the phone (uiautomator) and flag Egyptian-colloquial words.

Usage: py -3.11 colloq.py <label>   (appends texts to out/phone/texts.txt, prints hits)
"""
import re, sys
sys.path.insert(0, __import__("os").path.dirname(__file__))
import phone

# Whole-word colloquial markers that should not appear in Fusha UI text.
WORDS = ["عشان", "مش", "دلوقتي", "إيه", "ايه", "ازاي", "إزاي", "خلص", "مخلصتش", "بتاع", "كده", "كدا", "يلا",
         "فكّرني", "فكرني", "عايز", "عاوز", "ده", "دي", "دا", "اللي", "علشان", "بس", "لسه", "هنا؟", "امتى", "فين", "بقى"]
RX = re.compile(r"(?<![\w؀-ۿ])(" + "|".join(map(re.escape, WORDS)) + r")(?![\w؀-ۿ])")

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    texts = sorted({t or d for t, d, b, p in phone.nodes()})
    with open(phone.OUT + "/texts.txt", "a", encoding="utf-8") as f:
        f.write("## " + sys.argv[1] + "\n" + "\n".join(texts) + "\n")
    hits = [t for t in texts if RX.search(t)]
    print(sys.argv[1], len(texts), "texts;", "HITS:" if hits else "no colloquial hits", *hits, sep="\n  ")
