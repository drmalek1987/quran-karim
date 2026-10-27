# Data integrity checks for the web assets the app ships (run with python3 -I data.py WEBDIR).
import os, sys, json, re
W = sys.argv[1]
res = []
def ok(name, cond, info=""): res.append((name, bool(cond), info))

# quran-data.js
src = open(os.path.join(W, "quran-data.js"), encoding="utf8").read()
Q = json.loads(src[src.index("=") + 1:].rstrip().rstrip(";"))
ok("114 سورة", len(Q["s"]) == 114, len(Q["s"]))
n_ayat = sum(s[3] for s in Q["s"])
ok("6236 آية", n_ayat == 6236, n_ayat)
ok("نص كل آية موجود", all(len(Q["t"][i]) == Q["s"][i][3] and all(x.strip() for x in Q["t"][i]) for i in range(114)))
ok("نص البحث لكل آية", all(len(Q["q"][i]) == Q["s"][i][3] for i in range(114)))
ok("رقم صفحة لكل آية", all(len(Q["p"][i]) == Q["s"][i][3] for i in range(114)))
flat = [p for s in Q["p"] for p in s]
ok("أرقام الصفحات مرتبة", all(flat[i] <= flat[i + 1] for i in range(len(flat) - 1)), (flat[0], flat[-1]))
ok("مربعات الآيات على الصفحات لكل آية", all(len(Q["r"][i]) == Q["s"][i][3] and all(len(r) for r in Q["r"][i]) for i in range(114)))
bad = [(i + 1, a + 1) for i in range(114) for a in range(Q["s"][i][3]) if Q["p"][i][a] not in {b[0] for b in Q["r"][i][a]}]
ok("صفحة الآية تطابق مربعاتها", not bad, bad[:5])

# page images
pages = sorted(os.listdir(os.path.join(W, "pages")))
ok("كل صفحات المصحف موجودة (AVIF)", len(pages) == Q["count"] and all(p.endswith(".avif") for p in pages), (len(pages), Q["count"]))
ok("مفيش صفحة فاضية", all(os.path.getsize(os.path.join(W, "pages", p)) > 10000 for p in pages))
tj = sorted(os.listdir(os.path.join(W, "tjpages")))
want = ["%03d.webp" % n for n in range(2, Q["last"] + 1)]
ok("طبقة التجويد لكل صفحة من 2 لآخر صفحة قرآن", tj == want, (len(tj), len(want)))

# tajweed data
t = open(os.path.join(W, "tajweed-data.js"), encoding="utf8").read()
T = json.loads(t[t.index("=") + 1:].rstrip().rstrip(";"))
badtj = [(i + 1, a + 1) for i in range(114) for a in range(Q["s"][i][3])
         if any(not (0 <= x[0] < x[1] <= len(Q["t"][i][a])) for x in zip(*[iter(T["q"][i][a])] * 3))]
ok("مواضع ألوان التجويد داخل نص الآية", not badtj and len(T["q"]) == 114, badtj[:5])

# books
b = open(os.path.join(W, "books/index.js"), encoding="utf8").read()
B = json.loads(b[b.index("=") + 1:].rstrip().rstrip(";"))
miss = []
for bk in B["books"]:
    for s, starts in bk["files"].items():
        for k in range(len(starts)):
            f = os.path.join(W, "books", bk["id"], "%s-%d.js" % (s, k))
            if not os.path.exists(f): miss.append(f)
ok("كل ملفات الكتب المذكورة في الفهرس موجودة", not miss, miss[:3])
ok("كل الكتب", sorted(x["id"] for x in B["books"]) , [x["id"] for x in B["books"]])
wm = [s for s in range(1, 115) if not os.path.exists(os.path.join(W, "books/words/%d.js" % s))]
ok("معاني الكلمات لكل سورة", not wm, wm)
lexm = []
for l in B["lex"]:
    for r in l["has"]:
        if not os.path.exists(os.path.join(W, "books/lex", l["id"], "%d.js" % (r // 40))): lexm.append((l["id"], r))
ok("ملفات المعاجم لكل جذر", not lexm, lexm[:3])

# King Fahd edition (tools/kfgqpc)
ek = os.path.join(W, "editions/kfgqpc.js")
if os.path.exists(ek):
    e = open(ek, encoding="utf8").read(); E = json.loads(e[e.index("=") + 1:].rstrip().rstrip(";"))
    ok("طبعة الملك فهد: مكان كل آية (6236)", all(len(E["r"][i]) == Q["s"][i][3] and all(E["r"][i]) for i in range(114)))
    fl = [p for s_ in E["p"] for p in s_]
    ok("طبعة الملك فهد: الصفحات مرتبة من 1 إلى 604", fl[0] == 1 and fl[-1] == 604 and all(fl[i] <= fl[i + 1] for i in range(len(fl) - 1)), (fl[0], fl[-1]))
    kp = sorted(os.listdir(os.path.join(W, "editions/kfgqpc")))
    ok("طبعة الملك فهد: 604 صورة صفحة", kp == ["%03d.avif" % n for n in range(1, 605)], len(kp))
    ok("طبعة الملك فهد: البقرة تبدأ صفحة 2 والناس في 604 وآية الكرسي في 42", E["p"][1][0] == 2 and E["p"][113][0] == 604 and E["p"][1][254] == 42, (E["p"][1][0], E["p"][113][0], E["p"][1][254]))

# Shamarly-layout edition (tools/shamarly)
es = os.path.join(W, "editions/shamarly.js")
if os.path.exists(es):
    e = open(es, encoding="utf8").read(); E = json.loads(e[e.index("=") + 1:].rstrip().rstrip(";"))
    ok("طبعة الشمرلي: مكان كل آية (6236)", all(len(E["r"][i]) == Q["s"][i][3] and all(E["r"][i]) for i in range(114)))
    fl = [p for s_ in E["p"] for p in s_]
    ok("طبعة الشمرلي: الصفحات مرتبة من 2 إلى 522", fl[0] == 2 and fl[-1] == 522 and all(fl[i] <= fl[i + 1] for i in range(len(fl) - 1)), (fl[0], fl[-1]))
    kp = sorted(os.listdir(os.path.join(W, "editions/shamarly")))
    ok("طبعة الشمرلي: 521 صورة صفحة", kp == ["%03d.avif" % n for n in range(2, 523)], len(kp))
    ok("طبعة الشمرلي: البقرة صفحة 3 والكهف 243 والناس 522", E["p"][1][0] == 3 and E["p"][17][0] == 243 and E["p"][113][0] == 522, (E["p"][1][0], E["p"][17][0], E["p"][113][0]))

for name, good, info in res:
    print(("PASS" if good else "FAIL") + "\t" + name + "\t" + (str(info)[:120] if not good or info else ""))
