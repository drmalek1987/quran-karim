import sys
# 5.13 P2.6: the words test (showHifzTest) keeps a range from «المراجعة › اختبرني»: q.hifzTest.end (ayah index in the
# whole Quran), n (ayat per part) and acc {h, m} (hidden/missed words so far); parts go on into the next surahs.
p = 'web/app.js'
s = open(p, encoding='utf-8').read()


def rep(x, y):
    global s
    assert s.count(x) == 1, (x[:70], s.count(x))
    s = s.replace(x, y)


rep('''    var from = st.s === s && st.from ? st.from : 1, cnt = Q.s[s - 1][3], to = Math.min(cnt, from + 9), lv = st.lv || 25;''',
    '''    var from = st.s === s && st.from ? st.from : 1, cnt = Q.s[s - 1][3], lv = st.lv || 25;
    // a range test (المراجعة › اختبرني): parts of n ayat up to the range's last ayah, across surahs; acc adds up the parts
    var rg = st.s === s && st.end != null && st.end >= gIdx(s, from) ? { end: st.end, n: st.n || 10, acc: st.acc || { h: 0, m: 0 } } : null;
    var endA = rg ? gAy(rg.end) : null, last = endA && endA[0] === s ? endA[1] : cnt;
    var to = Math.min(cnt, from + (rg ? rg.n : 10) - 1, last);
    var nx = to < last ? { s: s, from: to + 1 } : rg && endA[0] > s ? { s: s + 1, from: 1 } : null;
    // the saved test state for the next part (or this part at another level): the range goes along
    var stNext = function (o) { if (rg) { var c0 = load("hifzTest", {}); o.n = rg.n; o.end = rg.end; o.acc = c0.acc || rg.acc; } return o; };
    var goNext = function () {
      save("hifzTest", stNext({ lv: lv, s: nx.s, from: nx.from }));
      if (nx.s !== s) history.replaceState(null, "", "#/hifztest/" + nx.s);
      showHifzTest(nx.s);
    };''')
rep('''الآيات ' + ar(from) + "–" + ar(to) + " من " + ar(cnt) + '.</p><div class="ht-text">';''',
    '''الآيات ' + ar(from) + "–" + ar(to) + " من " + ar(cnt) + (rg ? "، والاختبار لحد " + ayName(rg.end) : "") + '.</p><div class="ht-text">';''')
rep('''      (to < cnt ? '<button class="continue" id="htNext">الآيات اللي بعدها</button>' : "") + '</div><p class="ht-res" id="htRes"></p>' +''',
    '''      (nx ? '<button class="continue" id="htNext">الآيات اللي بعدها</button>' : "") + '</div><p class="ht-res" id="htRes"></p>' +''')
rep('''        more: to < cnt ? function () { htv.carry = true; document.getElementById("htDone").click(); var t = document.getElementById("htRes").textContent; save("hifzTest", { lv: lv, s: s, from: to + 1 }); showHifzTest(s); return t; } : null,''',
    '''        more: nx ? function () { htv.carry = true; document.getElementById("htDone").click(); var t = document.getElementById("htRes").textContent; goNext(); return t; } : null,''')
rep('''    view.querySelectorAll(".ht-lv button").forEach(function (b) { b.onclick = function () { save("hifzTest", { lv: +b.dataset.l, s: s, from: from }); showHifzTest(s); }; });''',
    '''    view.querySelectorAll(".ht-lv button").forEach(function (b) { b.onclick = function () { save("hifzTest", stNext({ lv: +b.dataset.l, s: s, from: from })); showHifzTest(s); }; });''')
rep('''    if (document.getElementById("htNext")) document.getElementById("htNext").onclick = function () { save("hifzTest", { lv: lv, s: s, from: to + 1 }); showHifzTest(s); window.scrollTo(0, 0); };''',
    '''    if (document.getElementById("htNext")) document.getElementById("htNext").onclick = function () { goNext(); window.scrollTo(0, 0); };''')
rep('''        asrStat("ok", hidden - missed); asrStat("bad", missed);
      }
      var score = hidden ? Math.round((hidden - missed) / hidden * 100) : 100;
      document.getElementById("htRes").innerHTML = "<b>" + ar(score) + "٪</b> افتكرت " + ar(hidden - missed) + " من " + ar(hidden) + " كلمة" + (score >= 90 ? "، ما شاء الله" : score >= 60 ? "، محتاجة مراجعة بسيطة" : "، راجعها تاني");''',
    '''        asrStat("ok", hidden - missed); asrStat("bad", missed);
        if (rg) { var c1 = load("hifzTest", {}); c1.acc = { h: rg.acc.h + hidden, m: rg.acc.m + missed }; save("hifzTest", c1); }
      }
      var score = hidden ? Math.round((hidden - missed) / hidden * 100) : 100;
      document.getElementById("htRes").innerHTML = "<b>" + ar(score) + "٪</b> افتكرت " + ar(hidden - missed) + " من " + ar(hidden) + " كلمة" + (score >= 90 ? "، ما شاء الله" : score >= 60 ? "، محتاجة مراجعة بسيطة" : "، راجعها تاني");
      // the range's last part: the result of the whole test
      if (rg && !nx) {
        var A = load("hifzTest", {}).acc || { h: hidden, m: missed }, tot = A.h ? Math.round((A.h - A.m) / A.h * 100) : 100;
        document.getElementById("htRes").innerHTML += '<span class="ht-tot" id="htTot">نتيجة الاختبار كله: <b>' + ar(tot) + "٪</b> (افتكرت " + ar(A.h - A.m) + " من " + ar(A.h) + " كلمة)</span>";
      }''')
open(p, 'w', encoding='utf-8').write(s)
print('patched ht')
