// Sprint 5 #27 follow-up: a hifz test in the vertical view (turnMode "v") goes on from one page to the next. Logs window.scrollY every frame from the
// page end for ~2.5 s, who called scrollTo/scrollBy, and the direction changes; PASS = one monotonic scroll (<= 4 px jitter).
// Usage: [ED=kfgqpc,shamarly] [PAGES=100,101] [V=1] node vturn_scroll.js
const path = require('path'), W = require('url').pathToFileURL(path.resolve(__dirname, '../../../web') + '/index.html').href;
const { chromium } = require(path.join(require('child_process').execSync('npm root -g', { encoding: 'utf8', shell: true }).trim(), '@playwright/test/node_modules/playwright'));
const EDS = (process.env.ED || 'kfgqpc,shamarly').split(','), PAGES = (process.env.PAGES || '100,101,200').split(',').map(Number);
(async () => {
  const b = await chromium.launch(); let bad = 0;
  for (const ed of EDS) for (const n of PAGES) {
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 } }), p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERR', e.message));
    await p.addInitScript(() => { window.QA_NOFS = true; window.ReciteBridge = { start() {}, stop() {}, setHints() {} };
      window.__sc = []; for (const f of ['scrollTo', 'scrollBy']) { const o = window[f].bind(window); window[f] = function (a, c) { const t = typeof a === 'object' ? a : { left: a, top: c };
        window.__sc.push([Math.round(performance.now()), f, JSON.stringify(t), (new Error().stack.split('\n').slice(2, 4).map(s => (/at (\S+)/.exec(s) || [])[1] + ':' + (/:(\d+):\d+\)?$/.exec(s) || [])[1]).join('<'))]); return o.apply(null, arguments); }; } });
    await p.goto(W); await p.evaluate(([e]) => { localStorage.setItem('q.edition', JSON.stringify(e)); localStorage.setItem('q.mode', '"pages"'); localStorage.setItem('q.micTips', '1'); localStorage.setItem('q.turn', '"v"'); localStorage.removeItem('q.hifzFlip'); }, [ed]); await p.reload(); await p.waitForTimeout(1000);
    await p.evaluate(h => { location.hash = h; }, '#/p/' + n); await p.waitForTimeout(1200);
    await p.evaluate(h => { location.hash = h; }, '#/hifzmap'); await p.waitForTimeout(700);
    await p.evaluate(n => { const s = window.QURAN.p.findIndex(x => x.includes(+n)) + 1, i = window.QURAN.p[s - 1].indexOf(+n); window.hifzTestPages(s, i < 0 ? 1 : i + 1); }, n); await p.waitForTimeout(1500);
    await p.click('#hifzBar [data-c="mic"]'); await p.waitForTimeout(200); await p.evaluate(() => window.onRecite('', 'state:listening'));
    // the words of every ayah that starts on page n (an ayah running on to n+1 is cut at the page end by the app)
    const W1 = await p.evaluate(n => { const Q = window.QURAN, o = []; for (let s = 1; s <= 114; s++) for (let a = 1; a <= Q.s[s - 1][3]; a++) { const r = Q.r[s - 1] && Q.r[s - 1][a - 1]; if (r && r.some(x => x[0] === n)) o.push(Q.t[s - 1][a - 1].split(' ').filter(w => /[ء-يٱ]/.test(w))); } return o; }, n);
    const all = [].concat(...W1); let acc = [];
    for (let i = 0; i < all.length; i++) { acc.push(all[i]); await p.evaluate(t => window.onRecite(t, 'partial'), acc.join(' ')); await p.waitForTimeout(i % 3 ? 20 : 70); }
    // mark the page end: from here the frame trace
    await p.evaluate(() => { window.__t0 = performance.now(); window.__sc.length = 0; window.__tr = []; (function f() { window.__tr.push([Math.round(performance.now() - window.__t0), Math.round(scrollY * 10) / 10]); if (performance.now() - window.__t0 < 2600) requestAnimationFrame(f); })(); });
    await p.evaluate(t => window.onRecite(t, 'final'), acc.join(' ')); await p.waitForTimeout(2900);
    const r = await p.evaluate(() => ({ tr: window.__tr, sc: window.__sc.map(x => [x[0] - Math.round(window.__t0), x[1], x[2], x[3]]), boxes: [...document.querySelectorAll('.page-box')].length }));
    // direction changes with a 4 px dead band
    let dir = 0, last = r.tr[0][1], ch = [], ext = last; for (const [t, y] of r.tr) { if (dir >= 0 && y < ext - 4 && dir !== -1 && ext - y > 4) { if (dir === 1) ch.push([t, 'down->up', y]); dir = -1; ext = y; } else if (dir <= 0 && y > ext + 4) { if (dir === -1) ch.push([t, 'up->down', y]); dir = 1; ext = y; } else if (dir === 1 && y > ext) ext = y; else if (dir === -1 && y < ext) ext = y; }
    const ok = !ch.length; if (!ok) bad++;
    console.log(ed, 'p' + n, ok ? 'PASS' : 'FAIL', 'y0=' + r.tr[0][1], 'yEnd=' + r.tr[r.tr.length - 1][1], 'changes=' + JSON.stringify(ch));
    if (process.env.V || !ok) { console.log('  calls', JSON.stringify(r.sc)); console.log('  trace', r.tr.filter((_, i) => i % 6 === 0).map(x => x.join(':')).join(' ')); }
    await ctx.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
