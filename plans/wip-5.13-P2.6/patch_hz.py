import sys
p = 'web/app.js'
s = open(p, encoding='utf-8').read()
new = open(sys.argv[1], encoding='utf-8').read()
a = s.index('  function showHifzLog() {')
b = s.index('  // ---------- نسخة احتياطية ----------')
s = s[:a] + new + s[b:]


def rep(x, y):
    global s
    assert s.count(x) == 1, (x[:70], s.count(x))
    s = s.replace(x, y)


rep('["#/hifzlog", "متابعة الحفظ"]]', '["#/hifzlog", "المراجعة"]]')
rep('" سجّل السور اللي حفظتها</button></div>";', '" السور اللي حفظتها</button></div>";')
rep('''function hifzSummary() { var h = hifzStats(); return h.n ? "حفظت " + ar(h.n) + " سورة (" + ar(h.pct) + "٪ من القرآن)" : "سجّل السور اللي حفظتها"; }''',
    '''function hifzSummary() { return "المراجعة واختبار الحفظ"; }   // 5.13 P2.10: no numbers outside More › Stats''')
rep("""'<section class="kh-sec"><h3>' + ic("check") + 'متابعة الحفظ</h3>""",
    """'<section class="kh-sec"><h3>' + ic("check") + 'المراجعة</h3>""")
rep('''    var H = load("hifzAyat", {}); H[k] = { d: todayStr(), ok: ok ? 1 : 0 }; save("hifzAyat", H);
  }''', '''    var H = load("hifzAyat", {}); H[k] = { d: todayStr(), ok: ok ? 1 : 0 }; save("hifzAyat", H); hifzAuto([+k.split(":")[0]]);
  }''')
rep('''    var H = load("hifzAyat", {}), d = todayStr(); ks.forEach(function (k) { H[k] = { d: d, ok: m[k] ? 1 : 0 }; }); save("hifzAyat", H);''',
    '''    var H = load("hifzAyat", {}), d = todayStr(); ks.forEach(function (k) { H[k] = { d: d, ok: m[k] ? 1 : 0 }; }); save("hifzAyat", H);
    hifzAuto(ks.map(function (k) { return +k.split(":")[0]; }));''')
rep('''    // Testing the whole surah puts it on the hifz map by itself (marked memorised today), or refreshes its review date.
    var D = hifzLogData(); if (!D[s] && seen >= Q.s[s - 1][3]) D[s] = { m: todayStr() };
    if (D[s]) { D[s].r = todayStr(); D[s].score = score; save("hifzLog", D); syncAlarms(); }''',
    '''    // the surahs tested get today as their review date (they are marked memorised only by hifzAuto, at 80%)
    var D = hifzLogData(), ts = {}; Object.keys(t.seen).forEach(function (k) { ts[k.split(":")[0]] = 1; });
    Object.keys(ts).forEach(function (x) { if (D[x]) { D[x].r = todayStr(); D[x].score = score; } }); save("hifzLog", D); syncAlarms();''')
rep('''      var HA = load("hifzAyat", {}), all = true; for (var q = 1; q <= cnt; q++) if (!HA[s + ":" + q]) { all = false; break; }
      var D = hifzLogData(); if (!D[s] && to >= cnt && all) D[s] = { m: todayStr() };
      if (D[s]) {''', '''      var D = hifzLogData();   // marked memorised only by hifzAuto (80% of its ayat right); a test refreshes the review date
      if (D[s]) {''')
rep('''  function hifzBar() {
    var bar = document.getElementById("hifzBar");''', '''  function hifzBar() {
    var bar = document.getElementById("hifzBar");
    // a test with a range (المراجعة › اختبرني, 5.13 P2.6) ends by itself once its last ayah is recited or opened
    if (hifz.test && hifz.test.end && hifz.test.seen[hifz.test.end] && !hifz.test.fin) { hifz.test.fin = 1; setTimeout(function () { if (hifz.test && hifz.test.fin) hifzTestDone(); }, 900); }''')
open(p, 'w', encoding='utf-8').write(s)
print('patched')
