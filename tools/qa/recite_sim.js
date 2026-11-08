// 5.11 G7: recitation following, simulated — pieces fed through window.onRecite the way NvAsr sends them (a partial =
// the words so far of the piece being heard, then the final). Scenarios: A page turns on a partial at its last word,
// B misheard last word + next page heard -> turns anyway, D a line opens past a misheard word, C reading mode turns at
// the last printed word of an ayah that runs over the page (Shamarly), E reading mode finds a jump after 4 misses,
// F landscape follow, G vertical hifz hides the pages ahead, H decode time reaches the stats.
// Usage: node recite_sim.js [out.json]   (also run from ui.js, group «نسخة 5.11»)
const W = require('url').pathToFileURL(require('path').resolve(__dirname, '../../web') + '/index.html').href;
async function run(b) {
  const out = {};
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.QA_NOFS = true; window.ReciteBridge = { start() {}, stop() {}, setHints() {} }; });
  await p.goto(W); await p.evaluate(() => { localStorage.setItem('q.edition', '"kfgqpc"'); localStorage.setItem('q.mode', '"pages"'); localStorage.setItem('q.micTips', '1'); localStorage.setItem('q.flip', 'false'); localStorage.removeItem('q.hifzFlip'); }); await p.reload(); await p.waitForTimeout(900);
  const ev = (f, a) => p.evaluate(f, a), wait = ms => p.waitForTimeout(ms), go = async (h, ms = 800) => { await ev(h => { location.hash = h; }, h); await wait(ms); };
  // page facts from the edition data: ayat with a rect on page n, and whether the last one runs on to n+1
  const facts = n => ev(n => { const Q = window.QURAN, it = [];
    for (let s = 1; s <= 114; s++) for (let a = 1; a <= Q.s[s - 1][3]; a++) { const r = Q.r[s - 1] && Q.r[s - 1][a - 1]; if (r && r.some(b => b[0] === n)) it.push([s, a, r.some(b => b[0] === n + 1)]); }
    const words = (s, a) => Q.t[s - 1][a - 1].split(' ').filter(w => /[\u0621-\u064A\u0671]/.test(w));
    return { it, w: it.map(([s, a]) => words(s, a)) }; }, n);
  const say = (t, k) => ev(([t, k]) => window.onRecite(t, k), [t, k]);
  // find a page whose last ayah ends on it, and one whose last ayah runs over
  let whole = null, split = null;
  for (let n = 100; n < 200 && (!whole || !split); n++) { const f = await facts(n); const last = f.it[f.it.length - 1]; if (!last[2] && !whole && f.it.length >= 3 && !f.it[0][2]) whole = n; if (last[2] && !split && f.w[f.w.length - 1].length >= 8) split = n; }
  out.pages = { whole, split };

  // A) recite: the page turns on a PARTIAL at its last word
  const startTest = async n => { await go('#/hifzmap', 700); await p.click('.hm-grid .hm-c[data-p="' + n + '"]'); await wait(250); await p.click('#hzMus'); await wait(1300); await p.click('#hifzBar [data-c="mic"]'); await wait(200); await say('', 'state:listening'); };
  const stopTest = () => ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); });
  {
    const f = await facts(whole); await startTest(whole);
    const own = f.it.map((x, i) => [x, f.w[i]]).filter(([x]) => x[0] * 1000 + x[1] >= f.it[0][0] * 1000 + f.it[0][1]);
    const all = own.flatMap(([, w]) => w); const half = all.slice(0, Math.floor(all.length / 2));
    await say(half.join(' '), 'partial'); await wait(100);
    const t0 = Date.now(); await say(all.join(' '), 'partial');
    let h = ''; for (let i = 0; i < 40; i++) { h = await ev(() => location.hash); if (h.startsWith('#/p/' + (whole + 1))) break; await wait(25); }
    out.A = { hash: h, ms: Date.now() - t0, want: '#/p/' + (whole + 1) };
    await say(all.join(' '), 'final'); await wait(300); await stopTest(); await wait(300);
  }
  // B) recite: last word misheard, the reader goes on into the next page -> turn anyway
  {
    const f = await facts(whole), f2 = await facts(whole + 1); await startTest(whole);
    const all = f.w.flatMap(w => w); all[all.length - 1] = 'زززز';
    const nx = f2.w[f2.it.findIndex(x => !(x[0] === f.it[f.it.length - 1][0] && x[1] === f.it[f.it.length - 1][1]))].slice(0, 3);
    await say(all.join(' '), 'partial'); await wait(400); const mid = await ev(() => location.hash);
    await say(all.concat(nx).join(' '), 'partial');
    let h = ''; for (let i = 0; i < 40; i++) { h = await ev(() => location.hash); if (h.startsWith('#/p/' + (whole + 1))) break; await wait(25); }
    out.B = { mid, hash: h, want: '#/p/' + (whole + 1) };
    await say(all.concat(nx).join(' '), 'final'); await wait(300); await stopTest(); await wait(300);
  }
  // D) a line opens past a misheard word (partial): same masks as with the word right
  {
    const f = await facts(whole); const masks = async bad => { await startTest(whole);
      const w = f.w[0].concat(f.w[1]); const cut = w.slice(0, f.w[0].length + Math.floor(f.w[1].length / 2)); if (bad) cut[2] = 'زززز';
      await say(cut.join(' '), 'partial'); await wait(300); const n = await ev(() => document.querySelectorAll('.hifz-mask').length); await say('', 'state:stopped'); await stopTest(); await wait(300); return n; };
    out.D = { right: await masks(false), misheard: await masks(true) };
  }
  // C) reading mode: an ayah running over the page turns the page at its last printed word
  {
    await ev(() => localStorage.setItem('q.edition', '"shamarly"')); await p.reload(); await wait(1200);
    for (let n = 100; n < 300 && !split; n++) { const f = await facts(n); const last = f.it[f.it.length - 1]; if (last && last[2] && f.w[f.w.length - 1].length >= 8) split = n; }
    out.pages.split = split;
    const f = await facts(split); const last = f.w[f.w.length - 1], li = f.it.length - 1;
    await go('#/p/' + split, 900); await p.click('#rdMic'); await wait(200); await say('', 'state:listening');
    const prev = f.w[li - 1] || []; await say(prev.slice(-4).concat(last.slice(0, 3)).join(' '), 'partial'); await wait(200);
    const loc = await ev(() => (document.querySelector('.rd-cap small') || {}).textContent || '');
    let h = await ev(() => location.hash);
    await say(prev.slice(-4).concat(last).join(' '), 'partial');
    for (let i = 0; i < 40; i++) { h = await ev(() => location.hash); if (h.startsWith('#/p/' + (split + 1))) break; await wait(25); }
    await wait(300); const lit = await ev(() => document.querySelectorAll('.ayah-box').length);
    out.C = { loc, hash: h, want: '#/p/' + (split + 1), lit };
    await say(prev.slice(-4).concat(last).join(' '), 'final'); await wait(200); await p.click('#rdMic'); await wait(200);
  await ev(() => localStorage.setItem('q.edition', '"kfgqpc"')); await p.reload(); await wait(1000);
  }
  // E) reading mode: jump elsewhere -> found again after 4 misses (not 8)
  {
    await go('#/p/42', 900); await p.click('#rdMic'); await wait(200); await say('', 'state:listening');
    const A = await ev(() => window.QURAN.t[1][254].split(' ')), B = await ev(() => window.QURAN.t[1][257].split(' ').filter(w => /[\u0621-\u064A\u0671]/.test(w)));
    await say(A.slice(0, 16).join(' '), 'final'); await wait(300);
    const at1 = await ev(() => (document.querySelector('.rd-cap small') || {}).textContent || '');
    await say(B.slice(0, 9).join(' '), 'partial'); await wait(500); out.E5 = await ev(() => (document.querySelector('.rd-cap small') || {}).textContent || '');
    out.E = { at1, at2: await ev(() => (document.querySelector('.rd-cap small') || {}).textContent || ''), hash: await ev(() => location.hash) };
    await say(B.slice(0, 9).join(' '), 'final'); await p.click('#rdMic'); await wait(200);
  }
  // F) landscape: reading mode keeps the word in view
  {
    await p.setViewportSize({ width: 844, height: 390 }); await go('#/p/50', 1200); await ev(() => window.scrollTo(0, 0));
    const f = await facts(50); const k = f.it.length - 2;
    await p.click('#rdMic'); await wait(200); await say('', 'state:listening');
    await say(f.w[k].slice(0, 6).join(' '), 'partial'); await wait(900);
    out.F = await ev(() => { const w = document.querySelector('.rd-word'); return w ? { top: Math.round(w.getBoundingClientRect().top), ih: innerHeight, sy: Math.round(scrollY) } : null; });
    await say(f.w[k].slice(0, 6).join(' '), 'final'); await p.click('#rdMic'); await wait(200); await p.setViewportSize({ width: 390, height: 844 });
  }
  // G) vertical hifz hides the pages after the one being recited
  {
    await ev(() => localStorage.setItem('q.turn', '"v"')); await p.reload(); await wait(900);
    await go('#/hifzmap', 700); await p.click('.hm-grid .hm-c[data-p="50"]'); await wait(250); await p.click('#hzMus'); await wait(1800);
    out.G = await ev(() => { const st = document.getElementById('vhzSt'), c = [...document.querySelectorAll('.vp-c')], i = c.findIndex(x => x.querySelector('.page-box[data-p="51"]'));
      const img = c[i] && c[i].querySelector('img'); return { css: st && st.textContent, after: img && getComputedStyle(img).visibility, own: getComputedStyle(c[i - 1].querySelector('img')).visibility }; });
    await stopTest(); await wait(300); out.G.off = await ev(() => (document.getElementById('vhzSt') || {}).textContent);
    await ev(() => localStorage.removeItem('q.turn'));
  }
  // I) words test (#/hifztest, 5.11 phone #11/#12): the text follows the reader; with «قلب تلقائي» the last word heard on a
  // PARTIAL opens the next ayat with the mic still on (the rest of that piece skipped); off, the test ends with the score
  {
    const W2 = (from, to) => ev(([f, t]) => { const o = []; for (let a = f; a <= t; a++) o.push(...window.QURAN.t[1][a - 1].split(' ').filter(w => /[ء-يٱ]/.test(w))); return o; }, [from, to]);
    const words = await W2(1, 10), nx = await W2(11, 11);
    await ev(() => { localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 25, s: 2, from: 1 })); localStorage.setItem('q.hifzFlip', 'true'); }); await go('#/hifztest/2', 900);
    const flipBtn = await ev(() => !document.getElementById('htFlip'));   // 5.15b: no toggle inside a test
    await p.click('#htMic'); await wait(200); await say('', 'state:listening');
    const top0 = await ev(() => Math.round(document.querySelector('.ht-text').getBoundingClientRect().top));
    await say(words.slice(0, Math.floor(words.length * 0.8)).join(' '), 'partial'); await wait(700);
    const fol = await ev(() => { const ok = [...document.querySelectorAll('.ht-text .ht-v, .ht-text .ht-w')]; const e = ok[Math.floor(ok.length * 0.8)]; const r = e.getBoundingClientRect(); return [Math.round(r.top), innerHeight]; });
    await say(words.join(' '), 'partial'); await wait(400);
    const moved = await ev(() => [JSON.parse(localStorage.getItem('q.hifzTest')).from, document.querySelector('#htMic').classList.contains('rec'), document.querySelector('.ht-text [data-a="11"]') ? 1 : 0]);
    await say(words.concat(nx).join(' '), 'partial'); await wait(200);
    const nxOk = await ev(() => { const w = [...document.querySelectorAll('.ht-text [data-a="11"]')]; return [w.filter(e => e.classList.contains('ht-w')).length, w.filter(e => e.classList.contains('ht-w') && e.classList.contains('ok')).length, document.querySelectorAll('.ht-text .ht-w.miss').length]; });
    await say(words.concat(nx).join(' '), 'final'); await wait(200);
    await p.click('#htMic'); await wait(200);
    // off: the end of the part ends the test with the score
    await ev(() => { localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 25, s: 2, from: 1 })); localStorage.setItem('q.hifzFlip', 'false'); }); await go('#/hifzmap', 500); await go('#/hifztest/2', 900);
    await p.click('#htMic'); await wait(200); await say('', 'state:listening'); await say(words.join(' '), 'partial'); await wait(300);
    const off = await ev(() => [JSON.parse(localStorage.getItem('q.hifzTest')).from, document.querySelector('#htMic').classList.contains('rec'), document.getElementById('htRes').textContent]);
    if (off[1]) { await p.click('#htMic'); await wait(200); }
    await ev(() => localStorage.removeItem('q.hifzFlip'));
    out.I = { flipBtn, top0, fol, moved, nxOk, off };
  }
  // H) decode time reaches the stats
  await ev(() => { window.nvMs = 420; window.nvLen = 3000; window.onRecite('بسم الله', 'partial'); });
  out.H = await ev(() => { const S = JSON.parse(localStorage.getItem('q.asrStats') || '{}'), d = Object.values(S).pop() || {}; return [d.dms, d.dn, d.dlen]; });
  out.errs = errs;
  await ctx.close();
  return out;
}
module.exports = { run };
if (require.main === module) {
  const path = require('path'), cp = require('child_process'); let pw;
  try { pw = require('playwright'); } catch (e) { const root = cp.execSync('npm root -g', { encoding: 'utf8', shell: true }).trim(); pw = require(path.join(root, '@playwright/test/node_modules/playwright')); }
  (async () => { const b = await pw.chromium.launch(); const o = await run(b); await b.close(); const f = process.argv[2]; if (f) require('fs').writeFileSync(f, JSON.stringify(o, null, 1)); else console.log(JSON.stringify(o)); })().catch(e => { console.error(e); process.exit(1); });
}
