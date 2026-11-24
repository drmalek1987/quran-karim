// Headless page-load measurements (bug #25). Usage (repo root):
//   NODE_PATH=$(npm root -g) node tools/qa/sprint5/perf/run-playwright.mjs [--ed kfgqpc,kfold,shamarly,harmain] [--vp portrait,landscape,tablet]
//        [--cpu 1,4,6] [--port 8791] [--secs 8] [--nopreload] [--out tools/qa/sprint5/perf/out]
// Serves web/ over http on its own port, one fresh context (cold cache) per combination.
import { createRequire } from 'module';
import http from 'http'; import fs from 'fs'; import path from 'path';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('@playwright/test')); }
const A = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || '1']; }));
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '../../../../web'), out = path.resolve(A.out || path.join(here, 'out'));
fs.mkdirSync(out, { recursive: true });
const EDS = (A.ed || 'kfgqpc,kfold,shamarly,harmain').split(','), CPUS = (A.cpu || '1,4,6').split(',').map(Number), PORT = +(A.port || 8791), SECS = +(A.secs || 8);
const VPS = { portrait: { width: 412, height: 915, dsf: 2.625, mobile: true }, landscape: { width: 915, height: 412, dsf: 2.625, mobile: true }, tablet: { width: 1280, height: 800, dsf: 2, mobile: true } };
const vpNames = (A.vp || 'portrait,landscape').split(',');
const payload = fs.readFileSync(path.join(here, 'payload.js'), 'utf8');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.avif': 'image/avif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json' };
const srv = http.createServer((q, r) => { const f = path.join(web, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'max-age=3600' }); r.end(d); } }); }).listen(PORT, '127.0.0.1');
const b = await chromium.launch({ args: ['--enable-precise-memory-info'] });
const results = [];
const pct = (a, q) => { a = a.filter(x => x != null).sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(q * a.length))] : null; };
async function run(ed, vpn, cpu, turn) {
  const vp = VPS[vpn];
  const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf, isMobile: vp.mobile, hasTouch: true, serviceWorkers: 'block' });
  const pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(([ed, turn, nopre]) => {
    window.QA_NOFS = true;
    const s = (k, v) => localStorage.setItem('q.' + k, JSON.stringify(v));
    s('mode', 'pages'); s('edition', ed); s('turn', turn); s('welcomed', true); s('flipMode', 'off');
    if (nopre) { const NI = window.Image; window.Image = function () { const i = new NI(); const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src'); Object.defineProperty(i, 'src', { get() { return d.get.call(i); }, set(v) { if (/\/\d{3}\.avif$/.test(v)) return; d.set.call(i, v); } }); return i; }; }
  }, [ed, turn, !!A.nopreload]);
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Network.enable'); await cdp.send('Network.clearBrowserCache'); await cdp.send('Performance.enable');
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await pg.goto(`http://127.0.0.1:${PORT}/index.html`); await pg.waitForTimeout(1200);
  await pg.evaluate(payload);
  const lo = ed === 'shamarly' ? 3 : ed === 'harmain' ? 3 : 2, row = { ed, vp: vpn, cpu, turn };
  await pg.evaluate(p => { location.hash = '#/p/' + p; }, lo + 8); await pg.waitForTimeout(1500);
  row.info = await pg.evaluate(() => window.__qk.info());
  if (row.info.vp === 0 && turn === 'h' && !row.info.dir) { row.error = 'no page images for edition'; await ctx.close(); return row; }
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  if (turn === 'h') {
    // cold: pages never seen (sequential, so n+1 was preloaded by the app); jump: far pages, not preloaded; warm: revisit
    const seq = [20, 21, 22, 23, 24, 25, 26, 27], jump = [100, 200, 300, 400, 150, 250, 350, 450];
    row.seq = await pg.evaluate(p => window.__qk.single(p, 700), seq);
    row.jump = await pg.evaluate(p => window.__qk.single(p, 700), jump);
    row.warm = await pg.evaluate(p => window.__qk.single(p, 700), jump.concat(seq));
    row.decodeBench = await pg.evaluate(() => window.__qk.decodeBench(window.__qk.info().dir, [10, 100, 200, 300, 400, 500]));
    row.metrics = await metrics();
  } else {
    row.vert = [];
    // 1 / 3 / 8 pages per second; 8 pps long enough to pass 50 pages for the memory reading
    for (const [pps, secs] of [[1, SECS], [3, SECS], [8, Math.max(SECS, 7)]]) {
      await pg.evaluate(p => { location.hash = '#/p/' + p; }, 30); await pg.waitForTimeout(2500);
      const r = await pg.evaluate(o => window.__qk.vertical(o), { pps, secs }); r.metrics = await metrics(); row.vert.push(r);
    }
  }
  row.errors = errs; await ctx.close(); return row;
}
for (const ed of EDS) {
  if (!fs.existsSync(path.join(web, ed === 'harmain' ? 'pages' : 'editions/' + ed))) { console.log('skip', ed); continue; }
  for (const vpn of vpNames) for (const cpu of CPUS) for (const turn of ['h', 'v']) {
    if (turn === 'v' && vpn === 'tablet') continue;
    const r = await run(ed, vpn, cpu, turn).catch(e => ({ ed, vp: vpn, cpu, turn, error: String(e) }));
    results.push(r); fs.writeFileSync(path.join(out, 'playwright.json'), JSON.stringify(results, null, 1));
    const f = a => a ? `${pct(a.map(x => x.paint), .5)}/${pct(a.map(x => x.paint), .95)}` : '-';
    console.log(ed, vpn, 'cpu' + cpu, turn, r.error || (turn === 'h' ? `seq ${f(r.seq)} jump ${f(r.jump)} warm ${f(r.warm)} spread=${r.info.spread}` : r.vert.map(v => `${v.pps}pps blank p50/p95/max ${v.blankP50}/${v.blankP95}/${v.blankMax} blankFr ${v.blankFrames}/${v.frames}`).join(' | ')));
  }
}
await b.close(); srv.close();
