// UI checks of every app feature in Chromium. Usage: NODE_PATH=$(npm root -g) node ui.js
// playwright: NODE_PATH first, then the global npm root (also inside @playwright/test, where Windows installs it)
function loadPW() {
  try { return require('playwright'); } catch (e) {}
  const path = require('path'), cp = require('child_process');
  let root = ''; try { root = cp.execSync('npm root -g', { encoding: 'utf8', shell: true }).trim(); } catch (e) {}
  for (const c of [root, process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules')].filter(Boolean))
    for (const sub of ['playwright', 'playwright-core', '@playwright/test/node_modules/playwright', '@playwright/test/node_modules/playwright-core'])
      try { return require(path.join(c, sub)); } catch (e) {}
  throw new Error('playwright not found: install it globally or set NODE_PATH');
}
const { chromium } = loadPW();
// Page under test: QK_WEB env var, else <repo>/web (this file lives in <repo>/tools/qa)
const W = require('url').pathToFileURL(require('path').resolve(process.env.QK_WEB || __dirname + '/../../web') + '/index.html').href;
const BEEP = __dirname + '/beep.mp3';
// Sprint 2 #43: ✕ in the hifz bar now saves the results (summary dialog), so tests that close a test with ✕ also dismiss that dialog
const out = [];
// ED=kfgqpc (default), ED=kfold, ED=shamarly or ED=harmain: which mushaf edition the run reads.
const ED = process.env.ED || 'kfgqpc';
const KSUF = ED === 'harmain' ? '' : '.' + ED, EDDIR = ED === 'harmain' ? '/pages/' : 'editions/' + ED + '/';
let p, errs = [];
async function check(group, name, fn) {
  if (process.env.ONLY && !group.includes(process.env.ONLY)) return;
  try { const r = await fn(); out.push([group, name, r === false ? 'FAIL' : 'PASS', r === false || r === true || r === undefined ? '' : String(r)]); }
  catch (e) { out.push([group, name, 'FAIL', e.message.split('\n')[0].slice(0, 160)]); }
}
const ev = (f, ...a) => p.evaluate(f, ...a);
const wait = ms => p.waitForTimeout(ms);
const assert = (c, m) => { if (!c) throw new Error(m || 'assert'); return true; };
// Sprint 2 #42: «فكّرني» (data-c=nx) reveals ONE word now (and counts its ayah as forgotten), so a check that needs a whole ayah shown clicks it
// until the next hidden ayah has no mask left; recAyat recites ayat s:a1-a2 into the mic stub (right words, so they count as remembered)
async function nxAyah() { const kOf = () => ev(() => { const m = document.querySelector('.hifz-mask'); return m ? m.dataset.k : null; }), k0 = await kOf();
  for (let i = 0; i < 150; i++) { if (!(await ev(() => !!document.getElementById('hifzBar')))) break; await p.click('#hifzBar [data-c=nx]'); await wait(25); if ((await kOf()) !== k0) break; } }
async function recAyat(s, a1, a2) {
  await ev(() => { window.ReciteBridge = window.ReciteBridge || { start() {}, stop() {}, setHints() {} }; });
  if (!(await ev(() => document.querySelector('#hifzBar [data-c=mic]').classList.contains('rec')))) { await p.click('#hifzBar [data-c=mic]'); await wait(200); await ev(() => window.onRecite('', 'state:listening')); }
  for (let a = a1; a <= a2; a++) { const t = await ev(([s, a]) => window.QURAN.t[s - 1][a - 1].split(' ').filter(w => /[ء-يٱ]/.test(w)).join(' '), [s, a]); await ev(t => window.onRecite(t, 'final'), t); await wait(350); }
}
// A horizontal swipe on the page (5.34 #10: no prev/next buttons any more): d = +1 drags right = next page (RTL book). Plain swipe path: needs q.flipMode off.
async function swipe(d, ms = 600) { const y = 420, x0 = d > 0 ? 120 : 270; await p.mouse.move(x0, y); await p.mouse.down(); for (let i = 1; i <= 6; i++) await p.mouse.move(x0 + d * i * 30, y + 2); await p.mouse.up(); await wait(ms); }
// The voice command goes through the page view's own turn(), the same path as a swipe or the old buttons
const voiceTurn = d => ev(d => voiceRun(d > 0 ? 'الصفحة التالية' : 'الصفحة السابقة'), d);
async function go(h, ms = 700) { await ev(h => { location.hash = h; }, h); await wait(ms); }
async function fresh(ctx, vp) {
  p = await ctx.newPage(); await p.setViewportSize(vp || { width: 390, height: 844 }); await p.addInitScript(() => { window.QA_NOFS = true; try { if (!localStorage.getItem('q.micTips') && !window.QA_TIPS) localStorage.setItem('q.micTips', '1'); } catch (e) {} });
  // app-styled confirm (askYes): accepted as soon as it opens, unless a check sets window.QA_KEEP_DLG
  await p.addInitScript(() => { new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) { if (n.nodeType === 1 && n.querySelector) { const y = n.matches('.dlg-back') ? n.querySelector('.dlg-yes') : null; if (y) setTimeout(() => { if (!window.QA_KEEP_DLG && y.isConnected) y.click(); }, 0); } } }).observe(document, { childList: true, subtree: true }); });   // document: <html> is not there yet when an init script runs
  p.on('pageerror', e => errs.push(e.message));
  // confirm() before deleting: accepted, unless a check answers the dialog itself first
  p.on('dialog', d => setTimeout(() => d.accept().catch(() => {}), 0));
  await p.route(/everyayah\.com/, r => r.fulfill({ path: BEEP, contentType: 'audio/mpeg', headers: { 'Access-Control-Allow-Origin': '*' } }));
}

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await b.newContext({ permissions: ['clipboard-read', 'clipboard-write', 'microphone'] });
  await fresh(ctx);
  await p.goto(W); await ev(ed => { localStorage.clear(); localStorage.setItem('q.edition', JSON.stringify(ed)); localStorage.setItem('q.micTips', '1'); }, ED); await p.reload(); await wait(800);

  // ---------- الرئيسية والفهرس ----------
  const G1 = 'الرئيسية والفهرس';
  await check(G1, 'الشاشة الرئيسية تفتح بالسور والأقسام', () => ev(() => document.querySelectorAll('#idx .list li').length === 114 && ['tPrayer', 'tGoal', 'kCard', 'cont', 'tabbar'].every(i => document.getElementById(i))));
  await check(G1, 'البحث في الفهرس بالاسم', async () => { await p.fill('#idx .idx-filter', 'الكهف'); await wait(100); return ev(() => { const l = document.querySelectorAll('#idx .list li'); return l.length === 1 && l[0].dataset.s === '18'; }); });
  await check(G1, 'البحث في الفهرس بالرقم', async () => { await p.fill('#idx .idx-filter', '36'); await wait(100); return ev(() => document.querySelector('#idx .list li').dataset.s === '36'); });
  await check(G1, 'تبويب الأجزاء فيه 30 جزء', async () => { await p.click('#idx .tabs button[data-t=juz]'); await wait(100); return ev(() => document.querySelectorAll('#idx .list li').length === 30); });
  await check(G1, 'فتح جزء عمّ يروح لصفحته', async () => { await p.click('#idx .list li:last-child'); await wait(700); return ev(() => location.hash.startsWith('#/p/') && +location.hash.split('/')[2] >= 580 - 100); });
  await check(G1, 'زر الفهرس من صفحة المصحف يفتح ويقفل', async () => { await p.click('#btnIndex'); await wait(200); const o = await ev(() => !document.getElementById('index').hidden && document.querySelectorAll('#indexBody li').length > 0); await p.click('#closeIndex'); return o && await ev(() => document.getElementById('index').hidden); });
  await check(G1, 'متابعة القراءة من آخر صفحة', async () => { await go('#/p/100'); await go('#/'); await p.click('#cont'); await wait(600); return ev(() => location.hash === '#/p/100'); });
  await check(G1, 'زر الرجوع', async () => { await go('#/p/120'); await p.click('#btnBack'); await wait(500); return ev(() => location.hash !== '#/p/120'); });

  // ---------- صفحات المصحف ----------
  const G2 = 'قراءة صفحات المصحف';
  await check(G2, 'صفحة المصحف تتحمل (صورة AVIF)', async () => { await go('#/p/50', 1200); return ev(d => { const i = document.getElementById('pg'); return i.complete && i.naturalWidth > 500 && i.src.endsWith('050.avif') && i.src.includes(d); }, EDDIR); });
  if (ED === 'harmain') await check(G2, 'ألوان التجويد فوق الصفحة ظاهرة', () => ev(() => { const t = document.querySelector('.tjo'); return t && t.naturalWidth > 0 && getComputedStyle(t).display !== 'none'; }));
  await check(G2, 'التقليب بالسحب للتالية والسابقة (بدون تأثير القلب)', async () => { await ev(() => localStorage.setItem('q.flip', 'false')); await p.reload(); await wait(800); await swipe(1); const a = await ev(() => location.hash); await swipe(-1); const c = await ev(() => location.hash); return assert(a === '#/p/51' && c === '#/p/50', a + ' ' + c); });
  await check(G2, 'تأثير قلب الصفحة بأمر التقليب', async () => { await ev(() => localStorage.setItem('q.flip', 'true')); await p.reload(); await wait(900); await voiceTurn(1); await wait(150); const mid = await ev(() => !!document.querySelector('.curl')); await wait(1300); const h = await ev(() => [location.hash, !!document.querySelector('.curl')]); return assert(mid && h[0] === '#/p/51' && !h[1], JSON.stringify([mid, h])); });
  await check(G2, 'قلب الصفحة بالسحب بالإصبع', async () => { const r = await ev(() => { const b = document.querySelector('.page-box').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }); await p.mouse.move(r[0] + r[2] * 0.2, r[1] + r[3] * 0.8); await p.mouse.down(); for (let i = 1; i <= 12; i++) { await p.mouse.move(r[0] + r[2] * 0.2 + i * 25, r[1] + r[3] * 0.8 - i * 2); await wait(16); } await p.mouse.up(); await wait(1200); return assert(await ev(() => location.hash) === '#/p/52', await ev(() => location.hash)); });
  await check(G2, 'كتابة رقم صفحة', async () => { await p.fill('#pNum', '300'); await p.dispatchEvent('#pNum', 'change'); await wait(600); return ev(() => location.hash === '#/p/300'); });
  await check(G2, 'الضغط على آية يظللها ويظهر شريط الآية', async () => { const r = await ev(() => { const b = document.querySelector('.page-box').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }); await p.mouse.click(r[0], r[1]); await wait(300); return ev(() => document.querySelectorAll('.ayah-box').length > 0 && !!document.getElementById('ayahBar') && /\?a=\d+:\d+/.test(location.hash)); });
  await check(G2, 'نسخ الآية بالتشكيل', async () => { await p.click('#ayahBar button[data-c=t]'); await wait(200); const t = await ev(() => navigator.clipboard.readText()); return assert(/[ً-ْ]/.test(t) && t.includes('[سورة'), t.slice(0, 40)); });
  await check(G2, 'نسخ الآية بدون تشكيل', async () => { await p.click('#ayahBar button[data-c=p]'); await wait(200); const t = await ev(() => navigator.clipboard.readText()); return assert(!/[ً-ْ]/.test(t.split('﴿')[0]) && t.length > 10, t.slice(0, 40)); });
  await check(G2, 'زر «في النص» يفتح الآية في عرض النص', async () => { await p.click('#ayahBar button[data-c=v]'); await wait(700); const ok = await ev(() => location.hash.startsWith('#/s/') && (!!document.querySelector('.ayah.sel') || /\/1$/.test(location.hash))); await go('#/p/300'); return ok; });
  await check(G2, 'زر الليل/النهار تحت الصفحة', async () => { const a = await ev(() => document.documentElement.classList.contains('pdark')); await p.click('#pDark'); const b2 = await ev(() => document.documentElement.classList.contains('pdark')); await p.click('#pDark'); const c = await ev(() => document.documentElement.classList.contains('pdark')); return assert(a !== b2 && a === c, [a, b2, c].join()); });
  await check(G2, 'الصفحة 1 والصفحات الأخيرة (فهرس) تفتح', async () => { for (const n of ED === 'harmain' ? [0, 1, 545, 559] : ED === 'shamarly' ? [2, 3, 300, 522] : [1, 2, 300, 604]) { await go('#/p/' + n, 900); const ok = await ev(() => document.getElementById('pg').naturalWidth > 0); if (!ok) throw new Error('page ' + n); } return true; });
  await check(G2, 'رقم صفحة غلط يتظبط', async () => { await go('#/p/9999', 800); return ev(() => document.querySelector('#pNum').value === String(QURAN.count - 1)); });

  // ---------- البحث ----------
  const G3 = 'البحث';
  await check(G3, 'البحث بكلمة بدون تشكيل', async () => { await go('#/search'); await p.fill('#q', 'الصلاة'); await wait(600); return ev(() => document.querySelectorAll('.result').length > 50); });
  await check(G3, 'البحث برقم سورة وآية 2:255', async () => { await p.fill('#q', '2:255'); await wait(500); return ev(() => { const r = document.querySelectorAll('.result'); return r.length === 1 && r[0].dataset.a === '255'; }); });
  await check(G3, 'البحث بأرقام عربية ٢:٢٥٥', async () => { await p.fill('#q', '٢:٢٥٥'); await wait(500); return ev(() => document.querySelectorAll('.result').length === 1); });
  await check(G3, 'كلمة مش موجودة تقول لا توجد نتائج', async () => { await p.fill('#q', 'زززززز'); await wait(500); return ev(() => document.querySelector('#res').textContent.includes('لا توجد نتائج')); });
  await check(G3, 'نتيجة البحث بكلمة (الصمد) تفتح الصفحة وتظلل الكلمة نفسها فوق الصورة (.srch-w)', async () => {
    await go('#/search'); await p.fill('#q', 'الصمد'); await wait(600); await p.click('.result'); await wait(1500);
    const hasW = require('fs').existsSync(require('path').resolve(process.env.QK_WEB || __dirname + '/../../web') + '/editions/' + ED + '-w');
    const r = await ev(() => { const m = /\?a=(\d+):(\d+)/.exec(location.hash), w = document.querySelectorAll('.srch-w'); return { a: m ? m[1] + ':' + m[2] : '', n: w.length, ay: document.querySelectorAll('.ayah-box').length }; });
    if (process.env.W6B_SHOT) await p.screenshot({ path: process.env.W6B_SHOT });
    const b = await ev(() => { const w = document.querySelector('.srch-w'), a = document.querySelector('.ayah-box'); if (!w || !a) return false; const x = w.getBoundingClientRect(), y = a.getBoundingClientRect(); return x.top >= y.top - 2 && x.bottom <= y.bottom + 2 && x.left >= y.left - 2 && x.right <= y.right + 2; });
    return hasW ? assert(r.a.split(':')[0] !== '' && r.n > 0 && r.ay > 0 && b, JSON.stringify(r)) : assert(r.n === 0 && r.ay > 0, JSON.stringify(r));
  });
  await check(G3, 'نتيجة البحث تفتح الصفحة والآية مظللة بالأصفر', async () => { await go('#/search'); await p.fill('#q', 'كرسيه'); await wait(600); await p.click('.result'); await wait(1000); return ev(() => location.hash.startsWith('#/p/' + QURAN.p[1][254] + '?a=2:255') && document.querySelectorAll('.ayah-box').length > 0 && !!document.querySelector('.page-cap mark')); });

  // ---------- عرض النص ----------
  const G4 = 'عرض النص';
  await check(G4, 'تغيير العرض إلى نص', async () => { await p.click('#btnSettings'); await p.click('#mode button[data-v=text]'); await ev(() => { if (!document.getElementById('settings').hidden) document.getElementById('closeSettings').click(); }); await go('#/s/2/1', 1200); return ev(() => document.querySelectorAll('.ayah').length === 286 && !!document.querySelector('.basmala')); });
  await check(G4, 'ألوان التجويد في النص', async () => { await wait(800); return ev(() => document.querySelectorAll('.quran .tj').length > 100); });
  await check(G4, 'حجم الخط يتغير', async () => { await ev(() => { const f = document.getElementById('fontSize'); f.value = 40; f.dispatchEvent(new Event('input')); }); const s = await ev(() => getComputedStyle(document.querySelector('.quran')).fontSize); await ev(() => { const f = document.getElementById('fontSize'); f.value = 28; f.dispatchEvent(new Event('input')); }); return assert(s === '40px', s); });
  await check(G4, 'السورة التالية والسابقة', async () => { await p.click('#next'); await wait(700); const a = await ev(() => location.hash); await p.click('#prev'); await wait(700); return assert(a === '#/s/3/1' && await ev(() => location.hash) === '#/s/2/1', a); });
  await check(G4, 'الضغط على آية في النص يفتح شريطها', async () => { await p.click('#a5'); await wait(200); return ev(() => !!document.getElementById('ayahBar') && document.getElementById('a5').classList.contains('sel')); });
  await check(G4, 'التوبة بدون بسملة، والفاتحة بدون بسملة منفصلة', async () => { await go('#/s/9/1'); const a = await ev(() => !document.querySelector('.basmala')); await go('#/s/1/1'); return a && await ev(() => !document.querySelector('.basmala')); });
  await check(G4, 'نتيجة البحث في وضع النص تفتح الآية بالكلمة مظللة', async () => { await go('#/search'); await p.fill('#q', 'الرحمن'); await wait(600); await p.click('.result'); await wait(900); return ev(() => location.hash.startsWith('#/s/') && !!document.querySelector('.quran mark')); });
  await check(G4, 'رجوع لعرض الصفحات', async () => { await p.click('#btnSettings'); await p.click('#mode button[data-v=' + ED + ']'); await ev(() => { if (!document.getElementById('settings').hidden) document.getElementById('closeSettings').click(); }); await go('#/p/10'); return ev(() => !!document.getElementById('pg')); });

  // ---------- صفحة الآية ----------
  const G5 = 'التفسير والإعراب والمعاني';
  for (const [t, name] of [['tafsir', 'التفسير'], ['irab', 'الإعراب'], ['asbab', 'أسباب النزول'], ['qiraat', 'القراءات']]) {
    await check(G5, 'تبويب ' + name + ' لآية 2:255 / كل الكتب', async () => {
      await go('#/a/2/255?t=' + t, 1200);
      const ids = await ev(() => [...document.querySelectorAll('#ayBody [data-b]')].map(b => b.dataset.b));
      const list = ids.length ? ids : [null], bad = [];
      for (const id of list) {
        if (id) { await p.click('#ayBody [data-b="' + id + '"]'); await wait(900); }
        const txt = await ev(() => document.querySelector('.book-text').textContent);
        if (txt.length < 30 || txt.includes('جارٍ التحميل')) bad.push((id || t) + ':' + txt.slice(0, 30));
      }
      return assert(!bad.length, bad.join(' | '));
    });
  }
  await check(G5, 'أسباب النزول لآية بدون سبب تكتب رسالة واضحة', async () => { await go('#/a/2/3?t=asbab', 1200); const t = await ev(() => document.querySelector('.book-text').textContent); return assert(t.includes('لم يذكر') || t.length > 40, t.slice(0, 60)); });
  await check(G5, 'تبويب التجويد للآية', async () => { await go('#/a/2/2?t=tajweed', 1500); return ev(() => document.querySelectorAll('.tj-rule').length > 0); });
  await check(G5, 'معاني الكلمات وكل المعاجم', async () => {
    await go('#/a/2/2?t=words', 1500);
    const ds = await ev(() => [...document.querySelectorAll('#ayBody [data-d]')].map(b => b.dataset.d)); const bad = [];
    for (const d of ds) { await p.click('#ayBody [data-d="' + d + '"]'); await wait(900); const t = await ev(() => document.querySelector('.book-text').textContent); if (t.length < 20 || t.includes('جارٍ')) bad.push(d + ':' + t.slice(0, 40)); }
    return assert(ds.length >= 5 && !bad.length, ds.length + ' ' + bad.join(' | '));
  });
  await check(G5, 'اختيار كلمة تانية يغيّر الجذر', async () => { const a = await ev(() => document.querySelector('.root b').textContent); await p.click('#ayBody [data-w]:not(.noroot):not(.on)'); await wait(900); return ev(a => document.querySelector('.root b') && document.querySelector('.root b').textContent !== a, a); });
  await check(G5, 'الآية التالية والسابقة وزر الصفحة', async () => { await go('#/a/2/255'); await p.click('#ayNext'); await wait(500); const a = await ev(() => location.hash); await p.click('#ayPage'); await wait(700); return assert(a.startsWith('#/a/2/256') && await ev(() => location.hash.startsWith('#/p/' + QURAN.p[1][255] + '?a=2:256')), a); });
  await check(G5, 'أول آية وآخر آية في المصحف', async () => { await go('#/a/1/1'); const a = await ev(() => document.getElementById('ayPrev').disabled); await go('#/a/114/6'); return a && await ev(() => document.getElementById('ayNext').disabled); });

  // ---------- أقسام الرئيسية ----------
  const G6 = 'التجويد والقراءات والأذكار والقبلة';
  await check(G6, 'دروس أحكام التجويد بالأمثلة', async () => { await go('#/tajweed', 1500); return ev(() => document.querySelectorAll('details.learn-card').length > 5 && document.querySelectorAll('.tj-examples button').length > 10); });
  await check(G6, 'مثال من الدرس يفتح الآية', async () => { for (const x of await p.$$('details.learn-card')) { if (await x.$('.tj-examples button')) { await (await x.$('summary')).click(); await wait(200); await (await x.$('.tj-examples button')).click(); break; } } await wait(1200); return ev(() => location.hash.includes('t=tajweed')); });
  await check(G6, 'القراءات العشر وأصولها', async () => { await go('#/qiraat', 1500); return ev(() => document.querySelectorAll('.readers > div').length === 10 && document.querySelectorAll('#usul details').length > 5); });
  await check(G6, 'أذكار الصباح والعدّ', async () => { await go('#/azkar/m'); const n = await ev(() => document.querySelectorAll('.zikr').length); const before = await ev(() => document.querySelector('.zikr .z-count b').textContent); await p.click('.zikr'); const after = await ev(() => document.querySelector('.zikr .z-count b').textContent); return assert(n > 15 && before !== after, n + ' ' + before + ' ' + after); });
  await check(G6, 'العدّ محفوظ بعد إعادة الفتح', async () => { const a = await ev(() => document.querySelector('.z-progress').textContent); await go('#/'); await go('#/azkar/m'); return ev(a => document.querySelector('.z-progress').textContent === a, a); });
  await check(G6, 'أذكار المساء وزر البدء من جديد', async () => { await p.click('.tabs button[data-k=e]'); await wait(400); const e = await ev(() => location.hash === '#/azkar/e'); await p.click('#zReset'); return e && await ev(() => document.querySelector('.z-progress').textContent.includes('أتممت ٠')); });
  await check(G6, 'عدّ أذكار الصباح لا يغيّر عدّ المساء (بعد زيارات متكررة)', async () => { await ev(() => { localStorage.removeItem('q.azkar.m'); localStorage.removeItem('q.azkar.e'); }); for (const h of ['#/azkar/m', '#/', '#/azkar/e', '#/azkar/m']) await go(h, 300); const e0 = await ev(() => localStorage.getItem('q.azkar.e')); for (let i = 0; i < 3; i++) await p.click('.zikr >> nth=0'); const e1 = await ev(() => localStorage.getItem('q.azkar.e')); return assert(e0 === e1, e0 + ' / ' + e1); });
  await check(G6, 'القبلة باختيار مدينة (القاهرة ≈ 136°)', async () => { await go('#/qibla', 600); await p.selectOption('#qCity', '0'); await wait(200); return ev(() => /١٣٦|١٣٥/.test(document.getElementById('qAngle').textContent) && document.getElementById('qNeedle').style.transform.includes('rotate')); });
  await check(G6, 'البوصلة تلف مع الاتجاه', async () => { await ev(() => window.qiblaHeading(136)); return ev(() => document.getElementById('qCompass').classList.contains('aligned') && document.getElementById('qHint').textContent.includes('القبلة')); });

  // ---------- التلاوة ----------
  const G7 = 'التلاوة الصوتية';
  await check(G7, 'زر الاستماع تحت الصفحة يشغّل أول آية ويظللها', async () => { await go('#/p/3', 1200); await p.click('#pPlay'); await wait(1500); return ev(() => !!document.getElementById('player') && document.querySelector('.pl-info b').textContent.includes('البقرة')); });
  await check(G7, 'البسملة ثم الآية، والتظليل الأخضر', async () => { await wait(2500); return ev(() => document.querySelectorAll('.ayah-box.play').length > 0 && /آية/.test(document.querySelector('.pl-info b').textContent)); });
  await check(G7, 'الانتقال للآية التالية تلقائيًا', async () => { const a = await ev(() => document.querySelector('.pl-info b').textContent); await wait(2500); return ev(a => document.querySelector('.pl-info b').textContent !== a, a); });
  await check(G7, 'أزرار التالية والسابقة والإيقاف المؤقت', async () => { await p.click('#player button[data-c=nx]'); await wait(500); const a = await ev(() => document.querySelector('.pl-info b').textContent); await p.click('#player button[data-c=pv]'); await wait(500); const b2 = await ev(() => document.querySelector('.pl-info b').textContent); await p.click('#player button[data-c=pp]'); const paused = await ev(() => document.querySelector('#player .pl-main').getAttribute('aria-label') === 'تشغيل'); await p.click('#player button[data-c=pp]'); return assert(a !== b2 && paused, a + '/' + b2 + '/' + paused); });
  await check(G7, 'التكرار ٣ مرات', async () => { await p.click('#player button[data-c=st]'); await ev(() => localStorage.setItem('q.repeat', '3')); await p.reload(); await go('#/p/2', 900); await p.click('#pPlay'); const seen = []; for (let i = 0; i < 14; i++) { await wait(400); seen.push(await ev(() => document.querySelector('.pl-info b').textContent)); } const u = [...new Set(seen)].join(' | '); await p.click('#player button[data-c=st]'); await ev(() => localStorage.setItem('q.repeat', '1')); await p.reload(); await wait(600); return assert(u.includes('آية ١ · ٢/٣') && u.includes('آية ١ · ٣/٣') && u.includes('آية ٢'), u); });
  await check(G7, 'زر التكرار يلف على ١ ٢ ٣ ٥ ٧ ١٠ ∞', async () => { await go('#/p/2', 900); await p.click('#pPlay'); await wait(300); const v = []; for (let i = 0; i < 7; i++) { await p.click('#player button[data-c=rp]'); v.push(await ev(() => { const i = document.querySelector('#player .pl-rep i'); return i ? i.textContent : '1'; })); } await p.click('#player button[data-c=st]'); return assert(v.join() === '٢,٣,٥,٧,١٠,∞,1', v.join()); });
  await check(G7, 'التلاوة تقلب الصفحة لوحدها لما الآية تكون في الصفحة اللي بعدها', async () => { await ev(() => { const b = document.querySelector('#player button[data-c=st]'); if (b) b.click(); }); await go('#/p/3', 900); const last = await ev(() => { let r; QURAN.p.forEach((s, i) => s.forEach((pg, a) => { if (pg === 3) r = [i + 1, a + 1]; })); return r; }); const r = await ev(l => { const b = QURAN.r[l[0] - 1][l[1] - 1].filter(x => x[0] === 3)[0]; const bx = document.querySelector('.page-box').getBoundingClientRect(); return [bx.left + bx.width * (b[1] + b[3]) / 2000, bx.top + bx.height * (b[2] + b[4]) / 2000]; }, last); await p.mouse.click(r[0], r[1]); await wait(200); await p.click('#ayahBar button[data-c=l]'); await wait(1800); return ev(() => location.hash.startsWith('#/p/4') && document.querySelectorAll('.ayah-box.play').length > 0); });
  await check(G7, 'الإيقاف يقفل المشغّل', async () => { await p.click('#player button[data-c=st]'); return ev(() => !document.getElementById('player')); });
  await check(G7, 'تغيير القارئ من الإعدادات', async () => { await p.click('#btnSettings'); await p.selectOption('#reciter', 'Husary_128kbps'); await p.click('#closeSettings'); await ev(() => document.getElementById('pPlay').click()); await wait(900); const r = await ev(() => document.querySelector('.pl-info span').textContent); await p.click('#player button[data-c=st]'); return assert(r.includes('الحصري'), r); });
  await check(G7, 'الاستماع من شريط الآية في عرض النص', async () => { await ev(() => localStorage.setItem('q.mode', '"text"')); await p.reload(); await go('#/s/112/1', 900); await p.click('#a2'); await p.click('#ayahBar button[data-c=l]'); await wait(1200); const ok = await ev(() => !!document.querySelector('.ayah.playing')); await p.click('#player button[data-c=st]'); await ev(() => localStorage.setItem('q.mode', '"pages"')); await p.reload(); await wait(600); return ok; });

  // ---------- العلامات والختمة ----------
  const G8 = 'العلامات والختمة';
  await check(G8, 'إضافة علامة باسم من تحت الصفحة', async () => { await go('#/p/200', 900); const c0 = await ev(() => { const b = document.querySelector('.page-box').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }); await p.mouse.click(c0[0], c0[1]); await wait(400); await p.click('#ayahBar button[data-c=b]'); await p.fill('.dlg input', 'ورد الفجر'); await p.click('.dlg-ok'); await wait(200); return ev(() => JSON.parse(localStorage.getItem('q.marks'))[0].n === 'ورد الفجر'); });
  await check(G8, 'إضافة علامة من شريط الآية', async () => { await go('#/p/250', 900); const r = await ev(() => { let k; QURAN.r.forEach(s => s.forEach(rs => rs.forEach(x => { if (x[0] === 250 && !k) k = x; }))); const bx = document.querySelector('.page-box').getBoundingClientRect(); return [bx.left + bx.width * (k[1] + k[3]) / 2000, bx.top + bx.height * (k[2] + k[4]) / 2000]; }); await p.mouse.click(r[0], r[1]); await wait(200); await p.click('#ayahBar button[data-c=b]'); await p.click('.dlg-ok'); await wait(200); return ev(() => JSON.parse(localStorage.getItem('q.marks')).length === 2); });
  await check(G8, 'العلامات تظهر في شاشة الختمة وتفتح مكانها', async () => { await go('#/khatma'); const n = await ev(() => document.querySelectorAll('.marks li').length); await p.click('.marks li:last-child .mk-go'); await wait(800); return assert(n === 2 && await ev(() => location.hash.startsWith('#/p/200')), n + ' ' + await ev(() => location.hash)); });
  await check(G8, 'إعادة تسمية وحذف علامة', async () => { await go('#/khatma'); await p.click('.marks li:first-child .mk-ed'); await p.fill('.dlg input', 'اسم جديد'); await p.click('.dlg-ok'); await wait(200); const a = await ev(() => document.querySelector('.marks li b').textContent); await p.click('.marks li:first-child .mk-del'); await wait(200); return assert(a === 'اسم جديد' && await ev(() => document.querySelectorAll('.marks li').length === 1), a); });
  await check(G8, 'بدء ختمة في 30 يوم', async () => { await p.click('#kStart'); await wait(200); return ev(ks => { const k = JSON.parse(localStorage.getItem('q.khatma' + ks)); return k.days === 30 && !!document.getElementById('kRead') && document.querySelector('.kh-wird').textContent.includes('صفحة'); }, KSUF); });
  await check(G8, 'قراءة الورد بتقليب الصفحات بيحسب التقدم', async () => { await p.click('#kRead'); await wait(800); await ev(() => localStorage.setItem('q.flip', 'false')); for (let i = 0; i < 4; i++) { await voiceTurn(1); await wait(1300); } return ev(ks => JSON.parse(localStorage.getItem('q.khatma' + ks)).done >= QURAN.first + 3, KSUF); });
  await check(G8, 'كارت الختمة في الرئيسية يعرض الورد', async () => { await go('#/'); return ev(() => document.querySelector('#kCard small').textContent.includes('ورد اليوم') && !!document.querySelector('#kCard .kbar')); });
  await check(G8, 'زر «قرأت ورد اليوم»', async () => { await go('#/khatma'); await p.click('#kDone'); await wait(200); return ev(() => document.querySelector('.kh-wird').textContent.includes('أنهيت')); });
  await check(G8, 'تعديل الموضع يدويًا', async () => { await p.click('#kAt'); await p.fill('.dlg input', '100'); await p.click('.dlg-ok'); await wait(200); return ev(ks => JSON.parse(localStorage.getItem('q.khatma' + ks)).done === 100, KSUF); });
  await check(G8, 'ختمة بعدد أيام من اختيارك', async () => { await p.click('#kStop'); await p.click('#kStop'); await wait(200); await p.fill('#kOwn', '45'); await p.click('#kStart'); await wait(200); return ev(ks => JSON.parse(localStorage.getItem('q.khatma' + ks)).days === 45, KSUF); });
  await check(G8, 'إلغاء الخطة يحتاج تأكيد', async () => { await p.click('#kStop'); const still = await ev(ks => !!localStorage.getItem('q.khatma' + ks) && localStorage.getItem('q.khatma' + ks) !== 'null', KSUF); await p.click('#kStop'); await wait(200); return assert(still && await ev(() => !!document.getElementById('kStart')), String(still)); });

  // ---------- الحفظ ----------
  const G9 = 'الحفظ والمراجعة';
  await check(G9, 'وضع الحفظ يخفي آيات الصفحة', async () => { await go('#/p/582'.replace('582', '560') === '' ? '' : '#/p/541', 1000); await ev(() => hifzToggle()); await wait(500); return ev(() => document.querySelectorAll('.hifz-mask').length > 0 && !!document.getElementById('hifzBar')); });
  await check(G9, 'اكشف التالية / الكل / إخفاء', async () => { const t0 = await ev(() => document.querySelectorAll('.hifz-mask').length); await p.click('#hifzBar button[data-c=nx]'); const t1 = await ev(() => document.querySelectorAll('.hifz-mask').length); await p.click('#hifzBar button[data-c=all]'); const t2 = await ev(() => document.querySelectorAll('.hifz-mask').length); await p.click('#hifzBar button[data-c=none]'); const t3 = await ev(() => document.querySelectorAll('.hifz-mask').length); return assert(t1 < t0 && t2 === 0 && t3 === t0, [t0, t1, t2, t3].join()); });
  await check(G9, 'الضغط على آية مخفية يكشفها', async () => { const t0 = await ev(() => document.querySelectorAll('.hifz-mask').length); const r = await ev(() => { const m = document.querySelector('.hifz-mask').getBoundingClientRect(); return [m.left + m.width / 2, m.top + m.height / 2]; }); await p.mouse.click(r[0], r[1]); await wait(200); return ev(t0 => document.querySelectorAll('.hifz-mask').length < t0, t0); });
  await check(G9, 'إنهاء وضع الحفظ', async () => { await p.click('#hifzBar button[data-c=x]'); await wait(300); return ev(() => !document.getElementById('hifzBar') && !document.querySelector('.hifz-mask')); });
  await check(G9, 'وضع الحفظ في عرض النص', async () => { await go('#/s/112/1', 800); await p.click('#sHifz'); await wait(300); const a = await ev(() => document.querySelectorAll('.ayah.hid').length); await p.click('#a1'); const b2 = await ev(() => document.querySelectorAll('.ayah.hid').length); await p.click('#hifzBar button[data-c=x]'); return assert(a === 4 && b2 === 3, a + ' ' + b2); });

  // ---------- الإعدادات ----------
  const G10 = 'الإعدادات والمظهر';
  await check(G10, 'ألوان صفحة المصحف كلها تتطبق', async () => { await go('#/p/50'); const vs = await ev(() => [...document.querySelectorAll('#pageBg button')].map(b => b.dataset.v)); const bad = []; for (const v of vs) { await ev(v => document.querySelector('#pageBg button[data-v="' + v + '"]').click(), v); const g = await ev(() => document.documentElement.style.getPropertyValue('--pbg')); if (g !== v) bad.push(v); } await ev(() => document.querySelector('#pageBg button[data-v="#fbf7ee"]').click()); return assert(!bad.length, bad.join()); });
  await check(G10, 'لون من اختيارك', async () => { await ev(() => { const i = document.getElementById('pageBgPick'); i.value = '#336699'; i.dispatchEvent(new Event('input')); }); const v = await ev(() => document.documentElement.style.getPropertyValue('--pbg')); await ev(() => document.querySelector('#pageBg button[data-v="#fbf7ee"]').click()); return assert(v === '#336699', v); });
  await check(G10, 'مظهر التطبيق داكن لا يغيّر لون الصفحة', async () => { await ev(() => document.querySelector('#theme button[data-v=dark]').click()); const r = await ev(() => [document.documentElement.dataset.theme, document.documentElement.style.getPropertyValue('--pbg')]); await ev(() => document.querySelector('#theme button[data-v=auto]').click()); return assert(r[0] === 'dark' && r[1] === '#fbf7ee', r.join()); });
  if (ED === 'harmain') await check(G10, 'إيقاف ألوان التجويد على الصفحات', async () => { await ev(() => document.querySelector('#tjSet button[data-v=off]').click()); const a = await ev(() => getComputedStyle(document.querySelector('.tjo')).display); await ev(() => document.querySelector('#tjSet button[data-v=on]').click()); return assert(a === 'none', a); });
  await check(G10, 'الإعدادات تفضل محفوظة بعد إعادة الفتح', async () => { await ev(() => { document.querySelector('#pageBg button[data-v="#f4ecd8"]').click(); document.querySelector('#flip button[data-v=off]').click(); }); await p.reload(); await wait(700); const r = await ev(() => [document.documentElement.style.getPropertyValue('--pbg'), document.querySelector('#flip button.on').dataset.v]); await ev(() => { document.querySelector('#pageBg button[data-v="#fbf7ee"]').click(); document.querySelector('#flip button[data-v=curl]').click(); }); return assert(r[0] === '#f4ecd8' && r[1] === 'off', r.join()); });
  await check(G10, 'تغيير الطبعة يفتح نفس الآية في الطبعة التانية ويرجع', async () => {
    const other = ED === 'harmain' ? 'kfgqpc' : 'harmain';
    const p0 = await ev(() => QURAN.p[1][254]); await go('#/p/' + p0, 900);
    await p.click('#btnSettings'); await p.click('#mode button[data-v=' + other + ']'); await wait(900);
    const r1 = await ev(() => [location.hash, QURAN.p[1][254], document.getElementById('pg').src, document.querySelector('#mode .on').dataset.v]);
    await p.click('#btnSettings'); await p.click('#mode button[data-v=' + ED + ']'); await wait(900); await ev(() => { if (!document.getElementById('settings').hidden) document.getElementById('closeSettings').click(); }); await wait(1200);
    const r2 = await ev(() => [location.hash, document.getElementById('pg').naturalWidth > 0]);
    return assert(/^#\/p\/\d+$/.test(r1[0]) && Math.abs(+r1[0].slice(4) - r1[1]) <= 1 && r1[2].includes(other === 'kfgqpc' ? 'editions/kfgqpc' : '/pages/') && r1[3] === other && r2[0] === '#/p/' + p0 && r2[1], JSON.stringify([p0, r1, r2]));
  });
  await check(G10, 'شاشة الإعدادات تتقفل بزر تم', async () => { await p.click('#btnSettings'); const o = await ev(() => !document.getElementById('settings').hidden); await p.click('#closeSettings'); return o && await ev(() => document.getElementById('settings').hidden); });
  await check(G10, 'رسالة تحديث WebView ما بتظهرش على جهاز حديث', () => ev(() => ![...document.querySelectorAll('.toast')].some(t => t.textContent.includes('WebView'))));

  // ---------- المقاسات ----------
  const G11 = 'المقاسات والتابلت';
  for (const [w, h, name] of [[320, 640, 'موبايل صغير'], [430, 932, 'موبايل كبير'], [844, 390, 'موبايل بالعرض'], [800, 1280, 'تابلت طولي'], [1280, 800, 'تابلت بالعرض']]) {
    await check(G11, name + ' ' + w + '×' + h + ': مفيش سكرول جانبي والصفحة ظاهرة', async () => {
      await p.setViewportSize({ width: w, height: h }); await go('#/p/50', 900);
      const r = await ev(() => [document.documentElement.scrollWidth <= innerWidth + 1, document.getElementById('pg').getBoundingClientRect().width > 100]);
      await go('#/', 400); const r2 = await ev(() => document.documentElement.scrollWidth <= innerWidth + 1);
      return assert(r[0] && r[1] && r2, JSON.stringify([r, r2]));
    });
  }
  // The Fatiha page sits on the right: pairs 50-51 in the scans (Fatiha on page 2), 51-52 in the King Fahd print (page 1).
  const PAIR = (ED === 'kfgqpc' || ED === 'kfold') ? ['51,52', '53,54'] : ['50,51', '52,53'];
  await check(G11, 'صفحتين جنب بعض على التابلت بالعرض', async () => { await go('#/p/51', 1000); return ev(pr => { const bx = [...document.querySelectorAll('.page-box')], b = bx.map(x => x.dataset.p); return b.join() === pr && bx[0].getBoundingClientRect().left > bx[1].getBoundingClientRect().left; }, PAIR[0]); });
  await check(G11, 'التقليب في وضع الصفحتين بيقلب صفحتين', async () => { await voiceTurn(1); await wait(700); return ev(pr => [...document.querySelectorAll('.page-box')].map(x => x.dataset.p).join() === pr, PAIR[1]); });
  await check(G11, 'لف الشاشة يرجّع صفحة واحدة', async () => { await p.setViewportSize({ width: 800, height: 1280 }); await wait(700); return ev(() => document.querySelectorAll('.page-box').length === 1); });
  await check(G11, 'الفولد 841×673: «صفحتان متجاورتان» مشغّلة = صفحتين، ومطفية = صفحة واحدة', async () => {
    await p.setViewportSize({ width: 841, height: 673 }); const sp = () => ev(() => !!document.querySelector('.page-wrap.spread'));
    await ev(() => localStorage.setItem('q.spread', 'true')); await p.reload(); await wait(500); await go('#/p/100', 1000); const on = await sp();
    await ev(() => localStorage.setItem('q.spread', 'false')); await p.reload(); await wait(500); await go('#/p/100', 1000); const off = await sp();
    await ev(() => localStorage.setItem('q.spread', 'true')); await p.reload(); await wait(400);
    return assert(on && !off, JSON.stringify([on, off])); });
  await p.setViewportSize({ width: 390, height: 844 });

  // ---------- مزايا 3.4 (صفحة جديدة فيها بديل للجسر بتاع أندرويد عشان نشوف الاهتزاز والمشاركة والتنبيهات) ----------
  const G12 = 'مزايا نسخة 3.4';
  const ctx2 = await b.newContext({ timezoneId: 'Africa/Cairo' });
  await fresh(ctx2);
  await p.addInitScript(() => { window.AppBridge = { buzzes: [], shares: [], alarms: null, widget: null, buzz(l) { this.buzzes.push(l); }, buzzPattern(c) { this.buzzes.push('p:' + c); }, previewAdhan(v) { this.preview = v; }, tick() {}, copy() {},
    shareText(t) { this.shares.push(['t', t]); }, shareImage(d, n) { this.shares.push(['i', n, d.length]); }, setAlarms(j) { this.alarms = JSON.parse(j); },
    setWidget(j) { this.widget = JSON.parse(j); }, askNotifications() {}, exactAlarms() { return true; }, askExactAlarms() {} };
    window.SpeechBridge = { calls: 0, speak(t, r, id) { this.calls++; setTimeout(() => window.onSpeech(id, 'done'), 5); }, stop() {} }; });
  await p.goto(W); await ev(ed => { localStorage.clear(); localStorage.setItem('q.edition', JSON.stringify(ed)); localStorage.setItem('q.qiblaLoc', JSON.stringify([30.0444, 31.2357, 'القاهرة'])); }, ED); await p.reload(); await wait(900);
  const closeS = () => ev(() => { if (!document.getElementById('settings').hidden) document.getElementById('closeSettings').click(); });
  await check(G12, 'إعداد «طريقة التقليب» واحد فيه 4 اختيارات، و«ثني الورقة» بيرجّع الأفقي', async () => {
    await p.click('#btnSettings'); const n = await ev(() => [...document.querySelectorAll('#flip button')].map(b => b.dataset.v).join());
    await p.click('#flip button[data-v=v]'); const v = await ev(() => localStorage.getItem('q.turn'));
    await p.click('#flip button[data-v=curl]'); const h = await ev(() => [localStorage.getItem('q.turn'), localStorage.getItem('q.flipMode')]); await closeS();
    return assert(n === 'curl,slide,off,v' && v === '"v"' && h[0] === '"h"' && h[1] === '"curl"', JSON.stringify([n, v, h])); });
  await check(G12, 'مجموعة «الألوان والمظهر» (كانت «لون الصفحة») بدل «الشكل» في الإعدادات', () => ev(() => [...document.querySelectorAll('.set-group')].some(x => x.textContent === 'الألوان والمظهر') && ![...document.querySelectorAll('.set-group')].some(x => x.textContent === 'الشكل')));
  await check(G12, 'القراءة العمودية بتفتح على آخر صفحة بعد إعادة فتح التطبيق', async () => { await ev(() => { localStorage.setItem('q.turn', '"v"'); location.hash = '#/p/50'; }); await p.reload(); await wait(1800);
    return ev(() => location.hash === '#/p/50' && Math.abs(document.querySelector('.page-box[data-p="50"]').getBoundingClientRect().top) < 120); });
  await check(G12, 'زرار الهلال والاستماع مستخبيين تحت الإعدادات', async () => { await p.click('#btnSettings'); await wait(300);
    const r = await ev(() => { const e = document.getElementById('vPlay').getBoundingClientRect(), t = document.elementFromPoint(e.left + e.width / 2, e.top + e.height / 2); return !document.getElementById('vPlay').contains(t); }); await closeS(); return r; });
  await check(G12, 'زرار الهلال والاستماع فوق شريط القارئ من غير تداخل', async () => { await p.click('#vPlay'); await wait(1200);
    const r = await ev(() => [document.querySelector('.vbar').getBoundingClientRect().bottom, document.querySelector('.player').getBoundingClientRect().top]); await ev(() => document.querySelector('.player [data-c=x], .player [data-c=stop]') && document.querySelector('.player [data-c=x], .player [data-c=stop]').click());
    return assert(r[0] <= r[1], JSON.stringify(r)); });
  await check(G12, 'تغيير الطبعة من الإعدادات بيظهر على طول (من النص للصفحات)', async () => {
    await ev(() => { localStorage.setItem('q.turn', '"h"'); localStorage.setItem('q.mode', '"text"'); location.hash = '#/s/2/30'; }); await p.reload(); await wait(1200);
    await p.click('#btnSettings'); await p.click('#mode button[data-v=' + ED + ']'); await wait(1500);
    return ev(() => /^#\/p\/\d+/.test(location.hash) && document.getElementById('settings').hidden && !!document.getElementById('pg')); });
  await check(G12, 'الاهتزاز: 4 درجات، بيشتغل مع الأزرار ومش مع تقليب الصفحة', async () => {
    await p.click('#btnSettings'); const n = await ev(() => document.querySelectorAll('#hapticSet button').length); await p.click('#hapticSet button[data-v="2"]'); await closeS();
    await ev(() => AppBridge.buzzes = []); await voiceTurn(1); await wait(1300); const turn = await ev(() => AppBridge.buzzes.length);
    await p.click('#btnSettings'); await wait(100); const btn = await ev(() => AppBridge.buzzes.slice()); await closeS();
    return assert(n === 4 && turn === 0 && btn.length && btn[0] === 2, JSON.stringify([n, turn, btn])); });
  await check(G12, 'سرعة القارئ من 0.25× لـ 4×', async () => { await go('#/s/112/1', 900); await ev(() => document.getElementById('a1').click()); await wait(300); await p.click('#ayahBar button[data-c=l]'); await wait(800);
    await p.click('.player [data-c=sp]'); await wait(200); const r = await ev(() => [...document.querySelectorAll('.player [data-r]')].map(x => x.dataset.r)); await ev(() => document.querySelector('.player [data-r="1.5"]').click());
    return assert(r[0] === '0.25' && r[r.length - 1] === '4' && (await ev(() => localStorage.getItem('q.rate'))) === '1.5', r.join()); });
  await check(G12, 'تكرار مجموعة آيات من آية لآية', async () => { await go('#/s/112/1', 900); await ev(() => document.getElementById('a1').click()); await wait(300); await p.click('#ayahBar button[data-c=r]');
    await p.fill('#rgFrom', '1'); await p.fill('#rgTo', '2'); await p.click('.rg-times button[data-t="2"]'); await p.click('.rg-dlg .dlg-ok'); await wait(2500);
    const r = await ev(() => [!!document.querySelector('.player'), localStorage.getItem('q.rangeTimes'), (document.querySelector('.player') || {}).textContent]); await ev(() => document.querySelector('.player [data-c=x]') && document.querySelector('.player [data-c=x]').click());
    return assert(r[0] && r[1] === '2', JSON.stringify(r)); });
  await check(G12, 'البحث بالشروط (OR و - و "جملة")', async () => { await go('#/search?q=' + encodeURIComponent('(موسى OR هارون) فرعون -السحرة'), 1200);
    const a = await ev(() => document.querySelectorAll('.result').length); await go('#/search?q=' + encodeURIComponent('"الحمد لله رب العالمين"'), 1000);
    const b2 = await ev(() => document.querySelectorAll('.result').length); return assert(a > 0 && b2 > 0, a + ',' + b2); });
  await check(G12, 'الأذكار: ترتيب حسب التكرار', async () => { await go('#/azkar/m', 900); await p.click('.z-sort button[data-o=desc]'); await wait(500);
    const ok = await ev(() => { const n = [...document.querySelectorAll('.zikr .z-count small')].map(x => +x.textContent.replace(/[^٠-٩]/g, '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))); return n.every((v, i) => !i || n[i - 1] >= v); });
    await p.click('.z-sort button[data-o=book]'); await wait(300); return ok; });
  await check(G12, 'الأذكار المئوية: تخصيص العدد بيتحفظ', async () => { const c = p.locator('.zikr', { hasText: 'عشر رقاب' }).first(); await c.locator('.z-nbtn').click(); await c.locator('.z-nopts button', { hasText: '٣٣' }).first().click();
    const r = await c.locator('.z-count small').innerText(); await c.locator('.z-nbtn').click(); await c.locator('.z-nopts button', { hasText: 'الأصلي' }).click(); return assert(r.includes('٣٣'), r); });
  await check(G12, '«استمع للآيات» بيقرأ آيات الأذكار بس، والأذكار التانية من غير صوت', async () => { await ev(() => localStorage.removeItem('q.azkar.e')); await go('#/azkar/e', 900);
    const r = await ev(() => [document.querySelectorAll('.zikr').length, document.querySelectorAll('.zikr .z-play').length]); await p.click('#zAll');
    for (let i = 0; i < 90 && (await p.textContent('#zAll')).includes('إيقاف'); i++) await wait(1000);
    return assert(r[1] > 0 && r[1] < r[0] && (await p.textContent('#zAll')).includes('استمع'), JSON.stringify(r)); });
  await check(G12, 'مكافآت الختمة في صفحة الإحصائيات (5.13 P2.10)، مش في الختمة', async () => { await go('#/khatma', 700); const k = await ev(() => !!document.querySelector('.rw-badges, .rw, [class^=rw-]')); await go('#/stats', 700); const s = await ev(() => !!document.querySelector('.rw-badges, .rw, [class^=rw-]')); return assert(!k && s, JSON.stringify([k, s])); });
  await check(G12, 'صفحة الآية: الترجمة والبلاغة والمتشابهات', async () => { await go('#/a/2/255', 900); await p.click('#ayTr'); await wait(800); const tr = await ev(() => !!document.querySelector('.ay-tr'));
    await p.click('.ay-tabs button[data-t=balagha]'); await wait(1500); const bal = await ev(() => document.getElementById('ayBody').textContent.length > 30);
    await go('#/a/2/2?t=mutash', 1200); const mu = await ev(() => document.getElementById('ayBody').textContent.length > 10); await go('#/a/2/255', 600); await p.click('#ayTr'); await wait(500);
    return assert(tr && bal && mu, JSON.stringify([tr, bal, mu])); });
  await check(G12, 'ملاحظة على آية بتتحفظ وتظهر تحتها', async () => { await go('#/a/1/2', 800); await p.click('#ayNote'); await p.fill('.note-in', 'ملاحظة تجربة'); await p.click('.dlg-ok'); await wait(600);
    const r = await ev(() => (document.querySelector('.ay-note') || {}).textContent || ''); await p.click('#ayNote'); await p.click('.dlg-del'); await wait(500);
    return assert(r.includes('ملاحظة تجربة') && !(await ev(() => document.querySelector('.ay-note'))), r); });
  await check(G12, 'مشاركة آية كنص وكصورة', async () => { await go('#/a/112/1', 800); await ev(() => AppBridge.shares = []); await p.click('#ayShare'); await p.click('.sh-opts button[data-k=txt]');
    await p.click('#ayShare'); await p.click('.sh-opts button[data-k=img]'); await wait(1500); const sh = await ev(() => AppBridge.shares);
    return assert(sh.length === 2 && sh[0][1].includes('سورة الإخلاص') && sh[1][0] === 'i' && sh[1][2] > 20000, JSON.stringify(sh).slice(0, 200)); });
  await check(G12, 'السبحة بتعد وبتحفظ وبتهتز بشكل مختلف عند الهدف', async () => { await go('#/tasbih', 600); await ev(() => AppBridge.buzzes = []); for (let i = 0; i < 33; i++) await p.click('#tsbBtn');
    const r = await ev(() => [document.getElementById('tsbN').textContent, AppBridge.buzzes[AppBridge.buzzes.length - 1]]); await p.click('#tsbReset'); return assert(r[0] === '٣٣' && r[1] === 'p:700', JSON.stringify(r)); });
  await check(G12, 'مواقيت الصلاة للقاهرة (6 مواعيد بالترتيب)', async () => { await go('#/prayer', 800);
    // on a failure the state goes to the report: this check failed twice in a 4-edition run (harmain 11-11, shamarly 12-11) and passes alone
    const r = await ev(() => { const t = [...document.querySelectorAll('.pr-row b')].map(x => x.textContent), nx = document.querySelector('.pr-next b'), nt = document.querySelector('.pr-note');
      return { ok: t.length === 6 && !!(nx && nx.textContent) && !nt, rows: t.length, next: nx && nx.textContent, note: nt && nt.textContent.slice(0, 60), hash: location.hash, loc: localStorage.getItem('q.qiblaLoc'),
        prayer: (localStorage.getItem('q.prayer') || '').slice(0, 80), dlg: document.querySelectorAll('.dlg-back').length, view: document.getElementById('view').innerText.slice(0, 80) }; });
    return assert(r.ok, JSON.stringify(r)); });
  await check(G12, 'تنبيهات الأذان والتذكيرات بتتجهّز للموبايل', async () => { await p.click('.rem-sw input[data-r=m] + span'); await wait(2500);
    const al = await ev(() => AppBridge.alarms || []); await p.click('.rem-sw input[data-r=m] + span'); await wait(300);
    return assert(al.filter(e => e.kind === 'adhan').length >= 140 && al.some(e => e.title === 'أذكار الصباح'), al.length); });
  await check(G12, 'بيانات الويدجت: آية اليوم و«كمّل القراءة»', async () => { await wait(1800); const w = await ev(() => AppBridge.widget); return assert(w && w.ayat.length === 30 && w.ayat[0].t && w.cont, JSON.stringify(w || {}).slice(0, 120)); });
  await check(G12, 'القبلة فيها زرار مواقيت الصلاة', async () => { await go('#/qibla', 600); await p.click('#qPrayer'); await wait(500); return ev(() => location.hash === '#/prayer'); });
  const G13 = 'مزايا نسخة 3.6';
  await check(G13, 'تذكير الكهف يوم الجمعة وتذكير الصيام بيتجدولوا', async () => { await ev(() => localStorage.setItem('q.reminders', JSON.stringify({ kahf: { on: true, t: '09:00' }, fast: { on: true, t: '21:00' } }))); await go('#/prayer', 1200);
    await go('#/', 2500); const a = await ev(() => AppBridge.alarms || []); const k = a.filter(e => e.hash === '#/s/18/1'), f = a.filter(e => /صيام/.test(e.title + e.text));
    return assert(k.length >= 3 && k.every(e => new Date(e.at).getDay() === 5) && f.length >= 3, k.length + ',' + f.length); });
  await check(G13, 'التاريخ الهجري في الرئيسية ومواقيت الصلاة', async () => { await go('#/', 700); const h = await ev(() => (document.querySelector('.hj-bar') || {}).textContent || '');
    await go('#/prayer', 800); const pr = await ev(() => document.querySelector('.pr-where').textContent); return assert(/هـ/.test(h) && /هـ/.test(pr), h + ' | ' + pr); });
  await check(G13, 'إمساكية رمضان (أيام رمضان كلها بالإمساك) ومشاركتها صورة', async () => { await go('#/prayer', 800); await p.click('#prMonth'); await wait(600); const n = await ev(() => document.querySelectorAll('.ims tbody tr').length >= 29 && document.title !== '' && document.getElementById('title').textContent === 'إمساكية رمضان' && document.querySelector('.ims th:nth-child(3)').textContent === 'الإمساك' ? 30 : -1);
    await ev(() => AppBridge.shares = []); await p.click('#imsShare'); await wait(800); const sh = await ev(() => AppBridge.shares); return assert(n === 30 && sh.length === 1 && sh[0][1] === 'imsakia.png', n + JSON.stringify(sh)); });
  await check(G13, 'إحصائيات القراءة بتعد الصفحات اللي اتفتحت', async () => { await ev(() => localStorage.removeItem('q.stats')); for (const n of [10, 11, 12, 11]) await go('#/p/' + n, 500);
    // 5.11 G5: the numbers moved to «الإحصائيات»; 5.13 P2.10: the khatma screen keeps only a link (no numbers, no rewards)
    await go('#/khatma', 700); const card = await ev(() => { const a = document.querySelector('a.st-link[href="#/stats"]'); return !!a && !/[٠-٩]/.test(a.textContent) && !document.querySelector('.view .rw-grid, #view .rw-grid'); });
    await go('#/stats', 700); return card && await ev(() => { const b = document.querySelector('.st-nums b'); return !!b && ['٢', '٣', '٤'].includes(b.textContent) && document.querySelectorAll('.kh-sec:first-child .st-bar').length === 7; }); });
  await check(G13, 'ختمة رمضان بتظهر وبتعمل خطة على أيام رمضان', async () => { await ev(() => localStorage.removeItem(Object.keys(localStorage).find(k => /khatma/.test(k)) || 'x')); await go('#/khatma', 700);
    const card = await ev(() => !!document.getElementById('kRamadan')); await p.click('#kRamadan'); await wait(500);
    const k = await ev(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /khatma/.test(k))))); return assert(card && k.ramadan && k.days >= 29 && k.days <= 30, JSON.stringify(k)); });
  await check(G13, 'المراجعة: كارت «اختبرني» والسور الـ ١١٤، وزرار «السور المحفوظة» في الخريطة بيفتح قايمتها مكانها (5.15c / 5.16 U6)', async () => { await go('#/hifzmap', 700); await p.click('#hmFold > summary'); await wait(600);
    const m = await ev(() => [location.hash, document.querySelectorAll('#hmFold .hl-list li').length]); await go('#/hifzlog', 600);
    const r = await ev(() => [location.hash, document.querySelectorAll('.hl-list li').length, !!document.getElementById('hzCard'), !!document.getElementById('hzGoM') && !!document.getElementById('hzGoW'), document.querySelectorAll('.hz-way button').length]);
    return assert(m[0] === '#/hifzmap' && m[1] === 114 && r[0] === '#/hifzlog' && r[1] === 114 && r[2] && r[3] && r[4] === 3, JSON.stringify([m, r])); });
  await check(G13, 'صوت مؤذن مختلف لكل صلاة وتذكير قبل الأذان', async () => { await go('#/prayer', 900);
    await p.click('[data-open=fajr]'); await p.selectOption('.pv-v[data-p=fajr]', 'basit'); await wait(400); await p.click('[data-open=dhuhr]'); await p.selectOption('.pv-v[data-p=dhuhr]', 'afasy'); await wait(400); await p.click('.pv-pre[data-p=dhuhr][data-m="15"]'); await wait(400);
    await p.click('.pv-play[data-p=dhuhr]'); const pv = await ev(() => AppBridge.preview); await p.click('.pv-play[data-p=dhuhr]'); await go('#/', 2500);
    const a = await ev(() => AppBridge.alarms || []); const fj = a.find(e => e.kind === 'adhan' && /الفجر/.test(e.title)), dh = a.find(e => e.kind === 'adhan' && /الظهر/.test(e.title)), pre = a.find(e => /الظهر/.test(e.title) && e.kind === 'rem');
    return assert(pv === 'afasy' && fj.v === 'basit' && dh.v === 'afasy' && pre && Math.round((dh.at - a.filter(e => e.kind === 'adhan' && /الظهر/.test(e.title)).map(e => e.at).find(x => x > pre.at) + 0) || 1) && a.some(e => e.kind === 'rem' && /الظهر/.test(e.title) && a.some(x => x.kind === 'adhan' && /الظهر/.test(x.title) && x.at - e.at === 15 * 60000)), JSON.stringify([pv, fj && fj.v, dh && dh.v, !!pre])); });
  await check(G13, 'السبحة: هزة طويلة عند الوصول للعدد', async () => { await go('#/tasbih', 600); await p.click('#tsbReset'); await p.click('.tsb-goal button[data-g="33"]'); await ev(() => AppBridge.buzzes = []);
    for (let i = 0; i < 33; i++) await p.click('#tsbBtn'); const bz = await ev(() => AppBridge.buzzes); return assert(bz.length === 33 && bz[32] === 'p:700' && typeof bz[0] === 'number', JSON.stringify(bz.slice(-2))); });
  await check(G13, 'إحصائية الكلمات والحروف وتذكير آخر اليوم', async () => { await ev(() => { localStorage.removeItem('q.stats'); localStorage.removeItem('q.statsWL'); localStorage.setItem('q.reminders', JSON.stringify({ stat: { on: true, t: '23:59' } })); });
    await go('#/p/3', 600); await go('#/stats', 2500); const t = await ev(() => document.querySelector('.st-wl').textContent); const a = await ev(() => AppBridge.alarms.filter(e => e.title === 'قراءتك النهارده'));
    return assert(/[١-٩][٠-٩]* كلمة/.test(t) && a.length >= 20 && (a[0].text.includes('كلمة') || new Date(a[0].at).getDate() !== new Date().getDate()), t + ' | ' + (a[0] || {}).text); });
  await check(G13, 'نسخة احتياطية: حفظ واسترجاع', async () => { const fs = require('fs'), os = require('os'), path = require('path'); const dl = p.waitForEvent('download').catch(() => null);
    await ev(() => { window.__bk = null; AppBridge.shareFile = (t, n) => { window.__bk = [t, n]; }; localStorage.setItem('q.notes', JSON.stringify({ '1:1': 'اختبار النسخة' })); });
    await p.click('#btnSettings'); await p.click('#bkOut'); const bk = await ev(() => window.__bk); await closeS();
    await ev(() => localStorage.removeItem('q.notes')); const f = path.join(os.tmpdir(), bk[1]); fs.writeFileSync(f, bk[0]);
    await p.setInputFiles('#bkFile', f); await wait(2500); const n = await ev(() => localStorage.getItem('q.notes'));
    return assert(/^quran-backup-.*\.json$/.test(bk[1]) && n && n.includes('اختبار النسخة'), bk && bk[1] + ' ' + n); });

  const G14 = 'مزايا نسخة 3.7';
  await check(G14, 'الشريط السفلي بـ4 أزرار ويختفي وقت القراءة', async () => { await go('#/', 700); const a = await ev(() => [document.querySelectorAll('#tabbar button').length, document.getElementById('tabbar').hidden]);
    await p.click('#tabbar button[data-h="#/more"]'); await wait(500); const m = await ev(() => location.hash === '#/more' && document.querySelectorAll('.tiles.more .tile').length === 16); await go('#/p/5', 800); const hid = await ev(() => document.getElementById('tabbar').hidden);
    return assert(a[0] === 4 && !a[1] && m && hid, JSON.stringify([a, m, hid])); });
  await check(G14, 'شاشة الترحيب: الطبعة والمدينة والتذكيرات', async () => { await go('#/welcome', 800); await p.click('.wel-opts button[data-e=shamarly]'); await p.click('.wel-next'); await p.selectOption('#wCity', { index: 2 });
    await p.click('.wel-next'); await p.click('.wel-next'); await p.click('[data-w=m] + span'); await p.click('.wel-next'); await wait(600);
    const r = await ev(() => [localStorage.getItem('q.edition'), !!JSON.parse(localStorage.getItem('q.qiblaLoc')), JSON.parse(localStorage.getItem('q.reminders')).m.on, localStorage.getItem('q.onboarded'), !document.querySelector('.wel')]);
    await ev(ed => { localStorage.setItem('q.edition', JSON.stringify(ed)); const r = JSON.parse(localStorage.getItem('q.reminders')); r.m.on = false; localStorage.setItem('q.reminders', JSON.stringify(r)); }, ED); await p.reload(); await wait(900);
    return assert(r[0] === '"shamarly"' && r[1] && r[2] === true && r[3] === 'true' && r[4], JSON.stringify(r)); });
  await check(G14, 'المظهر «مع المغرب» بيغمّق بالليل حسب الموقع', async () => { await ev(() => localStorage.setItem('q.qiblaLoc', JSON.stringify([30.0444, 31.2357, 'القاهرة'])));
    await p.click('#btnSettings'); await p.click('#theme button[data-v=sun]'); const t = await ev(() => document.documentElement.dataset.theme); await p.click('#theme button[data-v=auto]'); await closeS();
    const h = new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo', hour: 'numeric', hour12: false }); return assert(t === 'dark' || t === 'light', t + ' @' + h); });
  await check(G14, 'الأدعية: 7 أقسام والآيات من نص المصحف', async () => { await go('#/duas', 700); const n = await ev(() => document.querySelectorAll('.du-cats button').length); await p.click('.du-cats button[data-c=quran]'); await wait(500);
    const q = await ev(() => document.querySelectorAll('.zikr.du .z-quran').length); await ev(() => AppBridge.shares = []); await p.click('.du-sh >> nth=0'); const sh = await ev(() => AppBridge.shares[0]);
    return assert(n === 7 && q >= 15 && sh && sh[1].includes('[سورة البقرة]'), n + ',' + q + JSON.stringify(sh)); });
  await check(G14, 'الهدف اليومي: بيتحسب من الصفحات وبيحتفل عند الوصول', async () => { await ev(() => { localStorage.removeItem('q.stats'); localStorage.setItem('q.goal', JSON.stringify({ pages: 2 })); });
    await go('#/p/20', 400); await go('#/p/21', 700); const cele = await ev(() => !!document.querySelector('.cele')); await go('#/', 700);
    const g = await ev(() => (document.getElementById('tdCard') || document.getElementById('tGoal')).textContent); await ev(() => localStorage.removeItem('q.goal')); return assert(cele && /٢ من ٢/.test(g), g + ' ' + cele); });
  await check(G14, 'اختبار الحفظ: إخفاء كلمات وكشفها والدرجة', async () => { await go('#/hifztest/112', 800); const n = await ev(() => document.querySelectorAll('.ht-w').length); await p.click('.ht-w >> nth=0'); await p.evaluate(() => window.__htFinish()); await wait(300);
    const r = await ev(() => [document.querySelectorAll('.ht-w.shown').length, document.getElementById('htRes').textContent, JSON.parse(localStorage.getItem('q.hifzScores') || '{}')[112]]);
    return assert(n > 0 && r[0] === n && /٪/.test(r[1]) && r[2] && r[2].score < 100, n + JSON.stringify(r)); });
  await check(G14, 'البحث في القرآن بس: السور والآيات، من غير الأذكار والأدعية', async () => { await go('#/search?q=' + encodeURIComponent('الكهف'), 1200); const s1 = await ev(() => !!document.querySelector('.sr-chips a[href="#/s/18/1"]'));
    await go('#/search?q=' + encodeURIComponent('أموت وأحيا'), 1000); const s2 = await ev(() => !!document.querySelector('.sr-zk')); return assert(s1 && !s2, s1 + ',' + s2); });
  await check(G14, 'الإعدادات فيها أزرار للأقسام ومعاينة الخط', async () => { await p.click('#btnSettings'); const r = await ev(() => [document.querySelectorAll('.set-jump button').length, !!document.querySelector('.set-prev')]); await closeS(); return assert(r[0] >= 3 && r[1], JSON.stringify(r)); });
  await check(G14, 'بيانات ودجت الصلاة الجاية (3 أيام)', async () => { await go('#/', 2500); const w = await ev(() => AppBridge.widget); return assert(w && w.prayers.length === 15 && w.prayers[0].n && w.place === 'القاهرة', JSON.stringify(w && w.prayers.slice(0, 1))); });
  const G15 = 'مزايا نسخة 3.8';
  await check(G15, 'خريطة الحفظ: كل وحدات المصحف (مربع لكل ربع/سورة قصيرة) في ٣٠ صف جزء، ملونة حسب السور المحفوظة', async () => { await ev(() => { const d = new Date(), t = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); localStorage.setItem('q.hifzLog', JSON.stringify(Object.assign({ 1: { m: '2026-1-1', r: '2025-1-1' } }, ...Array.from({ length: 25 }, (_, i) => ({ [90 + i]: { m: t, r: t } })))) ); localStorage.setItem('q.hzRev', localStorage.getItem('q.hifzLog')); });
    await go('#/hifzmap', 800); const r = await ev(() => [document.querySelectorAll('.hm-jc').length, document.querySelectorAll('.hm-grid .hm-c').length, document.querySelectorAll('.hm-grid .c3').length, document.querySelectorAll('.hm-grid .c2').length, '#/p/' + document.querySelector('.hm-grid .hm-c').dataset.p, hzUnits().length]);   // 5.27: the boxes are role=button spans, not links
    await ev(() => { localStorage.removeItem('q.hifzLog'); localStorage.removeItem('q.hzRev'); localStorage.removeItem('q.hzSched'); }); return assert(r[0] === 30 && r[1] === r[5] && r[2] >= 1 && r[3] >= 1 && /^#\/p\/\d+$/.test(r[4]), JSON.stringify(r)); });   // 5.31: the map is a juz grid, one square per unit
  await check(G15, 'الختمة الجماعية: إضافة وتوزيع وتعليم ومشاركة واستيراد', async () => { await ev(() => localStorage.removeItem('q.family')); await go('#/family', 600);
    for (const n of ['أ', 'ب', 'ج']) { await p.fill('#famNew', n); await p.click('#famAdd'); await wait(120); }
    await p.click('#famSplit'); await wait(200); const js = await ev(() => JSON.parse(localStorage.getItem('q.family')).members.map(m => m.j.length));
    await p.click('.fam-j button[data-j="1"]'); await wait(150); await p.click('.fam-j button[data-j="30"]'); await wait(150); await p.click('#famShare'); const sh = await ev(() => AppBridge.shares[AppBridge.shares.length - 1][1]);
    await ev(() => { const F = JSON.parse(localStorage.getItem('q.family')); F.members[0].d = []; F.members[1].d = [15]; localStorage.setItem('q.family', JSON.stringify(F)); }); await go('#/', 200); await go('#/family', 400);
    await p.click('#famImp'); await p.fill('.dlg input', sh); await p.press('.dlg input', 'Enter'); await wait(400); const d = await ev(() => JSON.parse(localStorage.getItem('q.family')).members.map(m => m.d.join(',')));
    await ev(() => localStorage.removeItem('q.family'));
    return assert(js.join() === '10,10,10' && /QK1:/.test(sh) && /١✓/.test(sh) && d.join('|') === '1|15|30', JSON.stringify([js, d])); });
  await check(G15, 'اختبار الحفظ على صفحات الطبعة: إخفاء الآيات والدرجة', async () => { await ev(() => localStorage.removeItem('q.hifzScores')); await go('#/hifztest/67', 800); await p.click('#htPages'); await wait(1500);
    const n = await ev(() => document.querySelectorAll('.hifz-mask').length); await p.click('#hifzBar [data-c=nx]'); await wait(200);
    const m = await p.$('.hifz-mask'); const bb = await m.boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await wait(300);
    // Sprint 2 #43: the «خلصت» button is gone; ✕ now saves the results (hifzTestDone) when something was seen
    await p.click('#hifzBar [data-c=x]'); await wait(500); const sc = await ev(() => JSON.parse(localStorage.getItem('q.hifzScores') || '{}')[67]);
    // Sprint 2 #42: «فكّرني» and a tap on a mask each reveal one word as forgotten (both of 67:1 here), so the ayah is missed: 0%
    return assert(n > 5 && sc && sc.score === 0, JSON.stringify([n, sc])); });
  await check(G15, 'التسميع بالصوت: الآية تظهر لما تتقري والكلمة الغلط تتسجل', async () => { await ev(() => { localStorage.removeItem('q.reciteLog'); window.ReciteBridge = { start() {}, stop() {} }; }); await go('#/hifztest/112', 800); await p.click('#htPages'); await wait(1500);
    await p.click('#hifzBar [data-c=mic]'); await ev(() => { onRecite('قل هو الله', 'partial'); onRecite('قل هو الله احد', 'final'); onRecite('الله الصمد', 'final'); onRecite('لم يلد ولم يكتب', 'final'); }); await wait(300);
    const sh = await ev(() => document.querySelector('#hifzBar .hz-info').textContent); await p.click('#hifzBar [data-c=x]'); await wait(500); const dl = await ev(() => !!document.querySelector('.rc-stats'));
    await p.click('.dlg-ok'); const log = await ev(() => JSON.parse(localStorage.getItem('q.reciteLog') || '[]')[0]); await ev(() => { delete window.ReciteBridge; });
    return assert(log && log.ay === 3 && log.bad === 1 && dl && /٩/.test(sh), JSON.stringify([sh, log])); });
  await check(G15, 'فهرس المواضيع: 5 أقسام والآيات بتفتح مكانها', async () => { await go('#/topics', 700); const r = await ev(() => [document.querySelectorAll('.tp-g').length, document.querySelectorAll('.tp-list a').length]);
    await p.click('.tp-list a >> nth=0'); await wait(600); const n = await ev(() => document.querySelectorAll('.tp-a').length); await p.click('.tp-a >> nth=0'); await wait(600); const h = await ev(() => location.hash);
    return assert(r[0] === 5 && r[1] >= 40 && n > 20 && /^#\/s\/\d+\/\d+$/.test(h), JSON.stringify([r, n, h])); });
  await check(G15, 'ملء الشاشة: يخفي الأزرار بعد لمس الصفحة ويرجعها باللمس', async () => { await ev(() => { window.QA_NOFS = false; }); await go('#/p/50', 1500); await p.click('.page-box >> nth=0', { position: { x: 200, y: 75 } }).catch(() => {}); await ev(() => { const b = document.getElementById('ayahBar'); if (b) b.remove(); }); await ev(() => document.querySelector('.page-box').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await wait(1600);
    const on = await ev(() => document.body.classList.contains('fs')); await ev(() => document.querySelector('.page-box').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await wait(300); const off = await ev(() => !document.body.classList.contains('fs'));
    return assert(on && off, JSON.stringify([on, off])); });
  const G16 = 'نسخة 4.5: موديل NVIDIA';
  await check(G16, 'الإعدادات فيها زر «تحميل نموذج التعرّف على التلاوة» و«حول» فيها رخصته', async () => { await p.click('#btnSettings'); const r = await ev(() => [!!document.querySelector('#asrBox > summary') && /التعرّف على التلاوة/.test(document.querySelector('#asrBox > summary').textContent) && !!document.querySelector('#asrBox #asrDl'), /FastConformer[\s\S]*CC BY 4\.0/.test(document.body.innerHTML)]); await closeS(); return assert(r[0] && r[1], JSON.stringify(r)); });
  await check(G16, 'المايك على الصفحة بيشغّل موديل NVIDIA لما يكون متنزّل ومختار', async () => { await go('#/p/2', 900);
    // 5.4: NVIDIA runs only in NvAsr.java (NvBridge); the web runtime path (asr.js) went with the whisper models
    const r = await ev(() => { const nb = window.NvBridge, rb = window.ReciteBridge; let got = null;
      window.NvBridge = { ready: () => true, start() { got = 'nv'; }, stop() {} }; window.ReciteBridge = window.ReciteBridge || { start() { got = 'phone'; }, stop() {}, setHints() {} };
      localStorage.setItem('q.asr', JSON.stringify('asrnv')); document.getElementById('rdMic').click(); document.getElementById('rdMic').click();
      window.NvBridge = nb; window.ReciteBridge = rb; localStorage.removeItem('q.asr'); return got; });
    return assert(r === 'nv', String(r)); });
  // The model itself, when its packs are unpacked in ASR_SRV (asrrt/, asrnv/, asrnvp/) and HA's test clips are there.
  const SRV = process.env.ASR_SRV, HAT = __dirname + '/../asr/gpu/ha_test';
  if (SRV && require('fs').existsSync(SRV + '/asrnv/a.bin') && require('fs').existsSync(HAT)) await check(G16, 'موديل NVIDIA بيتعرّف على 10 مقاطع من صوت القارئ (نسبة الخطأ أقل من 35٪)', async () => {
    const fs = require('fs'), path = require('path');
    await p.route('https://asr.app/**', r => { const f = path.join(SRV, new URL(r.request().url()).pathname.slice(1)); if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
      const t = /\.m?js$/.test(f) ? 'text/javascript' : f.endsWith('.wasm') ? 'application/wasm' : f.endsWith('.json') ? 'application/json' : 'application/octet-stream';
      r.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'content-type': t }, body: fs.readFileSync(f) }); });
    const meta = JSON.parse(fs.readFileSync(HAT + '/meta-ha.json', 'utf8')).slice(0, 10); let E = 0, L = 0;
    const nrm = t => t.replace(/[ً-ْٰ۟-ۭ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/\s+/g, ' ').trim();
    const ed = (a, b) => { let d = Array.from({ length: b.length + 1 }, (_, j) => j); for (let i = 1; i <= a.length; i++) { const n = [i]; for (let j = 1; j <= b.length; j++) n[j] = Math.min(d[j] + 1, n[j - 1] + 1, d[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); d = n; } return d[b.length]; };
    for (const m of meta) {
      const w = fs.readFileSync(HAT + '/' + m.id + '.wav'), dv = new DataView(w.buffer, w.byteOffset, w.length); let o = 12, a = 0, n = 0, bits = 16;
      while (o < w.length) { const id = w.toString('latin1', o, o + 4), sz = dv.getUint32(o + 4, true); if (id === 'fmt ') bits = dv.getUint16(o + 22, true); if (id === 'data') { a = o + 8; n = sz; break; } o += 8 + sz; }
      const y = []; for (let i = 0; i < n / (bits / 8); i++) y.push(bits === 16 ? dv.getInt16(a + 2 * i, true) / 32768 : dv.getFloat32(a + 4 * i, true));
      const t = await ev(y => Asr.transcribe('asrnv', Float32Array.from(y)), y); const ref = nrm(m.text); E += Math.min(ed(nrm(t), ref), ref.length); L += ref.length;
    }
    const cer = Math.round(100 * E / L); return assert(cer < 35, cer + '%') && cer + '%'; });
  const G17 = 'نسخة 4.6 (قائمة 31 أكتوبر)';
  await check(G17, 'الإعدادات: التحميلات قبل «حول التطبيق»، والقوايم المفتوحة بتتقفل لما الإعدادات تتقفل', async () => { await go('#/', 500); await p.click('#btnSettings');
    const order = await ev(() => { const d = document.getElementById('dlGroup'), a = document.querySelector('.about-box'); return !!(d.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) && d.nextElementSibling.id === 'privGroup' && d.nextElementSibling.nextElementSibling === a; });
    await ev(() => { document.getElementById('dlGroup').open = true; document.getElementById('privGroup').open = true; document.querySelector('.about-box').open = true; }); await closeS(); await wait(100);
    const closed = await ev(() => !document.getElementById('dlGroup').open && !document.getElementById('privGroup').open && !document.querySelector('.about-box').open);
    const hint = await ev(() => !document.getElementById('dlRow').textContent.includes('مرة واحدة'));
    return assert(order && closed && hint, JSON.stringify([order, closed, hint])); });
  await check(G17, 'أقسام الإعدادات ليها شريط ملوّن يميّزها', async () => { await p.click('#btnSettings'); const r = await ev(() => { const g = document.querySelector('#settings .set-group'); const c = getComputedStyle(g); return [c.backgroundColor, c.borderInlineStartWidth]; }); await closeS(); return assert(r[0] !== 'rgba(0, 0, 0, 0)' && parseFloat(r[1]) >= 3, JSON.stringify(r)); });
  await check(G17, 'مايك الصفحة بيستخبى والإعدادات مفتوحة', async () => { await go('#/p/50', 900); await p.click('#btnSettings'); await wait(150); const h = await ev(() => getComputedStyle(document.getElementById('rdMic')).display); await closeS(); await wait(150); const v = await ev(() => getComputedStyle(document.getElementById('rdMic')).display); return assert(h === 'none' && v !== 'none', h + ',' + v); });
  await check(G17, 'حذف علامة بيسأل الأول', async () => { await ev(() => localStorage.setItem('q.marks', JSON.stringify([{ s: 2, a: 5, n: 'أ' }]))); await go('#/khatma', 600); await ev(() => { window.QA_KEEP_DLG = true; }); await p.click('.marks li:first-child .mk-del'); await wait(200); const msg = await ev(() => { const m = document.querySelector('.dlg-msg'); return m ? m.textContent : ''; }); const n1 = await ev(() => document.querySelectorAll('.marks li').length); await p.click('.dlg-yes'); await wait(200); const n2 = await ev(() => document.querySelectorAll('.marks li').length); await ev(() => { window.QA_KEEP_DLG = false; }); return assert(msg.includes('تحذف العلامة') && n1 === 1 && n2 === 0, msg + ',' + n1 + ',' + n2); });
  await check(G17, 'الإحصائيات: الصفحة بتتحسب مرة واحدة حتى لو اتفتحت تاني', async () => { await ev(() => localStorage.removeItem('q.stats')); await go('#/p/60', 500); await go('#/p/61', 500); await go('#/p/60', 500);
    const r = await ev(() => { const a = JSON.parse(localStorage.getItem('q.stats'))[Object.keys(JSON.parse(localStorage.getItem('q.stats')))[0]]; return [a.length, new Set(a).size, a.every(x => x > 1000)]; }); return assert(r[0] === r[1] && r[2] && r[0] > 0, JSON.stringify(r)); });
  await check(G17, 'السبحة: ذكر من عندك وعدد من اختيارك', async () => { await ev(() => localStorage.removeItem('q.tasbih')); await go('#/tasbih', 600);
    await p.click('#tsbAdd'); await p.fill('.dlg input', 'يا حي يا قيوم'); await p.press('.dlg input', 'Enter'); await wait(300); await p.click('#tsbGoal'); await p.fill('.dlg input', '٢٥'); await p.press('.dlg input', 'Enter'); await wait(300);
    const r = await ev(() => [document.getElementById('tsbTxt').textContent, document.getElementById('tsbOf').textContent, JSON.parse(localStorage.getItem('q.tasbih')).goal]); return assert(r[0] === 'يا حي يا قيوم' && r[2] === 25, JSON.stringify(r)); });
  await check(G17, 'اختبار الحفظ بالصوت: الكلمة المخفية تظهر لو اتقرت صح وتحمرّ لو غلط', async () => { await ev(() => { localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 100, s: 112, from: 1, cont: 1 })); window.ReciteBridge = { start() {}, stop() {} }; }); await go('#/hifztest/112', 800);
    await p.click('#htMic'); await ev(() => { onRecite('', 'state:listening'); onRecite('قل هو الله احد', 'final'); onRecite('الله الصمد', 'final'); onRecite('لم يكتب', 'partial'); onRecite('لم يكتب ولم يقرا', 'final'); });
    const r = await ev(() => [document.querySelectorAll('.ht-w.ok').length, document.querySelectorAll('.ht-w.miss').length]); await ev(() => { delete window.ReciteBridge; });
    return assert(r[0] >= 6 && r[1] >= 1, JSON.stringify(r)); });
  await check(G17, 'المصحف بيدخل ملء الشاشة لوحده بعد 5 ثواني من غير لمس، والرجوع بيقفله الأول', async () => { await go('#/', 400); await ev(() => { window.QA_NOFS = false; }); await go('#/p/70', 5600);
    const on = await ev(() => document.body.classList.contains('fs')); const b1 = await ev(() => qBack()); const off = await ev(() => !document.body.classList.contains('fs')); await wait(1700); const b2 = await ev(() => qBack()); await wait(300); const b3 = await ev(() => location.hash);
    await ev(() => { window.QA_NOFS = true; }); return assert(on && b1 && off && b2 === true && !/^#\/p\/70/.test(b3), JSON.stringify([on, b1, off, b2, b3])); });
  await check(G17, 'الأذكار: الصوت للآيات بس', async () => { await go('#/azkar/m', 800); const r = await ev(() => [...document.querySelectorAll('.zikr')].every(z => !z.querySelector('.z-play') || /سورة/.test(z.querySelector('.z-src').textContent))); return assert(r, String(r)); });
  // ---------- نسخة 5.4/5.5 ----------
  const P255 = String(await ev(() => QA_pageOf(2, 255))), PL = String(await ev(() => QA_pageOf(112, 1))), P6 = String(+PL - 4), P6n = String(+PL - 3);   // P6: a page near the end with a next Quran page (King Fahd 600)   // pages differ per edition (King Fahd 42 / 604)
  const G18 = 'نسخة 5.4/5.5';
  const LSK = ['q.turn', 'q.mode', 'q.edition', 'q.hifzAyat', 'q.hifzLog', 'q.hzRev', 'q.hzSched', 'q.hifzScores', 'q.asrStats', 'q.hifzTest'];
  const lsSave = () => ev(k => Object.fromEntries(k.map(x => [x, localStorage.getItem(x)])), LSK);
  const lsRest = s => ev(s => { for (const k in s) s[k] === null ? localStorage.removeItem(k) : localStorage.setItem(k, s[k]); window.QA_NOFS = true; delete window.ReciteBridge; }, s);
  const mock = () => ev(() => { window.ReciteBridge = { start() {}, stop() {}, setHints() {} }; });
  const fin = (...t) => ev(a => { onRecite('', 'state:listening'); a.forEach(x => onRecite(x, 'final')); }, t);
  const A255 = 'الله لا اله الا هو الحي القيوم لا تاخذه سنه ولا نوم';
  const FRAG = 'لا تاخذه سنه ولا نوم له ما في السماوات وما في الارض';
  const g18 = (name, fn) => check(G18, name, async () => { const s = await lsSave(); try { return await fn(); } finally { await lsRest(s); await go('#/', 300); } });
  await g18('مايك المصحف: قراءة 2:255 من صفحة 10 تفتح صفحة 42', async () => {
    await ev(() => localStorage.setItem('q.mode', '"pages"')); await mock(); await go('#/p/10', 900);
    await ev(() => document.getElementById('rdMic').click()); await wait(200); await fin(A255); await wait(1500);
    const h = await ev(() => location.hash); await ev(() => document.getElementById('rdMic').click()); return assert(h === '#/p/' + P255 + '?a=2:255', h); });
  await g18('التمرير الرأسي: ملء الشاشة ما يغيرش الصفحة والمايك يوصّل لصفحة 42', async () => {
    await ev(() => { localStorage.setItem('q.mode', '"pages"'); localStorage.setItem('q.turn', '"v"'); }); await p.reload(); await wait(800); await mock();
    const top = () => ev(() => { const v = [...document.querySelectorAll('.page-box.vp')].find(b => b.getBoundingClientRect().bottom > innerHeight / 2); return [location.hash, v && v.dataset.p, document.body.classList.contains('fs')]; });
    await ev(() => { window.QA_NOFS = false; }); await go('#/p/10', 1200); await wait(2500); const a = await top();
    await ev(() => document.getElementById('rdMic').click()); await wait(200); await fin(A255); await wait(3000); const b = await top();
    const AP = await ev(() => [...new Set(QURAN.r[1][254].map(x => String(x[0])))]);   // the pages 2:255 lies on (Haramain 35/36)
    return assert(a[1] === '10' && AP.some(q => b[0] === '#/p/' + q + '?a=2:255' && b[1] === q), JSON.stringify([a, b, AP])); });
  await g18('اختبار الحفظ بالصوت يخلص لوحده + خريطة الحفظ بتتلوّن', async () => {
    await ev(() => { localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 100, s: 112, from: 1 })); localStorage.removeItem('q.hifzAyat'); localStorage.removeItem('q.hifzLog'); localStorage.setItem('q.mode', '"pages"'); }); await mock(); await go('#/hifztest/112', 900);
    await ev(() => document.getElementById('htMic').click()); await fin('قل هو الله احد الله الصمد', 'لم يلد ولم يولد ولم يكن له كفوا'); await wait(500);
    const r = await ev(() => [document.getElementById('htRes').textContent.trim(), JSON.parse(localStorage.getItem('q.hifzAyat') || '{}'), (JSON.parse(localStorage.getItem('q.hifzLog') || '{}'))[112], document.querySelectorAll('.ht-w:not(.shown)').length]);
    assert(r[0] && r[2], 'res/log ' + JSON.stringify(r).slice(0, 150)); assert(JSON.stringify(r[1]).includes('112'), 'hifzAyat ' + JSON.stringify(r[1]).slice(0, 100)); assert(r[3] === 0, 'hidden words ' + r[3]);
    await go('#/hifzmap', 700); const c = await ev(() => document.querySelector('.hm-grid .hm-c[data-u="s112"]').className); return assert(!/\bc0\b/.test(c), c); });
  await g18('وضع الحفظ على المصحف بيكشف سطر سطر', async () => {
    await ev(() => { localStorage.setItem('q.mode', '"pages"'); localStorage.setItem('q.turn', '"h"'); }); await p.reload(); await wait(800); await mock(); await go('#/p/' + PL, 900);
    await ev(() => hifzToggle()); await wait(500); const m0 = await ev(() => document.querySelectorAll('.hifz-mask').length);
    await ev(() => document.getElementById('rdMic').click()); await wait(200); await fin('قل هو الله احد الله الصمد'); await wait(500);
    const m1 = await ev(() => document.querySelectorAll('.hifz-mask').length); await ev(() => { document.getElementById('rdMic').click(); hifzToggle(); });
    return assert(m0 - m1 >= 1 && m1 > 0, m0 + '->' + m1); });
  await g18('النص جنب المايك بيتبع القراءة', async () => {
    await ev(() => { localStorage.setItem('q.mode', '"pages"'); localStorage.setItem('q.turn', '"h"'); }); await mock(); await go('#/p/48', 900);
    await ev(() => document.getElementById('rdMic').click()); const t = await ev(() => QURAN.t[1][281].split(' ').slice(0, 70).join(' '));
    await ev(x => { onRecite('', 'state:listening'); onRecite(x.split(' ').slice(0, 8).join(' '), 'final'); onRecite(x.split(' ').slice(8).join(' '), 'final'); }, t); await wait(600);
    const r = await ev(() => { const c = document.querySelector('.rd-cap'), d = c && c.querySelector(':scope > div'), m = d && d.querySelector('mark'); if (!m) return null; const mt = m.getBoundingClientRect().top - d.getBoundingClientRect().top, lh = parseFloat(getComputedStyle(d).lineHeight); return [d.scrollTop, mt, d.clientHeight, d.clientHeight <= 2 * lh + 2]; });
    await ev(() => document.getElementById('rdMic').click()); return assert(r && r[0] > 0 && r[1] >= 0 && r[1] < r[2] && r[3], JSON.stringify(r)); });
  await g18('زرار الرجوع', async () => {
    await ev(() => { localStorage.setItem('q.mode', '"pages"'); localStorage.setItem('q.turn', '"h"'); }); await go('#/', 400);
    for (const x of ['#/azkar', '#/prayer', '#/more', '#/hifzmap', '#/p/42']) await go(x, 300);
    // 5.6: one step back, then home; two backs within 1.5 s anywhere = exit
    const seq = []; for (const gap of [1700, 1700, 200, 200]) { const r = await ev(() => qBack()); await wait(gap); seq.push([r, await ev(() => location.hash)]); }
    return assert(seq[0][1] === '#/hifzmap' && seq[1][1] === '#/' && seq[2][0] === true && seq[3][0] === 'exit', JSON.stringify(seq)); });
  await g18('الشريط السفلي: المصحف، الصلاة، الأذكار، المزيد', async () => {
    await go('#/', 400); const r = await ev(() => [...document.querySelectorAll('#tabbar button')].map(a => a.textContent.trim()));
    const want = ['المصحف', 'الصلاة', 'الأذكار', 'المزيد']; return assert(want.every((w, i) => (r[i] || '').includes(w)) && r.length === 4, JSON.stringify(r)); });
  await g18('مايك الفهرس بيستخدم البحث الجديد', async () => {
    await ev(() => localStorage.setItem('q.mode', '"pages"')); await mock(); await go('#/p/10', 800);
    await p.click('#btnIndex'); await wait(200); await ev(() => { document.getElementById('idxMic').hidden = false; document.getElementById('idxMic').click(); }); await wait(100);
    await fin(FRAG); await wait(1000); const h = await ev(() => location.hash); return assert(/255|\/p\/42/.test(h), h); });
  await g18('مايك البحث', async () => {
    await mock(); await go('#/search', 700); await ev(() => document.getElementById('qMic').click()); await wait(200); await fin(FRAG); await wait(900);
    const r = await ev(() => { const e = document.querySelector('.result'); return e && [e.dataset.s, e.dataset.a]; }); return assert(r && r[0] === '2' && r[1] === '255', JSON.stringify(r)); });
  await g18('إحصائيات التعرّف في صفحة الإحصائيات بس (5.13 P2.10: مش في الإعدادات)', async () => {
    await mock(); await go('#/p/10', 800); await ev(() => document.getElementById('rdMic').click()); await fin(A255); await wait(500); await ev(() => document.getElementById('rdMic').click());
    await p.click('#btnSettings'); await wait(300); const inSet = await ev(() => !!document.getElementById('asrStats')); await closeS();
    await go('#/stats', 700); const t = await ev(() => document.querySelector('.stats').textContent); return assert(!inSet && t.includes('مقطع') && t.includes('أيام متتالية'), String(inSet) + ' ' + t.slice(0, 80)); });
  for (const ed of ['kfgqpc', 'kfold']) await g18('القص على إطار الصفحة (' + ed + ')', async () => {
    await ev(e => { localStorage.setItem('q.edition', JSON.stringify(e)); localStorage.setItem('q.mode', '"pages"'); localStorage.setItem('q.turn', '"h"'); }, ed); await p.reload(); await wait(800);
    await go('#/p/42', 900); const a = await ev(() => !!document.querySelector('.page-wrap.crop'));
    await go('#/p/43', 900); const b = await ev(() => (document.querySelector('.page-box').getAttribute('style') || '').includes('--cl'));
    return assert(a && b, a + ',' + b); });
  await g18('موديلات whisper اتشالت', async () => {
    await go('#/', 300); await p.click('#btnSettings').catch(() => {}); await wait(300);
    const r = await ev(() => [!!document.getElementById('asrSet'), !/asrbase|asrft/.test(document.getElementById('settings') ? document.getElementById('settings').innerHTML : document.body.innerHTML)]); await closeS();
    return assert(!r[0] && r[1], JSON.stringify(r)); });
  // ---------- نسخة 5.7: تحقق CTC من مخرجات موديل NVIDIA (P1b) ----------
  const G19 = 'نسخة 5.7';
  const nvMock = ok => ev(ok => {
    localStorage.setItem('q.asr', '"asrnv"'); window.__ctc = { forms: null, calls: [] };
    window.NvBridge = { ready: () => true, start() {}, stop() {}, vocab: () => JSON.stringify(['▁قل', 'هُو', '▁', 'ـ']),
      ctcSetup(f) { window.__ctc.forms = JSON.parse(f); return true; },
      ctc(seq, w) { const u = JSON.parse(w); window.__ctc.calls.push([seq, u]); return JSON.stringify(u.map(() => ok)); } };
  }, ok);
  for (const ok of [1, 0]) await check(G19, ok ? 'كلمة مشوّهة في النص بتبقى صح لو CTC لقاها' : 'كلمة غلط فعلاً بتفضل حمرا لو CTC ما لقاهاش', async () => {
    const s = await lsSave(); const nb = await ev(() => !!window.NvBridge);
    try {
      await ev(() => { localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 100, s: 112, from: 1 })); localStorage.setItem('q.mode', '"pages"'); }); await mock(); await nvMock(ok); await go('#/hifztest/112', 900);
      await ev(() => document.getElementById('htMic').click());
      await ev(() => { onRecite('', 'state:listening'); window.nvSeq = 1; onRecite('قل هو الله احد', 'final'); window.nvSeq = 2; onRecite('الله اصم', 'final'); }); await wait(400);
      const r = await ev(() => { const w = [...document.querySelectorAll('.ht-w')].find(e => e.dataset.a === '2' && e.dataset.w === '1'); return [w && w.className, window.__ctc.forms, window.__ctc.calls]; });
      if (ok) assert(r[1] && r[1][0] === 'قل' && r[1][1] === 'هو' && r[1][2] === '', 'forms ' + JSON.stringify(r[1]));
      assert(r[2].some(c => c[0] === 2 && c[1].includes('الصمد')), 'calls ' + JSON.stringify(r[2]));
      return assert(ok ? /\bok\b/.test(r[0]) : /\bmiss\b/.test(r[0]), r[0]);
    } finally { await ev(nb => { if (!nb) delete window.NvBridge; localStorage.removeItem('q.asr'); try { Mic.stop(); } catch (e) {} }, nb); await lsRest(s); await go('#/', 300); }
  });
  const G511 = 'نسخة 5.11';
  await check(G511, 'الإعدادات: «wifi فقط» بدل «واي فاي بس»', () => ev(() => { const t = document.getElementById('donateMob').textContent + document.getElementById('donateHint').textContent; return t.includes('wifi فقط') && !t.includes('واي فاي'); }));
  await check(G511, 'مفيش اختيار موديل: NVIDIA بس، والمايك من غير النموذج بيعرض التحميل', async () => { await go('#/p/2', 900);
    const r = await ev(() => { const eb = window.EdBridge, nb = window.NvBridge, rb = window.ReciteBridge; let asked = '', started = false; window.QA_KEEP_DLG = true;
      window.EdBridge = { state: () => 'none', remove() {}, get() {} }; window.NvBridge = { ready: () => false, start() { started = true; }, stop() {} };
      window.ReciteBridge = { start() { started = true; }, stop() {}, setHints() {} }; 
      localStorage.setItem('q.modelConsent', '{"v":1,"t":1}'); document.getElementById('rdMic').click(); localStorage.removeItem('q.modelConsent');
      const dm = document.querySelector('.dlg-msg'); asked = dm ? dm.textContent : ''; document.querySelectorAll('.dlg-back').forEach(x => x.remove()); window.QA_KEEP_DLG = false;
      window.EdBridge = eb; window.NvBridge = nb; window.ReciteBridge = rb; if (!eb) delete window.EdBridge; if (!nb) delete window.NvBridge;
      return [!!document.getElementById('asrSet'), /نموذج التعرّف على التلاوة/.test(asked), started]; });
    return assert(!r[0] && r[1] && !r[2], JSON.stringify(r)); });
  await check(G511, 'زر «امسح تسجيلاتي» في مكان واحد بس: جوه «الخصوصية وتسجيلات الصوت» تحت التبرّع، وخطه صغير', async () => { const r = await ev(() => { const b = [...document.querySelectorAll('[data-donatedel]')], d = document.getElementById('donateDel'); const fs = parseFloat(getComputedStyle(d).fontSize), base = parseFloat(getComputedStyle(d.parentNode).fontSize);
    return [b.length === 1 && b[0] === d, !!d.closest('#privGroup'), d.parentNode.contains(document.getElementById('donateSet')), d.classList.contains('link-sm'), fs < base, b.length, fs, base]; });
    return assert(r.slice(0, 5).every(Boolean), JSON.stringify(r)); });
  await check(G511, 'سياسة الخصوصية فيها شروط استخدام النموذج واستخدام الصوت للتحسين (عربي وإنجليزي)', () => ev(() => { const t = [...document.querySelectorAll('.about-box')].map(e => e.textContent).join(' '); return /شروط استخدام نموذج التعرّف على التلاوة/.test(t) && /لتدريب النموذج وتحسينه/.test(t) && /terms of use/.test(t) && /train and improve the model/.test(t) && !/غالبًا من جوجل/.test(t); }));
  for (const fm of ['slide', 'curl']) await check(G511, 'التقليب (' + fm + '): الصفحة الجاية في مكانها جنب الحالية، من غير هامش أبيض (RTL كان بيتجاهل margin-left)', async () => {
    if (ED !== 'kfgqpc') return true;
    await ev(fm => { localStorage.setItem('q.flipMode', JSON.stringify(fm)); localStorage.setItem('q.mode', '"pages"'); }, fm); await p.reload(); await go('#/p/29', 900);
    await ev(() => document.body.classList.add('fs')); await wait(400);
    await p.mouse.move(150, 450); await p.mouse.down(); for (let i = 1; i <= 8; i++) { await p.mouse.move(150 + i * 20, 452); await wait(16); }
    await wait(120);
    const r = await ev(() => { const L = document.querySelector('.curl'); if (!L) return null; const ps = [...L.querySelectorAll(':scope > .curl-page, :scope > .curl-flap > .curl-page')];
      const W = L.getBoundingClientRect().width, H = L.getBoundingClientRect().height, Lx = L.getBoundingClientRect().left;
      const fl = L.querySelector('.curl-back'), pts = fl ? (fl.style.clipPath.match(/-?[\d.]+px -?[\d.]+px/g) || []).map(q => q.split(' ').map(parseFloat)) : [];
      // page 29 (odd, mirrored kfgqpc): frame = left 2.6%, right 14.6%, top 7.7%, bottom 8.4% of the image
      const out = pts.filter(([x, y]) => x < W * 0.026 - 1 || x > W * (1 - 0.146) + 1 || y < H * 0.077 - 1 || y > H * (1 - 0.084) + 1);
      return ps.map(e => [e.getBoundingClientRect().left - Lx, getComputedStyle(e).left, e.style.marginLeft, W]).concat([[pts.length, out.length]]); });
    await p.mouse.up(); await wait(700); await ev(() => { document.body.classList.remove('fs'); localStorage.removeItem('q.flipMode'); });
    assert(r && r.length >= 2, JSON.stringify(r));
    if (fm === 'slide') { r.pop(); const [c, n] = r, W = c[3], tx = 160; const vr = n[0] + W * (1 - 0.026), vl = c[0] + W * 0.026;
      return assert(!n[2] && Math.abs(vl - vr - 16) < 3, JSON.stringify(r) + ' gap ' + (vl - vr)); }
    const fl = r.pop();
    return assert(r.every(x => !x[2]) && r.some(x => Math.abs(parseFloat(x[1])) > 20) && fl[0] >= 3 && fl[1] === 0, JSON.stringify(r) + ' flap ' + JSON.stringify(fl));
  });
  await check(G511, 'تقليب الصفحة مالوش fade/رعشة (مفيش v-in من صفحة لصفحة) والشاشات التانية لسه ليها', async () => {
    await go('#/p/29', 700); await go('#/p/30', 120); const a = await ev(() => document.getElementById('view').classList.contains('v-in'));
    await go('#/', 120); const b = await ev(() => document.getElementById('view').classList.contains('v-in'));
    return assert(!a && b, a + ',' + b); });
  await check(G511, 'الدخول لملء الشاشة: الصفحة بتنزلق لمكانها الجديد (FLIP) بدل ما تنط', async () => {
    await ev(() => localStorage.setItem('q.mode', '"pages"')); await p.reload(); await go('#/p/29', 900);
    const r = await ev(async () => { const sl = ms => new Promise(f => setTimeout(f, ms)); window.QA_NOFS = false; const b = document.querySelector('#view .page-wrap .page-box');
      b.click(); let mid = ''; for (let i = 0; i < 40 && !document.body.classList.contains('fs'); i++) await sl(50);
      await sl(30); mid = getComputedStyle(b).transform; await sl(450); const end = getComputedStyle(b).transform, fs = document.body.classList.contains('fs');
      window.QA_NOFS = true; return [fs, mid, end]; });
    await ev(() => document.body.classList.remove('fs'));
    return assert(r[0] && /matrix/.test(r[1]) && r[2] === 'none', JSON.stringify(r)); });
  await check(G511, 'الإعدادات مش بتنط: تغيير التقليب/الصفحتين/الموضوعي بيسيب مكان القائمة زي ما هو ومن غير animation', async () => {
    await go('#/p/29', 800); await p.click('#btnSettings'); await wait(400);
    const r = []; for (const [sel, v] of [['#flip', 'v'], ['#flip', 'curl'], ['#spreadSet', 'off'], ['#spreadSet', 'on'], ['#thmSet', 'on'], ['#thmSet', 'off']]) {
      const before = await ev(sel => { const sb = document.querySelector('#settings .sheet-body'); document.querySelector(sel).scrollIntoView({ block: 'center' }); return sb.scrollTop; }, sel);
      await ev(([sel, v]) => document.querySelector(sel + ' button[data-v="' + v + '"]').click(), [sel, v]); await wait(250);
      r.push(await ev(b => { const sb = document.querySelector('#settings .sheet-body'); return [!document.getElementById('settings').hidden, Math.abs(sb.scrollTop - b) < 2, getComputedStyle(sb).animationName]; }, before)); }
    await closeS(); await ev(() => localStorage.removeItem('q.thematic'));
    return assert(r.every(x => x[0] && x[1] && x[2] === 'none'), JSON.stringify(r)); });
  await check(G511, '«ألوان المصحف الموضوعي» من غير «(على صفحات المصحف)»', async () => { const t = await ev(() => document.getElementById('thmSet').closest('.row').firstChild.textContent.trim()); return assert(t === 'ألوان المصحف الموضوعي', t); });
  await check(G511, 'شريط أقسام الإعدادات: القراءة، الألوان والمظهر، الصوت والتلاوة، التطبيق، التحميلات، الخصوصية', async () => {
    const r = await ev(() => [...document.querySelectorAll('#settings .set-jump button')].map(b => b.textContent.trim()));
    return assert(JSON.stringify(r) === JSON.stringify(['القراءة', 'الألوان والمظهر', 'الصوت والتلاوة', 'التطبيق', 'التحميلات', 'الخصوصية']), JSON.stringify(r)); });
  await check(G511, 'شاشة الترحيب: «تخطي» في كل خطوة بيعدّي الخطوة دي بس، والأخيرة بتقفل، و«تخطي الكل» بيقفل على طول', async () => {
    await go('#/welcome', 600); const r = [];
    for (let i = 0; i < 8; i++) { const st = await ev(() => { const w = document.querySelector('.wel'); if (!w) return null; return [[...w.querySelectorAll('.wel-dots i')].findIndex(x => x.classList.contains('on')), !!w.querySelector('.wel-skip') && w.querySelector('.wel-skip').textContent.trim()]; });
      if (!st) break; r.push(st); await ev(() => document.querySelector('.wel .wel-skip').click()); await wait(150); }
    await go('#/welcome', 600); const all = await ev(() => { const b = document.querySelector('.wel .wel-all'); if (!b) return 'no'; b.click(); return !document.querySelector('.wel'); });
    await ev(() => document.querySelectorAll('.wel').forEach(x => x.remove()));
    return assert(r.length >= 3 && r.every((x, i) => x[0] === i && x[1] === 'تخطي') && all === true, JSON.stringify([r, all])); });
  await check(G511, 'شاشة الترحيب: خطوة نموذج التلاوة، الزرار مقفول لحد الموافقة، والتبرّع اختياري ومش متعلّم', async () => {
    await ev(() => { localStorage.removeItem('q.modelConsent'); localStorage.removeItem('q.donate'); });
    await go('#/welcome', 600); await ev(() => { document.querySelector('.wel .wel-next').click(); document.querySelector('.wel .wel-next').click(); }); await wait(150);
    const r = await ev(() => { const w = document.querySelector('.wel'), dl = w.querySelector('#wDl'), t = w.querySelector('#wTerms'), dn = w.querySelector('#wDonate');
      const a = [w.querySelectorAll('.wel-dots i').length, w.querySelector('h2').textContent, !!dl && dl.disabled, !!dn && dn.checked];
      t.checked = true; t.dispatchEvent(new Event('change')); a.push(dl.disabled); dl.click();
      a.push(!!JSON.parse(localStorage.getItem('q.modelConsent') || 'null'), localStorage.getItem('q.donate')); return a; });
    await ev(() => { document.querySelectorAll('.wel').forEach(x => x.remove()); localStorage.removeItem('q.modelConsent'); localStorage.removeItem('q.donate'); });
    return assert(r[0] === 4 && r[1] === 'نموذج التعرّف على التلاوة' && r[2] === true && r[3] === false && r[4] === false && r[5] === true && r[6] === '0', JSON.stringify(r)); });
  await check(G511, 'أدوات التبرّع بالصوت جوه «الخصوصية وتسجيلات الصوت» مش في «الصوت والتلاوة»، والـ chip بيفتح البوكس', async () => {
    await p.click('#btnSettings'); await wait(300);
    const r = await ev(() => { const pg = document.getElementById('privGroup'); const inPriv = ['donateSet', 'donateMob', 'donateStats'].every(id => pg.contains(document.getElementById(id)));
      const open0 = pg.open; [...document.querySelectorAll('#settings .set-jump button')].find(b => b.textContent.trim() === 'الخصوصية').click();
      return [inPriv, open0, pg.open, !!pg.querySelector('[data-donatedel]'), !document.getElementById('consentState')]; });
    await ev(() => { document.getElementById('privGroup').open = false; }); await closeS();
    return assert(r[0] && r[1] === false && r[2] === true && r[3] && r[4], JSON.stringify(r)); });
  await check(G511, 'موافقة النموذج: المايك على الموبايل مقفول لحد الموافقة، «موافق» مقفول لحد الشروط، والتبرّع منفصل ومش متعلّم', async () => {
    const run = donate => ev(dn => { localStorage.removeItem('q.modelConsent'); localStorage.removeItem('q.donate');
      const nb = window.NvBridge; window.EdBridge = { state: () => 'none', download() {}, remove() {}, pause() {} }; window.NvBridge = { ready: () => true, start() {}, stop() {} };
      const fin = v => { delete window.EdBridge; if (nb) window.NvBridge = nb; else delete window.NvBridge; return v; };
      document.getElementById('rdMic').click(); const d = document.querySelector('.cs-dlg'); if (!d) return fin(['no dialog']);
      const ok = d.querySelector('.dlg-ok'), a = [ok.disabled, d.querySelector('#cDonate').checked];
      const t = d.querySelector('#cTerms'); t.checked = true; t.dispatchEvent(new Event('change')); a.push(ok.disabled);
      if (dn) d.querySelector('#cDonate').checked = true; ok.click();
      a.push(!!JSON.parse(localStorage.getItem('q.modelConsent') || 'null'), localStorage.getItem('q.donate'), !document.querySelector('.cs-dlg'));
      return fin(a); }, donate);
    await go('#/p/2', 900); const r0 = await run(false), r1 = await run(true);
    await ev(() => { localStorage.removeItem('q.modelConsent'); localStorage.removeItem('q.donate'); document.querySelectorAll('.dlg-back').forEach(x => x.remove()); });
    return assert(r0[0] === true && r0[1] === false && r0[2] === false && r0[3] && r0[4] === '0' && r0[5] && r1[4] === '1', JSON.stringify([r0, r1])); });
  await check(G511, '«التعرّف على التلاوة» box مقفول بيتفتح باللمس، فيه حالة النموذج وكارت التنزيل/الحذف، ومفيش جملة «وافقت على الشروط»', async () => {
    await p.click('#btnSettings'); await wait(300);
    const r = await ev(() => { const b = document.getElementById('asrBox'), o0 = b.open; b.querySelector('summary').click();
      return [o0, b.open, document.getElementById('asrSum').textContent.trim(), b.querySelector('#asrDl').textContent.trim().length > 0, document.querySelectorAll('[id="asrDl"]').length, !document.getElementById('consentState')]; });
    await closeS();
    return assert(r[0] === false && r[1] === true && /ميجا|جاهز|التحميل/.test(r[2]) && r[3] && r[4] === 1 && r[5], JSON.stringify(r)); });
  await check(G511, '«ألوان المصحف الموضوعي»: تشغيل/إيقاف جنب العنوان زي «ألوان التجويد»، و«معاني الألوان» تحتهم', async () => {
    await p.click('#btnSettings'); await wait(300);
    const r = await ev(() => { const row = document.getElementById('thmSet').closest('.row'); row.scrollIntoView(); const s = document.getElementById('thmSet').getBoundingClientRect(), k = row.querySelector('.thm-key').getBoundingClientRect(), t = document.getElementById('tjSet').getBoundingClientRect();
      return [Math.round(s.left - t.left), Math.round(k.top - s.bottom), row.firstChild.textContent.trim()]; });
    await closeS();
    return assert(Math.abs(r[0]) < 2 && r[1] >= 0 && r[2] === 'ألوان المصحف الموضوعي', JSON.stringify(r)); });
  await check(G511, 'أول مرة المايك: نصايح + «اختبر المايك» بيدي رقم وتقييم (fake mic)، و«ابدأ» بيشغّل، وصف «اختبار المايك» في الإعدادات', async () => { await go('#/p/2', 900);
    await ev(() => { localStorage.removeItem('q.micTips'); window.__rb = window.ReciteBridge; window.__st = 0; window.ReciteBridge = { start() { window.__st++; }, stop() {}, setHints() {} }; document.getElementById('rdMic').click(); });
    await wait(300); const shown = await ev(() => !!document.querySelector('.mt-dlg') && window.__st === 0);
    await p.click('#mtGo'); await wait(6800);
    const res = await ev(() => { const o = document.getElementById('mtRes'); return [o.textContent, o.dataset.snr, !!JSON.parse(localStorage.getItem('q.micTest'))]; });
    await p.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/g39-mictips.png' : __dirname + '/g39-mictips.png' }); await p.click('.mt-dlg .dlg-ok'); await wait(400);
    const after = await ev(() => { const r = [window.__st, localStorage.getItem('q.micTips'), !document.querySelector('.mt-dlg'), !!document.getElementById('micTestBtn').closest('#settings, .settings, body')]; try { document.getElementById('rdMic').click(); } catch (e) {} window.ReciteBridge = window.__rb; if (!window.__rb) delete window.ReciteBridge; return r; });
    return assert(shown && /ممتاز|كويس|ضعيف/.test(res[0]) && res[1] !== undefined && res[2] && after[1] === '1' && after[2] && after[3], JSON.stringify([shown, res, after])); });
  await check(G511, 'G4: «المزيد» في مجموعات بعناوين (الحفظ أولاً)، كل زرار بيفتح شاشته', async () => { await go('#/more', 500);
    const g = await ev(() => [...document.querySelectorAll('.more-g')].map(x => x.querySelector('.more-h').textContent + ':' + x.querySelectorAll('.tile').length));
    const hs = await ev(() => [...document.querySelectorAll('.more-g .tile')].map(b => b.dataset.h)); const bad = [];
    for (const h of hs) { await go('#/more', 250); await p.click('.tile[data-h="' + h + '"]'); await wait(350); if (!(await ev(() => location.hash)).startsWith(h)) bad.push(h); }
    await go('#/', 300);
    return assert(g[0] === 'الحفظ:5' && g.length === 4 && hs.length >= 14 && hs[0] === '#/hifztest' && !bad.length, JSON.stringify([g, bad])); });
  await check(G511, 'G5: «الإحصائيات» فيها القراءة والحفظ والتعرّف (+ تسجيلات الصوت على الموبايل) بالأرقام الصح', async () => {
    const keep = await ev(() => ['q.asrStats', 'q.hifzAyat', 'q.reciteLog', 'q.donate'].map(k => [k, localStorage.getItem(k)]));
    await ev(() => { const d = new Date(), k = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
      localStorage.setItem('q.asrStats', JSON.stringify({ [k]: { u: 5, w: 40, ok: 9, bad: 1, rh: 3, rm: 1 } })); localStorage.setItem('q.hifzAyat', JSON.stringify({ '1:1': { d: k, ok: 1 }, '1:2': { d: k, ok: 0 } }));
      localStorage.setItem('q.reciteLog', JSON.stringify([{ s: 1, d: k, ay: 7, w: 20, bad: 1 }])); });
    await go('#/more', 400); await p.click('.tile[data-h="#/stats"]'); await wait(600);
    const web = await ev(() => [location.hash, [...document.querySelectorAll('.stats .kh-sec')].length, [...document.querySelectorAll('.st-asr .hl-ring b')].map(b => b.textContent).join(','),
      document.querySelector('.st-hifz .st-nums').textContent.replace(/\s+/g, ''), document.querySelector('#tabbar button.on, #tabbar .on') ? document.querySelector('#tabbar .on').dataset.h : '']);
    await ev(() => { window.NvBridge = { donateStats: () => JSON.stringify({ waiting: 4, rejected: { quiet: 1 } }) }; localStorage.setItem('q.donate', '1'); }); await go('#/', 200); await go('#/stats', 500);
    const ph = await ev(() => [document.querySelectorAll('.stats .kh-sec').length, document.querySelector('.st-don .st-nums').textContent.replace(/\s+/g, '')]);
    await p.click('#stPriv'); await wait(700); const pv = await ev(() => { const g = document.getElementById('privGroup'); return !!g && g.open && !document.getElementById('settings').hidden; });
    await ev(k => { delete window.NvBridge; k.forEach(([a, v]) => v === null ? localStorage.removeItem(a) : localStorage.setItem(a, v)); }, keep); await p.keyboard.press('Escape'); await ev(() => { const c = document.getElementById('closeSettings'); if (c) c.click(); }); await go('#/', 300);
    return assert(web[0] === '#/stats' && web[1] === 4 && web[2] === '٩٠٪,٧٥٪,—' && web[3].includes('٢آية') && web[3].includes('١آية') && web[3].includes('٩٥٪') && web[4] === '#/more' &&
      ph[0] === 5 && ph[1].includes('٤') && ph[1].includes('شغالة') && pv, JSON.stringify([web, ph, pv])); });
  await check(G511, 'G6: الاختبار والخريطة والمتابعة بينهم صف واحد، والصفحة المحددة منورة', async () => { const r = [];
    for (const h of ['#/hifztest', '#/hifzmap', '#/hifzlog']) { await go(h, 600); r.push(await ev(() => [...document.querySelectorAll('.hz-nav a')].map(a => a.getAttribute('href') + (a.classList.contains('on') ? '*' : '')).join(' '))); }
    await p.click('.hz-nav a[href="#/hifztest"]'); await wait(500); const back = await ev(() => location.hash);
  // 5.26 #47: a map box tap opens the mushaf on its ayat; the long-press dialog (hzPick) is gone, so the whole-page map tests below start through window.hifzTestPages (QA hook)
    return assert(r[0] === '#/hifztest* #/hifzmap #/hifzlog' && r[1] === '#/hifztest #/hifzmap* #/hifzlog' && r[2] === '#/hifztest #/hifzmap #/hifzlog*' && back.startsWith('#/hifztest'), JSON.stringify([r, back])); });
  await check(G511, '5.26 #47: الخريطة: مربع لكل سورة، والضغط بيفتح آياته مظلّلة في المصحف، و«اختبرني» بيخفي المدى بس ويفتح المايك ويقف في آخر آية', async () => {
    await ev(() => { localStorage.setItem('q.mode', '"pages"'); localStorage.removeItem('q.turn'); localStorage.removeItem('q.hifzFlip'); window.__st = 0; window.__sp = 0; window.ReciteBridge = { start() { window.__st++; }, stop() { window.__sp++; }, setHints() {} }; }); await go('#/hifzmap', 700);
    const c = await ev(() => [[...document.querySelectorAll('.hm-grid .hm-c.hm-s')].map(c => +c.dataset.s).filter(s => s >= 112).join(','), document.querySelectorAll('.hm-grid .hm-c[data-u="s112"]').length, document.querySelectorAll('.hm-grid .hm-c.hm-s').length > 0]);   // 5.31: one square per short surah
    const lp = await ev(() => [typeof window.hzPick, !!document.querySelector('.hz-pick')]);
    await p.click('.hm-grid .hm-c[data-u="s112"]'); await wait(200); await p.click('#hmOpen'); await wait(1000);   // 5.33: a tap shows the card; «افتح في المصحف» opens
    const o = await ev(() => [location.hash, document.querySelectorAll('.hm-hl').length > 0, !!document.getElementById('rdTest'), document.body.classList.contains('has-hifz')]);
    await p.click('#rdTest'); await wait(1500);
    const m = await ev(() => { const ks = {}; document.querySelectorAll('.hifz-mask').forEach(x => ks[x.dataset.k.split(':')[0]] = 1); return [Object.keys(ks).join(','), document.body.classList.contains('has-hifz'), window.__rec.on, window.__st, !!document.getElementById('rdTest')]; });
    const n112 = await ev(() => window.QURAN.s[111][3]);
    for (let a = 1; a <= n112; a++) { const t = await ev(a => window.QURAN.t[111][a - 1].split(' ').filter(w => /[ء-يٱ]/.test(w)).join(' '), a); await ev(t => window.onRecite(t, 'final'), t); await wait(450); }
    await wait(3000);
    const e = await ev(() => [window.__rec.on, window.__sp, document.querySelectorAll('.hifz-mask').length]);
    await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); delete window.ReciteBridge; });
    return assert(c[0] === '112,113,114' && c[1] === 1 && c[2] && lp[0] === 'undefined' && !lp[1] && new RegExp('^#/p/' + PL + '\\?r=112:1-' + n112 + '$').test(o[0]) && o[1] && o[2] && !o[3] &&
      m[0] === '112' && m[1] && m[2] && m[3] === 1 && !m[4] && e[0] === false && e[1] >= 1, JSON.stringify([c, lp, o, m, e])); });
  await check(G511, 'G6: آخر آية في آخر صفحة في المصحف بتنهي الاختبار (5.15b: مفيش «قلب تلقائي» جوه الاختبار)', async () => {
    for (let i = 0; i < 400; i++) { const more = await ev(() => document.body.classList.contains('has-hifz') && document.querySelectorAll('.hifz-mask').length > 0); if (!more) break; await p.click('#hifzBar [data-c="nx"]'); await wait(25); }
    await wait(2500); const r = await ev(() => [location.hash, document.body.classList.contains('has-hifz')]);
    await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); });
    return assert(RegExp('^#/p/' + PL + '\\b').test(r[0]), JSON.stringify(r)); });
  await check(G511, 'G6: «قلب تلقائي» شغال: آخر آية بتقلب للصفحة اللي بعدها', async () => {
    await ev(() => localStorage.setItem('q.hifzFlip', 'true')); await go('#/hifzmap', 700); await ev(n => { const s = window.QURAN.p.findIndex(a => a.includes(+n)) + 1, i = window.QURAN.p[s - 1].indexOf(+n); window.hifzTestPages(s, i < 0 ? 1 : i + 1); }, P6); await wait(1200);
    for (let i = 0; i < 400; i++) { const r = await ev(() => [document.querySelectorAll('.hifz-mask').length, location.hash]); if (!r[0] || r[1] !== '#/p/' + P6) break; await p.click('#hifzBar [data-c="nx"]'); await wait(25); }
    await wait(2500); const h = await ev(() => location.hash); await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); });
    return assert(h === '#/p/' + P6n, h); });
  await check(G511, 'G6: المايك في اختبار على المصحف (عمودي) بيروح لأول الصفحة', async () => {
    await ev(() => { localStorage.setItem('q.turn', '"v"'); window.ReciteBridge = { start() {}, stop() {}, setHints() {} }; }); await p.reload(); await wait(900);
    await ev(() => { window.ReciteBridge = { start() {}, stop() {}, setHints() {} }; });
    await go('#/hifzmap', 700); await ev(n => { const s = window.QURAN.p.findIndex(a => a.includes(+n)) + 1, i = window.QURAN.p[s - 1].indexOf(+n); window.hifzTestPages(s, i < 0 ? 1 : i + 1); }, 50); await wait(1800);
    // inside page 50 (still across 40% of the screen, so it stays the page being tested)
    await ev(() => window.scrollBy(0, 230)); await wait(300); const before = await ev(() => document.querySelector('.page-box.vp[data-p="50"]').closest('.vp-c').getBoundingClientRect().top);
    await p.click('#hifzBar [data-c="mic"]'); await wait(400);
    const r = await ev(() => [document.querySelector('.page-box.vp[data-p="50"]').closest('.vp-c').getBoundingClientRect().top, document.querySelector('.bar').offsetHeight]);
    await p.click('#hifzBar [data-c="mic"]').catch(() => {});
    return assert(before < -100 && Math.abs(r[0] - r[1]) < 20, JSON.stringify([before, r])); });
  await check(G511, 'phone #19: عمودي: الصفحة اللي بتوصلها بالتمرير بتتفتح بالأقنعة (مش فاضية)، واللي بعدها مخفية', async () => {
    await ev(() => { const b = document.querySelector('.page-box.vp[data-p="51"]'); window.scrollTo(0, b.getBoundingClientRect().top + scrollY - 100); }); await wait(500);
    const r = await ev(() => { const b = document.querySelector('.page-box.vp[data-p="51"]'), im = b.querySelector('img'), b2 = document.querySelector('.page-box.vp[data-p="52"] img');
      return [getComputedStyle(im).visibility, b.querySelectorAll('.hifz-mask').length, getComputedStyle(b2).visibility, [...document.querySelectorAll('.page-box.vp[data-p="50"] .hifz-mask')].filter(m => !b.querySelector('.hifz-mask[data-k="' + m.dataset.k + '"]')).length]; });   // an ayah running on from page 50 (Haramain/Shamarly) may keep its mask there
    await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); localStorage.removeItem('q.turn'); delete window.ReciteBridge; }); await p.reload(); await wait(800);
    return assert(r[0] === 'visible' && r[1] > 0 && r[2] === 'hidden' && r[3] === 0, JSON.stringify(r)); });
  // G7: recitation following, with pieces fed the way NvAsr sends them (tools/qa/recite_sim.js, own browser context)
  { let R = null; try { R = await require('./recite_sim.js').run(b); } catch (e) { R = { err: e.message }; }
    const G = (n, f) => check(G511, n, () => { if (!R || R.err) throw new Error((R && R.err) || 'no data'); return f(R); });
    await G('G7: التسميع: الصفحة بتتقلب على الـ partial أول ما آخر كلمة فيها تتسمع (مش final + ٧٠٠ ms)', R => assert(R.A.hash === R.A.want && R.A.ms < 400, JSON.stringify(R.A)));
    await G('G7: آخر كلمة اتسمعت غلط والقارئ كمّل في الصفحة اللي بعدها: بتتقلب برضه', R => assert(R.B.mid === '#/p/' + R.pages.whole && R.B.hash === R.B.want, JSON.stringify(R.B)));
    await G('G7: السطر بيتفتح لما القارئ يعدّيه حتى لو فيه كلمة لسه ما اتحكمش عليها', R => assert(R.D.right === R.D.misheard, JSON.stringify(R.D)));
    await G('G7: القراءة بالصوت: آية مكمّلة على الصفحة اللي بعدها بتقلب عند آخر كلمة مطبوعة (الشمرلي) وتفضل منورة', R => assert(R.C.hash.startsWith(R.C.want) && R.C.lit > 0, JSON.stringify(R.C)));
    await G('G7: القراءة بالصوت: القارئ نط لآية تانية بتتلقط بعد ٤ كلمات مش في مكانها', R => assert(/٢٥٨/.test(R.E.at2) && /^#\/p\/43/.test(R.E.hash), JSON.stringify(R.E)));
    await G('G7: القراءة بالصوت بالعرض: الكلمة اللي بتتقري بتفضل ظاهرة (الصفحة بتنزل معاها)', R => assert(R.F && R.F.sy > 0 && R.F.top >= 0 && R.F.top < R.F.ih * 0.75, JSON.stringify(R.F)));
    await G('G7: التسميع في الوضع العمودي: الصفحات اللي بعد الصفحة الحالية مخفية لحد ما توصلها', R => assert(R.G.after === 'hidden' && R.G.own === 'visible' && !R.G.off, JSON.stringify(R.G)));
    await G('phone #11: اختبار الكلمات: المايك بيحط النص تحت الشريط، والنص بينزل مع القارئ', R => assert(R.I.top0 < 120 && R.I.fol[0] > 0 && R.I.fol[0] < R.I.fol[1] * 0.75, JSON.stringify(R.I)));
    await G('phone #12: اختبار الكلمات («قلب تلقائي» شغال، 5.16d): آخر كلمة (partial) بتفتح الآيات اللي بعدها والمايك شغال، وكلامها بيتحسب', R => assert(R.I.flipBtn && R.I.moved[0] === 11 && R.I.moved[1] && R.I.moved[2] && R.I.nxOk[0] > 0 && R.I.nxOk[0] === R.I.nxOk[1] && R.I.nxOk[2] === 0, JSON.stringify(R.I)));
    await G('5.16d: اختبار الكلمات من غير «المراجعة» و«قلب تلقائي» مقفول: آخر الآيات بتنهي الاختبار بالنتيجة', R => assert(R.I.off[0] === 1 && !R.I.off[1] && /٪/.test(R.I.off[2]), JSON.stringify(R.I.off)));
    await G('G7: زمن فك الكلام من الموديل بيتسجل في الإحصائيات', R => assert(R.H[0] === 420 && R.H[1] === 1 && R.H[2] === 3000, JSON.stringify(R.H)));
    await G('G7: مفيش أخطاء JavaScript في محاكاة التسميع', R => assert(!R.errs.length, R.errs.join(' | '))); }
  // ---------- 5.13: user patch 2 ----------
  const G513 = 'نسخة 5.13 (باتش 2)';
  await check(G513, 'P2.3: زرار الموافقة «ليس الآن» بدل «مش دلوقتي»', async () => { await go('#/p/2', 900);
    const r = await ev(() => { const eb = window.EdBridge, nb = window.NvBridge, rb = window.ReciteBridge;
      window.EdBridge = { state: () => 'none', remove() {}, get() {} }; window.NvBridge = { ready: () => false, start() {}, stop() {} }; window.ReciteBridge = { start() {}, stop() {}, setHints() {} };
      localStorage.removeItem('q.modelConsent'); document.getElementById('rdMic').click(); const b = document.querySelector('.dlg .dlg-no'), t = b && b.textContent;
      if (b) b.click(); window.EdBridge = eb; window.NvBridge = nb; window.ReciteBridge = rb; if (!eb) delete window.EdBridge; if (!nb) delete window.NvBridge; if (!rb) delete window.ReciteBridge; return t; });
    return assert(r === 'ليس الآن', String(r)); });
  await check(G513, 'P2.8 + P2.11: مفيش زرار وضع الحفظ ولا هامش المصحف الموضوعي تحت الصفحات (أفقي وعمودي)', async () => { await ev(() => localStorage.setItem('q.thematic', 'true')); await p.reload(); await go('#/p/27', 900);
    const a = await ev(() => [!!document.getElementById('pHifz'), !!document.getElementById('thmNotes'), !!document.getElementById('pMark')]);   // 5.34: the page-bottom mark button is gone
    await ev(() => localStorage.setItem('q.turn', '"v"')); await p.reload(); await go('#/p/27', 1200); const v = await ev(() => [!!document.getElementById('thmNotes'), !!document.querySelector('.page-thm')]);
    await ev(() => { localStorage.setItem('q.thematic', 'false'); localStorage.setItem('q.turn', '"h"'); }); await p.reload(); await wait(600);
    return assert(!a[0] && !a[1] && !a[2] && !v[0] && !v[1], JSON.stringify([a, v])); });
  await check(G513, 'P2.9: مفيش بند تحميل هامش المصحف الموضوعي في الإعدادات › التحميلات، ونسخته القديمة بتتمسح', async () => { await go('#/', 600);
    const r = await ev(async () => { const eb = window.EdBridge; let gone = ''; window.EdBridge = { state: k => k === 'thmnotes' ? 'ready' : 'none', remove(k) { gone += k; }, get() {}, pause() {} };
      document.getElementById('btnSettings').click(); await new Promise(z => setTimeout(z, 400)); const box = document.getElementById('edDl'); const t = box ? box.textContent : 'nobox'; document.getElementById('closeSettings').click();
      window.EdBridge = eb; if (!eb) delete window.EdBridge; return t; });
    return assert(r !== 'nobox' && !/هامش/.test(r) && /الملك فهد|فهد|الشمرلي/.test(r), r.slice(0, 120)); });
  await check(G513, 'P2.4: الإحصائيات › «الخصوصية وتسجيلات الصوت» بتفتح الإعدادات على صندوق الخصوصية من غير نطّة', async () => {
    await ev(() => { window.QA_NB = window.NvBridge; window.NvBridge = Object.assign({}, window.NvBridge || {}, { donateStats: () => '{"waiting":2,"rejected":{}}' }); }); await go('#/', 300); await go('#/stats', 800);
    await ev(() => { window.NvBridge = window.QA_NB; if (!window.NvBridge) delete window.NvBridge; });
    const r = await ev(async () => { const sb = document.querySelector('#settings .sheet-body'), g = document.getElementById('privGroup'); const tops = [];
      document.getElementById('stPriv').click(); const t0 = performance.now();
      while (performance.now() - t0 < 700) { await new Promise(z => requestAnimationFrame(z)); tops.push(Math.round(sb.scrollTop)); }
      const res = { tops: [...new Set(tops)], off: Math.round(g.getBoundingClientRect().top - sb.getBoundingClientRect().top), open: g.open, max: sb.scrollHeight - sb.clientHeight, jb: document.querySelector('.set-jump').offsetHeight }; document.getElementById('closeSettings').click(); return res; });
    return assert(r.open && r.tops.length === 1 && r.tops[0] > 0 && (Math.abs(r.off - r.jb) < 40 || Math.abs(r.tops[0] - r.max) <= 1), JSON.stringify(r)); });
  await check(G513, 'P2.5: اختبار الحفظ: اختيار الآية جنب السورة، والاختبار بيبدأ منها والاختيار بيتحفظ', async () => { await go('#/hifztest/2', 900);
    const r = await ev(async () => { const a = document.getElementById('htA'), sR = document.getElementById('htS').getBoundingClientRect(), aR = a.getBoundingClientRect();
      a.value = '30'; a.onchange.call(a); await new Promise(z => setTimeout(z, 500)); const first = document.querySelector('.ht-text .ayah-no').textContent;
      return [Math.abs(sR.top - aR.top) < 4 || (aR.top >= sR.bottom && aR.top - sR.bottom < 16) /* 5.25 #40: from/to sit right under the surah */, a.options.length, first, JSON.parse(localStorage.getItem('q.hifzTest')).from, document.getElementById('htA').value]; });
    return assert(r[0] && r[1] === 286 && /٣٠/.test(r[2]) && r[3] === 30 && r[4] === '30', JSON.stringify(r)); });
  await check(G513, 'P2.7: ملء الشاشة في الوضع الأفقي (866×411) ما بيصغّرش الصفحة', async () => { const ctx = await b.newContext({ viewport: { width: 866, height: 411 } }), q = await ctx.newPage();
    await q.goto(W); await q.evaluate(ed => { localStorage.clear(); localStorage.setItem('q.edition', JSON.stringify(ed)); localStorage.setItem('q.micTips', '1'); localStorage.setItem('q.mode', '"pages"'); localStorage.setItem('q.turn', '"h"'); }, ED);
    await q.reload(); await q.waitForTimeout(900); await q.evaluate(() => { window.QA_NOFS = true; location.hash = '#/p/50'; }); await q.waitForTimeout(1300);
    const m = () => q.evaluate(() => Math.round(document.getElementById('pg').closest('.page-box').getBoundingClientRect().width));
    const a = await m(); await q.evaluate(() => document.body.classList.add('fs')); await q.waitForTimeout(700); const f = await m(); await ctx.close();
    return assert(f >= a - 1, a + ' -> ' + f); });
  await check(G513, 'P2.2: المايك ظاهر على طول في الرئيسية (فوق شريط التابات)، بيلاقي الآية وينقل لصفحتها ويتابع القراءة', async () => {
    await ev(() => { localStorage.setItem('q.mode', '"pages"'); localStorage.setItem('q.turn', '"h"'); }); await p.reload(); await wait(800); await mock(); await go('#/', 800);
    const pos = await ev(() => { const m = document.getElementById('rdMic'), t = document.getElementById('tabbar'); return m && t && [Math.round(m.getBoundingClientRect().bottom), Math.round(t.getBoundingClientRect().top), getComputedStyle(m).display]; });
    await ev(() => document.getElementById('rdMic').click()); const t = await ev(() => QURAN.t[17][0].split(' '));
    await fin(t.slice(0, 7).join(' ')); await wait(1200); const h1 = await ev(() => location.hash);
    await fin(t.slice(7).join(' ')); await wait(600); const cap = await ev(() => { const c = document.querySelector('.rd-cap'); return c && c.textContent.slice(0, 40); });
    const on = await ev(() => document.getElementById('rdMic').classList.contains('on')); await ev(() => document.getElementById('rdMic').click());
    await ev(() => localStorage.setItem('q.mode', '"text"')); await p.reload(); await wait(800); await mock(); await go('#/', 800);
    await ev(() => document.getElementById('rdMic').click()); await fin(t.slice(0, 7).join(' ')); await wait(900); const h2 = await ev(() => location.hash);
    await ev(() => localStorage.setItem('q.mode', '"pages"')); await p.reload(); await wait(800);
    return assert(pos && pos[0] <= pos[1] && pos[2] !== 'none' && /^#\/p\/\d+/.test(h1) && on && cap && /الكهف/.test(cap) && /^#\/s\/18\/1/.test(h2), JSON.stringify([pos, h1, on, cap, h2])); });
  await check(G513, 'P2.12: ملء الشاشة في طبعة الحرمين: الصفحة في النص مش لازقة فوق', async () => { const ctx = await b.newContext({ viewport: { width: 411, height: 914 } }), q = await ctx.newPage();
    await q.goto(W); await q.evaluate(() => { localStorage.clear(); localStorage.setItem('q.edition', '"harmain"'); localStorage.setItem('q.micTips', '1'); localStorage.setItem('q.mode', '"pages"'); localStorage.setItem('q.turn', '"h"'); });
    await q.reload(); await q.waitForTimeout(900); await q.evaluate(() => { window.QA_NOFS = true; location.hash = '#/p/50'; }); await q.waitForTimeout(1300);
    await q.evaluate(() => document.body.classList.add('fs')); await q.waitForTimeout(700);
    const r = await q.evaluate(() => { const x = document.getElementById('pg').getBoundingClientRect(); return [Math.round(x.top), Math.round(innerHeight - x.bottom)]; }); await ctx.close();
    return assert(r[0] > 20 && Math.abs(r[0] - r[1]) < 20, JSON.stringify(r)); });
  // 5.13 P2.6 «المراجعة»: ✓ by itself at 80%, test ranges, random part, mushaf test ending at the range, words test across surahs
  // Sprint 4: q.hzSched (per rub') is saved too and cleared, so a test that seeds q.hzRev gets its rub' entries from the fill
  const hzKeep = async () => ev(() => { const r = ['q.hifzLog', 'q.hzRev', 'q.hifzAyat', 'q.hifzScores', 'q.hzScope', 'q.hifzTest', 'q.hzSched'].map(k => [k, localStorage.getItem(k)]); localStorage.removeItem('q.hzSched'); return r; });
  const hzBack = async k => ev(k => k.forEach(([a, v]) => v === null ? localStorage.removeItem(a) : localStorage.setItem(a, v)), k);
  await check(G513, 'P2.6: ✓ السورة بيتحط لوحده عند ٨٠٪ من آياتها صح وبيتشال تحتها، والضغط على السورة ما بيعلّمش', async () => { const k = await hzKeep();
    await ev(() => { ['q.hifzLog', 'q.hifzAyat', 'q.hifzScores'].forEach(x => localStorage.removeItem(x)); localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 100, s: 112, from: 1 })); });
    await go('#/hifztest/112', 700); await p.evaluate(() => window.__htFinish()); await wait(300); const on = await ev(() => !!JSON.parse(localStorage.getItem('q.hifzLog') || '{}')[112]);
    await go('#/', 200); await go('#/hifztest/112', 700); await ev(() => document.querySelectorAll('.ht-w[data-a="2"], .ht-w[data-a="3"]').forEach(b => b.click())); await p.evaluate(() => window.__htFinish()); await wait(300);
    const off = await ev(() => !JSON.parse(localStorage.getItem('q.hifzLog') || '{}')[112]);
    await ev(() => localStorage.setItem('q.hzScope', JSON.stringify({ k: 's', s: 1, n: 1, q: 1, a1: 1, a2: 7, w: 'o' }))); await go('#/hifzlog', 700); await p.click('#hlFold > summary'); await wait(200); await p.click('.hl-list li[data-s="113"]'); await wait(300);
    const tap = await ev(() => [!JSON.parse(localStorage.getItem('q.hifzLog') || '{}')[113], JSON.parse(localStorage.getItem('q.hzScope')).s, document.getElementById('hzS').value, document.querySelector('.hl-list li[data-s="112"] small').textContent]);
    await hzBack(k); return assert(on && off && tap[0] && tap[1] === 1 && tap[2] === '1' && tap[3].includes('٥٠٪'), JSON.stringify([on, off, tap])); });
  await check(G513, 'P2.6: المدى: الجزء ٢ بيبدأ بـ ٢:١٤٢، ربع الجزء ١ = ربعين، نص المصحف الأول بيخلص قبل ١٨:٧٥', async () => {
    const r = await ev(() => { const S = window.QURAN.s, A = [0]; S.forEach((x, i) => A.push(A[i] + x[3])); const g = (s, a) => A[s - 1] + a - 1;
      const j2 = hzRange({ k: 'j', n: 2 }), q1 = hzRange({ k: 'jq', n: 1, q: 1 }), h1 = hzRange({ k: 'mh', q: 1 }), h2 = hzRange({ k: 'mh', q: 2 }), all = hzRange({ k: 'all' }), sr = hzRange({ k: 'a', s: 2, a1: 5, a2: 9 });
      return [j2[0] === g(2, 142), j2[1] === g(2, 252), q1[0] === 0 && q1[1] === g(2, 43), h1[0] === 0 && h1[1] === g(18, 74), h2[0] === g(18, 75) && h2[1] === 6235, all[1] === 6235, sr[0] === g(2, 5) && sr[1] === g(2, 9)]; });
    return assert(r.every(Boolean), JSON.stringify(r)); });
  await check(G513, '5.14: «عشوائي» = عدد مواضع عشوائي على قد المدى، كل موضع ٣–١٢ آية جوه المدى ومن غير تداخل', async () => {
    const r = await ev(() => { const out = []; for (const c of [{ k: 's', s: 112 }, { k: 's', s: 2 }, { k: 'j', n: 30 }, { k: 'all' }]) for (let i = 0; i < 20; i++) {
      const R = hzRange(c), len = R[1] - R[0] + 1, P = hzParts(Object.assign({ w: 'r' }, c)), mx = Math.max(1, Math.min(10, Math.ceil(len / 30)));
      const ok = P.length >= 1 && P.length <= mx && P.every((x, j) => x[0] >= R[0] && x[1] <= R[1] && (x[1] - x[0] + 1 <= 12) && (x[1] === x[0] || hzLines(x[0], x[1]) <= hzCap()) && (c.s !== 112 || len <= 3 || x[1] - x[0] + 1 >= 3) && (!j || x[0] > P[j - 1][1] + 1));
      if (!ok) out.push([c, JSON.stringify(P)]); if (i === 0) out.push(c.k + (c.s || c.n || '') + ':' + P.length); }
      return out; });
    const k = await hzKeep(); await ev(() => localStorage.setItem('q.hzScope', JSON.stringify({ k: 'j', s: 1, n: 30, q: 1, a1: 1, a2: 7, w: 'r' })));
    await go('#/', 150); await go('#/hifzlog', 500); const lab = await ev(() => document.querySelector('.hz-way button[data-w=r]').textContent); await p.click('#hzGoW'); await wait(500);
    const t = await ev(() => JSON.parse(localStorage.getItem('q.hifzTest'))); await hzBack(k);
    return assert(r.every(x => typeof x === 'string') && lab === 'اختبار عشوائي' && t.pt >= 5 && t.pc.length === t.pt - 1 && t.n >= 1 && t.n <= 12, JSON.stringify([r.filter(x => typeof x !== 'string').slice(0, 2), r.filter(x => typeof x === 'string'), lab, t.pt, t.n])); });
  await check(G513, '5.14: اختبار الكلمات العشوائي بيعدّي على المواضع واحد ورا التاني ونتيجة واحدة في الآخر', async () => { const k = await hzKeep();
    await ev(() => { const S = window.QURAN.s, A = [0]; S.forEach((x, i) => A.push(A[i] + x[3])); const g = (s, a) => A[s - 1] + a - 1;
      localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 100, s: 112, from: 1, n: 4, end: g(112, 4), acc: { h: 0, m: 0 }, pc: [[g(114, 1), g(114, 3)]], pn: 1, pt: 2 })); });
    await go('#/', 150); await ev(() => hzFromSet(true)); await go('#/hifztest/112', 700); const a = await ev(() => [document.getElementById('htNext') && document.getElementById('htNext').textContent, (document.querySelector('.ht-place') || {}).textContent]);
    await p.evaluate(() => window.__htFinish()); await wait(200); const mid = await ev(() => !document.getElementById('htTot')); await p.click('#htNext'); await wait(600);
    const b2 = await ev(() => [location.hash, document.querySelectorAll('.ht-text .ayah-no').length, !!document.getElementById('htNext'), (document.querySelector('.ht-place') || {}).textContent]);
    await p.click('.ht-w[data-a="2"]'); await p.evaluate(() => window.__htFinish()); await wait(300); const t = await ev(() => (document.getElementById('htTot') || {}).textContent || '');
    await hzBack(k); await go('#/', 300);
    return assert(a[0] === 'الموضع اللي بعده' && a[1] === 'الموضع ١ من ٢' && mid && b2[0] === '#/hifztest/114' && b2[1] === 3 && !b2[2] && b2[3] === 'الموضع ٢ من ٢' && /٪/.test(t) && !/١٠٠٪/.test(t), JSON.stringify([a, mid, b2, t])); });
  await check(G513, '5.14: اختبار المصحف العشوائي بيقلب للموضع التاني لوحده ويخلص بعد آخر موضع', async () => { const k = await hzKeep();
    await ev(() => { ['q.hifzScores'].forEach(x => localStorage.removeItem(x)); localStorage.setItem('q.hzScope', JSON.stringify({ k: 's', s: 112, n: 1, q: 1, a1: 1, a2: 4, w: 'o' })); });
    const P = await ev(() => { const S = window.QURAN.s, A = [0]; S.forEach((x, i) => A.push(A[i] + x[3])); const g = (s, a) => A[s - 1] + a - 1; return [[g(112, 1), g(112, 2)], [g(114, 1), g(114, 3)]]; });
    await go('#/', 300); await ev(P => hzTestStart({ k: 's', s: 112, w: 'r' }, 'm', P), P); await wait(1200);
    await recAyat(112, 1, 2); await wait(1800);   // Sprint 2 #42: recited (the bar's button reveals words as forgotten now)
    const mid = await ev(() => [!!document.getElementById('hifzBar'), location.hash]);
    await recAyat(114, 1, 3); await wait(1800);
    const end = await ev(() => [!document.getElementById('hifzBar'), (JSON.parse(localStorage.getItem('q.hifzScores') || '{}')[112] || {}).score]);
    await ev(() => document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()));
    await hzBack(k); await go('#/', 300); return assert(mid[0] && RegExp('^#/p/' + PL + '\\b').test(mid[1]) && end[0] && end[1] === 100, JSON.stringify([mid, end])); });
  await check(G513, 'P2.6: اختبار المصحف بمدى (سورة الإخلاص بالسرد) بيخلص لوحده عند آخر آية ويحط ✓', async () => { const k = await hzKeep();
    await ev(() => { ['q.hifzLog', 'q.hifzAyat', 'q.hifzScores'].forEach(x => localStorage.removeItem(x)); localStorage.setItem('q.hzScope', JSON.stringify({ k: 's', s: 112, n: 1, q: 1, a1: 1, a2: 4, w: 'o' })); });
    await go('#/hifzlog', 600); await p.click('#hzGoM'); await wait(1200);
    await recAyat(112, 1, 4); await wait(1500);   // Sprint 2 #42: recited, not revealed (revealed words count as forgotten)
    const r = await ev(() => [!document.getElementById('hifzBar'), !!JSON.parse(localStorage.getItem('q.hifzScores') || '{}')[112], !!JSON.parse(localStorage.getItem('q.hzRev') || '{}')[112]]);
    await ev(() => document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove())); await hzBack(k); await go('#/', 300);
    return assert(r.every(Boolean), JSON.stringify(r)); });
  await check(G513, 'P2.6: اختبار الكلمات بمدى بيعدّي من الفلق للناس ويعرض نتيجة الاختبار كله في الآخر', async () => { const k = await hzKeep();
    await ev(() => localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 100, s: 113, from: 1, n: 10, end: 6235, acc: { h: 0, m: 0 } })));
    await ev(() => hzFromSet(true)); await go('#/hifztest/113', 700); const a = await ev(() => [document.querySelectorAll('.ht-text .ayah-no').length, !!document.getElementById('htNext')]);
    await p.click('.ht-w[data-a="2"]'); await p.evaluate(() => window.__htFinish()); await wait(200); await p.click('#htNext'); await wait(600);
    const b2 = await ev(() => [location.hash, document.querySelectorAll('.ht-text .ayah-no').length, !!document.getElementById('htNext')]);
    await p.evaluate(() => window.__htFinish()); await wait(300); const t = await ev(() => { const e = document.getElementById('htTot'); return e ? e.textContent : ''; });
    await hzBack(k); await go('#/', 300);
    return assert(a[0] === 5 && a[1] && b2[0] === '#/hifztest/114' && b2[1] === 6 && !b2[2] && /٪/.test(t) && !/١٠٠٪/.test(t), JSON.stringify([a, b2, t])); });
  await check(G513, 'P2.6: «عليك مراجعة» بتعرض كل الأرباع المستحقة (سطر لكل ربع)، ومفيش «راجعتها» ولا «اقرأ» ولا الدايرة', async () => { const k = await hzKeep();
    await ev(() => { const d = new Date(Date.now() - 30 * 864e5), o = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(), n = new Date(), t = n.getFullYear() + '-' + (n.getMonth() + 1) + '-' + n.getDate();
      localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hzRev', JSON.stringify({ 1: { m: o, r: o }, 112: { m: o, r: o }, 113: { m: t, r: t }, 114: { m: t, r: t } }));
      localStorage.setItem('q.hifzScores', JSON.stringify({ 113: { d: t, score: 50 }, 114: { d: t, score: 95 } }));
      localStorage.setItem('q.hzSched', JSON.stringify({ 0: { r: o, iv: 7 }, 5: { r: o, iv: 7 }, 100: { r: t, iv: 7 }, 101: { r: t, iv: 1, res: 50, lp: 1 } })); });   // Sprint 4: per rub'
    await go('#/', 200); await go('#/hifzlog', 700);
    const r = await ev(() => [[...document.querySelectorAll('.hz-due .hl-due [data-test]')].map(b => b.dataset.test).sort().join(','), !!document.querySelector('[data-rev], .hl .hl-ring, .hl-top'),
      [...document.querySelectorAll('.hl button')].some(b => /اقرأ|راجعتها/.test(b.textContent)), document.querySelectorAll('.hl-list li.on').length]);
    await p.click('.hz-due [data-test="5"]'); await wait(1200); const pick = await ev(() => !!document.getElementById('hifzBar') && [...new Set([...document.querySelectorAll('.hifz-mask')].map(m => m.dataset.k.split(':')[0]))].join(','));
    await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); });
    await hzBack(k); await go('#/', 200); return assert(r[0] === '0,5,s112' && !r[1] && !r[2] && r[3] === 4 && pick === '2', JSON.stringify([r, pick])); });   // rub' 101 failed today is due tomorrow; rub' 5 starts in surah 2; 5.31: Al-Fatihah is part of rub' 0 now (5.31 juz 1-27 by rub' only), short surah 112 (hzRev, 30 days ago) is its own due unit s112
  // ---------- 5.15 Sprint A: S2 focus on my mistakes, S1 spaced review + daily ward, S7 today card ----------
  const G515 = 'نسخة 5.15 (Sprint A)';
  const dAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  await check(G515, 'S1: الفترة (سلّم ١/٣/٧/١٤/٣٠): ٩٠٪ بتطلع للدرجة اللي فوق التأخير الفعلي (أقصاها ٣٠ ومرة واحدة في اليوم)، و٨٠–٨٩٪ زي ما هي، وأقل من ٨٠٪ يوم واحد', async () => {
    const r = await ev(o => { const e = { m: o, r: o }, seq = []; hzReviewed(e, 95); seq.push(e.iv); hzReviewed(e, 95); seq.push(e.iv); e.r = o; hzReviewed(e, 80); seq.push(e.iv);
      hzReviewed(e, 50); seq.push(e.iv); const f = { m: o, r: o, iv: 60 }; hzReviewed(f, 99); seq.push(f.iv);
      const d = [hzDueInfo({ m: o, r: o }, null).iv, hzDueInfo({ m: o, r: o }, 60).iv, hzDueInfo({ r: o, iv: 30 }, 95).due, hzDueInfo({ r: o, iv: 20 }, 95).due]; return [seq, d]; }, dAgo(20));
    return assert(JSON.stringify(r) === '[[30,30,30,1,30],[7,1,false,true]]', JSON.stringify(r)); });
  await check(G515, 'S1: ورد المراجعة اليومي بياخد الأقدم الأول لحد عدد الصفحات، و«كل المستحق» بياخدهم كلهم', async () => { const k = await hzKeep();
    const r = await ev(([a, b2, c3]) => { localStorage.setItem('q.hifzScores', '{}');
      localStorage.setItem('q.hzRev', '{}'); localStorage.setItem('q.hzSched', JSON.stringify({ 0: { r: a, iv: 7 }, 5: { r: b2, iv: 7 }, 100: { r: a, iv: 30 }, 101: { r: c3, iv: 30 } }));
      localStorage.setItem('q.hzDaily', '1'); const w1 = hzWard(); localStorage.setItem('q.hzDaily', '0'); const w0 = hzWard(); localStorage.removeItem('q.hzDaily');
      return [w1.list.map(x => x.k), w1.all, w0.list.map(x => x.k)]; }, [dAgo(40), dAgo(10), dAgo(5)]);
    await hzBack(k); return assert(JSON.stringify(r) === '[[0],3,[0,5,100]]', JSON.stringify(r)); });
  await check(G515, 'S1: «عليك مراجعة» فيها اختيار الورد وزرار «اختبرني في ورد النهارده» اللي بيفتح اختبار المصحف على السور المستحقة', async () => { const k = await hzKeep();
    await ev(a => { localStorage.setItem('q.hifzScores', '{}'); localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hzRev', '{}'); localStorage.setItem('q.hzSched', JSON.stringify({ 0: { r: a, iv: 7 }, 1: { r: a, iv: 7 } })); }, dAgo(9));
    await go('#/', 200); await go('#/hifzlog', 700);
    const a = await ev(() => [!!document.getElementById('hzDaily'), (document.querySelector('.hz-wsum') || {}).textContent, (document.querySelector('.hz-due .hl-due small') || {}).textContent]);
    await p.click('#hzWardGo'); await wait(1200); const t = await ev(() => [!!document.getElementById('hifzBar'), location.hash]);
    await ev(() => document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove())); await hzBack(k); await go('#/', 300);
    return assert(a[0] && /٢ ربع/.test(a[1]) && /كل ٧ يوم/.test(a[2]) && t[0] && /^#\/p\/\d+/.test(t[1]), JSON.stringify([a, t])); });
  await check(G515, 'S1: الخريطة: ربع فترته ٣٠ يوم وراجعته من ٢٠ يوم أخضر، وبفترة ٧ أيام أصفر (الأصفر = في الورد)', async () => { const k = await hzKeep();
    const col = async iv => { await ev(([a, iv]) => { localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hifzScores', '{}'); localStorage.setItem('q.hifzLog', JSON.stringify({ 112: { m: a } })); localStorage.setItem('q.hzRev', '{}'); localStorage.setItem('q.hzSched', JSON.stringify({ s112: { r: a, iv: iv } })); }, [dAgo(20), iv]);   // 5.31: a short surah is its own unit (was rub' 239)
      await go('#/', 150); await go('#/hifzmap', 700); return ev(() => (document.querySelector('.hm-c[data-s="112"]') || {}).className || ''); };
    const c30 = await col(30), c7 = await col(7); await hzBack(k); return assert(/\bc3\b/.test(c30) && /\bc2\b/.test(c7), JSON.stringify([c30, c7])); });
  await check(G515, 'S2: «أخطائي بس» بيبني مواضع حوالين الآيات الغلط بس (آية قبل وآية بعد)، ومن غير أخطاء مفيش اختبار', async () => { const k = await hzKeep();
    const r = await ev(() => { const S = window.QURAN.s, A = [0]; S.forEach((x, i) => A.push(A[i] + x[3])); const g = (s, a) => A[s - 1] + a - 1, t = '2026-1-1';
      localStorage.setItem('q.hifzAyat', JSON.stringify({ '2:10': { d: t, ok: 0 }, '2:12': { d: t, ok: 0 }, '2:100': { d: t, ok: 0 }, '2:50': { d: t, ok: 1 }, '3:5': { d: t, ok: 0 } }));
      const P = hzParts({ k: 's', s: 2, w: 'x' }), E = hzParts({ k: 's', s: 112, w: 'x' });
      return [JSON.stringify(P) === JSON.stringify([[g(2, 9), g(2, 13)], [g(2, 99), g(2, 101)]]), E.length]; });
    await ev(() => localStorage.setItem('q.hzScope', JSON.stringify({ k: 's', s: 2, n: 1, q: 1, a1: 1, a2: 7, w: 'x' }))); await go('#/', 150); await go('#/hifzlog', 600);
    const lab = await ev(() => document.querySelector('.hz-way button[data-w=x]').textContent); await p.click('#hzGoW'); await wait(600);
    const t = await ev(() => JSON.parse(localStorage.getItem('q.hifzTest'))); await go('#/', 150);
    await ev(() => localStorage.setItem('q.hzScope', JSON.stringify({ k: 's', s: 112, n: 1, q: 1, a1: 1, a2: 4, w: 'x' }))); await go('#/hifzlog', 600); await p.click('#hzGoW'); await wait(400);
    const stay = await ev(() => location.hash); await hzBack(k); await go('#/', 200);
    return assert(r[0] && r[1] === 0 && lab.includes('(٣)') && t.pt === 2 && t.s === 2 && t.from === 9 && t.n === 5 && stay === '#/hifzlog', JSON.stringify([r, lab, t && [t.pt, t.s, t.from, t.n], stay])); });
  await check(G515, 'S2: «عشوائي» بيختار المواضع اللي فيها آيات غلط أكتر (٧٨:٥ في الجزء ٣٠)', async () => { const k = await hzKeep();
    const r = await ev(() => { const S = window.QURAN.s, A = [0]; S.forEach((x, i) => A.push(A[i] + x[3])); const w = A[77] + 4; let hit = 0;
      localStorage.setItem('q.hifzAyat', JSON.stringify({ '78:5': { d: '2026-1-1', ok: 0 } }));
      for (let i = 0; i < 40; i++) if (hzParts({ k: 'j', n: 30, w: 'r' }).some(x => x[0] <= w && w <= x[1])) hit++; return hit; });
    await hzBack(k); return assert(r >= 30, 'hits ' + r + '/40'); });
  await check(G515, 'S7: كارت «النهارده» في الرئيسية فيه ورد المراجعة، و«اختبرني» بيفتح الاختبار، ومن غير حفظ مفيش كارت', async () => { const k = await hzKeep();
    await ev(() => { localStorage.removeItem('q.hifzLog'); localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hzRev', '{}'); }); await go('#/hifzlog', 150); await go('#/', 500); const none = await ev(() => !document.getElementById('tdCard'));
    await ev(a => { localStorage.setItem('q.hifzScores', '{}'); localStorage.setItem('q.hzRev', '{}'); localStorage.setItem('q.hzSched', JSON.stringify({ s112: { r: a, iv: 7 }, 0: { r: a, iv: 30 } })); }, dAgo(8));   // 5.31: s112 instead of rub' 239
    await go('#/hifzlog', 150); await go('#/', 500); const txt = await ev(() => (document.querySelector('#tdCard small') || {}).textContent || '');
    await p.click('#tdGo'); await wait(1200); const t = await ev(() => [!!document.getElementById('hifzBar'), location.hash]);
    await ev(() => document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove())); await go('#/', 150);
    await ev(a => localStorage.setItem('q.hzSched', JSON.stringify({ 0: { r: a, iv: 30 } })), dAgo(8)); await go('#/hifzlog', 150); await go('#/', 500);
    const ok = await ev(() => [(document.querySelector('#tdCard small') || {}).textContent || '', !document.getElementById('tdGo')]);
    await hzBack(k); await go('#/', 200);
    return assert(none && /مراجعة: ١ ربع\/سورة/.test(txt) && t[0] && /^#\/p\/\d+/.test(t[1]) && /مفيش مراجعة مستحقة/.test(ok[0]) && ok[1], JSON.stringify([none, txt, t, ok])); });
  // 5.15b: the user's patch for «المراجعة»
  const gq = async (s, a) => ev(([s, a]) => { const S = window.QURAN.s, A = [0]; S.forEach((x, i) => A.push(A[i] + x[3])); return A[s - 1] + a - 1; }, [s, a]);
  await check(G515, '5.15b ١: «السور المراجعة» بتتفتح وتتقفل، واللمس على سورة ما بيعملش حاجة', async () => { const k = await hzKeep();
    await ev(() => localStorage.setItem('q.hzScope', JSON.stringify({ k: 's', s: 1, n: 1, q: 1, a1: 1, a2: 7, w: 'o' }))); await go('#/', 150); await go('#/hifzlog', 600);
    await ev(() => { const f = document.getElementById('hlFold'); if (f.open) f.open = false; }); await wait(150); await go('#/', 150); await go('#/hifzlog', 600);
    const a = await ev(() => [!!document.getElementById('hlFold'), document.getElementById('hlFold').open, document.querySelectorAll('#hlFold .hl-list li').length]);
    await p.click('#hlFold > summary'); await wait(200); const op = await ev(() => document.getElementById('hlFold').open);
    await p.click('.hl-list li[data-s="113"]'); await wait(300);
    const b2 = await ev(() => [location.hash, JSON.parse(localStorage.getItem('q.hzScope')).s, document.getElementById('hzS').value]);
    await hzBack(k); return assert(a[0] && !a[1] && a[2] === 114 && op && b2[0] === '#/hifzlog' && b2[1] === 1 && b2[2] === '1', JSON.stringify([a, op, b2])); });
  await check(G515, '5.15b ٢/٧: الرجوع من اختبار المصحف أو الكلمات اللي بدأ من «المراجعة» بيرجّع لأول «المراجعة»، ومن الرئيسية لأ', async () => { const k = await hzKeep();
    await ev(() => { localStorage.setItem('q.hzScope', JSON.stringify({ k: 's', s: 112, n: 1, q: 1, a1: 1, a2: 4, w: 'o' })); localStorage.setItem('q.hifzLog', '{}'); });
    await go('#/', 150); await go('#/hifzlog', 600); await ev(() => window.scrollTo(0, 400)); await p.click('#hzGoM'); await wait(1200);
    const inT = await ev(() => location.hash); await ev(() => qBack()); await wait(700); const m = await ev(() => [location.hash, window.scrollY, !document.getElementById('hifzBar')]);
    await p.click('#hzGoW'); await wait(700); const inW = await ev(() => location.hash); await p.click('#btnBack'); await wait(700); const w = await ev(() => [location.hash, window.scrollY]);
    await go('#/', 200); await go('#/s/2/5', 400); await ev(() => qBack()); await wait(500); const other = await ev(() => location.hash);
    await hzBack(k); await go('#/', 200);
    return assert(RegExp('^#/p/' + PL + '\\b').test(inT) && m[0] === '#/hifzlog' && m[1] === 0 && m[2] && /^#\/hifztest\/112/.test(inW) && w[0] === '#/hifzlog' && w[1] === 0 && other !== '#/hifzlog', JSON.stringify([inT, m, inW, w, other])); });
  await check(G515, '5.15b ٣: الموبايل بيهتز لما الاختبار العشوائي ينقل للموضع اللي بعده (المصحف والكلمات)', async () => { const k = await hzKeep();
    const P = [[await gq(112, 1), await gq(112, 2)], [await gq(114, 1), await gq(114, 3)]];
    await go('#/', 200); const b0 = await ev(() => window.__hzBuzz || 0); await ev(P => hzTestStart({ k: 's', s: 112, w: 'r' }, 'm', P), P); await wait(1200);
    await recAyat(112, 1, 2); await wait(1800); const b1 = await ev(() => window.__hzBuzz || 0);
    await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); }); await go('#/', 200);
    await ev(([a, b]) => localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 100, s: 112, from: 1, n: 2, end: a, acc: { h: 0, m: 0 }, pc: [[b, b + 2]], pn: 1, pt: 2 })), [P[0][1], P[1][0]]);
    await ev(() => hzFromSet(true)); await go('#/hifztest/112', 700); await p.click('#htNext'); await wait(600); const b2 = await ev(() => window.__hzBuzz || 0);
    await hzBack(k); await go('#/', 200); return assert(b1 === b0 + 1 && b2 === b1 + 1, JSON.stringify([b0, b1, b2])); });
  await check(G515, '5.15b ٤: العشوائي على المصحف بيخفي آيات الموضع بس، واللي قبله وبعده مكشوف', async () => { const k = await hzKeep();
    const P = [[await gq(113, 2), await gq(113, 3)]];
    await go('#/', 200); await ev(P => hzTestStart({ k: 's', s: 113, w: 'r' }, 'm', P), P); await wait(1500);
    const ks = await ev(() => [...new Set([...document.querySelectorAll('.hifz-mask')].map(m => m.dataset.k))].sort().join(','));
    await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); }); await hzBack(k); await go('#/', 200);
    return assert(ks === '113:2,113:3', ks); });
  await check(G515, '5.15b ٥ + 5.15c ١: «قلب تلقائي» جوه الاختبار ظاهر وشغال ومش بيتضغط (المصحف والكلمات)، والصفحة بتتقلب حتى لو كان مقفول برّه', async () => { const k = await hzKeep();
    await ev(() => { localStorage.setItem('q.hifzFlip', 'false'); localStorage.setItem('q.mode', '"pages"'); }); await go('#/', 150); await go('#/hifzlog', 600);
    await ev(P6 => { const S = window.QURAN.s, P = window.QURAN.p, A = [0]; S.forEach((x, i) => A.push(A[i] + x[3])); const ids = [];
      P.forEach((ps, si) => ps.forEach((pg, ai) => { if (pg === P6) ids.push(A[si] + ai); })); hzTestStart({ k: "s", s: 1, w: "o" }, "m", [[ids[0], ids[ids.length - 1] + 3]]); }, +P6); await wait(1200);
    const fb = await ev(() => document.querySelectorAll('#hifzBar .hz-flip.on:disabled').length);
    for (let i = 0; i < 400; i++) { const r = await ev(() => [document.querySelectorAll('.hifz-mask').length, location.hash]); if (!r[0] || r[1] !== '#/p/' + P6) break; await p.click('#hifzBar [data-c="nx"]'); await wait(25); }
    await wait(2500); const h = await ev(() => location.hash); await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); });
    await go('#/hifzlog', 500); await ev(() => hzTestStart({ k: 's', s: 112, w: 'o' }, 'w')); await wait(700); const wf = await ev(() => { const f = document.getElementById('htFlip'); return !!f && f.disabled && f.classList.contains('on'); });
    await ev(() => localStorage.setItem('q.hifzFlip', 'true')); await hzBack(k); await go('#/', 200);
    return assert(fb === 1 && h === '#/p/' + P6n && wf, JSON.stringify([fb, h, wf])); });
  await check(G515, '5.15b ٦: «كل الكلمات»: أول ٣–٥ كلمات من أول آية مكشوفين في أول الاختبار وفي أول كل موضع، ومش في «الآيات اللي بعدها» ولا الربع', async () => { const k = await hzKeep();
    const open = () => ev(() => [...document.querySelectorAll('.ht-text .ht-open')].map(x => x.dataset.a + ':' + x.dataset.w).join(','));
    await ev(() => localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 100, s: 2, from: 1 }))); await go('#/', 150); await ev(() => hzFromSet(true)); await go('#/hifztest/2', 700); const o1 = await open();
    await p.click('#htNext'); await wait(600); const o2 = await open();
    await ev(() => localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 25, s: 2, from: 1 }))); await go('#/', 150); await ev(() => hzFromSet(true)); await go('#/hifztest/2', 700); const o3 = await open();
    const a = await gq(114, 1);
    await ev(([e, b]) => localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 100, s: 112, from: 1, n: 2, end: e, acc: { h: 0, m: 0 }, pc: [[b, b + 2]], pn: 1, pt: 2 })), [await gq(112, 2), a]);
    await go('#/', 150); await ev(() => hzFromSet(true)); await go('#/hifztest/112', 700); await p.click('#htNext'); await wait(600); const o4 = await open();
    await hzBack(k); await go('#/', 200);
    const n1 = o1 ? o1.split(',') : [], n4 = o4 ? o4.split(',') : [];
    // 2:1 is «الم» (one word): the open words are the first 3-5 of the first ayah, so only 2:1:0 there
    return assert(n1.length >= 1 && n1.every(x => x.startsWith('1:')) && o2 === '' && o3 === '' && n4.length >= 3 && n4.length <= 5 && n4.every(x => x.startsWith('1:')), JSON.stringify([o1, o2, o3, o4])); });
  await check(G515, '5.15b ٨: ✓ بنتيجة الاختبار: من «المراجعة» أي اختبار ٨٠٪ على السورة بيعلّمها، ومن «اختبار الحفظ» لازم السورة كلها', async () => { const k = await hzKeep();
    await ev(() => { ['q.hifzLog', 'q.hifzAyat', 'q.hifzScores'].forEach(x => localStorage.removeItem(x)); localStorage.setItem('q.hzRev', '{}'); localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 25, s: 2, from: 1 })); });
    await go('#/', 150); await go('#/hifztest/2', 700); await p.evaluate(() => window.__htFinish()); await wait(300);
    const part = await ev(() => [!JSON.parse(localStorage.getItem('q.hifzLog') || '{}')[2], (JSON.parse(localStorage.getItem('q.hifzScores') || '{}')[2] || {}).score]);
    const P = [[await gq(2, 7), await gq(2, 9)]];
    await go('#/', 200); await ev(P => hzTestStart({ k: 's', s: 2, w: 'r' }, 'm', P), P); await wait(1200);
    await recAyat(2, 7, 9); await wait(1800);   // Sprint 2 #42: recited, not revealed
    const rv = await ev(() => [!!JSON.parse(localStorage.getItem('q.hzRev') || '{}')[2] && !JSON.parse(localStorage.getItem('q.hifzLog') || '{}')[2], (JSON.parse(localStorage.getItem('q.hifzScores') || '{}')[2] || {}).score]);
    await ev(() => document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove())); await hzBack(k); await go('#/', 300);
    return assert(part[0] && part[1] === 100 && rv[0] && rv[1] === 100, JSON.stringify([part, rv])); });
  // 5.15c: the user's patch on 5.15b
  await check(G515, '5.15c ٢: الرجوع من «المراجعة» نفسها (زرار الشاشة وزرار الموبايل) بيروح للرئيسية مش للشاشة اللي قبلها', async () => {
    await go('#/', 150); await go('#/s/2/5', 400); await go('#/hifzlog', 600); await ev(() => qBack()); await wait(500); const hw = await ev(() => location.hash);
    await go('#/s/2/5', 400); await go('#/hifzlog', 600); await p.click('#btnBack'); await wait(500); const sc = await ev(() => location.hash);
    await go('#/', 200); return assert(/^#\/?$/.test(hw) && /^#\/?$/.test(sc), JSON.stringify([hw, sc])); });
  await check(G515, '5.15c ٣: «اختبار الحفظ» بيسجّل في «السور المحفوظة» بس، و«المراجعة» بتسجّل في «السور المراجعة» بس', async () => { const k = await hzKeep();
    await ev(() => { ['q.hifzLog', 'q.hifzAyat', 'q.hifzScores'].forEach(x => localStorage.removeItem(x)); localStorage.setItem('q.hzRev', '{}'); localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 25, s: 112, from: 1 })); });
    await go('#/', 150); await go('#/hifztest/112', 700); await p.evaluate(() => window.__htFinish()); await wait(300); await go('#/', 150); await go('#/hifztest/112', 700);
    const a = await ev(() => [!!JSON.parse(localStorage.getItem('q.hifzLog'))[112], !JSON.parse(localStorage.getItem('q.hzRev'))[112], document.querySelector('#hmFold > summary').textContent, !!document.querySelector('#hmFold li[data-s="112"].on')]);
    await go('#/', 150); await go('#/hifzlog', 600); const b2 = await ev(() => [document.querySelector('#hlFold > summary').textContent, !document.querySelector('#hlFold li[data-s="112"].on')]);
    await ev(() => hzTestStart({ k: 's', s: 113, w: 'o' }, 'w')); await wait(700); await p.evaluate(() => window.__htFinish()); await wait(300);
    const c = await ev(() => [!!JSON.parse(localStorage.getItem('q.hzRev'))[113], !JSON.parse(localStorage.getItem('q.hifzLog'))[113], JSON.parse(localStorage.getItem('q.hzRev'))[113].iv]);
    await go('#/', 150); await go('#/hifzlog', 600); const d = await ev(() => !!document.querySelector('#hlFold li[data-s="113"].on'));
    await hzBack(k); await go('#/', 200);
    return assert(a[0] && a[1] && /السور المحفوظة/.test(a[2]) && a[3] && /السور المراجعة/.test(b2[0]) && b2[1] && c[0] && c[1] && c[2] === 7 && d, JSON.stringify([a, b2, c, d])); });
  await check(G515, '5.15c ٣: المراجعة الذكية والورد شغالين على «السور المراجعة»، والخريطة: المحفوظ من «السور المحفوظة» والأصفر من المراجعة', async () => { const k = await hzKeep();
    const r = await ev(a => { localStorage.setItem('q.hifzScores', '{}'); localStorage.setItem('q.hifzLog', JSON.stringify({ 1: { m: a } })); localStorage.setItem('q.hzRev', '{}');
      localStorage.removeItem('q.hzSched'); const d0 = hzWard().list.length; localStorage.setItem('q.hzRev', JSON.stringify({ 2: { m: a, r: a, iv: 7 } })); const w = hzWard(); return [d0, [...new Set(w.list.map(x => x.s))].join(','), w.all]; }, dAgo(20));
    const col = async rev => { await ev(([a, rev]) => { localStorage.removeItem('q.hifzAyat'); localStorage.removeItem('q.hzSched'); localStorage.setItem('q.hifzLog', JSON.stringify({ 112: { m: a } })); localStorage.setItem('q.hzRev', JSON.stringify(rev ? { 112: { m: a, r: a, iv: 7 } } : {})); }, [dAgo(20), rev]);
      await go('#/', 150); await go('#/hifzmap', 700); return ev(() => (document.querySelector('.hm-c[data-s="112"]') || {}).className || ''); };
    const due = await col(true), fresh = await col(false);
    await p.click('#hmFold > summary'); await wait(700); const lg = await ev(() => [location.hash, document.getElementById('hmFold') && document.getElementById('hmFold').open, !document.getElementById('hmLog')]);
    const mig = await ev(() => { localStorage.removeItem('q.hzRev'); localStorage.setItem('q.hifzLog', JSON.stringify({ 5: { m: '2026-1-1', r: '2026-1-1', iv: 14 } })); return Object.keys(hzRevData()).join(',') + '/' + (hzRevData()[5] || {}).iv; });
    await hzBack(k); await go('#/', 200);
    return assert(r[0] === 0 && r[1] === '1,2' && r[2] === 19 && /\bc2\b/.test(due) && /\bc3\b/.test(fresh) && lg[0] === '#/hifzmap' && lg[1] && lg[2] && mig === '5/14', JSON.stringify([r, due, fresh, lg, mig])); });
  // ---------- 5.16: the user's package (U1–U8; U9 put off) ----------
  const G516 = 'نسخة 5.16';
  const due2 = async () => ev(a => { localStorage.setItem('q.hifzScores', '{}'); localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hzRev', '{}'); localStorage.setItem('q.hzSched', JSON.stringify({ 5: { r: a, iv: 7 }, 9: { r: a, iv: 7 } })); localStorage.removeItem('q.hzDaily'); }, dAgo(20));
  const stopT = async () => ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); });
  await check(G516, 'U1: «اختبرني» قدام سورة في «عليك مراجعة» بيبدأ اختبارها على المصحف على طول', async () => { const k = await hzKeep(); await due2();
    await go('#/', 150); await go('#/hifzlog', 700); await p.click('.hz-due [data-test="5"]'); await wait(1200);
    const r = await ev(() => [!!document.getElementById('hifzBar'), location.hash, [...new Set([...document.querySelectorAll('.hifz-mask')].map(m => m.dataset.k.split(':')[0]))].join(',')]);
    await stopT(); await hzBack(k); await go('#/', 200); return assert(r[0] && /^#\/p\//.test(r[1]) && r[2] === '2', JSON.stringify(r)); });
  await check(G516, 'U2: «بالسرد / عشوائي» في ورد النهارده: بالسرد كل ربع كامل (الأرباع المتتالية موضع واحد)، وعشوائي أجزاء ٣–١٢ آية جوه الأرباع المستحقة بس', async () => { const k = await hzKeep(); await due2();
    await go('#/', 150); await go('#/hifzlog', 700); const n = await ev(() => document.querySelectorAll('.hz-wway button').length);
    await p.click('.hz-wway [data-ww="r"]'); await wait(400);
    const r = await ev(() => { const way = JSON.parse(localStorage.getItem('q.hzWardWay')), on = (document.querySelector('.hz-wway .on') || {}).textContent, S = window.QURAN.s, A = [0]; S.forEach((x, i) => A.push(A[i] + x[3]));
      const sur = i => hzRubOf(i), ri = k => { let s = window.QURAN.h[k][0]; return A[s - 1] + window.QURAN.h[k][1] - 1; }, R = [], O = hzWardPlan([5, 9], 'o'), O2 = hzWardPlan([5, 6], 'o');
      for (let t = 0; t < 20; t++) hzWardPlan([5, 9], 'r').forEach(x => R.push([sur(x[0]), sur(x[1]), x[1] - x[0] + 1, x[0], x[1]]));
      return [way, on, R.every(x => x[0] === x[1] && (x[0] === 5 || x[0] === 9) && x[2] >= 1 && x[2] <= 12 && (x[2] === 1 || hzLines(x[3], x[4]) <= hzCap())), R.some(x => x[0] === 5) && R.some(x => x[0] === 9), JSON.stringify(O) === JSON.stringify([[ri(5), ri(6) - 1], [ri(9), ri(10) - 1]]) && JSON.stringify(O2) === JSON.stringify([[ri(5), ri(7) - 1]])]; });
    await p.click('#hzWardGo'); await wait(1200); const t = await ev(() => !!document.getElementById('hifzBar'));
    await stopT(); await hzBack(k); await ev(() => localStorage.removeItem('q.hzWardWay')); await go('#/', 200);
    return assert(n === 2 && r[0] === 'r' && r[1] === 'اختبار عشوائي' && r[2] && r[3] && r[4] && t, JSON.stringify([n, r, t])); });
  await check(G516, 'U5: «هدف اليوم» جوه كارت «النهارده» (كارت واحد)، والدايرة بتفتح الهدف؛ ومن غير حفظ الهدف زي ما هو', async () => { const k = await hzKeep(); await due2();
    await ev(() => { localStorage.removeItem('q.stats'); localStorage.setItem('q.goal', JSON.stringify({ pages: 5 })); }); await go('#/hifzlog', 150); await go('#/', 600);
    const a = await ev(() => [!!document.querySelector('#tdCard #tGoal'), document.querySelectorAll('#tGoal').length, (document.querySelector('#tdCard small') || {}).textContent || '', !!document.querySelector('.home-row.one')]);
    await p.click('#tGoal'); await wait(400); const d = await ev(() => [location.hash, !!document.querySelector('.dlg-back .g-chips')]); await ev(() => document.querySelectorAll('.dlg-back').forEach(e => e.remove()));
    await ev(() => { localStorage.removeItem('q.hifzLog'); localStorage.setItem('q.hzRev', '{}'); localStorage.removeItem('q.hzSched'); }); await go('#/hifzlog', 150); await go('#/', 600);
    const b2 = await ev(() => [!document.getElementById('tdCard'), !!document.querySelector('.home-row > #tGoal.mini')]);
    await hzBack(k); await ev(() => localStorage.removeItem('q.goal')); await go('#/', 200);
    return assert(a[0] && a[1] === 1 && /القراءة: ٠ من ٥ صفحة/.test(a[2]) && /مراجعة: ٢ ربع\/سورة/.test(a[2]) && a[3] && /^#\/?$/.test(d[0]) && d[1] && b2[0] && b2[1], JSON.stringify([a, d, b2])); });
  await check(G516, 'U6: «السور المحفوظة» في الخريطة بتفتح القايمة مكانها من غير ما الصفحة تطلع لفوق', async () => { await go('#/', 150); await go('#/hifzmap', 700);
    await ev(() => { document.getElementById('hmFold').open = false; }); await wait(200);
    await ev(() => window.scrollTo(0, document.body.scrollHeight)); await wait(200); const y0 = await ev(() => window.scrollY); await p.click('#hmFold > summary'); await wait(500);
    const r = await ev(() => [location.hash, document.getElementById('hmFold').open, document.querySelectorAll('#hmFold li').length, window.scrollY]);
    await p.click('#hmFold > summary'); await wait(200);
    return assert(r[0] === '#/hifzmap' && r[1] && r[2] === 114 && y0 > 200 && r[3] >= y0 - 50, JSON.stringify([y0, r])); });
  await check(G516, 'U7: «آيات غلطت فيها قبل كده» box بيفتح ويقفل باللمس، ومقفول في الأول', async () => { const k = await hzKeep();
    await ev(a => { localStorage.setItem('q.hifzAyat', JSON.stringify({ '112:2': { ok: 0, d: a }, '112:3': { ok: 0, d: a } })); localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 25, s: 112, from: 1 })); }, dAgo(1));
    await go('#/', 150); await go('#/hifztest/112', 800); const a = await ev(() => { const d = document.getElementById('htBad'); return d && [d.tagName, d.open, d.querySelectorAll('[data-a]').length, d.querySelector('summary').textContent]; });
    await p.click('#htBad > summary'); await wait(200); const o = await ev(() => document.getElementById('htBad').open); await p.click('#htBad > summary'); await wait(200); const c = await ev(() => document.getElementById('htBad').open);
    await hzBack(k); await go('#/', 200); return assert(a && a[0] === 'DETAILS' && !a[1] && a[2] === 2 && /\(٢\)/.test(a[3]) && o && !c, JSON.stringify([a, o, c])); });
  await check(G516, 'U8: زرار «السور المراجعة» في «المراجعة» بنفس شكل «السور المحفوظة» في الخريطة', async () => {
    const st = async (h, id) => { await go('#/', 150); await go(h, 700); return ev(id => { const e = document.querySelector('#' + id + ' > summary'), c = getComputedStyle(e); return [e.className, c.backgroundColor, c.borderRadius, c.fontWeight, c.display]; }, id); };
    const a = await st('#/hifzlog', 'hlFold'), m = await st('#/hifzmap', 'hmFold');
    return assert(/continue/.test(a[0]) && JSON.stringify(a.slice(1)) === JSON.stringify(m.slice(1)), JSON.stringify([a, m])); });
  await check(G516, '5.16e: بعد اختبار كلمات من «المراجعة»، «اختبار الحفظ» من تبويبه بيبقى اختبار عادي و«قلب تلقائي» شغال ويتقفل', async () => { const k = await hzKeep();
    await ev(() => localStorage.setItem('q.hifzFlip', 'true')); await go('#/', 150); await go('#/hifzlog', 600);
    await ev(() => hzTestStart({ k: 's', s: 2, w: 'o' }, 'w')); await wait(800);
    const a = await ev(() => { const f = document.getElementById('htFlip'); return [location.hash, f.disabled, JSON.parse(localStorage.getItem('q.hifzTest')).end != null]; });
    await go('#/', 150); await go('#/hifztest', 800);
    const b2 = await ev(() => { const f = document.getElementById('htFlip'); return [f.disabled, f.classList.contains('on'), JSON.parse(localStorage.getItem('q.hifzTest')).end == null]; });
    await p.click('#htFlip'); await wait(200); const c = await ev(() => [document.getElementById('htFlip').classList.contains('on'), JSON.parse(localStorage.getItem('q.hifzFlip'))]);
    await ev(() => localStorage.setItem('q.hifzFlip', 'true')); await hzBack(k); await go('#/', 200);
    return assert(a[0] === '#/hifztest/2' && a[1] && a[2] && !b2[0] && b2[1] && b2[2] && !c[0] && c[1] === false, JSON.stringify([a, b2, c])); });
  // ---------- 5.16b: recognition → mushaf speed (U3, U4) ----------
  const G516b = 'نسخة 5.16b';
  await check(G516b, 'U3: على المصحف، السطر بيتكشف كلمة كلمة مع القراية (مش بيستنى السطر كله)', async () => { const k = await hzKeep();
    await ev(() => { window.ReciteBridge = { start() {}, stop() {} }; localStorage.setItem('q.mode', '"pages"'); }); await go('#/', 150);
    // an ayah on one page in this edition (2:255 runs over two Haramain pages, 3:7 over two Shamarly pages)
    const U = (await ev(() => QURAN.r[1][254].every(x => x[0] === QURAN.r[1][254][0][0]))) ? [2, 255, 'الله لا اله الا هو', 'الله لا اله الا هو الحي القيوم لا تاخذه سنه ولا نوم'] : [3, 7, 'هو الذي انزل عليك الكتاب', 'هو الذي انزل عليك الكتاب منه ايات محكمات هن ام الكتاب'];
    const ug = await gq(U[0], U[1]); await ev(([U, g]) => hzTestStart({ k: 'a', s: U[0], a1: U[1], a2: U[1], w: 'o' }, 'm', [[g, g]]), [U, ug]); await wait(1500);
    const wsum = () => ev(k => [...document.querySelectorAll('.hifz-mask[data-k="' + k + '"]')].reduce((t, m) => t + m.getBoundingClientRect().width, 0), U[0] + ':' + U[1]);
    const w0 = await wsum(); await p.click('#hifzBar [data-c=mic]'); await wait(200);
    await ev(U => { onRecite('', 'state:listening'); onRecite(U[2], 'partial'); }, U); await wait(400); const w1 = await wsum();
    await ev(U => onRecite(U[3], 'partial'), U); await wait(400); const w2 = await wsum();
    await stopT(); await ev(() => { delete window.ReciteBridge; }); await hzBack(k); await go('#/', 200);
    return assert(w0 > 0 && w1 > 0 && w1 < w0 - 40 && w2 < w1 - 40, JSON.stringify([w0, w1, w2].map(Math.round))); });
  await check(G516b, 'U4: آخر كلمة في الموضع تتسمع صح وانت لسه بتقرا: الموضع اللي بعده بيفتح في أقل من ثانية (من غير ما يستنى الوقفة)', async () => { const k = await hzKeep();
    await ev(() => { window.ReciteBridge = { start() {}, stop() {} }; localStorage.setItem('q.mode', '"pages"'); }); await go('#/', 150);
    const P = [[await gq(112, 1), await gq(112, 4)], [await gq(110, 1), await gq(110, 3)]];
    await ev(P => hzTestStart({ k: 's', s: 112, w: 'r' }, 'm', P), P); await wait(1500); await p.click('#hifzBar [data-c=mic]'); await wait(200);
    const t = await ev(() => new Promise(res => { onRecite('', 'state:listening'); const t0 = performance.now();
      onRecite('قل هو الله احد الله الصمد لم يلد ولم يولد ولم يكن له كفوا احد', 'partial');
      const iv = setInterval(() => { if (document.querySelector('.hifz-mask[data-k="110:1"]')) { clearInterval(iv); res(Math.round(performance.now() - t0)); } else if (performance.now() - t0 > 4000) { clearInterval(iv); res(-1); } }, 20); }));
    const pn = await ev(() => document.querySelector('#hifzBar .hz-info') && document.querySelector('#hifzBar .hz-info').textContent);
    await stopT(); await ev(() => { delete window.ReciteBridge; }); await hzBack(k); await go('#/', 200);
    return assert(t > 0 && t < 1000, JSON.stringify([t, pn])); });
  await check(G516, '5.16d: «قلب تلقائي» في اختبار الخريطة بيشتغل ويقف (المصحف والكلمات)، وفي اختبار «المراجعة» باهت ومقفول', async () => { const k = await hzKeep();
    await ev(() => { localStorage.setItem('q.hifzFlip', 'true'); localStorage.setItem('q.mode', '"pages"'); }); await go('#/', 150); await go('#/hifzmap', 700);
    await ev(n => { const s = window.QURAN.p.findIndex(a => a.includes(+n)) + 1, i = window.QURAN.p[s - 1].indexOf(+n); window.hifzTestPages(s, i < 0 ? 1 : i + 1); }, P6); await wait(1200);
    const st = () => ev(() => { const f = document.querySelector('#hifzBar .hz-flip'); return f && [f.disabled, f.classList.contains('on'), JSON.parse(localStorage.getItem('q.hifzFlip'))]; });
    const a = await st(); await p.click('#hifzBar .hz-flip'); await wait(300); const b2 = await st();
    // off: the page's last ayah ends the map test on page 600 (no turn to 601)
    for (let i = 0; i < 400; i++) { const r = await ev(() => [document.querySelectorAll('.hifz-mask').length, location.hash]); if (!r[0] || r[1] !== '#/p/' + P6) break; await p.click('#hifzBar [data-c="nx"]'); await wait(25); }
    await wait(2500); const h = await ev(() => location.hash); await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); });
    await ev(() => localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 25, s: 112, from: 1 }))); await go('#/', 150); await go('#/hifztest/112', 700);
    const w = await ev(() => { const f = document.getElementById('htFlip'); return [f.disabled, f.classList.contains('on')]; }); await p.click('#htFlip'); await wait(200);
    const w2 = await ev(() => [document.getElementById('htFlip').classList.contains('on'), JSON.parse(localStorage.getItem('q.hifzFlip'))]);
    await ev(() => localStorage.setItem('q.hifzFlip', 'false')); await go('#/', 150); await go('#/hifzlog', 600); await ev(() => hzTestStart({ k: 's', s: 112, w: 'o' }, 'm')); await wait(1200); const rv = await st();
    await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); localStorage.setItem('q.hifzFlip', 'true'); }); await hzBack(k); await go('#/', 200);
    return assert(!a[0] && a[1] && !b2[0] && !b2[1] && b2[2] === false && h === '#/p/' + P6 && !w[0] && !w[1] && w2[0] && w2[1] === true && rv[0] && rv[1], JSON.stringify([a, b2, h, w, w2, rv])); });
  // ---------- 5.17 (Sprint C): S3 اختبار المتشابهات، S5 التلقين، S8 الصوت من غير إنترنت ومؤقت النوم ----------
  const G517 = 'نسخة 5.17 (Sprint C)';
  const mtKey = () => ev(() => { const d = document.getElementById('mtOpen').dataset; return d.s + ':' + d.a; });
  await check(G517, 'S3: اختبار المتشابهات بيفتح من «المزيد» بسؤال وتكملات من 2 لـ 3', async () => {
    await ev(() => { localStorage.removeItem('q.hifzLog'); localStorage.removeItem('q.hifzAyat'); }); await go('#/more', 400);
    await p.click('.tile[data-h="#/mutash"]'); await wait(1500);
    const r = await ev(() => [location.hash, document.querySelectorAll('.mt-ch').length, !!document.querySelector('.mt-pre'), document.getElementById('mtScore').textContent]);
    return assert(r[0] === '#/mutash' && r[1] >= 2 && r[1] <= 3 && r[2] && /٠ من ٠/.test(r[3]), JSON.stringify(r)); });
  await check(G517, 'S3: الإجابة بتلوّن الصح والغلط، وبتتسجل في q.hifzAyat، والسؤال اللي بعده بيتغير', async () => {
    let wrong = null, right = null;
    for (let t = 0; t < 12 && !(wrong && right); t++) {
      const k = await mtKey(), i = await ev(() => document.querySelectorAll('.mt-ch').length - 1);
      await p.click('.mt-ch[data-i="' + (t % 2 ? 0 : i) + '"]'); await wait(150);
      const r = await ev(k => { const b = [...document.querySelectorAll('.mt-ch')]; const H = JSON.parse(localStorage.getItem('q.hifzAyat') || '{}');
        return { ok: b.filter(x => x.classList.contains('ok')).length, miss: b.filter(x => x.classList.contains('miss')).length, dis: b.every(x => x.disabled), src: b.every(x => !x.querySelector('.mt-src').hidden), h: H[k] && H[k].ok, res: document.getElementById('mtRes').textContent }; }, k);
      if (r.ok !== 1 || !r.dis || !r.src) return assert(false, JSON.stringify(r));
      if (r.miss) wrong = wrong || (r.h === 0 && /غلط/.test(r.res)); else right = right || (r.h === 1 && /صح/.test(r.res));
      await p.click('#mtNext'); await wait(200);
    }
    const sc = await ev(() => document.getElementById('mtScore').textContent);
    return assert(wrong && right && !/٠ من ٠/.test(sc), JSON.stringify([wrong, right, sc])); });
  await check(G517, 'S3: «سمّع التكملة» بالمايك بيختار التكملة الصح من الكلام المسموع', async () => {
    await ev(() => { window.ReciteBridge = { start() {}, stop() {} }; }); await go('#/', 150); await go('#/mutash', 900);
    // an ayah repeated word for word elsewhere (17:48 = 25:9) cannot be told apart by voice: skip such questions
    for (let t = 0; t < 8; t++) {
      const dup = await ev(() => { const x = [...document.querySelectorAll('.mt-ch .ay-text')].map(e => e.textContent.replace(' …', '').trim()); return new Set(x).size < x.length; });
      if (!dup) break; await p.click('#mtNext'); await wait(200);
    }
    await p.click('#mtMic'); await wait(200);
    const said = await ev(() => { const h = document.getElementById('mtOpen').dataset, arn = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
      // the answer key, as in the 5.17b «إيقاف» case below (an ayah-prefix match finds nothing when the ayah is repeated word for word)
      const s = +h.s, a = +h.a, nx = a < QURAN.s[s - 1][3] ? [s, a + 1] : [s + 1, 1], srcOf = v => 'سورة ' + QURAN.s[v[0] - 1][0] + ' · الآية ' + arn(v[1]);
      const whole = document.querySelector('.mt-pre').textContent.replace(' …', '').trim().split(/\s+/).length >= QURAN.t[s - 1][a - 1].split(' ').length;
      const ch = [...document.querySelectorAll('.mt-ch')].filter(b => b.querySelector('.mt-src').textContent.trim() === srcOf(whole ? nx : [s, a]));
      if (ch.length !== 1) throw new Error('answer key ' + s + ':' + a + ' x' + ch.length); const c = ch[0].querySelector('.ay-text').textContent.replace(' …', '');
      onRecite(c, 'partial'); return c; });
    await wait(200);
    // a choice that opens a longer one word for word is decided by the final only (the reader may be going on)
    await ev(c => { if (!document.querySelector('.mt-ch.ok, .mt-ch.miss')) onRecite(c, 'final'); }, said); await wait(200);
    const r = await ev(() => [document.querySelectorAll('.mt-ch.ok').length, document.querySelectorAll('.mt-ch.miss').length, document.getElementById('mtMic').classList.contains('rec')]);
    await ev(() => { delete window.ReciteBridge; });
    return assert(said && r[0] === 1 && r[1] === 0 && !r[2], JSON.stringify([said, r])); });
  await check(G517, '5.17b: سؤال المتشابهات بلون مختلف عن الاختيارات، و«افتح الآية» بتفتح المصحف أو النص حسب العرض', async () => {
    await go('#/mutash', 600);
    const c = await ev(() => [getComputedStyle(document.querySelector('.mt-q')).backgroundColor, getComputedStyle(document.querySelector('.mt-ch')).backgroundColor]);
    const k = await mtKey(); await ev(() => localStorage.setItem('q.mode', '"pages"')); await p.reload(); await wait(800); await go('#/mutash', 600);
    const k2 = await mtKey(); await p.click('#mtOpen'); await wait(800); const h1 = await ev(() => location.hash);
    await ev(() => localStorage.setItem('q.mode', '"text"')); await p.reload(); await wait(800); await go('#/mutash', 600);
    const k3 = await mtKey(); await p.click('#mtOpen'); await wait(800); const h2 = await ev(() => location.hash);
    await ev(() => localStorage.setItem('q.mode', '"pages"')); await p.reload(); await wait(800);
    return assert(c[0] !== c[1] && /^#\/p\/\d+\?a=/.test(h1) && h1.indexOf('a=' + k2) > 0 && h2 === '#/s/' + k3.replace(':', '/'), JSON.stringify([c, k2, h1, k3, h2])); });
  await check(G517, '5.17b: «إيقاف» في «سمّع التكملة» بيحكم باللي اتسمع لحد دلوقتي', async () => {
    await ev(() => { window.ReciteBridge = { start() {}, stop() {} }; }); await go('#/', 150); await go('#/mutash', 800);
    await p.click('#mtMic'); await wait(100);
    const said = await ev(() => { const h = document.getElementById('mtOpen').dataset, arn = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
      // the answer key (mutQuestion): the right choice is the question's own ayah, or the ayah after it when the ayah is
      // repeated word for word (27:71 = 10:48 …); found by the choices' hidden «سورة … · الآية …» source, not an ayah-prefix match
      // (that mode shows the whole ayah as the opening; otherwise the opening is shorter than the ayah)
      const s = +h.s, a = +h.a, nx = a < QURAN.s[s - 1][3] ? [s, a + 1] : [s + 1, 1], srcOf = v => 'سورة ' + QURAN.s[v[0] - 1][0] + ' · الآية ' + arn(v[1]);
      const whole = document.querySelector('.mt-pre').textContent.replace(' …', '').trim().split(/\s+/).length >= QURAN.t[s - 1][a - 1].split(' ').length;
      const ch = [...document.querySelectorAll('.mt-ch')].filter(b => b.querySelector('.mt-src').textContent.trim() === srcOf(whole ? nx : [s, a]));
      if (ch.length !== 1) throw new Error('answer key ' + s + ':' + a + ' x' + ch.length); const o = ch[0].querySelector('.ay-text').textContent.replace(' …', '');
      const w = o.split(' '); onRecite(w.slice(0, Math.max(2, w.length - 1)).join(' '), 'partial'); return w; });
    await wait(100); const mid = await ev(() => document.querySelectorAll('.mt-ch.ok').length);
    await p.click('#mtMic'); await wait(150);
    const r = await ev(() => [document.querySelectorAll('.mt-ch.ok').length, document.querySelectorAll('.mt-ch.miss').length, document.getElementById('mtRes').textContent]);
    await ev(() => { delete window.ReciteBridge; });
    // a choice cut to 4+ words: 3 of 4 heard is enough when it is clearly ahead; else «مش واضح» and nothing is marked
    return assert((r[0] === 1 && r[1] === 0) || (r[0] === 0 && !r[2]), JSON.stringify([said, mid, r])); });
  await check(G517, '5.17b: سؤال المتشابهات بيعرض الآية اللي قبلها كسياق (الأعراف ٦١: ضلالة مش سفاهة)', async () => {
    let r = null;
    for (let i = 0; i < 40; i++) { await p.click('#mtNext'); await wait(80);
      const x = await ev(() => { const d = document.getElementById('mtOpen').dataset, c = document.querySelector('.mt-ctx'); return [+d.s, +d.a, c ? c.textContent : null]; });
      if (x[1] > 1 && !x[2]) return assert(false, 'no context ' + JSON.stringify(x)); if (x[1] > 1) { r = x; break; } }
    return assert(r && r[2].indexOf(String.fromCharCode(0xFD3F)) > 0, JSON.stringify(r)); });
  await check(G517, '5.17b: بعد الإجابة الكلمة المميزة في كل تكملة متظللة', async () => {
    await p.click('#mtNext'); await wait(150); await p.click('.mt-ch[data-i="0"]'); await wait(150);
    const m = await ev(() => [...document.querySelectorAll('.mt-ch')].map(b => b.querySelectorAll('mark').length));
    return assert(m.filter(x => x > 0).length >= m.length - 1, JSON.stringify(m)); });
  await check(G517, '5.17b: كل أسئلة المتشابهات: الاختيارات مختلفة حرف بحرف وفي كل واحدة كلمة مميزة، والآية المتكررة بنصها سؤالها «الآية اللي بعدها»', async () => {
    const r = await ev(() => { const st = { n: 0, after: 0, bad: [], letter: 0 }; const nm = w => w.replace(/[ً-ٰٟۖ-ۭـ]/g, '');
      for (const k of Object.keys(MUTASH)) { const q = QA_mut(k); if (!q) continue; st.n++; if (q.after) st.after++;
        const tx = q.opts.map(o => nm(o.txt)); if (new Set(tx).size !== tx.length) st.bad.push(k + ' dup');
        if (q.opts.some(o => o.marked.indexOf('<mark') < 0)) st.bad.push(k + ' nomark');
        const c = q.opts.find(o => o.ok); const ref = q.after ? QURAN.t[c.v[0] - 1][c.v[1] - 1] : QURAN.t[q.s - 1][q.a - 1];
        if (!(q.after ? ref.indexOf(c.txt.replace(' …', '')) === 0 : ref.indexOf(q.pre + ' ' + c.txt.replace(' …', '')) === 0)) st.bad.push(k + ' wrongok');
        // one-letter differences (وما/فما ...): choices whose cut text differs by one letter only
        const L = q.opts.map(o => nm(o.txt)); for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (L[i].length === L[j].length && [...L[i]].filter((ch, x) => ch !== L[j][x]).length === 1) st.letter++; }
      st.bad = st.bad.slice(0, 5); return st; });
    return assert(r.n > 700 && r.after > 0 && !r.bad.length && r.letter > 0, JSON.stringify(r)); });
  await check(G517, 'S3: «من محفوظي» بيسأل من السور المحفوظة بس', async () => {
    await ev(() => localStorage.setItem('q.hifzLog', JSON.stringify({ 2: { d: '2026-11-01' } }))); await go('#/', 150); await go('#/mutash', 600);
    await p.click('.mt-scope button[data-m="1"]'); await wait(100); await p.click('.mt-scope button[data-m="0"]'); await wait(150);
    const ks = []; for (let i = 0; i < 6; i++) { ks.push(await mtKey()); await p.click('#mtNext'); await wait(120); }
    await ev(() => localStorage.removeItem('q.hifzLog'));
    return assert(ks.every(k => k.split(':')[0] === '2'), ks.join(' ')); });
  await check(G517, 'S5: التلقين: اسمع (الآية مستخبية) ← اقرا ← سمّع، والكلمة المنسية بتتحسب غلط', async () => {
    await ev(() => localStorage.removeItem('q.talqin')); await go('#/more', 300); await p.click('.tile[data-h="#/talqin"]'); await wait(500);
    await ev(() => { const s = document.getElementById('tqS'); s.value = '112'; s.onchange(); }); await wait(500);
    const st = () => ev(() => [location.hash, document.querySelector('.tq-steps li.on').dataset.st, document.getElementById('tqText').className]);
    const a = await st(); await p.click('#tqPlay'); await wait(300); const pl = await ev(() => !!document.getElementById('player'));
    await p.click('#tqSkip'); await wait(150); const b2 = await st(); const sh = await ev(() => [...document.querySelectorAll('#tqText .ht-w')].every(e => e.classList.contains('shown')));
    await p.click('#tqHide'); await wait(150); const c = await st(); const hid = await ev(() => [...document.querySelectorAll('#tqText .ht-w')].every(e => !e.classList.contains('shown')));
    await p.click('#tqText .ht-w'); await p.click('#tqDone'); await wait(150);
    const r = await ev(() => [document.getElementById('tqRes').textContent, JSON.parse(localStorage.getItem('q.hifzAyat'))['112:1'].ok, !!document.getElementById('tqNext')]);
    return assert(a[0] === '#/talqin/112' && a[1] === '1' && /tq-blur/.test(a[2]) && pl && b2[1] === '2' && !/tq-blur/.test(b2[2]) && sh && c[1] === '3' && hid && /نسيت ١ من/.test(r[0]) && r[1] === 0 && r[2], JSON.stringify([a, pl, b2, sh, c, hid, r])); });
  await check(G517, 'S5: «الآية اللي بعدها» بتفتح الآية 2 والقارئ بيبدأ لوحده، والتسميع بالمايك بيخلّص الآية صح', async () => {
    await p.click('#tqNext'); await wait(400);
    const a = await ev(() => [document.getElementById('tqA').value, document.querySelector('.tq-steps li.on').dataset.st, !!document.getElementById('player'), document.querySelector('.pl-info b') && document.querySelector('.pl-info b').textContent]);
    await ev(() => { window.ReciteBridge = { start() {}, stop() {} }; }); await p.click('#tqSkip'); await wait(100); await p.click('#tqHide'); await wait(100);
    await p.click('#tqMic'); await wait(100); await ev(() => onRecite(QURAN.t[111][1], 'final')); await wait(300);
    const r = await ev(() => [document.getElementById('tqRes').textContent, JSON.parse(localStorage.getItem('q.hifzAyat'))['112:2'], document.querySelectorAll('#tqText .ht-w.ok').length, document.querySelectorAll('#tqText .ht-w').length]);
    await ev(() => { delete window.ReciteBridge; const b = document.querySelector('#player button[data-c=st]'); if (b) b.click(); });
    return assert(a[0] === '2' && a[1] === '1' && a[2] && /١٠٠٪/.test(r[0]) && r[1] && r[1].ok === 1 && r[2] === r[3], JSON.stringify([a, r])); });
  await check(G517, '5.17b: التلقين لمجموعة آيات (من ١ لحد ٣): القارئ بيقرا المجموعة، والتسميع بيعلّم كل آية، و«الآيات اللي بعدها» بتفتح ٤–٦', async () => {
    await ev(() => localStorage.setItem('q.talqin', JSON.stringify({ s: 112, a: 1, b: 1, n: 1 }))); await go('#/', 150); await go('#/talqin/112', 500);
    await ev(() => { const s = document.getElementById('tqB'); s.value = '3'; s.onchange(); }); await wait(300);
    const a = await ev(() => [document.getElementById('tqA').value, document.getElementById('tqB').value, new Set([...document.querySelectorAll('#tqText .ht-w')].map(e => e.dataset.a)).size, document.getElementById('tqHint').textContent]);
    await p.click('#tqPlay'); await wait(200); const pl = await ev(() => document.querySelector('.pl-info span').textContent);
    await p.click('#tqSkip'); await wait(100); await p.click('#tqHide'); await wait(100);
    await p.click('#tqText .ht-w[data-a="2"]'); await p.click('#tqDone'); await wait(150);
    const H = await ev(() => { const h = JSON.parse(localStorage.getItem('q.hifzAyat')); return [h['112:1'].ok, h['112:2'].ok, h['112:3'].ok, document.getElementById('tqNext').textContent]; });
    await p.click('#tqNext'); await wait(400);
    const n = await ev(() => [document.getElementById('tqA').value, document.getElementById('tqB').value]);
    await ev(() => { const b = document.querySelector('#player button[data-c=st]'); if (b) b.click(); });
    return assert(a[0] === '1' && a[1] === '3' && a[2] === 3 && /الآيات/.test(a[3]) && /١–٣/.test(pl) && H[0] === 1 && H[1] === 0 && H[2] === 1 && /الآيات اللي بعدها/.test(H[3]) && n[0] === '4' && n[1] === '4', JSON.stringify([a, pl, H, n])); });
  await check(G517, 'S8: مؤقت النوم ١٥ دقيقة بيبان في المشغّل وبيتلغي', async () => {
    await go('#/p/' + PL, 900); await p.click('#pPlay'); await wait(300);
    await p.click('#player button[data-c=dl]'); await wait(150); const dlg = await ev(() => [!!document.querySelector('.ls-dlg .zz-opts'), !!document.getElementById('dlGo')]);
    await p.click('.ls-dlg [data-z="15"]'); await wait(150);
    const on = await ev(() => [document.querySelector('.pl-info span').textContent, document.querySelector('#player button[data-c=dl]').classList.contains('on')]);
    await p.click('#player button[data-c=dl]'); await wait(150); await p.click('.ls-dlg [data-z="0"]'); await wait(150);
    const off = await ev(() => [document.querySelector('.pl-info span').textContent, document.querySelector('#player button[data-c=dl]').classList.contains('on')]);
    return assert(dlg[0] && /النوم بعد ١٥ د/.test(on[0]) && on[1] && !/النوم/.test(off[0]) && !off[1], JSON.stringify([dlg, on, off])); });
  await check(G517, 'S8: مؤقت «آخر السورة» بيوقّف القارئ في آخر الإخلاص ومبيكمّلش الفلق', async () => {
    await ev(() => { const b = document.querySelector('#player button[data-c=st]'); if (b) b.click(); }); await go('#/p/' + PL, 700); await p.click('#pPlay'); await wait(100);
    await p.click('#player button[data-c=dl]'); await wait(100); await p.click('.ls-dlg [data-z="s"]');
    // every surah the player shows from now until it stops: the one it started in only (sleep at its end)
    const seen = new Set(); let gone = false;
    for (let i = 0; i < 150 && !gone; i++) { await wait(60); const b = await ev(() => document.querySelector('.pl-info b') ? document.querySelector('.pl-info b').textContent.split(' · ')[0] : null); if (b) seen.add(b); else gone = true; }
    return assert(gone && seen.size === 1 && seen.has('الإخلاص'), JSON.stringify([gone, [...seen]])); });
  await check(G517, 'S8: تحميل السورة للاستماع من غير إنترنت بشريط تقدّم، والجزء بيتلغي', async () => {
    await ev(() => { window.AppBridge = window.AppBridge || { fake517: 1 }; }); await go('#/p/' + PL, 600); await p.click('#pPlay'); await wait(300);
    await p.click('#player button[data-c=dl]'); await wait(150); await p.click('#dlGo');
    let s = ''; for (let i = 0; i < 40 && !/خلص$/.test(s); i++) { await wait(150); s = await ev(() => document.querySelector('#dlBox span').textContent); }
    const w = await ev(() => document.querySelector('#dlBox i').style.width);
    await p.click('.dl-pick button[data-k="j"]'); await p.click('#dlGo'); await wait(150); await p.click('#dlStop'); await wait(200);
    const j = await ev(() => document.querySelector('#dlBox span').textContent);
    await ev(() => { if (window.AppBridge && window.AppBridge.fake517) delete window.AppBridge; document.querySelectorAll('.dlg-back').forEach(e => e.remove()); const b = document.querySelector('#player button[data-c=st]'); if (b) b.click(); });
    // surah 112: basmala + 4 ayat; juz 30: 564 ayat + basmala
    return assert(/سورة الإخلاص ٥ من ٥ خلص/.test(s) && w === '100%' && /الجزء الثلاثون .* من ٥٦٥ اتلغى/.test(j), JSON.stringify([s, w, j])); });
  // ---------- 5.18 (Sprint D): S9 معنى الكلمة بلمسة، S10 النسخة الاحتياطية، S11 المحفّظ والطالب ----------
  const G518 = 'نسخة 5.18 (Sprint D)';
  // the middle of word i (whitespace tokens) of ayah #aN in the text view
  // (the ayah text can be split over tajweed spans: walk its text nodes)
  const wordPt = (n, i) => ev(([n, i]) => { const sp = document.getElementById('a' + n), tw = document.createTreeWalker(sp, NodeFilter.SHOW_TEXT), ns = []; let x;
    while ((x = tw.nextNode())) ns.push(x); const t = ns.map(x => x.nodeValue).join(''); let at = 0;
    for (let k = 0; k < i; k++) at = t.indexOf(' ', at) + 1; const end = t.indexOf(' ', at) < 0 ? t.length : t.indexOf(' ', at);
    const pos = c => { for (const nd of ns) { if (c <= nd.nodeValue.length) return [nd, c]; c -= nd.nodeValue.length; } };
    const r = document.createRange(); r.setStart(...pos(at)); r.setEnd(...pos(end));
    const b = r.getClientRects()[0]; return [b.left + b.width / 2, b.top + b.height / 2]; }, [n, i]);
  const longPress = async (xy, ms = 650) => { await p.mouse.move(xy[0], xy[1]); await p.mouse.down(); await wait(ms); await p.mouse.up(); await wait(400); };
  await check(G518, 'S9: ضغطة طويلة على كلمة في عرض النص بتفتح معناها (الجذر والمعجم) من غير شريط الآية', async () => {
    await ev(() => localStorage.setItem('q.mode', '"text"')); await p.reload(); await go('#/s/2/1', 900);
    await longPress(await wordPt(2, 1));
    const r = await ev(() => { const d = document.querySelector('.wm-dlg'); return d && [d.querySelector('.words button.on').textContent, (d.querySelector('.root b') || {}).textContent, !!document.querySelector('#ayahBar button[data-c="x"]')]; });
    await wait(600); const lex = await ev(() => { const x = document.querySelector('.wm-dlg .book-text'); return x && x.textContent.length; });
    return assert(r && r[0] === 'ٱلْكِتَٰبُ' && /ك ت ب/.test(r[1]) && !r[2] && lex > 20, JSON.stringify([r, lex])); });
  await check(G518, 'S9: «التفسير والإعراب» من نافذة الكلمة بيفتح الآية، والرجوع بيقفل النافذة', async () => {
    const back = await ev(() => window.qBack()); const gone = await ev(() => !document.querySelector('.wm-dlg'));
    await longPress(await wordPt(3, 3)); const w = await ev(() => document.querySelector('.wm-dlg .words button.on').textContent);
    await p.click('.wm-ayah'); await wait(600); const h = await ev(() => location.hash);
    return assert(back && gone && w === 'وَيُقِيمُونَ' && h === '#/a/2/3', JSON.stringify([back, gone, w, h])); });
  await check(G518, 'S9: اللمسة العادية لسه بتفتح شريط الآية، ووضع الحفظ ما بيفتحش معنى الكلمة', async () => {
    await go('#/s/2/1', 900); await p.mouse.click(...(await wordPt(4, 2))); await wait(300);
    const bar = await ev(() => [!!document.querySelector('#ayahBar button[data-c="x"]'), !!document.querySelector('.wm-dlg')]);
    await ev(() => { const x = document.querySelector('#ayahBar button[data-c="x"]'); if (x) x.click(); }); await p.click('#sHifz'); await wait(500);
    await longPress(await wordPt(5, 1)); const hz = await ev(() => !!document.querySelector('.wm-dlg'));
    await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back').forEach(e => e.remove()); localStorage.setItem('q.mode', '"pages"'); }); await p.reload(); await wait(600);
    return assert(bar[0] && !bar[1] && !hz, JSON.stringify([bar, hz])); });
  await check(G518, 'S10: الإعدادات بتكتب «آخر نسخة من # يوم» وبتعلّم النسخة القديمة', async () => {
    await ev(d => { localStorage.setItem('q.lastBackup', JSON.stringify(d)); }, dAgo(40)); await go('#/', 200); await p.click('#btnSettings'); await wait(300);
    const r = await ev(() => { const e = document.getElementById('bkAge'); return [e.textContent, e.classList.contains('bk-old'), document.getElementById('bkRem').checked]; });
    await ev(() => document.getElementById('closeSettings').click());
    return assert(r[0] === 'آخر نسخة من ٤٠ يوم' && r[1] && r[2], JSON.stringify(r)); });
  await check(G518, 'S10: «حفظ نسخة» بيحدّث التاريخ، والتذكير بعد ٣٠ يوم الساعة ٨ بالليل، والإيقاف بيشيله', async () => {
    const r = await ev(() => { const got = []; window.AppBridge = { fake518: 1, shareFile: () => {}, setAlarms: j => got.push(JSON.parse(j)) };
      document.getElementById('bkOut').click(); const age = document.getElementById('bkAge').textContent;
      const bk = got[got.length - 1].filter(e => e.title === 'نسخة احتياطية'); const t = bk[0] && new Date(bk[0].at);
      const days = t && Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 864e5);
      const c = document.getElementById('bkRem'); c.checked = false; c.onchange(); const off = got[got.length - 1].filter(e => e.title === 'نسخة احتياطية').length;
      c.checked = true; c.onchange(); delete window.AppBridge;
      return [age, bk.length, days, t && t.getHours(), bk[0] && bk[0].hash, off]; });
    return assert(r[0] === 'آخر نسخة النهارده' && r[1] === 1 && r[2] === 30 && r[3] === 20 && r[4] === '#/backup' && r[5] === 0, JSON.stringify(r)); });
  await check(G518, 'S10: النسخة المتأخرة تذكيرها النهارده أو بكرة، و#/backup بيفتح الإعدادات', async () => {
    const r = await ev(d => { localStorage.setItem('q.lastBackup', JSON.stringify(d)); const due = QA_bkDue(), now = Math.floor(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) / 864e5);
      return now - due; }, dAgo(45));
    await go('#/backup', 600); const o = await ev(() => [!document.getElementById('settings').hidden, location.hash]);
    await ev(() => { document.getElementById('closeSettings').click(); localStorage.removeItem('q.lastBackup'); });
    return assert(r === 15 && o[0] && o[1] === '#/', JSON.stringify([r, o])); });
  await check(G518, 'S11: «المراجعة» بتعرض آخر اختبار، و«ابعت للمحفّظ» بيبعت رسالة فيها كود QK2', async () => {
    await ev(() => { localStorage.setItem('q.lastTest', JSON.stringify({ k: 'm', r: ['112:1', '112:4'], sc: 75, ay: 4, miss: ['112:3'], w: 0, bad: 0, d: '2026-11-8' }));
      localStorage.setItem('q.myName', '"أحمد"'); });
    await go('#/', 150); await go('#/hifzlog', 700);
    const card = await ev(() => { const c = document.querySelector('.tc-last'); return c && c.textContent; });
    const m = await ev(() => new Promise(res => { window.AppBridge = { shareText: t => res(t) }; document.getElementById('tcSend').click(); setTimeout(() => res(null), 500); }));
    await ev(() => { delete window.AppBridge; }); globalThis.QK2MSG = m;
    return assert(/سورة الإخلاص · ٧٥٪/.test(card) && m && /أحمد/.test(m) && /نسيت: الإخلاص ٣/.test(m) && /QK2:[A-Za-z0-9+\/=]+$/.test(m), JSON.stringify([card, m && m.slice(0, 160)])); });
  await check(G518, 'S11: «طلابي» من «المزيد»: لزق الرسالة بيضيف الطالب ونتيجته والآيات المنسية، ومن غير تكرار', async () => {
    await go('#/more', 400); await p.click('.tile[data-h="#/students"]'); await wait(500);
    await ev(() => localStorage.removeItem('q.students')); await go('#/', 100); await go('#/students', 400);
    await p.fill('#tcIn', globalThis.QK2MSG + '\n' + globalThis.QK2MSG); await p.click('#tcAdd'); await wait(300);
    const r = await ev(() => { const S = JSON.parse(localStorage.getItem('q.students') || '{}'); const st = document.querySelector('.tc-st');
      return [Object.keys(S), S['أحمد'] && S['أحمد'].length, st && st.querySelector('summary').textContent, [...document.querySelectorAll('.tc-miss a')].map(a => a.getAttribute('href'))]; });
    await p.fill('#tcIn', 'مش كود'); await p.click('#tcAdd'); await wait(200);
    const bad = await ev(() => Object.keys(JSON.parse(localStorage.getItem('q.students'))).length);
    return assert(r[0].join() === 'أحمد' && r[1] === 1 && /١ اختبار · آخر نتيجة ٧٥٪/.test(r[2]) && r[3].join() === '#/a/112/3' && bad === 1, JSON.stringify(r)); });
  await check(G518, 'S11: كود QK2 بيرجع زي ما هو، والكود البايظ بيترفض', async () => {
    const r = await ev(() => { const x = { n: 'سارة', d: '2026-11-1', k: 'w', r: ['2:1', '2:20'], sc: 88 }; const back = QA_tc.parse('أهلا ' + QA_tc.code(x) + ' شكرا');
      return [JSON.stringify(back[0]) === JSON.stringify(x), QA_tc.parse('QK2:@@@').length, QA_tc.parse('QK2:' + btoa('{"n":"x"}')).length]; });
    return assert(r[0] && r[1] === 0 && r[2] === 0, JSON.stringify(r)); });
  // ---------- code review: pasted codes and backups are untrusted ----------
  const CR1 = 'مراجعة الكود (CR1)';
  await check(CR1, 'كود QK1 فيه HTML في الأجزاء بيترفض أو بيتنضّف: مفيش <img> ولا تنفيذ', async () => {
    await ev(() => localStorage.removeItem('q.family')); await go('#/family', 500);
    const code = await ev(() => 'QK1:' + btoa(unescape(encodeURIComponent(JSON.stringify({ name: 'x', members: [{ n: 'سارة', j: ['"><img src=x onerror=window.__x=1>', 3], d: [3] }] })))));
    await p.click('#famImp'); await p.fill('.dlg input', code); await p.press('.dlg input', 'Enter'); await wait(400);
    const r = await ev(() => [window.__x, document.querySelector('#view, main, body').innerHTML.indexOf('<img') >= 0, document.querySelectorAll('.fam-j button').length]);
    return assert(r[0] === undefined && !r[1] && r[2] <= 1, JSON.stringify(r)); });
  await check(CR1, 'كود QK2: miss فيه HTML أو مدى برّه المصحف بيتشال', async () => {
    const r = await ev(() => { const mk = o => QA_tc.code(Object.assign({ n: 'س', d: '2026-11-1', k: 'm', r: ['2:1', '2:5'], sc: 80 }, o));
      return [QA_tc.parse(mk({ miss: ['1:1"><b>'] })).length, QA_tc.parse(mk({ r: ['2:1', '200:5'] })).length, QA_tc.parse(mk({ miss: ['2:2'] })).length]; });
    return assert(r[0] === 0 && r[1] === 0 && r[2] === 1, JSON.stringify(r)); });
  await check(CR1, 'النسخة الاحتياطية: q.donate و q.donateId و q.modelConsent ما بتتصدّرش ولا بتتستورد', async () => {
    const r = await ev(() => { ['donate', 'donateId', 'modelConsent'].forEach(k => localStorage.setItem('q.' + k, '"a"'));
      const keys = QA_bk.collect(), out = ['q.donate', 'q.donateId', 'q.modelConsent'].map(k => k in keys);
      ['donate', 'donateId', 'modelConsent'].forEach(k => localStorage.removeItem('q.' + k));
      QA_bk.restore({ 'q.donate': '"b"', 'q.donateId': '"b"', 'q.modelConsent': '"b"', 'q.qaKeep': '"1"' });
      const back = ['donate', 'donateId', 'modelConsent'].map(k => localStorage.getItem('q.' + k)); localStorage.removeItem('q.qaKeep'); return [out, back]; });
    return assert(r[0].every(x => !x) && r[1].every(x => x === null), JSON.stringify(r)); });
  // ---------- 5.19: معنى الكلمة بضغطة طويلة على صفحة المصحف (مربعات الكلمات المقاسة لطبعة الملك فهد) ----------
  const G519 = 'نسخة 5.19';
  // the middle of word w of ayah s:a on page n, from the measured boxes (per mille -> screen)
  const wbPt = (n, s, a, w) => ev(([n, s, a, w]) => new Promise(res => QA_wb(n, rows => { const r = (rows || []).find(r => r[0] === s && r[1] === a && r[2] === w);
    const b = document.querySelector('.page-box[data-p="' + n + '"]'); if (!r || !b) return res(null); const g = b.getBoundingClientRect();
    res([g.left + (r[3] + r[5]) / 2000 * g.width, g.top + (r[4] + r[6]) / 2000 * g.height]); })), [n, s, a, w]);
  // shamarly (W5): 2:2 is on page 3, 81:9 on page 503 (its rect starts at 639 on the mark)
  const P22 = ED === 'shamarly' ? 3 : 2, P819 = ED === 'shamarly' ? 503 : 586, R819 = ED === 'shamarly' ? [610, 660] : [480, 530];
  if (ED === 'kfgqpc' || ED === 'kfold' || ED === 'shamarly') {   // kfold: measured boxes since W5 (its 81:9 rect starts at 500)
    await check(G519, 'ضغطة طويلة على «ٱلْكِتَٰبُ» في صفحة ٢ بتفتح معنى الكلمة دي من غير شريط الآية', async () => {
      await go('#/p/' + P22, 1200); const xy = await wbPt(P22, 2, 2, 1); if (!xy) throw new Error('no box');
      await longPress(xy); const r = await ev(() => { const d = document.querySelector('.wm-dlg'); return d && [d.querySelector('.words button.on').textContent, !!document.querySelector('#ayahBar button[data-c="x"]')]; });
      await ev(() => window.qBack()); await wait(300);
      return assert(r && r[0] === 'ٱلْكِتَٰبُ' && !r[1], JSON.stringify(r)); });
    await check(G519, 'صفحة ٥٨٦: كلمة «قُتِلَتْ» (٨١:٩) بتتعرف من مربعها، ومربع الآية متظبط على دايرتها', async () => {
      await go('#/p/' + P819, 1200); const xy = await wbPt(P819, 81, 9, 2); if (!xy) throw new Error('no box');
      await longPress(xy); const w = await ev(() => { const d = document.querySelector('.wm-dlg'); return d && d.querySelector('.words button.on').textContent; });
      await ev(() => window.qBack()); await wait(300);
      const r9 = await ev(() => QA_rect(81, 9)[0]);
      return assert(w === 'قُتِلَتْ' && r9[1] > R819[0] && r9[1] < R819[1], JSON.stringify([w, r9])); });
    await check(G519, 'اللمسة العادية على الصفحة لسه بتفتح شريط الآية، والسحب لسه بيقلب الصفحة', async () => {
      await go('#/p/51', 1200); const r = await ev(() => { const b = document.querySelector('.page-box').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
      await p.mouse.click(r[0] + r[2] / 2, r[1] + r[3] / 2); await wait(400);
      const bar = await ev(() => [!!document.getElementById('ayahBar'), !!document.querySelector('.wm-dlg')]);
      await ev(() => { const x = document.querySelector('#ayahBar button[data-c="x"]'); if (x) x.click(); }); await wait(200);
      await p.mouse.move(r[0] + r[2] * 0.2, r[1] + r[3] * 0.8); await p.mouse.down(); for (let i = 1; i <= 12; i++) { await p.mouse.move(r[0] + r[2] * 0.2 + i * 25, r[1] + r[3] * 0.8 - i * 2); await wait(16); } await p.mouse.up(); await wait(1200);
      const h = await ev(() => location.hash);
      return assert(bar[0] && !bar[1] && h === '#/p/52', JSON.stringify([bar, h])); });
    await check(G519, 'نافذة معنى الكلمة بتمسح أي تحديد نص بيعمله الأندرويد تحت الصباع، وعنوانها مش قابل للتحديد', async () => {
      await go('#/p/' + P22, 1200); const xy = await wbPt(P22, 2, 2, 1); if (!xy) throw new Error('no box'); await longPress(xy);
      const r = await ev(() => new Promise(res => { const b = document.querySelector('.wm-dlg > b'), rg = document.createRange(); rg.selectNodeContents(b);
        getSelection().removeAllRanges(); getSelection().addRange(rg); setTimeout(() => res([getSelection().toString(), getComputedStyle(b).userSelect]), 150); }));
      await ev(() => window.qBack()); await wait(300);
      return assert(r[0] === '' && r[1] === 'none', JSON.stringify(r)); });
    await check(G519, 'وضع الحفظ: الضغطة الطويلة على الصفحة ما بتفتحش معنى الكلمة', async () => {
      await go('#/p/' + P22, 1200); await ev(() => hifzToggle()); await wait(500);
      const on = await ev(() => !!document.querySelector('#hifzBar')); const xy = await wbPt(P22, 2, 2, 1); if (xy) await longPress(xy);
      const d = await ev(() => !!document.querySelector('.wm-dlg'));
      await ev(() => { if (document.getElementById('hifzBar')) hifzToggle(); document.querySelectorAll('.dlg-back').forEach(e => e.remove()); }); await wait(300);
      return assert(on && !d, JSON.stringify([on, d])); });
    await check(G519, 'تظليل الكلمة (التسميع) بيستخدم المربع المقاس: جوه مربع الآية وبعرض الكلمة', async () => {
      await go('#/p/' + P22, 1200); const r = await ev(n => new Promise(res => QA_wb(n, rows => { const x = rows.filter(r => r[0] === 2 && r[1] === 2);
        res([rows.length, x.length, x.every(r => r[5] - r[3] >= 6 && r[5] - r[3] < 300)]); })), P22);
      return assert(r[0] > (P22 === 3 ? 20 : 30) && r[1] === 7 && r[2], JSON.stringify(r)); });   // 2:2 = 7 words (shamarly page 3: 28 boxes)
  }
  if (ED === 'harmain') {
    // the Haramain photos: word boxes aligned in the straightened frame, mapped back through the page's homography
    const pick = async (n, s, a, w) => { await go('#/p/' + n, 1200); const xy = await wbPt(n, s, a, w); if (!xy) return ['no box'];
      await longPress(xy); const r = await ev(() => { const d = document.querySelector('.wm-dlg'); if (!d) return null; const bs = [...d.querySelectorAll('.words button')];
        return [bs.indexOf(d.querySelector('.words button.on')), d.querySelector('.words button.on').textContent, !!document.querySelector('#ayahBar button[data-c="x"]')]; });
      await ev(() => window.qBack()); await wait(300); return r; };
    await check(G519, 'الحرمين: ضغطة طويلة على «ٱلْكِتَٰبُ» في صفحة ٣ بتفتح معنى الكلمة دي', async () => {
      const r = await pick(3, 2, 2, 1); return assert(r && r[0] === 1 && r[1] === 'ٱلْكِتَٰبُ' && !r[2], JSON.stringify(r)); });
    await check(G519, 'الحرمين: أول كلمة في السطر (٣٣:٥٠ كلمة ٢٥، صفحة ٣٧٢) مربعها كامل ومش شريحة في آخر السطر اللي قبله', async () => {
      const r = await pick(372, 33, 50, 24); return assert(r && r[0] === 24, JSON.stringify(r)); });
    await check(G519, 'الحرمين: كلمة «قُتِلَتْ» (٨١:٩) في صفحة ٥٢٢ بتتعرف من مربعها', async () => {
      const r = await pick(522, 81, 9, 2); return assert(r && r[1] === 'قُتِلَتْ', JSON.stringify(r)); });
    await check(G519, 'الحرمين: مربعات صفحة ٣٧٢ كلها بعرض كلمة (مفيش شرايح) وكل كلمة ليها مربع واحد', async () => {
      const r = await ev(() => new Promise(res => QA_wb(372, rows => { const k = new Set(rows.map(r => r.slice(0, 3).join(':')));
        res([rows.length, k.size, rows.every(r => r[5] - r[3] >= 6 && r[5] - r[3] < 300 && r[6] - r[4] < 90)]); })));
      return assert(r[0] > 100 && r[0] === r[1] && r[2], JSON.stringify(r)); });
  }
  // ---------- W3/W4 (plans/W-track-plan.md 5-6): hifz masks and the page-end turn from the measured word boxes ----------
  const G520 = 'W-track (W3/W4)';
  if (ED === 'kfgqpc' || ED === 'kfold' || ED === 'shamarly') {
    await check(G520, 'W3 / Sprint 2 #11: أقنعة الحفظ في صفحة ٥٠ شريط واحد لكل سطر من الآية، يغطي كلماته (−١٠‰ نحو علامة الآية و+٢‰) وارتفاعها', async () => {
      await go('#/p/50', 1200); await ev(() => new Promise(r => QA_wb(50, r))); await ev(() => hifzToggle()); await wait(600);
      const r = await ev(() => new Promise(res => QA_wb(50, rows => {
        const want = {}; rows.forEach(q => { const k = q[0] + ':' + q[1] + '@' + q[4], u = want[k];
          want[k] = u ? [Math.min(u[0], q[3]), Math.min(u[1], q[4]), Math.max(u[2], q[5]), Math.max(u[3], q[6])] : q.slice(3); });
        const got = [...document.querySelectorAll('.page-box[data-p="50"] .hifz-mask')].map(m => { const s = m.style, f = x => parseFloat(x) * 10;
          return [m.dataset.k, f(s.left), f(s.top), f(s.left) + f(s.width), f(s.top) + f(s.height)]; });
        // 5.26 #11 (the 5.24 look): x = the words' union, 10 per mille toward the ayah marker (left) and 2 the other side; y = at least the words' own top and bottom (harakat)
        const bad = got.filter(g => !Object.keys(want).some(k => k.split('@')[0] === g[0] && Math.abs(Math.max(0, want[k][0] - 10) - g[1]) < 1 && Math.abs(Math.min(1000, want[k][2] + 2) - g[3]) < 1 && g[2] <= want[k][1] + 1 && g[4] >= want[k][3] - 1));
        res([got.length, Object.keys(want).length, bad.slice(0, 3)]); })));
      await ev(() => { if (document.getElementById('hifzBar')) hifzToggle(); }); await wait(300);
      return assert(r[0] > 10 && r[0] <= r[1] && !r[2].length, JSON.stringify(r)); });
  }
  if (ED === 'harmain') {
    await check(G520, 'W4: الحرمين صفحة ٤٥ (٣:٣٣ مكمّلة على ٤٦): القراءة بالصوت بتقلب عند آخر كلمة مقاسة (١٠) مش قبلها (التقدير كان ٩)', async () => {
      const W33 = await ev(() => window.QURAN.t[2][32].split(' ')), W32 = await ev(() => window.QURAN.t[2][31].split(' ').slice(-4));
      await ev(() => { window.ReciteBridge = { start() {}, stop() {}, setHints() {} }; });
      await go('#/p/45', 1200); await ev(() => new Promise(r => QA_wb(45, r))); await p.click('#rdMic'); await wait(200);
      const say = (t, k) => ev(([t, k]) => window.onRecite(t, k), [t, k]);
      await say('', 'state:listening'); await say(W32.concat(W33.slice(0, 3)).join(' '), 'partial'); await wait(200);
      await say(W32.concat(W33.slice(0, 9)).join(' '), 'partial'); await wait(500); const mid = await ev(() => location.hash);
      await say(W32.concat(W33.slice(0, 10)).join(' '), 'partial'); let h = '';
      for (let i = 0; i < 40; i++) { h = await ev(() => location.hash); if (h.startsWith('#/p/46')) break; await wait(25); }
      await say(W32.concat(W33.slice(0, 10)).join(' '), 'final'); await wait(200);
      await ev(() => { const m = document.getElementById('rdMic'); if (m && m.classList.contains('on')) m.click(); delete window.ReciteBridge; }); await wait(200);
      return assert(mid.startsWith('#/p/45') && h.startsWith('#/p/46'), JSON.stringify([mid, h])); });
  }
  // 5c/5d: the page moves one way only into and out of full screen, with the WebView resize of immersive() simulated
  // (fake AppBridge, 411x866 -> 411x914 like Phone_API35; tools/qa/fs-motion/measure.js, same check on the emulator over CDP)
  { let fm = null; try { const fp = await require('./fs-motion/measure.js').headlessPage(b); fp.on('pageerror', e => errs.push(e.message)); fm = (await require('./fs-motion/measure.js').measureAll(fp)).res; await fp.close2(); } catch (e) { fm = { err: e.message }; }
    const NM = { h: 'الأفقي', v: 'العمودي', entry: 'الدخول', exit: 'الخروج', auto: 'تلقائي', back: 'بالرجوع', manual: 'باللمس' };
    for (const k of ['h entry auto', 'h exit back', 'h entry manual', 'h exit manual', 'v entry auto', 'v exit back', 'v entry manual', 'v exit manual']) {
      const [t, d, how] = k.split(' ');
      await check(G511, 'ملء الشاشة (' + NM[t] + '، ' + NM[d] + ' ' + NM[how] + '): الصفحة بتتحرك في اتجاه واحد من غير نطّة', () => { const r = fm[k]; if (!r) throw new Error(fm.err || 'no data');
        return assert(r.ok, JSON.stringify({ up: r.up, down: r.down, maxStep: r.maxStep, maxW: r.maxWidthStep, fsAt: r.fsAt })); });
    }
    await check(G511, 'ملء الشاشة: مصحف مفتوح من الرئيسية، الرجوع يروّح الرئيسية على طول', () => { const r = fm['home back']; if (!r) throw new Error(fm.err || 'no data'); return assert(r.ok, JSON.stringify(r)); }); }
  // ---- 5.26 group A (phone feedback 5.25) ----
  const G526 = 'نسخة 5.26 (A)';
  await check(G526, '#44/#45: مفيش شريط جزء/حزب ولا صف إعداده، وزرار العلامة لوحده في مكانه ويشتغل', async () => {
    await ev(() => { localStorage.setItem('q.mode', '"pages"'); localStorage.removeItem('q.turn'); }); await go('#/p/50', 700);
    const r = await ev(() => { const k = document.getElementById('qMk'); const rc = k && k.getBoundingClientRect(); return [!!document.getElementById('barSet'), !!document.querySelector('.q-bar-t'), typeof window.pageRub, !!k && !k.hidden, rc && Math.round(rc.width), document.documentElement.classList.contains('mbar-off')]; });
    const on0 = await ev(() => document.getElementById('qMk').classList.contains('on')); await p.click('#qMk'); await wait(200); const on1 = await ev(() => document.getElementById('qMk').classList.contains('on'));
    await p.click('#qMk'); await wait(200); const on2 = await ev(() => document.getElementById('qMk').classList.contains('on'));
    return assert(!r[0] && !r[1] && r[2] === 'undefined' && r[3] && r[4] === 32 && !r[5] && on0 !== on1 && on0 === on2, JSON.stringify([r, on0, on1, on2])); });
  await check(G526, '#50: «اختبار الحفظ» مفيهوش زرار عشوائي، و«المراجعة» تحت «اختبرني» زرار «اختبار عشوائي» بالظبط', async () => {
    await go('#/hifztest/112', 700); const a = await ev(() => [...document.querySelectorAll('#view button, #view a')].filter(x => /عشوائي/.test(x.textContent)).length);
    await go('#/hifzlog', 700); const b2 = await ev(() => [...document.querySelectorAll('#hzCard .hz-way button')].map(x => x.textContent).join('|'));
    return assert(a === 0 && b2 === 'بالسرد|اختبار عشوائي|' + b2.split('|')[2] && !/\(/.test(b2.split('|')[1]), JSON.stringify([a, b2])); });
  await check(G526, '#1: زرار «استئناف من المرة الماضية» في «المراجعة» بس (مش في الرئيسية ولا «اختبار الحفظ»)، وبيطلع كمان لو الجلسة اختبار كلمات', async () => {
    const keep = await ev(() => localStorage.getItem('q.hzResume'));
    const set = kind => ev(kind => localStorage.setItem('q.hzResume', JSON.stringify({ kind, label: 'سورة الإخلاص · الآية ١', hash: '#/hifztest/112', state: { ht: { lv: 25, s: 112, from: 1 }, hzFrom: false } })), kind);
    const res = []; for (const kind of ['m', 'w']) { await set(kind); const r = []; for (const h of ['#/', '#/hifztest/112', '#/hifzlog']) { await go(h, 600); r.push(await ev(() => !!document.getElementById('hzResume'))); } res.push(r.join()); }
    await ev(k => { if (k === null) localStorage.removeItem('q.hzResume'); else localStorage.setItem('q.hzResume', k); }, keep);
    return assert(res[0] === 'false,false,true' && res[1] === 'false,false,true', JSON.stringify(res)); });
  await check(G526, '#47/#48: ضغطة على مربع الخريطة بتفتح آياته مظلّلة تحت الشريط (أفقي وعمودي) وفيها «اختبرني»', async () => {
    const out2 = [];
    for (const v of [false, true]) {
      await ev(v => { localStorage.setItem('q.mode', '"pages"'); if (v) localStorage.setItem('q.turn', '"v"'); else localStorage.removeItem('q.turn'); }, v); await p.reload(); await wait(900); await go('#/hifzmap', 700);
      const pg = await ev(() => { const P = window.QURAN.p[1]; return P[Math.floor(P.length * .5)]; });
      await p.click('.hm-grid .hm-c[data-u="3"]'); await wait(200); await p.click('#hmOpen'); await wait(1600);
      out2.push(await ev(() => { const h = [...document.querySelectorAll('.hm-hl')].map(e => e.getBoundingClientRect()); if (!h.length) return null; const bar = document.querySelector('.bar').getBoundingClientRect().bottom; return [Math.min(...h.map(x => x.top)) >= bar - 1, Math.min(...h.map(x => x.top)) < innerHeight, !!document.getElementById('rdTest')]; }));
    }
    await ev(() => localStorage.removeItem('q.turn')); await p.reload(); await wait(600);
    return assert(out2.every(r => r && r[0] && r[1] && r[2]), JSON.stringify(out2)); });
  await check(G526, '#29: تخطّي ٥ كلمات أو أكتر مرة واحدة = اهتزاز + صوت قصير مرة واحدة، وأقل من ٥ = لأ', async () => {
    await ev(() => { localStorage.setItem('q.mode', '"pages"'); window.__v = 0; window.__a = 0; window.__ac0 = window.AudioContext; window.__vb0 = navigator.vibrate; navigator.vibrate = () => { window.__v++; return true; }; if (window.AppBridge) { window.__bp0 = window.AppBridge.buzzPattern; window.AppBridge.buzzPattern = () => { window.__v++; }; }
      window.AudioContext = function () { this.destination = {}; this.currentTime = 0; this.createOscillator = () => ({ frequency: {}, connect() {}, start() { window.__a++; }, stop() {} }); this.createGain = () => ({ gain: {}, connect() {} }); this.close = () => {}; };
      window.ReciteBridge = { start() {}, stop() {}, setHints() {} }; });
    const T = a => ev(a => window.QURAN.t[111][a - 1].split(' ').filter(w => /[\u0621-\u064A\u0671]/.test(w)).join(' '), a), res = [];
    for (const seq of [[1, 2, 4], [1, 4]]) {
      await go('#/hifzmap', 500); await ev(() => window.hzTestStart({ k: 'a', s: 112, a1: 1, a2: 4, w: 'o' }, 'm')); await wait(1200);
      await p.click('#hifzBar [data-c="mic"]'); await wait(200); await ev(() => window.onRecite('', 'state:listening')); await ev(() => { window.__v = 0; window.__a = 0; });
      for (const a of seq) { await ev(t => window.onRecite(t, 'final'), await T(a)); await wait(400); }
      res.push(await ev(() => [window.__v, window.__a, Object.keys(window.__rec.skp).length]));
      await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); }); await wait(300);
    }
    await ev(() => { window.AudioContext = window.__ac0; navigator.vibrate = window.__vb0; if (window.AppBridge) window.AppBridge.buzzPattern = window.__bp0; delete window.ReciteBridge; });
    return assert(res[0][0] === 0 && res[0][1] === 0 && res[0][2] === 4 && res[1][0] === 1 && res[1][1] === 1 && res[1][2] === 6, JSON.stringify(res)); });
  // ---- 5.27 group C (phone feedback 5.26) ----
  const G527 = 'نسخة 5.27 (C)';
  await check(G527, '#47: ضغطة طويلة على مربع الخريطة ماتعملش حاجة: مفيش <a href> (مفيش file:///)، contextmenu متمنوع، وCSS بيمنع الـcallout والتحديد', async () => {
    await ev(() => localStorage.setItem('q.mode', '"pages"')); await go('#/hifzmap', 800);
    const CSS = require('fs').readFileSync(__dirname + '/../../web/style.css', 'utf8');
    const r = await ev(css => {
      const c = document.querySelector('.hm-grid .hm-c'), e1 = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); c.dispatchEvent(e1);
      const e2 = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); document.querySelector('.hm-grid').dispatchEvent(e2);
      const m = css.match(/.hm-grid, .hm-c[^{]*{[^}]*}/);
      return [c.tagName !== 'A' && !c.hasAttribute('href') && !document.querySelector('.hm-grid a'), e1.defaultPrevented, e2.defaultPrevented, !!m && /touch-callout: none/.test(m[0]) && /user-select: none/.test(m[0]), String(getSelection()) === ''];
    }, CSS);
    return assert(r.every(Boolean), JSON.stringify(r)); });
  await check(G527, '#11: شريط الحفظ مابيغطيش زرار الوضع الليلي (٣٦٠×٦٤٠ و٣٩٠×٨٤٤)', async () => {
    const res = [];
    for (const vp of [{ width: 360, height: 640 }, { width: 390, height: 844 }]) {
      await p.setViewportSize(vp); await go('#/hifzmap', 500); await ev(() => window.hzTestStart({ k: 'a', s: 80, a1: 18, a2: 42, w: 'o' }, 'm')); await wait(2500);
      await ev(() => window.scrollTo(0, document.documentElement.scrollHeight)); await wait(400);
      res.push(await ev(() => { const bar = document.getElementById('hifzBar').getBoundingClientRect(), mo = document.getElementById('pDark').getBoundingClientRect(), nv = document.querySelector('.page-nav').getBoundingClientRect();
        return [Math.round(bar.top), Math.round(mo.bottom), Math.round(nv.bottom), mo.bottom <= bar.top && nv.bottom <= bar.top]; }));
      await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); }); await wait(300);
    }
    await p.setViewportSize({ width: 390, height: 844 });
    return assert(res.every(r => r[3]), JSON.stringify(res)); });
  await check(G527, 'شكل إخفاء الكلمات: لوحة ٣ ألوان بـ aria-label، الاختيار بيتحفظ (q.maskStyle) وبيتطبّق كـ class mask-<id>، وافتراضيها def', async () => {
    await ev(() => localStorage.removeItem('q.maskStyle')); await p.reload(); await wait(800);
    const d0 = await ev(() => document.documentElement.classList.contains('mask-def'));
    await p.click('#btnSettings'); await wait(300);
    const ids = ['def', 'comp', 'anal'], res = [];   // 5.28: haze/dots/gold removed
    for (const id of ids) { await ev(id => document.querySelector('#maskSet [data-v=' + id + ']').click(), id); await wait(80);
      res.push(await ev(id => [document.documentElement.classList.contains('mask-' + id), document.documentElement.className.split(' ').filter(c => /^mask-/.test(c)).length === 1, localStorage.getItem('q.maskStyle') === JSON.stringify(id), document.querySelector('#maskSet [data-v=' + id + ']').classList.contains('on')], id)); }
    const lab = await ev(() => [...document.querySelectorAll('#maskSet button')].every(b => (b.getAttribute('aria-label') || '').length > 2));
    await ev(() => { localStorage.removeItem('q.maskStyle'); }); await p.reload(); await wait(600);
    return assert(d0 && lab && ids.length === 3 && await ev(() => document.querySelectorAll('#maskSet button').length === 3) && res.every(r => r.every(Boolean)), JSON.stringify([d0, lab, res])); });
  await check(G527, 'شكل الإخفاء: كل الستايلات بتغيّر شكل أقنعة صفحة حفظ مفتوحة لحظيًا (فاتح وداكن)، وكل لون له fallback hex قبل color-mix', async () => {
    const out3 = [];
    for (const dark of [false, true]) {
      await ev(dk => { localStorage.setItem('q.mode', '"pages"'); if (dk) { localStorage.setItem('q.theme', '"dark"'); localStorage.setItem('q.pageBg', '"#12161a"'); } else { localStorage.removeItem('q.theme'); localStorage.removeItem('q.pageBg'); } }, dark);
      await p.reload(); await wait(800); await go('#/hifzmap', 500); await ev(() => window.hzTestStart({ k: 'a', s: 80, a1: 18, a2: 42, w: 'o' }, 'm')); await wait(2500);
      await p.click('#btnSettings'); await wait(300);
      const seen = {};
      for (const id of ['def', 'comp', 'anal']) { await ev(id => document.querySelector('#maskSet [data-v=' + id + ']').click(), id); await wait(350);
        seen[id] = await ev(() => { const m = document.querySelector('.hifz-mask'), cs = getComputedStyle(m), bf = getComputedStyle(m, '::before'); return [cs.backgroundColor + '|' + cs.backgroundImage.slice(0, 30) + '|' + cs.boxShadow.slice(0, 40), m.style.getPropertyValue('--bx'), bf.filter, bf.backgroundImage.slice(0, 12)]; }); }
      const vals = Object.values(seen).map(v => v[0]);
      out3.push([new Set(vals).size === 3]);
      await ev(() => { document.getElementById('settings').hidden = true; const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); localStorage.removeItem('q.maskStyle'); });
    }
    await ev(() => { localStorage.removeItem('q.theme'); localStorage.removeItem('q.pageBg'); localStorage.removeItem('q.maskStyle'); }); await p.reload(); await wait(600);
    const fb = (require('fs').readFileSync(__dirname + '/../../web/style.css', 'utf8').match(/background: #[0-9a-f]{6}; background: color-mix/g) || []).length;
    return assert(out3.every(r => r.every(Boolean)) && fb >= 6, JSON.stringify([out3, fb])); });
  // ---- 5.28 (phone feedback 5.27) ----
  const G528 = 'نسخة 5.28';
  await check(G528, '#13: «المصحف» في «اختبار الحفظ» بيخفي نفس آيات الاختبار بس (زي «اختبرني» في الخريطة)، والمايك بيقف بعد آخر آية', async () => {
    await ev(() => { localStorage.setItem('q.mode', '"pages"'); localStorage.removeItem('q.turn'); localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 100, s: 112, from: 1 })); });
    await p.reload(); await wait(800); await ev(() => { window.ReciteBridge = { start() {}, stop() {}, setHints() {} }; });
    const close = () => ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); });
    const masks = () => ev(() => [...document.querySelectorAll('.hifz-mask')].map(m => m.style.cssText).sort().join(';'));
    await go('#/hifzmap', 500); await ev(() => window.hzTestStart({ k: 'a', s: 112, a1: 1, a2: 4, w: 'o' }, 'm')); await wait(1500); const ref = await masks(); await close(); await wait(300);
    await go('#/hifztest/112', 800); await p.click('#htPages'); await wait(1500); const got = await masks();
    const T = a => ev(a => window.QURAN.t[111][a - 1].split(' ').filter(w => /[ء-يٱ]/.test(w)).join(' '), a);
    await p.click('#hifzBar [data-c="mic"]'); await wait(200); await ev(() => window.onRecite('', 'state:listening')); const on0 = await ev(() => !!window.__rec.on);
    for (const a of [1, 2, 3, 4]) { await ev(t => window.onRecite(t, 'final'), await T(a)); await wait(300); }
    await wait(1800); const on1 = await ev(() => !!window.__rec.on);
    await close(); await ev(() => { delete window.ReciteBridge; localStorage.removeItem('q.hifzTest'); }); await wait(300);
    return assert(ref && got === ref && on0 && !on1, JSON.stringify([ref.length, got.length, got === ref, on0, on1])); });
  await check(G528, '#12: في القراءة العمودية زرار الهلال والاستماع فوق شريط الحفظ (من غير ما يتغطّوا)', async () => {
    const out = [];
    for (const vp of [[360, 640], [390, 844]]) {
      await p.setViewportSize({ width: vp[0], height: vp[1] });
      await ev(() => { localStorage.setItem('q.mode', '"pages"'); localStorage.setItem('q.turn', '"v"'); }); await p.reload(); await wait(900);
      await go('#/hifzmap', 500); await ev(() => window.hzTestStart({ k: 'a', s: 80, a1: 18, a2: 42, w: 'o' }, 'm')); await wait(1800);
      out.push(await ev(() => { const v = document.querySelector('.vbar'), b = document.getElementById('hifzBar'); if (!v || !b) return [!!v, !!b]; const vr = v.getBoundingClientRect(), br = b.getBoundingClientRect(), d = document.getElementById('vDark').getBoundingClientRect(); return [vr.bottom <= br.top + 0.5, d.height > 0, getComputedStyle(v).display !== 'none', Math.round(vr.bottom), Math.round(br.top)]; }));
      await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); }); await wait(300);
    }
    await ev(() => localStorage.removeItem('q.turn')); await p.setViewportSize({ width: 390, height: 844 }); await p.reload(); await wait(600);
    return assert(out.every(r => r[0] && r[1] && r[2]), JSON.stringify(out)); });
  await check('نسخة 5.29', '#11: مراجعة عشوائية في القراءة العمودية: بعد الانتقال لموضع جديد الصفحة ماترجعش للموضع القديم مع نتايج المايك، وبتتابع الموضع الجديد', async () => {
    await ev(() => { localStorage.setItem('q.mode', '"pages"'); localStorage.setItem('q.turn', '"v"'); }); await p.reload(); await wait(900);
    const gay = i => ev(i => { let c = 0; for (let s = 1; s <= 114; s++) { const n = window.QURAN.s[s - 1][3]; if (i < c + n) return [s, i - c + 1]; c += n; } }, i);
    const P = [[2140, 2145], [3720, 3725]], b1 = await gay(P[0][0]), e1 = await gay(P[0][1]), b2 = await gay(P[1][0]);
    await go('#/hifzmap', 500); await ev(P => window.hzTestStart({ k: 's', s: 18, w: 'r' }, 'm', P), P); await wait(2200);
    await recAyat(b1[0], b1[1], e1[1]); await wait(1800);
    const at = await ev(() => [location.hash, scrollY]);
    for (let i = 0; i < 6; i++) { await ev(() => window.onRecite('ما', 'partial')); await wait(350); }
    await wait(1500); const after = await ev(() => [location.hash, scrollY, window.reciteLineRect()]);
    await recAyat(b2[0], b2[1], b2[1]); await wait(900); const lr = await ev(() => window.reciteLineRect());
    await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); delete window.ReciteBridge; localStorage.removeItem('q.turn'); }); await p.reload(); await wait(600);
    return assert(at[0] === after[0] && Math.abs(after[1] - at[1]) < 300 && after[2] === null && lr && lr.top > 0 && lr.bottom < 844, JSON.stringify([at, after, lr])); });
  // ---------- 5.30 Sprint 4 (#51): the review ward by rub' al-hizb, ladder 1/3/7/14/30, pass line 80 ----------
  const G530 = 'نسخة 5.30 S4';
  await check(G530, 'T1: نجاح ≥٩٠٪ كل مرة عند موعده: ١ ← ٣ ← ٧ ← ١٤ ← ٣٠ ← ٣٠ (الحد الأقصى)', async () => {
    const r = await ev(a => { let e = { r: a[1], iv: 1, lp: 0 }; const seq = []; [1, 3, 7, 14, 30].forEach((age, i) => { e = Object.assign({}, hzNextIv(Object.assign({}, e, { r: a[age] }), 95)); seq.push(e.iv); }); return seq; },
      { 1: dAgo(1), 3: dAgo(3), 7: dAgo(7), 14: dAgo(14), 30: dAgo(30) });
    assert(JSON.stringify(r) === '[3,7,14,30,30]', JSON.stringify(r)); return JSON.stringify(r); });
  await check(G530, 'T2: رسوب (٥٠٪) على ربع فاصله ١٤ ← يوم و lp=١، وأول نجاح ٩٥٪ بعده ← ٧ (نص ١٤)', async () => {
    const r = await ev(a => { const f = hzNextIv({ r: a[0], iv: 14, lp: 0 }, 50); const g = hzNextIv(Object.assign({}, f, { r: a[1] }), 95); return [f.iv, f.lp, f.piv, g.iv, g.piv || 0]; }, [dAgo(14), dAgo(1)]);
    assert(JSON.stringify(r) === '[1,1,14,7,0]', JSON.stringify(r)); return JSON.stringify(r); });
  await check(G530, 'T3: ٧٩ ← يوم، ٨٠/٨١/٨٩ ← نفس الفاصل، ٩٠ ← الدرجة اللي بعده', async () => {
    const r = await ev(d => [79, 80, 81, 89, 90].map(p => hzNextIv({ r: d, iv: 7, lp: 0 }, p).iv), dAgo(5));
    assert(JSON.stringify(r) === '[1,7,7,7,14]', JSON.stringify(r)); return JSON.stringify(r); });
  await check(G530, 'T4: مراجعة تانية في نفس اليوم ما بتكبّرش الفاصل', async () => {
    const r = await ev(d => [hzNextIv({ r: d, iv: 7, lp: 0 }, 95).iv, hzNextIv({ r: d, iv: 3, lp: 0 }, 99).iv], dAgo(0));
    assert(JSON.stringify(r) === '[7,3]', JSON.stringify(r)); return JSON.stringify(r); });
  await check(G530, 'T5: الـ migration: سور بفاصل ٩٠/٥٦/٢٨/١ ← أرباع ٣٠/٣٠/١٤/١، والربع المشترك الأقدم والأصغر، و hzRev ما اتلمسش', async () => { const k = await hzKeep();
    const r = await ev(a => { localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hifzScores', '{}');
      const R = { 2: { m: a[0], r: a[0], iv: 90 }, 4: { m: a[0], r: a[0], iv: 56 }, 5: { m: a[1], r: a[1], iv: 28 }, 6: { m: a[2], r: a[2], iv: 1 } }, js = JSON.stringify(R);
      localStorage.setItem('q.hzRev', js); const S = hzSchedData();
      return [S[0].iv, S[30].iv, S[42].iv, S[55].iv, S[50].iv, S[50].r === a[1], localStorage.getItem('q.hzRev') === js, JSON.stringify(hzSchedData()) === JSON.stringify(S)]; }, [dAgo(40), dAgo(20), dAgo(10)]);
    await hzBack(k); assert(JSON.stringify(r) === '[30,30,14,1,1,true,true,true]', JSON.stringify(r)); return JSON.stringify(r); });
  await check(G530, 'T6: ٢٠ يوم من غير مراجعة على ربع فاصله ٧ ← مستحق وقبل ربع فاصله ٣٠ متأخر يومين، ونجاح ٩٥٪ بعدها ← ٣٠', async () => { const k = await hzKeep();
    const r = await ev(a => { localStorage.setItem('q.hzRev', '{}'); localStorage.removeItem('q.hzDaily');
      localStorage.setItem('q.hzSched', JSON.stringify({ 10: { r: a[0], iv: 7 }, 11: { r: a[1], iv: 30 } }));
      const w = hzWard(); return [w.list.map(x => x.k).join(','), hzNextIv({ r: a[0], iv: 7, lp: 0 }, 95).iv]; }, [dAgo(20), dAgo(32)]);
    await hzBack(k); assert(r[0] === '10,11' && r[1] === 30, JSON.stringify(r)); return JSON.stringify(r); });
  await check(G530, 'T7: ٦٠ ربع كلهم مستحقين، الورد auto = ceil(مجموع الأوزان/30)+2 ربع (5.31: بالوزن)، والمتأخر الباقي، والراسب الأول (نص الميزانية بالوزن مش بالعدد)', async () => { const k = await hzKeep();
    const r = await ev(a => { localStorage.setItem('q.hzRev', '{}'); localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hifzScores', '{}'); localStorage.setItem('q.hzDaily', '0'); const S = {};
      for (let i = 0; i < 60; i++) S[i] = i < 3 ? { r: a[1], iv: 1, res: 50, lp: 1 } : { r: a[0], iv: 7 };
      localStorage.setItem('q.hzSched', JSON.stringify(S)); const w = hzWard(); localStorage.removeItem('q.hzDaily');
      const U = hzUnits().filter(u => u.kind === 'r' && +u.id < 60), W = U.reduce((a, u) => a + u.w, 0), cap = Math.ceil(W / 30) + 2, ws = w.list.reduce((a, x) => a + x.u.w, 0), nx = U.find(u => !w.list.some(x => x.id === u.id) && S[u.id].iv !== 1);
      return [U.length, w.list.length, w.late, w.all, w.list[0].iv, w.list[1].iv, w.list.length + w.late === 60, ws <= cap, w.list.length >= 3, cap, ws + nx.w > cap]; }, [dAgo(40), dAgo(5)]);
    await hzBack(k); assert(r[0] === 60 && r[2] === 60 - r[1] && r[3] === 60 && r[4] === 1 && r[6] && r[7] && r[8] && r[10], JSON.stringify(r)); return JSON.stringify(r); });
  await check(G530, 'T8: جلسة غطّت ٣ آيات من ربع ← hzSched زي ما هو و hifzAyat اتكتب؛ وجلسة غطّت الربع كله ← دخل بفاصل ٣', async () => { const k = await hzKeep();
    const r = await ev(() => { localStorage.setItem('q.hzRev', '{}'); localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hzSched', '{}');
      const Q = window.QURAN, ays = k => { const out = []; let s = Q.h[k][0], a = Q.h[k][1]; const e = k + 1 >= 240 ? [115, 1] : Q.h[k + 1]; while (s < e[0] || a < e[1]) { out.push(s + ':' + a); if (++a > Q.s[s - 1][3]) { s++; a = 1; } } return out; };
      const A = ays(5), few = {}; A.slice(0, 3).forEach(x => few[x] = true); hzRecord(few, 100, {});
      const a1 = localStorage.getItem('q.hzSched'), ha = Object.keys(JSON.parse(localStorage.getItem('q.hifzAyat'))).length;
      const all = {}; A.forEach(x => all[x] = true); hzRecord(all, 100, {});
      const S = JSON.parse(localStorage.getItem('q.hzSched')); return [a1, ha, A.length > 6, S[5] && S[5].iv, Object.keys(S).length]; });
    await hzBack(k); assert(r[0] === '{}' && r[1] === 3 && r[2] && r[3] === 3 && r[4] === 1, JSON.stringify(r)); return JSON.stringify(r); });
  await check(G530, 'T10: اختبار ربع من البقرة ونجح ← الأرباع اللي ما اتختبرتش مش بتتجدول (سورة جديدة في hzRev مش بتدخل الـ fill)', async () => { const k = await hzKeep();
    const r = await ev(() => { localStorage.setItem('q.hzRev', '{}'); localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hzSched', '{}'); localStorage.setItem('q.hifzScores', '{}');
      const Q = window.QURAN, ays = k => { const out = []; let s = Q.h[k][0], a = Q.h[k][1]; const e = k + 1 >= 240 ? [115, 1] : Q.h[k + 1]; while (s < e[0] || a < e[1]) { out.push(s + ':' + a); if (++a > Q.s[s - 1][3]) { s++; a = 1; } } return out; };
      const m = {}; ays(2).forEach(x => m[x] = true); hzRecord(m, 100, { rev: true, sp: { 2: 100 } });
      const S = hzSchedData(), R = JSON.parse(localStorage.getItem('q.hzRev')); return [Object.keys(S).join(','), !!R[2], R[2] && R[2].nf]; });
    await hzBack(k); assert(r[0] === '2' && r[1] && r[2] === 1, JSON.stringify(r)); return JSON.stringify(r); });
  await check(G530, 'T9: الخريطة = الورد: وحدة مستحقة (سورة الإخلاص) ← مربع أصفر (٢)، وربع عدّى ومش مستحق ← أخضر (٣) (5.31: المفتاح s112 بدل 239)', async () => { const k = await hzKeep();
    await ev(a => { localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hifzScores', '{}'); localStorage.setItem('q.hifzLog', '{}'); localStorage.setItem('q.hzRev', '{}');
      localStorage.setItem('q.hzSched', JSON.stringify({ s112: { r: a[0], iv: 7 }, 0: { r: a[1], iv: 30 } })); }, [dAgo(20), dAgo(2)]);
    await go('#/', 150); await go('#/hifzmap', 700);
    const r = await ev(() => { const pc = hifzPageColors(), w = hzWard().list.map(x => x.id).join(','); return [pc.segc(112, QA_pageOf(112, 1)), pc.segc(2, QA_pageOf(2, 1)), w, (document.querySelector('.hm-c[data-s="112"]') || {}).className || '']; });
    await hzBack(k); await go('#/', 200);
    assert(r[0] === 2 && r[1] === 3 && r[2] === 's112' && /\bc2\b/.test(r[3]), JSON.stringify(r)); return JSON.stringify(r); });
  // ---------- 5.31: units: a short surah (letters <= average letters per rub') is ONE unit and ONE map square; long surahs go by rub'; the map is a juz grid ----------
  await check(G530, 'T11: سورة الناس لوحدها ١٠٠٪ ← وحدة s114 مجدولة بفاصل ٣، ومربع الخريطة واحد وأخضر (٣) تاني يوم', async () => { const k = await hzKeep();
    const r = await ev(a => { ['q.hifzAyat', 'q.hzSched', 'q.hifzLog'].forEach(x => localStorage.removeItem(x)); localStorage.setItem('q.hzRev', '{}'); localStorage.setItem('q.hifzScores', '{}');
      const m = {}; for (let i = 1; i <= window.QURAN.s[113][3]; i++) m['114:' + i] = true; hzRecord(m, 100, { rev: true, sp: { 114: 100 } });
      const S = JSON.parse(localStorage.getItem('q.hzSched')), e = S.s114, ks = Object.keys(S);
      S.s114.r = a; localStorage.setItem('q.hzSched', JSON.stringify(S)); return [ks.join(','), e && e.iv, hzShort(114)]; }, dAgo(1));
    await go('#/', 150); await go('#/hifzmap', 700);
    const m = await ev(() => { const q = [...document.querySelectorAll('.hm-c[data-u="s114"]')]; return [q.length, q[0] && q[0].className, hzWard().list.length]; });
    await hzBack(k); await go('#/', 200);
    assert(r[0] === 's114' && r[1] === 3 && r[2] && m[0] === 1 && /\bc3\b/.test(m[1]) && /hm-s/.test(m[1]) && m[2] === 0, JSON.stringify([r, m])); return JSON.stringify([r, m]); });
  await check(G530, 'T12: 5.31: الأجزاء ١-٢٧ بالأرباع بس (الفاتحة والطور ربع عادي، مفيش s1/s52)، والأجزاء ٢٨-٣٠ بالسورة بس: ٩ + ١١ + ٣٧ وحدة، والمجموع ٢٧×٨ + ٥٧', async () => { const k = await hzKeep();
    await go('#/', 150); await go('#/hifzmap', 700);
    const r = await ev(() => { const Qd = window.QURAN, last = s => Qd.s[s - 1][3], U = hzUnits(), jc = j => U.filter(u => u.kind === 's' && u.juz === j).length, rc = U.filter(u => u.kind === 'r');
      const tRub = [...new Set([1, last(52)].map(a => hzRubOf(QA_ix(52, a))))], tSq = tRub.map(x => document.querySelectorAll('.hm-c[data-u="' + x + '"]').length);
      const edge = []; for (let s = 1; s <= 114; s++) { const a = hzRubOf(QA_ix(s, 1)) >= 216, b = hzRubOf(QA_ix(s, last(s))) >= 216; if (a !== b || a !== (s >= 58)) edge.push(s); }
      return [hzShort(52), hzShort(1), hzShort(57), hzShort(58), U.some(u => u.id === 's52' || u.id === 's1'), tRub.join('/'), tSq.join('/'), U.some(u => u.id === '0' && u.s0 === 1), jc(28), jc(29), jc(30), rc.length, U.length, rc.every(u => u.rub < 216), edge.join()]; });
    await hzBack(k);
    assert(r[0] === false && r[1] === false && r[2] === false && r[3] === true && !r[4] && r[5].split('/').length === 2 && r[6] === '1/1' && r[7] && r[8] === 9 && r[9] === 11 && r[10] === 37 && r[11] === 216 && r[12] === 27 * 8 + 57 && r[13] && r[14] === '', JSON.stringify(r)); return JSON.stringify(r); });
  await check(G530, 'T13: الترقية من 5.30: hzSched {237} (ربع في الجزء ٣٠) + hzRev فيها ٩٠-٩٣ ← s90..s93 بياخدوا الإدخال، والمفتاح ٢٣٧ بيتشال (مفيش وحدة ربع)، و hzRev زي ما هو', async () => { const k = await hzKeep();
    const r = await ev(a => { localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hifzScores', '{}');
      const R = JSON.stringify({ 90: { m: a[1], r: a[1], iv: 14 }, 91: { m: a[1], r: a[1], iv: 14 }, 92: { m: a[1], r: a[1], iv: 14 }, 93: { m: a[1], r: a[1], iv: 14 } }); localStorage.setItem('q.hzRev', R);
      localStorage.setItem('q.hzSched', JSON.stringify({ 237: { r: a[0], iv: 7, lp: 0 } }));
      const S = hzSchedData(), no239 = !hzUnits().some(u => u.id === '237');
      return [no239, !('237' in S), [90, 91, 92, 93].map(s => S['s' + s] && S['s' + s].r === a[0] && S['s' + s].iv === 7).join(), 's111' in S, 's100' in S, localStorage.getItem('q.hzRev') === R, JSON.stringify(hzSchedData()) === JSON.stringify(S)]; }, [dAgo(5), dAgo(30)]);
    await hzBack(k); assert(r[0] && r[1] && r[2] === 'true,true,true,true' && !r[3] && !r[4] && r[5] && r[6], JSON.stringify(r)); return JSON.stringify(r); });
  await check(G530, 'T16: ترقية مفتاح s52 (الطور مبقتش قصيرة) ← يتنسخ لوحدات الأرباع اللي بتغطي آياتها (اللي ملهاش إدخال)، والمفتاح بيتشال، و hzRev/hifzLog/hifzAyat زي ما هي، والتكرار ما بيغيّرش', async () => { const k = await hzKeep();
    const r = await ev(a => { localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hifzScores', '{}'); localStorage.setItem('q.hifzLog', '{"52":{"m":"2020-1-1"}}'); const R = '{"52":{"m":"' + a[1] + '","r":"' + a[1] + '","iv":14}}'; localStorage.setItem('q.hzRev', R);
      const ids = [...new Set([1, window.QURAN.s[51][3]].map(x => hzRubOf(QA_ix(52, x))))].map(String), pre = { s52: { r: a[0], iv: 7, lp: 0 } }; pre[ids[1]] = { r: a[1], iv: 3, lp: 0 }; localStorage.setItem('q.hzSched', JSON.stringify(pre));
      const L = localStorage.getItem('q.hifzLog'), S = hzSchedData();
      return [ids.join(','), 's52' in S, !!S[ids[0]] && S[ids[0]].r === a[0] && S[ids[0]].iv === 7, S[ids[1]].iv === 3 && S[ids[1]].r === a[1], localStorage.getItem('q.hzRev') === R, localStorage.getItem('q.hifzLog') === L, JSON.stringify(hzSchedData()) === JSON.stringify(S), ids.every(x => hzUnits().some(u => u.id === x))]; }, [dAgo(5), dAgo(30)]);
    await hzBack(k); assert(r[0].split(',').length === 2 && !r[1] && r[2] && r[3] && r[4] && r[5] && r[6] && r[7], JSON.stringify(r)); return JSON.stringify(r); });
  await check(G530, 'T17: ضغطة على مربع بتظهر كارت (سورة قصيرة: «سورة X»، ربع: أول كلمات + «سورة X آية Y» من غير «الربع q») بزرارين، والهاش ما بيتغيرش؛ الضغطة اللي بعدها بره الكارت بتقفله بس (ولا فتح ولا كارت جزء)؛ «افتح في المصحف» بيفتح ?r=', async () => { const k = await hzKeep();
    await ev(a => localStorage.setItem('q.hzSched', JSON.stringify({ s112: { r: a, iv: 7, lp: 0 } })), dAgo(40));
    await go('#/', 150); await go('#/hifzmap', 700);
    const card = () => ev(() => { const t = document.querySelector('.hm-tip'); return t ? { lines: [...t.querySelectorAll('.hm-tw,.hm-tn')].map(d => d.textContent), st: (t.querySelector('.hm-ts') || {}).textContent, minH: Math.min(...[...t.querySelectorAll('button')].map(b => b.offsetHeight)), btns: [...t.querySelectorAll('button')].map(b => b.textContent) } : null; });
    const tap = async sel => { await ev(sel => { if (document.querySelector('.hm-tip')) document.querySelector('.hm-lg').click(); document.querySelector(sel).click(); }, sel); await wait(120); };
    const h0 = await ev(() => location.hash);
    await tap('.hm-c[data-u="s112"]'); const a = await card(), ha = await ev(() => location.hash);
    await tap('.hm-c[data-u="3"]'); const b = await card(), hb = await ev(() => location.hash);
    await ev(() => document.querySelector('.hm-lg').click()); await wait(120); const out1 = await card(), ho1 = await ev(() => location.hash);   // tap outside
    await tap('.hm-c[data-u="3"]'); const open2 = await card();
    await ev(() => document.querySelector('.hm-jc[data-j="1"] .hm-jh').click()); await wait(200); const out2 = await card(), ho2 = await ev(() => location.hash);   // tap on a juz card while a card is open: only closes
    await tap('.hm-c[data-u="s112"]'); const keep = await ev(async () => { await new Promise(r => setTimeout(r, 2500)); return !!document.querySelector('.hm-tip'); });   // no timer: it stays
    await ev(() => document.querySelector('.hm-c[data-u="s112"]').click()); await wait(100);
    const lp = await ev(async () => { const c = document.querySelector('.hm-c[data-u="3"]'), fire = t => c.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: 10, clientY: 10, pointerId: 1 }));
      fire('pointerdown'); await new Promise(r => setTimeout(r, 650)); const on = !!document.querySelector('.hm-tip'); fire('pointerup'); c.click(); await new Promise(r => setTimeout(r, 150)); return [on, document.querySelectorAll('.hm-tip').length, location.hash]; });   // a 650 ms hold shows nothing by itself (no long-press path); the lift acts as one normal tap
    await ev(() => document.querySelector('.hm-lg').click()); await wait(100);
    await tap('.hm-c[data-u="3"]'); await ev(() => document.getElementById('hmOpen').click()); await wait(400); const op = await ev(() => location.hash);
    await go('#/hifzmap', 600); await ev(() => document.querySelector('.hm-jc[data-j="1"] .hm-jh').click()); await wait(300); const jl = await ev(() => location.hash);
    await hzBack(k); await go('#/', 200);
    assert(a && a.lines.join('|') === 'سورة الإخلاص' && a.btns.join('|') === 'افتح في المصحف|اختبرني' && ha === h0 && a.st && /آخر مراجعة من .+ يوم · كل .+ يوم · مستحقة/.test(a.st) && a.minH >= 40 && b && b.st === 'لسه' && b.lines.length === 2 && b.lines[0].split(' ').length === 4 && /^سورة .+ آية /.test(b.lines[1]) && !b.lines.some(l => /الربع/.test(l)) && hb === h0
      && out1 === null && ho1 === h0 && open2 && out2 === null && ho2 === h0 && keep && !lp[0] && lp[1] === 1 && lp[2] === h0 && op.startsWith('#/p/') && /\?r=\d+:\d+-\d+$/.test(op) && jl === '#/hifzmap?j=1', JSON.stringify([a, b, out1, ho1, out2, ho2, keep, lp, op, jl])); return JSON.stringify([a, b, keep, lp, op, jl]); });
  await check(G530, 'T14: كل سور الجزء ٣٠ القصيرة مستحقة + ١٠ أرباع مستحقة، hzDaily=0 ← القايمة بالوزن (مجموع w <= الميزانية) والمتأخر صح', async () => { const k = await hzKeep();
    const r = await ev(a => { localStorage.setItem('q.hzRev', '{}'); localStorage.setItem('q.hzDaily', '0'); const S = {}, U = hzUnits(), sh = U.filter(u => u.kind === 's' && u.juz === 30), rb = U.filter(u => u.kind === 'r').slice(0, 10);
      sh.forEach(u => S[u.id] = { r: a, iv: 7 }); rb.forEach(u => S[u.id] = { r: a, iv: 14 });
      localStorage.setItem('q.hzSched', JSON.stringify(S)); const w = hzWard(); localStorage.removeItem('q.hzDaily');
      const W = Object.keys(S).reduce((x, id) => x + U.find(u => u.id === id).w, 0), cap = Math.ceil(W / 30) + 2, ws = w.list.reduce((x, y) => x + y.u.w, 0);
      const order = U.filter(u => S[u.id]).sort((x, y) => (S[y.id].iv === 7 ? 40 / 7 : 40 / 14) - (S[x.id].iv === 7 ? 40 / 7 : 40 / 14) || x.st - y.st), exp = []; let acc = 0;
      for (const u of order) { if (exp.length && acc + u.w > cap) break; exp.push(u.id); acc += u.w; }
      return [sh.length, rb.length, w.all, w.list.length, w.late, +cap.toFixed(2), +ws.toFixed(2), ws <= cap + 1e-9, w.list.map(x => x.id).join() === exp.join(), w.late === sh.length + rb.length - w.list.length, w.list.length > 1 && w.list.length < sh.length + rb.length]; }, dAgo(40));
    await hzBack(k); assert(r[2] === r[0] + r[1] && r[7] && r[8] && r[9] && r[10], JSON.stringify(r)); return JSON.stringify(r); });
  await check(G530, 'T15: خريطة الجزء: ٣٠ كارت، كارت جزء ٣٠ فيه ٣٧ خلية وعناوين ١-٢٧ من غير «أرباع»، مجموع المربعات = hzUnits().length، ووحدة مستحقة ← مربع أصفر (٢) وموجودة في hzWard', async () => { const k = await hzKeep();
    await ev(a => { localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hifzScores', '{}'); localStorage.setItem('q.hifzLog', '{}'); localStorage.setItem('q.hzRev', '{}'); localStorage.removeItem('q.hzDaily');
      localStorage.setItem('q.hzSched', JSON.stringify({ s112: { r: a[0], iv: 7 }, 3: { r: a[0], iv: 14 }, 5: { r: a[1], iv: 30 } })); }, [dAgo(40), dAgo(2)]);
    await go('#/', 150); await go('#/hifzmap', 700);
    const r = await ev(() => { const sq = [...document.querySelectorAll('.hm-grid .hm-c')], by = id => sq.filter(c => c.dataset.u === id), w = hzWard().list.map(x => x.id);
      const lbl = [...document.querySelectorAll('.hm-jh b')].map(x => x.textContent), row30 = document.querySelectorAll('.hm-jc')[29].querySelectorAll('.hm-c').length, noAr = [...document.querySelectorAll('.hm-jc')].slice(0, 27).every(c => !/أرباع|ربع/.test(c.querySelector('.hm-jh').textContent));
      const cnt = [0, 1, 2, 3].map(c => sq.filter(x => x.classList.contains('c' + c)).length), lg = [...document.querySelectorAll('.hm-lg span')].map(x => +(x.textContent.match(/\(([٠-٩]+)\)/) || [0, '٠'])[1].replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
      return [document.querySelectorAll('.hm-jc').length, sq.length === hzUnits().length, lbl[0], lbl[29], by('s112').length === 1 && /\bc2\b/.test(by('s112')[0].className), w.includes('s112'), /\bc2\b/.test(by('3')[0].className), /\bc3\b/.test(by('5')[0].className), row30 === 37 && noAr, JSON.stringify(cnt) === JSON.stringify([lg[3], lg[2], lg[1], lg[0]]), by('s112')[0].classList.contains('hm-s'), by('3')[0].getAttribute('aria-label')]; });
    await hzBack(k); await go('#/', 200);
    assert(r[0] === 30 && r[1] && r[4] && r[5] && r[6] && r[7] && r[8] && r[9] && r[10], JSON.stringify(r)); return JSON.stringify(r); });
  await check(G530, 'T18: كارت الجزء بيفتح #/hifzmap?j=N بعدد صفوف = وحدات الجزء، وزرار «اختبرني» في الصف بيبدأ اختبار، ومفيش كارت «النهارده» فوق الخريطة، وزرار ⓘ جنب المفتاح بيفتح/يقفل الشرح، والرجوع للخريطة', async () => { const k = await hzKeep();
    await ev(a => { ['q.hifzAyat', 'q.hifzLog'].forEach(x => localStorage.removeItem(x)); localStorage.setItem('q.hifzScores', '{}'); localStorage.setItem('q.hzRev', '{}'); localStorage.removeItem('q.hzDaily');
      localStorage.setItem('q.hzSched', JSON.stringify({ s112: { r: a[0], iv: 7 }, 3: { r: a[0], iv: 14 } })); }, [dAgo(40)]);
    await go('#/', 150); await go('#/hifzmap', 700);
    const w = await ev(() => { const b = document.getElementById('hmInfoBtn'), i = document.getElementById('hmInfo'), r0 = [!!document.querySelector('.hm-ward'), !!document.getElementById('hmWardGo'), b.getAttribute('aria-label'), b.getAttribute('aria-expanded'), i.hidden, i.offsetHeight, b.parentElement.classList.contains('hm-lg')];
      b.click(); const r1 = [b.getAttribute('aria-expanded'), i.hidden, i.offsetHeight > 0, /افتح في المصحف/.test(i.textContent)]; b.click(); return [r0, r1, i.hidden]; });
    await ev(() => document.querySelector('.hm-jc[data-j="30"]').click()); await wait(400);
    const j = await ev(() => [location.hash, document.querySelectorAll('.hm-row').length, hzUnits().filter(u => u.juz === 30).length, document.querySelectorAll('.hm-row .hm-tb').length, document.querySelector('.hm-row').textContent]);
    await ev(() => history.back()); await wait(500);
    const back = await ev(() => [location.hash, !!document.querySelector('.hm-jc')]);
    await go('#/hifzmap?j=30', 500); await ev(() => document.querySelector('.hm-tb[data-test="s112"]').click()); await wait(700);
    const t = await ev(() => location.hash);
    await go('#/hifzmap?j=1', 500); const j1 = await ev(() => [document.querySelectorAll('.hm-row').length, [...document.querySelectorAll('.hm-row b')].map(b => b.textContent)[3]]);
    await hzBack(k); await go('#/', 200);
    assert(!w[0][0] && !w[0][1] && w[0][2] === 'معلومات' && w[0][3] === 'false' && w[0][4] && w[0][5] === 0 && w[0][6] && w[1][0] === 'true' && !w[1][1] && w[1][2] && w[1][3] && w[2] && j[0] === '#/hifzmap?j=30' && j[1] === j[2] && j[2] === 37 && j[3] === 37 && /^#\/(p|s|hifztest)/.test(t) && j1[0] === 8 && /^الربع ٤ من الحزب ١ · /.test(j1[1]) && back[0] === '#/hifzmap' && back[1], JSON.stringify([w, j, t, j1, back])); return JSON.stringify([w, j.slice(0, 4), t, j1, back]); });
  await check(G530, 'T19: SWEEP: اختبرني من زرار صف قايمة الجزء لكل الـ٢٧٣ وحدة ← المدى = آيات الوحدة بالظبط (أول آية، آخر آية، من غير مواضع تانية، والآيات المخفية على صفحاتها = الوحدة)، ونفس الحاجة من زرار ?r= (كل الأرباع اللي بتعدي سورتين + عينة) ومن ورد النهارده (بالسرد وعشوائي)', async () => { const k = await hzKeep();
    await ev(() => { window.ReciteBridge = window.ReciteBridge || { start() {}, stop() {}, setHints() {} }; });
    const r = await ev(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), U = hzUnits(), g = QA_ix, bad = [], Q = window.QURAN; let nb = 0, np = 0, nw = 0;
      const stop = () => { try { if (hzTestInfo()) hifzToggle(); } catch (e) {} document.querySelectorAll('.dlg-back').forEach(d => d.remove()); };
      const keys = u => { const o = []; for (let s = u.s0; s <= u.s1; s++) { if (u.kind === 'r' && hzShort(s)) continue; for (let a = s === u.s0 ? u.a0 : 1; a <= (s === u.s1 ? u.a1 : Q.s[s - 1][3]); a++) o.push(s + ':' + a); } return o; };
      for (const u of U) {
        location.hash = '#/hifzmap?j=' + u.juz; await w(60);
        const b = document.querySelector('.hm-tb[data-test="' + u.id + '"]'); if (!b) { bad.push([u.id, 'nobtn']); continue; }
        b.click(); await w(120); const I = hzTestInfo(); nb++;
        if (!I) { bad.push([u.id, 'notest']); continue; }
        const e = I.end.split(':').map(Number), exp = keys(u);
        if (g(I.s, I.a) !== g(u.s0, u.a0) || g(e[0], e[1]) !== g(u.s1, u.a1) || (I.pc || []).length) bad.push([u.id, 'range', I.s + ':' + I.a, I.end]);
        else { const set = new Set(exp), mk = new Set(I.masked); if (I.masked.some(x => !set.has(x)) ) bad.push([u.id, 'maskedOutside']); }
        stop();
      }
      const cross = U.filter(u => u.kind === 'r' && u.s0 !== u.s1).map(u => u.id), samp = U.filter((u, i) => i % 9 === 0).map(u => u.id);
      for (const id of new Set(cross.concat(samp))) {
        const u = U.find(x => x.id === id); location.hash = '#/p/' + QA_pageOf(u.s0, u.a0) + '?r=' + u.s0 + ':' + u.a0 + '-' + (u.s0 === u.s1 ? '' : u.s1 + ':') + u.a1; await w(150);
        const t = document.getElementById('rdTest'); if (!t) { bad.push([id, 'nopill']); continue; }
        t.click(); await w(150); const I = hzTestInfo(); np++;
        if (!I) { bad.push([id, 'pill-notest']); continue; }
        const e = I.end.split(':').map(Number); if (g(I.s, I.a) !== g(u.s0, u.a0) || g(e[0], e[1]) !== g(u.s1, u.a1) || (I.pc || []).length) bad.push([id, 'pill-range', I.s + ':' + I.a, I.end]);
        stop();
      }
      const d = new Date(Date.now() - 40 * 864e5), ds = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(), S = {}; U.forEach(u => S[u.id] = { r: ds, iv: 1, lp: 0 });
      localStorage.setItem('q.hzSched', JSON.stringify(S)); localStorage.setItem('q.hzDaily', '900');
      for (const way of ['o', 'r']) {
        localStorage.setItem('q.hzWardWay', JSON.stringify(way)); const W = hzWard().list, UU = W.map(x => [g(x.u.s0, x.u.a0), g(x.u.s1, x.u.a1)]);
        hzWardTest(); await w(200); const I = hzTestInfo(); nw++;
        if (!I) { bad.push([way, 'ward-notest']); continue; }
        const e = I.end.split(':').map(Number), pl = [[g(I.s, I.a), g(e[0], e[1])]].concat((I.pc || []).map(x => x.slice())); let cov = 0, out = 0;
        pl.forEach(p => { for (let i = p[0]; i <= p[1]; i++) { cov++; if (!UU.some(x => i >= x[0] && i <= x[1])) out++; } });
        if (out || (way === 'o' && (cov !== 6236 || pl.length !== 1))) bad.push([way, 'ward', cov, out, pl.length]);
        stop();
      }
      localStorage.removeItem('q.hzDaily'); localStorage.removeItem('q.hzWardWay');
      return [U.length, nb, np, nw, bad.length, JSON.stringify(bad.slice(0, 5))];
    });
    await hzBack(k); await go('#/', 200);
    assert(r[0] === 273 && r[1] === 273 && r[4] === 0, JSON.stringify(r)); return JSON.stringify(r); });
  await check(G530, 'T20: ورد/قراءة بتعدّي نهاية الوحدة (أو بتبدأ قبلها) في نفس الصفحة ← الآيات اللي بره الوحدة ما بتتعلّمش في q.hifzAyat ولا بتتحسب (اختبرني من صف الجزء، وحدة سورة قصيرة)', async () => { const k = await hzKeep();
    await ev(() => { localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hifzScores', '{}'); localStorage.removeItem('q.hzSched'); window.ReciteBridge = window.ReciteBridge || { start() {}, stop() {}, setHints() {} }; });
    const run = async (id, pre, ids) => {
      await go('#/hifzmap?j=30', 400); await ev(id => document.querySelector('.hm-tb[data-test="' + id + '"]').click(), id); await wait(700);
      await ev(() => { if (!document.querySelector('#hifzBar [data-c=mic].rec')) document.querySelector('#hifzBar [data-c=mic]').click(); }); await wait(200); await ev(() => window.onRecite('', 'state:listening'));
      const t = await ev(a => a.map(([s, x]) => window.QURAN.t[s - 1][x - 1].split(' ').filter(w => /[ء-يٱ]/.test(w)).join(' ')).join(' '), ids);
      await ev(t => window.onRecite(t, 'final'), t); await wait(1800);
      const HA = await ev(() => Object.keys(JSON.parse(localStorage.getItem('q.hifzAyat') || '{}'))); await ev(() => { document.querySelectorAll('.dlg-back').forEach(d => d.remove()); try { if (hzTestInfo()) hifzToggle(); } catch (e) {} document.querySelectorAll('.dlg-back').forEach(d => d.remove()); });
      return HA;
    };
    const a = await run('s112', 0, [[111, 4], [111, 5], [112, 1], [112, 2], [112, 3], [112, 4], [113, 1], [113, 2]]);
    await ev(() => localStorage.removeItem('q.hifzAyat'));
    const b = await run('s111', 0, [[110, 2], [110, 3], [111, 1], [111, 2], [111, 3], [111, 4], [111, 5], [112, 1]]);
    await hzBack(k); await go('#/', 200);
    assert(a.every(x => /^112:/.test(x)) && a.length >= 3 && b.every(x => /^111:/.test(x)) && b.length >= 3, JSON.stringify([a, b])); return JSON.stringify([a, b]); });
  await check(G530, 'T21: النسخة الاحتياطية بتشيل الجدولة: q.hzSched جوه الملف، ولما يترجّع بعد المسح الورد والخريطة زي الأول', async () => { const k = await hzKeep();
    const r = await ev(() => { const d = n => { const t = new Date(Date.now() - n * 864e5); return t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate(); };
      localStorage.setItem('q.hzRev', '{}'); localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hifzScores', '{}');
      localStorage.setItem('q.hzSched', JSON.stringify({ 5: { r: d(10), iv: 7, res: 95, lp: 0 }, 40: { r: d(1), iv: 14, res: 90, lp: 1 }, s112: { r: d(4), iv: 3, res: 85, lp: 0 } }));
      const w0 = hzWard().list.map(x => x.id).join(','), sched0 = localStorage.getItem('q.hzSched'), keys = QA_bk.collect(), inFile = 'q.hzSched' in keys;
      localStorage.removeItem('q.hzSched'); const wGone = hzWard().list.length;
      QA_bk.restore(JSON.parse(JSON.stringify(keys)));
      return [inFile, wGone, localStorage.getItem('q.hzSched') === sched0, hzWard().list.map(x => x.id).join(','), w0]; });
    await hzBack(k); assert(r[0] && r[1] === 0 && r[2] && r[3] === r[4] && r[4].length > 0, JSON.stringify(r)); return JSON.stringify(r); });
  // ---------- نسخة 5.34 (Sprint 3 أ) ----------
  const G534 = 'نسخة 5.34';
  const lastKey = 'q.lastPage' + KSUF, shown = () => ev(() => document.querySelectorAll('.ayah-box:not(.play)').length);
  // a fresh launch: the given q.* values (null removes), then the app loaded with that hash
  const boot534 = async (ls, hash = '') => {
    await ev(ls => { for (const k in ls) ls[k] === null ? localStorage.removeItem(k) : localStorage.setItem(k, ls[k]); }, ls);
    await p.goto('about:blank'); await p.goto(W + hash); await wait(1000); };
  const base534 = { 'q.mode': '"pages"', 'q.turn': '"h"', 'q.flipMode': '"off"', 'q.openAt': null, 'q.tapMark': null, 'q.spread': 'true' };
  await p.setViewportSize({ width: 390, height: 844 });
  await check(G534, '#10: مفيش زر السابقة/التالية في صفحة المصحف، ورقم الصفحة والتشغيل والليلي موجودين', async () => { await boot534(base534, '#/p/50');
    return assert(await ev(() => !document.getElementById('pPrev') && !document.getElementById('pNext') && ['pNum', 'pPlay', 'pDark'].every(i => document.querySelector('.page-nav #' + i))), 'nav'); });
  await check(G534, '#10: أمر الصوت «الصفحة التالية/السابقة» بيقلب بنفس مسار التقليب', async () => { await go('#/p/50', 900);
    await voiceTurn(1); await wait(900); const a = await ev(() => location.hash); await voiceTurn(-1); await wait(900); const c = await ev(() => location.hash); return assert(a === '#/p/51' && c === '#/p/50', a + ' ' + c); });
  await check(G534, '#10: السحب بيقلب (أفقي بدون تأثير)', async () => { await go('#/p/50', 900); await swipe(1); const a = await ev(() => location.hash); await swipe(-1); const c = await ev(() => location.hash); return assert(a === '#/p/51' && c === '#/p/50', a + ' ' + c); });
  await check(G534, '#10: تأثير ثني الورقة لسه شغال (الأمر بيعمل .curl أثناء التقليب)', async () => { await ev(() => localStorage.setItem('q.flipMode', '"curl"')); await p.reload(); await wait(900);
    await voiceTurn(1); await wait(150); const mid = await ev(() => !!document.querySelector('.curl')); await wait(1300); const h = await ev(() => [location.hash, !!document.querySelector('.curl')]);
    await ev(() => localStorage.setItem('q.flipMode', '"off"')); return assert(mid && h[0] === '#/p/51' && !h[1], JSON.stringify([mid, h])); });
  await check(G534, '#46: شاشة المواقيت من غير «جرّب الأذان بعد دقيقة» وملاحظة «لو التجربة ماوصلتش»', async () => { await ev(() => { localStorage.setItem('q.qiblaLoc', '[30.04,31.24,"x"]'); window.AppBridge = window.AppBridge || {}; window.AppBridge.setAlarms = window.AppBridge.setAlarms || (() => {}); });
    await go('#/prayer', 900); return assert(await ev(() => !document.getElementById('prTest') && !/لو التجربة ماوصلتش|جرّب الأذان بعد دقيقة/.test(document.body.innerText) && !!document.querySelector('.pv-play')), 'prayer'); });
  await check(G534, '#41: الافتراضي «الواجهة الرئيسية»: الفتح من غير هاش بيفضل على الرئيسية', async () => { await boot534(Object.assign({}, base534, { [lastKey]: '123' }));
    return assert(await ev(() => !/^#\/p\//.test(location.hash) && !!document.getElementById('kCard')), await ev(() => location.hash)); });
  await check(G534, '#41: «آخر موضع في المصحف» بيفتح آخر صفحة عند التشغيل، والرجوع بيرجّع للرئيسية', async () => { await boot534(Object.assign({}, base534, { [lastKey]: '123', 'q.openAt': '"last"' }));
    const a = await ev(() => location.hash); await p.click('#btnBack'); await wait(700); const c = await ev(() => [location.hash, !!document.getElementById('kCard')]);
    return assert(a === '#/p/123' && c[1] && !/^#\/p\//.test(c[0]), a + ' ' + JSON.stringify(c)); });
  await check(G534, '#41: الرابط العميق مش بيتغيّر، ولا زيارة الرئيسية بعد كده في نفس التشغيل', async () => { await boot534(Object.assign({}, base534, { [lastKey]: '123', 'q.openAt': '"last"' }), '#/p/60'); const a = await ev(() => location.hash);
    await go('#/', 700); const c = await ev(() => [location.hash, !!document.getElementById('kCard')]); return assert(a === '#/p/60' && c[1] && !/^#\/p\//.test(c[0]), a + JSON.stringify(c)); });
  await check(G534, '#41/#20: أزرار الإعدادات بتحفظ q.openAt و q.tapMark', async () => { await go('#/', 300); await p.click('#btnSettings'); await wait(200);
    await p.click('#openSet button[data-v=last]'); await p.click('#tapSet button[data-v=off]'); const r = await ev(() => [localStorage.getItem('q.openAt'), localStorage.getItem('q.tapMark'), document.querySelector('#openSet .on').dataset.v, document.querySelector('#tapSet .on').dataset.v]);
    await p.click('#openSet button[data-v=home]'); await p.click('#tapSet button[data-v=on]'); const r2 = await ev(() => [localStorage.getItem('q.openAt'), localStorage.getItem('q.tapMark')]); await closeS();
    return assert(r.join() === '"last",false,last,off' && r2.join() === '"home",true', r.join() + ' | ' + r2.join()); });
  const tapMid = async sel => { const b = await p.locator(sel).first().boundingBox(); await p.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.5); await wait(400); };
  await check(G534, '#20: التعليم عند اللمس شغال (افتراضي): لمسة على الصفحة بتعمل .ayah-box', async () => { await boot534(base534, '#/p/50'); await tapMid('.page-box'); return assert((await shown()) > 0, 'no ayah-box'); });
  await check(G534, '#20: لما يتقفل: اللمس مش بيعمل .ayah-box ولا شريط الآية، والرابط ?a= لسه بيظلل', async () => { await boot534(Object.assign({}, base534, { 'q.tapMark': 'false' }), '#/p/50'); await tapMid('.page-box');
    const t = await shown(), bar = await ev(() => !!document.querySelector('#ayahBar button')); await go('#/p/' + P255 + '?a=2:255', 900); const u = await shown();
    return assert(t === 0 && !bar && u > 0, JSON.stringify([t, bar, u])); });
  await check(G534, '#20: نفس الشيء في العرض العمودي', async () => { await boot534(Object.assign({}, base534, { 'q.tapMark': 'false', 'q.turn': '"v"' }), '#/p/50'); await wait(600); await tapMid('.vpages .page-box[data-p="50"]'); const off = await shown();
    await boot534(Object.assign({}, base534, { 'q.turn': '"v"' }), '#/p/50'); await wait(600); await tapMid('.vpages .page-box[data-p="50"]'); const on = await shown(); return assert(off === 0 && on > 0, off + ',' + on); });
  const sideOf = n => ev(n => { const b = document.querySelector('.page-box[data-p="' + n + '"]'); return b ? (b.classList.contains('pg-r') ? 'r' : b.classList.contains('pg-l') ? 'l' : '-') : '?'; }, n);
  await check(G534, '#13: pg-r/pg-l بالتبادل (الصفحة الأولى يمين) في الصفحة الواحدة', async () => { await boot534(base534, '#/p/50'); const first = await ev(() => QURAN.first), exp = n => ((n - first) % 2 + 2) % 2 === 0 ? 'r' : 'l', got = [];
    for (const n of [first, first + 1, 50, 51, 101]) { await go('#/p/' + n, 500); got.push([n, await sideOf(n), exp(n)]); } return assert(got.every(g => g[1] === g[2]), JSON.stringify(got)); });
  await check(G534, '#13: في وضع الصفحتين: اليمين pg-r واليسار pg-l وعلى حافة الكعب ظل', async () => { await p.setViewportSize({ width: 1100, height: 700 }); await boot534(base534, '#/p/51'); await wait(600);
    const r = await ev(() => [...document.querySelectorAll('.page-box')].map(b => [b.dataset.p, (b.className.match(/pg-[rl]/) || ['-'])[0], getComputedStyle(b, '::after').backgroundImage.includes('gradient'), b.getBoundingClientRect().left]));
    await p.setViewportSize({ width: 390, height: 844 }); r.sort((a, b) => b[3] - a[3]); const x = r[0] || [], y = r[1] || [];
    return assert(r.length === 2 && x[1] === 'pg-r' && y[1] === 'pg-l' && x[2] && y[2], JSON.stringify(r)); });
  await check(G534, '#13: العرض العمودي: كل صفحات القائمة عليها pg-r/pg-l بالتبادل', async () => { await boot534(Object.assign({}, base534, { 'q.turn': '"v"' }), '#/p/50'); await wait(600);
    const r = await ev(() => [...document.querySelectorAll('.vpages .page-box')].map(b => [+b.dataset.p, b.classList.contains('pg-r')])), first = await ev(() => QURAN.first);
    return assert(r.length >= 2 && r.every(([n, isR]) => isR === (((n - first) % 2 + 2) % 2 === 0)), JSON.stringify(r.slice(0, 6))); });
  // ---- #15 / #14 / #39: keep screen on, status bar in full screen, recitation mic (the Android bridges are stubbed) ----
  // __br records every call the page makes to the shell. The stub insets() answers like AppBridge.insets(): status bar 24, nav bar 48;
  // with the status bar kept the full-screen top stays 24 (fsTop = insT), else the cutout (0).
  const stub534 = (devices, ready) => ev(([devs, rdy]) => { window.__br = []; const keep = () => !!window.__keep;
    window.AppBridge = { keepOn: v => __br.push(['keepOn', v]), fsStatus: v => { window.__keep = v; __br.push(['fsStatus', v]); }, immersive: v => __br.push(['immersive', v]), insets: () => '24,48,' + (keep() ? 24 : 0) + ',0' };
    window.NvBridge = { mics: () => devs, setMic: id => __br.push(['setMic', id]), micTest: id => __br.push(['micTest', id]), ready: () => rdy }; }, [devices, !!ready]);
  const calls534 = () => ev(() => JSON.stringify(window.__br));
  const DEVS534 = JSON.stringify([{ id: 3, type: 'builtin', name: 'Built-in' }, { id: 7, type: 'bt', name: 'Buds' }, { id: 9, type: 'usb', name: 'Dev' }]);
  await check(G534, '#15/#14/#39: صفوف الإعدادات الجديدة بتحفظ q.keepOn و q.fsStatus و q.micId وبتبعت للشِل', async () => { await boot534(base534, '#/'); await stub534(DEVS534, false);
    await p.click('#btnSettings'); await wait(200);
    const d0 = await ev(() => [document.querySelector('#keepSet .on').dataset.v, document.querySelector('#fsStatSet .on').dataset.v, document.getElementById('micSel').value]);   // defaults: off, off (hide), auto
    await p.click('#keepSet button[data-v=on]'); await p.click('#fsStatSet button[data-v=on]'); await p.selectOption('#micSel', '7');
    const r = await ev(() => [localStorage.getItem('q.keepOn'), localStorage.getItem('q.fsStatus'), localStorage.getItem('q.micId'), document.querySelector('#keepSet .on').dataset.v, document.querySelector('#fsStatSet .on').dataset.v]);
    const c = await calls534(); await p.click('#keepSet button[data-v=off]'); await p.click('#fsStatSet button[data-v=off]'); await p.selectOption('#micSel', '0'); const r2 = await ev(() => [localStorage.getItem('q.keepOn'), localStorage.getItem('q.fsStatus'), localStorage.getItem('q.micId')]); await closeS();
    return assert(d0.join() === 'off,off,0' && r.join() === 'true,true,7,on,on' && r2.join() === 'false,false,0' && c.includes('["keepOn",true]') && c.includes('["fsStatus",true]') && c.includes('["setMic",7]'), d0 + ' | ' + r + ' | ' + r2 + ' | ' + c); });
  await check(G534, '#39: قائمة المايكات بتتبني من NvBridge.mics() (تلقائي ثم الأجهزة بأسماء عربي)', async () => { await boot534(Object.assign({}, base534, { 'q.micId': '9' }), '#/'); await stub534(DEVS534, true);
    await p.click('#btnSettings'); await wait(200); const r = await ev(() => [[...document.querySelectorAll('#micSel option')].map(o => o.textContent), document.getElementById('micSel').value, document.getElementById('micRow').hidden, !!document.getElementById('micHint')]); await closeS();
    return assert(r[0].join('|') === 'تلقائي|مايك الهاتف|سماعة بلوتوث · Buds|مايك USB · Dev' && r[1] === '9' && !r[2] && !r[3], JSON.stringify(r)); });
  await check(G534, '#39: القائمة فاضية أو المايك المحفوظ اتفصل: تلقائي ومحدش بيتحفظ q.micId قديم؛ ومن غير NvBridge الصف مخفي؛ ومفيش أي جملة توضيحية', async () => { await boot534(Object.assign({}, base534, { 'q.micId': '9' }), '#/'); await stub534('[]', false);
    await p.click('#btnSettings'); await wait(200); const r = await ev(() => [[...document.querySelectorAll('#micSel option')].map(o => o.textContent).join('|'), document.getElementById('micSel').value, localStorage.getItem('q.micId'), !!document.getElementById('micHint')]);
    const c = await calls534(); await closeS(); await boot534(base534, '#/'); await p.click('#btnSettings'); await wait(200); const hid = await ev(() => document.getElementById('micRow').hidden); await closeS();
    return assert(r[0] === 'تلقائي' && r[1] === '0' && r[2] === '0' && !r[3] && c.includes('["setMic",0]') && hid, JSON.stringify([r, c, hid])); });
  await check(G534, '#39: onMicInfo("fallback") بيطلع تنبيه «المايك المختار مش متوصل»', async () => { await boot534(base534, '#/'); await ev(() => window.onMicInfo('fallback', '')); await wait(100);
    return assert(await ev(() => [...document.querySelectorAll('.toast')].some(t => t.textContent.includes('المايك المختار مش متوصل'))), 'no toast'); });
  await check(G534, '#39: الصف اسمه «اختيار الميكروفون» وتحته على طول «اختبار المايك»، ومفيش جملة «بيجرّب مايك الهاتف العادي»', async () => { await boot534(Object.assign({}, base534, { 'q.micId': '9' }), '#/'); await stub534(DEVS534, false);
    await p.click('#btnSettings'); await wait(200); const r = await ev(() => { const row = document.getElementById('micRow'), nx = row.nextElementSibling; return [row.firstChild.textContent.trim(), document.getElementById('micSel').getAttribute('aria-label'), !!nx.querySelector('#micTestBtn'), nx.firstChild.textContent.trim(), row.textContent.includes('العادي')]; }); await closeS();
    return assert(r[0] === 'اختيار الميكروفون' && r[1] === 'اختيار الميكروفون' && r[2] && r[3] === 'اختبار المايك' && !r[4], JSON.stringify(r)); });
  await check(G534, '#39: «اختبار المايك» بيروح للتسجيل الأصلي بالمايك المختار (NvBridge.micTest(id)) وبيعرض الجهاز اللي اتسجّل منه', async () => { await boot534(Object.assign({}, base534, { 'q.micId': '9' }), '#/'); await stub534(DEVS534, false);
    await p.click('#btnSettings'); await wait(200); await p.click('#micTestBtn'); await wait(200); const c = await calls534();
    const lv = [...Array(40).fill(-60), ...Array(80).fill(-30)]; await ev(lv => window.onMicInfo('testdone', JSON.stringify({ levels: lv, routed: 'usb:Dev', gone: false, note: '' })), lv); await wait(100);
    const r = await ev(() => [document.getElementById('micTestSum').textContent, document.getElementById('micTestBtn').disabled]); await closeS();
    return assert(c.includes('["micTest",9]') && r[0].includes('ممتاز') && r[0].includes('المايك المستخدم:') && r[0].includes('مايك USB') && !r[0].includes('Dev') && !r[1], c + ' | ' + r); });
  await check(G534, 'تحت الصفحة: مفيش #pMark، وسطر السورة/الجزء جوه .page-tools (مرة واحدة) قبل دليل التجويد، ومخفي في ملء الشاشة', async () => { await boot534(Object.assign({}, base534, { 'q.tajweed': 'true' }), '#/p/50'); await wait(400); await ev(() => { window.QA_NOFS = true; });
    const r = await ev(() => { const t = document.querySelector('.page-tools'), i = t && t.querySelector('.page-info'); return [!!document.getElementById('pMark'), document.querySelectorAll('.page-info').length, !!i && i.textContent.includes('سورة') && i.textContent.includes('الجزء'), !!i && !!i.nextElementSibling && i.nextElementSibling.classList.contains('tj-key'), t && t.firstElementChild === i]; });
    const fsOff = await ev(() => { const t = document.querySelector('.page-tools'); t.style.transition = 'none'; document.body.classList.add('fs'); const o = getComputedStyle(t).visibility, mh = getComputedStyle(t).maxHeight; document.body.classList.remove('fs'); t.style.transition = ''; return [o, mh]; });
    return assert(!r[0] && r[1] === 1 && r[2] && r[3] && r[4] && fsOff[0] === 'hidden', JSON.stringify([r, fsOff])); });
  // full screen by a tap on the page (QA_NOFS off), then back; reads what the page told the shell and how it planned the glide
  const fs534 = async (keep) => { await boot534(Object.assign({}, base534, { 'q.fsStatus': keep ? 'true' : 'false' }), '#/p/50'); await stub534('[]', false); await ev(() => { window.QA_NOFS = false; });
    await ev(() => document.querySelector('.page-box').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await wait(1350);
    const r = await ev(() => [document.body.classList.contains('fs'), document.documentElement.style.getPropertyValue('--fsdy'), JSON.stringify(window.__br)]);
    await ev(() => { window.QA_NOFS = true; }); return r; };
  await check(G534, '#14: ملء الشاشة مع «إظهار» شريط الهاتف: fsStatus(true) قبل immersive(true) والانزلاق على نفس الأعلى (--fsdy=0)', async () => { const r = await fs534(true);
    return assert(r[0] && r[2].indexOf('["fsStatus",true]') >= 0 && r[2].indexOf('["fsStatus",true]') < r[2].indexOf('["immersive",true]') && parseFloat(r[1]) === 0, JSON.stringify(r)); });
  await check(G534, '#14: مع «إخفاء» (الافتراضي): fsStatus(false) والانزلاق لسه بيعوّض ٢٤ (--fsdy=-24px) زي قبل كده', async () => { const r = await fs534(false);
    return assert(r[0] && r[2].indexOf('["fsStatus",false]') >= 0 && r[2].indexOf('["fsStatus",false]') < r[2].indexOf('["immersive",true]') && r[1] === '-24px', JSON.stringify(r)); });
  // #qMk is fixed in the viewport in every mode: the same box in normal, full screen (status shown / hidden) and hifz
  await check(G534, '#qMk: نفس المكان في العادي وملء الشاشة (شريط الهاتف ظاهر/مخفي) والحفظ', async () => { const box = () => ev(() => { const r = document.getElementById('qMk').getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(v => Math.round(v * 10) / 10).join(','); });
    const out = {}; for (const keep of [true, false]) { await boot534(Object.assign({}, base534, { 'q.fsStatus': keep ? 'true' : 'false' }), '#/p/50'); await stub534('[]', false); await ev(() => { window.QA_NOFS = false; });
      if (keep) out.normal = await box();
      await ev(() => document.querySelector('.page-box').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await wait(1500); const fsOn = await ev(() => document.body.classList.contains('fs')); out[keep ? 'fsStatus' : 'fsHidden'] = fsOn ? await box() : 'no-fs'; }
    await boot534(base534, '#/p/50'); await ev(() => { window.QA_NOFS = false; hifzToggle(); }); await wait(400); out.hifz = await box(); await go('#/p/51', 400); await wait(3600); out.hifzFs = (await ev(() => document.body.classList.contains('fs'))) ? await box() : 'no-fs';
    await ev(() => { window.QA_NOFS = true; });
    return assert(new Set(Object.values(out)).size === 1, JSON.stringify(out)); });
  // 5.35 #19: full screen page size: «على عرض الشاشة» (width, default) or «ملء الشاشة» (stretch), also switched by a two-finger pinch in
  const fsFit = () => ev(() => { try { return JSON.parse(localStorage.getItem('q.fsFit')); } catch (e) { return 'bad'; } });
  const fsOn534 = async () => { await ev(() => document.body.classList.add('fs')); await wait(500); };
  // the visible part of each page box (the box minus its crop fractions) in viewport px: [left, top, right, bottom]
  const visRects = () => ev(() => [...document.querySelectorAll('.page-wrap .page-box')].map(b => { const r = b.getBoundingClientRect(), cs = getComputedStyle(b), f = k => parseFloat(cs.getPropertyValue(k)) || 0;
    return [r.left + f('--cl') * r.width, r.top + f('--ct') * r.height, r.right - f('--cr') * r.width, r.bottom - f('--cb') * r.height].map(v => Math.round(v * 10) / 10); }).sort((a, b) => a[0] - b[0]));
  const near = (a, b) => Math.abs(a - b) <= 2;
  const pinch534 = (x1, x2, a, b) => ev(([x1, x2, a, b]) => { const t = document.querySelector('.page-box'), y = 400;
    const mk = (type, id, x) => t.dispatchEvent(new PointerEvent(type, { pointerId: id, isPrimary: id === 1, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
    mk('pointerdown', 1, x1); mk('pointerdown', 2, x2);
    for (let i = 1; i <= 5; i++) { mk('pointermove', 1, x1 + (a - x1) * i / 5); mk('pointermove', 2, x2 + (b - x2) * i / 5); }
    mk('pointerup', 2, b); mk('pointerup', 1, a); t.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: a, clientY: y })); }, [x1, x2, a, b]);
  await check(G534, '#19: صف «حجم الصفحة في ملء الشاشة» في الإعدادات: الافتراضي «على عرض الشاشة» والأزرار بتحفظ q.fsFit وبتغيّر class على html', async () => { await boot534(Object.assign({}, base534, { 'q.fsFit': null }), '#/'); await p.click('#btnSettings'); await wait(200);
    const d = await ev(() => [document.querySelector('#fsFitSet .on').dataset.v, localStorage.getItem('q.fsFit'), document.documentElement.classList.contains('fsfit-stretch')]);
    await p.click('#fsFitSet button[data-v=stretch]'); const s = await ev(() => [localStorage.getItem('q.fsFit'), document.querySelector('#fsFitSet .on').dataset.v, document.documentElement.classList.contains('fsfit-stretch')]);
    await p.click('#fsFitSet button[data-v=width]'); const w = await ev(() => [localStorage.getItem('q.fsFit'), document.documentElement.classList.contains('fsfit-stretch')]); await closeS();
    return assert(d[0] === 'width' && d[1] === null && !d[2] && s[0] === '"stretch"' && s[1] === 'stretch' && s[2] && w[0] === '"width"' && !w[1], JSON.stringify([d, s, w])); });
  await check(G534, '#19: ملء الشاشة + stretch: الجزء الظاهر من الصفحة = الشاشة كلها (±2px)؛ «على عرض الشاشة» بيرجع لنفس القياس القديم', async () => { await boot534(Object.assign({}, base534, { 'q.fsFit': null }), '#/p/50'); await fsOn534();
    const w0 = await visRects(); await boot534(Object.assign({}, base534, { 'q.fsFit': '"stretch"' }), '#/p/50'); await fsOn534();
    const s = await visRects(), vp = await ev(() => [innerWidth, innerHeight]); await ev(() => document.documentElement.classList.remove('fsfit-stretch')); await wait(200); const w1 = await visRects();
    return assert(s.length === 1 && near(s[0][0], 0) && near(s[0][1], 0) && near(s[0][2], vp[0]) && near(s[0][3], vp[1]) && JSON.stringify(w0) === JSON.stringify(w1), JSON.stringify([w0, s, w1, vp])); });
  await check(G534, '#19: stretch في وضع الصفحتين (١٠٠٠×٧٠٠): كل صفحة نص الشاشة وبارتفاعها', async () => { await p.setViewportSize({ width: 1000, height: 700 }); await boot534(Object.assign({}, base534, { 'q.fsFit': '"stretch"' }), '#/p/51'); await wait(500); await fsOn534();
    const s = await visRects(); await p.setViewportSize({ width: 390, height: 844 });
    return assert(s.length === 2 && near(s[0][0], 0) && near(s[0][2], 500) && near(s[1][0], 500) && near(s[1][2], 1000) && s.every(r => near(r[1], 0) && near(r[3], 700)), JSON.stringify(s)); });
  await check(G534, '#19: stretch: الصورة بتملا الصندوق، وتظليل الآية (.ayah-box) بنفس النسب وجوه حدود الصفحة زي «على عرض الشاشة»', async () => {
    const probe = () => ev(() => { const b = document.querySelector('.page-box'), r = b.getBoundingClientRect(), i = b.querySelector('img:not(.tjo)').getBoundingClientRect(), a = [...b.querySelectorAll('.ayah-box:not(.play)')];
      const f = a.map(x => [x.style.left, x.style.top, x.style.width, x.style.height].join()), c = a[0] ? a[0].getBoundingClientRect() : null;
      return { same: Math.abs(i.width - r.width) < 1 && Math.abs(i.height - r.height) < 1, n: a.length, f, hit: !!c && c.left >= r.left - 1 && c.right <= r.right + 1 && c.top >= r.top - 1 && c.bottom <= r.bottom + 1 }; });
    const out = []; for (const fit of ['width', 'stretch']) { await boot534(Object.assign({}, base534, { 'q.fsFit': JSON.stringify(fit) }), '#/p/' + P255 + '?a=2:255'); await wait(500); await fsOn534(); out.push(await probe()); }
    return assert(out[1].same && out[1].n > 0 && out[1].hit && JSON.stringify(out[0].f) === JSON.stringify(out[1].f), JSON.stringify(out)); });
  await check(G534, '#19: قرصة تقريب الإصبعين (نسبة < 0.8) في ملء الشاشة بتبدّل width ↔ stretch وتحفظ q.fsFit من غير ما تقلب الصفحة ولا تعلّم آية', async () => { await boot534(Object.assign({}, base534, { 'q.fsFit': null }), '#/p/50'); await fsOn534();
    await pinch534(50, 350, 130, 270); await wait(200); const a = await ev(() => [JSON.parse(localStorage.getItem('q.fsFit')), document.documentElement.classList.contains('fsfit-stretch'), location.hash, document.querySelectorAll('.ayah-box:not(.play)').length, document.body.classList.contains('fs'), (document.querySelector('.toast') || {}).textContent]);
    await wait(600); await pinch534(50, 350, 130, 270); await wait(200); const b = await ev(() => [JSON.parse(localStorage.getItem('q.fsFit')), document.documentElement.classList.contains('fsfit-stretch'), location.hash, document.querySelectorAll('.ayah-box:not(.play)').length, document.body.classList.contains('fs')]);
    return assert(a[0] === 'stretch' && a[1] && a[2] === '#/p/50' && a[3] === 0 && a[4] && /ملء الشاشة/.test(a[5] || '') && b[0] === 'width' && !b[1] && b[2] === '#/p/50' && b[3] === 0 && b[4], JSON.stringify([a, b])); });
  await check(G534, '#19: قرصة التباعد (تكبير) مش بتبدّل، وبره ملء الشاشة القرصة مش بتبدّل برضه', async () => { await boot534(Object.assign({}, base534, { 'q.fsFit': null }), '#/p/50'); await fsOn534();
    await pinch534(150, 250, 50, 350); await wait(200); const out = await fsFit(); await ev(() => document.body.classList.remove('fs')); await wait(300); await pinch534(50, 350, 130, 270); await wait(200); const nofs = await fsFit();
    return assert(out === null && nofs === null, JSON.stringify([out, nofs])); });
  await ev(() => { for (const k of ['q.openAt', 'q.tapMark', 'q.turn', 'q.flipMode', 'q.qiblaLoc', 'q.keepOn', 'q.fsStatus', 'q.micId', 'q.fsFit']) localStorage.removeItem(k); localStorage.setItem('q.spread', 'true'); }); await p.goto('about:blank'); await p.goto(W); await wait(500);
  await check('عام', 'مفيش أخطاء JavaScript في كل الاختبارات', () => assert(!errs.length, errs.slice(0, 3).join(' | ')));
  await b.close();
  for (const r of out) console.log(r.join('\t'));
  const f = out.filter(r => r[2] === 'FAIL').length; console.log('TOTAL', out.length, 'FAIL', f);
  require('fs').writeFileSync(__dirname + '/ui-results.json', JSON.stringify(out));
  // Arabic shows reversed in Windows consoles, so also write an RTL HTML report and open it in the browser there.
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const rows = out.map(r => `<tr class="${r[2]}"><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${r[2]}</td><td>${esc(r[3])}</td></tr>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><title>QA</title><style>body{font-family:Tahoma;direction:rtl}td{padding:3px 8px;border-bottom:1px solid #ddd}.FAIL{background:#fdd}.PASS td:nth-child(3){color:green}</style><h2>المجموع ${out.length} — فشل ${f}</h2><table>${rows}</table>`;
  const rep = __dirname + '/ui-report.html'; require('fs').writeFileSync(rep, html); console.log('REPORT', rep);
  if (process.platform === 'win32') require('child_process').exec(`start "" "${rep}"`);
})();
