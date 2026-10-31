// UI checks of every app feature in Chromium. Usage: NODE_PATH=$(npm root -g) node ui.js
const { chromium } = require('playwright');
const W = 'file:///mnt/project-files/quran-app/web/index.html';
const BEEP = __dirname + '/beep.mp3';
const out = [];
// ED=kfgqpc (default), ED=kfold, ED=shamarly or ED=harmain: which mushaf edition the run reads.
const ED = process.env.ED || 'kfgqpc';
const KSUF = ED === 'harmain' ? '' : '.' + ED, EDDIR = ED === 'harmain' ? '/pages/' : 'editions/' + ED + '/';
let p, errs = [];
async function check(group, name, fn) {
  try { const r = await fn(); out.push([group, name, r === false ? 'FAIL' : 'PASS', r === false || r === true || r === undefined ? '' : String(r)]); }
  catch (e) { out.push([group, name, 'FAIL', e.message.split('\n')[0].slice(0, 160)]); }
}
const ev = (f, ...a) => p.evaluate(f, ...a);
const wait = ms => p.waitForTimeout(ms);
const assert = (c, m) => { if (!c) throw new Error(m || 'assert'); return true; };
async function go(h, ms = 700) { await ev(h => { location.hash = h; }, h); await wait(ms); }
async function fresh(ctx, vp) {
  p = await ctx.newPage(); await p.setViewportSize(vp || { width: 390, height: 844 }); await p.addInitScript(() => { window.QA_NOFS = true; });
  p.on('pageerror', e => errs.push(e.message));
  // confirm() before deleting: accepted, unless a check answers the dialog itself first
  p.on('dialog', d => setTimeout(() => d.accept().catch(() => {}), 0));
  await p.route(/everyayah\.com/, r => r.fulfill({ path: BEEP, contentType: 'audio/mpeg', headers: { 'Access-Control-Allow-Origin': '*' } }));
}

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  await fresh(ctx);
  await p.goto(W); await ev(ed => { localStorage.clear(); localStorage.setItem('q.edition', JSON.stringify(ed)); }, ED); await p.reload(); await wait(800);

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
  await check(G2, 'قلب الصفحة بالسحب بالإصبع', async () => { const r = await ev(() => { const b = document.querySelector('.page-box').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }); await p.mouse.move(r[0] + 30, r[1] + r[3] - 40); await p.mouse.down(); for (let i = 1; i <= 12; i++) { await p.mouse.move(r[0] + 30 + i * 25, r[1] + r[3] - 40 - i * 2); await wait(16); } await p.mouse.up(); await wait(1200); return assert(await ev(() => location.hash) === '#/p/52', await ev(() => location.hash)); });
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
  await check(G9, 'وضع الحفظ يخفي آيات الصفحة', async () => { await go('#/p/582'.replace('582', '560') === '' ? '' : '#/p/541', 1000); await p.click('#pHifz'); await wait(500); return ev(() => document.querySelectorAll('.hifz-mask').length > 0 && !!document.getElementById('hifzBar')); });
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
  await check(G12, 'مجموعة «لون الصفحة» بدل «الشكل» في الإعدادات', () => ev(() => [...document.querySelectorAll('.set-group')].some(x => x.textContent === 'لون الصفحة') && ![...document.querySelectorAll('.set-group')].some(x => x.textContent === 'الشكل')));
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
  await check(G12, 'مكافآت الختمة ظاهرة في شاشة الختمة', async () => { await go('#/khatma', 700); return ev(() => !!document.querySelector('.rw-badges, .rw, [class^=rw-]')); });
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
    await go('#/khatma', 700); return ev(() => { const b = document.querySelector('.st-nums b'); return !!b && ['٢', '٣', '٤'].includes(b.textContent) && document.querySelectorAll('.st-bar').length === 7; }); });
  await check(G13, 'ختمة رمضان بتظهر وبتعمل خطة على أيام رمضان', async () => { await ev(() => localStorage.removeItem(Object.keys(localStorage).find(k => /khatma/.test(k)) || 'x')); await go('#/khatma', 700);
    const card = await ev(() => !!document.getElementById('kRamadan')); await p.click('#kRamadan'); await wait(500);
    const k = await ev(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /khatma/.test(k))))); return assert(card && k.ramadan && k.days >= 29 && k.days <= 30, JSON.stringify(k)); });
  await check(G13, 'متابعة الحفظ: تسجيل سورة ومراجعتها والنسبة', async () => { await go('#/hifzlog', 700); await p.click('.hl-list li[data-s="112"]'); await p.click('.hl-list li[data-s="1"]'); await wait(300);
    const r = await ev(() => [document.querySelector('.hl-top b').textContent, document.querySelectorAll('.hl-list li.on').length, !!document.querySelector('.hl-due')]); await p.click('.hl-due [data-rev]'); await wait(300);
    return assert(r[1] === 2 && r[2] && /٢/.test(r[0]), JSON.stringify(r)); });
  await check(G13, 'صوت مؤذن مختلف لكل صلاة وتذكير قبل الأذان', async () => { await go('#/prayer', 900);
    await p.click('[data-open=fajr]'); await p.selectOption('.pv-v[data-p=fajr]', 'basit'); await wait(400); await p.click('[data-open=dhuhr]'); await p.selectOption('.pv-v[data-p=dhuhr]', 'afasy'); await wait(400); await p.click('.pv-pre[data-p=dhuhr][data-m="15"]'); await wait(400);
    await p.click('.pv-play[data-p=dhuhr]'); const pv = await ev(() => AppBridge.preview); await p.click('.pv-play[data-p=dhuhr]'); await go('#/', 2500);
    const a = await ev(() => AppBridge.alarms || []); const fj = a.find(e => e.kind === 'adhan' && /الفجر/.test(e.title)), dh = a.find(e => e.kind === 'adhan' && /الظهر/.test(e.title)), pre = a.find(e => /الظهر/.test(e.title) && e.kind === 'rem');
    return assert(pv === 'afasy' && fj.v === 'basit' && dh.v === 'afasy' && pre && Math.round((dh.at - a.filter(e => e.kind === 'adhan' && /الظهر/.test(e.title)).map(e => e.at).find(x => x > pre.at) + 0) || 1) && a.some(e => e.kind === 'rem' && /الظهر/.test(e.title) && a.some(x => x.kind === 'adhan' && /الظهر/.test(x.title) && x.at - e.at === 15 * 60000)), JSON.stringify([pv, fj && fj.v, dh && dh.v, !!pre])); });
  await check(G13, 'السبحة: هزة طويلة عند الوصول للعدد', async () => { await go('#/tasbih', 600); await p.click('#tsbReset'); await p.click('.tsb-goal button[data-g="33"]'); await ev(() => AppBridge.buzzes = []);
    for (let i = 0; i < 33; i++) await p.click('#tsbBtn'); const bz = await ev(() => AppBridge.buzzes); return assert(bz.length === 33 && bz[32] === 'p:700' && typeof bz[0] === 'number', JSON.stringify(bz.slice(-2))); });
  await check(G13, 'إحصائية الكلمات والحروف وتذكير آخر اليوم', async () => { await ev(() => { localStorage.removeItem('q.stats'); localStorage.removeItem('q.statsWL'); localStorage.setItem('q.reminders', JSON.stringify({ stat: { on: true, t: '23:59' } })); });
    await go('#/p/3', 600); await go('#/khatma', 2500); const t = await ev(() => document.querySelector('.st-wl').textContent); const a = await ev(() => AppBridge.alarms.filter(e => e.title === 'قراءتك النهارده'));
    return assert(/[١-٩][٠-٩]* كلمة/.test(t) && a.length >= 20 && (a[0].text.includes('كلمة') || new Date(a[0].at).getDate() !== new Date().getDate()), t + ' | ' + (a[0] || {}).text); });
  await check(G13, 'نسخة احتياطية: حفظ واسترجاع', async () => { const fs = require('fs'), os = require('os'), path = require('path'); const dl = p.waitForEvent('download').catch(() => null);
    await ev(() => { window.__bk = null; AppBridge.shareFile = (t, n) => { window.__bk = [t, n]; }; localStorage.setItem('q.notes', JSON.stringify({ '1:1': 'اختبار النسخة' })); });
    await p.click('#btnSettings'); await p.click('#bkOut'); const bk = await ev(() => window.__bk); await closeS();
    await ev(() => localStorage.removeItem('q.notes')); const f = path.join(os.tmpdir(), bk[1]); fs.writeFileSync(f, bk[0]);
    await p.setInputFiles('#bkFile', f); await wait(2500); const n = await ev(() => localStorage.getItem('q.notes'));
    return assert(/^quran-backup-.*\.json$/.test(bk[1]) && n && n.includes('اختبار النسخة'), bk && bk[1] + ' ' + n); });

  const G14 = 'مزايا نسخة 3.7';
  await check(G14, 'الشريط السفلي بـ4 أزرار ويختفي وقت القراءة', async () => { await go('#/', 700); const a = await ev(() => [document.querySelectorAll('#tabbar button').length, document.getElementById('tabbar').hidden]);
    await p.click('#tabbar button[data-h="#/more"]'); await wait(500); const m = await ev(() => location.hash === '#/more' && document.querySelectorAll('.tiles.more .tile').length === 12); await go('#/p/5', 800); const hid = await ev(() => document.getElementById('tabbar').hidden);
    return assert(a[0] === 4 && !a[1] && m && hid, JSON.stringify([a, m, hid])); });
  await check(G14, 'شاشة الترحيب: الطبعة والمدينة والتذكيرات', async () => { await go('#/welcome', 800); await p.click('.wel-opts button[data-e=shamarly]'); await p.click('.wel-next'); await p.selectOption('#wCity', { index: 2 });
    await p.click('.wel-next'); await p.click('[data-w=m] + span'); await p.click('.wel-next'); await wait(600);
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
    const g = await ev(() => document.getElementById('tGoal').textContent); await ev(() => localStorage.removeItem('q.goal')); return assert(cele && /٢ من ٢/.test(g), g + ' ' + cele); });
  await check(G14, 'اختبار الحفظ: إخفاء كلمات وكشفها والدرجة', async () => { await go('#/hifztest/112', 800); const n = await ev(() => document.querySelectorAll('.ht-w').length); await p.click('.ht-w >> nth=0'); await p.click('#htDone'); await wait(300);
    const r = await ev(() => [document.querySelectorAll('.ht-w.shown').length, document.getElementById('htRes').textContent, JSON.parse(localStorage.getItem('q.hifzScores') || '{}')[112]]);
    return assert(n > 0 && r[0] === n && /٪/.test(r[1]) && r[2] && r[2].score < 100, n + JSON.stringify(r)); });
  await check(G14, 'البحث في القرآن بس: السور والآيات، من غير الأذكار والأدعية', async () => { await go('#/search?q=' + encodeURIComponent('الكهف'), 1200); const s1 = await ev(() => !!document.querySelector('.sr-chips a[href="#/s/18/1"]'));
    await go('#/search?q=' + encodeURIComponent('أموت وأحيا'), 1000); const s2 = await ev(() => !!document.querySelector('.sr-zk')); return assert(s1 && !s2, s1 + ',' + s2); });
  await check(G14, 'الإعدادات فيها أزرار للأقسام ومعاينة الخط', async () => { await p.click('#btnSettings'); const r = await ev(() => [document.querySelectorAll('.set-jump button').length, !!document.querySelector('.set-prev')]); await closeS(); return assert(r[0] >= 3 && r[1], JSON.stringify(r)); });
  await check(G14, 'بيانات ودجت الصلاة الجاية (3 أيام)', async () => { await go('#/', 2500); const w = await ev(() => AppBridge.widget); return assert(w && w.prayers.length === 15 && w.prayers[0].n && w.place === 'القاهرة', JSON.stringify(w && w.prayers.slice(0, 1))); });
  const G15 = 'مزايا نسخة 3.8';
  await check(G15, 'خريطة الحفظ: كل صفحات الطبعة ملونة حسب السور المحفوظة', async () => { await ev(() => { const d = new Date(), t = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); localStorage.setItem('q.hifzLog', JSON.stringify(Object.assign({ 1: { m: '2026-1-1', r: '2025-1-1' } }, ...Array.from({ length: 25 }, (_, i) => ({ [90 + i]: { m: t, r: t } })))) ); });
    await go('#/hifzmap', 800); const r = await ev(() => [document.querySelectorAll('.hm-grid a').length, +document.querySelector('.hm-grid a:last-child').getAttribute('href').split('/')[2] - +document.querySelector('.hm-grid a').getAttribute('href').split('/')[2] + 1, document.querySelectorAll('.hm-grid .c3').length, document.querySelectorAll('.hm-grid .c2').length, document.querySelector('.hm-grid a').getAttribute('href')]);
    await ev(() => localStorage.removeItem('q.hifzLog')); return assert(r[0] === r[1] && r[2] >= 1 && r[3] >= 1 && /^#\/p\/\d+$/.test(r[4]), JSON.stringify(r)); });
  await check(G15, 'الختمة الجماعية: إضافة وتوزيع وتعليم ومشاركة واستيراد', async () => { await ev(() => localStorage.removeItem('q.family')); await go('#/family', 600);
    for (const n of ['أ', 'ب', 'ج']) { await p.fill('#famNew', n); await p.click('#famAdd'); await wait(120); }
    await p.click('#famSplit'); await wait(200); const js = await ev(() => JSON.parse(localStorage.getItem('q.family')).members.map(m => m.j.length));
    await p.click('.fam-j button[data-j="1"]'); await wait(150); await p.click('.fam-j button[data-j="30"]'); await wait(150); await p.click('#famShare'); const sh = await ev(() => AppBridge.shares[AppBridge.shares.length - 1][1]);
    await ev(() => { const F = JSON.parse(localStorage.getItem('q.family')); F.members[0].d = []; F.members[1].d = [15]; localStorage.setItem('q.family', JSON.stringify(F)); }); await go('#/', 200); await go('#/family', 400);
    p.once('dialog', d => d.accept(sh).catch(() => {})); await p.click('#famImp'); await wait(400); const d = await ev(() => JSON.parse(localStorage.getItem('q.family')).members.map(m => m.d.join(',')));
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
  await check(G15, 'ملء الشاشة: يخفي الأزرار بعد لمس الصفحة ويرجعها باللمس', async () => { await ev(() => { window.QA_NOFS = false; }); await go('#/p/50', 1500); await p.click('.page-box >> nth=0', { position: { x: 5, y: 5 } }).catch(() => {}); await ev(() => { const b = document.getElementById('ayahBar'); if (b) b.remove(); }); await ev(() => document.querySelector('.page-box').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await wait(1600);
    const on = await ev(() => document.body.classList.contains('fs')); await ev(() => document.querySelector('.page-box').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await wait(300); const off = await ev(() => !document.body.classList.contains('fs'));
    return assert(on && off, JSON.stringify([on, off])); });
  const G16 = 'نسخة 4.5: موديل NVIDIA';
  await check(G16, 'الإعدادات فيها «موديل NVIDIA (الأدق)» و«حول» فيها رخصته', async () => { await p.click('#btnSettings'); const r = await ev(() => [!!document.querySelector('#asrSet option[value=asrnv]'), /FastConformer[\s\S]*CC BY 4\.0/.test(document.body.innerHTML)]); await closeS(); return assert(r[0] && r[1], JSON.stringify(r)); });
  await check(G16, 'المايك على الصفحة بيشغّل موديل NVIDIA لما يكون متنزّل ومختار', async () => { await go('#/p/2', 900);
    const r = await ev(() => { const real = window.Asr, st = window.EdBridge; let got = null; window.EdBridge = { state: () => 'ready' }; window.Asr = { start: id => { got = id; }, stop() {}, active: () => true };
      localStorage.setItem('q.asr', JSON.stringify('asrnv')); document.getElementById('rdMic').click(); document.getElementById('rdMic').click();
      window.Asr = real; if (st) window.EdBridge = st; else delete window.EdBridge; localStorage.removeItem('q.asr'); return got; });
    return assert(r === 'asrnv', String(r)); });
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
    const order = await ev(() => { const d = document.getElementById('dlGroup'), a = document.querySelector('.about-box'); return !!(d.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) && d.nextElementSibling === a; });
    await ev(() => { document.getElementById('dlGroup').open = true; document.querySelector('.about-box').open = true; }); await closeS(); await wait(100);
    const closed = await ev(() => !document.getElementById('dlGroup').open && !document.querySelector('.about-box').open);
    const hint = await ev(() => !document.getElementById('dlRow').textContent.includes('مرة واحدة'));
    return assert(order && closed && hint, JSON.stringify([order, closed, hint])); });
  await check(G17, 'أقسام الإعدادات ليها شريط ملوّن يميّزها', async () => { await p.click('#btnSettings'); const r = await ev(() => { const g = document.querySelector('#settings .set-group'); const c = getComputedStyle(g); return [c.backgroundColor, c.borderInlineStartWidth]; }); await closeS(); return assert(r[0] !== 'rgba(0, 0, 0, 0)' && parseFloat(r[1]) >= 3, JSON.stringify(r)); });
  await check(G17, 'مايك الصفحة بيستخبى والإعدادات مفتوحة', async () => { await go('#/p/50', 900); await p.click('#btnSettings'); await wait(150); const h = await ev(() => getComputedStyle(document.getElementById('rdMic')).display); await closeS(); await wait(150); const v = await ev(() => getComputedStyle(document.getElementById('rdMic')).display); return assert(h === 'none' && v !== 'none', h + ',' + v); });
  await check(G17, 'حذف علامة بيسأل الأول', async () => { await ev(() => localStorage.setItem('q.marks', JSON.stringify([{ s: 2, a: 5, n: 'أ' }]))); await go('#/khatma', 600); let asked = false; p.once('dialog', d => { asked = true; d.dismiss().catch(() => {}); }); await p.click('.marks li:first-child .mk-del'); await wait(200); const n = await ev(() => document.querySelectorAll('.marks li').length); return assert(asked && n === 1, asked + ',' + n); });
  await check(G17, 'الإحصائيات: الصفحة بتتحسب مرة واحدة حتى لو اتفتحت تاني', async () => { await ev(() => localStorage.removeItem('q.stats')); await go('#/p/60', 500); await go('#/p/61', 500); await go('#/p/60', 500);
    const r = await ev(() => { const a = JSON.parse(localStorage.getItem('q.stats'))[Object.keys(JSON.parse(localStorage.getItem('q.stats')))[0]]; return [a.length, new Set(a).size, a.every(x => x > 1000)]; }); return assert(r[0] === r[1] && r[2] && r[0] > 0, JSON.stringify(r)); });
  await check(G17, 'السبحة: ذكر من عندك وعدد من اختيارك', async () => { await ev(() => localStorage.removeItem('q.tasbih')); await go('#/tasbih', 600);
    p.once('dialog', d => d.accept('يا حي يا قيوم').catch(() => {})); await p.click('#tsbAdd'); await wait(300); p.once('dialog', d => d.accept('٢٥').catch(() => {})); await p.click('#tsbGoal'); await wait(300);
    const r = await ev(() => [document.getElementById('tsbTxt').textContent, document.getElementById('tsbOf').textContent, JSON.parse(localStorage.getItem('q.tasbih')).goal]); return assert(r[0] === 'يا حي يا قيوم' && r[2] === 25, JSON.stringify(r)); });
  await check(G17, 'اختبار الحفظ بالصوت: الكلمة المخفية تظهر لو اتقرت صح وتحمرّ لو غلط', async () => { await ev(() => { localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 100, s: 112, from: 1 })); window.ReciteBridge = { start() {}, stop() {} }; }); await go('#/hifztest/112', 800);
    await p.click('#htMic'); await ev(() => { onRecite('', 'state:listening'); onRecite('قل هو الله احد', 'final'); onRecite('الله الصمد', 'final'); onRecite('لم يكتب', 'partial'); onRecite('لم يكتب ولم يقرا', 'final'); });
    const r = await ev(() => [document.querySelectorAll('.ht-w.ok').length, document.querySelectorAll('.ht-w.miss').length]); await ev(() => { delete window.ReciteBridge; });
    return assert(r[0] >= 6 && r[1] >= 1, JSON.stringify(r)); });
  await check(G17, 'المصحف بيدخل ملء الشاشة لوحده بعد ثانيتين، والرجوع بيقفله الأول', async () => { await go('#/', 400); await ev(() => { window.QA_NOFS = false; }); await go('#/p/70', 2600);
    const on = await ev(() => document.body.classList.contains('fs')); const b1 = await ev(() => qBack()); const off = await ev(() => !document.body.classList.contains('fs')); const b2 = await ev(() => qBack()); const b3 = await ev(() => qBack());
    await ev(() => { window.QA_NOFS = true; }); return assert(on && b1 && off && b2 && !b3, JSON.stringify([on, b1, off, b2, b3])); });
  await check(G17, 'الأذكار: الصوت للآيات بس', async () => { await go('#/azkar/m', 800); const r = await ev(() => [...document.querySelectorAll('.zikr')].every(z => !z.querySelector('.z-play') || /سورة/.test(z.querySelector('.z-src').textContent))); return assert(r, String(r)); });
  await check(G17, 'هامش المصحف الموضوعي تحت الصفحة (صورة الهامش المطبوع)', async () => { await ev(() => localStorage.setItem('q.thematic', 'true')); await p.reload(); await go('#/p/27', 900);
    await ev(() => { document.getElementById('thmNotes').open = true; }); await wait(800); const r = await ev(() => { const i = document.querySelector('.thm-notes img'); return i && [i.getAttribute('src'), i.naturalWidth]; }); await ev(() => localStorage.setItem('q.thematic', 'false'));
    return assert(r && /thmnotes\/\d{3}\.webp/.test(r[0]), JSON.stringify(r)); });
  await check('عام', 'مفيش أخطاء JavaScript في كل الاختبارات', () => assert(!errs.length, errs.slice(0, 3).join(' | ')));
  await b.close();
  for (const r of out) console.log(r.join('\t'));
  const f = out.filter(r => r[2] === 'FAIL').length; console.log('TOTAL', out.length, 'FAIL', f);
  require('fs').writeFileSync(__dirname + '/ui-results.json', JSON.stringify(out));
})();
