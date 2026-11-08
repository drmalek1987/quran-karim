import io,sys
p='web/app.js'; s=io.open(p,encoding='utf-8').read()
def rep(a,b,n=1):
    global s
    c=s.count(a)
    if c!=n: sys.exit('count %d for: %s'%(c,a[:80]))
    s=s.replace(a,b)
# U2: ward way (q.hzWardWay o|r): «بالسرد» = each due surah whole, «عشوائي» = random parts inside each due surah
rep('''    var w = hzWard().list.map(function (x) { return x.s; }).sort(function (a, b) { return a - b; });
    if (!w.length) return toast("مفيش مراجعة مستحقة النهارده");
    hzTestStart({ k: "s", s: w[0], w: "o" }, "m", w.map(function (s) { return [gIdx(s, 1), gIdx(s, Q.s[s - 1][3])]; }));''',
'''    var w = hzWard().list.map(function (x) { return x.s; }).sort(function (a, b) { return a - b; });
    if (!w.length) return toast("مفيش مراجعة مستحقة النهارده");
    var way = load("hzWardWay", "o"), P = [];
    // 5.16 U2: «عشوائي» = random parts (3–12 ayat) inside each due surah, in Quran order
    if (way === "r") w.forEach(function (s) { P = P.concat(hzParts({ k: "s", s: s, w: "r" })); });
    else P = w.map(function (s) { return [gIdx(s, 1), gIdx(s, Q.s[s - 1][3])]; });
    hzTestStart({ k: "s", s: w[0], w: way }, "m", P);''')
rep('''        '<button class="continue hz-wgo" id="hzWardGo">' + ic("book") + " اختبرني في ورد النهارده</button>" + due.map(function (x) {''',
'''        '<div class="z-sort hz-wway">' + [["o", "بالسرد"], ["r", "عشوائي"]].map(function (x) { return '<button data-ww="' + x[0] + '"' + (load("hzWardWay", "o") === x[0] ? ' class="on"' : "") + ">" + x[1] + "</button>"; }).join("") + "</div>" +
        '<button class="continue hz-wgo" id="hzWardGo">' + ic("book") + " اختبرني في ورد النهارده</button>" + due.map(function (x) {''')
rep('''    view.querySelectorAll("[data-test]").forEach(function (b) { b.onclick = function () { c.k = "s"; put("s", +b.dataset.test, true); }; });''',
'''    // 5.16 U1: a due surah's «اختبرني» starts the mushaf test on that surah at once (the way of the ward above)
    view.querySelectorAll("[data-test]").forEach(function (b) { b.onclick = function () { var s1 = +b.dataset.test; hzTestStart({ k: "s", s: s1, w: load("hzWardWay", "o") }, "m"); }; });
    view.querySelectorAll(".hz-wway button").forEach(function (b) { b.onclick = function () { save("hzWardWay", b.dataset.ww); var y = window.scrollY; showHifzLog(); window.scrollTo(0, y); }; });''')
# U8: «السور المراجعة» fold: its summary looks like the map's «السور المحفوظة» button
rep('''<summary class="hz-h">' + ic("check") + 'السور المراجعة</summary>''', '''<summary class="continue hl-sbtn">' + ic("check") + ' السور المراجعة</summary>''')
# U6: the map's «السور المحفوظة» opens the list in place (no jump to the hifz test page)
rep('''<summary class="hz-h">' + ic("check") + "السور المحفوظة</summary>"''', '''<summary class="continue hl-sbtn">' + ic("check") + " السور المحفوظة</summary>"''')
rep('''      '<button class="continue" id="hmLog">' + ic("check") + " السور المحفوظة</button></div>";
    document.getElementById("hmLog").onclick = function () { hzMemoOpen = true; location.hash = "#/hifztest"; };''',
'''      hzMemoList(L) + "</div>";
    document.getElementById("hmFold").ontoggle = function () { hzMemoOpen = this.open; };''')
# U7: «آيات غلطت فيها قبل كده» opens and closes on a tap
rep('''(bad.length ? '<div class="ht-bad"><b>آيات غلطت فيها قبل كده</b><div>' + bad.map(function (x) { return '<button data-a="' + x.a + '">الآية ' + ar(x.a) + "</button>"; }).join("") + "</div></div>" : "")''',
'''(bad.length ? '<details class="ht-bad hl-fold" id="htBad"' + (htBadOpen ? " open" : "") + '><summary><b>آيات غلطت فيها قبل كده (' + ar(bad.length) + ')</b></summary><div>' + bad.map(function (x) { return '<button data-a="' + x.a + '">الآية ' + ar(x.a) + "</button>"; }).join("") + "</div></details>" : "")''')
rep('''    document.getElementById("hmFold").ontoggle = function () { hzMemoOpen = this.open; };
    var missed = 0''', '''    document.getElementById("hmFold").ontoggle = function () { hzMemoOpen = this.open; };
    var hb = document.getElementById("htBad"); if (hb) hb.ontoggle = function () { htBadOpen = this.open; };
    var missed = 0''')
rep('var hzFoldOpen = false, hzMemoOpen = false, hzFrom = false;', 'var hzFoldOpen = false, hzMemoOpen = false, htBadOpen = false, hzFrom = false;')
# U9: the map is for memorised surahs only: no review colour (q.hzRev due), a wrong ayah makes the page «partly»
rep('''      ss.forEach(function (s) { var e = L[s], r = RV[s]; if (e) { on++; if (r && hzDueInfo(r, hzScoreOf(sc, s)).due) weak = true; } });
      var c = !on ? 0 : on < ss.length ? 1 : weak ? 2 : 3, pa = PA[n];
      if (pa && pa.got) c = Math.max(c, pa.got < pa.n ? 1 : pa.age > 14 || pa.bad ? 2 : 3);''',
'''      // 5.16 U9: memorised surahs only (q.hifzLog + ayat recited right); the review list has no say here
      ss.forEach(function (s) { if (L[s]) on++; });
      var c = !on ? 0 : on < ss.length ? 1 : 3, pa = PA[n];
      if (pa && pa.got) c = Math.max(c, pa.got < pa.n || pa.bad ? 1 : 3);''')
rep('''      var e = L[s], c = !e ? 0 : RV[s] && hzDueInfo(RV[s], hzScoreOf(sc, s)).due ? 2 : 3, got = 0, tot = 0, age = 0, bad = false;''',
'''      var e = L[s], c = !e ? 0 : 3, got = 0, tot = 0, age = 0, bad = false;''')
rep('''      if (got) c = Math.max(c, got < tot ? 1 : age > 14 || bad ? 2 : 3);''', '''      if (got) c = Math.max(c, got < tot || bad ? 1 : 3);''')
io.open(p,'w',encoding='utf-8',newline='\n').write(s); print('ok')
