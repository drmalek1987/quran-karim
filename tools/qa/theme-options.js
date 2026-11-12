// Renders the real app (web/index.html) with several colour themes for a side-by-side choice.
// Usage: node tools/qa/theme-options.js  -> build/themes/<id>-<screen>.png + build/themes/sheet.png
const path = require('path'), fs = require('fs'), cp = require('child_process');
function loadPW() {
  try { return require('playwright'); } catch (e) {}
  let root = ''; try { root = cp.execSync('npm root -g', { encoding: 'utf8', shell: true }).trim(); } catch (e) {}
  for (const c of [root, process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules')].filter(Boolean))
    for (const sub of ['playwright', 'playwright-core', '@playwright/test/node_modules/playwright', '@playwright/test/node_modules/playwright-core'])
      try { return require(path.join(c, sub)); } catch (e) {}
  throw new Error('playwright not found');
}
const R = path.resolve(__dirname, '..', '..');
const W = require('url').pathToFileURL(path.join(R, 'web', 'index.html')).href;
const OUT = path.join(R, 'build', 'themes'); fs.mkdirSync(OUT, { recursive: true });
// [id, label, accent, grad (dark, mid, light), soft, gold, gold-soft, bg, hl]
const THEMES = [
  ['0-green', 'الحالي: أخضر زمردي', '#0f6b4f', ['#0a4535', '#0f6b4f', '#16876a'], '#e9f3ee', '#b48a33', '#f7efdc', '#f4f2ec', '#f6ecc9'],
  ['1-navy', 'كحلي وذهبي', '#1e3a5f', ['#122540', '#1e3a5f', '#2b5283'], '#e7edf5', '#c09a2e', '#f7f0da', '#f2f3f6', '#f3ecc8'],
  ['2-brown', 'بني ومخطوطة', '#6b4423', ['#3f2714', '#6b4423', '#8c5d32'], '#f2e9dc', '#b8892f', '#f6ecd6', '#f6f0e4', '#f3e6c2'],
  ['3-teal', 'تركواز', '#0d7480', ['#084c55', '#0d7480', '#159ea3'], '#e2f2f2', '#c48f3a', '#f8eedb', '#f0f5f4', '#f5ebc8'],
  ['4-maroon', 'عنابي', '#7a2335', ['#4a1320', '#7a2335', '#9d3447'], '#f6e8eb', '#c49a3a', '#f8efdc', '#f6f1ee', '#f5e9c6'],
];
const SCREENS = [['home', '#/'], ['tafsir', '#/a/2/255'], ['prayer', '#/prayer']];
(async () => {
  const b = await loadPW().chromium.launch();
  for (const t of THEMES) {
    const [id, , ac, g, soft, gold, goldSoft, bg, hl] = t;
    const css = `:root, :root[data-theme] { --accent: ${ac} !important; --grad: linear-gradient(135deg, ${g[0]} 0%, ${g[1]} 55%, ${g[2]} 100%) !important;
      --soft: ${soft} !important; --gold: ${gold} !important; --gold-soft: ${goldSoft} !important; --bg: ${bg} !important; --hl: ${hl} !important; }`;
    for (const [sn, hash] of SCREENS) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, locale: 'ar' });
      await ctx.addInitScript(() => { try { localStorage.setItem('q.welcomed', '1'); localStorage.setItem('q.theme', '"light"'); } catch (e) {} });
      const pg = await ctx.newPage();
      await pg.goto(W + hash); await pg.addStyleTag({ content: css });
      await pg.waitForTimeout(1500);
      await pg.evaluate(() => document.querySelectorAll('.dlg-back,.wel').forEach(x => x.remove()));
      await pg.screenshot({ path: path.join(OUT, `${id}-${sn}.png`) });
      await ctx.close();
    }
  }
  await b.close();
  console.log(THEMES.map(t => t[0] + ' ' + t[1]).join('\n'));
})();
