// 5.11 G2 5c/5d: how the mushaf page moves on screen while full screen comes in or goes out.
// Records, every animation frame, the on-screen top of the page being read = its CSS top + the WebView's top inset
// (the status bar, which immersive() takes away), for entry/exit x horizontal/vertical x auto/manual.
// Pass = the motion goes one way only (±1 px) and it never moves more than 15 px per 16.7 ms.
// 5.35 #19: the same for the VISIBLE page rect (box minus crop) with the full screen size mode stretch / text: entry, exit and a pinch step
// inside full screen. Pass = every edge moves one way (±1 px), no jump (the step never changes by more than 2 px between two frames, time
// normalised: the easing speeds up and slows down smoothly, so its own change of speed (up to 0.3 x the peak speed) is not a jump, a discontinuity is)
// and the last frame is exactly the settled rect. Positions are screen positions (the WebView's top inset added), like the older cases.
//   headless:  node measure.js [out.json]                 (411x866 -> 411x914 like Phone_API35, fake AppBridge)
//   emulator:  CDP=http://localhost:9222 node measure.js out.json   (a test-only build with WebView debugging on)
function loadPW() {
  try { return require('playwright'); } catch (e) {}
  const path = require('path'), cp = require('child_process');
  let root = ''; try { root = cp.execSync('npm root -g', { encoding: 'utf8', shell: true }).trim(); } catch (e) {}
  for (const c of [root, process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules')].filter(Boolean))
    for (const sub of ['playwright', 'playwright-core', '@playwright/test/node_modules/playwright', '@playwright/test/node_modules/playwright-core'])
      try { return require(path.join(c, sub)); } catch (e) {}
  throw new Error('playwright not found');
}
const CDP = process.env.CDP, ED = process.env.ED || 'kfgqpc';
const W0 = 411, H0 = 866, ST = 24, NB = 24;   // Phone_API35: 1080x2400 @420 dpi, status + navigation bar 63 px = 24 css px each
const W = require('url').pathToFileURL(require('path').resolve(__dirname + '/../../../web') + '/index.html').href;
const sleep = ms => new Promise(f => setTimeout(f, ms));

// in the page: a fake AppBridge (headless only) and the per-frame recorder
function fake(cfg) {
  if (window.AppBridge && !window.AppBridge.__fake) return;
  let imm = false;
  window.AppBridge = { __fake: true,
    immersive(on) { if (on === imm) return; imm = on; setTimeout(() => window.qaResize(on), cfg.lag); },   // the system bars go ~60 ms later
    insets() { return imm ? '0,0,0,0' : cfg.st + ',' + cfg.nb + ',0,0'; } };
}
function recorder() {
  window.__rec = { s: [], on: false };
  const R = window.__rec;
  function pick() {
    const vb = document.querySelectorAll('.page-box.vp');
    if (vb.length) { for (const b of vb) if (b.getBoundingClientRect().bottom > 80) return b.parentNode; }
    return document.querySelector('#view .page-wrap .page-box');
  }
  // the part of the box that shows: its rect minus the crop fractions (what the user sees as "the page")
  function vis(el) {
    if (!el || !el.isConnected) return [NaN, NaN, NaN, NaN];
    // the crop as drawn NOW: the computed clip-path (it glides with the box in a size mode change), not the --c* variables (those jump to the end value)
    const r = el.getBoundingClientRect(), m = /^inset\((.*)\)$/.exec(getComputedStyle(el).clipPath);
    let t = 0, rt = 0, b = 0, l = 0;
    if (m) { const n = m[1].split(/\s+/).map(x => (parseFloat(x) || 0) / 100); [t, rt, b, l] = n.length === 1 ? [n[0], n[0], n[0], n[0]] : n.length === 2 ? [n[0], n[1], n[0], n[1]] : n.length === 3 ? [n[0], n[1], n[2], n[1]] : n; }
    return [r.left + l * r.width, r.top + t * r.height, r.right - rt * r.width, r.bottom - b * r.height].map(v => +v.toFixed(2));
  }
  function box(el) { if (!el || !el.isConnected) return [NaN, NaN, NaN, NaN]; const r = el.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(v => +v.toFixed(2)); }
  R.vis = () => vis(R.el).concat(box(R.el));   // the settled rects: visible [0-3] and the whole box (the picture) [4-7]
  R.start = () => { R.s = []; R.el = pick(); R.on = true; R.t0 = performance.now(); R.fsAt = null; R.fs0 = document.body.classList.contains('fs');
    const loop = () => { if (!R.on) return; const r = R.el && R.el.isConnected ? R.el.getBoundingClientRect() : { top: NaN, width: NaN };
      const fs = document.body.classList.contains('fs'); if (R.fsAt === null && fs !== R.fs0) R.fsAt = performance.now() - R.t0;
      R.s.push([+(performance.now() - R.t0).toFixed(1), +r.top.toFixed(2), +r.width.toFixed(2), innerHeight, fs ? 1 : 0].concat(vis(R.el), box(R.el))); requestAnimationFrame(loop); };
    requestAnimationFrame(loop); };
  R.stop = () => { R.on = false; return { s: R.s, fsAt: R.fsAt, p: R.el && R.el.dataset.p }; };
}
function analyse(rec, hBig, topN, topF) {
  // screen top = css top + the WebView's top inset (status bar + cutout while it is the small one, the cutout in full screen)
  const pts = rec.s.filter(x => rec.fsAt !== null && x[0] >= rec.fsAt - 40 && x[0] <= rec.fsAt + 1300 && !isNaN(x[1]));
  const y = pts.map(x => x[1] + (x[3] < hBig - 10 ? topN : topF)), w = pts.map(x => x[2]);
  // a step per 16.7 ms of time, so a dropped frame (the emulator's software GPU skips some) is not taken for a jump
  const d = [], dv = []; for (let i = 1; i < y.length; i++) { d.push(+(y[i] - y[i - 1]).toFixed(2)); dv.push(d[i - 1] / Math.max(1, (pts[i][0] - pts[i - 1][0]) / 16.7)); }
  const big = d.filter(v => Math.abs(v) > 1), up = big.filter(v => v < 0).length, dn = big.filter(v => v > 0).length;
  const wd = []; for (let i = 1; i < w.length; i++) wd.push(Math.abs(w[i] - w[i - 1]));
  const maxRaw = d.reduce((m, v) => Math.max(m, Math.abs(v)), 0), maxStep = dv.reduce((m, v) => Math.max(m, Math.abs(v)), 0), maxW = wd.reduce((m, v) => Math.max(m, v), 0);
  const ok = rec.fsAt !== null && (up === 0 || dn === 0) && maxStep <= 15 && maxW <= 15;
  return { ok, fsAt: rec.fsAt, from: y[0], to: y[y.length - 1], up, down: dn, maxStep: +maxStep.toFixed(1), maxRawStep: +maxRaw.toFixed(1), maxWidthStep: +maxW.toFixed(1), frames: y.length,
    t: pts.map(x => +(x[0] - rec.fsAt).toFixed(0)), y: y.map(v => +v.toFixed(1)), w: w.map(v => +v.toFixed(1)) };
}

// The visible rect [l, t, r, b] (columns 5-8 of a sample) and the whole box = the picture (columns 9-12), sampled per frame:
// `from` = the first time that counts (ms from start). Both must glide without a jump; the picture also moves when only the crop changes.
// Screen y = client y + the WebView's top inset (status bar while the small WebView, the cutout in full screen), as in analyse().
function analyseRect(rec, from, settled, expect, hBig, topN, topF) {
  const off = x => x[3] < hBig - 10 ? topN : topF, Y = new Set([1, 3, 5, 7]);
  const pts = rec.s.filter(x => x[0] >= from && !isNaN(x[5])).map(x => x.map((v, k) => k >= 5 && Y.has(k - 5) ? v + off(x) : v)), last = pts[pts.length - 1];
  if (last) settled = settled.map((v, k) => Y.has(k) ? v + off(last) : v);
  const edges = [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const v = pts.map(x => x[5 + i]), d = [], dv = [];
    for (let k = 1; k < v.length; k++) { d.push(v[k] - v[k - 1]); dv.push(d[k - 1] / Math.max(1, (pts[k][0] - pts[k - 1][0]) / 16.7)); }
    const up = d.filter(x => x < -1).length, dn = d.filter(x => x > 1).length;
    const jump = dv.reduce((m, x, k) => k ? Math.max(m, Math.abs(x - dv[k - 1])) : m, 0), peak = dv.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    return { one: up === 0 || dn === 0, jump: +jump.toFixed(2), peak: +peak.toFixed(1), from: v[0], to: v[v.length - 1] }; });
  const end = last ? last.slice(5, 13).map((v, i) => Math.abs(v - settled[i])) : [NaN], exp = expect && last ? last.slice(5, 9).map((v, i) => Math.abs(v - expect[i])) : [0];
  const moved = edges.some(e => Math.abs(e.to - e.from) > 3);
  const ok = !!last && moved && edges.every(e => e.one && e.jump <= Math.max(2, 0.3 * e.peak)) && Math.max(...end) <= 0.5 && Math.max(...exp) <= 2;
  return { ok, moved, edges, endErr: +Math.max(...end).toFixed(2), expErr: +Math.max(...exp).toFixed(2), settled, frames: pts.length };
}

// raw CDP on the WebView (Playwright's connectOverCDP does not take an Android WebView)
async function cdpPage(url) {
  const list = await (await fetch(url + '/json')).json(), tg = list.find(x => /index\.html/.test(x.url)) || list[0];
  const ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((f, r) => { ws.onopen = f; ws.onerror = r; });
  let id = 0; const waiting = {};
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && waiting[d.id]) { waiting[d.id](d); delete waiting[d.id]; } };
  const send = (method, params) => new Promise(f => { const i = ++id; waiting[i] = f; ws.send(JSON.stringify({ id: i, method, params })); });
  return { cdp: true, close: async () => ws.close(),
    evaluate: async (f, a) => { const d = await send('Runtime.evaluate', { expression: '(' + f + ')(' + JSON.stringify(a === undefined ? null : a) + ')', awaitPromise: true, returnByValue: true });
      if (d.result && d.result.exceptionDetails) throw new Error(JSON.stringify(d.result.exceptionDetails).slice(0, 300)); return d.result && d.result.result ? d.result.result.value : undefined; } };
}
// a page like Phone_API35 (411x866, the system bars give 24 + 24 px), with a fake AppBridge whose immersive() resizes it
async function headlessPage(browser, lag) {
  const ctx = await browser.newContext({ viewport: { width: W0, height: H0 }, deviceScaleFactor: 2.625 });
  const p = await ctx.newPage();
  await p.exposeFunction('qaResize', on => p.setViewportSize({ width: W0, height: on ? H0 + ST + NB : H0 }));
  await p.addInitScript(fake, { lag: lag === undefined ? 60 : lag, st: ST, nb: NB });
  await p.goto(W);
  await p.evaluate(ed => { localStorage.clear(); localStorage.setItem('q.edition', JSON.stringify(ed)); localStorage.setItem('q.micTips', '1'); localStorage.setItem('q.mode', '"pages"'); }, ED);
  await p.reload(); await sleep(1200);
  p.close2 = () => ctx.close();
  return p;
}
// the 8 cases: entry/exit x h/v x auto/manual -> { ins, res: { name: analyse(...) } }
async function measureAll(p, log) {
  const CDPM = !!p.cdp, ev = (f, a) => p.evaluate(f, a);
  const hBig = CDPM ? await ev(() => screen.height) : H0 + ST + NB;
  // the real insets on the emulator (AppBridge.insets: top, bottom, top and bottom in full screen)
  const ins = CDPM ? (await ev(() => window.AppBridge && AppBridge.insets ? AppBridge.insets() : '')).split(',').map(Number) : [ST, NB, 0, 0];
  if (log) console.log('insets', ins.join(','), 'screen', hBig);
  const res = {};
  const setTurn = async t => { await ev(t => { localStorage.setItem('q.mode', '"pages"'); localStorage.setItem('q.turn', JSON.stringify(t)); location.hash = '#/'; }, t); await sleep(500);
    if (!CDPM) { await p.reload(); await sleep(1000); } else { await ev(() => location.reload()); await sleep(2500); } };
  const isFs = () => ev(() => document.body.classList.contains('fs'));
  const waitFs = async v => { for (let i = 0; i < 80; i++) { if (await isFs() === v) return true; await sleep(100); } return false; };
  const tapPage = () => ev(() => { const vb = [...document.querySelectorAll('.page-box.vp')].find(b => b.getBoundingClientRect().bottom > innerHeight / 2) || document.querySelector('#view .page-wrap .page-box');
    const a = document.getElementById("ayahBar"); if (a) a.remove(); vb.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  const run = async (name, trigger, ms) => {
    await ev(recorder); await ev(() => window.__rec.start()); await trigger(); await sleep(ms);
    const r = await ev(() => window.__rec.stop()); res[name] = analyse(r, hBig, ins[0], ins[2]); res[name].page = r.p;
    if (log) console.log(name.padEnd(22), res[name].ok ? 'PASS' : 'FAIL', 'from', res[name].from, 'to', res[name].to, 'up', res[name].up, 'down', res[name].down, 'maxStep', res[name].maxStep, 'maxW', res[name].maxWidthStep);
  };
  for (const t of ['h', 'v']) {
    await setTurn(t);
    await ev(() => { window.QA_NOFS = false; });
    // auto: open the mushaf and touch nothing (full screen after 5 s)
    // from a non-home screen: back from a mushaf opened from home goes straight home (pgFromHome), so only here back = leave full screen
    await run(t + ' entry auto', async () => { await ev(() => { location.hash = '#/more'; }); await sleep(500); await ev(() => { location.hash = '#/p/50'; }); await sleep(800); await ev(() => window.__rec.start()); }, 6200);
    await run(t + ' exit back', () => ev(() => qBack()), 1600);
    await sleep(600);
    // manual: a tap on the page (full screen 1.2 s later), a tap again to leave
    await run(t + ' entry manual', tapPage, 2800);
    await waitFs(true);
    await run(t + ' exit manual', tapPage, 1600);
    await sleep(800);
  }
  // 5.35 #19: the visible page rect while full screen comes in / goes out and while the size mode steps, for stretch and text (horizontal turning)
  const pinchEv = (x1, x2, a, b) => ev(([x1, x2, a, b]) => { const t = document.querySelector('.page-box'), y = 400;
    const mk = (type, id, x) => t.dispatchEvent(new PointerEvent(type, { pointerId: id, isPrimary: id === 1, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
    mk('pointerdown', 1, x1); mk('pointerdown', 2, x2);
    for (let i = 1; i <= 5; i++) { mk('pointermove', 1, x1 + (a - x1) * i / 5); mk('pointermove', 2, x2 + (b - x2) * i / 5); }
    mk('pointerup', 2, b); mk('pointerup', 1, a); }, [x1, x2, a, b]);
  const setFit = async fit => { await ev(f => { localStorage.setItem('q.mode', '"pages"'); localStorage.setItem('q.turn', '"h"'); localStorage.setItem('q.fsFit', JSON.stringify(f)); location.hash = '#/'; }, fit);
    await sleep(400); if (!CDPM) { await p.reload(); await sleep(1000); } else { await ev(() => location.reload()); await sleep(2500); }
    await ev(() => { window.QA_NOFS = true; location.hash = '#/p/50'; }); await sleep(1600); };   // no automatic full screen: the run's own tap does it
  const tapFs = async () => { await ev(() => { window.QA_NOFS = false; }); await tapPage(); };
  const runRect = async (name, trigger, ms, fsToggle, expectFull) => {
    await ev(recorder); await ev(() => window.__rec.start()); await trigger(); await sleep(ms);
    const r = await ev(() => window.__rec.stop()), settled = await ev(() => window.__rec.vis()), vp = await ev(() => [0, 0, innerWidth, innerHeight]);
    res[name] = analyseRect(r, fsToggle ? r.fsAt - 40 : 0, settled, expectFull ? vp : null, hBig, ins[0], ins[2]); res[name].page = r.p;
    if (process.env.DUMP) console.log(JSON.stringify(r.s.filter(x => x[0] >= (fsToggle ? r.fsAt - 40 : 0)).map(x => [Math.round(x[0])].concat(x.slice(5, 9).map(Math.round), x.slice(9).map(Math.round)))));
    if (log) console.log(name.padEnd(26), res[name].ok ? 'PASS' : 'FAIL', 'jump', res[name].edges.map(e => e.jump).join('/'), 'peak', res[name].edges.map(e => e.peak).join('/'), 'end', res[name].endErr, 'exp', res[name].expErr, 'moved', res[name].moved);
  };
  for (const fit of ['stretch', 'text']) {
    await setFit(fit);
    await runRect(fit + ' entry manual', tapFs, 2800, true, true);
    await waitFs(true); await sleep(600);
    await runRect(fit + ' exit manual', tapPage, 1600, true, false);
    await sleep(800);
  }
  // a mode step by pinch inside full screen: width -> stretch -> text, then back (each one glides)
  await setFit('width'); await tapFs(); await waitFs(true); await sleep(900);
  await runRect('pinch width>stretch', () => pinchEv(150, 250, 50, 350), 900, false, true); await sleep(400);
  await runRect('pinch stretch>text', () => pinchEv(150, 250, 50, 350), 900, false, true); await sleep(400);
  await runRect('pinch text>stretch', () => pinchEv(50, 350, 150, 250), 900, false, true); await sleep(400);
  await runRect('pinch stretch>width', () => pinchEv(50, 350, 150, 250), 900, false, false); await sleep(400);
  await ev(() => { localStorage.removeItem('q.fsFit'); });
  // 5.23 #5: a mushaf opened from home (in full screen) -> back goes straight home and leaves full screen
  await ev(() => { window.QA_NOFS = false; location.hash = '#/'; }); await sleep(600);
  await ev(() => { location.hash = '#/p/50'; }); await sleep(800); await tapPage(); const fsIn = await waitFs(true); await sleep(300);
  await ev(() => qBack()); await sleep(900);
  const hh = await ev(() => ({ h: location.hash, fs: document.body.classList.contains('fs') }));
  res['home back'] = { ok: fsIn && (hh.h === '#/' || hh.h === '' || hh.h === '#') && !hh.fs, fsIn, hash: hh.h, fs: hh.fs };
  if (log) console.log('home back'.padEnd(22), res['home back'].ok ? 'PASS' : 'FAIL', JSON.stringify(res['home back']));
  return { ins, res };
}
module.exports = { headlessPage, measureAll, cdpPage, recorder, analyseRect };

if (require.main === module) (async () => {
  const p = CDP ? await cdpPage(CDP) : await headlessPage(await loadPW().chromium.launch(), process.env.LAG === undefined ? undefined : +process.env.LAG);
  const { ins, res } = await measureAll(p, true);
  const out = process.argv[2]; if (out) require('fs').writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), where: CDP ? 'emulator' : 'headless', insets: ins, res }, null, 0));
  console.log('TOTAL', Object.values(res).filter(r => r.ok).length + '/' + Object.keys(res).length);
  if (CDP) await p.close().catch(() => {}); else process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
