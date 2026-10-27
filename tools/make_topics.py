"""Builds web/topics.js: a topic index of the Quran ("فهرس المواضيع").

Each topic lists the ayat that mention it, found in the app's own data, not typed by hand:
  - roots: word roots (books/index.js "roots", from the Quranic Arabic Corpus morphology used by the
    ayah screen), optionally narrowed by `w`, a regex on the plain (unvowelled, unified) word;
  - phrase: a regex on the plain ayah text, for ideas carried by a phrase (بر الوالدين، اليوم الآخر).
Run: python3 tools/make_topics.py
"""
import json, re, os, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "..", "web")

def plain(t):
    t = unicodedata.normalize("NFKD", t)
    t = re.sub(r"[ؐ-ًؚ-ٰۖ-ۭ࣓-ࣿـ‌-‏۝۞۩]", "", t)
    t = re.sub("[ٱأإآ]", "ا", t).replace("ى", "ي").replace("ی", "ي").replace("ة", "ه").replace("ک", "ك")
    t = re.sub(r"[^ء-ي\s]", "", t)
    return re.sub(r"\s+", " ", t).strip()

# The mushaf text is in Uthmani spelling (ٱلصَّلَوٰة، ٱلْمَلَـٰٓئِكَة، ٱلْقُرْءَان), so words and patterns are both
# compared without alef and hamza: "الصلاة" and "الصلوة" then differ only by و, "الملائكة" = "الملئكة".
def skel(t):
    return re.sub("[اء]", "", t)

# Patterns go through the same steps as the text (NFKD turns ئ into ي and أ into ا), keeping regex signs.
def pat(p):
    p = unicodedata.normalize("NFKD", p)
    p = re.sub(r"[\u0610-\u061A\u064B-\u0670]", "", p)
    p = re.sub("[ٱأإآ]", "ا", p).replace("ى", "ي").replace("ة", "ه")
    return skel(p)

def js_obj(path, fn):
    s = open(path, encoding="utf-8").read()
    s = s[s.index(fn) + len(fn):]
    return s

idx = open(os.path.join(WEB, "books", "index.js"), encoding="utf-8").read()
ROOTS = json.loads(idx[idx.index("=") + 1:].rstrip().rstrip(";"))["roots"]
RID = {r: i for i, r in enumerate(ROOTS)}

# words per ayah: {(s, a): [(plainword, rootid)]}
WORDS = {}
for s in range(1, 115):
    t = open(os.path.join(WEB, "books", "words", "%d.js" % s), encoding="utf-8").read()
    data = json.loads(t[t.index(",") + 1:t.rindex(")")])
    for a, ws in data.items():
        WORDS[(s, int(a))] = [(skel(plain(w)), r, plain(w)) for w, r in ws]
TEXT = {k: " ".join(w[0] for w in v) for k, v in WORDS.items()}

T = [
  ("الإيمان", [
    ("التوحيد", {"phrase": r"لا اله الا|اله واحد|الله احد|لا شريك له"}),
    ("الملائكة", {"phrase": r"ملائك|الملكين|جبريل|ميكال"}),
    ("الرسل والأنبياء", {"roots": ["رسل", "نبأ"], "w": r"رسل|رسول|المرسلين|نبي|انبياء|النبيين"}),
    ("القرآن", {"roots": ["قرأ"], "w": r"قران"}),
    ("اليوم الآخر والقيامة", {"phrase": r"اليوم الاخر|يوم القيامه|الساعه|يوم الدين|يوم البعث|يوم الحساب"}),
    ("الجنة", {"roots": ["جنن"], "w": r"جن(ه|ات|ت|تين|تان|تي|تك|تكم)$"}),
    ("النار وجهنم", {"roots": ["نور"], "w": r"نار", "phrase": r"جهنم"}),
    ("القدر والمشيئة", {"phrase": r"بقدر|قدرا مقدورا|ان يشاء الله|الا ان يشاء|ما شاء الله"}),
  ]),
  ("العبادات", [
    ("الصلاة", {"roots": ["صلو"], "w": r"صلا|صلو"}),
    ("الزكاة", {"roots": ["زكو"], "w": r"زكا|زكو"}),
    ("الصيام", {"roots": ["صوم"]}),
    ("الحج والعمرة", {"roots": ["حجج", "عمر"], "pw": r"^(و|ف|ب)?(ال)?حج$|العمره|^عمره$|اعتمر"}),
    ("الدعاء", {"phrase": r"ادعوني|دعوه الداع|ادعوا ربكم|دعا ربه|ربنا اتنا|ربنا لا|رب اغفر|ربنا اغفر|رب اجعلني|رب هب"}),
    ("ذكر الله", {"phrase": r"اذكروا الله|ذكر الله|اذكروني|ذكرا كثيرا|اذكر ربك|اذكر اسم ربك|والذاكرين"}),
    ("الإنفاق والصدقة", {"roots": ["نفق", "صدق"], "w": r"^(و|ف)?(ي|ت|ا)?نفق(و|ون|وا|تم|ه)?$|انفق|ينفقون|صدق(ه|ات)|تصدق|المتصدق|المصدق"}),
    ("الجهاد", {"roots": ["جهد"], "pw": r"^(?!(و|ف)?جهد$)"}),
    ("التوبة", {"roots": ["توب"]}),
    ("الاستغفار", {"roots": ["غفر"], "w": r"استغفر|يستغفر|استغفار|مستغفر"}),
  ]),
  ("الأخلاق", [
    ("الصبر", {"roots": ["صبر"]}),
    ("الشكر", {"roots": ["شكر"]}),
    ("التقوى", {"roots": ["وقي"], "w": r"تقو|اتقو|المتقين|يتق|اتق|تقاه|تتقون|يتقون|تقي"}),
    ("التوكل على الله", {"roots": ["وكل"], "w": r"توكل|المتوكل|يتوكل"}),
    ("الصدق", {"roots": ["صدق"], "w": r"صادق|الصدق|صدقا|الصديق"}),
    ("العدل", {"roots": ["عدل", "قسط"], "w": r"عدل|اعدلوا|بالعدل|القسط|بالقسط|المقسطين|اقسط"}),
    ("الوفاء بالعهد", {"roots": ["عهد"], "w": r"بالعهد|بعهد|عهده|عهدهم|عاهد|العهد"}),
    ("العفو والإحسان", {"roots": ["عفو", "حسن"], "w": r"^(و|ف)?(ا|ي|ت)?عف(و|وا)?$|العفو|عفا|المحسن|احسنوا|بالاحسان|الاحسان"}),
    ("الوالدين", {"phrase": r"بالوالدين|لوالديك|بوالديه|بوالدتي|والديه|لوالدي|والديك"}),
    ("الكبر والتكبر", {"roots": ["كبر"], "w": r"استكبر|يستكبر|متكبر|المستكبر|تكبر|المتكبر"}),
    ("الكذب والتكذيب", {"roots": ["كذب", "فري"], "w": r"الكذب|كاذب|كذبا|الكاذبين|افتري|يفترون|افترا"}),
    ("الظلم", {"roots": ["ظلم"]}),
  ]),
  ("الأسرة والمعاملات", [
    ("الزواج", {"roots": ["نكح", "زوج"], "w": r"نكح|انكح|ازواجكم|ازواجهم|زوجك|زوجها"}),
    ("الطلاق", {"roots": ["طلق"], "w": r"طلق|الطلاق|مطلقات"}),
    ("اليتامى", {"roots": ["يتم"]}),
    ("الربا", {"roots": ["ربو"], "pw": r"الربوا|^(و|ف)?ربا$"}),
    ("البيع والتجارة", {"roots": ["تجر", "بيع"], "w": r"تجار|البيع|بيع|تبايعتم"}),
    ("الوفاء بالكيل والميزان", {"roots": ["كيل", "وزن"], "w": r"الكيل|كيل|الميزان|بالقسطاس|اوزنوا|زنوا"}),
  ]),
  ("الكون والآيات", [
    ("السماء", {"roots": ["سمو"], "w": r"سماء|سماوات|السماء|سموات"}),
    ("الشمس والقمر", {"roots": ["شمس", "قمر"]}),
    ("الليل والنهار", {"phrase": r"الليل والنهار|الليل|النهار"}),
    ("المطر والماء", {"roots": ["مطر"], "phrase": r"ماء من السماء|من السماء ماء"}),
    ("البحار", {"roots": ["بحر"]}),
    ("الجبال", {"roots": ["جبل"], "w": r"جبال|الجبال|جبل"}),
    ("خلق الإنسان", {"phrase": r"خلق(نا)? الانسان|من نطفه|من طين|من علق|من تراب|من ماء مهين"}),
  ]),
]

out = []
for g, topics in T:
    gs = []
    for name, rule in topics:
        rids = {RID[r] for r in rule.get("roots", []) if r in RID}
        missing = [r for r in rule.get("roots", []) if r not in RID]
        if missing: print("missing roots", name, missing)
        wre = re.compile(pat(rule["w"])) if "w" in rule else None
        pw = re.compile(rule["pw"]) if "pw" in rule else None   # on the plain word, alef and hamza kept
        pre = re.compile(pat(rule["phrase"])) if "phrase" in rule else None
        hits = []
        for (s, a), ws in WORDS.items():
            ok = bool(rids) and any(r in rids and (not wre or wre.search(w)) and (not pw or pw.search(p)) for w, r, p in ws)
            if not ok and pre and pre.search(TEXT[(s, a)]): ok = True
            if ok: hits.append([s, a])
        hits.sort()
        print("%-24s %4d" % (name, len(hits)))
        gs.append({"n": name, "a": hits})
    out.append({"g": g, "t": gs})

with open(os.path.join(WEB, "topics.js"), "w", encoding="utf-8") as f:
    f.write("// فهرس مواضيع القرآن: tools/make_topics.py builds it from the word roots and the ayah text in the app's own data.\n")
    f.write("window.TOPICS=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("size", os.path.getsize(os.path.join(WEB, "topics.js")))
