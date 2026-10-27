"""Builds web/books/: tafsir, i'rab and the word-meanings lexicon, split into small files the app loads on demand.

Inputs (downloaded by tools/fetch_books.sh into SRC, default ./build-src):
  tafsir/<slug>/<surah>.json   spa5k/tafsir_api, one entry per ayah (grouped ayahs repeat the same text)
  morphology.txt               Quranic Arabic Corpus morphology (word -> root)
  lex/<name>                   OpenITI mARkdown texts of the five dictionaries
"""
import json, os, re, sys, shutil, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "build-src")
OUT = os.path.join(ROOT, "web", "books")
CHUNK = 350_000  # bytes per file, so one ayah never needs a huge download into the WebView

BOOKS = [
    # id, slug, kind, title, author
    ("kathir", "ar-tafsir-ibn-kathir", "tafsir", "تفسير ابن كثير", "ابن كثير (ت ٧٧٤هـ)"),
    ("tabari", "ar-tafsir-al-tabari", "tafsir", "تفسير الطبري", "ابن جرير الطبري (ت ٣١٠هـ)"),
    ("tanwir", "ar-tafseer-tahrir-al-tanwir", "tafsir", "التحرير والتنوير", "الطاهر ابن عاشور (ت ١٣٩٣هـ)"),
    ("qurtubi", "ar-tafseer-al-qurtubi", "tafsir", "تفسير القرطبي", "القرطبي (ت ٦٧١هـ)"),
    ("saadi", "ar-tafsir-as-saadi", "tafsir", "تفسير السعدي", "عبد الرحمن السعدي (ت ١٣٧٦هـ)"),
    ("darwish", "i-rab-al-quran-li-al-darwish", "irab", "إعراب القرآن وبيانه", "محيي الدين درويش (ت ١٤٠٣هـ)"),
    ("jadwal", "al-jadwal-fi-i-rab-al-quran", "irab", "الجدول في إعراب القرآن", "محمود صافي (ت ١٣٧٦هـ)"),
]
LEX = [
    # id, file, title, author
    ("mufradat", "mufradat", "المفردات في غريب القرآن", "الراغب الأصفهاني (ت ٥٠٢هـ)"),
    ("sihah", "sihah", "الصحاح", "الجوهري (ت ٣٩٣هـ)"),
    ("maqayis", "maqayis", "مقاييس اللغة", "ابن فارس (ت ٣٩٥هـ)"),
    ("lisan", "lisan", "لسان العرب", "ابن منظور (ت ٧١١هـ)"),
    ("asas", "asas", "أساس البلاغة", "الزمخشري (ت ٥٣٨هـ)"),
]


def js_file(path, call, *args):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8") as f:
        f.write(call + "(" + ",".join(json.dumps(a, ensure_ascii=False, separators=(",", ":")) for a in args) + ");\n")


def build_books(index):
    for bid, slug, kind, title, author in BOOKS:
        files = {}
        total = 0
        for s in range(1, 115):
            rows = json.load(open(os.path.join(SRC, "tafsir", slug, f"{s}.json"), encoding="utf8"))
            groups = []  # [from, to, text]
            for r in rows:
                # التحرير والتنوير carries the printed edition's page numbers as lines of their own.
                t = re.sub(r"(?m)^صفحة [٠-٩0-9]+\s*$\n?", "", r["text"]).strip()
                if groups and groups[-1][2] == t and groups[-1][1] == r["ayah"] - 1:
                    groups[-1][1] = r["ayah"]
                else:
                    groups.append([r["ayah"], r["ayah"], t])
            parts, cur, size = [], [], 0
            for g in groups:
                n = len(g[2].encode())
                if cur and size + n > CHUNK:
                    parts.append(cur); cur, size = [], 0
                cur.append(g); size += n
            parts.append(cur)
            files[s] = []
            for k, p in enumerate(parts):
                js_file(os.path.join(OUT, bid, f"{s}-{k}.js"), "QB", bid, s, k, p)
                files[s].append(p[0][0])
                total += sum(len(g[2].encode()) for g in p)
        index["books"].append({"id": bid, "kind": kind, "title": title, "author": author, "files": files})
        print(f"{bid:8} {total/1e6:6.1f} MB")


# ---------- lexicon ----------
MARKS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")


def key(r):
    """Spelling-neutral form of a root, so the corpus roots meet each dictionary's headwords."""
    r = MARKS.sub("", r).replace(" ", "")
    r = re.sub("[أإآؤئٱ]", "ء", r).replace("ى", "ي").replace("ة", "ه")
    if len(r) >= 3 and r[-1] in "اوي":
        r = r[:-1] + "ي"
    return r


def keys_for(root):
    k = {key(root)}
    if len(root) == 3 and root[1] == root[2]:
        k.add(key(root[:2]))
    return k


def clean(lines):
    t = " ".join(lines)
    t = re.sub(r"PageV\d+P\d+|ms\d+|\bmilestone\b", " ", t)
    t = t.replace(" ~~", " ").replace("~~", " ")
    t = re.sub(r"\s*\n?#\s+", "\n", t)
    t = re.sub(r"[ \t]+", " ", t)
    return re.sub(r"\n\s*", "\n", t).strip()


def body_start(text):
    m = re.search(r"#META#Header#End#", text)
    return text[m.end():] if m else text


STOP = set("و ف ب ل ك أو في من به له لا ما إن أن عن هو هي يا قد لم لن كل أي إذ إذا ثم بل لو ذا مع".split())


def fragment(tok):
    """A one- or two-letter piece of a word that the OpenITI tagger split around a false heading."""
    tok = MARKS.sub("", tok)
    return 0 < len(tok) <= 2 and tok not in STOP


def parse_heads(text, pattern, glue_check=False):
    """Entries that begin at a '### ' heading matching pattern (group 1 = root, group 2 = rest of line).
    With glue_check, a heading whose neighbours are word fragments (e.g. "قول" + "ه تعالى") is put back into the text."""
    out = collections.defaultdict(list)
    cur, buf = None, []
    lines = body_start(text).split("\n")
    for i, line in enumerate(lines):
        if line.startswith("### "):
            m = re.match(pattern, line)
            if glue_check and cur is not None:
                nxt = lines[i + 1] if i + 1 < len(lines) else ""
                head = line[6:].strip()
                next_tok = (re.sub(r"^(#|~~)\s*", "", nxt).split() or [""])[0]
                word = re.fullmatch("[%s]{2,6}" % AR, head)
                if (m and nxt.startswith("# ") and fragment(next_tok)) or (not m and word):
                    buf[-1:] = [(buf[-1] if buf else "") + head + re.sub(r"^(#|~~)\s*", "", nxt)]
                    lines[i + 1] = ""
                    continue
            if cur: out[cur].append(clean(buf))
            cur, buf = (key(m.group(1)), [m.group(2)]) if m else (None, [])
        elif cur is not None:
            buf.append(line)
    if cur: out[cur].append(clean(buf))
    return out


AR = "ء-ي"


def trim(text, root):
    """Drop leading lines that belong to the previous entry (a heading the OpenITI tagger placed too early):
    the entry starts at the first line with a word built on the root's letters."""
    core = [c for c in key(root) if c not in "اوي"][:3] or list(key(root))
    pat = re.compile(".*".join(map(re.escape, core)))
    lines = text.split("\n")
    for i, l in enumerate(lines[:6]):
        if any(pat.search(key(w)) for w in l.split()[:40]):
            return "\n".join(lines[i:])
    return text


def build_lex(index):
    morph = collections.OrderedDict()
    for line in open(os.path.join(SRC, "morphology.txt"), encoding="utf8"):
        loc, form, tag, feat = line.rstrip("\n").split("\t")
        s, a, w, _ = map(int, loc.split(":"))
        m = re.search(r"ROOT:([^|]+)", feat)
        word = morph.setdefault((s, a), collections.OrderedDict()).setdefault(w, ["", None])
        word[0] += form
        if m: word[1] = m.group(1)
    roots = sorted({w[1] for ws in morph.values() for w in ws.values() if w[1]})
    rid = {r: i for i, r in enumerate(roots)}
    # words per surah: {ayah: [[form, rootId], ...]}
    per = collections.defaultdict(dict)
    for (s, a), ws in morph.items():
        per[s][a] = [[w[0], rid[w[1]] if w[1] else -1] for w in ws.values()]
    for s, d in per.items():
        js_file(os.path.join(OUT, "words", f"{s}.js"), "QW", s, d)
    index["roots"] = roots

    parsers = {
        "lisan": lambda t: parse_heads(t, r"### \$ ([%s ]+?)\s*:\s*(.*)" % AR),
        "sihah": lambda t: parse_heads(t, r"### \| \[([%s ]+)\]\s*(.*)" % AR),
        "maqayis": lambda t: parse_heads(t, r"### \| \(([%s ]+)\)\s*(.*)" % AR),
        "mufradat": lambda t: parse_heads(t, r"### \| ([%s]{2,5})\s*$()" % AR, glue_check=True),
        # Real headings in أساس البلاغة are spaced ("ك ت ب"); unspaced ones are mostly words the tagger split.
        "asas": lambda t: parse_heads(t, r"### \| ([%s]{1,2} [%s ]{1,6}?)\s*$()" % (AR, AR), glue_check=True),
    }
    for lid, fname, title, author in LEX:
        entries = parsers[fname](open(os.path.join(SRC, "lex", fname), encoding="utf8").read())
        found, chunks = 0, collections.defaultdict(dict)
        for i, r in enumerate(roots):
            texts = []
            for k in keys_for(r):
                texts += [trim(t, r) for t in entries.get(k, []) if len(t) > 3]
            if texts:
                found += 1
                chunks[i // 40][i] = "\n\n".join(texts)
        for c, d in chunks.items():
            js_file(os.path.join(OUT, "lex", lid, f"{c}.js"), "QL", lid, c, d)
        size = sum(len(t.encode()) for d in chunks.values() for t in d.values())
        index["lex"].append({"id": lid, "title": title, "author": author, "has": sorted(i for d in chunks.values() for i in d)})
        print(f"{lid:12} roots {found}/{len(roots)}  {size/1e6:5.1f} MB")


# ---------- أسباب النزول (الواحدي) ----------
SURAH_ALIAS = {"براءة": "التوبة", "بني إسرائيل": "الإسراء", "المؤمن": "غافر", "حم السجدة": "فصلت", "الملائكة": "فاطر",
               "المجادلة": "المجادلة", "تبارك": "الملك", "الدهر": "الإنسان", "هل أتى": "الإنسان", "سبح": "الأعلى",
               "أرأيت": "الماعون", "المعوذتين": "الفلق", "إذا زلزلت": "الزلزلة", "تبت": "المسد"}


def plain_key(t):
    """Letters only, one form per letter, for matching the book's quotations against the ayah text."""
    t = MARKS.sub("", t)
    t = re.sub("[أإآٱءؤئ]", "ا", t).replace("ى", "ي").replace("ة", "ه")
    return re.sub("[^%s]" % AR, "", t)


def build_asbab(index):
    quran = json.load(open(os.path.join(ROOT, "data", "quran-uthmani-quranenc.json"), encoding="utf8"))
    names = [plain_key(re.sub(r"^ال", "", v["name"])) for v in quran]
    counts = [len(v["verses"]) for v in quran]
    simple = json.load(open(os.path.join(ROOT, "data", "quran-simple-search.json"), encoding="utf8"))
    ayat = [[] for _ in range(114)]
    for v in simple["quran"]:
        ayat[v["chapter"] - 1].append(plain_key(v["text"]))

    def find(s, quote):
        """Ayah of surah s that holds the quoted words (the book often gives no number)."""
        q = plain_key(quote)
        if len(q) < 6: return None
        for i, t in enumerate(ayat[s - 1]):
            if q in t: return i + 1
        for i, t in enumerate(ayat[s - 1]):  # quotation that runs across two ayat
            if i + 1 < len(ayat[s - 1]) and q in t + ayat[s - 1][i + 1]: return i + 1
        words = quote.split()
        if len(words) > 5:  # spelling differs somewhere later in the quotation: match its opening words
            return find(s, " ".join(words[:4]))
        return None
    text = body_start(open(os.path.join(SRC, "asbab"), encoding="utf8").read())
    per = collections.defaultdict(list)  # surah -> [from, to, lines]
    sura, cur, skipped = 0, None, 0
    intro = collections.defaultdict(list)  # text before a surah's first entry
    entry = re.compile(r"^#\s*(?:\(\d+\)\s*-\s*)?و?قوله.*?\{[^{}]+\}.*?\{\s*([\d،,\s\-–]+)\s*\}")
    for line in text.split("\n"):
        m = re.match(r"### \| سورة (.+?)\s*$", line)
        if m:
            name = SURAH_ALIAS.get(m.group(1).strip(), m.group(1).strip())
            k = plain_key(re.sub(r"^ال", "", name))
            hit = [i for i, n in enumerate(names) if n == k]
            if hit and hit[0] + 1 > sura:
                sura, cur = hit[0] + 1, None
            continue
        if line.startswith("### "):
            cur = None
            continue
        if not sura:
            continue
        m = entry.match(line)
        nums = [int(x) for x in re.findall(r"\d+", m.group(1))] if m else []
        if not nums and re.match(r"^#\s*(?:\(\d+\)\s*-\s*)?و?قوله", line):
            q = re.search(r"\{([^{}]+)(\}|$)", line)  # a quotation may run on to the next line
            a = find(sura, q.group(1)) if q else None
            nums = [a] if a else []
            if q and not a:
                skipped += 1
                print("  not found:", sura, q.group(1)[:60])
        if nums and 1 <= min(nums) and max(nums) <= counts[sura - 1]:
            cur = [min(nums), max(nums), [line]]
            per[sura].append(cur)
            continue
        if cur is not None:
            cur[2].append(line)
        elif not per[sura]:
            intro[sura].append(line)
    # Short surahs have no "قوله تعالى" entries: the whole section is the reason the surah came down.
    for s, ls in intro.items():
        if not per[s] and clean(ls).strip():
            per[s].append([1, counts[s - 1], ls])
    files, n = {}, 0
    for s, rows in per.items():
        if not rows: continue
        out = [[f, t, re.sub(r"^\(\d+\)\s*-\s*", "", clean(ls))] for f, t, ls in rows]
        js_file(os.path.join(OUT, "asbab", f"{s}-0.js"), "QB", "asbab", s, 0, out)
        files[s] = [1]
        n += len(out)
    index["books"].append({"id": "asbab", "kind": "asbab", "title": "أسباب النزول", "author": "أبو الحسن الواحدي (ت ٤٦٨هـ)", "files": files})
    print(f"asbab    {n} entries in {len(per)} surahs, {skipped} quotations not found")


# ---------- القراءات العشر (ابن الجزري، تحبير التيسير) ----------
# The farsh (word-by-word differences) runs surah by surah in mushaf order; each paragraph quotes the words it is about
# in (...) or {...}. A paragraph goes to every ayah of its surah whose words it quotes. The book spells the quotes the
# ordinary way and often in another reader's form, so matching is on the plain search text with every alif dropped.
QIRAAT_ALIAS = {"أم القرآن": "الفاتحة", "براءة": "التوبة", "المؤمن": "غافر", "التطفيف": "المطففين", "سبح": "الأعلى",
                "ن والقلم": "القلم", "والذاريات": "الذاريات", "والطور": "الطور", "المنافقين": "المنافقون",
                "والعاديات": "العاديات", "والشمس": "الشمس", "والليل والضحى": "الليل", "الكافرون": "الكافرون",
                "سور النمل": "النمل", "محمد -": "محمد"}
PREFIX = {"", "و", "ف", "ب", "ل", "ك", "س", "وب", "ول", "فب", "فل", "وس", "فس", "لل", "ولل", "فلل", "ال", "وال", "فال", "بال", "كال"}


def qkey(t):
    return plain_key(t).replace("ا", "")


def book_lines(path):
    text = open(path, encoding="utf8").read()
    text = text[text.index("#META#Header#End#") + len("#META#Header#End#"):] if "#META#Header#End#" in text else text
    return [l for l in text.split("\n") if not l.startswith("# Page") and l.strip()]


def paragraphs(lines):
    """mARkdown paragraphs ('# ' starts one, '~~' continues it), cleaned of page and manuscript markers."""
    out = []
    for l in lines:
        if l.startswith("~~") and out:
            out[-1] += " " + l[2:].strip()
        elif l.startswith("# "):
            out.append(l[2:].strip())
    return [re.sub(r"\s+", " ", re.sub(r"\bms\d+\b|(?<=\s)/(?=\s)", " ", p)).strip() for p in out]


def build_qiraat(index):
    quran = json.load(open(os.path.join(ROOT, "data", "quran-uthmani-quranenc.json"), encoding="utf8"))
    names = [plain_key(re.sub(r"^ال", "", v["name"])) for v in quran]
    simple = json.load(open(os.path.join(ROOT, "data", "quran-simple-search.json"), encoding="utf8"))
    words = [[] for _ in range(114)]
    for v in simple["quran"]:
        words[v["chapter"] - 1].append([qkey(w) for w in v["text"].split()])

    pre = {qkey(x) for x in PREFIX}

    def tok_match(w, q):
        # The book may quote with a "و" the ayah doesn't have ("ومالك يوم الدين"), or without the ayah's prefix.
        return w == q or (w.endswith(q) and w[:len(w) - len(q)] in pre) or (q[:1] in "وف" and len(q) > 2 and tok_match(w, q[1:]))

    def find(s, quote, start):
        qs = [qkey(w) for w in quote.split() if qkey(w)]
        if not qs or (len(qs) == 1 and len(qs[0]) < 2): return None
        ay = words[s - 1]
        for i in list(range(start, len(ay))) + list(range(0, start)):
            t = ay[i]
            for j in range(len(t) - len(qs) + 1):
                if all(tok_match(t[j + k], qs[k]) for k in range(len(qs))): return i + 1
        return None

    lines = book_lines(os.path.join(SRC, "qiraat-tahbir"))
    # Sections: "### | (سورة ...)" headings; the farsh of al-Fatiha sits among the usul.
    sections, cur = [], None
    for l in lines:
        if l.startswith("### "):
            h = l[4:].strip(" |")
            m = re.match(r"^[(\[]?\s*(?:باب ذكر فرش الحروف،\s*)?سورة\s+(?:ms\d+\s*)?\[?([^)\]\[]+?)\]?\s*(?:\[.*)?[)\]]?\s*$", h)
            sura = 0
            if m:
                n = re.sub(r"\s*(عليه السلام|عليها السلام|عليهم السلام|جل وعلا)\s*$", "", m.group(1).strip().replace("/ ", ""))
                n = QIRAAT_ALIAS.get(n, n)
                k = plain_key(re.sub(r"^ال", "", n))
                hit = [i for i, x in enumerate(names) if x == k]
                sura = hit[0] + 1 if hit else -1
                if sura < 0: print("  unknown surah heading:", h)
            cur = [sura, h, []]
            sections.append(cur)
        elif cur is not None:
            cur[2].append(l)
    per = collections.defaultdict(lambda: collections.defaultdict(list))
    matched = unmatched = 0
    usul = []
    for sura, head, ls in sections:
        if sura <= 0:
            continue
        pos = 0
        for p in paragraphs(ls):
            hits = []
            for mq in re.finditer(r"[({]([^(){}]+)[)}]", p):
                # "(جعل لكم) جميع ما في سورة النحل": the words are quoted for another surah, not this one.
                after = re.match(r"\s*(?:[^\s.،:]+\s+){0,4}?في\s+(?:سورة\s+)?(?:\[)?([^\s\].،]+(?:\s+[^\s\].،]+)?)", p[mq.end():])
                if after:
                    other = [i + 1 for i, x in enumerate(names) if x and (x == plain_key(re.sub(r"^ال", "", after.group(1))) or
                             x == plain_key(re.sub(r"^ال", "", after.group(1).split()[0])))]
                    if other and sura not in other: continue
                q = mq.group(1)
                a = find(sura, q, pos)
                if a and a not in hits:
                    hits.append(a)
            if hits:
                matched += 1
                pos = hits[0] - 1
            else:
                unmatched += 1
                hits = [pos + 1]  # continues the paragraph before it
            # Quotes in (...) are shown like the {...} ones, in the mushaf style.
            txt = re.sub(r"\(([^()\d]+)\)", r"{\1}", p)
            for a in hits:
                per[sura][a].append(txt)
    # Reference part: the readers and their narrators, then the usul chapters (not the long isnad chains).
    keep, skip = False, False
    for l in lines:
        if l.startswith("### "):
            h = l[4:].strip(" |").strip()
            if "أسماء القراء" in h or "الاستعاذة" in h: keep = True
            if "الإسناد" in h or "رجال هؤلاء" in h: skip = True
            elif "أسماء القراء" in h or h.startswith("(باب") or h.startswith("( [قلت] باب") or h.startswith("(سورة أم"): skip = False
            if "فرش الحروف" in h: break
            if keep and not skip and h.startswith(":") and usul:  # a line of text marked as a heading
                usul[-1][1].append("# " + h[1:].strip())
            elif keep and not skip and h and h != "فصل" and len(h) > 3:
                h = re.sub(r"\bms\d+\b|/|\)\s*\(", " ", h)
                usul.append([re.sub(r"\s+", " ", re.sub(r"^[(\[]\s*|\s*[)\]]$", "", h)).strip(), []])
            continue
        if keep and not skip and usul and (l.startswith("# ") or l.startswith("~~")):
            usul[-1][1].append(l)
    usul = [[h, "\n".join(paragraphs(ls))] for h, ls in usul if paragraphs(ls)]
    files = {}
    for s, rows in per.items():
        out = [[a, a, "\n".join(ts)] for a, ts in sorted(rows.items())]
        js_file(os.path.join(OUT, "qiraat", f"{s}-0.js"), "QB", "qiraat", s, 0, out)
        files[s] = [1]
    js_file(os.path.join(OUT, "qiraat-usul.js"), "QU", usul)
    index["books"].append({"id": "qiraat", "kind": "qiraat", "title": "تحبير التيسير في القراءات العشر",
                           "author": "ابن الجزري (ت ٨٣٣هـ)", "files": files})
    print(f"qiraat   {matched} paragraphs placed by their quotes, {unmatched} follow the one before; {len(per)} surahs; usul chapters {len(usul)}")


if __name__ == "__main__":
    shutil.rmtree(OUT, ignore_errors=True)
    index = {"books": [], "lex": []}
    build_lex(index)
    build_books(index)
    build_asbab(index)
    build_qiraat(index)
    with open(os.path.join(OUT, "index.js"), "w", encoding="utf8") as f:
        f.write("window.BOOKS=" + json.dumps(index, ensure_ascii=False, separators=(",", ":")) + ";\n")
