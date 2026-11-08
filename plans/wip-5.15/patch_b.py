# 5.15b: the user's patch for «المراجعة» (7 items)
import io
P = r"D:\Quran App\quran-karim\web\app.js"
s = io.open(P, encoding="utf8").read()
def rep(old, new, n=1):
    global s
    c = s.count(old); assert c == n, (c, old[:100]); s = s.replace(old, new)

# 5: auto flip is always on inside a test (no toggle there)
rep('''  function hifzPageGo() {''', '''  // 5.15b item 5: inside a test the page always turns by itself (the «قلب تلقائي» toggle is only outside tests)
  function hzFlipOn() { return !!hifz.test || load("hifzFlip", true); }
  function hifzPageGo() {''')
rep('''      if (load("hifzFlip", true)) next(); else if (hifz.test) hifzTestDone();''', '''      if (hzFlipOn()) next(); else if (hifz.test) hifzTestDone();''')
rep('''    if (!hifz.next || !hifz.pages || !hifz.items.length || !load("hifzFlip", true)) return null;''', '''    if (!hifz.next || !hifz.pages || !hifz.items.length || !hzFlipOn()) return null;''')
rep('''    if (!load("hifzFlip", true)) {
      setTimeout(''', '''    if (!hzFlipOn()) {
      setTimeout(''')
rep('''(hifz.pages ? '<button data-c="flip"''', '''(hifz.pages && !T ? '<button data-c="flip"''')
rep('''      // «قلب تلقائي» here too (5.11 phone #12, the same q.hifzFlip as the mushaf bar): reciting past the last ayah opens
      // the next ayat with the mic still on; off, the test ends at the last ayah with the score
      '<button class="continue' + (load("hifzFlip", true) ? " on" : "") + '" id="htFlip" aria-pressed="' + load("hifzFlip", true) + '">' + ic("anext") + "<span>قلب تلقائي</span></button></div>" +''',
    '''      // reciting past the last ayah always opens the next ayat with the mic still on (5.15b: no «قلب تلقائي» toggle in a test)
      "</div>" +''')
rep('''    document.getElementById("htFlip").onclick = function () {
      var fo = !load("hifzFlip", true); save("hifzFlip", fo); this.classList.toggle("on", fo); this.setAttribute("aria-pressed", fo);
      toast(fo ? "بعد آخر آية هتفتح الآيات اللي بعدها والمايك شغال" : "الاختبار هيخلص عند آخر آية وتطلع النتيجة");
    };
''', '')
rep('''      if (htv.more && load("hifzFlip", true)) {''', '''      if (htv.more) {''')

# 4: in a range / random test on the mushaf only the place's ayat are hidden: before and after it stay open
rep('''    var T0 = hifz.test; if (T0 && (T0.a > 1 || T0.pn > 1)) items.forEach(function (k) { var p = k.split(":"); if (+p[0] < T0.s || (+p[0] === T0.s && +p[1] < T0.a)) hifz.shown[k] = true; });''',
    '''    var T0 = hifz.test; if (T0 && (T0.a > 1 || T0.pn > 1 || T0.end)) items.forEach(function (k) { var p = k.split(":"); if (+p[0] < T0.s || (+p[0] === T0.s && +p[1] < T0.a)) hifz.shown[k] = true; });
    // (5.15b item 4) and the ayat after the place's end
    if (T0 && T0.end) { var ep = T0.end.split(":"); items.forEach(function (k) { var p = k.split(":"); if (+p[0] > +ep[0] || (+p[0] === +ep[0] && +p[1] > +ep[1])) hifz.shown[k] = true; }); }''')

# 3: a buzz when the next place opens
rep('''  function hifzNextPlace() {
    var T = hifz.test, P = T.pc.shift(), b = gAy(P[0]), e = gAy(P[1]);''', '''  // 5.15b item 3: the phone buzzes when a random test moves to its next place
  function hzPlaceBuzz() {
    window.__hzBuzz = (window.__hzBuzz || 0) + 1;
    try { if (window.AppBridge && AppBridge.buzzPattern) AppBridge.buzzPattern("0,70,90,70"); else if (navigator.vibrate) navigator.vibrate([70, 90, 70]); } catch (e) {}
  }
  function hifzNextPlace() {
    hzPlaceBuzz();
    var T = hifz.test, P = T.pc.shift(), b = gAy(P[0]), e = gAy(P[1]);''')
rep('''      if (nx.place) { o.n = nx.place[1] - nx.place[0] + 1; o.end = nx.place[1]; o.pc = rg.pc.slice(1); o.pn = rg.pn + 1; }''',
    '''      if (nx.place) { o.n = nx.place[1] - nx.place[0] + 1; o.end = nx.place[1]; o.pc = rg.pc.slice(1); o.pn = rg.pn + 1; hzPlaceBuzz(); }
      else o.cont = 1;   // the next ayat of the same place: not a new start (5.15b item 6)''')

# 6: «كل الكلمات»: the first 3-5 words of the first ayah open at the start of the test (in order) or of each place (random)
rep('''    var hidden = 0;
    for (var a = from; a <= to; a++) {''', '''    var hidden = 0, open0 = lv === 100 && !st.cont ? 3 + Math.floor(Math.random() * 3) : 0;
    for (var a = from; a <= to; a++) {''')
rep('''        if ((j + off) % every) return '<span class="ht-v"' + at + ">" + w + "</span>";''',
    '''        if ((j + off) % every || (a === from && j < open0)) return '<span class="ht-v' + (a === from && j < open0 ? " ht-open" : "") + '"' + at + ">" + w + "</span>";''')

# 1: «السور اللي حفظتها» folds open/closed and only scrolls: a tap on a surah does nothing
rep('''    html += '<section><h3 class="hz-h">' + ic("check") + 'السور اللي حفظتها</h3><p class="hint">التطبيق بيعلّم السورة ✓ لوحده لما تسمّع ٨٠٪ من آياتها صح في الاختبارات.</p><ul class="hl-list">';''',
    '''    html += '<section><details class="hl-fold" id="hlFold"' + (hzFoldOpen ? " open" : "") + '><summary class="hz-h">' + ic("check") + 'السور اللي حفظتها</summary><p class="hint">التطبيق بيعلّم السورة ✓ لوحده لما تسمّع ٨٠٪ من آياتها صح في الاختبارات.</p><ul class="hl-list">';''')
rep('''    view.innerHTML = '<div class="hl">' + html + "</ul></section></div>";''', '''    view.innerHTML = '<div class="hl">' + html + "</ul></details></section></div>";
    document.getElementById("hlFold").ontoggle = function () { hzFoldOpen = this.open; };''')
rep('''    // a due surah's «اختبرني», or a surah in the list: the card above gets that surah
    view.querySelectorAll("[data-test]").forEach(function (b) { b.onclick = function () { c.k = "s"; put("s", +b.dataset.test, true); }; });
    view.querySelectorAll(".hl-list li").forEach(function (li) { li.onclick = function () { c.k = "s"; put("s", +li.dataset.s, true); }; });''',
    '''    // a due surah's «اختبرني»: the card above gets that surah (the list of memorised surahs is only to look at, 5.15b)
    view.querySelectorAll("[data-test]").forEach(function (b) { b.onclick = function () { c.k = "s"; put("s", +b.dataset.test, true); }; });''')

# 2 + 7: a test started from «المراجعة»: back (screen or Android) from the mushaf test or the words test, during or after
# it, goes to the top of «المراجعة»
rep('''  var HZ_K = [''', '''  var hzFoldOpen = false, hzFrom = false;
  window.addEventListener("hashchange", function () { if (hzFrom && !/^#\\/(p|s|hifztest)\\//.test(location.hash) && location.hash !== "#/hifzlog") hzFrom = false; });
  window.hzFromState = function () { return hzFrom; };   // QA
  var HZ_K = [''')
rep('''    var b = gAy(P[0][0]), e = gAy(P[0][1]), pc = P.slice(1), tot = P.length;''', '''    hzFrom = location.hash === "#/hifzlog";
    var b = gAy(P[0][0]), e = gAy(P[0][1]), pc = P.slice(1), tot = P.length;''')
rep('''  function navBack(hw) {
    var home = !location.hash || location.hash === "#/" || location.hash === "#", now = Date.now();''', '''  function navBack(hw) {
    var home = !location.hash || location.hash === "#/" || location.hash === "#", now = Date.now();
    if (hzFrom && /^#\\/(p|s|hifztest)\\//.test(location.hash)) {
      hzFrom = false; qBackN = 0; location.hash = "#/hifzlog"; setTimeout(function () { window.scrollTo(0, 0); }, 0); return true;
    }''')
io.open(P, "w", encoding="utf8", newline="").write(s)

C = r"D:\Quran App\quran-karim\web\style.css"
c = io.open(C, encoding="utf8").read(); assert ".hl-fold" not in c
c += ".hl-fold>summary{cursor:pointer;list-style:none}.hl-fold>summary::-webkit-details-marker{display:none}.hl-fold>summary::after{content:'▾';margin-inline-start:auto;opacity:.6}.hl-fold[open]>summary::after{content:'▴'}\n.ht-v.ht-open{color:var(--accent)}\n"
io.open(C, "w", encoding="utf8", newline="").write(c)
print("ok")
