// Voice donation v2 in the page, with the Android bridges mocked: v2 labels and window.nvSeq on a clean piece,
// «أنا قريت صح» after a misheard word, the settings rows (stats, Wi-Fi/mobile, delete my recordings).
// Usage: NODE_PATH=$(npm root -g) node tools/qa/donate.js
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('@playwright/test')); }
const path = require('path');
const W = 'file:///' + path.resolve(__dirname, '../../web/index.html').replace(/\\/g, '/');
const out = []; let p, errs = [];
async function check(name, fn) {
  try { const r = await fn(); out.push([r === true ? 'PASS' : 'FAIL', name, r === true || r === false || r === undefined ? '' : String(r)]); }
  catch (e) { out.push(['FAIL', name, e.message.split('\n')[0].slice(0, 200)]); }
}
const ev = (f, ...a) => p.evaluate(f, ...a), wait = ms => p.waitForTimeout(ms);
(async () => {
  const b = await chromium.launch(); p = await (await b.newContext()).newPage(); await p.setViewportSize({ width: 390, height: 844 });
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(() => {
    window.QA_NOFS = true; window.QA = { donated: [], sent: [], forgot: [] };
    window.ReciteBridge = { start() {}, stop() {} };
    window.NvBridge = { ready: () => true, start() {}, stop() {},
      donate2(m, s) { QA.donated.push([JSON.parse(m), s]); return ''; }, sendDonations(m) { QA.sent.push(m); },
      donateStats: () => '{"waiting":3,"rejected":{"quiet":1,"srv:mismatch":2}}',
      forget(ids) { QA.forgot.push(ids); setTimeout(() => window.onDonateForget(true), 10); } };
  });
  await p.goto(W);
  await ev(() => { localStorage.clear(); localStorage.setItem('q.asr', '"asrnv"'); localStorage.setItem('q.donate', '1'); localStorage.setItem('q.donateId', '"old4800id"');
    localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 100, s: 1, from: 1 })); });
  await p.reload(); await wait(900);
  await check('sendDonations called at start (Wi-Fi only by default)', async () => { await wait(5200); const s = await ev(() => QA.sent); return s.length >= 1 && s[0] === false || JSON.stringify(s); });

  await ev(() => { location.hash = '#/hifztest/1'; }); await wait(800);
  await check('hifz words carry data-a / data-w', () => ev(() => { const w = document.querySelectorAll('.ht-w'); return w.length > 20 && w[0].dataset.a === '1' && w[0].dataset.w === '0' && w[4].dataset.a === '2' && w[4].dataset.w === '0'; }));
  await p.click('#htMic'); await wait(100);
  await check('clean piece -> donate2 with v2 label and nvSeq', async () => {
    await ev(() => { window.nvSeq = 5; onRecite('بسم الله الرحمن الرحيم', 'final'); }); await wait(50);
    const d = await ev(() => QA.donated); if (d.length !== 1) return 'donated ' + JSON.stringify(d);
    const [m, s] = d[0];
    return s === 5 && m.v === 2 && m.s === 1 && m.a0 === 1 && m.w0 === 0 && m.a1 === 1 && m.w1 === 3 && m.kind === 'auto' && m.hyp === 'بسم الله الرحمن الرحيم' && m.text.split(' ').length === 4 && !!m.model || JSON.stringify(m);
  });
  await check('misheard last word -> red word and «أنا قريت صح» shown, nothing donated', async () => {
    await ev(() => { window.nvSeq = 6; onRecite('الحمد لله رب الناس', 'final'); }); await wait(50);
    return ev(() => !document.getElementById('htFix').hidden && document.querySelectorAll('.ht-w.miss').length === 1 && QA.donated.length === 1);
  });
  await check('«أنا قريت صح» -> word green, corrected clip with seq 6 covering the whole ayah', async () => {
    await p.click('#htFix'); await wait(50);
    const r = await ev(() => ({ miss: document.querySelectorAll('.ht-w.miss').length, hidden: document.getElementById('htFix').hidden, d: QA.donated[1] }));
    const m = r.d && r.d[0];
    return r.miss === 0 && r.hidden && r.d[1] === 6 && m.kind === 'corrected' && m.a0 === 2 && m.w0 === 0 && m.a1 === 2 && m.w1 === 3 || JSON.stringify(r);
  });
  await check('test carries on after the vouched words', async () => {
    await ev(() => { window.nvSeq = 7; onRecite('الرحمن الرحيم', 'final'); }); await wait(50);
    const d = await ev(() => QA.donated[2]); return d && d[1] === 7 && d[0].a0 === 3 && d[0].kind === 'auto' || JSON.stringify(d);
  });
  await check('extra misheard word (partial, then final) does not turn right words red (rAlign)', async () => {
    await ev(() => { window.nvSeq = 9; onRecite('مالك نهاية', 'partial'); onRecite('مالك نهاية يوم الدين', 'final'); }); await wait(50);
    const r = await ev(() => { const w = [...document.querySelectorAll('.ht-w')].filter(e => e.dataset.a === '4');
      return { ok: w.filter(e => e.classList.contains('ok')).length, n: w.length, miss: document.querySelectorAll('.ht-w.miss').length, d: QA.donated[3] }; });
    return r.ok === r.n && r.n === 3 && r.miss === 0 && r.d && r.d[1] === 9 && r.d[0].a0 === 4 && r.d[0].kind === 'auto' || JSON.stringify(r);
  });
  await check('phone recogniser (not NVIDIA) never donates', async () => {
    await p.click('#htMic'); await ev(() => localStorage.setItem('q.asr', '"phone"')); await p.click('#htMic');
    await ev(() => { window.nvSeq = 8; onRecite('مالك يوم الدين', 'final'); }); await wait(50);
    return ev(() => QA.donated.length === 4);
  });

  await ev(() => { location.hash = '#/'; }); await wait(300);
  await check('settings: stats line, Wi-Fi/mobile choice and delete button', async () => {
    await ev(() => document.querySelector('#donateMob button[data-v="1"]').click());
    return ev(() => document.getElementById('donateStats').textContent.indexOf('٣') > 0 && document.getElementById('donateStats').textContent.indexOf('٣', 12) > 0 &&
      document.querySelector('#donateMob button[data-v="1"]').classList.contains('on') && QA.sent[QA.sent.length - 1] === true && !!document.getElementById('donateDel'));
  });
  await check('delete my recordings -> forget(old id), donation off, old id cleared', async () => {
    await ev(() => document.getElementById('donateDel').click()); await wait(100);
    return ev(() => QA.forgot[0] === 'old4800id' && localStorage.getItem('q.donate') === '0' && localStorage.getItem('q.donateId') === '""' && !document.querySelector('#donateSet button[data-v="1"]').classList.contains('on')) || ev(() => JSON.stringify([QA.forgot, localStorage.getItem('q.donate'), localStorage.getItem('q.donateId')]));
  });
  // rLocal: the reader may start anywhere, go back and repeat; red only once a piece is final
  await ev(() => { location.hash = '#/hifztest/1'; }); await wait(800); await p.click('#htMic'); await wait(100);
  const ay = (a) => ev((a) => { const w = [...document.querySelectorAll('.ht-w')].filter(e => e.dataset.a === String(a));
    return { n: w.length, ok: w.filter(e => e.classList.contains('ok')).length, shown: w.filter(e => e.classList.contains('shown')).length, miss: document.querySelectorAll('.ht-w.miss').length }; }, a);
  await check('start from the middle (ayah 5): followed there, ayah 1 left hidden', async () => {
    await ev(() => onRecite('اياك نعبد واياك نستعين', 'final')); await wait(50);
    const a5 = await ay(5), a1 = await ay(1); return a5.ok === a5.n && a5.n === 4 && a1.shown === 0 && a5.miss === 0 || JSON.stringify([a5, a1]);
  });
  await check('going back to ayah 2 and reading it is followed (no red)', async () => {
    await ev(() => onRecite('الحمد لله رب العالمين', 'final')); await wait(50);
    const a2 = await ay(2); return a2.ok === a2.n && a2.n === 4 && a2.miss === 0 || JSON.stringify(a2);
  });
  await check('a wrong word is red only when the piece is final, not while it is heard', async () => {
    await ev(() => onRecite('اهدنا الصراط الكتاب صراط الذين', 'partial')); await wait(50);
    const part = await ay(6); await ev(() => onRecite('اهدنا الصراط الكتاب صراط الذين', 'final')); await wait(50);
    const fin = await ay(6); return part.miss === 0 && part.ok === 2 && fin.miss === 1 && fin.ok === 2 || JSON.stringify([part, fin]);
  });
  await check('«اظهر كل الكلمات» peeks at the hidden words and hides them back', async () => {
    await p.click('#htPeek'); const on = await ev(() => document.querySelector('.ht-text').classList.contains('peek'));
    await p.click('#htPeek'); const off = await ev(() => !document.querySelector('.ht-text').classList.contains('peek'));
    return on && off;
  });
  await check('no page errors', () => errs.length === 0 || errs.join(' | '));
  await b.close();
  for (const r of out) console.log(r.join('  '));
  process.exit(out.some(r => r[0] === 'FAIL') ? 1 : 0);
})();
