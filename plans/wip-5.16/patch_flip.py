import io,sys
def rep(s,a,b):
    if s.count(a)!=1: sys.exit('miss: '+a[:70])
    return s.replace(a,b)
p='web/app.js'; s=io.open(p,encoding='utf-8').read()
s=rep(s,'''  // 5.15b item 5: inside a test the page always turns by itself (the «قلب تلقائي» toggle is only outside tests)
  function hzFlipOn() { return !!hifz.test || load("hifzFlip", true); }''','''  // 5.15b item 5 / 5.16d: a test from «المراجعة» always turns the page (hifz.test.rv, the toggle shown faded);
  // a test from the map (or anywhere else) follows the «قلب تلقائي» toggle, on and off
  function hzFlipOn() { return !!(hifz.test && hifz.test.rv) || load("hifzFlip", true); }''')
s=rep(s,'''    if (how === "m") { hifzTestPages(b[0], b[1]); hifz.test.end''','''    if (how === "m") { hifzTestPages(b[0], b[1]); hifz.test.rv = 1; hifz.test.end''')
s=rep(s,'''(hifz.pages ? '<button data-c="flip" class="hz-flip' + (fl || T ? " on" : "") + '" aria-pressed="' + !!(fl || T) + '"' + (T ? " disabled" : "")''','''(hifz.pages ? '<button data-c="flip" class="hz-flip' + (fl || (T && T.rv) ? " on" : "") + '" aria-pressed="' + !!(fl || (T && T.rv)) + '"' + (T && T.rv ? " disabled" : "")''')
# words test: the toggle works unless it is a range test from «المراجعة» (rg)
s=rep(s,'''      '<button class="continue on" id="htFlip" disabled aria-pressed="true">' + ic("anext") + "<span>قلب تلقائي</span></button></div>" +''','''      '<button class="continue' + (rg || hzFl ? " on" : "") + '" id="htFlip"' + (rg ? " disabled" : "") + ' aria-pressed="' + !!(rg || hzFl) + '">' + ic("anext") + "<span>قلب تلقائي</span></button></div>" +''')
s=rep(s,'''        more: nx ? function () {''','''        more: nx && (rg || load("hifzFlip", true)) ? function () {''')
s=rep(s,'''    var nx = to < last ? { s: s, from: to + 1 }''','''    var hzFl = load("hifzFlip", true);
    var nx = to < last ? { s: s, from: to + 1 }''')
s=rep(s,'''    var hb = document.getElementById("htBad");''','''    var hf = document.getElementById("htFlip"); if (!hf.disabled) hf.onclick = function () { var fo = !load("hifzFlip", true); save("hifzFlip", fo); this.classList.toggle("on", fo); this.setAttribute("aria-pressed", fo); toast(fo ? "الآيات اللي بعدها هتفتح لوحدها وانت بتسمّع" : "الاختبار هيخلص في آخر الآيات دي"); };
    var hb = document.getElementById("htBad");''')
io.open(p,'w',encoding='utf-8',newline='\n').write(s)
u=io.open('tools/qa/ui.js',encoding='utf-8').read()
u=rep(u,'''    await go('#/hifztest/112', 700); const wf = await ev(() => { const f = document.getElementById('htFlip'); return !!f && f.disabled && f.classList.contains('on'); });
    await ev(() => localStorage.setItem('q.hifzFlip', 'true')); await hzBack(k); await go('#/', 200);
    return assert(fb === 1 && h === '#/p/601' && wf, JSON.stringify([fb, h, wf])); });''','''    await ev(() => hzTestStart({ k: 's', s: 112, w: 'o' }, 'w')); await wait(700); const wf = await ev(() => { const f = document.getElementById('htFlip'); return !!f && f.disabled && f.classList.contains('on'); });
    await ev(() => localStorage.setItem('q.hifzFlip', 'true')); await hzBack(k); await go('#/', 200);
    return assert(fb === 1 && h === '#/p/601' && wf, JSON.stringify([fb, h, wf])); });''')
u=rep(u,'''    await ev(() => { localStorage.setItem('q.hifzFlip', 'false'); localStorage.setItem('q.mode', '"pages"'); }); await go('#/hifzmap', 700); await p.click('.hm-grid .hm-c[data-p="600"]'); await wait(300); await p.click('#hzMus'); await wait(1200);
    const fb = await ev(() => document.querySelectorAll('#hifzBar .hz-flip.on:disabled').length);''','''    await ev(() => { localStorage.setItem('q.hifzFlip', 'false'); localStorage.setItem('q.mode', '"pages"'); }); await go('#/', 150); await go('#/hifzlog', 600);
    await ev(() => { const S = window.QURAN.s, P = window.QURAN.p, A = [0]; S.forEach((x, i) => A.push(A[i] + x[3])); const ids = [];
      P.forEach((ps, si) => ps.forEach((pg, ai) => { if (pg === 600) ids.push(A[si] + ai); })); hzTestStart({ k: 's', s: 1, w: 'o' }, 'm', [[ids[0], ids[ids.length - 1] + 3]]); }); await wait(1200);
    const fb = await ev(() => document.querySelectorAll('#hifzBar .hz-flip.on:disabled').length);''')
NEW=io.open('plans/wip-5.16/ui516d.js',encoding='utf-8').read()
u=rep(u,'''  // 5c/5d: the page moves one way only into and out of full screen''', NEW+'''  // 5c/5d: the page moves one way only into and out of full screen''')
io.open('tools/qa/ui.js','w',encoding='utf-8',newline='\n').write(u); print('ok')
