// 5.11 G2 5c/5d: how the mushaf page moves on screen while full screen comes in or goes out.
// Records, every animation frame, the on-screen top of the page being read = its CSS top + the WebView's top inset
// (the status bar, which immersive() takes away), for entry/exit x horizontal/vertical x auto/manual.
// Pass = the motion goes one way only (±1 px) and it never moves more than 15 px per 16.7 ms.
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
  R.start = () => { R.s = []; R.el = pick(); R.on = true; R.t0 = performance.now(); R.fsAt = null; R.fs0 = document.body.classList.contains('fs');
    const loop = () => { if (!R.on) return; const r = R.el && R.el.isConnected ? R.el.getBoundingClientRect() : { top: NaN, width: NaN };
      const fs = document.body.classList.contains('fs'); if (R.fsAt === null && fs !== R.fs0) R.fsAt = performance.now() - R.t0;
      R.s.push([+(performance.now() - R.t0).toFixed(1), +r.top.toFixed(2), +r.width.toFixed(2), innerHeight, fs ? 1 : 0]); requestAnimationFrame(loop); };
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
    await run(t + ' entry auto', async () => { await ev(() => { location.hash = '#/p/50'; }); await sleep(800); await ev(() => window.__rec.start()); }, 6200);
    await run(t + ' exit back', () => ev(() => qBack()), 1600);
    await sleep(600);
    // manual: a tap on the page (full screen 1.2 s later), a tap again to leave
    await run(t + ' entry manual', tapPage, 2800);
    await waitFs(true);
    await run(t + ' exit manual', tapPage, 1600);
    await sleep(800);
  }
  return { ins, res };
}
module.exports = { headlessPage, measureAll, cdpPage };

if (require.main === module) (async () => {
  const p = CDP ? await cdpPage(CDP) : await headlessPage(await loadPW().chromium.launch(), process.env.LAG === undefined ? undefined : +process.env.LAG);
  const { ins, res } = await measureAll(p, true);
  const out = process.argv[2]; if (out) require('fs').writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), where: CDP ? 'emulator' : 'headless', insets: ins, res }, null, 0));
  console.log('TOTAL', Object.values(res).filter(r => r.ok).length + '/' + Object.keys(res).length);
  if (CDP) await p.close().catch(() => {}); else process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
