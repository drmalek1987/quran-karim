// W0 (plans/W-track-plan.md step 4): how well the page geometry the app estimates matches the measured word boxes.
// Usage: ED=kfgqpc|harmain SEED=518 N=30 node tools/qa/geo_check.js   (playwright found as in ui.js)
// Reference = measured word boxes (editions/<ed>-w/NNN.js, rows [s,a,w,x0,y0,x1,y1] per mille, w = place in rWords()).
// The app's internals that are not exposed (norm, rWords, ayahAt, lastWordOnPages, pageWordAt's estimate path) are
// taken verbatim from web/app.js source at run time and evaluated in the page (Q = window.QURAN is the live edition),
// so the numbers follow app.js as it is. The hifz per-word estimate (b, c) re-implements app.js hifzPagesMount
// (~1245-1266: lw = letters+1, cs/mids cumulative, the word's line = the line rect holding its mid, mask
// top = y0+5, height = y1-y0-9, horizontal cut from cs[i] like the `right` edge at ~1259-1261).
function loadPW() {
  try { return require('playwright'); } catch (e) {}
  const path = require('path'), cp = require('child_process');
  let root = ''; try { root = cp.execSync('npm root -g', { encoding: 'utf8', shell: true }).trim(); } catch (e) {}
  for (const c of [root, process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules')].filter(Boolean))
    for (const sub of ['playwright', 'playwright-core', '@playwright/test/node_modules/playwright', '@playwright/test/node_modules/playwright-core'])
      try { return require(path.join(c, sub)); } catch (e) {}
  throw new Error('playwright not found: install it globally or set NODE_PATH');
}
const fs = require('fs'), path = require('path');
const { chromium } = loadPW();
const WEB = path.resolve(process.env.QK_WEB || __dirname + '/../../web');
const W = require('url').pathToFileURL(WEB + '/index.html').href;
const ED = process.env.ED || 'kfgqpc', SEED = +(process.env.SEED || 518), N = +(process.env.N || 30);
if (!['kfgqpc', 'harmain'].includes(ED)) { console.error('ED must be an edition with measured word boxes: kfgqpc, harmain'); process.exit(2); }

// the source of `function name(...) {...}` in app.js (brace counted)
const SRC = fs.readFileSync(WEB + '/app.js', 'utf8');
function fnSrc(name) {
  const i = SRC.indexOf('  function ' + name + '(');
  if (i < 0) throw new Error('not in app.js: ' + name);
  let d = 0, j = SRC.indexOf('{', i);
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}' && --d === 0) break; }
  return SRC.slice(i, j + 1);
}
const lineOf = name => SRC.slice(0, SRC.indexOf('  function ' + name + '(')).split('\n').length;
const LIB = ['norm', 'rWords', 'ayahAt', 'lastWordOnPages', 'pageWordAt'].map(fnSrc).join('\n');

// seeded page sample among pages that have a word-box file
function rng(s) { return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
const all = fs.readdirSync(WEB + '/editions/' + ED + '-w').map(f => +f.slice(0, 3)).filter(n => n > 0).sort((a, b) => a - b);
const R = rng(SEED), pool = all.slice(), pages = [];
while (pages.length < N && pool.length) pages.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
pages.sort((a, b) => a - b);

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  await p.setViewportSize({ width: 390, height: 844 });
  await p.addInitScript(() => { window.QA_NOFS = true; });
  await p.goto(W); await p.evaluate(ed => { localStorage.clear(); localStorage.setItem('q.edition', JSON.stringify(ed)); localStorage.setItem('q.micTips', '1'); }, ED);
  await p.reload(); await p.waitForTimeout(800);
  await p.evaluate(h => { location.hash = h; }, '#/p/' + pages[0]); await p.waitForTimeout(800);
  const res = await p.evaluate(async ({ LIB, pages }) => {
    const Q = window.QURAN, WB = {};
    for (const n of pages) WB[n] = await new Promise(r => window.QA_wb(n, r));
    // app.js functions, run against the live edition data; wbNeed/wbRows feed the measured rows (or none, for the estimate path)
    let useWb = true, byPage = null;
    const wbRows = n => (useWb ? WB[n] : null), wbNeed = (n, done) => done(wbRows(n));
    const F = new Function('Q', 'wbRows', 'wbNeed', 'getBy', 'setBy', LIB.replace(/\bbyPage\b/g, 'BP') + '\nvar BP = null; return { norm, rWords, ayahAt, lastWordOnPages, pageWordAt };')(Q, wbRows, wbNeed);
    const pwa = (n, x, y) => new Promise(r => F.pageWordAt(n, x, y, r));
    const iou = (A, B) => { const ix = Math.max(0, Math.min(A[2], B[2]) - Math.max(A[0], B[0])), iy = Math.max(0, Math.min(A[3], B[3]) - Math.max(A[1], B[1])), I = ix * iy; return I / ((A[2] - A[0]) * (A[3] - A[1]) + (B[2] - B[0]) * (B[3] - B[1]) - I || 1); };
    // hifz estimate of word i of ayah s:a (app.js hifzPagesMount): [page, lineIdx, box x0,y0,x1,y1]
    const est = {};
    function hifzEst(s, a) {
      const k = s + ':' + a; if (est[k]) return est[k];
      const rs0 = Q.r[s - 1][a - 1], wl = F.rWords(k), lw = w => F.norm(w).length + 1, tot = wl.reduce((t, w) => t + lw(w), 0);
      const span = rs0.reduce((t, r) => t + r[3] - r[1], 0), mids = [], cs = []; let c0 = 0, acc = 0;
      wl.forEach(w => { cs.push(c0); mids.push((c0 + lw(w) / 2) / tot * span); c0 += lw(w); }); cs.push(c0);
      const out = wl.map(() => null);
      rs0.forEach((b, li) => {
        const x0 = acc, x1 = acc + b[3] - b[1]; acc = x1;
        const a0 = x0 / span * tot, a1 = x1 / span * tot;
        mids.forEach((m, i) => {
          if (!(m >= x0 && m < x1)) return;
          const xr = q => b[3] - (Math.min(a1, Math.max(a0, q)) - a0) / (a1 - a0) * (b[3] - b[1]);   // as `right` at app.js ~1260
          out[i] = [b[0], li, [xr(cs[i + 1]), b[2] + 5, xr(cs[i]), b[4] - 4]];
        });
      });
      return (est[k] = out);
    }
    const A = { a: [0, 0], a2: [0, 0], b: [], bx: [], by: [], dSplit: 0, c: [0, 0], d: [], e: [0, 0], e2: [0, 0], worstB: [], badD: [] };
    for (const n of pages) {
      const rows = WB[n] || [];
      for (const r of rows) {
        const cx = (r[3] + r[5]) / 2, cy = (r[4] + r[6]) / 2;
        useWb = true; const g = await pwa(n, cx, cy); A.a[1]++; if (g && g[0] === r[0] && g[1] === r[1] && g[2] === r[2]) A.a[0]++;
        useWb = false; const g2 = await pwa(n, cx, cy); A.a2[1]++; if (g2 && g2[0] === r[0] && g2[1] === r[1] && g2[2] === r[2]) A.a2[0]++;
        // (b) hifz mask estimate vs measured box
        const e = hifzEst(r[0], r[1])[r[2]], M = [r[3], r[4], r[5], r[6]];
        const v = e && e[0] === n ? iou(e[2], M) : 0; A.b.push(v); if (e && e[0] === n) { const o = (p0, p1, q0, q1) => Math.max(0, Math.min(p1, q1) - Math.max(p0, q0)) / (Math.max(p1, q1) - Math.min(p0, q0)); A.bx.push(o(e[2][0], e[2][2], M[0], M[2])); A.by.push(o(e[2][1], e[2][3], M[1], M[3])); } if (v < 0.2) A.worstB.push([n, r[0], r[1], r[2], +v.toFixed(2)]);
        // (c) line of the estimate vs the ayah's line rect holding the measured centre (nearest if none holds it)
        const rs0 = Q.r[r[0] - 1][r[1] - 1]; let ml = -1, md = 1e9;
        rs0.forEach((q, li) => { if (q[0] !== n) return; const dx = cx < q[1] ? q[1] - cx : cx > q[3] ? cx - q[3] : 0, dy = cy < q[2] ? q[2] - cy : cy > q[4] ? cy - q[4] : 0, d = dx + 3 * dy; if (d < md) { md = d; ml = li; } });
        A.c[1]++; if (e && e[1] === ml) A.c[0]++;
        // (e) ayah tap at the centre and four inner points, word-box path and the old rect-only path
        for (const [fx, fy] of [[.5, .5], [.25, .25], [.75, .25], [.25, .75], [.75, .75]]) {
          const x = r[3] + fx * (r[5] - r[3]), y = r[4] + fy * (r[6] - r[4]);
          useWb = true; const h = F.ayahAt(n, x, y); A.e[1]++; if (h && h[0] === r[0] && h[1] === r[1]) A.e[0]++;
          const h2 = F.ayahAt(n, x, y, true); A.e2[1]++; if (h2 && h2[0] === r[0] && h2[1] === r[1]) A.e2[0]++;
        }
      }
      // (d) page end: the measured last word on the page vs lastWordOnPages
      if (rows.length) {
        const last = rows.reduce((m, r) => (r[0] * 1e6 + r[1] * 1e3 + r[2] > m[0] * 1e6 + m[1] * 1e3 + m[2] ? r : m));
        if (last[2] < F.rWords(last[0] + ':' + last[1]).length - 1) A.dSplit++; const got = F.lastWordOnPages(last[0] + ':' + last[1], [n]); A.d.push(got - last[2]);
        if (got !== last[2]) A.badD.push([n, last[0] + ':' + last[1], 'measured ' + last[2], 'est ' + got, 'of ' + F.rWords(last[0] + ':' + last[1]).length]);
      }
    }
    return A;
  }, { LIB, pages });
  await b.close();
  const pc = x => (100 * x[0] / (x[1] || 1)).toFixed(1);
  const mean = a => a.reduce((t, x) => t + x, 0) / (a.length || 1);
  const out = {
    ed: ED, seed: SEED, pages, words: res.a[1], src: { pageWordAt: lineOf('pageWordAt'), ayahAt: lineOf('ayahAt'), lastWordOnPages: lineOf('lastWordOnPages'), hifzPagesMount: lineOf('hifzPagesMount') },
    a_longpress_pct: +pc(res.a), a_estimateOnly_pct: +pc(res.a2),
    b_hifz_meanIoU: +mean(res.b).toFixed(3), b_hifz_iouGt05_pct: +(100 * res.b.filter(v => v > 0.5).length / (res.b.length || 1)).toFixed(1),
    b_hifz_xOverlap: +mean(res.bx).toFixed(3), b_hifz_yOverlap: +mean(res.by).toFixed(3), d_splitPages: res.dSplit, c_line_pct: +pc(res.c),
    d_pageEnd_exact_pct: +(100 * res.d.filter(v => v === 0).length / (res.d.length || 1)).toFixed(1), d_meanAbsOffset: +mean(res.d.map(Math.abs)).toFixed(2), d_meanOffset: +mean(res.d).toFixed(2),
    e_ayahTap_wb_pct: +pc(res.e), e_ayahTap_rects_pct: +pc(res.e2),
    d_misses: res.badD, b_worst: res.worstB.slice(0, 40), b_worst_count: res.worstB.length
  };
  const T = [['(a) long-press word (word boxes)', out.a_longpress_pct + '%'], ['(a\') long-press word (estimate only)', out.a_estimateOnly_pct + '%'],
    ['(b) hifz mask mean IoU', out.b_hifz_meanIoU], ['(b) hifz mask IoU>0.5', out.b_hifz_iouGt05_pct + '%'], ['(b) mean 1-D overlap x / y', out.b_hifz_xOverlap + ' / ' + out.b_hifz_yOverlap], ['(d) pages ending mid-ayah', out.d_splitPages], ['(c) line assignment', out.c_line_pct + '%'],
    ['(d) page end exact', out.d_pageEnd_exact_pct + '%'], ['(d) page end mean |offset| / mean offset (words)', out.d_meanAbsOffset + ' / ' + out.d_meanOffset],
    ['(e) ayah tap (word boxes)', out.e_ayahTap_wb_pct + '%'], ['(e) ayah tap (rects only)', out.e_ayahTap_rects_pct + '%']];
  console.log(`geo_check ED=${ED} SEED=${SEED} pages=${pages.length} words=${out.words}`);
  for (const [k, v] of T) console.log(k.padEnd(50) + v);
  if (res.badD.length) console.log('(d) misses:', JSON.stringify(res.badD));
  fs.writeFileSync(__dirname + '/geo-' + ED + '.json', JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
