// Arabic UI font specimens (Google Fonts, all OFL) with the app's own words. node tools/qa/font-specimens.js -> build/fonts/specimens.png
const path = require('path'), fs = require('fs'), cp = require('child_process');
let root = cp.execSync('npm root -g', { encoding: 'utf8', shell: true }).trim(), pw;
for (const s of ['playwright', '@playwright/test/node_modules/playwright']) { try { pw = require(path.join(root, s)); break; } catch (e) {} }
const OUT = path.resolve(__dirname, '..', '..', 'build', 'fonts'); fs.mkdirSync(OUT, { recursive: true });
const F = [['Cairo', 'الحالي'], ['Tajawal', ''], ['IBM Plex Sans Arabic', ''], ['Noto Kufi Arabic', ''], ['Readex Pro', ''],
  ['Almarai', ''], ['Alexandria', ''], ['El Messiri', ''], ['Changa', ''], ['Noto Naskh Arabic', 'نسخ']];
const q = F.map(f => 'family=' + f[0].replace(/ /g, '+') + ':wght@400;700').join('&');
const rows = F.map(([n, note], i) => `<div class="r" style="font-family:'${n}'">
  <div class="n"><b>${i + 1}</b> ${n}${note ? ' · ' + note : ''}</div>
  <div class="s"><span class="t">يسّرنا</span><span class="m">الختمة والعلامات · مواقيت الصلاة · سمّع التكملة</span></div>
  <div class="p">هذه آية الكرسي، ولها شأن عظيم، وقد صح الحديث عن رسول الله ﷺ بأنها أفضل آية في كتاب الله. صفحة ٤٢ · الآية ٢٥٥ · ٣٠ يومًا</div></div>`).join('');
const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${q}&display=block">
<style>body{margin:0;background:#f2f3f6;color:#15201c;width:1100px}.r{background:#fff;margin:12px;border-radius:16px;padding:14px 22px;border-right:6px solid #1e3a5f}
.n{direction:ltr;text-align:left;font:600 15px system-ui;color:#6b7686}.n b{color:#c09a2e}
.s{display:flex;align-items:baseline;gap:26px}.t{font-size:46px;font-weight:700;color:#1e3a5f}.m{font-size:22px;font-weight:700}
.p{font-size:18px;line-height:1.8;font-weight:400;color:#2a3340}</style></head><body>${rows}</body></html>`;
(async () => {
  const f = path.join(OUT, 'specimens.html'); fs.writeFileSync(f, html);
  const b = await pw.chromium.launch(), pg = await b.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
  await pg.goto(require('url').pathToFileURL(f).href, { waitUntil: 'networkidle' }); await pg.evaluate(() => document.fonts.ready);
  const missing = await pg.evaluate(fs => fs.filter(n => !document.fonts.check('16px "' + n + '"')), F.map(x => x[0]));
  if (missing.length) console.warn('not loaded:', missing.join(', '));
  await pg.screenshot({ path: path.join(OUT, 'specimens.png'), fullPage: true }); await b.close(); console.log('ok');
})();
