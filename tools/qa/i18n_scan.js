// 5.11 G1.8: open the app in English and list every Arabic text still on screen outside the Quran/book texts.
// Run: NODE_PATH="$(npm root -g)/@playwright/test/node_modules" node tools/qa/i18n_scan.js  -> tools/qa/i18n-missing.json
const { chromium } = require('playwright');
const W = require('url').pathToFileURL(require('path').resolve(__dirname + '/../../web') + '/index.html').href;
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage();
  await p.setViewportSize({ width: 390, height: 844 });
  await p.addInitScript(() => { window.QA_NOFS = true; localStorage.setItem('q.lang', '"en"'); localStorage.setItem('q.onboarded', '1'); localStorage.setItem('q.micTips', '1'); localStorage.setItem('q.edition', '"kfgqpc"'); });
  await p.goto(W); await wait(1200);
  const seen = {};
  const grab = async where => {
    const r = await p.evaluate(() => {
      // Book texts that stay Arabic by design (i18n.js header): Quran, tafsir, azkar, lessons, duas.
      const skip = '.ayah, .aya, .qtext, .quran, .mushaf, .page, .vpages, .tafsir, .tf-text, .zk-text, .zikr, .dua, .lesson, .ls-body, [lang="ar"], .surah-name-ar, svg, script, style';
      const out = [], tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const vis = e => { for (; e && e !== document.body; e = e.parentElement) { if (e.hidden) return false; const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return false; } return true; };
      while (tw.nextNode()) { const n = tw.currentNode, t = n.nodeValue.trim(); if (!/[؀-ۿ]/.test(t)) continue;
        const e = n.parentElement; if (!e || e.closest(skip) || !vis(e)) continue; out.push(t.slice(0, 160)); }
      document.querySelectorAll('[placeholder],[aria-label],[title]').forEach(e => ['placeholder', 'aria-label', 'title'].forEach(a => { const v = e.getAttribute(a); if (v && /[؀-ۿ]/.test(v) && !e.closest(skip)) out.push('@' + a + ': ' + v.slice(0, 160)); }));
      return out; });
    r.forEach(t => { (seen[t] = seen[t] || []).includes(where) || seen[t].push(where); });
  };
  const go = async (h, ms = 900) => { await p.evaluate(h => { location.hash = h; }, h); await wait(ms); };
  const click = async s => { try { await p.click(s, { timeout: 2000 }); await wait(500); } catch (e) {} };
  await grab('home');
  await go('#/p/2'); await grab('page');
  await click('#btnIndex'); await grab('index'); await click('#closeIndex');
  await click('#btnSettings');
  await p.evaluate(() => document.querySelectorAll('#settings details').forEach(d => d.open = true)); await wait(300); await grab('settings');
  await click('#closeSettings');
  for (const h of ['#/s/2', '#/a/2/255', '#/more', '#/stats', '#/prayer', '#/azkar', '#/tajweed', '#/khatma', '#/hifzlog', '#/hifzmap', '#/hifztest', '#/search', '#/tasbih', '#/qibla', '#/imsakia', '#/qiraat', '#/topics', '#/family', '#/duas'])
  { await go(h); await grab(h); }
  // 5.17: the mutashabihat test answered, talqin's three steps and result, the player's listening dialog (sleep timer)
  await go('#/mutash', 1500); await grab('#/mutash'); await click('.mt-ch'); await grab('#/mutash answered');
  await go('#/talqin/112'); await grab('#/talqin'); await click('#tqSkip'); await grab('talqin 2'); await click('#tqHide'); await grab('talqin 3');
  await click('#tqText .ht-w'); await click('#tqDone'); await grab('talqin done');
  await click('#tqNext'); await click('#player button[data-c=dl]'); await grab('listen dialog'); await click('.ls-dlg [data-z="15"]'); await grab('player sleep');
  await b.close();
  const list = Object.entries(seen).map(([t, w]) => ({ t, w }));
  require('fs').writeFileSync(__dirname + '/i18n-missing.json', JSON.stringify(list, null, 1));
  console.log('MISSING', list.length);
})();
