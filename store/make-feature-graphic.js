// Builds store/play/feature-graphic-1024x500.png (Google Play: 1024x500, 24-bit PNG, no alpha) in headless Chromium.
// Layout 1 (chosen 2026-11-12): icon on the right; one centred column: name 112px, ayah 46px, feature chips 20px.
// The ayah (Al-Qamar 54:17, first four words) comes from web/quran-data.js, so it stays letter-identical to the app's text.
// Usage: node store/make-feature-graphic.js   (ICON=path.png to try another icon)
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
const url = f => require('url').pathToFileURL(path.isAbsolute(f) ? f : path.join(R, f)).href;
global.window = global; require(path.join(R, 'web', 'quran-data.js'));
const AYAH = window.QURAN.t[53][16].split(' ').slice(0, 4).join(' ');   // وَلَقَدۡ يَسَّرۡنَا ٱلۡقُرۡءَانَ لِلذِّكۡرِ
const ICON = process.env.ICON || 'store/icon-512.png';
const CHIPS = ['حفظ', 'تسميع', 'تفسير', 'تجويد', 'بدون إنترنت'];
const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
@font-face { font-family: Cairo; font-weight: 700; src: url(${url('web/fonts/cairo-700.woff2')}); }
@font-face { font-family: Cairo; font-weight: 600; src: url(${url('web/fonts/cairo-600.woff2')}); }
@font-face { font-family: AmiriQ; src: url(${url('web/fonts/amiri-quran.woff2')}); }
html, body { margin: 0; width: 1024px; height: 500px; overflow: hidden; }
body { font-family: Cairo, sans-serif; color: #fff; display: flex; align-items: center; justify-content: center; gap: 56px;
  background: radial-gradient(120% 140% at 85% 20%, #2b5283 0%, #1e3a5f 45%, #0f1e35 100%); }
img { width: 220px; height: 220px; border-radius: 50px; box-shadow: 0 18px 40px rgba(0,0,0,.35); }
.t { display: flex; flex-direction: column; align-items: center; }
h1 { margin: 0; font: 700 112px/1.05 Cairo; }
.ay { font-family: AmiriQ, serif; color: #f0d79a; font-size: 46px; line-height: 1.9; margin: 4px 0 12px; white-space: nowrap; }
.ay b { font-weight: 400; color: #c9a14a; }
.chips { display: flex; gap: 10px; white-space: nowrap; }
.chips span { border: 1.5px solid rgba(240,215,154,.55); color: #f3e7c4; border-radius: 999px; padding: 2px 16px; font: 600 20px/1.6 Cairo; }
</style></head><body><img src="${url(ICON)}"><div class="t"><h1>يسّرنا</h1>
<div class="ay"><b>﴿</b>${AYAH}<b>﴾</b></div><div class="chips">${CHIPS.map(c => '<span>' + c + '</span>').join('')}</div></div></body></html>`;
(async () => {
  const tmp = path.join(R, 'build', 'fg.html'); fs.mkdirSync(path.dirname(tmp), { recursive: true }); fs.writeFileSync(tmp, html);
  const b = await loadPW().chromium.launch(); const pg = await b.newPage({ viewport: { width: 1024, height: 500 } });
  await pg.goto(require('url').pathToFileURL(tmp).href); await pg.evaluate(() => document.fonts.ready);
  const bad = await pg.evaluate(() => [...document.querySelectorAll('h1,.ay,.chips,img')].some(e => { const r = e.getBoundingClientRect(); return r.left < 24 || r.right > 1000 || r.top < 16 || r.bottom > 484; }));
  if (bad) console.warn('WARNING: something is within 24px of the edge');
  const png = path.join(R, 'build', 'fg.png'); await pg.screenshot({ path: png }); await b.close();
  const out = process.env.OUT_PNG || path.join(R, 'store', 'play', 'feature-graphic-1024x500.png');
  cp.execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', png, '-pix_fmt', 'rgb24', out]);
  console.log(out);
})();
