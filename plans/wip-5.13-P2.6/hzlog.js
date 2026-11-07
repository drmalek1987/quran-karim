  // ---------- 5.13 P2.6: «المراجعة» ----------
  // A surah is memorised when the app heard 80% of its ayat right in tests (q.hifzAyat, ok = 1), never by a tap:
  // hifzAuto puts it in q.hifzLog (review dates) at 80% and takes it out below. Old marks of surahs with no tested ayah stay.
  function hifzPct(s, HA) {
    var n = Q.s[s - 1][3], ok = 0, any = 0;
    for (var a = 1; a <= n; a++) { var h = HA[s + ":" + a]; if (h) { any++; if (h.ok) ok++; } }
    return { p: Math.floor(ok * 100 / n), any: any };
  }
  function hifzAuto(ss) {
    var HA = load("hifzAyat", {}), D = hifzLogData(), ch = false, seen = {};
    ss.forEach(function (s) {
      if (seen[s]) return; seen[s] = 1;
      var r = hifzPct(s, HA); if (!r.any) return;
      if (r.p >= 80 && !D[s]) { D[s] = { m: todayStr(), r: todayStr() }; ch = true; }
      else if (r.p < 80 && D[s]) { delete D[s]; ch = true; }
    });
    if (ch) { save("hifzLog", D); syncAlarms(); }
  }
  // test ranges: ayat by their place in the whole Quran (0..6235); quarters and halves from the 240 rub' al-hizb (QURAN.h)
  var AY0 = null;
  function ayStart() { if (!AY0) { AY0 = [0]; for (var i = 0; i < 114; i++) AY0.push(AY0[i] + Q.s[i][3]); } return AY0; }
  function gIdx(s, a) { return ayStart()[s - 1] + a - 1; }
  function gAy(i) { var A = ayStart(), s = 1; while (s < 114 && A[s] <= i) s++; return [s, i - A[s - 1] + 1]; }
  function rubIdx(k) { return k >= 240 ? 6236 : gIdx(Q.h[k][0], Q.h[k][1]); }
  function hzRange(c) {
    var j = (c.n - 1) * 8;
    if (c.k === "s") return [gIdx(c.s, 1), gIdx(c.s, Q.s[c.s - 1][3])];
    if (c.k === "a") { var n = Q.s[c.s - 1][3], a1 = Math.min(n, c.a1), a2 = Math.min(n, Math.max(a1, c.a2)); return [gIdx(c.s, a1), gIdx(c.s, a2)]; }
    if (c.k === "j") return [rubIdx(j), rubIdx(j + 8) - 1];
    if (c.k === "jq") return [rubIdx(j + (c.q - 1) * 2), rubIdx(j + c.q * 2) - 1];
    if (c.k === "jh") return [rubIdx(j + (c.q - 1) * 4), rubIdx(j + c.q * 4) - 1];
    if (c.k === "mq") return [rubIdx((c.q - 1) * 60), rubIdx(c.q * 60) - 1];
    if (c.k === "mh") return [rubIdx((c.q - 1) * 120), rubIdx(c.q * 120) - 1];
    return [0, 6235];
  }
  function ayName(i) { var x = gAy(i); return Q.s[x[0] - 1][0] + " " + ar(x[1]); }
  // the part to test: in order (the whole range) or at random (5–12 ayat somewhere in it)
  function hzPart(c) {
    var R = hzRange(c), len = R[1] - R[0] + 1;
    if (c.w !== "r") return [R[0], R[1]];
    var n = Math.min(len, 5 + Math.floor(Math.random() * 8)), st = R[0] + Math.floor(Math.random() * (len - n + 1));
    return [st, st + n - 1];
  }
  function hzTestStart(c, how) {
    var P = hzPart(c), b = gAy(P[0]), e = gAy(P[1]);
    if (how === "m") { hifzTestPages(b[0], b[1]); hifz.test.end = e[0] + ":" + e[1]; return; }
    var st = load("hifzTest", { lv: 25 });
    save("hifzTest", { lv: st.lv || 25, s: b[0], from: b[1], n: c.w === "r" ? P[1] - P[0] + 1 : 10, end: P[1], acc: { h: 0, m: 0 } });
    if (location.hash === "#/hifztest/" + b[0]) route(); else location.hash = "#/hifztest/" + b[0];
  }
  window.hzRange = hzRange;   // QA
  var HZ_K = [["s", "سورة"], ["j", "جزء"], ["a", "آيات من سورة"], ["jq", "ربع جزء"], ["jh", "نصف جزء"], ["mq", "ربع المصحف"], ["mh", "نصف المصحف"], ["all", "القرآن كله"]];
  function showHifzLog() {
    titleEl.textContent = "المراجعة";
    btnBack.hidden = false;
    var L = hifzLogData(), HA = load("hifzAyat", {}), sc = load("hifzScores", {}), today = dayNum(new Date());
    var c = load("hzScope", { k: "s", s: 1, n: 1, q: 1, a1: 1, a2: 7, w: "o" });
    var sel = function (id, label, items, v) {
      return '<select class="input" id="' + id + '" aria-label="' + label + '">' + items.map(function (x) { return '<option value="' + x[0] + '"' + (String(x[0]) === String(v) ? " selected" : "") + ">" + x[1] + "</option>"; }).join("") + "</select>";
    };
    var surahs = [], juz = [], ays = [];
    for (var i = 1; i <= 114; i++) surahs.push([i, ar(i) + ". " + Q.s[i - 1][0] + (L[i] ? " ✓" : "")]);
    for (var j = 1; j <= 30; j++) juz.push([j, "الجزء " + ar(j)]);
    if (c.k === "a") for (var a = 1; a <= Q.s[c.s - 1][3]; a++) ays.push([a, ar(a)]);
    var parts = c.k === "jq" || c.k === "mq" ? [[1, "الربع الأول"], [2, "الربع الثاني"], [3, "الربع الثالث"], [4, "الربع الرابع"]] : [[1, "النصف الأول"], [2, "النصف الثاني"]];
    if (c.q > parts.length) c.q = 1;
    var R = hzRange(c);
    var html = hzNav("#/hifzlog") + '<section class="hz-card" id="hzCard"><h3>' + ic("eyeoff") + "اختبرني</h3>" +
      '<div class="hz-row">' + sel("hzK", "المدى", HZ_K, c.k) +
      (c.k === "s" || c.k === "a" ? sel("hzS", "السورة", surahs, c.s) : "") +
      (c.k === "j" || c.k === "jq" || c.k === "jh" ? sel("hzN", "الجزء", juz, c.n) : "") +
      (c.k === "jq" || c.k === "jh" || c.k === "mq" || c.k === "mh" ? sel("hzQ", "الجزء من المدى", parts, c.q) : "") + "</div>" +
      (c.k === "a" ? '<div class="hz-row hz-ays"><span>من الآية</span>' + sel("hzA1", "من الآية", ays, c.a1) + "<span>إلى</span>" + sel("hzA2", "إلى الآية", ays, Math.max(c.a1, c.a2)) + "</div>" : "") +
      '<p class="hint hz-rng">من ' + ayName(R[0]) + " إلى " + ayName(R[1]) + " · " + ar(R[1] - R[0] + 1) + " آية</p>" +
      '<div class="z-sort hz-way"><button data-w="o"' + (c.w !== "r" ? ' class="on"' : "") + '>بالسرد</button><button data-w="r"' + (c.w === "r" ? ' class="on"' : "") + ">عشوائي (٥–١٢ آية)</button></div>" +
      '<div class="hz-go"><button class="continue" id="hzGoM">' + ic("book") + ' على المصحف</button><button class="continue" id="hzGoW">' + ic("eyeoff") + " بالكلمات</button></div></section>";
    // «عليك مراجعة»: memorised surahs whose review is due (the map's yellow rule), oldest first
    var due = Object.keys(L).map(function (s) { var e = L[s]; return { s: +s, age: today - parseDay(e.r || e.m), sc: sc[s] && sc[s].score }; })
      .filter(function (x) { return x.age > 14 || (x.sc != null && x.sc < 70); }).sort(function (x, y) { return y.age - x.age; });
    html += '<section class="hz-due"><h3 class="hz-h">' + ic("rep") + "عليك مراجعة</h3>" + (due.length ? due.map(function (x) {
      return '<div class="hl-due"><div><b>سورة ' + Q.s[x.s - 1][0] + "</b><small>آخر مراجعة من " + ar(x.age) + " يوم" + (x.sc != null && x.sc < 70 ? " · آخر نتيجة " + ar(x.sc) + "٪" : "") +
        '</small></div><button data-test="' + x.s + '">اختبرني</button></div>';
    }).join("") : '<p class="hint">مفيش مراجعة متأخرة. السورة بتظهر هنا لما يعدّي على آخر مراجعة ليها أكتر من ١٤ يوم، أو لو آخر نتيجة ليها أقل من ٧٠٪.</p>') + "</section>";
    html += '<section><h3 class="hz-h">' + ic("check") + 'السور اللي حفظتها</h3><p class="hint">التطبيق بيعلّم السورة ✓ لوحده لما تسمّع ٨٠٪ من آياتها صح في الاختبارات.</p><ul class="hl-list">';
    for (var s = 1; s <= 114; s++) {
      var e = L[s], pc = hifzPct(s, HA);
      html += '<li data-s="' + s + '" class="' + (e ? "on" : "") + '"><span class="hl-n">' + ar(s) + "</span><b>" + Q.s[s - 1][0] + "</b>" +
        "<small>" + (pc.any ? ar(pc.p) + "٪" : ar(Q.s[s - 1][3]) + " آية") + (e ? " · راجعتها من " + ar(today - parseDay(e.r || e.m)) + " يوم" : "") + '</small><i class="hl-chk">' + (e ? "✓" : "") + "</i></li>";
    }
    view.innerHTML = '<div class="hl">' + html + "</ul></section></div>";
    var put = function (k, v, top) {
      c[k] = v; if (k === "s") { c.a1 = 1; c.a2 = Math.min(7, Q.s[v - 1][3]); }
      save("hzScope", c); var y = window.scrollY; showHifzLog(); window.scrollTo(0, top ? 0 : y);
    };
    [["hzK", "k"], ["hzS", "s"], ["hzN", "n"], ["hzQ", "q"], ["hzA1", "a1"], ["hzA2", "a2"]].forEach(function (x) {
      var e2 = document.getElementById(x[0]); if (e2) e2.onchange = function () { put(x[1], x[1] === "k" ? this.value : +this.value); };
    });
    view.querySelectorAll(".hz-way button").forEach(function (b) { b.onclick = function () { put("w", b.dataset.w); }; });
    document.getElementById("hzGoM").onclick = function () { hzTestStart(c, "m"); };
    document.getElementById("hzGoW").onclick = function () { hzTestStart(c, "w"); };
    // a due surah's «اختبرني», or a surah in the list: the card above gets that surah
    view.querySelectorAll("[data-test]").forEach(function (b) { b.onclick = function () { c.k = "s"; put("s", +b.dataset.test, true); }; });
    view.querySelectorAll(".hl-list li").forEach(function (li) { li.onclick = function () { c.k = "s"; put("s", +li.dataset.s, true); }; });
  }

