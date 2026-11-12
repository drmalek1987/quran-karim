// Renders the app's UI with several Arabic UI fonts (Google Fonts, OFL) instead of Cairo; Quran text keeps its own font.
// Usage: node tools/qa/font-options.js -> build/fonts/<n>-<screen>.png + build/fonts/sheet.png
const path = require('path'), fs = require('fs'), cp = require('child_process');
let root = cp.execSync('npm root -g', { encoding: 'utf8', shell: true }).trim(), pw;
for (const s of ['playwright', '@playwright/test/node_modules/playwright']) { try { pw = require(path.join(root, s)); break; } catch (e) {} }
const R = path.resolve(__dirname, '..', '..'), OUT = path.join(R, 'build', 'fonts'); fs.mkdirSync(OUT, { recursive: true });
const W = require('url').pathToFileURL(path.join(R, 'web', 'index.html')).href;
const FONTS = [['Cairo', null], ['Tajawal', 'Tajawal:wght@400;500;700'], ['IBM Plex Sans Arabic', 'IBM+Plex+Sans+Arabic:wght@400;500;700'],
  ['Noto Kufi Arabic', 'Noto+Kufi+Arabic:wght@400;600;700'], ['Readex Pro', 'Readex+Pro:wght@400;500;700'], ['Almarai', 'Almarai:wght@400;700']];
(async () => {
  const b = await pw.chromium.launch(); const shots = [];
  for (let i = 0; i < FONTS.length; i++) {
    const [name, q] = FONTS[i];
    for (const [sn, hash] of [['home', '#/'], ['tafsir', '#/a/2/255']]) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1.5 });
      await ctx.addInitScript(() => { localStorage.setItem('q.welcomed', '1'); localStorage.setItem('q.theme', '"light"'); });
      const pg = await ctx.newPage(); await pg.goto(W + hash);
      if (q) {
        await pg.addStyleTag({ url: 'https://fonts.googleapis.com/css2?family=' + q + '&display=block' });
        await pg.evaluate(async f => {
          document.querySelectorAll('body, body *').forEach(e => { if (/Cairo/.test(getComputedStyle(e).fontFamily)) e.style.fontFamily = '"' + f + '", sans-serif'; });
          await document.fonts.load('16px "' + f + '"'); await document.fonts.load('700 16px "' + f + '"');
        }, name);
      }
      await pg.waitForTimeout(1200);
      const f = path.join(OUT, i + '-' + sn + '.png'); await pg.screenshot({ path: f }); shots.push(f); await ctx.close();
    }
  }
  await b.close();
  console.log(FONTS.map((f, i) => i + ' ' + f[0]).join('\n'));
})();
