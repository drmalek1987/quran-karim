// Play promo video for «لَوْح»: a silent, slow "brag-slim" film built as one HTML page whose look at time t is set by
// render(t), shot frame by frame in headless Chromium and piped into FFmpeg (H.264, 30 fps, no audio track).
// Inputs: store/video/shots/ (node store/video/shots.js) and the live-clip states in store/video/clips/
// (node store/video/clips.js). The camera moves over the clips (zoom on the mic, follow the word box, push in on the
// red word, scroll the statistics) are done here. The ayat and their English come from web/quran-data.js and
// web/translation-en.js, so the Quran text stays letter-identical to the app's.
// Claims are kept to what is measured: no accuracy figure; offline = after the one-time model download.
// Usage: node store/video/make-video.js [h|v] [--still t1,t2,...]
//   h = 1920×1080 (default), v = 1080×1920. --still writes PNGs of those seconds instead of the video (for the contact sheet).
const path = require('path'), fs = require('fs'), cp = require('child_process');
const { loadPW, R, url } = require('./common');
global.window = global; require(path.join(R, 'web', 'quran-data.js')); require(path.join(R, 'web', 'translation-en.js'));
const V = process.argv[2] === 'v', W = V ? 1080 : 1920, H = V ? 1920 : 1080, FPS = 30;
const si = process.argv.indexOf('--still'), STILLS = si > 0 ? process.argv[si + 1].split(',').map(Number) : null;
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const CL = path.join(__dirname, 'clips');
const AR = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const A21 = window.QURAN.t[84][20], A22 = window.QURAN.t[84][21];
const E21 = window.TR_EN[84][20], E22 = window.TR_EN[84][21];
const shot = n => url(path.join(__dirname, 'shots', n + '.png'));
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const LIVE = JSON.parse(fs.readFileSync(path.join(CL, 'live', 'meta.json'), 'utf8'));
const REV = JSON.parse(fs.readFileSync(path.join(CL, 'review', 'meta.json'), 'utf8'));
const STA = JSON.parse(fs.readFileSync(path.join(CL, 'stats', 'meta.json'), 'utf8'));
{ const f = path.join(CL, 'stats', 'full.png'), b = fs.readFileSync(f); STA.h = b.readUInt32BE(20) / 3; }

const XF = 0.9;   // neighbouring scenes overlap by XF seconds (a slow cross-dissolve)
const SC = []; let t0 = 0;
const add = (id, dur, kind, d = {}) => { SC.push({ id, s: t0, d: dur, kind, ...d }); t0 += dur - XF; };
add('open', 8.0, 'open');
add('live', 10.4, 'live', { t: 'سمِّع بصوتك، ويتابعك التطبيق كلمةً كلمة', sub: 'تعرّف دقيق وفوري على التلاوة، على جهازك', en: 'Accurate, instant recitation recognition – on your phone' });
add('rev', 9.6, 'rev', { t: 'مراجعة السورة', sub: 'تُخفى الآيات وتظهر أثناء القراءة، ويُعلَّم الخطأ بالأحمر', en: 'Covered verses open as you recite; slips are marked in red' });
[['talqin', 'التلقين', 'استمع إلى الآية من القارئ وردّدها حتى تثبت', 'Talqin: listen, repeat, memorise'],
 ['hifzmap', 'خريطة الحفظ', 'كل صفحة حفظتها بلونها، والمراجعة المتباعدة تخبرك بما تراجعه اليوم', 'Your hifz map and spaced review'],
 ['mutash', 'المتشابهات', 'اختبر نفسك في الآيات المتشابهة', 'Master the similar verses'],
 ['students', 'مشاركة الطلاب', 'يرسل الطالب نتيجته ويتابعها المحفّظ', 'Students send results, teachers follow up'],
].forEach(([n, t, sub, en]) => add(n, 3.6, 'feat', { imgs: [n], t, sub, en }));
add('stats', 6.6, 'stats', { t: 'إحصائياتك', sub: 'وردك اليومي، أيام الالتزام، المكافآت، ونسبة الحفظ', en: 'Your reading, streaks, rewards and hifz progress' });
[['eds', ['kfgqpc', 'kfold', 'shamarly'], 'ثلاث طبعات للمصحف', 'الملك فهد · المدينة القديمة · الشمرلي', 'Three printed Mushaf editions'],
 ['tafsir', ['tafsir', 'tajweed'], 'تفسير وتجويد ملوّن', 'ابن كثير · الطبري · القرطبي · السعدي', 'Tafsir and colour-coded tajweed'],
 ['daily', ['khatma', 'azkar', 'prayer', 'qibla'], 'الختمة والأذكار والصلاة', 'خطة ختمة · أذكار · مواقيت الصلاة والقبلة', 'Khatma plan, adhkar, prayer times & Qibla'],
].forEach(([id, imgs, t, sub, en]) => add(id, 4.0, 'feat', { imgs, t, sub, en }));
add('free', 4.6, 'free');
add('end', 5.4, 'end');
const TOTAL = t0 + XF;

const OFF = `<div class="off"><svg viewBox="0 0 24 24"><path d="M23.64 7c-.45-.34-4.93-4-11.64-4-1.5 0-2.89.19-4.15.48L18.18 13.8 23.64 7zm-6.6 8.22L3.27 1.44 2 2.72l2.05 2.06C1.91 5.76.59 6.82.36 7l11.63 14.49.01.01.01-.01 3.9-4.86 3.32 3.32 1.27-1.27-3.46-3.46z"/></svg>دون إنترنت</div>`;
const cap = s => `<div class="cap"><h2>${s.t}</h2><p class="sub">${s.sub}</p><p class="en">${s.en}</p></div>`;
const phone = (n, cls = '') => `<div class="ph ${cls}"><img src="${shot(n)}"></div>`;
// a phone whose screen is a camera over a stack of state images (only one shown at a time)
const camPhone = (imgs, extra = '') => `<div class="ph cam"><div class="scr"><div class="cv">${imgs.map((f, i) => `<img class="st" data-i="${i}" src="${f}">`).join('')}${extra}</div></div></div>`;
const body = SC.map(s => {
  if (s.kind === 'open') return `<section id="open">
    <div class="cover"><img src="${url('store/icon-options/icon-1024.png')}"></div>
    <div class="ayah"><div class="aq"><b>﴿</b>${A21} <span class="n">۝${AR(21)}</span>${V ? '<br>' : ''} ${A22} <span class="n">۝${AR(22)}</span><b>﴾</b></div>
      <div class="ref">سورة البروج</div><div class="aen">“${esc(E21)} ${esc(E22)}” <span>(85:21–22)</span></div></div></section>`;
  if (s.kind === 'live') return `<section id="live" class="feat n1">${cap(s)}<div class="phones">${camPhone(LIVE.states.map(x => url(path.join(CL, 'live', x.f))), '<div class="ring"></div><div class="ring r2"></div>')}${OFF}</div></section>`;
  if (s.kind === 'rev') return `<section id="rev" class="feat n1">${cap(s)}<div class="phones">${camPhone(REV.states.map(x => url(path.join(CL, 'review', x.f))), '<div class="badring"></div>')}${OFF}</div></section>`;
  if (s.kind === 'stats') return `<section id="stats" class="feat n1">${cap(s)}<div class="phones">${camPhone([url(path.join(CL, 'stats', 'full.png'))])}</div></section>`;
  if (s.kind === 'feat') return `<section id="${s.id}" class="feat n${s.imgs.length}">${cap(s)}<div class="phones">${s.imgs.map((n, i) => phone(n, 'p' + i)).join('')}</div></section>`;
  if (s.kind === 'free') return `<section id="free"><div class="plane"><svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg></div>
    <h2>يعمل دون إنترنت، حتى التسميع</h2><p class="en big">Works fully offline – even recitation recognition</p>
    <div class="chips"><span>دون إعلانات</span><span>دون حساب</span><span>بياناتك على جهازك</span></div>
    <p class="note">يعمل التعرّف على التلاوة بعد تنزيل النموذج مرةً واحدة · One-time model download</p></section>`;
  return `<section id="end"><img class="icon" src="${url('store/icon-options/icon-1024.png')}"><h1>لَوْح</h1>
    <p class="sub">حفظ وتسميع القرآن</p><p class="en">Lawh – Quran Hifz by Voice</p></section>`;
}).join('\n');

// phone screen size in px: app pages are 360×640 css px shot @3x
const PH1 = V ? 1220 : 900, PW1 = Math.round(PH1 * 9 / 16);
const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com"><link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@700&display=block" rel="stylesheet">
<style>
@font-face { font-family: Cairo; font-weight: 700; src: url(${url('web/fonts/cairo-700.woff2')}); }
@font-face { font-family: Cairo; font-weight: 600; src: url(${url('web/fonts/cairo-600.woff2')}); }
@font-face { font-family: Cairo; font-weight: 400; src: url(${url('web/fonts/cairo-400.woff2')}); }
@font-face { font-family: CairoL; font-weight: 400; src: url(${url('web/fonts/cairo-latin-400.woff2')}); }
@font-face { font-family: CairoL; font-weight: 600; src: url(${url('web/fonts/cairo-latin-600.woff2')}); }
@font-face { font-family: AmiriQ; src: url(${url('web/fonts/amiri-quran.woff2')}); }
:root { --navy: #1e3a5f; --deep: #0f1e35; --gold: #c09a2e; --gold2: #f0d79a; }
html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: var(--deep); }
body { font-family: Cairo, sans-serif; color: #fff; position: relative; }
#bg { position: absolute; inset: -120px; background: radial-gradient(70% 80% at 70% 30%, #2b5283 0%, var(--navy) 40%, var(--deep) 100%); }
#pat { position: absolute; inset: -200px; opacity: .07; background-size: 140px 140px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cg fill='none' stroke='%23f0d79a' stroke-width='1.6'%3E%3Crect x='42' y='42' width='56' height='56'/%3E%3Crect x='42' y='42' width='56' height='56' transform='rotate(45 70 70)'/%3E%3C/g%3E%3C/svg%3E"); }
#vig { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(120% 100% at 50% 50%, transparent 55%, rgba(5,10,20,.55) 100%); }
section { position: absolute; inset: 0; opacity: 0; display: flex; align-items: center; justify-content: center; }
.en { font-family: CairoL, Cairo, sans-serif; direction: ltr; color: rgba(255,255,255,.62); font-weight: 400; }
.sub { color: var(--gold2); font-weight: 600; }
/* opening */
#open { gap: ${V ? 70 : 110}px; flex-direction: ${V ? 'column' : 'row'}; }
.cover { width: ${V ? 640 : 600}px; height: ${V ? 640 : 600}px; border-radius: 64px; overflow: hidden; flex: none; box-shadow: 0 30px 80px rgba(0,0,0,.5), 0 0 0 2px rgba(240,215,154,.25); }
.cover img { width: 100%; height: 100%; display: block; }
.ayah { text-align: center; width: ${V ? 960 : 900}px; flex: none; }
.aq { font-family: AmiriQ, serif; color: var(--gold2); font-size: ${V ? 70 : 74}px; line-height: 2; white-space: ${V ? 'normal' : 'nowrap'}; }
.aq b { font-weight: 400; color: var(--gold); } .aq .n { color: var(--gold); }
.ref { font: 600 30px Cairo; color: rgba(240,215,154,.75); margin-top: 6px; }
.aen { font: 400 ${V ? 30 : 28}px/1.5 CairoL, sans-serif; direction: ltr; color: rgba(255,255,255,.6); margin-top: 22px; font-style: italic; }
.aen span { font-style: normal; color: rgba(240,215,154,.6); }
/* feature scenes */
.feat { flex-direction: ${V ? 'column' : 'row'}; gap: ${V ? 60 : 120}px; ${V ? 'justify-content: flex-start; padding-top: 140px; box-sizing: border-box;' : ''} }
.cap { width: ${V ? 960 : 720}px; text-align: ${V ? 'center' : 'right'}; }
.cap h2 { margin: 0; font: 700 ${V ? 74 : 76}px/1.3 Cairo; }
.cap .sub { font-size: ${V ? 40 : 38}px; line-height: 1.5; margin: 22px 0 0; }
.cap .en { font-size: ${V ? 32 : 30}px; margin: 18px 0 0; }
.cap::before { content: ''; display: block; width: 120px; height: 4px; border-radius: 2px; background: var(--gold); margin: ${V ? '0 auto 34px' : '0 0 34px auto'}; }
.phones { position: relative; display: flex; align-items: center; justify-content: center; }
.ph { background: #0a1322; border-radius: 52px; padding: 13px; box-shadow: 0 40px 90px rgba(0,0,0,.55), 0 0 0 2px rgba(240,215,154,.18); }
.ph img { display: block; border-radius: 40px; }
.n1 .ph img { height: ${PH1}px; }
.n2 .ph img { height: ${V ? 1060 : 820}px; } .n2 .ph + .ph { margin-right: -60px; }
.n3 .ph img { height: ${V ? 720 : 700}px; } .n3 .ph + .ph { margin-right: ${V ? -160 : -120}px; }
.n4 .ph img { height: ${V ? 640 : 620}px; } .n4 .ph + .ph { margin-right: ${V ? -230 : -170}px; }
.n3 .p1, .n4 .p1, .n4 .p2 { z-index: 2; }
${V ? '' : '.n3 .cap, .n4 .cap { width: 600px; } .n4, .n3 { gap: 80px; }'}
/* camera phones: .scr is the screen window, .cv the content moved by the camera (origin top-left, app px × k) */
.ph.cam .scr { width: ${PW1}px; height: ${PH1}px; border-radius: 40px; overflow: hidden; position: relative; background: #fbf7ee; }
.ph.cam .cv { position: absolute; left: 0; top: 0; width: ${PW1}px; transform-origin: 0 0; }
.ph.cam .cv img.st { position: absolute; left: 0; top: 0; width: ${PW1}px; height: auto; border-radius: 0; visibility: hidden; }
.ring, .badring { position: absolute; border-radius: 50%; border: 3px solid rgba(226,61,61,.9); opacity: 0; }
.badring { border-radius: 10px; border-color: #e23d3d; box-shadow: 0 0 0 4px rgba(226,61,61,.25); }
.off { position: absolute; top: ${V ? -74 : -62}px; left: 50%; margin-left: -150px; width: 300px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 12px;
  background: rgba(15,30,53,.85); border: 1.5px solid rgba(240,215,154,.6); color: var(--gold2); border-radius: 999px; padding: 8px 24px; font: 700 30px Cairo; z-index: 5; box-shadow: 0 10px 30px rgba(0,0,0,.35); }
.off svg { width: 32px; height: 32px; fill: var(--gold2); }
/* offline */
#free { flex-direction: column; gap: 26px; text-align: center; padding: 0 60px; }
.plane { width: 150px; height: 150px; border-radius: 50%; border: 3px solid var(--gold); display: flex; align-items: center; justify-content: center; background: rgba(15,30,53,.4); }
.plane svg { width: 84px; height: 84px; fill: var(--gold2); transform: rotate(-45deg); }
#free h2 { margin: 6px 0 0; font: 700 ${V ? 70 : 74}px/1.3 Cairo; }
#free .en.big { font-size: 34px; margin: 0; }
.chips { display: flex; gap: 22px; margin-top: 14px; ${V ? 'flex-direction: column; align-items: center;' : ''} }
.chips span { border: 2px solid rgba(240,215,154,.55); color: #f6ecd0; border-radius: 999px; padding: 6px 36px; font: 600 ${V ? 46 : 40}px/1.5 Cairo; background: rgba(15,30,53,.35); }
.note { font: 400 24px Cairo; color: rgba(255,255,255,.5); margin: 10px 0 0; }
/* end */
#end { flex-direction: column; text-align: center; }
#end .icon { width: ${V ? 380 : 300}px; height: ${V ? 380 : 300}px; border-radius: ${V ? 84 : 66}px; box-shadow: 0 24px 70px rgba(0,0,0,.5), 0 0 0 2px rgba(240,215,154,.3); }
#end h1 { margin: ${V ? 30 : 0}px 0 ${V ? 40 : 30}px; font: 700 ${V ? 170 : 130}px/2.1 'Noto Nastaliq Urdu', Cairo; color: var(--gold2); }
#end .sub { font: 700 ${V ? 64 : 56}px/1.3 Cairo; color: #fff; margin: ${V ? 10 : -10}px 0 0; }
#end .en { font: 600 ${V ? 38 : 34}px CairoL, sans-serif; margin: 20px 0 0; color: var(--gold2); opacity: .85; }
</style></head><body><div id="bg"></div><div id="pat"></div>${body}<div id="vig"></div>
<script>
const SC = ${JSON.stringify(SC.map(({ id, s, d, kind }) => ({ id, s, d, kind })))}, XF = ${XF}, TOTAL = ${TOTAL}, V = ${V};
const LIVE = ${JSON.stringify(LIVE)}, REV = ${JSON.stringify(REV)}, STA = ${JSON.stringify(STA)};
const PW = ${PW1}, PH = ${PH1}, K = PW / 360;          // screen px per app px
const cl = x => Math.max(0, Math.min(1, x)), ease = x => 0.5 - Math.cos(Math.PI * cl(x)) / 2, mix = (a, b, k) => a + (b - a) * k;
const $ = (q, r = document) => r.querySelector(q), $$ = (q, r = document) => [...r.querySelectorAll(q)];
const rise = (e, lt, a, len, dx, dy) => { if (!e) return; const k = ease((lt - a) / len); e.style.opacity = k; e.style.transform = 'translate(' + dx * (1 - k) + 'px,' + dy * (1 - k) + 'px)'; };
// camera: show app point (cx, cy) at the screen centre with zoom z, never past the content's edges (content height ch app px)
function cam(el, cx, cy, z, ch = 640) {
  const cv = $('.cv', el), s = z * K; let tx = PW / 2 - cx * s, ty = PH / 2 - cy * s;
  tx = Math.min(0, Math.max(PW - 360 * s, tx)); ty = Math.min(0, Math.max(PH - ch * s, ty));
  cv.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + z + ')';
}
function showState(el, i) { $$('img.st', el).forEach(m => m.style.visibility = +m.dataset.i === i ? 'visible' : 'hidden'); }
const ctr = b => [b[0] + b[2] / 2, b[1] + b[3] / 2];
// live clip timing: idle → mic tap at 1.3 s → words from 3.2 s, one every STEP s
const STEP = 0.27, W0 = 3.2, NW = LIVE.states.length - 2;
const liveBoxes = LIVE.states.map((s, i) => s.box ? ctr(s.box) : null);
for (let i = 0; i < liveBoxes.length; i++) if (!liveBoxes[i]) liveBoxes[i] = liveBoxes.slice(i).find(Boolean) || [180, 200];
// review timing: covered → mic at 1.1 s → states from 1.8 s every RSTEP s → push in on the red word
const RSTEP = 0.19, R0 = 1.8, RN = REV.states.length - 2, RBAD = REV.states.findIndex(s => s.bad.length), RB = REV.states[RBAD].bad[0];
window.render = t => {
  $('#pat').style.transform = 'translate(' + (-t * 4) + 'px,' + (-t * 2) + 'px)';
  $('#bg').style.transform = 'translate(' + Math.sin(t / 9) * 40 + 'px,' + Math.cos(t / 11) * 30 + 'px)';
  for (const s of SC) {
    const el = document.getElementById(s.id), lt = t - s.s, first = s.id === 'open', last = s.id === 'end';
    const inK = first ? ease(lt / 2.2) : ease(lt / XF), outK = last ? 1 - ease((lt - (s.d - 1.4)) / 1.4) : 1 - ease((lt - (s.d - XF)) / XF);
    const op = lt < 0 || lt > s.d ? 0 : Math.min(inK, outK); el.style.opacity = op; el.style.visibility = op > 0 ? 'visible' : 'hidden';
    if (!op) continue;
    const p = lt / s.d;
    if (s.kind === 'open') {
      const c = $('.cover', el), mv = ease((lt - 2.4) / 2.0);
      c.style.transform = 'scale(' + (1.18 - 0.14 * ease(lt / 5) + 0.02 * p) + ')' + (V ? ' translateY(' + (1 - mv) * 320 + 'px)' : ' translateX(' + (1 - mv) * -480 + 'px)');
      c.style.filter = 'brightness(' + (0.35 + 0.65 * ease(lt / 2.4)) + ')';
      rise($('.aq', el), lt, 3.2, 1.8, 0, 26); rise($('.ref', el), lt, 4.1, 1.4, 0, 16); rise($('.aen', el), lt, 4.6, 1.6, 0, 16);
      continue;
    }
    if (s.kind !== 'free' && s.kind !== 'end') rise($('.cap', el), lt, 0.35, 1.3, V ? 0 : 40, V ? 24 : 0);
    rise($('.off', el), lt, 1.0, 1.0, 0, -14);
    if (s.kind === 'live') {
      // state: 0 idle, 1 mic on, then word k at W0 + k*STEP
      const wi = Math.floor((lt - W0) / STEP), i = lt < 1.3 ? 0 : lt < W0 ? 1 : 2 + Math.min(NW - 1, Math.max(0, wi));
      showState(el, i);
      const m = ctr(LIVE.mic), f = cl((lt - W0) / STEP - Math.max(0, wi));       // fraction into the current word
      const a = liveBoxes[Math.max(2, i)], b = liveBoxes[Math.min(liveBoxes.length - 1, Math.max(2, i) + 1)];
      const wx = 180, wy = mix(a[1], b[1], ease(f) * 0.6);                      // follow the line, keep the page width
      // camera: tight on the mic (2.6×) → glide to the ayah lines (1.8×) → ease out to the whole page near the end
      const k1 = ease((lt - 2.0) / 1.8), k2 = ease((lt - (s.d - 2.6)) / 1.6);
      let z = mix(2.6, 1.8, k1), cx = mix(m[0], wx, k1), cy = mix(m[1], wy, k1);
      z = mix(z, 1, k2); cx = mix(cx, 180, k2); cy = mix(cy, 320, k2);
      cam(el, cx, cy, z);
      const r1 = $('.ring', el), r2 = $('.r2', el);
      [r1, r2].forEach((r, j) => { const q = (lt - 1.3 - j * 0.45) / 1.1, on = lt > 1.3 && lt < 3.4 && q >= 0;
        const qq = on ? q % 1 : 0, d = 52 * K * (1 + qq * 0.9);
        r.style.width = r.style.height = d + 'px'; r.style.left = m[0] * K - d / 2 + 'px'; r.style.top = m[1] * K - d / 2 + 'px'; r.style.opacity = on ? (1 - qq) * 0.9 : 0; });
    } else if (s.kind === 'rev') {
      const k = Math.floor((lt - R0) / RSTEP), i = lt < 1.1 ? 0 : lt < R0 ? 1 : 2 + Math.min(RN - 1, Math.max(0, k));
      showState(el, i);
      // read the covered lines at 1.5×, scrolling down slowly as they open; then push in to 2.6× on the red word
      const kIn = ease((lt - 0.4) / 1.2), done = R0 + RN * RSTEP, kB = ease((lt - (done - 0.2)) / 1.4), kOut = ease((lt - (s.d - 1.5)) / 1.2);
      const rb = ctr(RB), scrollY = mix(120, 175, ease((lt - R0) / (RN * RSTEP)));
      let z = mix(1, 1.55, kIn), cx = 180, cy = mix(320, scrollY, kIn);
      z = mix(z, 2.6, kB); cx = mix(cx, rb[0], kB); cy = mix(cy, rb[1], kB);
      z = mix(z, 1.3, kOut); cy = mix(cy, 200, kOut); cx = mix(cx, 180, kOut);
      cam(el, cx, cy, z);
      const br = $('.badring', el), on = i >= RBAD, pulse = on ? 0.5 + 0.5 * Math.sin((lt - done) * 5) : 0;
      br.style.left = (RB[0] - 4) * K + 'px'; br.style.top = (RB[1] - 4) * K + 'px'; br.style.width = (RB[2] + 8) * K + 'px'; br.style.height = (RB[3] + 8) * K + 'px';
      br.style.opacity = on ? ease((lt - done) / 0.6) * (0.55 + 0.45 * pulse) : 0;
    } else if (s.kind === 'stats') {
      showState(el, 0);
      // scroll through the cards: reading stats → rewards → hifz, zoomed a little on each
      const C = STA.cards.map(c => [c.box[1] + c.box[3] / 2, c.box[3]]), beats = [0.2, 2.1, 4.0];
      let cy = C[0][0], z = 1.15;
      beats.forEach((b0, j) => { const kk = ease((lt - b0) / 1.5); if (j && C[j]) { cy = mix(cy, C[j][0], kk); z = mix(z, j === 1 ? 1.25 : 1.3, kk); } });
      cam(el, 180, cy, z, STA.h);
    } else if (s.kind === 'feat') {
      $$('.ph', el).forEach((ph, i, all) => {
        const n = all.length, mid = (n - 1) / 2, k = ease((lt - 0.15 - i * 0.18) / 1.4);
        const drift = (V ? -30 : -36) * p + (1 - k) * 60, sc = 1 + 0.035 * p, rot = n > 1 ? (i - mid) * (V ? 4 : 3.5) * (n === 2 ? 1.4 : 1) : 0;
        const lift = n > 1 ? Math.abs(i - mid) * 26 : 0;
        ph.style.opacity = k; ph.style.transform = 'translateY(' + (drift + lift) + 'px) rotate(' + (-rot) + 'deg) scale(' + sc + ')';
      });
    } else if (s.kind === 'free') {
      rise($('.plane', el), lt, 0.2, 1.1, 0, 20); rise($('h2', el), lt, 0.5, 1.2, 0, 20); rise($('.en', el), lt, 0.9, 1.1, 0, 14);
      $$('.chips span', el).forEach((c, i) => rise(c, lt, 1.4 + i * 0.3, 1.0, 0, 18));
      rise($('.note', el), lt, 2.4, 1.0, 0, 10);
    } else {
      const ic = $('.icon', el); ic.style.transform = 'scale(' + (0.92 + 0.08 * ease(lt / 2.5)) + ')';
      rise($('h1', el), lt, 0.6, 1.4, 0, 20); rise($('.sub', el), lt, 1.1, 1.3, 0, 16); rise($('.en', el), lt, 1.5, 1.3, 0, 16);
    }
    if (s.kind === 'live' || s.kind === 'rev' || s.kind === 'stats') {
      const ph = $('.ph', el), k = ease((lt - 0.1) / 1.2); ph.style.opacity = k; ph.style.transform = 'translateY(' + ((1 - k) * 50 - 14 * p) + 'px)';
    }
  }
};
render(0);
</script></body></html>`;

(async () => {
  const tmp = path.join(OUT, V ? 'promo-v.html' : 'promo-h.html'); fs.writeFileSync(tmp, html);
  const b = await loadPW().chromium.launch(); const pg = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(require('url').pathToFileURL(tmp).href, { waitUntil: 'networkidle' }).catch(() => {});
  await pg.evaluate(() => document.fonts.ready); await pg.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
  if (!await pg.evaluate(() => document.fonts.check("700 100px 'Noto Nastaliq Urdu'", 'لوح'))) console.warn('warning: Noto Nastaliq Urdu did not load (offline?); the end title falls back to Cairo');
  if (errs.length) console.warn('page errors:', errs);
  if (STILLS) {
    for (const t of STILLS) { await pg.evaluate(t => render(t), t); await pg.screenshot({ path: path.join(OUT, `still-${V ? 'v' : 'h'}-${t.toFixed(1).padStart(5, '0')}.png`) }); }
    console.log('stills', STILLS.length, 'total', TOTAL.toFixed(1) + 's', JSON.stringify(SC.map(s => [s.id, +s.s.toFixed(1)]))); await b.close(); return;
  }
  const mp4 = path.join(OUT, V ? 'lawh-promo-1080x1920.mp4' : 'lawh-promo-1920x1080.mp4');
  const ff = cp.spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'film', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS),
    '-movflags', '+faststart', '-an', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
  const N = Math.round(TOTAL * FPS);
  for (let f = 0; f < N; f++) {
    await pg.evaluate(t => render(t), f / FPS);
    const png = await pg.screenshot({ type: 'png' });
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 300 === 0) console.log('frame', f, '/', N);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close();
  console.log('wrote', mp4, TOTAL.toFixed(1) + 's');
})();
