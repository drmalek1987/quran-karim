// Sprint 5 #27 investigation: page turn on an ayah split over two pages, reading-follow mode (rdHear/rdSplitTurn) and hifz test
// (hifzPageEnd/hifzPageGo). Feeds the ayah word by word as cumulative 'partial' pieces, then 'final'; logs when the shown pages change.
// Editions with split ayat: shamarly, harmain (kfgqpc and kfold end every page on an ayah end: 0 candidates).
// VAR=miss|skip: the last word printed on page n is misheard (nonsense) / left out.
// Usage: [ED=shamarly] [ORI=p,l,s] [MODE=rd,hz] [TM=v] [PICK=4] [VAR=miss] [V=1] node split_turn.js     (s = 1000x600, a real spread)
const path = require('path'), W = require('url').pathToFileURL(path.resolve(__dirname, '../../../web') + '/index.html').href;
const { chromium } = require(path.join(require('child_process').execSync('npm root -g', { encoding: 'utf8', shell: true }).trim(), '@playwright/test/node_modules/playwright'));
const EDS = (process.env.ED || 'shamarly').split(','), ORIS = (process.env.ORI || 'p,l,s').split(','), MODES = (process.env.MODE || 'rd,hz').split(','), TM = process.env.TM || '', PICK = +(process.env.PICK || 4);
const VP = { p: { width: 412, height: 915 }, l: { width: 915, height: 412 }, s: { width: 1000, height: 600 } };   // the app shows a spread from 800x500 up
const INIT = () => { window.QA_NOFS = true; window.ReciteBridge = { start() {}, stop() {}, setHints() {} }; };
const SET = ([ed, tm]) => { localStorage.setItem('q.edition', JSON.stringify(ed)); localStorage.setItem('q.mode', '"pages"'); localStorage.setItem('q.micTips', '1'); localStorage.setItem('q.flip', 'false'); localStorage.removeItem('q.hifzFlip'); if (tm) localStorage.setItem('q.turn', JSON.stringify(tm)); else localStorage.removeItem('q.turn'); };
(async () => {
  const b = await chromium.launch();
  for (const ed of EDS) {
    const ctx = await b.newContext({ viewport: VP.p }), p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERR', e.message));
    await p.addInitScript(INIT); await p.goto(W); await p.evaluate(SET, [ed, TM]); await p.reload(); await p.waitForTimeout(1000); await p.evaluate(() => { location.hash = '#/p/100'; }); await p.waitForTimeout(1200);
    // every ayah that runs from page n to n+1 (>= 9 words); pick PICK spread over the book, alternating odd / even n
    const cand = await p.evaluate(() => { const Q = window.QURAN, o = [];
      for (let s = 1; s <= 114; s++) for (let a = 1; a <= Q.s[s - 1][3]; a++) { const r = Q.r[s - 1] && Q.r[s - 1][a - 1]; if (!r) continue; const pg = r.map(x => x[0]); const n = Math.min(...pg);
        if (pg.includes(n + 1) && !pg.includes(n + 2)) { const w = Q.t[s - 1][a - 1].split(' ').filter(x => /[ء-يٱ]/.test(x)); if (w.length >= 9 && n > 3) o.push([s, a, n, w.length]); } }
      return o; });
    const pick = []; for (const par of [1, 0]) { const l = cand.filter(c => c[2] % 2 === par); for (let k = 0; k < PICK / 2; k++) pick.push(l[Math.floor(l.length * (k + 0.5) / (PICK / 2))]); }
    console.log(ed, 'candidates', cand.length, 'picked', JSON.stringify(pick));
    await ctx.close();
    for (const ori of ORIS) for (const mode of MODES) for (const [s, a, n] of pick) {
      const c2 = await b.newContext({ viewport: VP[ori] }), q = await c2.newPage(); q.on('pageerror', e => console.log('PAGEERR', e.message));
      await q.addInitScript(INIT); await q.goto(W); await q.evaluate(SET, [ed, TM]); await q.reload(); await q.waitForTimeout(1000);
      const ev = (f, x) => q.evaluate(f, x), wait = ms => q.waitForTimeout(ms), say = (t, k) => ev(([t, k]) => window.onRecite(t, k), [t, k]);
      const boxes = () => ev(() => [...document.querySelectorAll('.page-box')].map(x => x.dataset.p).join(',') + ' ' + location.hash.split('?')[0]);
      const words = await ev(([s, a, n]) => { const f = x => x.split(' ').filter(w => /[ء-يٱ]/.test(w)); const Q = window.QURAN; const prev = a > 1 ? f(Q.t[s - 1][a - 2]) : []; return { w: f(Q.t[s - 1][a - 1]), prev: prev.slice(-8), next: a < Q.s[s - 1][3] ? f(Q.t[s - 1][a]).slice(0, 3) : [], prevOn: a > 1 && (Q.r[s - 1][a - 2] || []).some(b => b[0] === n) }; }, [s, a, n]);
      // last word of the ayah printed on the given pages (the real word boxes of the edition; QA_wb loads them if needed)
      const lastOn = pgs => ev(async ([s, a, pgs]) => { let lb = -1; for (const pg of pgs) { const rows = await new Promise(r => window.QA_wb(pg, r)); if (!rows) return null; rows.forEach(r => { if (r[0] === s && r[1] === a && r[2] > lb) lb = r[2]; }); } return lb; }, [s, a, pgs]);
      if (mode === 'rd') { await ev(h => { location.hash = h; }, '#/p/' + n); await wait(1000); await q.click('#rdMic'); await wait(200); await say('', 'state:listening'); }
      else { await ev(h => { location.hash = h; }, '#/hifzmap'); await wait(700);
        await ev(n => { const s = window.QURAN.p.findIndex(x => x.includes(+n)) + 1, i = window.QURAN.p[s - 1].indexOf(+n); window.hifzTestPages(s, i < 0 ? 1 : i + 1); }, n); await wait(1300); await q.click('#hifzBar [data-c="mic"]'); await wait(200); await say('', 'state:listening'); }
      const startBoxes = await boxes(), shown = startBoxes.split(' ')[0].split(',').map(Number);
      const VAR = process.env.VAR || '', pre = (mode === 'rd' || words.prevOn) ? words.prev : [], all = words.w.slice();
      if (VAR) { const l0 = await lastOn(shown); if (VAR === 'miss') all[l0] = 'زززز'; else if (VAR === 'skip') all.splice(l0, 1); }
      let turnedAt = null; const log = [];
      for (let c = 1; c <= all.length + 1; c++) {
        const fin = c > all.length, txt = pre.concat(all.slice(0, Math.min(c, all.length))).join(' ');
        await say(txt, fin ? 'final' : 'partial');
        await wait((c > all.length * 0.3) || fin ? 350 : 60);
        const bx = await boxes(); if (bx !== startBoxes && turnedAt == null) turnedAt = fin ? 'final' : c; log.push(c + ':' + (bx === startBoxes ? '=' : bx));
        if (turnedAt != null && c > (typeof turnedAt === 'number' ? turnedAt : 0) + 2) break;
      }
      const li = await lastOn(shown), liN = await lastOn([n]);   // asked after the feed: li = last word on the pages shown (what the app asks), liN = on page n alone
      let after = 'n/a';
      if (turnedAt == null) { await say(all.join(' ') + ' ' + words.next.join(' '), 'partial'); await wait(900); const bx = await boxes(); after = bx === startBoxes ? 'still page n after next ayah started' : 'turned only after next ayah started: ' + bx; }
      const same = shown.includes(n + 1), want = VAR === 'skip' ? li + 1 : VAR === 'miss' ? li + 2 : li + 1;   // skip / miss: the turn can come only with the first word of page n+1 heard
      const r = { ed, ori, mode, ayah: s + ':' + a, n, shown: startBoxes, words: all.length, lastOnShown: li, lastOnN: liN, turnedAtWord: turnedAt, variant: VAR || undefined, verdict: same ? (turnedAt == null ? 'ok(same spread, no turn)' : 'EXTRA turn') : (turnedAt === want ? 'ok' : turnedAt == null ? 'NO TURN: ' + after : 'late/early') };
      console.log(JSON.stringify(r)); if (process.env.V) console.log('   ', log.join(' | '));
      await c2.close();
    }
  }
  await b.close();
})();
