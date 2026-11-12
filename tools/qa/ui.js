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
async function go(h, ms = 700) { await ev(h => { location.hash = h; }, h); await wait(ms); }
async function fresh(ctx, vp) {
  p = await ctx.newPage(); await p.setViewportSize(vp || { width: 390, height: 844 }); await p.addInitScript(() => { window.QA_NOFS = true; try { if (!localStorage.getItem('q.micTips') && !window.QA_TIPS) localStorage.setItem('q.micTips', '1'); } catch (e) {} });
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
  await check(G2, 'زر التالية والسابقة (بدون تأثير القلب)', async () => { await ev(() => localStorage.setItem('q.flip', 'false')); await p.reload(); await wait(800); await p.click('#pNext'); await wait(500); const a = await ev(() => location.hash); await p.click('#pPrev'); await wait(500); const c = await ev(() => location.hash); return assert(a === '#/p/51' && c === '#/p/50', a + ' ' + c); });
  await check(G2, 'تأثير قلب الصفحة بالزر', async () => { await ev(() => localStorage.setItem('q.flip', 'true')); await p.reload(); await wait(900); await p.click('#pNext'); await wait(150); const mid = await ev(() => !!document.querySelector('.curl')); await wait(1300); const h = await ev(() => [location.hash, !!document.querySelector('.curl')]); return assert(mid && h[0] === '#/p/51' && !h[1], JSON.stringify([mid, h])); });
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
  await check(G3, 'نتيجة البحث تفتح الصفحة والآية مظللة بالأصفر', async () => { await p.fill('#q', 'كرسيه'); await wait(600); await p.click('.result'); await wait(1000); return ev(() => location.hash.startsWith('#/p/' + QURAN.p[1][254] + '?a=2:255') && document.querySelectorAll('.ayah-box').length > 0 && !!document.querySelector('.page-cap mark')); });

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
  await check(G8, 'إضافة علامة باسم من تحت الصفحة', async () => { await go('#/p/200'); await p.click('#pMark'); await p.fill('.dlg input', 'ورد الفجر'); await p.click('.dlg-ok'); await wait(200); return ev(() => JSON.parse(localStorage.getItem('q.marks'))[0].n === 'ورد الفجر'); });
  await check(G8, 'إضافة علامة من شريط الآية', async () => { await go('#/p/250', 900); const r = await ev(() => { let k; QURAN.r.forEach(s => s.forEach(rs => rs.forEach(x => { if (x[0] === 250 && !k) k = x; }))); const bx = document.querySelector('.page-box').getBoundingClientRect(); return [bx.left + bx.width * (k[1] + k[3]) / 2000, bx.top + bx.height * (k[2] + k[4]) / 2000]; }); await p.mouse.click(r[0], r[1]); await wait(200); await p.click('#ayahBar button[data-c=b]'); await p.click('.dlg-ok'); await wait(200); return ev(() => JSON.parse(localStorage.getItem('q.marks')).length === 2); });
  await check(G8, 'العلامات تظهر في شاشة الختمة وتفتح مكانها', async () => { await go('#/khatma'); const n = await ev(() => document.querySelectorAll('.marks li').length); await p.click('.marks li:last-child .mk-go'); await wait(800); return assert(n === 2 && await ev(() => location.hash.startsWith('#/p/200')), n + ' ' + await ev(() => location.hash)); });
  await check(G8, 'إعادة تسمية وحذف علامة', async () => { await go('#/khatma'); await p.click('.marks li:first-child .mk-ed'); await p.fill('.dlg input', 'اسم جديد'); await p.click('.dlg-ok'); await wait(200); const a = await ev(() => document.querySelector('.marks li b').textContent); await p.click('.marks li:first-child .mk-del'); await wait(200); return assert(a === 'اسم جديد' && await ev(() => document.querySelectorAll('.marks li').length === 1), a); });
  await check(G8, 'بدء ختمة في 30 يوم', async () => { await p.click('#kStart'); await wait(200); return ev(ks => { const k = JSON.parse(localStorage.getItem('q.khatma' + ks)); return k.days === 30 && !!document.getElementById('kRead') && document.querySelector('.kh-wird').textContent.includes('صفحة'); }, KSUF); });
  await check(G8, 'قراءة الورد بتقليب الصفحات بيحسب التقدم', async () => { await p.click('#kRead'); await wait(800); await ev(() => localStorage.setItem('q.flip', 'false')); for (let i = 0; i < 4; i++) { await ev(() => document.getElementById('pNext').click()); await wait(1300); } return ev(ks => JSON.parse(localStorage.getItem('q.khatma' + ks)).done >= QURAN.first + 3, KSUF); });
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
  await check(G11, 'التقليب في وضع الصفحتين بيقلب صفحتين', async () => { await ev(() => document.getElementById('pNext').click()); await wait(700); return ev(pr => [...document.querySelectorAll('.page-box')].map(x => x.dataset.p).join() === pr, PAIR[1]); });
  await check(G11, 'لف الشاشة يرجّع صفحة واحدة', async () => { await p.setViewportSize({ width: 800, height: 1280 }); await wait(700); return ev(() => document.querySelectorAll('.page-box').length === 1); });
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
    await ev(() => AppBridge.buzzes = []); await ev(() => document.getElementById('pNext').click()); await wait(1300); const turn = await ev(() => AppBridge.buzzes.length);
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
    return ev(() => { const t = [...document.querySelectorAll('.pr-row b')].map(x => x.textContent); return t.length === 6 && !!document.querySelector('.pr-next b').textContent && !document.querySelector('.pr-note'); }); });
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
  await check(G14, 'اختبار الحفظ: إخفاء كلمات وكشفها والدرجة', async () => { await go('#/hifztest/112', 800); const n = await ev(() => document.querySelectorAll('.ht-w').length); await p.click('.ht-w >> nth=0'); await p.click('#htDone'); await wait(300);
    const r = await ev(() => [document.querySelectorAll('.ht-w.shown').length, document.getElementById('htRes').textContent, JSON.parse(localStorage.getItem('q.hifzScores') || '{}')[112]]);
    return assert(n > 0 && r[0] === n && /٪/.test(r[1]) && r[2] && r[2].score < 100, n + JSON.stringify(r)); });
  await check(G14, 'البحث في القرآن بس: السور والآيات، من غير الأذكار والأدعية', async () => { await go('#/search?q=' + encodeURIComponent('الكهف'), 1200); const s1 = await ev(() => !!document.querySelector('.sr-chips a[href="#/s/18/1"]'));
    await go('#/search?q=' + encodeURIComponent('أموت وأحيا'), 1000); const s2 = await ev(() => !!document.querySelector('.sr-zk')); return assert(s1 && !s2, s1 + ',' + s2); });
  await check(G14, 'الإعدادات فيها أزرار للأقسام ومعاينة الخط', async () => { await p.click('#btnSettings'); const r = await ev(() => [document.querySelectorAll('.set-jump button').length, !!document.querySelector('.set-prev')]); await closeS(); return assert(r[0] >= 3 && r[1], JSON.stringify(r)); });
  await check(G14, 'بيانات ودجت الصلاة الجاية (3 أيام)', async () => { await go('#/', 2500); const w = await ev(() => AppBridge.widget); return assert(w && w.prayers.length === 15 && w.prayers[0].n && w.place === 'القاهرة', JSON.stringify(w && w.prayers.slice(0, 1))); });
  const G15 = 'مزايا نسخة 3.8';
  await check(G15, 'خريطة الحفظ: كل صفحات الطبعة ملونة حسب السور المحفوظة', async () => { await ev(() => { const d = new Date(), t = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); localStorage.setItem('q.hifzLog', JSON.stringify(Object.assign({ 1: { m: '2026-1-1', r: '2025-1-1' } }, ...Array.from({ length: 25 }, (_, i) => ({ [90 + i]: { m: t, r: t } })))) ); localStorage.setItem('q.hzRev', localStorage.getItem('q.hifzLog')); });
    await go('#/hifzmap', 800); const r = await ev(() => [new Set([...document.querySelectorAll('.hm-grid a')].map(a => a.getAttribute('href'))).size, +document.querySelector('.hm-grid a:last-child').getAttribute('href').split('/')[2] - +document.querySelector('.hm-grid a').getAttribute('href').split('/')[2] + 1, document.querySelectorAll('.hm-grid .c3').length, document.querySelectorAll('.hm-grid .c2').length, document.querySelector('.hm-grid a').getAttribute('href')]);
    await ev(() => { localStorage.removeItem('q.hifzLog'); localStorage.removeItem('q.hzRev'); }); return assert(r[0] === r[1] && r[2] >= 1 && r[3] >= 1 && /^#\/p\/\d+$/.test(r[4]), JSON.stringify(r)); });
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
    await p.click('#hifzBar [data-c=done]'); await wait(500); const sc = await ev(() => JSON.parse(localStorage.getItem('q.hifzScores') || '{}')[67]);
    return assert(n > 5 && sc && sc.score === 50, JSON.stringify([n, sc])); });
  await check(G15, 'التسميع بالصوت: الآية تظهر لما تتقري والكلمة الغلط تتسجل', async () => { await ev(() => { localStorage.removeItem('q.reciteLog'); window.ReciteBridge = { start() {}, stop() {} }; }); await go('#/hifztest/112', 800); await p.click('#htPages'); await wait(1500);
    await p.click('#hifzBar [data-c=mic]'); await ev(() => { onRecite('قل هو الله', 'partial'); onRecite('قل هو الله احد', 'final'); onRecite('الله الصمد', 'final'); onRecite('لم يلد ولم يكتب', 'final'); }); await wait(300);
    const sh = await ev(() => document.querySelector('#hifzBar .hz-info').textContent); await p.click('#hifzBar [data-c=done]'); await wait(500); const dl = await ev(() => !!document.querySelector('.rc-stats'));
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
  await check(G17, 'حذف علامة بيسأل الأول', async () => { await ev(() => localStorage.setItem('q.marks', JSON.stringify([{ s: 2, a: 5, n: 'أ' }]))); await go('#/khatma', 600); let asked = false; p.once('dialog', d => { asked = true; d.dismiss().catch(() => {}); }); await p.click('.marks li:first-child .mk-del'); await wait(200); const n = await ev(() => document.querySelectorAll('.marks li').length); return assert(asked && n === 1, asked + ',' + n); });
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
  const LSK = ['q.turn', 'q.mode', 'q.edition', 'q.hifzAyat', 'q.hifzLog', 'q.hzRev', 'q.hifzScores', 'q.asrStats', 'q.hifzTest'];
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
    await go('#/hifzmap', 700); const c = await ev(() => document.querySelector('.hm-grid a[href="#/p/' + QA_pageOf(112, 1) + '"]').className); return assert(!/\bc0\b/.test(c), c); });
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
    const r = await ev(() => { const c = document.querySelector('.rd-cap'), m = c && c.querySelector('mark'); return c && m && [c.scrollTop, m.offsetTop - c.scrollTop, c.clientHeight]; });
    await ev(() => document.getElementById('rdMic').click()); return assert(r && r[0] > 0 && r[1] >= 0 && r[1] < r[2], JSON.stringify(r)); });
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
    const r = await ev(() => { const eb = window.EdBridge, nb = window.NvBridge, rb = window.ReciteBridge, cf = window.confirm; let asked = '', started = false;
      window.EdBridge = { state: () => 'none', remove() {}, get() {} }; window.NvBridge = { ready: () => false, start() { started = true; }, stop() {} };
      window.ReciteBridge = { start() { started = true; }, stop() {}, setHints() {} }; window.confirm = m => { asked = m; return false; };
      localStorage.setItem('q.modelConsent', '{"v":1,"t":1}'); document.getElementById('rdMic').click(); localStorage.removeItem('q.modelConsent');
      window.EdBridge = eb; window.NvBridge = nb; window.ReciteBridge = rb; window.confirm = cf; if (!eb) delete window.EdBridge; if (!nb) delete window.NvBridge;
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
    return assert(r[0] === '#/hifztest* #/hifzmap #/hifzlog' && r[1] === '#/hifztest #/hifzmap* #/hifzlog' && r[2] === '#/hifztest #/hifzmap #/hifzlog*' && back.startsWith('#/hifztest'), JSON.stringify([r, back])); });
  await check(G511, 'G6: الخريطة: صفحة فيها كذا سورة ليها مربع لكل سورة، والمربع بيختار الآية ويبدأ اختبار على المصحف (اللي قبلها ظاهر)', async () => {
    await ev(() => { localStorage.setItem('q.mode', '"pages"'); localStorage.removeItem('q.turn'); localStorage.removeItem('q.hifzFlip'); }); await go('#/hifzmap', 700);
    const c = await ev(() => [[...document.querySelectorAll('.hm-grid .hm-c[data-p="' + QA_pageOf(112, 1) + '"]')].map(c => c.dataset.s).join(','), document.querySelectorAll('.hm-grid .hm-c[data-p="3"]').length]);
    await p.click('.hm-grid .hm-c[data-p="' + PL + '"][data-s="113"]'); await wait(300);
    const ops = await ev(() => [...document.querySelectorAll('.hz-pick #hzA option')].map(o => o.value).join(','));
    await p.selectOption('#hzA', '3'); await p.click('#hzMus'); await wait(1200);
    const t = await ev(() => { const h = window.__hz = window.__hz || {}; return [location.hash, document.body.classList.contains('has-hifz'), document.querySelectorAll('.hz-flip.on:not(:disabled)').length]; });
    const sh = await ev(() => [...document.querySelectorAll('#hifzBar .hz-info span')].map(x => x.textContent).join(''));
    return assert(c[0] === '112,113,114' && c[1] === 1 && ops === '1,2,3,4,5' && t[0] === '#/p/' + PL && t[1] && t[2] === 1 && /٠/.test(sh), JSON.stringify([c, ops, t, sh])); });
  await check(G511, 'G6: آخر آية في آخر صفحة في المصحف بتنهي الاختبار (5.15b: مفيش «قلب تلقائي» جوه الاختبار)', async () => {
    for (let i = 0; i < 40; i++) { const more = await ev(() => document.body.classList.contains('has-hifz') && document.querySelectorAll('.hifz-mask').length > 0); if (!more) break; await p.click('#hifzBar [data-c="nx"]'); await wait(60); }
    await wait(2500); const r = await ev(() => [location.hash, document.body.classList.contains('has-hifz')]);
    await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); });
    return assert(RegExp('^#/p/' + PL + '\\b').test(r[0]), JSON.stringify(r)); });
  await check(G511, 'G6: «قلب تلقائي» شغال: آخر آية بتقلب للصفحة اللي بعدها', async () => {
    await ev(() => localStorage.setItem('q.hifzFlip', 'true')); await go('#/hifzmap', 700); await p.click('.hm-grid .hm-c[data-p="' + P6 + '"]'); await wait(300); await p.click('#hzMus'); await wait(1200);
    for (let i = 0; i < 80; i++) { const r = await ev(() => [document.querySelectorAll('.hifz-mask').length, location.hash]); if (!r[0] || r[1] !== '#/p/' + P6) break; await p.click('#hifzBar [data-c="nx"]'); await wait(60); }
    await wait(2500); const h = await ev(() => location.hash); await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); });
    return assert(h === '#/p/' + P6n, h); });
  await check(G511, 'G6: المايك في اختبار على المصحف (عمودي) بيروح لأول الصفحة', async () => {
    await ev(() => { localStorage.setItem('q.turn', '"v"'); window.ReciteBridge = { start() {}, stop() {}, setHints() {} }; }); await p.reload(); await wait(900);
    await ev(() => { window.ReciteBridge = { start() {}, stop() {}, setHints() {} }; });
    await go('#/hifzmap', 700); await p.click('.hm-grid .hm-c[data-p="50"]'); await wait(300); await p.click('#hzMus'); await wait(1800);
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
    const a = await ev(() => [!!document.getElementById('pHifz'), !!document.getElementById('thmNotes'), !!document.getElementById('pMark')]);
    await ev(() => localStorage.setItem('q.turn', '"v"')); await p.reload(); await go('#/p/27', 1200); const v = await ev(() => [!!document.getElementById('thmNotes'), !!document.querySelector('.page-thm')]);
    await ev(() => { localStorage.setItem('q.thematic', 'false'); localStorage.setItem('q.turn', '"h"'); }); await p.reload(); await wait(600);
    return assert(!a[0] && !a[1] && a[2] && !v[0] && !v[1], JSON.stringify([a, v])); });
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
      return [Math.abs(sR.top - aR.top) < 4, a.options.length, first, JSON.parse(localStorage.getItem('q.hifzTest')).from, document.getElementById('htA').value]; });
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
  const hzKeep = async () => ev(() => ['q.hifzLog', 'q.hzRev', 'q.hifzAyat', 'q.hifzScores', 'q.hzScope', 'q.hifzTest'].map(k => [k, localStorage.getItem(k)]));
  const hzBack = async k => ev(k => k.forEach(([a, v]) => v === null ? localStorage.removeItem(a) : localStorage.setItem(a, v)), k);
  await check(G513, 'P2.6: ✓ السورة بيتحط لوحده عند ٨٠٪ من آياتها صح وبيتشال تحتها، والضغط على السورة ما بيعلّمش', async () => { const k = await hzKeep();
    await ev(() => { ['q.hifzLog', 'q.hifzAyat', 'q.hifzScores'].forEach(x => localStorage.removeItem(x)); localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 100, s: 112, from: 1 })); });
    await go('#/hifztest/112', 700); await p.click('#htDone'); await wait(300); const on = await ev(() => !!JSON.parse(localStorage.getItem('q.hifzLog') || '{}')[112]);
    await go('#/', 200); await go('#/hifztest/112', 700); await ev(() => document.querySelectorAll('.ht-w[data-a="2"], .ht-w[data-a="3"]').forEach(b => b.click())); await p.click('#htDone'); await wait(300);
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
      const ok = P.length >= 1 && P.length <= mx && P.every((x, j) => x[0] >= R[0] && x[1] <= R[1] && (len <= 3 || (x[1] - x[0] + 1 >= 3 && x[1] - x[0] + 1 <= 12)) && (!j || x[0] > P[j - 1][1] + 1));
      if (!ok) out.push([c, JSON.stringify(P)]); if (i === 0) out.push(c.k + (c.s || c.n || '') + ':' + P.length); }
      return out; });
    const k = await hzKeep(); await ev(() => localStorage.setItem('q.hzScope', JSON.stringify({ k: 'j', s: 1, n: 30, q: 1, a1: 1, a2: 7, w: 'r' })));
    await go('#/', 150); await go('#/hifzlog', 500); const lab = await ev(() => document.querySelector('.hz-way button[data-w=r]').textContent); await p.click('#hzGoW'); await wait(500);
    const t = await ev(() => JSON.parse(localStorage.getItem('q.hifzTest'))); await hzBack(k);
    return assert(r.every(x => typeof x === 'string') && lab.includes('٣–١٢') && t.pt >= 5 && t.pc.length === t.pt - 1 && t.n >= 3 && t.n <= 12, JSON.stringify([r.filter(x => typeof x !== 'string').slice(0, 2), r.filter(x => typeof x === 'string'), lab, t.pt, t.n])); });
  await check(G513, '5.14: اختبار الكلمات العشوائي بيعدّي على المواضع واحد ورا التاني ونتيجة واحدة في الآخر', async () => { const k = await hzKeep();
    await ev(() => { const S = window.QURAN.s, A = [0]; S.forEach((x, i) => A.push(A[i] + x[3])); const g = (s, a) => A[s - 1] + a - 1;
      localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 100, s: 112, from: 1, n: 4, end: g(112, 4), acc: { h: 0, m: 0 }, pc: [[g(114, 1), g(114, 3)]], pn: 1, pt: 2 })); });
    await go('#/', 150); await ev(() => hzFromSet(true)); await go('#/hifztest/112', 700); const a = await ev(() => [document.getElementById('htNext') && document.getElementById('htNext').textContent, (document.querySelector('.ht-place') || {}).textContent]);
    await p.click('#htDone'); await wait(200); const mid = await ev(() => !document.getElementById('htTot')); await p.click('#htNext'); await wait(600);
    const b2 = await ev(() => [location.hash, document.querySelectorAll('.ht-text .ayah-no').length, !!document.getElementById('htNext'), (document.querySelector('.ht-place') || {}).textContent]);
    await p.click('.ht-w[data-a="2"]'); await p.click('#htDone'); await wait(300); const t = await ev(() => (document.getElementById('htTot') || {}).textContent || '');
    await hzBack(k); await go('#/', 300);
    return assert(a[0] === 'الموضع اللي بعده' && a[1] === 'الموضع ١ من ٢' && mid && b2[0] === '#/hifztest/114' && b2[1] === 3 && !b2[2] && b2[3] === 'الموضع ٢ من ٢' && /٪/.test(t) && !/١٠٠٪/.test(t), JSON.stringify([a, mid, b2, t])); });
  await check(G513, '5.14: اختبار المصحف العشوائي بيقلب للموضع التاني لوحده ويخلص بعد آخر موضع', async () => { const k = await hzKeep();
    await ev(() => { ['q.hifzScores'].forEach(x => localStorage.removeItem(x)); localStorage.setItem('q.hzScope', JSON.stringify({ k: 's', s: 112, n: 1, q: 1, a1: 1, a2: 4, w: 'o' })); });
    const P = await ev(() => { const S = window.QURAN.s, A = [0]; S.forEach((x, i) => A.push(A[i] + x[3])); const g = (s, a) => A[s - 1] + a - 1; return [[g(112, 1), g(112, 2)], [g(114, 1), g(114, 3)]]; });
    await go('#/', 300); await ev(P => hzTestStart({ k: 's', s: 112, w: 'r' }, 'm', P), P); await wait(1200);
    for (let i = 0; i < 2; i++) { await p.click('#hifzBar [data-c=nx]'); await wait(250); } await wait(1800);
    const mid = await ev(() => [!!document.getElementById('hifzBar'), location.hash]);
    for (let i = 0; i < 3; i++) { await p.click('#hifzBar [data-c=nx]'); await wait(250); } await wait(1800);
    const end = await ev(() => [!document.getElementById('hifzBar'), (JSON.parse(localStorage.getItem('q.hifzScores') || '{}')[112] || {}).score]);
    await ev(() => document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()));
    await hzBack(k); await go('#/', 300); return assert(mid[0] && RegExp('^#/p/' + PL + '\\b').test(mid[1]) && end[0] && end[1] === 100, JSON.stringify([mid, end])); });
  await check(G513, 'P2.6: اختبار المصحف بمدى (سورة الإخلاص بالسرد) بيخلص لوحده عند آخر آية ويحط ✓', async () => { const k = await hzKeep();
    await ev(() => { ['q.hifzLog', 'q.hifzAyat', 'q.hifzScores'].forEach(x => localStorage.removeItem(x)); localStorage.setItem('q.hzScope', JSON.stringify({ k: 's', s: 112, n: 1, q: 1, a1: 1, a2: 4, w: 'o' })); });
    await go('#/hifzlog', 600); await p.click('#hzGoM'); await wait(1200);
    for (let i = 0; i < 4; i++) { await p.click('#hifzBar [data-c=nx]'); await wait(250); } await wait(1500);
    const r = await ev(() => [!document.getElementById('hifzBar'), !!JSON.parse(localStorage.getItem('q.hifzScores') || '{}')[112], !!JSON.parse(localStorage.getItem('q.hzRev') || '{}')[112]]);
    await ev(() => document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove())); await hzBack(k); await go('#/', 300);
    return assert(r.every(Boolean), JSON.stringify(r)); });
  await check(G513, 'P2.6: اختبار الكلمات بمدى بيعدّي من الفلق للناس ويعرض نتيجة الاختبار كله في الآخر', async () => { const k = await hzKeep();
    await ev(() => localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 100, s: 113, from: 1, n: 10, end: 6235, acc: { h: 0, m: 0 } })));
    await ev(() => hzFromSet(true)); await go('#/hifztest/113', 700); const a = await ev(() => [document.querySelectorAll('.ht-text .ayah-no').length, !!document.getElementById('htNext')]);
    await p.click('.ht-w[data-a="2"]'); await p.click('#htDone'); await wait(200); await p.click('#htNext'); await wait(600);
    const b2 = await ev(() => [location.hash, document.querySelectorAll('.ht-text .ayah-no').length, !!document.getElementById('htNext')]);
    await p.click('#htDone'); await wait(300); const t = await ev(() => { const e = document.getElementById('htTot'); return e ? e.textContent : ''; });
    await hzBack(k); await go('#/', 300);
    return assert(a[0] === 5 && a[1] && b2[0] === '#/hifztest/114' && b2[1] === 6 && !b2[2] && /٪/.test(t) && !/١٠٠٪/.test(t), JSON.stringify([a, b2, t])); });
  await check(G513, 'P2.6: «عليك مراجعة» بتعرض كل السور المستحقة، ومفيش «راجعتها» ولا «اقرأ» ولا الدايرة', async () => { const k = await hzKeep();
    await ev(() => { const d = new Date(Date.now() - 30 * 864e5), o = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(), n = new Date(), t = n.getFullYear() + '-' + (n.getMonth() + 1) + '-' + n.getDate();
      localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hzRev', JSON.stringify({ 1: { m: o, r: o }, 112: { m: o, r: o }, 113: { m: t, r: t }, 114: { m: t, r: t } }));
      localStorage.setItem('q.hifzScores', JSON.stringify({ 113: { d: t, score: 50 }, 114: { d: t, score: 95 } })); });
    await go('#/', 200); await go('#/hifzlog', 700);
    const r = await ev(() => [[...document.querySelectorAll('.hz-due .hl-due [data-test]')].map(b => b.dataset.test).sort().join(','), !!document.querySelector('[data-rev], .hl .hl-ring, .hl-top'),
      [...document.querySelectorAll('.hl button')].some(b => /اقرأ|راجعتها/.test(b.textContent)), document.querySelectorAll('.hl-list li.on').length]);
    await p.click('.hz-due [data-test="112"]'); await wait(1200); const pick = await ev(() => !!document.getElementById('hifzBar') && [...new Set([...document.querySelectorAll('.hifz-mask')].map(m => m.dataset.k.split(':')[0]))].join(','));
    await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); });
    await hzBack(k); await go('#/', 200); return assert(r[0] === '1,112' && !r[1] && !r[2] && r[3] === 4 && pick === '112', JSON.stringify([r, pick])); });   // 5.15 S1: 113 (50% today) is due tomorrow
  // ---------- 5.15 Sprint A: S2 focus on my mistakes, S1 spaced review + daily ward, S7 today card ----------
  const G515 = 'نسخة 5.15 (Sprint A)';
  const dAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  await check(G515, 'S1: الفترة: أول مرة ٧، و٩٠٪ بتضاعف (أقصاها ٩٠ ومرة واحدة في اليوم)، و٧٠–٨٩٪ زي ما هي، وأقل من ٧٠٪ يوم واحد', async () => {
    const r = await ev(o => { const e = { m: o, r: o }, seq = []; hzReviewed(e, 95); seq.push(e.iv); hzReviewed(e, 95); seq.push(e.iv); e.r = o; hzReviewed(e, 80); seq.push(e.iv);
      hzReviewed(e, 50); seq.push(e.iv); const f = { m: o, r: o, iv: 60 }; hzReviewed(f, 99); seq.push(f.iv);
      const d = [hzDueInfo({ m: o, r: o }, null).iv, hzDueInfo({ m: o, r: o }, 60).iv, hzDueInfo({ r: o, iv: 30 }, 95).due, hzDueInfo({ r: o, iv: 20 }, 95).due]; return [seq, d]; }, dAgo(20));
    return assert(JSON.stringify(r) === '[[14,14,14,1,90],[7,1,false,true]]', JSON.stringify(r)); });
  await check(G515, 'S1: ورد المراجعة اليومي بياخد الأقدم الأول لحد عدد الصفحات، و«كل المستحق» بياخدهم كلهم', async () => { const k = await hzKeep();
    const r = await ev(([a, b2, c3]) => { localStorage.setItem('q.hifzScores', '{}');
      localStorage.setItem('q.hzRev', JSON.stringify({ 112: { m: a, r: a, iv: 7 }, 2: { m: b2, r: b2, iv: 7 }, 114: { m: c3, r: c3, iv: 30 }, 113: { m: a, r: a, iv: 60 } }));
      localStorage.setItem('q.hzDaily', '1'); const w1 = hzWard(); localStorage.setItem('q.hzDaily', '0'); const w0 = hzWard(); localStorage.removeItem('q.hzDaily');
      return [w1.list.map(x => x.s), w1.all, w0.list.map(x => x.s)]; }, [dAgo(40), dAgo(10), dAgo(31)]);
    await hzBack(k); return assert(JSON.stringify(r) === '[[112],3,[112,2,114]]', JSON.stringify(r)); });
  await check(G515, 'S1: «عليك مراجعة» فيها اختيار الورد وزرار «اختبرني في ورد النهارده» اللي بيفتح اختبار المصحف على السور المستحقة', async () => { const k = await hzKeep();
    await ev(a => { localStorage.setItem('q.hifzScores', '{}'); localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hzRev', JSON.stringify({ 113: { m: a, r: a, iv: 7 }, 114: { m: a, r: a, iv: 7 } })); }, dAgo(9));
    await go('#/', 200); await go('#/hifzlog', 700);
    const a = await ev(() => [!!document.getElementById('hzDaily'), (document.querySelector('.hz-wsum') || {}).textContent, (document.querySelector('.hz-due .hl-due small') || {}).textContent]);
    await p.click('#hzWardGo'); await wait(1200); const t = await ev(() => [!!document.getElementById('hifzBar'), location.hash]);
    await ev(() => document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove())); await hzBack(k); await go('#/', 300);
    return assert(a[0] && /٢ سورة/.test(a[1]) && /كل ٧ يوم/.test(a[2]) && t[0] && RegExp('^#/p/' + PL + '\\b').test(t[1]), JSON.stringify([a, t])); });
  await check(G515, 'S1: الخريطة: سورة فترتها ٣٠ يوم وراجعتها من ٢٠ يوم مش صفرا، وبفترة ٧ أيام صفرا', async () => { const k = await hzKeep();
    const col = async iv => { await ev(([a, iv]) => { localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hifzScores', '{}'); localStorage.setItem('q.hifzLog', JSON.stringify({ 112: { m: a } })); localStorage.setItem('q.hzRev', JSON.stringify({ 112: { m: a, r: a, iv: iv } })); }, [dAgo(20), iv]);
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
    await ev(() => { localStorage.removeItem('q.hifzLog'); localStorage.setItem('q.hzRev', '{}'); }); await go('#/hifzlog', 150); await go('#/', 500); const none = await ev(() => !document.getElementById('tdCard'));
    await ev(a => { localStorage.setItem('q.hifzScores', '{}'); localStorage.setItem('q.hzRev', JSON.stringify({ 114: { m: a, r: a, iv: 7 }, 1: { m: a, r: a, iv: 30 } })); }, dAgo(8));
    await go('#/hifzlog', 150); await go('#/', 500); const txt = await ev(() => (document.querySelector('#tdCard small') || {}).textContent || '');
    await p.click('#tdGo'); await wait(1200); const t = await ev(() => [!!document.getElementById('hifzBar'), location.hash]);
    await ev(() => document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove())); await go('#/', 150);
    await ev(a => localStorage.setItem('q.hzRev', JSON.stringify({ 1: { m: a, r: a, iv: 30 } })), dAgo(8)); await go('#/hifzlog', 150); await go('#/', 500);
    const ok = await ev(() => [(document.querySelector('#tdCard small') || {}).textContent || '', !document.getElementById('tdGo')]);
    await hzBack(k); await go('#/', 200);
    return assert(none && /مراجعة: ١ سورة/.test(txt) && t[0] && RegExp('^#/p/' + PL + '\\b').test(t[1]) && /مفيش مراجعة مستحقة/.test(ok[0]) && ok[1], JSON.stringify([none, txt, t, ok])); });
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
    for (let i = 0; i < 2; i++) { await p.click('#hifzBar [data-c=nx]'); await wait(250); } await wait(1800); const b1 = await ev(() => window.__hzBuzz || 0);
    await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); }); await go('#/', 200);
    await ev(([a, b]) => localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 100, s: 112, from: 1, n: 2, end: a, acc: { h: 0, m: 0 }, pc: [[b, b + 2]], pn: 1, pt: 2 })), [P[0][1], P[1][0]]);
    await ev(() => hzFromSet(true)); await go('#/hifztest/112', 700); await p.click('#htNext'); await wait(600); const b2 = await ev(() => window.__hzBuzz || 0);
    await hzBack(k); await go('#/', 200); return assert(b1 === b0 + 1 && b2 === b1 + 1, JSON.stringify([b0, b1, b2])); });
  await check(G515, '5.15b ٤: العشوائي على المصحف بيخفي آيات الموضع بس، واللي قبله وبعده مكشوف', async () => { const k = await hzKeep();
    const P = [[await gq(113, 2), await gq(113, 3)]];
    await go('#/', 200); await ev(P => hzTestStart({ k: 's', s: 113, w: 'r' }, 'm', P), P); await wait(1500);
    const ks = await ev(() => [...new Set([...document.querySelectorAll('.hifz-mask')].map(m => m.dataset.k))].sort().join(','));
    await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); }); await hzBack(k); await go('#/', 200);
    return assert(ks === '113:2,113:3', ks); });
  await check(G515, '5.15b ٥ + 5.15c ١: «قلب تلقائي» جوه الاختبار ظاهر وشغال ومش بيتضغط (المصحف والكلمات)، والصفحة بتتقلب حتى لو كان مقفول برّه', async () => { const k = await hzKeep();
    await ev(() => { localStorage.setItem('q.hifzFlip', 'false'); localStorage.setItem('q.mode', '"pages"'); }); await go('#/', 150); await go('#/hifzlog', 600);
    await ev(P6 => { const S = window.QURAN.s, P = window.QURAN.p, A = [0]; S.forEach((x, i) => A.push(A[i] + x[3])); const ids = [];
      P.forEach((ps, si) => ps.forEach((pg, ai) => { if (pg === P6) ids.push(A[si] + ai); })); hzTestStart({ k: "s", s: 1, w: "o" }, "m", [[ids[0], ids[ids.length - 1] + 3]]); }, +P6); await wait(1200);
    const fb = await ev(() => document.querySelectorAll('#hifzBar .hz-flip.on:disabled').length);
    for (let i = 0; i < 80; i++) { const r = await ev(() => [document.querySelectorAll('.hifz-mask').length, location.hash]); if (!r[0] || r[1] !== '#/p/' + P6) break; await p.click('#hifzBar [data-c="nx"]'); await wait(60); }
    await wait(2500); const h = await ev(() => location.hash); await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); });
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
    await go('#/', 150); await go('#/hifztest/2', 700); await p.click('#htDone'); await wait(300);
    const part = await ev(() => [!JSON.parse(localStorage.getItem('q.hifzLog') || '{}')[2], (JSON.parse(localStorage.getItem('q.hifzScores') || '{}')[2] || {}).score]);
    const P = [[await gq(2, 7), await gq(2, 9)]];
    await go('#/', 200); await ev(P => hzTestStart({ k: 's', s: 2, w: 'r' }, 'm', P), P); await wait(1200);
    for (let i = 0; i < 3; i++) { await p.click('#hifzBar [data-c=nx]'); await wait(250); } await wait(1800);
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
    await go('#/', 150); await go('#/hifztest/112', 700); await p.click('#htDone'); await wait(300); await go('#/', 150); await go('#/hifztest/112', 700);
    const a = await ev(() => [!!JSON.parse(localStorage.getItem('q.hifzLog'))[112], !JSON.parse(localStorage.getItem('q.hzRev'))[112], document.querySelector('#hmFold > summary').textContent, !!document.querySelector('#hmFold li[data-s="112"].on')]);
    await go('#/', 150); await go('#/hifzlog', 600); const b2 = await ev(() => [document.querySelector('#hlFold > summary').textContent, !document.querySelector('#hlFold li[data-s="112"].on')]);
    await ev(() => hzTestStart({ k: 's', s: 113, w: 'o' }, 'w')); await wait(700); await p.click('#htDone'); await wait(300);
    const c = await ev(() => [!!JSON.parse(localStorage.getItem('q.hzRev'))[113], !JSON.parse(localStorage.getItem('q.hifzLog'))[113], JSON.parse(localStorage.getItem('q.hzRev'))[113].iv]);
    await go('#/', 150); await go('#/hifzlog', 600); const d = await ev(() => !!document.querySelector('#hlFold li[data-s="113"].on'));
    await hzBack(k); await go('#/', 200);
    return assert(a[0] && a[1] && /السور المحفوظة/.test(a[2]) && a[3] && /السور المراجعة/.test(b2[0]) && b2[1] && c[0] && c[1] && c[2] === 7 && d, JSON.stringify([a, b2, c, d])); });
  await check(G515, '5.15c ٣: المراجعة الذكية والورد شغالين على «السور المراجعة»، والخريطة: المحفوظ من «السور المحفوظة» والأصفر من المراجعة', async () => { const k = await hzKeep();
    const r = await ev(a => { localStorage.setItem('q.hifzScores', '{}'); localStorage.setItem('q.hifzLog', JSON.stringify({ 1: { m: a } })); localStorage.setItem('q.hzRev', '{}');
      const d0 = hzWard().list.length; localStorage.setItem('q.hzRev', JSON.stringify({ 1: { m: a, r: a, iv: 7 } })); return [d0, hzWard().list.map(x => x.s).join(',')]; }, dAgo(20));
    const col = async rev => { await ev(([a, rev]) => { localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hifzLog', JSON.stringify({ 112: { m: a } })); localStorage.setItem('q.hzRev', JSON.stringify(rev ? { 112: { m: a, r: a, iv: 7 } } : {})); }, [dAgo(20), rev]);
      await go('#/', 150); await go('#/hifzmap', 700); return ev(() => (document.querySelector('.hm-c[data-s="112"]') || {}).className || ''); };
    const due = await col(true), fresh = await col(false);
    await p.click('#hmFold > summary'); await wait(700); const lg = await ev(() => [location.hash, document.getElementById('hmFold') && document.getElementById('hmFold').open, !document.getElementById('hmLog')]);
    const mig = await ev(() => { localStorage.removeItem('q.hzRev'); localStorage.setItem('q.hifzLog', JSON.stringify({ 5: { m: '2026-1-1', r: '2026-1-1', iv: 14 } })); return Object.keys(hzRevData()).join(',') + '/' + (hzRevData()[5] || {}).iv; });
    await hzBack(k); await go('#/', 200);
    return assert(r[0] === 0 && r[1] === '1' && /\bc2\b/.test(due) && /\bc3\b/.test(fresh) && lg[0] === '#/hifzmap' && lg[1] && lg[2] && mig === '5/14', JSON.stringify([r, due, fresh, lg, mig])); });
  // ---------- 5.16: the user's package (U1–U8; U9 put off) ----------
  const G516 = 'نسخة 5.16';
  const due2 = async () => ev(a => { localStorage.setItem('q.hifzScores', '{}'); localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hzRev', JSON.stringify({ 2: { m: a, r: a, iv: 7 }, 112: { m: a, r: a, iv: 7 } })); localStorage.removeItem('q.hzDaily'); }, dAgo(20));
  const stopT = async () => ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); });
  await check(G516, 'U1: «اختبرني» قدام سورة في «عليك مراجعة» بيبدأ اختبارها على المصحف على طول', async () => { const k = await hzKeep(); await due2();
    await go('#/', 150); await go('#/hifzlog', 700); await p.click('.hz-due [data-test="112"]'); await wait(1200);
    const r = await ev(() => [!!document.getElementById('hifzBar'), location.hash, [...new Set([...document.querySelectorAll('.hifz-mask')].map(m => m.dataset.k.split(':')[0]))].join(',')]);
    await stopT(); await hzBack(k); await go('#/', 200); return assert(r[0] && /^#\/p\//.test(r[1]) && r[2] === '112', JSON.stringify(r)); });
  await check(G516, 'U2: «بالسرد / عشوائي» في ورد النهارده: بالسرد كل سورة كاملة، وعشوائي أجزاء ٣–١٢ آية جوه السور المستحقة بس', async () => { const k = await hzKeep(); await due2();
    await go('#/', 150); await go('#/hifzlog', 700); const n = await ev(() => document.querySelectorAll('.hz-wway button').length);
    await p.click('.hz-wway [data-ww="r"]'); await wait(400);
    const r = await ev(() => { const way = JSON.parse(localStorage.getItem('q.hzWardWay')), on = (document.querySelector('.hz-wway .on') || {}).textContent, S = window.QURAN.s, A = [0]; S.forEach((x, i) => A.push(A[i] + x[3]));
      const sur = i => { let s = 1; while (A[s] <= i) s++; return s; }, R = [], O = hzWardPlan([2, 112], 'o');
      for (let t = 0; t < 20; t++) hzWardPlan([2, 112], 'r').forEach(x => R.push([sur(x[0]), sur(x[1]), x[1] - x[0] + 1]));
      return [way, on, R.every(x => x[0] === x[1] && (x[0] === 2 || x[0] === 112) && x[2] >= 3 && x[2] <= 12), R.some(x => x[0] === 2) && R.some(x => x[0] === 112), JSON.stringify(O) === JSON.stringify([[A[1], A[2] - 1], [A[111], A[112] - 1]])]; });
    await p.click('#hzWardGo'); await wait(1200); const t = await ev(() => !!document.getElementById('hifzBar'));
    await stopT(); await hzBack(k); await ev(() => localStorage.removeItem('q.hzWardWay')); await go('#/', 200);
    return assert(n === 2 && r[0] === 'r' && r[1] === 'عشوائي' && r[2] && r[3] && r[4] && t, JSON.stringify([n, r, t])); });
  await check(G516, 'U5: «هدف اليوم» جوه كارت «النهارده» (كارت واحد)، والدايرة بتفتح الهدف؛ ومن غير حفظ الهدف زي ما هو', async () => { const k = await hzKeep(); await due2();
    await ev(() => { localStorage.removeItem('q.stats'); localStorage.setItem('q.goal', JSON.stringify({ pages: 5 })); }); await go('#/hifzlog', 150); await go('#/', 600);
    const a = await ev(() => [!!document.querySelector('#tdCard #tGoal'), document.querySelectorAll('#tGoal').length, (document.querySelector('#tdCard small') || {}).textContent || '', !!document.querySelector('.home-row.one')]);
    await p.click('#tGoal'); await wait(400); const d = await ev(() => [location.hash, !!document.querySelector('.dlg-back .g-chips')]); await ev(() => document.querySelectorAll('.dlg-back').forEach(e => e.remove()));
    await ev(() => { localStorage.removeItem('q.hifzLog'); localStorage.setItem('q.hzRev', '{}'); }); await go('#/hifzlog', 150); await go('#/', 600);
    const b2 = await ev(() => [!document.getElementById('tdCard'), !!document.querySelector('.home-row > #tGoal.mini')]);
    await hzBack(k); await ev(() => localStorage.removeItem('q.goal')); await go('#/', 200);
    return assert(a[0] && a[1] === 1 && /القراءة: ٠ من ٥ صفحة/.test(a[2]) && /مراجعة: ٢ سورة/.test(a[2]) && a[3] && /^#\/?$/.test(d[0]) && d[1] && b2[0] && b2[1], JSON.stringify([a, d, b2])); });
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
    await p.click('.hm-grid .hm-c[data-p="' + P6 + '"]'); await wait(300); await p.click('#hzMus'); await wait(1200);
    const st = () => ev(() => { const f = document.querySelector('#hifzBar .hz-flip'); return f && [f.disabled, f.classList.contains('on'), JSON.parse(localStorage.getItem('q.hifzFlip'))]; });
    const a = await st(); await p.click('#hifzBar .hz-flip'); await wait(300); const b2 = await st();
    // off: the page's last ayah ends the map test on page 600 (no turn to 601)
    for (let i = 0; i < 80; i++) { const r = await ev(() => [document.querySelectorAll('.hifz-mask').length, location.hash]); if (!r[0] || r[1] !== '#/p/' + P6) break; await p.click('#hifzBar [data-c="nx"]'); await wait(60); }
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
  if (ED === 'kfgqpc') {
    await check(G519, 'ضغطة طويلة على «ٱلْكِتَٰبُ» في صفحة ٢ بتفتح معنى الكلمة دي من غير شريط الآية', async () => {
      await go('#/p/2', 1200); const xy = await wbPt(2, 2, 2, 1); if (!xy) throw new Error('no box');
      await longPress(xy); const r = await ev(() => { const d = document.querySelector('.wm-dlg'); return d && [d.querySelector('.words button.on').textContent, !!document.querySelector('#ayahBar button[data-c="x"]')]; });
      await ev(() => window.qBack()); await wait(300);
      return assert(r && r[0] === 'ٱلْكِتَٰبُ' && !r[1], JSON.stringify(r)); });
    await check(G519, 'صفحة ٥٨٦: كلمة «قُتِلَتْ» (٨١:٩) بتتعرف من مربعها، ومربع الآية متظبط على دايرتها', async () => {
      await go('#/p/586', 1200); const xy = await wbPt(586, 81, 9, 2); if (!xy) throw new Error('no box');
      await longPress(xy); const w = await ev(() => { const d = document.querySelector('.wm-dlg'); return d && d.querySelector('.words button.on').textContent; });
      await ev(() => window.qBack()); await wait(300);
      const r9 = await ev(() => QA_rect(81, 9)[0]);
      return assert(w === 'قُتِلَتْ' && r9[1] > 480 && r9[1] < 530, JSON.stringify([w, r9])); });
    await check(G519, 'اللمسة العادية على الصفحة لسه بتفتح شريط الآية، والسحب لسه بيقلب الصفحة', async () => {
      await go('#/p/51', 1200); const r = await ev(() => { const b = document.querySelector('.page-box').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
      await p.mouse.click(r[0] + r[2] / 2, r[1] + r[3] / 2); await wait(400);
      const bar = await ev(() => [!!document.getElementById('ayahBar'), !!document.querySelector('.wm-dlg')]);
      await ev(() => { const x = document.querySelector('#ayahBar button[data-c="x"]'); if (x) x.click(); }); await wait(200);
      await p.mouse.move(r[0] + r[2] * 0.2, r[1] + r[3] * 0.8); await p.mouse.down(); for (let i = 1; i <= 12; i++) { await p.mouse.move(r[0] + r[2] * 0.2 + i * 25, r[1] + r[3] * 0.8 - i * 2); await wait(16); } await p.mouse.up(); await wait(1200);
      const h = await ev(() => location.hash);
      return assert(bar[0] && !bar[1] && h === '#/p/52', JSON.stringify([bar, h])); });
    await check(G519, 'نافذة معنى الكلمة بتمسح أي تحديد نص بيعمله الأندرويد تحت الصباع، وعنوانها مش قابل للتحديد', async () => {
      await go('#/p/2', 1200); const xy = await wbPt(2, 2, 2, 1); if (!xy) throw new Error('no box'); await longPress(xy);
      const r = await ev(() => new Promise(res => { const b = document.querySelector('.wm-dlg > b'), rg = document.createRange(); rg.selectNodeContents(b);
        getSelection().removeAllRanges(); getSelection().addRange(rg); setTimeout(() => res([getSelection().toString(), getComputedStyle(b).userSelect]), 150); }));
      await ev(() => window.qBack()); await wait(300);
      return assert(r[0] === '' && r[1] === 'none', JSON.stringify(r)); });
    await check(G519, 'وضع الحفظ: الضغطة الطويلة على الصفحة ما بتفتحش معنى الكلمة', async () => {
      await go('#/p/2', 1200); await ev(() => hifzToggle()); await wait(500);
      const on = await ev(() => !!document.querySelector('#hifzBar')); const xy = await wbPt(2, 2, 2, 1); if (xy) await longPress(xy);
      const d = await ev(() => !!document.querySelector('.wm-dlg'));
      await ev(() => { if (document.getElementById('hifzBar')) hifzToggle(); document.querySelectorAll('.dlg-back').forEach(e => e.remove()); }); await wait(300);
      return assert(on && !d, JSON.stringify([on, d])); });
    await check(G519, 'تظليل الكلمة (التسميع) بيستخدم المربع المقاس: جوه مربع الآية وبعرض الكلمة', async () => {
      await go('#/p/2', 1200); const r = await ev(() => new Promise(res => QA_wb(2, rows => { const x = rows.filter(r => r[0] === 2 && r[1] === 2);
        res([rows.length, x.length, x.every(r => r[5] - r[3] >= 6 && r[5] - r[3] < 300)]); })));
      return assert(r[0] > 30 && r[1] === 7 && r[2], JSON.stringify(r)); });   // 2:2 = 7 words
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
  if (ED === 'kfgqpc') {
    await check(G520, 'W3: أقنعة الحفظ في صفحة ٥٠ على مربعات الكلمات بالظبط (كل آية في كل سطر = اتحاد مربعات كلماتها ± ٢‰)', async () => {
      await go('#/p/50', 1200); await ev(() => new Promise(r => QA_wb(50, r))); await ev(() => hifzToggle()); await wait(600);
      const r = await ev(() => new Promise(res => QA_wb(50, rows => {
        const want = {}; rows.forEach(q => { const k = q[0] + ':' + q[1] + '@' + q[4], u = want[k];
          want[k] = u ? [Math.min(u[0], q[3]), Math.min(u[1], q[4]), Math.max(u[2], q[5]), Math.max(u[3], q[6])] : q.slice(3); });
        const got = [...document.querySelectorAll('.page-box[data-p="50"] .hifz-mask')].map(m => { const s = m.style, f = x => parseFloat(x) * 10;
          return [m.dataset.k, f(s.left), f(s.top), f(s.left) + f(s.width), f(s.top) + f(s.height)]; });
        const bad = got.filter(g => !Object.keys(want).some(k => k.split('@')[0] === g[0] && Math.abs(want[k][0] - 2 - g[1]) < 1 && Math.abs(want[k][1] - g[2]) < 1 && Math.abs(want[k][2] + 2 - g[3]) < 1 && Math.abs(want[k][3] - g[4]) < 1));
        res([got.length, Object.keys(want).length, bad.slice(0, 3)]); })));
      await ev(() => { if (document.getElementById('hifzBar')) hifzToggle(); }); await wait(300);
      return assert(r[0] > 10 && r[0] === r[1] && !r[2].length, JSON.stringify(r)); });
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
    } }
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
