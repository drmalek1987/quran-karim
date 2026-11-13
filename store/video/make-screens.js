// Designed Google Play phone screenshots (8, the most Play takes): 1080×1920 PNG, 24-bit, no alpha. Same look as the
// promo video: a caption in Modern Standard Arabic with an English line, a «دون إنترنت» badge, and phone(s) showing the
// real app screens from store/video/shots/ and the clip states in store/video/clips/ (zoomed on the feature).
// Run shots.js and clips.js first. Usage: node store/video/make-screens.js [n ...]  -> store/play/lawh-phone-<n>-<id>.png
const path = require('path'), fs = require('fs');
const { loadPW, R, url } = require('./common');
const CL = path.join(__dirname, 'clips'), SH = path.join(__dirname, 'shots'), OUT = path.join(R, 'store', 'play');
const meta = n => JSON.parse(fs.readFileSync(path.join(CL, n, 'meta.json'), 'utf8'));
const LIVE = meta('live'), REV = meta('review'), STA = meta('stats');
const rb = REV.states[REV.states.length - 1].bad[0], lw = LIVE.states[13].box;
const STA_H = fs.readFileSync(path.join(CL, 'stats', 'full.png')).readUInt32BE(20) / 3;
// a phone: [image, zoom, focus x, focus y (app px of a 360-wide page), content height, red mark box]
const P = (img, z = 1, fx = 180, fy = 320, ch = 640, mark = null) => ({ img, z, fx, fy, ch, mark });
const shot = n => path.join(SH, n + '.png');
const SCREENS = [
  ['recite', 'سمِّع بصوتك', 'ويتابعك التطبيق كلمةً كلمة على صفحة المصحف', 'Recite aloud – the app follows you word by word',
    [P(path.join(CL, 'live', LIVE.states[13].f), 1.6, 180, lw[1] + 125)], true],
  ['review', 'مراجعة السورة', 'تُخفى الآيات وتظهر أثناء القراءة، ويُعلَّم الخطأ بالأحمر', 'Covered verses open as you recite; slips are marked in red',
    [P(path.join(CL, 'review', REV.states[REV.states.length - 1].f), 1.5, 180, rb[1] + 150, 640, rb)], true],
  ['talqin', 'التلقين', 'استمع إلى الآية من القارئ وردّدها حتى تثبت', 'Talqin: listen, repeat, memorise', [P(shot('talqin'))]],
  ['hifzmap', 'خريطة الحفظ', 'كل صفحة حفظتها بلونها، والمراجعة المتباعدة تخبرك بما تراجعه اليوم', 'Your hifz map and spaced review', [P(shot('hifzmap')), P(shot('review'))]],
  ['mutash', 'المتشابهات والطلاب', 'اختبر نفسك في الآيات المتشابهة، وأرسل نتيجتك إلى المحفّظ', 'Similar-verse tests, results shared with your teacher', [P(shot('mutash')), P(shot('students'))]],
  ['stats', 'إحصائياتك', 'وردك اليومي، أيام الالتزام، المكافآت، ونسبة الحفظ', 'Your reading, streaks, rewards and hifz progress',
    [P(path.join(CL, 'stats', 'full.png'), 1, 180, 320, STA_H), P(path.join(CL, 'stats', 'full.png'), 1, 180, STA.cards[1].box[1] + 260, STA_H)]],
  ['editions', 'ثلاث طبعات للمصحف', 'الملك فهد · المدينة القديمة · الشمرلي', 'Three printed Mushaf editions', [P(shot('kfold')), P(shot('kfgqpc')), P(shot('shamarly'))]],
  ['more', 'تفسير وتجويد وأذكار', 'ابن كثير · الطبري · القرطبي · السعدي · ختمة · مواقيت الصلاة والقبلة', 'Tafsir, colour tajweed, khatma, adhkar, prayer times & Qibla', [P(shot('tajweed')), P(shot('tafsir')), P(shot('prayer'))]],
];
const WIFI_OFF = '<svg viewBox="0 0 24 24"><path d="M23.64 7c-.45-.34-4.93-4-11.64-4-1.5 0-2.89.19-4.15.48L18.18 13.8 23.64 7zm-6.6 8.22L3.27 1.44 2 2.72l2.05 2.06C1.91 5.76.59 6.82.36 7l11.63 14.49.01.01.01-.01 3.9-4.86 3.32 3.32 1.27-1.27-3.46-3.46z"/></svg>';
function phone(p, w) {   // screen w px wide, 16:9; camera: show (fx, fy) at the centre with zoom z, within the content
  const h = Math.round(w * 16 / 9), k = w / 360 * p.z;
  const tx = Math.min(0, Math.max(w - 360 * k, w / 2 - p.fx * k)), ty = Math.min(0, Math.max(h - p.ch * k, h / 2 - p.fy * k));
  const ring = p.mark ? `<div class="ring" style="left:${tx + (p.mark[0] - 1) * k - 6}px;top:${ty + (p.mark[1] - 1) * k - 6}px;width:${(p.mark[2] + 2) * k}px;height:${(p.mark[3] + 2) * k}px"></div>` : '';
  return `<div class="ph"><div class="scr" style="width:${w}px;height:${h}px"><img src="${url(p.img)}" style="left:${tx}px;top:${ty}px;width:${360 * k}px">${ring}</div></div>`;
}
const page = ([id, t, sub, en, phones, big]) => {
  const n = phones.length, w = n === 1 ? 800 : n === 2 ? 520 : 430;
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>
@font-face { font-family: Cairo; font-weight: 700; src: url(${url('web/fonts/cairo-700.woff2')}); }
@font-face { font-family: Cairo; font-weight: 600; src: url(${url('web/fonts/cairo-600.woff2')}); }
@font-face { font-family: CairoL; font-weight: 600; src: url(${url('web/fonts/cairo-latin-600.woff2')}); }
html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; }
body { font-family: Cairo, sans-serif; color: #fff; position: relative; background: radial-gradient(90% 70% at 70% 10%, #2f5a90 0%, #1e3a5f 45%, #0b1729 100%); }
.pat { position: absolute; inset: 0; opacity: .07; background-size: 140px 140px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cg fill='none' stroke='%23f0d79a' stroke-width='1.6'%3E%3Crect x='42' y='42' width='56' height='56'/%3E%3Crect x='42' y='42' width='56' height='56' transform='rotate(45 70 70)'/%3E%3C/g%3E%3C/svg%3E"); }
.cap { position: absolute; top: 96px; left: 70px; right: 70px; text-align: center; }
.cap::before { content: ''; display: block; width: 120px; height: 5px; border-radius: 3px; background: #c09a2e; margin: 0 auto 30px; }
h1 { margin: 0; font: 700 ${big ? 104 : 92}px/1.2 Cairo; text-shadow: 0 6px 24px rgba(0,0,0,.35); }
.sub { margin: 18px 0 0; font: 600 42px/1.45 Cairo; color: #f0d79a; }
.en { margin: 14px 0 0; direction: ltr; font: 600 30px/1.4 CairoL, sans-serif; color: rgba(255,255,255,.66); }
.off { display: inline-flex; align-items: center; gap: 12px; margin-top: 26px; padding: 8px 28px; border-radius: 999px;
  border: 2px solid rgba(240,215,154,.6); background: rgba(15,30,53,.55); color: #f0d79a; font: 700 32px Cairo; }
.off svg { width: 34px; height: 34px; fill: #f0d79a; } .off .e { font: 600 26px CairoL, sans-serif; opacity: .8; }
.phones { position: absolute; left: 0; right: 0; top: ${n === 1 ? 640 : 700}px; display: flex; justify-content: center; align-items: flex-start; }
.ph { padding: 14px; border-radius: 60px; background: #0a1322; box-shadow: 0 40px 90px rgba(0,0,0,.55), 0 0 0 2px rgba(240,215,154,.2); flex: none; }
.scr { position: relative; overflow: hidden; border-radius: 46px; background: #fbf7ee; }
.scr img { position: absolute; }
.ring { position: absolute; border: 7px solid #e23d3d; border-radius: 16px; box-shadow: 0 0 0 10px rgba(226,61,61,.22), 0 0 34px rgba(226,61,61,.6); }
.n2 .ph + .ph { margin-right: -110px; } .n2 .ph:nth-child(1) { transform: translateY(70px) rotate(5deg); } .n2 .ph:nth-child(2) { transform: rotate(-4deg); z-index: 2; }
.n3 .ph + .ph { margin-right: -150px; } .n3 .ph:nth-child(1) { transform: translateY(90px) rotate(6deg); } .n3 .ph:nth-child(2) { z-index: 2; } .n3 .ph:nth-child(3) { transform: translateY(90px) rotate(-6deg); }
</style></head><body><div class="pat"></div>
<div class="cap"><h1>${t}</h1><p class="sub">${sub}</p><p class="en">${en}</p><div class="off">${WIFI_OFF}دون إنترنت <span class="e">· Offline</span></div></div>
<div class="phones n${n}">${phones.map(p => phone(p, w)).join('')}</div></body></html>`;
};
(async () => {
  const want = process.argv.slice(2).map(Number); const b = await loadPW().chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } }); const tmp = path.join(__dirname, 'out', 'screen.html');
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  for (const [i, s] of SCREENS.entries()) {
    if (want.length && !want.includes(i + 1)) continue;
    fs.writeFileSync(tmp, page(s)); await pg.goto(require('url').pathToFileURL(tmp).href); await pg.evaluate(() => document.fonts.ready);
    const capB = await pg.evaluate(() => document.querySelector('.cap').getBoundingClientRect().bottom), phT = await pg.evaluate(() => document.querySelector('.phones').getBoundingClientRect().top);
    if (capB > phT - 20) console.warn(s[0], 'caption runs into the phones', Math.round(capB), Math.round(phT));
    const f = path.join(OUT, `lawh-phone-${i + 1}-${s[0]}.png`); const tmpPng = f + '.rgba.png'; await pg.screenshot({ path: tmpPng, type: 'png' });
    // Play wants 24-bit PNG without alpha
    require('child_process').execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmpPng, '-pix_fmt', 'rgb24', f]); fs.unlinkSync(tmpPng);
    console.log('wrote', path.basename(f));
  }
  await b.close();
})();
