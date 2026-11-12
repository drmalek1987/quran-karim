// Builds store/play/feature-graphic-1024x500.png (Google Play: 1024x500, 24-bit PNG, no alpha) in headless Chromium,
// with the app's Cairo font and store/icon-512.png. Usage: node store/make-feature-graphic.js
// Edit SUB to change the feature line.
const path = require('path'), fs = require('fs'), cp = require('child_process');
function loadPW() {
  try { return require('playwright'); } catch (e) {}
  let root = ''; try { root = cp.execSync('npm root -g', { encoding: 'utf8', shell: true }).trim(); } catch (e) {}
  for (const c of [root, process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules')].filter(Boolean))
    for (const sub of ['playwright', 'playwright-core', '@playwright/test/node_modules/playwright', '@playwright/test/node_modules/playwright-core'])
      try { return require(path.join(c, sub)); } catch (e) {}
  throw new Error('playwright not found');
}
const R = path.resolve(__dirname, '..');
const url = f => require('url').pathToFileURL(path.join(R, f)).href;
const TITLE = 'حافظ';
const SUB = 'القرآن الكريم · طبعة الملك فهد والشمرلي<br>تفسير · تجويد · سماع · ترتيل · بدون إنترنت';
const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
@font-face { font-family: Cairo; font-weight: 700; src: url(${url('web/fonts/cairo-700.woff2')}); }
@font-face { font-family: Cairo; font-weight: 600; src: url(${url('web/fonts/cairo-600.woff2')}); }
html, body { margin: 0; width: 1024px; height: 500px; overflow: hidden; }
body { background: linear-gradient(115deg, #0b4a37 0%, #10664c 50%, #188a6c 100%); font-family: Cairo, sans-serif;
  display: flex; align-items: center; gap: 44px; padding: 0 56px 0 40px; box-sizing: border-box; }
img { width: 230px; height: 230px; border-radius: 52px; box-shadow: 0 18px 40px rgba(0,0,0,.28); flex: none; }
.t { display: flex; flex-direction: column; gap: 6px; }
h1 { margin: 0; color: #fff; font-weight: 700; font-size: 120px; line-height: 1.15; }
p { margin: 0; color: #f0d79a; font-weight: 600; font-size: 34px; line-height: 1.55; white-space: nowrap; }
</style></head><body><img src="${url('store/icon-512.png')}"><div class="t"><h1>${TITLE}</h1><p>${SUB}</p></div></body></html>`;
(async () => {
  const tmp = path.join(R, 'build', 'fg.html'); fs.mkdirSync(path.dirname(tmp), { recursive: true }); fs.writeFileSync(tmp, html);
  const b = await loadPW().chromium.launch(); const pg = await b.newPage({ viewport: { width: 1024, height: 500 } });
  await pg.goto(require('url').pathToFileURL(tmp).href); await pg.evaluate(() => document.fonts.ready);
  const w = await pg.evaluate(() => document.querySelector('p').getBoundingClientRect().left);
  if (w < 30) console.warn('WARNING: feature line too close to the edge (' + w + 'px)');
  const png = path.join(R, 'build', 'fg.png'); await pg.screenshot({ path: png }); await b.close();
  // drop the alpha channel (Play wants 24-bit)
  cp.execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', png, '-pix_fmt', 'rgb24', path.join(R, 'store', 'play', 'feature-graphic-1024x500.png')]);
  console.log('store/play/feature-graphic-1024x500.png');
})();
