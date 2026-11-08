# Patch 5.15c (the user's requests on 5.15b):
# 1 «قلب تلقائي» shows again inside a test, on and disabled (mushaf bar + words test)
# 2 back from «المراجعة» itself goes home (#/)
# 3 two lists: «السور المحفوظة» (q.hifzLog, marked only from «اختبار الحفظ»/«خريطة الحفظ» by a whole-surah test >= 80%)
#   and «السور المراجعة» (q.hzRev, marked only by a test started from «المراجعة», score >= 80%); the spaced review
#   (due / iv / ward / alarms / «النهارده») runs on q.hzRev; the map: memorised from q.hifzLog, «محتاجة مراجعة» from q.hzRev
import io
P = r"D:\Quran App\quran-karim\web\app.js"
s = io.open(P, encoding="utf8").read()
def rep(old, new, n=1):
    global s
    c = s.count(old); assert c == n, (c, old[:100]); s = s.replace(old, new)

# ---- 1: flip button back, on + disabled inside a test
rep('''(hifz.pages && !T ? '<button data-c="flip" class="hz-flip' + (fl ? " on" : "") + '" aria-pressed="' + fl + '" aria-label="قلب الصفحة تلقائي">''',
    '''(hifz.pages ? '<button data-c="flip" class="hz-flip' + (fl || T ? " on" : "") + '" aria-pressed="' + !!(fl || T) + '"' + (T ? " disabled" : "") + ' aria-label="قلب الصفحة تلقائي">''')
rep('''      // reciting past the last ayah always opens the next ayat with the mic still on (5.15b: no «قلب تلقائي» toggle in a test)
      "</div>" +''',
    '''      // reciting past the last ayah always opens the next ayat with the mic still on: «قلب تلقائي» is shown on and
      // disabled (5.15c item 1)
      '<button class="continue on" id="htFlip" disabled aria-pressed="true">' + ic("anext") + "<span>قلب تلقائي</span></button></div>" +''')

# ---- 2: back from «المراجعة» goes home
rep('''    if (hw && now - qExitAt < 1500) return "exit";
    if (hw) qExitAt = now;''', '''    if (location.hash === "#/hifzlog") { qBackN = 0; location.replace("#/"); return true; }   // 5.15c item 2
    if (hw && now - qExitAt < 1500) return "exit";
    if (hw) qExitAt = now;''')

# ---- 3: the review list q.hzRev
rep('''  function hifzLogData() { return load("hifzLog", {}); }''',
    '''  function hifzLogData() { return load("hifzLog", {}); }
  // 5.15c item 3: «السور المراجعة» q.hzRev {surah: {m, r, iv, score}}, apart from the memorised list q.hifzLog. The first
  // time (no q.hzRev yet) it starts as a copy of q.hifzLog, so the review dates kept until 5.15b carry over.
  function hzRevData() {
    var R = load("hzRev", null);
    if (!R) { R = hifzLogData(); save("hzRev", R); }
    return R;
  }
  window.hzRevData = hzRevData;   // QA''')
rep('''  function hzDueList(d) {
    var L = hifzLogData(),''', '''  function hzDueList(d) {
    var L = hzRevData(),''')
# memorised list: a whole-surah test from «اختبار الحفظ» / the map; review list: any test from «المراجعة»
rep('''  // 5.15b item 8: a test result p on surah s marks it memorised at 80% and takes the mark off below (q.hifzLog)
  function hzSetMemo(s, p) {
    var D = hifzLogData();
    if (p >= 80 && !D[s]) D[s] = { m: todayStr(), r: todayStr(), iv: 7 };
    else if (p < 80 && D[s]) delete D[s];
    else return D;
    save("hifzLog", D); return D;
  }
  window.hzSetMemo = hzSetMemo;   // QA''',
    '''  // 5.15b item 8 / 5.15c item 3: a whole-surah test p from «اختبار الحفظ» marks the surah memorised at 80% and takes
  // the mark off below (q.hifzLog, «السور المحفوظة»)
  function hzSetMemo(s, p) {
    var D = hifzLogData();
    if (p >= 80) D[s] = { m: (D[s] && D[s].m) || todayStr(), d: todayStr(), score: p };
    else if (D[s]) delete D[s];
    else return D;
    save("hifzLog", D); return D;
  }
  // a test from «المراجعة» with p on surah s: at 80% the surah is on «السور المراجعة» (q.hzRev), below it is taken off;
  // a surah on the list gets its next review date (hzReviewed)
  function hzSetRev(s, p) {
    var R = hzRevData();
    if (p >= 80 && !R[s]) R[s] = { m: todayStr(), r: todayStr(), iv: 7 };
    else if (p < 80 && R[s]) delete R[s];
    if (R[s]) hzReviewed(R[s], p);
    save("hzRev", R); return R;
  }
  window.hzSetMemo = hzSetMemo; window.hzSetRev = hzSetRev;   // QA''')
# mushaf test: from «المراجعة» (t.end: a range / random / ward test) -> review list; else whole surah -> memorised list
rep('''      var e = ts[x], sp = Math.round((e.n - e.m) / e.n * 100), D = (t.end || e.n >= Q.s[+x - 1][3]) ? hzSetMemo(+x, sp) : hifzLogData();
      if (D[x]) { hzReviewed(D[x], sp); save("hifzLog", D); }''',
    '''      var e = ts[x], sp = Math.round((e.n - e.m) / e.n * 100);
      if (t.end) hzSetRev(+x, sp); else if (e.n >= Q.s[+x - 1][3]) hzSetMemo(+x, sp);''')
rep('''      var D = rg || (q1.a1 === 1 && q1.to === cnt) ? hzSetMemo(s, sp) : hifzLogData();
      if (D[s]) { hzReviewed(D[s], sp); save("hifzLog", D); } syncAlarms();''',
    '''      if (rg) hzSetRev(s, sp); else if (q1.a1 === 1 && q1.to === cnt) hzSetMemo(s, sp);
      syncAlarms();''')
# «النهارده»: shown once there is a surah on the review list
rep('''    if (!Object.keys(hifzLogData()).length) return "";
    var P = plan(), W = hzWard(),''', '''    if (!Object.keys(hzRevData()).length) return "";
    var P = plan(), W = hzWard(),''')
# the map: «محتاجة مراجعة» from the review list
rep('''      ss.forEach(function (s) { var e = L[s]; if (e) { on++; if (hzDueInfo(e, hzScoreOf(sc, s)).due) weak = true; } });''',
    '''      ss.forEach(function (s) { var e = L[s], r = RV[s]; if (e) { on++; if (r && hzDueInfo(r, hzScoreOf(sc, s)).due) weak = true; } });''')
rep('''    var L = hifzLogData(), sc = load("hifzScores", {}), today = dayNum(new Date()), cnt = [0, 0, 0, 0], col = [];''',
    '''    var L = hifzLogData(), RV = hzRevData(), sc = load("hifzScores", {}), today = dayNum(new Date()), cnt = [0, 0, 0, 0], col = [];''')
rep('''    var pc = hifzPageColors(), cnt = pc.cnt, cells = "", L = hifzLogData(), sc''', '''    var pc = hifzPageColors(), cnt = pc.cnt, cells = "", L = hifzLogData(), RV = hzRevData(), sc''')
rep('''      var e = L[s], c = !e ? 0 : hzDueInfo(e, hzScoreOf(sc, s)).due ? 2 : 3,''',
    '''      var e = L[s], c = !e ? 0 : RV[s] && hzDueInfo(RV[s], hzScoreOf(sc, s)).due ? 2 : 3,''')
rep('''      '<button class="continue" id="hmLog">' + ic("check") + " السور اللي حفظتها</button></div>";
    document.getElementById("hmLog").onclick = function () { location.hash = "#/hifzlog"; };''',
    '''      '<button class="continue" id="hmLog">' + ic("check") + " السور المحفوظة</button></div>";
    document.getElementById("hmLog").onclick = function () { hzMemoOpen = true; location.hash = "#/hifztest"; };''')
# «المراجعة»: its list is «السور المراجعة» (q.hzRev)
rep('''    titleEl.textContent = "المراجعة";
    btnBack.hidden = false;
    var L = hifzLogData(),''', '''    titleEl.textContent = "المراجعة";
    btnBack.hidden = false;
    var L = hzRevData(),''')
rep('''ic("check") + 'السور اللي حفظتها</summary><p class="hint">السورة بتتعلّم ✓ لوحدها لما تجيب ٨٠٪ أو أكتر في اختبار عليها هنا في «المراجعة»، أو لما تسمّعها كلها في «اختبار الحفظ» بنتيجة ٨٠٪ أو أكتر.</p>''',
    '''ic("check") + 'السور المراجعة</summary><p class="hint">السورة بتدخل القايمة دي لما تجيب ٨٠٪ أو أكتر في اختبار عليها من هنا («المراجعة»)، بالسرد أو عشوائي. ولو جبت أقل من ٨٠٪ بتخرج منها.</p>''')
rep('''  var hzFoldOpen = false, hzFrom = false;''', '''  var hzFoldOpen = false, hzMemoOpen = false, hzFrom = false;''')
# «اختبار الحفظ»: the list «السور المحفوظة» (q.hifzLog), fold-open, only to look at
rep('''      reciteHistory() + "</div>";
    view.innerHTML = html;
    var missed = 0, rec = null;''', '''      reciteHistory() + hzMemoList(L) + "</div>";
    view.innerHTML = html;
    document.getElementById("hmFold").ontoggle = function () { hzMemoOpen = this.open; };
    var missed = 0, rec = null;''')
rep('''  function showHifzTest(s) {''', '''  // 5.15c item 3: «السور المحفوظة» under the hifz test (q.hifzLog), fold-open, a list to look at
  function hzMemoList(L) {
    var h = '<section class="hm-memo"><details class="hl-fold" id="hmFold"' + (hzMemoOpen ? " open" : "") + '><summary class="hz-h">' + ic("check") + "السور المحفوظة</summary>" +
      '<p class="hint">السورة بتدخل القايمة دي لما تسمّعها كلها هنا في «اختبار الحفظ» (أو من «خريطة الحفظ») بنتيجة ٨٠٪ أو أكتر. ولو جبت أقل من ٨٠٪ بتخرج منها.</p><ul class="hl-list">';
    for (var s = 1; s <= 114; s++) {
      var e = L[s];
      h += '<li data-s="' + s + '" class="' + (e ? "on" : "") + '"><span class="hl-n">' + ar(s) + "</span><b>" + Q.s[s - 1][0] + "</b><small>" + ar(Q.s[s - 1][3]) + " آية" +
        (e && e.score != null ? " · " + ar(e.score) + "٪" : "") + '</small><i class="hl-chk">' + (e ? "✓" : "") + "</i></li>";
    }
    return h + "</ul></details></section>";
  }
  function showHifzTest(s) {''')
io.open(P, "w", encoding="utf8", newline="").write(s)

I = r"D:\Quran App\quran-karim\web\i18n.js"
t = io.open(I, encoding="utf8").read(); a = '"عليك مراجعة": "Due for review",'; assert t.count(a) == 1
t = t.replace(a, a + ' "السور المراجعة": "Reviewed surahs", "السور المحفوظة": "Memorised surahs",'
  ' "السورة بتدخل القايمة دي لما تجيب #٪ أو أكتر في اختبار عليها من هنا («المراجعة»)، بالسرد أو عشوائي. ولو جبت أقل من #٪ بتخرج منها.": "A surah joins this list when you score #% or more in a test on it from here («Review»), in order or at random. Below #% it leaves the list.",'
  ' "السورة بتدخل القايمة دي لما تسمّعها كلها هنا في «اختبار الحفظ» (أو من «خريطة الحفظ») بنتيجة #٪ أو أكتر. ولو جبت أقل من #٪ بتخرج منها.": "A surah joins this list when you recite all of it here in «Hifz test» (or from «Hifz map») with #% or more. Below #% it leaves the list.",', 1)
io.open(I, "w", encoding="utf8", newline="").write(t)

C = r"D:\Quran App\quran-karim\web\style.css"
c = io.open(C, encoding="utf8").read()
c += "\n/* 5.15c: «قلب تلقائي» inside a test: always on, not a toggle */\n.hz-btns .hz-flip:disabled, .ht-ibs #htFlip:disabled { opacity: .5; cursor: default; }\n.hm-memo { margin-top: 14px; }\n"
io.open(C, "w", encoding="utf8", newline="").write(c)
print("ok")
