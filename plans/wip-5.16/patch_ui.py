import io,sys
def rep(s,a,b):
    if s.count(a)!=1: sys.exit('miss: '+a[:70])
    return s.replace(a,b)
p='web/app.js'; s=io.open(p,encoding='utf-8').read()
s=rep(s,'''    if (!w.length) return toast("مفيش مراجعة مستحقة النهارده");
    var way = load("hzWardWay", "o"), P = [];
    // 5.16 U2: «عشوائي» = random parts (3–12 ayat) inside each due surah, in Quran order
    if (way === "r") w.forEach(function (s) { P = P.concat(hzParts({ k: "s", s: s, w: "r" })); });
    else P = w.map(function (s) { return [gIdx(s, 1), gIdx(s, Q.s[s - 1][3])]; });
    hzTestStart({ k: "s", s: w[0], w: way }, "m", P);''','''    if (!w.length) return toast("مفيش مراجعة مستحقة النهارده");
    var way = load("hzWardWay", "o");
    hzTestStart({ k: "s", s: w[0], w: way }, "m", hzWardPlan(w, way));''')
s=rep(s,'''  window.hzWardTest = hzWardTest;   // QA''','''  // 5.16 U2: «بالسرد» = each due surah whole; «عشوائي» = random parts (3–12 ayat) inside each due surah, in Quran order
  function hzWardPlan(w, way) {
    var P = [];
    if (way === "r") w.forEach(function (s) { P = P.concat(hzParts({ k: "s", s: s, w: "r" })); });
    else P = w.map(function (s) { return [gIdx(s, 1), gIdx(s, Q.s[s - 1][3])]; });
    return P;
  }
  window.hzWardTest = hzWardTest; window.hzWardPlan = hzWardPlan;   // QA''')
io.open(p,'w',encoding='utf-8',newline='\n').write(s)
p='tools/qa/ui.js'; u=io.open(p,encoding='utf-8').read()
# old checks follow the new behaviour
u=rep(u,'''في الخريطة بيفتح قايمتها (5.15c)', async () => { await go('#/hifzmap', 700); await p.click('#hmLog'); await wait(600);''','''في الخريطة بيفتح قايمتها مكانها (5.15c / 5.16 U6)', async () => { await go('#/hifzmap', 700); await p.click('#hmFold > summary'); await wait(600);''')
u=rep(u,'''    return assert(m[0] === '#/hifztest' && m[1] === 114 && r[0]''','''    return assert(m[0] === '#/hifzmap' && m[1] === 114 && r[0]''')
u=rep(u,'''    const g = await ev(() => document.getElementById('tGoal').textContent); await ev(() => localStorage.removeItem('q.goal'));''','''    const g = await ev(() => (document.getElementById('tdCard') || document.getElementById('tGoal')).textContent); await ev(() => localStorage.removeItem('q.goal'));''')
u=rep(u,'''    await p.click('.hz-due [data-test="112"]'); await wait(300); const pick = await ev(() => document.getElementById('hzS') && document.getElementById('hzS').value);
    await hzBack(k); return assert(r[0] === '1,112' && !r[1] && !r[2] && r[3] === 4 && pick === '112', JSON.stringify([r, pick])); });''','''    await p.click('.hz-due [data-test="112"]'); await wait(1200); const pick = await ev(() => !!document.getElementById('hifzBar') && [...new Set([...document.querySelectorAll('.hifz-mask')].map(m => m.dataset.k.split(':')[0]))].join(','));
    await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); });
    await hzBack(k); await go('#/', 200); return assert(r[0] === '1,112' && !r[1] && !r[2] && r[3] === 4 && pick === '112', JSON.stringify([r, pick])); });''')
u=rep(u,'''    await p.click('#hmLog'); await wait(700); const lg = await ev(() => [location.hash, document.getElementById('hmFold') && document.getElementById('hmFold').open, (document.getElementById('hmLog') || {}).textContent]);''','''    await p.click('#hmFold > summary'); await wait(700); const lg = await ev(() => [location.hash, document.getElementById('hmFold') && document.getElementById('hmFold').open, !document.getElementById('hmLog')]);''')
u=rep(u,'''&& lg[0] === '#/hifztest' && lg[1] && mig''','''&& lg[0] === '#/hifzmap' && lg[1] && lg[2] && mig''')
NEW = io.open('plans/wip-5.16/ui516.js',encoding='utf-8').read()
u=rep(u,'''  // 5c/5d: the page moves one way only into and out of full screen''', NEW+'''  // 5c/5d: the page moves one way only into and out of full screen''')
io.open(p,'w',encoding='utf-8',newline='\n').write(u); print('ok')
