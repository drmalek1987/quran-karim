// Typesets the Shamarly-layout mushaf (pages 2-522) with the King Fahd Complex Hafs font, following plan.json from
// prep.py, and measures where every ayah sits on each page.
//
// Usage: NODE_PATH=$(npm root -g) node render.js plan.json OUT [first last]
//   OUT gets png/NNN.png (white paper, drawn 1.6x) and rects.json {page: [[s, a, x0, y0, x1, y1], ...]} in per-mille.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const [PLAN, OUT] = process.argv.slice(2);
const FIRST = +(process.argv[4] || 2), LAST = +(process.argv[5] || 522);
const TJMODE = process.env.TJ === '1';   // also write the tajweed colour layer OUT/tj/NNN.png
const KF = path.join(__dirname, '../kfgqpc');
const HAFS = path.join(KF, 'UthmanicHafs1Ver18.ttf'), NUM = path.join(__dirname, '../../web/fonts/cairo-600.woff2');
const W = 620, H = 994, SCALE = 1.6;
const SURAH = JSON.parse(fs.readFileSync(path.join(KF, 'surah-names.json'), 'utf8'));
const QT = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/quran-uthmani-quranenc.json'), 'utf8')).map(s => s.verses.map(v => v.text.trim()));
const JUZ_AT = [[1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],[7,88],[8,41],[9,93],[11,6],[12,53],[15,1],[17,1],[18,75],[21,1],[23,1],[25,21],[27,56],[29,46],[33,31],[36,28],[39,32],[41,47],[46,1],[51,31],[58,1],[67,1],[78,1]];
const JUZ = ["الأول","الثاني","الثالث","الرابع","الخامس","السادس","السابع","الثامن","التاسع","العاشر","الحادي عشر","الثاني عشر","الثالث عشر","الرابع عشر","الخامس عشر","السادس عشر","السابع عشر","الثامن عشر","التاسع عشر","العشرون","الحادي والعشرون","الثاني والعشرون","الثالث والعشرون","الرابع والعشرون","الخامس والعشرون","السادس والعشرون","السابع والعشرون","الثامن والعشرون","التاسع والعشرون","الثلاثون"];
const ORN = require('../ornaments.js'), TH = Object.assign({ H: 994 }, ORN.THEMES.shamarly), SNF = path.join(__dirname, '../Surahs.ttf');
const AR = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';
const url = f => 'file://' + path.resolve(f);
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
// An ayah's words; the last one carries the end-of-ayah mark (the Hafs font draws the digits as the ornament).
const words = (s, a) => { const w = QT[s - 1][a - 1].split(/\s+/); w[w.length - 1] += ' ' + AR(a); return w; };

const STYLE = (n, special) => `
@font-face { font-family: H; src: url(${url(HAFS)}); }
@font-face { font-family: SN; src: url(${url(SNF)}); }
@font-face { font-family: N; src: url(${url(NUM)}); }
html, body { margin: 0; background: #fff; }
#pg { position: relative; width: ${W}px; height: ${H}px; color: #111; }
.top, .bot { position: absolute; left: 30px; right: 30px; font: 19px H; color: #333; display: flex; justify-content: space-between; }
.top { top: 14px; } .bot { bottom: 8px; justify-content: center; font: 17px N; }
.frame { position: absolute; left: 22px; right: 22px; top: 48px; bottom: 44px; border: 1.6px solid #6b5b45; outline: 1px solid #a89a83; outline-offset: 3px; border-radius: 2px; }
.body { position: absolute; left: 34px; right: 34px; top: 56px; bottom: 52px; display: grid; grid-template-rows: repeat(15, 1fr); }
.body.open { display: flex; flex-direction: column; justify-content: center; gap: 6px; }
.ln { display: flex; align-items: center; white-space: nowrap; min-height: 0; }
.open .ln { height: 54px; }
.tx { font: var(--fs) H; justify-content: space-between; line-height: 1; }
.tx.c { justify-content: center; gap: 0.3em; }
.bs { font: 27px H; justify-content: center; }
.hd { grid-row: span 2; justify-content: center; }
.sh { margin: 0 auto; }
.frame { display: none; }
.open .hd { height: 70px; }`;

function head(n, firstS, juz, special) {
  return `<div class="top"><span>${special ? '' : 'سورة ' + SURAH[firstS - 1]}</span><span>${special ? '' : 'الجزء ' + JUZ[juz - 1]}</span></div>${ORN.frame(W, H, [18, 46, W - 18, H - 40], TH)}`;
}
function juzOf(s, a) { return JUZ_AT.filter(j => j[0] < s || (j[0] === s && j[1] <= a)).length; }
// Tajweed: the letters of each rule in a span (web/tajweed-data.js, offsets into the ayah text). The spans only change the
// colour, so the shaping is the same; the normal page draws them black, the tajweed layer (TJ=1) draws only them.
const TJ = (() => { const t = fs.readFileSync(path.join(__dirname, '../../web/tajweed-data.js'), 'utf8'); return JSON.parse(t.slice(t.indexOf('=') + 1).trim().replace(/;$/, '')); })();
const TJC = ['#9aa1a8', '#9aa1a8', '#9aa1a8', '#c68a00', '#ef6c00', '#d63031', '#8e0e0e', '#2b8a3e', '#0b9a73', '#b0389b', '#1488a8', '#5c940d', '#9aa1a8', '#7a9a0b', '#9aa1a8', '#9aa1a8', '#1c6fd6'];
function wordTj(s, a, j, w) {
  const t = QT[s - 1][a - 1], re = /\S+/g; let m, k = 0;
  while ((m = re.exec(t)) && k++ < j);
  const off = m.index, end = off + m[0].length, sp = TJ.q[s - 1][a - 1] || [];
  let out = '', at = off;
  for (let i = 0; i < sp.length; i += 3) {
    if (sp[i] < off || sp[i + 1] > end) continue;
    out += esc(t.slice(at, sp[i])) + `<span class="tj" style="--c:${TJC[sp[i + 2]]}">` + esc(t.slice(sp[i], sp[i + 1])) + '</span>';
    at = sp[i + 1];
  }
  return out + esc(t.slice(at, end)) + esc(w.slice(m[0].length));
}
const wordHtml = (w, s, a, j) => `<span class="w" data-k="${s}:${a}">${TJMODE ? wordTj(s, a, j, w) : esc(w)}</span>`;

(async () => {
  const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
  fs.mkdirSync(path.join(OUT, 'png'), { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
  const tmp = path.join(OUT, 'page.html');
  // 1. Width of every word in the Hafs font (canvas, at 100px).
  fs.writeFileSync(tmp, `<!doctype html><html dir="rtl"><meta charset="utf-8"><style>${STYLE(0)}</style><body><span style="font:20px H">ب</span></body></html>`);
  await p.goto(url(tmp));
  const all = plan.ayat.map(([s, a]) => words(s, a));
  const widths = await p.evaluate(async (all) => {
    await document.fonts.load('100px H', 'بسم ١٢٣'); await document.fonts.ready;
    const c = document.createElement('canvas').getContext('2d'); c.font = '100px H'; c.direction = 'rtl';
    const sp = c.measureText(' ').width;
    return all.map(ws => ws.map(w => c.measureText(w).width + sp));
  }, all);
  // 2. Words onto lines: each ayah runs from g0 to g1 (line units); a word goes on the line under its middle.
  const lines = {};   // global line -> [{s, a, w}]
  const ratio = [];
  plan.ayat.forEach(([s, a, pg, g0, g1], i) => {
    const ws = all[i], wd = widths[i], tot = wd.reduce((x, y) => x + y, 0);
    ratio.push(tot / (g1 - g0));
    let acc = 0, lastLine = Math.floor(g1 - 1e-6);
    ws.forEach((w, j) => {
      let L = Math.floor(g0 + (acc + wd[j] / 2) / tot * (g1 - g0)); acc += wd[j];
      if (j === ws.length - 1) L = lastLine;
      L = Math.min(L, lastLine);
      (lines[L] = lines[L] || []).push({ s, a, w, j });
    });
  });
  const heads = {}; plan.heads.forEach(([s, L]) => { heads[L] = s; });
  const sorted = ratio.slice().sort((x, y) => x - y);
  console.log('width per line (px at 100px): median', sorted[sorted.length >> 1].toFixed(0), 'p5', sorted[(sorted.length * .05) | 0].toFixed(0), 'p95', sorted[(sorted.length * .95) | 0].toFixed(0));

  const rp = path.join(OUT, 'rects.json'), rects = fs.existsSync(rp) ? JSON.parse(fs.readFileSync(rp, 'utf8')) : {};
  for (let n = FIRST; n <= LAST; n++) {
    let body, firstS, firstA, special = n <= 3;
    if (special) {
      // The two opening pages: title, (basmala), then the ayat in short centred lines.
      const list = plan.open[String(n)], s = list[0][0];
      firstS = s; firstA = 1;
      const ws = list.flatMap(([s2, a2]) => words(s2, a2).map((w, j) => wordHtml(w, s2, a2, j)));
      const per = n === 2 ? [4, 4, 4, 5, 4, 5, 4, 4] : [5, 5, 5, 5, 5, 5, 6, 6];
      let rows = [], k = 0;
      for (const c of per) { if (k >= ws.length) break; rows.push(ws.slice(k, k + c)); k += c; }
      if (k < ws.length) rows[rows.length - 1] = rows[rows.length - 1].concat(ws.slice(k));
      body = `<div class="body open"><div class="ln hd"><div class="sh">${ORN.header(508, 56, s, TH)}</div></div>` +
        (n === 3 ? `<div class="ln bs">${BASMALA}</div>` : '') + rows.map(r => `<div class="ln tx c">${r.join('')}</div>`).join('') + '</div>';
    } else {
      let html = '';
      for (let k = 0; k < 15; k++) {
        const L = (n - 4) * 15 + k;
        if (heads[L] !== undefined) html += `<div class="ln hd" style="grid-row:${k + 1} / span 2"><div class="sh">${ORN.header(508, 66, heads[L], TH)}</div></div>`;
        else if (heads[L - 1] !== undefined) continue;   // second line of the title
        else if (heads[L - 2] !== undefined && heads[L - 2] !== 9) html += `<div class="ln bs" style="grid-row:${k + 1}">${BASMALA}</div>`;
        else html += `<div class="ln tx" style="grid-row:${k + 1}">` + (lines[L] || []).map(x => wordHtml(x.w, x.s, x.a, x.j)).join('') + '</div>';
      }
      body = `<div class="body">${html}</div>`;
      const firstW = (lines[(n - 4) * 15] && lines[(n - 4) * 15][0]) || Object.keys(lines).map(Number).filter(L => L >= (n - 4) * 15).sort((x, y) => x - y).map(L => lines[L][0])[0];
      firstS = firstW.s; firstA = firstW.a;
    }
    const lastWs = special ? plan.open[String(n)].slice(-1)[0] : (() => { for (let L = (n - 3) * 15 - 1; L >= (n - 4) * 15; L--) if ((lines[L] || []).length) { const x = lines[L].slice(-1)[0]; return [x.s, x.a]; } return [firstS, firstA]; })();
    fs.writeFileSync(tmp, `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>${STYLE(n, special)}</style></head><body><div id="pg">${head(n, firstS, juzOf(lastWs[0], lastWs[1]), special)}${body}<div class="bot">${ORN.pageNo(n, TH)}</div></div></body></html>`);
    await p.goto(url(tmp));
    rects[n] = await p.evaluate(async (special) => {
      await document.fonts.load('30px H', document.body.textContent); await document.fonts.load('40px SN', '001'); await document.fonts.ready;
      const body = document.querySelector('.body'), BW = body.clientWidth;
      const tx = [...document.querySelectorAll('.tx')].filter(l => l.querySelector('.w'));
      const natural = fs => { document.documentElement.style.setProperty('--fs', fs + 'px'); tx.forEach(l => l.style.justifyContent = 'flex-start');
        const w = tx.map(l => { const ws = l.querySelectorAll('.w'); return ws[0].getBoundingClientRect().right - ws[ws.length - 1].getBoundingClientRect().left; });
        tx.forEach(l => l.style.justifyContent = ''); return w; };
      const w0 = natural(30), med = w0.slice().sort((x, y) => x - y)[w0.length >> 1];
      // One size for the page, set by its typical line; a line that is fuller than the space is set a little smaller
      // (the print fits such lines by tightening the letters), and a line far shorter keeps natural spacing.
      const fs = special ? 26 : Math.min(32, 30 * BW * 0.93 / med);
      const w1 = natural(fs);
      tx.forEach((l, i) => { if (!special && w1[i] > BW * 0.985) { l.style.fontSize = (fs * BW * 0.985 / w1[i]).toFixed(2) + 'px'; w1[i] = BW * 0.985; } });
      tx.forEach((l, i) => { if (special || w1[i] < BW * 0.72) l.classList.add('c'); });
      // A short line that ends the page or a surah keeps natural spacing from the right, as in print.
      tx.forEach((l, i) => { if (l.classList.contains('c') && !special) { l.style.justifyContent = 'flex-start'; l.style.gap = '0.25em'; } });
      const pg = document.getElementById('pg').getBoundingClientRect(), out = [];
      tx.forEach(l => {
        const by = {};
        l.querySelectorAll('.w').forEach(w => {
          const k = w.dataset.k, r = w.getBoundingClientRect(), b = by[k] = by[k] || [1e9, 1e9, -1e9, -1e9];
          b[0] = Math.min(b[0], r.left); b[2] = Math.max(b[2], r.right);
        });
        const lr = l.getBoundingClientRect();
        Object.keys(by).forEach(k => {
          const b = by[k], sa = k.split(':').map(Number);
          out.push([sa[0], sa[1], Math.round((b[0] - 3 - pg.left) / pg.width * 1000), Math.round((lr.top - pg.top) / pg.height * 1000),
            Math.round((b[2] + 3 - pg.left) / pg.width * 1000), Math.round((lr.bottom - pg.top) / pg.height * 1000)]);
        });
      });
      return { fs, out };
    }, special).then(r => r.out);
    await p.evaluate(ORN.marksScript(ORN.rubOn([...new Set(rects[n].map(r => r[0] + ':' + r[1]))]).map(e => { const [s, a] = e[1].split(':').map(Number); return [...e, words(s, a)[0]]; }), n % 2 ? W - 10 : 10, TH));
    await p.locator('#pg').screenshot({ path: path.join(OUT, 'png', String(n).padStart(3, '0') + '.png') });
    if (TJMODE) {
      fs.mkdirSync(path.join(OUT, 'tj'), { recursive: true });
      await p.addStyleTag({ content: '#pg svg, .mk, .mkt { visibility: hidden !important; } #pg, #pg * { color: transparent !important; border-color: transparent !important; outline-color: transparent !important; background: transparent !important; } html, body { background: transparent !important; } #pg .tj { color: var(--c) !important; }' });
      await p.locator('#pg').screenshot({ path: path.join(OUT, 'tj', String(n).padStart(3, '0') + '.png'), omitBackground: true });
    }
    if (n % 50 === 0) { console.log('page', n); fs.writeFileSync(rp, JSON.stringify(rects)); }
  }
  fs.writeFileSync(rp, JSON.stringify(rects));
  await b.close();
})();
