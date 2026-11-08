import io,sys
p='web/app.js'; s=io.open(p,encoding='utf-8').read()
def rep(a,b):
    global s
    if s.count(a)!=1: sys.exit('miss: '+a[:60])
    s=s.replace(a,b)
rep('''    html += '<div class="home-row"><button class="mini" id="tPrayer">' + ic("clock") + "<span>" + prayerTileText() + "</span></button>" + goalCard() + "</div>";
    html += khatmaCard() + todayCard();''',
'''    // 5.16 U5: with a memorised surah, «هدف اليوم» lives inside the «النهارده» card (one card, no repeat)
    var td = todayCard();
    html += '<div class="home-row' + (td ? " one" : "") + '"><button class="mini" id="tPrayer">' + ic("clock") + "<span>" + prayerTileText() + "</span></button>" + (td ? "" : goalCard()) + "</div>";
    html += khatmaCard() + td;''')
rep('''    document.getElementById("tGoal").onclick = goalDialog;''','''    document.getElementById("tGoal").onclick = function (ev) { ev.stopPropagation(); goalDialog(); };''')
rep('''    var rv = W.list.length ? "مراجعة: " + ar(W.list.length) + " سورة (" + ar(W.pages) + " صفحة)" : "مفيش مراجعة مستحقة ✓";
    return '<div class="kcard td-card" id="tdCard" role="button" tabindex="0"><span class="tile-ic kh">' + ic("rep") + '</span><span class="kc-txt"><b>النهارده</b><small>' +
      (kh ? kh + " · " : "") + rv + "</small></span>" + (W.list.length ? '<button class="td-go" id="tdGo">اختبرني</button>' : ic("left")) + "</div>";''',
'''    var rv = W.list.length ? "مراجعة: " + ar(W.list.length) + " سورة (" + ar(W.pages) + " صفحة)" : "مفيش مراجعة مستحقة ✓";
    // 5.16 U5: the reading goal is the card's ring (tap: set the goal); the lines: reading, khatma ward, review ward
    var g = goalCfg(), n = todayPages(), pct = g.pages ? Math.min(100, Math.round(n / g.pages * 100)) : 0, ok = g.pages && n >= g.pages;
    var ring = '<button class="td-goal g-ring' + (ok ? " done" : "") + '" id="tGoal" style="--p:' + pct + '" aria-label="هدف القراءة اليومي"><b>' + (!g.pages ? ic("target") : ok ? "✓" : ar(pct) + "٪") + "</b></button>";
    var rd = g.pages ? "القراءة: " + ar(Math.min(n, g.pages)) + " من " + ar(g.pages) + " صفحة" : "حدد هدف يومي";
    return '<div class="kcard td-card" id="tdCard" role="button" tabindex="0">' + ring + '<span class="kc-txt"><b>النهارده</b><small>' +
      rd + " · " + (kh ? kh + " · " : "") + rv + "</small></span>" + (W.list.length ? '<button class="td-go" id="tdGo">اختبرني</button>' : ic("left")) + "</div>";''')
io.open(p,'w',encoding='utf-8',newline='\n').write(s)
c=io.open('web/style.css',encoding='utf-8').read()
c+='''
/* 5.16 U5 / U6 / U8 */
.home-row.one{grid-template-columns:1fr}
.td-goal{border:0;padding:0;cursor:pointer;color:inherit;font:inherit}.td-goal.done b{color:var(--accent);font-size:16px}.td-goal b svg{width:18px;height:18px}
.hl-fold>summary.hl-sbtn{display:flex;align-items:center;gap:8px;margin:10px 0 0}
.ht-bad>summary{display:flex;align-items:center}
.hz-wway{margin:8px 0}
'''
io.open('web/style.css','w',encoding='utf-8',newline='\n').write(c); print('ok')
