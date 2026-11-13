// YouTube thumbnail for the promo video (1280×720 JPEG, under 2 MB): big caption on the right, a phone on the left
// zoomed in on the real surah-review screen (store/video/clips/review, from clips.js) with its red wrong-word mark.
// Variant B uses the live-follow state (the box on the recited word) instead.
// Usage: node store/video/make-thumb.js [a|b]   -> store/video/out/thumb-<a|b>.jpg
const path = require('path'), fs = require('fs');
const { loadPW, url } = require('./common');
const VAR = process.argv[2] === 'b' ? 'b' : 'a';
const CL = path.join(__dirname, 'clips'), OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const REV = JSON.parse(fs.readFileSync(path.join(CL, 'review', 'meta.json'), 'utf8'));
const LIVE = JSON.parse(fs.readFileSync(path.join(CL, 'live', 'meta.json'), 'utf8'));
// the shot and the point (app px, 360×640 page) to zoom on
const last = REV.states[REV.states.length - 1], li = LIVE.states[14];
const [img, fx, fy, mark] = VAR === 'a'
  ? [path.join(CL, 'review', last.f), last.bad[0][0] + last.bad[0][2] / 2, last.bad[0][1] + last.bad[0][3] / 2, last.bad[0]]
  : [path.join(CL, 'live', li.f), li.box[0] + li.box[2] / 2, li.box[1] + li.box[3] / 2, null];
const SW = 400, SH = 640, Z = 2.4, K = SW / 360 * Z;     // phone screen size and zoom
const tx = Math.min(0, Math.max(SW - 360 * K, SW / 2 - fx * K)), ty = Math.min(0, Math.max(SH - 640 * K, SH * 0.34 - fy * K));
const ring = mark ? `<div class="ring" style="left:${tx + (mark[0] - 1) * K - 6}px;top:${ty + (mark[1] - 1) * K - 6}px;width:${(mark[2] + 2) * K}px;height:${(mark[3] + 2) * K}px"></div>` : '';
const WIFI_OFF = '<svg viewBox="0 0 24 24"><path d="M23.64 7c-.45-.34-4.93-4-11.64-4-1.5 0-2.89.19-4.15.48L18.18 13.8 23.64 7zm-6.6 8.22L3.27 1.44 2 2.72l2.05 2.06C1.91 5.76.59 6.82.36 7l11.63 14.49.01.01.01-.01 3.9-4.86 3.32 3.32 1.27-1.27-3.46-3.46z"/></svg>';
const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>
@font-face { font-family: Cairo; font-weight: 700; src: url(${url('web/fonts/cairo-700.woff2')}); }
@font-face { font-family: Cairo; font-weight: 600; src: url(${url('web/fonts/cairo-600.woff2')}); }
@font-face { font-family: CairoL; font-weight: 600; src: url(${url('web/fonts/cairo-latin-600.woff2')}); }
html, body { margin: 0; width: 1280px; height: 720px; overflow: hidden; }
body { font-family: Cairo, sans-serif; color: #fff; position: relative;
  background: radial-gradient(90% 120% at 80% 20%, #2f5a90 0%, #1e3a5f 45%, #0b1729 100%); }
.pat { position: absolute; inset: 0; opacity: .08; background-size: 120px 120px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cg fill='none' stroke='%23f0d79a' stroke-width='1.6'%3E%3Crect x='36' y='36' width='48' height='48'/%3E%3Crect x='36' y='36' width='48' height='48' transform='rotate(45 60 60)'/%3E%3C/g%3E%3C/svg%3E"); }
.t { position: absolute; right: 64px; top: 44px; width: 700px; }
.icon { display: flex; align-items: center; gap: 18px; }
.icon img { width: 96px; height: 96px; border-radius: 22px; box-shadow: 0 8px 24px rgba(0,0,0,.45), 0 0 0 2px rgba(240,215,154,.4); }
.icon span { font: 700 40px Cairo; color: #f0d79a; }
h1 { margin: 18px 0 0; font: 700 106px/1.1 Cairo; letter-spacing: -1px; text-shadow: 0 6px 24px rgba(0,0,0,.4); }
h1 em { font-style: normal; color: #f0d79a; }
h2 { margin: 14px 0 0; font: 700 46px/1.3 Cairo; color: #fff; }
.en { direction: ltr; text-align: right; font: 600 28px/1.3 CairoL, sans-serif; color: rgba(255,255,255,.72); margin: 4px 0 0; }
.en.g { color: #f0d79a; font-size: 32px; }
.off .e { font: 600 28px CairoL, sans-serif; opacity: .8; }
h2 b { color: #ff6b6b; }
.off { display: inline-flex; align-items: center; gap: 14px; margin-top: 22px; padding: 8px 30px; border-radius: 999px;
  background: #c09a2e; color: #0f1e35; font: 700 40px Cairo; box-shadow: 0 8px 24px rgba(0,0,0,.35); }
.off svg { width: 40px; height: 40px; fill: #0f1e35; }
.ph { position: absolute; left: 70px; top: 40px; padding: 12px; border-radius: 48px; background: #0a1322; transform: rotate(-4deg);
  box-shadow: 0 30px 70px rgba(0,0,0,.6), 0 0 0 2px rgba(240,215,154,.3); }
.scr { width: ${SW}px; height: ${SH}px; border-radius: 38px; overflow: hidden; position: relative; background: #fbf7ee; }
.scr img { position: absolute; left: ${tx}px; top: ${ty}px; width: ${360 * K}px; }
.ring { position: absolute; border: 6px solid #e23d3d; border-radius: 14px; box-shadow: 0 0 0 8px rgba(226,61,61,.25), 0 0 30px rgba(226,61,61,.6); }
.mic { position: absolute; left: 44px; bottom: 34px; width: 128px; height: 128px; border-radius: 50%; background: #e23d3d; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 0 14px rgba(226,61,61,.25), 0 0 0 30px rgba(226,61,61,.12), 0 14px 30px rgba(0,0,0,.45); }
.mic svg { width: 64px; height: 64px; fill: #fff; }
</style></head><body><div class="pat"></div>
<div class="ph"><div class="scr"><img src="${url(img)}">${ring}</div></div>
<div class="mic"><svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg></div>
<div class="t"><div class="icon"><img src="${url('store/icon-options/icon-1024.png')}"><span>لَوْح</span></div>
<h1>سمِّع القرآن<br><em>بصوتك</em></h1><p class="en g">Recite the Quran by voice</p>
<h2>${VAR === 'a' ? 'ويُعلِّم لك <b>الخطأ</b> كلمةً كلمة' : 'ويتابعك التطبيق كلمةً كلمة'}</h2><p class="en">${VAR === 'a' ? 'Your mistakes marked, word by word' : 'The app follows you, word by word'}</p>
<div class="off">${WIFI_OFF}دون إنترنت <span class="e">· Offline</span></div></div>
</body></html>`;
(async () => {
  const tmp = path.join(OUT, 'thumb.html'); fs.writeFileSync(tmp, html);
  const b = await loadPW().chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await pg.goto(require('url').pathToFileURL(tmp).href); await pg.evaluate(() => document.fonts.ready);
  const bad = await pg.evaluate(() => [...document.querySelectorAll('.t > *')].filter(e => { const r = e.getBoundingClientRect(); return r.right > 1260 || r.bottom > 700 || r.left < 500; }).map(e => e.tagName));
  if (bad.length) console.warn('text outside its area:', bad);
  const f = path.join(OUT, `thumb-${VAR}.jpg`); await pg.screenshot({ path: f, type: 'jpeg', quality: 92 });
  console.log('wrote', f, (fs.statSync(f).size / 1024).toFixed(0) + ' KB'); await b.close();
})();
