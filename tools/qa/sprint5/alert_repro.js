// Sprint 5 #28: errAlert (a run of 5+ consecutive wrong/skipped words incl. one wrong) / skipAlert buzz; prints PASS/FAIL per case. Pieces go through window.onRecite
// like NvAsr; AppBridge.buzzPattern is stubbed to log (pattern, which step). Usage: node alert_repro.js [edition]
const W = require('url').pathToFileURL(require('path').resolve(__dirname, '../../../web') + '/index.html').href;
const ED = process.argv[2] || 'kfgqpc', BAD = 'زززز';
(async () => {
  const { chromium } = require(require('path').join(require('child_process').execSync('npm root -g',{encoding:'utf8',shell:true}).trim(),'@playwright/test/node_modules/playwright'));
  const b = await chromium.launch(); const res = {};
  async function fresh() {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }), p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERR', e.message));
    await p.addInitScript(() => { window.QA_NOFS = true; window.__buzz = []; window.__cur = '-'; window.ReciteBridge = { start() {}, stop() {}, setHints() {} };
      window.AppBridge = { buzzPattern(x) { window.__buzz.push([x, window.__cur]); }, buzz() {}, tick() {} }; });
    await p.goto(W); await p.evaluate(ed => { localStorage.setItem('q.edition', JSON.stringify(ed)); localStorage.setItem('q.mode', '"pages"'); localStorage.setItem('q.micTips', '1'); }, ED); await p.reload(); await p.waitForTimeout(900);
    return p;
  }
  const facts = (p, n) => p.evaluate(n => { const Q = window.QURAN, it = [];
    for (let s = 1; s <= 114; s++) for (let a = 1; a <= Q.s[s - 1][3]; a++) { const r = Q.r[s - 1] && Q.r[s - 1][a - 1]; if (r && r.some(b => b[0] === n)) it.push([s, a, r.some(b => b[0] === n + 1), r.some(b => b[0] === n - 1)]); }
    const words = (s, a) => Q.t[s - 1][a - 1].split(' ').filter(w => /[\u0621-\u064A\u0671]/.test(w));
    return { it, w: it.map(([s, a]) => words(s, a)) }; }, n);
  async function pickPage(p) { for (let n = 30; n < 300; n++) { const f = await facts(p, n); if (f.it.length >= 3 && !f.it[0][3] && !f.it[0][2] && !f.it[1][2] && f.w[0].length >= 14 && f.w[1].length >= 8) return [n, f]; } }
  async function start(p, n) { await p.evaluate(h => { location.hash = h; }, '#/hifzmap'); await p.waitForTimeout(700);
    await p.evaluate(n => { const s = window.QURAN.p.findIndex(a => a.includes(+n)) + 1, i = window.QURAN.p[s - 1].indexOf(+n); window.hifzTestPages(s, i < 0 ? 1 : i + 1); }, n); await p.waitForTimeout(1300);
    await p.click('#hifzBar [data-c="mic"]'); await p.waitForTimeout(200); await p.evaluate(() => window.onRecite('', 'state:listening')); }
  const say = async (p, label, t, k) => { await p.evaluate(([l, t, k]) => { window.__cur = l; window.onRecite(t, k); }, [label, t, k]); await p.waitForTimeout(120);
    if (process.env.DBG) console.log('  step', label, k, JSON.stringify(await p.evaluate(() => ({ capBad: document.querySelectorAll('.rd-cap .rc-bad').length, capWords: (document.querySelector('.rd-cap div') || { textContent: '' }).textContent.split(' ').length, skipBoxes: document.querySelectorAll('.rc-skipw').length, badBoxes: document.querySelectorAll('.rc-badw').length, buzz: window.__buzz.length, disp: window.__rc && Object.keys(window.__rc.disp||{}).map(k => k.split(':')[2] + '=' + window.__rc.disp[k]).join(','), skp: window.__rc && Object.keys(window.__rc.skp||{}).map(k => k.split(':')[2]).join(',') })))); };
  const buzz = p => p.evaluate(() => window.__buzz.map(x => x[0] + '@' + x[1]).join(' | ') || 'none');
  const stop = async p => { await p.evaluate(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); }); await p.waitForTimeout(300); };
  const bad = n => Array(n).fill(BAD);
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const cases = {
    a: async (p, f) => { const w = f.w[0], x = w.slice(0, 4).concat(bad(5), w.slice(9)); await say(p, 'final1', x.join(' '), 'final'); },
    a2: async (p, f) => { const w = f.w[0], x = w.slice(0, 4).concat(bad(5), w.slice(9)); await say(p, 'partial', x.join(' '), 'partial'); await say(p, 'final', x.join(' '), 'final'); },
    b: async (p, f) => { const w = f.w[0], x = w.slice(0, 4).concat(bad(6), w.slice(10)); await say(p, 'final1', x.join(' '), 'final'); },
    b2: async (p, f) => { const w = f.w[0], x = w.slice(0, 4).concat(bad(6), w.slice(10)); await say(p, 'partial', x.join(' '), 'partial'); await say(p, 'final', x.join(' '), 'final'); },
    c: async (p, f) => { const w = f.w[0]; await say(p, 'f1(2bad)', w.slice(0, 3).concat(bad(2)).join(' '), 'final'); await p.waitForTimeout(300);
      await say(p, 'f2(2bad)', bad(2).join(' '), 'final'); await p.waitForTimeout(300); await say(p, 'f3(1bad)', BAD, 'final'); await p.waitForTimeout(300); await say(p, 'f4(rest)', w.slice(8).join(' '), 'final'); },
    d: async (p, f) => { const w = f.w[0], x = w.slice(0, 3).concat(bad(4), [w[7]], [BAD], w.slice(9)); await say(p, 'final1', x.join(' '), 'final'); },
    e: async (p, f) => { const A = f.w[0], B = f.w[1], x = A.slice(0, -3).concat(bad(3), bad(3), B.slice(3)); await say(p, 'final1', x.join(' '), 'final'); },
    f: async (p, f) => { const w = f.w[0], x = w.slice(0, 4).concat(bad(5)); await say(p, 'partial', x.join(' '), 'partial'); await say(p, 'final', x.join(' '), 'final'); await say(p, 'stopped', '', 'state:stopped'); await p.waitForTimeout(400); },
    f2: async (p, f) => { const w = f.w[0], x = w.slice(0, 4).concat(bad(5)); await say(p, 'partial', x.join(' '), 'partial'); await say(p, 'stopped', '', 'state:stopped'); await say(p, 'tailfinal', x.join(' '), 'final'); await p.waitForTimeout(400); },
    c6: async (p, f) => { const w = f.w[0]; await say(p, 'f1(2bad)', w.slice(0, 3).concat(bad(2)).join(' '), 'final'); await p.waitForTimeout(300);
      await say(p, 'f2(2bad)', bad(2).join(' '), 'final'); await p.waitForTimeout(300); await say(p, 'f3(2bad)', bad(2).join(' '), 'final'); await p.waitForTimeout(300); await say(p, 'f4(rest)', w.slice(9).join(' '), 'final'); },
    d6: async (p, f) => { const w = f.w[0], x = w.slice(0, 3).concat(bad(4), [w[7]], bad(2), w.slice(10)); await say(p, 'final1', x.join(' '), 'final'); },
    f6: async (p, f) => { const w = f.w[0], x = w.slice(0, 4).concat(bad(6)); await say(p, 'partial', x.join(' '), 'partial'); await say(p, 'final', x.join(' '), 'final'); await say(p, 'stopped', '', 'state:stopped'); await p.waitForTimeout(400); },
    // h: skip of 6 (words 4-9 left out, 5 words after it) in piece 1, then 6 wrong words (15-20) + the rest right in piece 2, same ayah
    h: async (p, f) => { const w = f.w[0]; await say(p, 'f1(skip6)', w.slice(0, 5).concat(w.slice(11, 16)).join(' '), 'final'); await p.waitForTimeout(300);
      await say(p, 'f2(6bad+rest)', bad(6).concat(w.slice(22)).join(' '), 'final'); },
    // same piece: skip 6 and 6 wrong together
    h1: async (p, f) => { const w = f.w[0]; await say(p, 'f1(skip6+6bad+rest)', w.slice(0, 4).concat(w.slice(10, 15), bad(6), w.slice(21)).join(' '), 'final'); },
    // reverse order: 6 wrong first (piece 1), skip 6 afterwards (piece 2)
    h2: async (p, f) => { const w = f.w[0]; await say(p, 'f1(6bad)', w.slice(0, 2).concat(bad(6), w.slice(8, 10)).join(' '), 'final'); await p.waitForTimeout(300);
      await say(p, 'f2(skip6+rest)', w.slice(16).join(' '), 'final'); },
    // i: a pure skip of 6 words, no wrong word: skipAlert only
    i: async (p, f) => { const w = f.w[0]; await say(p, 'f1(skip6)', w.slice(0, 5).concat(w.slice(11)).join(' '), 'final'); },
    // j: errAlert setting off (q.errAlert=false), case b
    i2: async (p, f) => { const w = f.w[0], x = w.slice(0, 5).concat(w.slice(11)).join(' '); await say(p, 'partial', x, 'partial'); await say(p, 'final', x, 'final'); },
    j: async (p, f) => { await p.evaluate(() => localStorage.setItem('q.errAlert', 'false')); await cases.b(p, f); },
  };
  const ERR = '300,120,300', SKP = '120,60,120', cnt = (bz, pat, lab) => bz.filter(x => x[0] === pat && (!lab || x[1] === lab)).length;
  const perStep = bz => { const m = {}; bz.forEach(x => (m[x[1]] = m[x[1]] || []).push(x[0] === ERR ? 'E' : x[0] === SKP ? 'S' : '?')); return m; };
  // expectations: [description, fn(bz) -> bool]
  const exp = {
    a: ['5 wrong -> ERR once', bz => cnt(bz, ERR) === 1],
    b: ['6 wrong -> ERR once', bz => cnt(bz, ERR) === 1],
    c: ['5 wrong over short finals -> ERR', bz => cnt(bz, ERR) === 1],
    d: ['4 wrong,1 right,1 wrong -> no ERR', bz => cnt(bz, ERR) === 0],
    e: ['3 wrong end N + 3 wrong start N+1 -> ERR', bz => cnt(bz, ERR) >= 1],
    f: ['5 wrong then stop before ayah end -> ERR', bz => cnt(bz, ERR) >= 1],
    h: ['skip 6 then 6 wrong: at most one alert per step (>=1 overall), never skip+ERR in a step', bz => { const m = perStep(bz); return Object.keys(m).length >= 1 && Object.values(m).every(v => v.length === 1); }],
    i: ['pure skip 5+ -> skipAlert only', bz => cnt(bz, SKP) >= 1 && cnt(bz, ERR) === 0],
    j: ['errAlert off -> no ERR', bz => cnt(bz, ERR) === 0],
  };
  for (const [name, fn] of Object.entries(cases)) {
    if (only && !only.includes(name)) continue;
    const p = await fresh(); const [n, f] = await pickPage(p); await start(p, n); await fn(p, f); await p.waitForTimeout(500);
    const bz = await p.evaluate(() => window.__buzz);
    res[name] = { page: n, buzz: await buzz(p), steps: JSON.stringify(perStep(bz)) }; if (exp[name]) res[name].verdict = (exp[name][1](bz) ? 'PASS' : 'FAIL') + ' - ' + exp[name][0]; await stop(p); await p.context().close();
  }
  if (only && !only.includes('g')) { await b.close(); console.log(ED, JSON.stringify(res)); return; }
  // g: case b twice in the same page load (two tests)
  { const p = await fresh(); const [n, f] = await pickPage(p); const o = [];
    for (let t = 0; t < 2; t++) { await start(p, n); await cases.b(p, f); await p.waitForTimeout(500); o.push((await buzz(p)) + ' bad=' + await p.evaluate(() => document.querySelectorAll('.rc-bad').length)); await say(p, 'stopped', '', 'state:stopped'); await stop(p); }
    // second test on the next page (different ayah) in the same load
    const bzs = await p.evaluate(() => window.__buzz); const e = bzs.filter(x => x[0] === ERR).length;
    res.g = { page: n, afterTest1_2: o, ERR: e, verdict: (e === 2 ? 'PASS' : 'FAIL') + ' - case b in two tests of one load -> ERR in both' }; await p.context().close(); }
  console.log(ED, JSON.stringify(res, null, 1)); await b.close();
})();
