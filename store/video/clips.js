// "Live" clips for the promo video, captured as states: the real app UI is fed recognised words through
// window.onRecite (the callback the Android recogniser calls), and every state is shot to store/video/clips/<clip>/NN.png.
// The camera moves are done later in make-video.js, so the clips stay sharp and repeatable. The browser is put offline
// before the mic starts. Words come from web/quran-data.js (QURAN.t), so the "recited" text is the app's own.
//   live   – mushaf page 2 (King Fahd), mic on, the word box follows Al-Baqara 2:1-5 word by word
//   review – surah review test in vertical scroll: covered ayat open as they are recited, one wrong word turns red
//   stats  – the statistics page, full length, with each card's box (for the camera)
// Usage: node store/video/clips.js [live|review|stats ...]
const path = require('path'), fs = require('fs');
const { loadPW, serve, openApp } = require('./common');
const OUT = path.join(__dirname, 'clips');
const FAKE_MIC = () => { window.ReciteBridge = { start() {}, stop() {}, setHints() {} }; };
const box = (p, sel) => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); }, sel);
const dir = n => { const d = path.join(OUT, n); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); return d; };

async function live(b, base) {
  const D = dir('live'), meta = { states: [] };
  const { ctx, p } = await openApp(b, base, { hash: '#/p/3', init: FAKE_MIC, offline: true });
  let i = 0; const shot = async (label, sel) => {
    const f = String(i++).padStart(2, '0') + '.png'; await p.screenshot({ path: path.join(D, f) });
    meta.states.push({ f, label, box: sel ? await box(p, sel) : null });
  };
  meta.mic = await box(p, '#rdMic'); await shot('idle');
  await p.click('#rdMic'); await p.waitForTimeout(600); await p.evaluate(() => window.onRecite('', 'state:listening')); await p.waitForTimeout(300);
  await shot('mic');
  const W = await p.evaluate(() => [6, 7].flatMap(a => window.QURAN.t[1][a - 1].split(' ')));
  for (let n = 4; n <= W.length; n++) {
    await p.evaluate(t => window.onRecite(t, 'partial'), W.slice(0, n).join(' ')); await p.waitForTimeout(450);
    await shot('w' + n, '.rd-word');
  }
  meta.words = W.length; fs.writeFileSync(path.join(D, 'meta.json'), JSON.stringify(meta, null, 1));
  console.log('live', meta.states.length, 'states', p.errs.length ? p.errs : 'ok'); await ctx.close();
}

async function review(b, base) {
  const D = dir('review'), meta = { states: [] };
  const { ctx, p } = await openApp(b, base, { hash: '#/hifzlog', turn: 'v', init: FAKE_MIC, height: 640 });
  await p.evaluate(() => window.hzTestStart({ k: 's', s: 2 }, 'm', [[12, 14]])); await p.waitForTimeout(2500);
  await ctx.setOffline(true);
  let i = 0; const shot = async label => {
    const f = String(i++).padStart(2, '0') + '.png'; await p.screenshot({ path: path.join(D, f) });
    meta.states.push({ f, label, bad: await p.evaluate(() => [...document.querySelectorAll('.rc-badw')].map(e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); })) });
  };
  await shot('covered');
  await p.click('#hifzBar [data-c=mic]').catch(e => console.log('mic button:', e.message.split('\n')[0])); await p.waitForTimeout(500);
  await p.evaluate(() => window.onRecite('', 'state:listening')); await shot('mic');
  // ayah by ayah: cumulative partials, then a final; 2:7 has one missed word
  const AY = await p.evaluate(() => [6, 7, 8].map(a => window.QURAN.t[1][a - 1].split(' ')));
  AY[1] = AY[1].slice(); AY[1][5] = 'بصرهم';   // 2:7: «سَمۡعِهِمۡۖ» misread – it is marked red
  for (const [k, ws] of AY.entries()) {
    for (let n = Math.min(3, ws.length); n <= ws.length; n++) {
      await p.evaluate(t => window.onRecite(t, 'partial'), ws.slice(0, n).join(' ')); await p.waitForTimeout(200); await shot('a' + (k + 1) + 'w' + n);
    }
    await p.evaluate(t => window.onRecite(t, 'final'), ws.join(' ')); await p.waitForTimeout(450); await shot('a' + (k + 1) + 'final');
  }
  fs.writeFileSync(path.join(D, 'meta.json'), JSON.stringify(meta, null, 1));
  console.log('review', meta.states.length, 'states', p.errs.length ? p.errs : 'ok'); await ctx.close();
}

async function stats(b, base) {
  const D = dir('stats');
  const { ctx, p } = await openApp(b, base, { hash: '#/stats', offline: true });
  await p.waitForTimeout(800);
  // the fixed bottom bar would be painted mid-page in a full-page shot
  await p.addStyleTag({ content: '.nav, nav.tabs, #nav, .bottom-nav, #tabs { display: none !important; }' });
  await p.evaluate(() => document.querySelectorAll('body *').forEach(e => { const cs = getComputedStyle(e); if (cs.position === 'fixed' && e.getBoundingClientRect().top > 400) e.style.display = 'none'; }));
  await p.screenshot({ path: path.join(D, 'full.png'), fullPage: true });
  const cards = await p.evaluate(() => [...document.querySelectorAll('#view section.kh-sec')].map(e => {
    const r = e.getBoundingClientRect(); return { tag: e.tagName + '.' + e.className, text: (e.textContent || '').trim().slice(0, 40), box: [r.left, r.top + scrollY, r.width, r.height].map(Math.round) };
  }).filter(c => c.box[3] > 20));
  fs.writeFileSync(path.join(D, 'meta.json'), JSON.stringify({ cards }, null, 1));
  console.log('stats', cards.length, 'boxes', p.errs.length ? p.errs : 'ok'); await ctx.close();
}

(async () => {
  const want = process.argv.slice(2), all = { live, review, stats };
  const { srv, base } = await serve(); const b = await loadPW().chromium.launch();
  for (const [n, f] of Object.entries(all)) if (!want.length || want.includes(n)) await f(b, base);
  await b.close(); srv.close();
})();
