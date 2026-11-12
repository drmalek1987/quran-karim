// Feature-graphic layout options (1024x500). node store/fg-options/render.js -> v1.png v2.png v3.png + sheet.png
const path = require('path'), fs = require('fs'), cp = require('child_process');
let root = cp.execSync('npm root -g', { encoding: 'utf8', shell: true }).trim(), pw;
for (const s of ['playwright', '@playwright/test/node_modules/playwright']) { try { pw = require(path.join(root, s)); break; } catch (e) {} }
const R = path.resolve(__dirname, '..', '..'), D = __dirname;
const U = f => require('url').pathToFileURL(path.join(R, f)).href;
global.window = global; require(path.join(R, 'web', 'quran-data.js'));
const AYAH = window.QURAN.t[53][16].split(' ').slice(0, 4).join(' ');
const ICON = U('store/icon-512.png');
const BASE = `@font-face{font-family:Cairo;font-weight:700;src:url(${U('web/fonts/cairo-700.woff2')})}
@font-face{font-family:Cairo;font-weight:600;src:url(${U('web/fonts/cairo-600.woff2')})}
@font-face{font-family:AmiriQ;src:url(${U('web/fonts/amiri-quran.woff2')})}
html,body{margin:0;width:1024px;height:500px;overflow:hidden}
body{font-family:Cairo,sans-serif;color:#fff;background:radial-gradient(120% 140% at 85% 20%,#2b5283 0%,#1e3a5f 45%,#0f1e35 100%);position:relative}
.ay{font-family:AmiriQ,serif;color:#f0d79a;white-space:nowrap}.ay b{font-weight:400;color:#c9a14a}
.chips{display:flex;gap:10px;white-space:nowrap}.chips span{border:1.5px solid rgba(240,215,154,.55);color:#f3e7c4;border-radius:999px;padding:2px 16px;font:600 20px/1.6 Cairo}
.orn{display:none}`;
const CH = '<div class="chips"><span>حفظ</span><span>تسميع</span><span>تفسير</span><span>تجويد</span><span>بدون إنترنت</span></div>';
const V = {
  // v1: icon right, one text column, sizes on a 1 : 0.42 : 0.18 scale, everything right-aligned on the same edge
  v1: `<style>${BASE}body{display:flex;align-items:center;justify-content:center;gap:56px}
    img{width:220px;height:220px;border-radius:50px;box-shadow:0 18px 40px rgba(0,0,0,.35)}
    .t{display:flex;flex-direction:column;align-items:center}h1{margin:0;font:700 112px/1.05 Cairo}
    .ay{font-size:46px;line-height:1.9;margin:4px 0 12px}</style>
    <div class="orn"></div><img src="${ICON}"><div class="t"><h1>يسّرنا</h1><div class="ay"><b>﴿</b>${AYAH}<b>﴾</b></div>${CH}</div>`,
  // v2: centred, no icon: name, ayah, chips — reads well even with Play's overlays at the edges
  v2: `<style>${BASE}body{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
    h1{margin:0;font:700 124px/1 Cairo;letter-spacing:1px}.ay{font-size:50px;line-height:1.9;margin:6px 0 14px}
    .rule{width:120px;height:3px;border-radius:2px;background:linear-gradient(90deg,transparent,#d9b25a,transparent);margin:14px 0 0}</style>
    <div class="orn"></div><h1>يسّرنا</h1><div class="rule"></div><div class="ay"><b>﴿</b>${AYAH}<b>﴾</b></div>${CH}`,
  // v3: the ayah is the hero across the top, name + icon below it
  v3: `<style>${BASE}body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}
    .ay{font-size:64px;line-height:1.7;margin-bottom:8px}.row{display:flex;align-items:center;gap:26px}
    img{width:112px;height:112px;border-radius:28px;box-shadow:0 10px 24px rgba(0,0,0,.35)}
    h1{margin:0 0 10px;font:700 80px/1 Cairo}.sub{font:600 21px/1.5 Cairo;color:#dfe6f0}</style>
    <div class="orn"></div><div class="ay"><b>﴿</b>${AYAH}<b>﴾</b></div>
    <div class="row"><img src="${ICON}"><div><h1>يسّرنا</h1><div class="sub">حفظ وتسميع القرآن · تفسير · تجويد · بدون إنترنت</div></div></div>`,
};
(async () => {
  const b = await pw.chromium.launch(), pg = await b.newPage({ viewport: { width: 1024, height: 500 } });
  for (const [k, body] of Object.entries(V)) {
    const f = path.join(D, k + '.html'); fs.writeFileSync(f, `<!doctype html><html dir="rtl"><head><meta charset="utf-8"></head><body>${body}</body></html>`);
    await pg.goto(require('url').pathToFileURL(f).href); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(200);
    const over = await pg.evaluate(() => [...document.querySelectorAll('h1,.ay,.chips,.sub,img')].some(e => { const r = e.getBoundingClientRect(); return r.left < 24 || r.right > 1000 || r.top < 16 || r.bottom > 484; }));
    if (over) console.warn(k + ': something is within 24px of the edge');
    await pg.screenshot({ path: path.join(D, k + '.png') });
  }
  await b.close();
  cp.execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(D, 'v1.png'), '-i', path.join(D, 'v2.png'), '-i', path.join(D, 'v3.png'),
    '-filter_complex', '[0][1][2]vstack=3', path.join(D, 'sheet.png')]);
  console.log('ok');
})();
