# 5.15 Sprint A: S2 (focus on my mistakes), S1 (spaced review + daily review ward), S7 (today card on home).
import io, sys
P = r"D:\Quran App\quran-karim\web\app.js"
s = io.open(P, encoding="utf8").read()
def rep(old, new, n=1):
    global s
    c = s.count(old); assert c == n, (c, old[:90]); s = s.replace(old, new)

# ---------- S1: one due rule (spaced review) ----------
rep('''  function hifzDue() {
    var L = hifzLogData(), best = null;
    Object.keys(L).forEach(function (s) { var r = parseDay(L[s].r || L[s].m); if (!best || r < best.r) best = { s: +s, r: r }; });
    return best;
  }''', '''  // 5.15 S1: spaced review. Each memorised surah keeps its own interval q.hifzLog[s].iv (days): 7 at first; after a test
  // >= 90% doubles it (at most 90), 70-89% keeps it, < 70% sets 1 day. The surah is due when its last review is iv days old.
  // Old entries with no iv: 7, or 1 if the last score was under 70 (the old «< 70%» rule).
  function hzDueInfo(e, sc) {
    var age = dayNum(new Date()) - parseDay(e.r || e.m), iv = e.iv || (sc != null && sc < 70 ? 1 : 7);
    return { age: age, iv: iv, due: age >= iv, over: age - iv };
  }
  function hzScoreOf(sc, s) { return sc[s] && sc[s].score != null ? sc[s].score : null; }
  // a test of the surah ended with score p: next interval, review date today (a second test the same day does not double it)
  function hzReviewed(e, p) {
    var iv = e.iv || 7;
    if (p < 70) iv = 1; else if (p >= 90 && e.r !== todayStr()) iv = Math.min(90, iv * 2);
    e.iv = iv; e.r = todayStr(); e.score = p;
  }
  window.hzDueInfo = hzDueInfo; window.hzReviewed = hzReviewed;   // QA
  // the due surahs, most overdue first; d = days from today (for the alarms of the coming days)
  function hzDueList(d) {
    var L = hifzLogData(), sc = load("hifzScores", {}), out = [];
    Object.keys(L).forEach(function (s) { var x = hzDueInfo(L[s], hzScoreOf(sc, s)); x.age += d || 0; x.over += d || 0; if (x.over >= 0) out.push({ s: +s, age: x.age, over: x.over, iv: x.iv, sc: hzScoreOf(sc, s) }); });
    return out.sort(function (a, b) { return b.over - a.over || a.s - b.s; });
  }
  function surahPages(s) { var p = Q.p[s - 1]; return p[p.length - 1] - p[0] + 1; }
  // 5.15 S1: the daily review ward q.hzDaily = pages a day (0 = all that is due): the most overdue surahs until the pages are reached
  function hzWard(d) {
    var all = hzDueList(d), n = +load("hzDaily", 0) || 0, out = [], pg = 0;
    for (var i = 0; i < all.length && (!n || pg < n); i++) { out.push(all[i]); pg += surahPages(all[i].s); }
    return { list: out, pages: pg, all: all.length, per: n };
  }
  window.hzWard = hzWard;   // QA
  function hifzDue(d) { var w = hzWard(d); return w.list.length ? { s: w.list[0].s, n: w.list.length } : null; }''')

rep('''if (D[x]) { D[x].r = todayStr(); D[x].score = score; } }); save("hifzLog", D); syncAlarms();''',
    '''if (D[x]) hzReviewed(D[x], score); }); save("hifzLog", D); syncAlarms();''')
rep('''      if (D[s]) { D[s].r = todayStr(); D[s].score = score; save("hifzLog", D); syncAlarms(); }''',
    '''      if (D[s]) { hzReviewed(D[s], score); save("hifzLog", D); syncAlarms(); }''')
rep('''      if (D[s]) { D[s] = { m: todayStr(), r: todayStr() }; ch = true; }''' if False else '''      if (r.p >= 80 && !D[s]) { D[s] = { m: todayStr(), r: todayStr() }; ch = true; }''',
    '''      if (r.p >= 80 && !D[s]) { D[s] = { m: todayStr(), r: todayStr(), iv: 7 }; ch = true; }''')
rep('''var hd = hifzDue(); if (hd) ev.push({ at: at(rc.hifz.t), kind: "rem", title: "مراجعة الحفظ", text: "راجع اليوم سورة " + Q.s[hd.s - 1][0] + ".", hash: "#/hifzlog" }); }''',
    '''var hd = hifzDue(d); if (hd) ev.push({ at: at(rc.hifz.t), kind: "rem", title: "مراجعة الحفظ", text: "راجع اليوم سورة " + Q.s[hd.s - 1][0] + (hd.n > 1 ? " و" + ar(hd.n - 1) + " سور تانية" : "") + ".", hash: "#/hifzlog" }); }''')
# map colours: the surah rule (the per-ayah rule of ayat tested one by one stays 14 days / any wrong)
rep('''      ss.forEach(function (s) { var e = L[s]; if (e) { on++; age = Math.max(age, today - parseDay(e.r || e.m)); if (sc[s] && sc[s].score < 70) weak = true; } });
      var c = !on ? 0 : on < ss.length ? 1 : age > 14 || weak ? 2 : 3, pa = PA[n];''',
    '''      ss.forEach(function (s) { var e = L[s]; if (e) { on++; if (hzDueInfo(e, hzScoreOf(sc, s)).due) weak = true; } });
      var c = !on ? 0 : on < ss.length ? 1 : weak ? 2 : 3, pa = PA[n];''')
rep('''      var e = L[s], c = !e ? 0 : today - parseDay(e.r || e.m) > 14 || (sc[s] && sc[s].score < 70) ? 2 : 3, got = 0, tot = 0, age = 0, bad = false;''',
    '''      var e = L[s], c = !e ? 0 : hzDueInfo(e, hzScoreOf(sc, s)).due ? 2 : 3, got = 0, tot = 0, age = 0, bad = false;''')

# ---------- S2: weighted random places + «أخطائي بس» ----------
rep('''  function hzParts(c) {
    var R = hzRange(c), len = R[1] - R[0] + 1;
    if (c.w !== "r") return [[R[0], R[1]]];
    if (len <= 3) return [[R[0], R[1]]];
    var mx = Math.max(1, Math.min(10, Math.ceil(len / 30))), mn = Math.ceil(mx / 2), want = mn + Math.floor(Math.random() * (mx - mn + 1)), P = [];
    for (var t = 0; t < 300 && P.length < want; t++) {
      var n = Math.min(len, 3 + Math.floor(Math.random() * 10)), st = R[0] + Math.floor(Math.random() * (len - n + 1)), en = st + n - 1;
      if (P.every(function (x) { return en < x[0] - 1 || st > x[1] + 1; })) P.push([st, en]);
    }
    return P.sort(function (x, y) { return x[0] - y[0]; });
  }''', '''  // 5.15 S2: the ayat of the range last heard wrong (q.hifzAyat ok = 0), by their place in the Quran
  function hzWrong(R) {
    var HA = load("hifzAyat", {}), W = [];
    Object.keys(HA).forEach(function (k) { if (HA[k] && HA[k].ok === 0) { var p = k.split(":"), i = gIdx(+p[0], +p[1]); if (i >= R[0] && i <= R[1]) W.push(i); } });
    return W.sort(function (a, b) { return a - b; });
  }
  window.hzWrong = hzWrong;   // QA
  function hzParts(c) {
    var R = hzRange(c), len = R[1] - R[0] + 1;
    if (c.w === "x") {
      // «أخطائي بس»: a place around each group of wrong ayat (wrong ayat 3 or fewer apart join one place), one ayah
      // before and after, at least 3 ayat; at most 10 places (picked at random when there are more)
      var W = hzWrong(R), G = [];
      W.forEach(function (i) { var g = G[G.length - 1]; if (g && i - g[1] <= 3) g[1] = i; else G.push([i, i]); });
      G = G.map(function (g) { var st = Math.max(R[0], g[0] - 1), en = Math.min(R[1], g[1] + 1);
        while (en - st < 2 && (st > R[0] || en < R[1])) { if (en < R[1]) en++; else st--; } return [st, en]; });
      while (G.length > 10) G.splice(Math.floor(Math.random() * G.length), 1);
      return G;
    }
    if (c.w !== "r") return [[R[0], R[1]]];
    if (len <= 3) return [[R[0], R[1]]];
    // at random, a place lands on a wrong ayah 2 times in 3 (while there are wrong ayat not yet in a place)
    var mx = Math.max(1, Math.min(10, Math.ceil(len / 30))), mn = Math.ceil(mx / 2), want = mn + Math.floor(Math.random() * (mx - mn + 1)), P = [], W2 = hzWrong(R);
    for (var t = 0; t < 300 && P.length < want; t++) {
      var n = Math.min(len, 3 + Math.floor(Math.random() * 10)), st, en, free = W2.filter(function (i) { return P.every(function (x) { return i < x[0] || i > x[1]; }); });
      if (free.length && Math.random() < 2 / 3) { var wi = free[Math.floor(Math.random() * free.length)]; st = Math.max(R[0], Math.min(R[1] - n + 1, wi - Math.floor(Math.random() * n))); }
      else st = R[0] + Math.floor(Math.random() * (len - n + 1));
      en = st + n - 1;
      if (P.every(function (x) { return en < x[0] - 1 || st > x[1] + 1; })) P.push([st, en]);
    }
    return P.sort(function (x, y) { return x[0] - y[0]; });
  }''')
rep('''    var P = P0 || hzParts(c), b = gAy(P[0][0]), e = gAy(P[0][1]), pc = P.slice(1), tot = P.length;''',
    '''    var P = P0 || hzParts(c);
    if (!P.length) return toast("مفيش آيات غلط في المدى ده. جرّب «عشوائي» أو مدى تاني.");
    var b = gAy(P[0][0]), e = gAy(P[0][1]), pc = P.slice(1), tot = P.length;''')
rep('''n: c.w === "r" ? P[0][1] - P[0][0] + 1 : 10,''', '''n: c.w === "r" || c.w === "x" || P0 ? P[0][1] - P[0][0] + 1 : 10,''')

# the card: third way + daily ward + spaced due list
rep(''''<div class="z-sort hz-way"><button data-w="o"' + (c.w !== "r" ? ' class="on"' : "") + '>بالسرد</button><button data-w="r"' + (c.w === "r" ? ' class="on"' : "") + ">عشوائي (٣–١٢ آية)</button></div>" +''',
    ''''<div class="z-sort hz-way"><button data-w="o"' + (c.w !== "r" && c.w !== "x" ? ' class="on"' : "") + '>بالسرد</button><button data-w="r"' + (c.w === "r" ? ' class="on"' : "") + ">عشوائي (٣–١٢ آية)</button>" +
      '<button data-w="x"' + (c.w === "x" ? ' class="on"' : "") + ">أخطائي بس (" + ar(nW) + ")</button></div>" +
      (c.w === "x" ? '<p class="hint">' + (nW ? "الاختبار بيبقى على الآيات اللي غلطت فيها قبل كده، مع آية قبلها وآية بعدها." : "مفيش آيات غلط في المدى ده لسه.") + "</p>" : "") +''')
rep('''    var R = hzRange(c);
    var html = hzNav("#/hifzlog")''', '''    var R = hzRange(c), nW = hzWrong(R).length;
    var html = hzNav("#/hifzlog")''')
rep('''    // «عليك مراجعة»: memorised surahs whose review is due (the map's yellow rule), oldest first
    var due = Object.keys(L).map(function (s) { var e = L[s]; return { s: +s, age: today - parseDay(e.r || e.m), sc: sc[s] && sc[s].score }; })
      .filter(function (x) { return x.age > 14 || (x.sc != null && x.sc < 70); }).sort(function (x, y) { return y.age - x.age; });
    html += '<section class="hz-due"><h3 class="hz-h">' + ic("rep") + "عليك مراجعة</h3>" + (due.length ? due.map(function (x) {
      return '<div class="hl-due"><div><b>سورة ' + Q.s[x.s - 1][0] + "</b><small>آخر مراجعة من " + ar(x.age) + " يوم" + (x.sc != null && x.sc < 70 ? " · آخر نتيجة " + ar(x.sc) + "٪" : "") +
        '</small></div><button data-test="' + x.s + '">اختبرني</button></div>';
    }).join("") : '<p class="hint">مفيش مراجعة متأخرة. السورة بتظهر هنا لما يعدّي على آخر مراجعة ليها أكتر من ١٤ يوم، أو لو آخر نتيجة ليها أقل من ٧٠٪.</p>') + "</section>";''',
    '''    // «عليك مراجعة» (5.15 S1): the daily ward of due surahs (spaced review, the map's yellow rule), most overdue first
    var W = hzWard(), due = W.list, per = W.per;
    html += '<section class="hz-due" id="hzDue"><h3 class="hz-h">' + ic("rep") + "عليك مراجعة</h3>" +
      '<div class="hz-row hz-daily"><span>ورد المراجعة اليومي</span>' + sel("hzDaily", "ورد المراجعة اليومي", [[0, "كل المستحق"], [1, "صفحة"], [2, "صفحتين"], [3, "٣ صفحات"], [5, "٥ صفحات"], [10, "١٠ صفحات"], [20, "٢٠ صفحة"]], per) + "</div>" +
      (due.length ? '<p class="hint hz-wsum">ورد النهارده: ' + ar(due.length) + " سورة · " + ar(W.pages) + " صفحة" + (W.all > due.length ? " · وفيه " + ar(W.all - due.length) + " سورة تانية مستنية" : "") + "</p>" +
        '<button class="continue hz-wgo" id="hzWardGo">' + ic("book") + " اختبرني في ورد النهارده</button>" + due.map(function (x) {
      return '<div class="hl-due"><div><b>سورة ' + Q.s[x.s - 1][0] + "</b><small>آخر مراجعة من " + ar(x.age) + " يوم · كل " + ar(x.iv) + " يوم" + (x.sc != null && x.sc < 70 ? " · آخر نتيجة " + ar(x.sc) + "٪" : "") +
        '</small></div><button data-test="' + x.s + '">اختبرني</button></div>';
    }).join("") : '<p class="hint">مفيش مراجعة مستحقة النهارده. كل سورة ليها ميعاد: أول مرة بعد ٧ أيام. ولو جبت ٩٠٪ أو أكتر، المدة بتتضاعف لحد ٩٠ يوم. ولو جبت أقل من ٧٠٪، بترجعلك تاني يوم.</p>') + "</section>";''')
rep('''    document.getElementById("hzGoW").onclick = function () { hzTestStart(c, "w"); };''',
    '''    document.getElementById("hzGoW").onclick = function () { hzTestStart(c, "w"); };
    document.getElementById("hzDaily").onchange = function () { save("hzDaily", +this.value); var y = window.scrollY; showHifzLog(); window.scrollTo(0, y); };
    var wg = document.getElementById("hzWardGo"); if (wg) wg.onclick = function () { hzWardTest(); };''')
rep('''  function hzPlace(i, n) {''', '''  // the daily review ward as one mushaf test: each due surah a place, in Quran order (5.15 S1 / S7)
  function hzWardTest() {
    var w = hzWard().list.map(function (x) { return x.s; }).sort(function (a, b) { return a - b; });
    if (!w.length) return toast("مفيش مراجعة مستحقة النهارده");
    hzTestStart({ k: "s", s: w[0], w: "o" }, "m", w.map(function (s) { return [gIdx(s, 1), gIdx(s, Q.s[s - 1][3])]; }));
  }
  window.hzWardTest = hzWardTest;   // QA
  function hzPlace(i, n) {''')

# ---------- S7: today card on home ----------
rep('''    html += khatmaCard();
    // 5.13 P2.2''', '''    html += khatmaCard() + todayCard();
    // 5.13 P2.2''')
rep('''    document.getElementById("kCard").onclick = function () { location.hash = "#/khatma"; };''',
    '''    document.getElementById("kCard").onclick = function () { location.hash = "#/khatma"; };
    var tdG = document.getElementById("tdGo"); if (tdG) tdG.onclick = function (ev) { ev.stopPropagation(); hzWardTest(); };
    var tdC = document.getElementById("tdCard"); if (tdC) tdC.onclick = function () { location.hash = "#/hifzlog"; };''')
rep('''  function khatmaCard() {''', '''  // 5.15 S7: «النهارده» on home: the khatma ward and the review ward in one place, the test one tap away.
  // Shown once there is a memorised surah (the khatma card above stays for readers who do not memorise).
  function todayCard() {
    if (!Object.keys(hifzLogData()).length) return "";
    var P = plan(), W = hzWard(), kh = !P || P.finished ? "" : P.left ? "ورد الختمة: " + ar(P.left) + " صفحة" : "ورد الختمة خلص ✓";
    var rv = W.list.length ? "مراجعة: " + ar(W.list.length) + " سورة (" + ar(W.pages) + " صفحة)" : "مفيش مراجعة مستحقة ✓";
    return '<div class="kcard td-card" id="tdCard" role="button" tabindex="0"><span class="tile-ic kh">' + ic("rep") + '</span><span class="kc-txt"><b>النهارده</b><small>' +
      (kh ? kh + " · " : "") + rv + "</small></span>" + (W.list.length ? '<button class="td-go" id="tdGo">اختبرني</button>' : ic("left")) + "</div>";
  }
  function khatmaCard() {''')

io.open(P, "w", encoding="utf8", newline="").write(s)
print("app.js patched")

# CSS
C = r"D:\Quran App\quran-karim\web\style.css"
c = io.open(C, encoding="utf8").read()
assert ".td-card" not in c
c += "\n/* 5.15 S1/S7: daily review ward, today card */\n.hz-daily{align-items:center;gap:8px}.hz-daily span{font-size:14px}.hz-wgo{width:100%;margin:4px 0 10px}\n" \
     ".td-card{cursor:pointer}.td-go{border:0;border-radius:10px;padding:8px 14px;background:var(--accent);color:#fff;font:inherit;flex:none}\n"
io.open(C, "w", encoding="utf8", newline="").write(c)

# i18n (English UI)
I = r"D:\Quran App\quran-karim\web\i18n.js"
t = io.open(I, encoding="utf8").read()
anchor = '"عليك مراجعة": "Due for review",'
assert t.count(anchor) == 1
t = t.replace(anchor, anchor + ''' "ورد المراجعة اليومي": "Daily review ward", "كل المستحق": "All that is due", "آخر مراجعة من # يوم · كل # يوم": "Last review # days ago · every # days", "آخر مراجعة من # يوم · كل # يوم · آخر نتيجة #٪": "Last review # days ago · every # days · last score #%", "صفحتين": "2 pages", "# صفحات": "# pages",
    "ورد النهارده: # سورة · # صفحة": "Today's ward: # surahs · # pages", " · وفيه # سورة تانية مستنية": " · # more surahs waiting",
    "اختبرني في ورد النهارده": "Test me on today's ward", "أخطائي بس (#)": "My mistakes only (#)",
    "الاختبار بيبقى على الآيات اللي غلطت فيها قبل كده، مع آية قبلها وآية بعدها.": "The test covers the ayat you got wrong before, with one ayah before and after each.",
    "مفيش آيات غلط في المدى ده لسه.": "No wrong ayat in this range yet.", "مفيش آيات غلط في المدى ده. جرّب «عشوائي» أو مدى تاني.": "No wrong ayat in this range. Try «Random» or another range.",
    "مفيش مراجعة مستحقة النهارده": "Nothing due today", "مفيش مراجعة مستحقة ✓": "Nothing due ✓", "النهارده": "Today",
    "ورد الختمة: # صفحة": "Khatma ward: # pages", "ورد الختمة خلص ✓": "Khatma ward done ✓", "مراجعة: # سورة (# صفحة)": "Review: # surahs (# pages)",
    "مفيش مراجعة مستحقة النهارده. كل سورة ليها ميعاد: أول مرة بعد # أيام. ولو جبت #٪ أو أكتر، المدة بتتضاعف لحد # يوم. ولو جبت أقل من #٪، بترجعلك تاني يوم.": "Nothing due today. Each surah has its own date: first after # days. Score #% or more and the gap doubles, up to # days; under #% and it comes back the next day.",''', 1)
io.open(I, "w", encoding="utf8", newline="").write(t)
print("css + i18n patched")
