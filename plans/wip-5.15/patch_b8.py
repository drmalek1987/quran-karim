# 5.15b item 8: when a surah counts as memorised (✓): by the TEST SCORE on that surah (80%), not by its ayat in hifzAyat.
# From «المراجعة» (a range / random / ward test): any test on the surah, score >= 80 -> ✓, < 80 -> off.
# From «اختبار الحفظ» / «خريطة الحفظ»: only a test of the WHOLE surah decides it (score >= 80 -> ✓, < 80 -> off).
import io
P = r"D:\Quran App\quran-karim\web\app.js"
s = io.open(P, encoding="utf8").read()
def rep(old, new, n=1):
    global s
    c = s.count(old); assert c == n, (c, old[:100]); s = s.replace(old, new)

rep('''save("hifzAyat", H); hifzAuto([+k.split(":")[0]]);''', '''save("hifzAyat", H);''')
rep('''    hifzAuto(ks.map(function (k) { return +k.split(":")[0]; }));\n''', '')
rep('''  function hifzAuto(ss) {''', '''  // 5.15b item 8: a test result p on surah s marks it memorised at 80% and takes the mark off below (q.hifzLog)
  function hzSetMemo(s, p) {
    var D = hifzLogData();
    if (p >= 80 && !D[s]) D[s] = { m: todayStr(), r: todayStr(), iv: 7 };
    else if (p < 80 && D[s]) delete D[s];
    else return D;
    save("hifzLog", D); return D;
  }
  window.hzSetMemo = hzSetMemo;   // QA
  function hifzAuto(ss) {''')
# mushaf test: a score per surah; the mark by the rule above
rep('''    var D = hifzLogData(), ts = {}; Object.keys(t.seen).forEach(function (k) { ts[k.split(":")[0]] = 1; });
    Object.keys(ts).forEach(function (x) { if (D[x]) hzReviewed(D[x], score); }); save("hifzLog", D); syncAlarms();
    // the score goes to every surah of the test (a range or random places can span several)
    var res = load("hifzScores", {}); Object.keys(ts).forEach(function (x) { res[x] = { d: todayStr(), score: score }; }); save("hifzScores", res);''',
    '''    var ts = {}; Object.keys(t.seen).forEach(function (k) { var x = k.split(":")[0], e = ts[x] = ts[x] || { n: 0, m: 0 }; e.n++; if (t.miss[k]) e.m++; });
    var res = load("hifzScores", {});
    Object.keys(ts).forEach(function (x) {
      var e = ts[x], sp = Math.round((e.n - e.m) / e.n * 100), D = (t.end || e.n >= Q.s[+x - 1][3]) ? hzSetMemo(+x, sp) : hifzLogData();
      if (D[x]) { hzReviewed(D[x], sp); save("hifzLog", D); }
      res[x] = { d: todayStr(), score: sp };
    });
    save("hifzScores", res); syncAlarms();''')
# words test: the surah's score adds up over its parts (q.hifzTest.ss); whole = from its first ayah to its last
rep('''        if (rg) { var c1 = load("hifzTest", {}); c1.acc = { h: rg.acc.h + hidden, m: rg.acc.m + missed }; save("hifzTest", c1); }
      }''', '''        var c1 = load("hifzTest", {}), q0 = c1.ss && c1.ss.s === s && c1.ss.to === from - 1 ? c1.ss : { s: s, a1: from, h: 0, m: 0 };
        c1.ss = { s: s, a1: q0.a1, to: to, h: q0.h + hidden, m: q0.m + missed };
        if (rg) c1.acc = { h: rg.acc.h + hidden, m: rg.acc.m + missed };
        save("hifzTest", c1);
      }''')
rep('''      var D = hifzLogData();   // marked memorised only by hifzAuto (80% of its ayat right); a test refreshes the review date
      if (D[s]) { hzReviewed(D[s], score); save("hifzLog", D); syncAlarms(); }
      var res = load("hifzScores", {}); res[s] = { d: todayStr(), score: score }; save("hifzScores", res);''',
    '''      // 5.15b item 8: the surah's score so far in this test; from «المراجعة» it marks the surah, from «اختبار الحفظ» only once
      // the whole surah was tested
      var q1 = load("hifzTest", {}).ss || { h: hidden, m: missed, a1: from, to: to }, sp = q1.h ? Math.round((q1.h - q1.m) / q1.h * 100) : 100;
      var D = rg || (q1.a1 === 1 && q1.to === cnt) ? hzSetMemo(s, sp) : hifzLogData();
      if (D[s]) { hzReviewed(D[s], sp); save("hifzLog", D); } syncAlarms();
      var res = load("hifzScores", {}); res[s] = { d: todayStr(), score: sp }; save("hifzScores", res);''')
# the next part / place keeps the surah's running score
rep('''    var stNext = function (o) { if (rg) {''', '''    var stNext = function (o) { var c9 = load("hifzTest", {}); if (c9.ss) o.ss = c9.ss; if (rg) {''')
rep('''<p class="hint">التطبيق بيعلّم السورة ✓ لوحده لما تسمّع ٨٠٪ من آياتها صح في الاختبارات.</p>''',
    '''<p class="hint">السورة بتتعلّم ✓ لوحدها لما تجيب ٨٠٪ أو أكتر في اختبار عليها هنا في «المراجعة»، أو لما تسمّعها كلها في «اختبار الحفظ» بنتيجة ٨٠٪ أو أكتر.</p>''')
io.open(P, "w", encoding="utf8", newline="").write(s)

I = r"D:\Quran App\quran-karim\web\i18n.js"
t = io.open(I, encoding="utf8").read(); a = '"عليك مراجعة": "Due for review",'; assert t.count(a) == 1
t = t.replace(a, a + ' "السورة بتتعلّم ✓ لوحدها لما تجيب #٪ أو أكتر في اختبار عليها هنا في «المراجعة»، أو لما تسمّعها كلها في «اختبار الحفظ» بنتيجة #٪ أو أكتر.": "A surah gets ✓ by itself when you score #% or more in a test on it here in «Review», or recite all of it in «Hifz test» with #% or more.",', 1)
io.open(I, "w", encoding="utf8", newline="").write(t)
print("ok")
