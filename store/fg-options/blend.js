// Feature graphic: three ways to blend the gold-cover icon into the navy design. node store/fg-options/blend.js -> b1..b3.png + blend-sheet.png
const path = require('path'), fs = require('fs'), cp = require('child_process');
let root = cp.execSync('npm root -g', { encoding: 'utf8', shell: true }).trim(), pw;
for (const s of ['playwright', '@playwright/test/node_modules/playwright']) { try { pw = require(path.join(root, s)); break; } catch (e) {} }
const R = path.resolve(__dirname, '..', '..'), D = __dirname, U = f => require('url').pathToFileURL(path.join(R, f)).href;
global.window = global; require(path.join(R, 'web', 'quran-data.js'));
const AYAH = window.QURAN.t[53][16].split(' ').slice(0, 4).join(' ');
const ICON = U('store/icon-options/icon-1024.png'), TEX = U('store/icon-options/adaptive-1024.png');
const BASE = `@font-face{font-family:Cairo;font-weight:700;src:url(${U('web/fonts/cairo-700.woff2')})}
@font-face{font-family:Cairo;font-weight:600;src:url(${U('web/fonts/cairo-600.woff2')})}
@font-face{font-family:AmiriQ;src:url(${U('web/fonts/amiri-quran.woff2')})}
html,body{margin:0;width:1024px;height:500px;overflow:hidden}body{font-family:Cairo,sans-serif;color:#fff;position:relative;background:#0f1e35}
.t{position:absolute;display:flex;flex-direction:column;align-items:center}h1{margin:0;font:700 112px/1.05 Cairo;text-shadow:0 4px 18px rgba(0,0,0,.35)}
.ay{font-family:AmiriQ,serif;color:#f0d79a;font-size:46px;line-height:1.9;margin:4px 0 12px;white-space:nowrap}.ay b{font-weight:400;color:#c9a14a}
.chips{display:flex;gap:10px;white-space:nowrap}.chips span{border:1.5px solid rgba(240,215,154,.55);color:#f3e7c4;border-radius:999px;padding:2px 16px;font:600 20px/1.6 Cairo;background:rgba(15,30,53,.35)}`;
const TXT = (style) => `<div class="t" style="${style}"><h1>يسّرنا</h1><div class="ay"><b>﴿</b>${AYAH}<b>﴾</b></div>
  <div class="chips"><span>حفظ</span><span>تسميع</span><span>تفسير</span><span>تجويد</span><span>بدون إنترنت</span></div></div>`;
const V = {
  // b1: the real cover fills the right side and fades into the navy: no card, no frame, one surface
  b1: `<style>${BASE}.cover{position:absolute;right:0;top:0;width:560px;height:500px;background:url(${ICON}) center 46%/560px auto no-repeat;
      -webkit-mask-image:linear-gradient(to left,#000 45%,transparent 100%);mask-image:linear-gradient(to left,#000 45%,transparent 100%)}
      body{background:radial-gradient(120% 140% at 100% 50%,#1e3a5f 0%,#0f1e35 70%)}</style>
      <div class="cover"></div>${TXT('left:40px;top:50%;transform:translateY(-50%);width:560px')}`,
  // b2: the icon as a round medallion set into the navy, ringed in the same gold as the ayah; the cover's arabesque
  //     repeats very faintly over the whole background so icon and page share one texture
  b2: `<style>${BASE}body{background:linear-gradient(115deg,#0f1e35 0%,#1e3a5f 55%,#2b5283 100%)}
      .tex{position:absolute;inset:0;background:url(${TEX}) center/420px auto repeat;opacity:.07;mix-blend-mode:screen;filter:grayscale(1)}
      .med{position:absolute;right:64px;top:50%;width:260px;height:260px;margin-top:-130px;border-radius:50%;background:url(${ICON}) center/cover;
      box-shadow:0 0 0 5px #0f1e35,0 0 0 8px #d9b25a,0 0 0 14px rgba(217,178,90,.18),0 20px 50px rgba(0,0,0,.45)}</style>
      <div class="tex"></div><div class="med"></div>${TXT('left:40px;top:50%;transform:translateY(-50%);width:620px')}`,
  // b3: the cover photo is the whole background, tinted navy on the text side; the medallion with the word stays bright
  b3: `<style>${BASE}body{background:url(${TEX}) 100% 50%/700px auto no-repeat,#0f1e35}
      .tint{position:absolute;inset:0;background:linear-gradient(to right,rgba(15,30,53,.97) 0%,rgba(15,30,53,.94) 48%,rgba(15,30,53,.55) 68%,rgba(15,30,53,0) 88%)}
      .glow{position:absolute;right:120px;top:50%;width:300px;height:300px;margin-top:-150px;border-radius:50%;
      background:url(${ICON}) center/cover;-webkit-mask-image:radial-gradient(circle,#000 58%,transparent 72%);mask-image:radial-gradient(circle,#000 58%,transparent 72%)}</style>
      <div class="tint"></div><div class="glow"></div>${TXT('left:40px;top:50%;transform:translateY(-50%);width:560px')}`,
};
(async () => {
  const b = await pw.chromium.launch(), pg = await b.newPage({ viewport: { width: 1024, height: 500 } });
  for (const [k, body] of Object.entries(V)) {
    const f = path.join(D, k + '.html'); fs.writeFileSync(f, `<!doctype html><html dir="rtl"><head><meta charset="utf-8"></head><body>${body}</body></html>`);
    await pg.goto(require('url').pathToFileURL(f).href); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(300);
    await pg.screenshot({ path: path.join(D, k + '.png') });
  }
  await b.close();
  cp.execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(D, 'b1.png'), '-i', path.join(D, 'b2.png'), '-i', path.join(D, 'b3.png'),
    '-filter_complex', '[0][1][2]vstack=3', path.join(D, 'blend-sheet.png')]);
  console.log('ok');
})();
