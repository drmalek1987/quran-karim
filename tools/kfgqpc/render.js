// Draws the 604 pages of the King Fahd Complex Madinah mushaf (1421H print, calligraphy of Uthman Taha) from the
// Complex's own page fonts (QPC V2 / QCF2), and measures where every ayah sits on each page.
//
// Usage: NODE_PATH=$(npm root -g) node render.js SRC OUT [first last]
//   SRC = a checkout of github.com/zonetecde/mushaf-layout (branch v2): mushaf/QPC2/page-NNN.json + fonts/QPC2/
//   OUT gets png/NNN.png (white paper, the page drawn 1.6x) and rects.json: {page: [[s, a, x0, y0, x1, y1], ...]}
//   in per-mille of the page, one box per ayah per line, as the app's ayah boxes.
// The Complex allows its mushaf fonts to be used for free in software and digital publishing
// (dm.qurancomplex.gov.sa/copyright-2). The fonts are only used here; the app ships the drawn pages.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const [SRC, OUT] = process.argv.slice(2);
const FIRST = +(process.argv[4] || 1), LAST = +(process.argv[5] || 604);
const HAFS = path.join(__dirname, 'UthmanicHafs1Ver18.ttf');   // KFGQPC Hafs font, for the titles
const NUM = path.join(__dirname, '../../web/fonts/cairo-600.woff2');   // page numbers (the Hafs font draws digits as ayah marks)
const W = 620, H = 994, SCALE = 1.6;
const SURAH = JSON.parse(fs.readFileSync(path.join(__dirname, 'surah-names.json'), 'utf8'));
const JUZ = ["الأول","الثاني","الثالث","الرابع","الخامس","السادس","السابع","الثامن","التاسع","العاشر","الحادي عشر","الثاني عشر","الثالث عشر","الرابع عشر","الخامس عشر","السادس عشر","السابع عشر","الثامن عشر","التاسع عشر","العشرون","الحادي والعشرون","الثاني والعشرون","الثالث والعشرون","الرابع والعشرون","الخامس والعشرون","السادس والعشرون","السابع والعشرون","الثامن والعشرون","التاسع والعشرون","الثلاثون"];
// First ayah of each juz.
const JUZ_AT = [[1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],[7,88],[8,41],[9,93],[11,6],[12,53],[15,1],[17,1],[18,75],[21,1],[23,1],[25,21],[27,56],[29,46],[33,31],[36,28],[39,32],[41,47],[46,1],[51,31],[58,1],[67,1],[78,1]];
const ORN = require('../ornaments.js'), TH = Object.assign({ H: 994 }, ORN.THEMES.kfgqpc), SNF = path.join(__dirname, '../Surahs.ttf');
const AR = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const url = f => 'file://' + path.resolve(f);

function html(n, d) {
  const at = d.lines.flatMap(l => (l.words || []).map(w => w.location.split(':').map(Number)));
  const firstS = at[0][0], lastA = at[at.length - 1];
  // The juz the page ends in (a juz starting on this page is the one named, as in the print).
  const juz = JUZ_AT.filter(j => j[0] < lastA[0] || (j[0] === lastA[0] && j[1] <= lastA[1])).length;
  const special = n <= 2;
  const lines = d.lines.map(l => {
    if (l.type === 'surah-header') return `<div class="ln hd" data-l="${l.line}"><div class="sh">${ORN.header(508, 44, +l.surah, TH)}</div></div>`;
    if (l.type === 'basmala') return `<div class="ln bs" data-l="${l.line}">${l.qpcV2}</div>`;
    return `<div class="ln tx" data-l="${l.line}">` + l.words.map(w => `<span class="w" data-k="${w.location}">${w.qpcV2.replace(/ /g, '')}</span>`).join('') + '</div>';
  }).join('');
  return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
@font-face { font-family: P; src: url(${url(path.join(SRC, 'fonts/QPC2/p' + String(n).padStart(3, '0') + '.woff2'))}); }
@font-face { font-family: B; src: url(${url(path.join(SRC, 'fonts/QPC2/QPC2BSML.ttf'))}); }
@font-face { font-family: H; src: url(${url(HAFS)}); }
@font-face { font-family: SN; src: url(${url(SNF)}); }
@font-face { font-family: N; src: url(${url(NUM)}); }
html, body { margin: 0; background: #fff; }
#pg { position: relative; width: ${W}px; height: ${H}px; box-sizing: border-box; padding: 18px 22px; color: #111; }
.top, .bot { position: absolute; left: 30px; right: 30px; font: 19px H; color: #333; display: flex; justify-content: space-between; }
.top { top: 14px; } .bot { bottom: 8px; justify-content: center; font: 17px N; }
.frame { position: absolute; left: 22px; right: 22px; top: 48px; bottom: 44px; border: 1.6px solid #5b6b5e; outline: 1px solid #9aa79b; outline-offset: 3px; border-radius: 2px; }
.body { position: absolute; left: 34px; right: 34px; top: 58px; bottom: 54px; display: flex; flex-direction: column; justify-content: ${special ? 'center' : 'space-between'}; }
.ln { height: ${special ? 52 : 58}px; display: flex; align-items: center; white-space: nowrap; }
.tx { font: var(--fs) P; justify-content: space-between; line-height: 1; }
.tx.c { justify-content: center; gap: 0.18em; }
.bs { font: 30px B; justify-content: center; }
.sh { margin: 0 auto; width: 508px; height: 44px; }
.frame { display: none; }
</style></head><body><div id="pg"><div class="top"><span>${special ? '' : 'سورة ' + SURAH[firstS - 1]}</span><span>${special ? '' : 'الجزء ' + JUZ[juz - 1]}</span></div>
${ORN.frame(W, H, [18, 46, W - 18, H - 40], TH)}<div class="body">${lines}</div><div class="bot">${ORN.pageNo(n, TH)}</div></div></body></html>`;
}

(async () => {
  fs.mkdirSync(path.join(OUT, 'png'), { recursive: true });
  const wordsOf = {}, wp = path.join(OUT, 'words.json');
  const rp = path.join(OUT, 'rects.json'), rects = fs.existsSync(rp) ? JSON.parse(fs.readFileSync(rp, 'utf8')) : {};
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
  for (let n = FIRST; n <= LAST; n++) {
    const d = JSON.parse(fs.readFileSync(path.join(SRC, 'mushaf/QPC2/page-' + String(n).padStart(3, '0') + '.json'), 'utf8'));
    // Loaded from a file, so the page may read the font files.
    const tmp = path.join(OUT, 'page.html'); fs.writeFileSync(tmp, html(n, d)); await p.goto(url(tmp));
    rects[n] = await p.evaluate(async (special) => {
      // Make sure the page font is in before measuring (document.fonts.ready alone can resolve before it starts loading).
      const all = [...document.querySelectorAll('.w')].map(w => w.textContent).join('');
      await Promise.all([document.fonts.load('34px P', all), document.fonts.load('30px B', document.querySelector('.bs') ? document.querySelector('.bs').textContent : 'a'), document.fonts.load('25px H', 'سورة'), document.fonts.load('40px SN', '001')]);
      await document.fonts.ready;
      const body = document.querySelector('.body'), BW = body.clientWidth;
      // Font size: the widest line of the page fills the line at its natural spacing.
      const tx = [...document.querySelectorAll('.tx')];
      const natural = fs => { document.documentElement.style.setProperty('--fs', fs + 'px'); tx.forEach(l => l.style.justifyContent = 'flex-start');
        const w = tx.map(l => { const ws = l.querySelectorAll('.w'); return ws.length ? ws[0].getBoundingClientRect().right - ws[ws.length - 1].getBoundingClientRect().left : 0; });
        tx.forEach(l => l.style.justifyContent = ''); return w; };
      let fs = 34; const w0 = natural(fs), mx = Math.max(...w0);
      fs = special ? 30 : Math.min(40, fs * BW * 0.985 / mx);
      const w1 = natural(fs);
      // Lines that are much shorter than the line width are centred in the print (pages 1-2, and a few lines at surah ends).
      tx.forEach((l, i) => { if (special || w1[i] < BW * 0.8) l.classList.add('c'); });
      const pg = document.getElementById('pg').getBoundingClientRect(), out = [];
      tx.forEach(l => {
        const by = {};
        l.querySelectorAll('.w').forEach(w => {
          const k = w.dataset.k.split(':').slice(0, 2).join(':'), r = w.getBoundingClientRect();
          const b = by[k] = by[k] || [1e9, 1e9, -1e9, -1e9];
          b[0] = Math.min(b[0], r.left); b[1] = Math.min(b[1], r.top); b[2] = Math.max(b[2], r.right); b[3] = Math.max(b[3], r.bottom);
        });
        const lr = l.getBoundingClientRect();
        Object.keys(by).forEach(k => {
          const b = by[k], sa = k.split(':').map(Number);
          // A box covers the whole line height, and the gap up to the next word, so a tap anywhere on the ayah hits it.
          out.push([sa[0], sa[1], Math.round((b[0] - 3 - pg.left) / pg.width * 1000), Math.round((lr.top - pg.top) / pg.height * 1000),
            Math.round((b[2] + 3 - pg.left) / pg.width * 1000), Math.round((lr.bottom - pg.top) / pg.height * 1000)]);
        });
      });
      // Each word's box (CSS px from the page's top left), for the tajweed layer (tajweed.py).
      const words = [...document.querySelectorAll('.w')].map(w => { const r = w.getBoundingClientRect(); return [w.dataset.k, +(r.left - pg.left).toFixed(1), +(r.top - pg.top).toFixed(1), +(r.right - pg.left).toFixed(1), +(r.bottom - pg.top).toFixed(1)]; });
      return { out, words };
    }, n <= 2).then(r => { wordsOf[n] = r.words; return r.out; });
    if (process.env.WORDS === '1') continue;
    const starts = d.lines.flatMap(l => (l.words || []).filter(w => w.location.endsWith(':1')).map(w => w.location.split(':').slice(0, 2).join(':')));
    await p.evaluate(ORN.marksScript(ORN.rubOn(starts), n % 2 ? W - 10 : 10, TH));
    await p.locator('#pg').screenshot({ path: path.join(OUT, 'png', String(n).padStart(3, '0') + '.png') });
    if (n % 50 === 0) { console.log('page', n); fs.writeFileSync(rp, JSON.stringify(rects)); }
  }
  if (process.env.WORDS === '1') fs.writeFileSync(wp, JSON.stringify(wordsOf)); else fs.writeFileSync(rp, JSON.stringify(rects));
  await b.close();
})();
