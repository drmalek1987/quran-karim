// G9 (5.11): the same screens on 4 screen classes in headless Chromium — small phone, large phone, unfolded foldable,
// tablet (landscape + portrait). Per screen: no JS errors, nothing wider than the screen, the mushaf page fits,
// the Settings sheet fits. Screenshots go to tools/qa/matrix/ (gitignored) with an HTML contact sheet.
// Usage: node tools/qa/matrix.js   (env ED=kfgqpc by default; DEV=small,tablet-l to run some devices only)
function loadPW() {
  try { return require('playwright'); } catch (e) {}
  const path = require('path'), cp = require('child_process');
  let root = ''; try { root = cp.execSync('npm root -g', { encoding: 'utf8', shell: true }).trim(); } catch (e) {}
  for (const c of [root, process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules')].filter(Boolean))
    for (const sub of ['playwright', 'playwright-core', '@playwright/test/node_modules/playwright', '@playwright/test/node_modules/playwright-core'])
      try { return require(path.join(c, sub)); } catch (e) {}
  throw new Error('playwright not found');
}
const { chromium } = loadPW();
const path = require('path'), fs = require('fs');
const W = require('url').pathToFileURL(path.resolve(process.env.QK_WEB || __dirname + '/../../web') + '/index.html').href;
const OUT = path.join(__dirname, 'matrix'); fs.mkdirSync(OUT, { recursive: true });
const ED = process.env.ED || 'kfgqpc';
const DEVICES = [
  ['small', { width: 360, height: 640 }, 2, true],
  ['large', { width: 412, height: 915 }, 2.625, true],
  ['fold', { width: 673, height: 841 }, 2.2, true],
  ['tablet-l', { width: 1280, height: 800 }, 1.5, true],
  ['tablet-p', { width: 800, height: 1280 }, 1.5, true],
].filter(d => !process.env.DEV || process.env.DEV.split(',').includes(d[0]));
const SCREENS = [
  ['home', '#/', null],
  ['page', '#/p/29', null],
  ['page-fs', '#/p/29', 'fs'],
  ['text', '#/s/2/255', null],
  ['ayah', '#/a/2/255', null],
  ['more', '#/more', null],
  ['hifz', '#/hifztest/112', null],
  ['settings', '#/', 'settings'],
];
(async () => {
  const b = await chromium.launch(); const rows = []; let fails = 0;
  for (const [dn, vp, dpr, touch] of DEVICES) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr, hasTouch: touch, isMobile: dn !== 'tablet-l' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    p.on('dialog', d => d.dismiss().catch(() => {}));
    await p.addInitScript(ed => { window.QA_NOFS = true; localStorage.setItem('q.mode', '"pages"'); localStorage.setItem('q.edition', JSON.stringify(ed)); localStorage.setItem('q.welcomed', '1'); }, ED);
    await p.goto(W); await p.waitForTimeout(1200);
    for (const [sn, hash, extra] of SCREENS) {
      errs.length = 0;
      await p.evaluate(h => { document.getElementById('settings').hidden = true; document.body.classList.remove('fs'); location.hash = h; }, hash); await p.waitForTimeout(900);
      if (extra === 'fs') { await p.evaluate(() => document.body.classList.add('fs')); await p.waitForTimeout(600); }
      if (extra === 'settings') { await p.click('#btnSettings').catch(() => {}); await p.waitForTimeout(500); }
      const r = await p.evaluate(sn => {
        const vw = document.documentElement.clientWidth, vh = innerHeight, bad = [];
        if (document.documentElement.scrollWidth > vw + 1) bad.push('page wider than screen: ' + document.documentElement.scrollWidth + '>' + vw);
        // visible elements sticking out of the screen sideways (fixed bars, sheets, cards)
        const out = [...document.querySelectorAll('body *')].filter(e => { if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') return false; if (e.closest('.page-wrap,.curl,.set-jump,.chips,.seg,[hidden]')) return false; for (let a = e.parentElement; a; a = a.parentElement) { const ox = getComputedStyle(a).overflowX; if (ox === 'auto' || ox === 'scroll') return false; } const q = e.getBoundingClientRect(); return q.width > 0 && q.height > 0 && (q.right > vw + 2 || q.left < -2) && getComputedStyle(e).visibility !== 'hidden'; }).slice(0, 3);
        out.forEach(e => bad.push('sticks out: ' + e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ')[0]));
        if (/^page/.test(sn)) { const im = document.getElementById('pg'); if (!im || !im.naturalWidth) bad.push('page image not loaded'); else { const pb = document.querySelector('#view .page-wrap'); const q = pb.getBoundingClientRect(); if (q.width > vw + 2) bad.push('page wrap wider than screen'); } }
        if (sn === 'settings') { const sb = document.querySelector('#settings .sheet-body').getBoundingClientRect(); if (sb.width > vw + 1 || sb.height > vh + 1) bad.push('settings sheet does not fit'); }
        return bad;
      }, sn);
      if (errs.length) r.push('JS: ' + errs[0].slice(0, 120));
      const f = dn + '-' + sn + '.png'; await p.screenshot({ path: path.join(OUT, f) });
      rows.push([dn, sn, r.length ? 'FAIL' : 'PASS', r.join(' | '), f]); if (r.length) fails++;
    }
    await ctx.close();
  }
  await b.close();
  for (const r of rows) console.log(r.slice(0, 4).join('\t'));
  console.log('TOTAL', rows.length, 'FAIL', fails);
  const html = '<!doctype html><meta charset=utf-8><title>QA matrix</title><style>body{font:13px sans-serif;background:#222;color:#eee}figure{display:inline-block;margin:6px;vertical-align:top}img{max-height:360px;border:1px solid #555}.FAIL{color:#f77}</style>' +
    rows.map(r => '<figure><img src="' + r[4] + '"><figcaption class="' + r[2] + '">' + r[0] + ' · ' + r[1] + ' · ' + r[2] + (r[3] ? '<br>' + r[3].replace(/</g, '&lt;') : '') + '</figcaption></figure>').join('');
  fs.writeFileSync(path.join(OUT, 'index.html'), html); console.log('REPORT', path.join(OUT, 'index.html'));
  process.exit(fails ? 1 : 0);
})();
