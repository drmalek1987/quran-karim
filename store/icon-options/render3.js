// Renders store/icon-options/icons3.html to i1..i5.png (512) + sheet.png (big, launcher-size, round mask).
const path = require('path'), cp = require('child_process');
let root = cp.execSync('npm root -g', { encoding: 'utf8', shell: true }).trim(), pw;
for (const s of ['playwright', '@playwright/test/node_modules/playwright']) { try { pw = require(path.join(root, s)); break; } catch (e) {} }
const D = __dirname, U = f => require('url').pathToFileURL(path.join(D, f)).href;
(async () => {
  const b = await pw.chromium.launch(), pg = await b.newPage({ viewport: { width: 512, height: 3000 } });
  await pg.goto(U('icons3.html')); await pg.evaluate(() => document.fonts.ready);
  const ids = await pg.$$eval('svg[id]', s => s.map(x => x.id));
  for (const id of ids) await (await pg.$('#' + id)).screenshot({ path: path.join(D, id + '.png') });
  const all = ids;
  const cell = n => `<div class="c"><img src="${U(n + '.png')}" class="big"><div class="row"><img src="${U(n + '.png')}" class="sq"><img src="${U(n + '.png')}" class="ci"><img src="${U(n + '.png')}" class="xs"></div><b>${n}</b></div>`;
  await pg.setViewportSize({ width: 1500, height: 420 });
  await pg.setContent(`<html dir="rtl"><style>body{margin:0;background:#eef0f4;font:700 26px sans-serif;display:flex;gap:16px;padding:18px}
    .c{display:flex;flex-direction:column;align-items:center;gap:10px}.big{width:220px;height:220px;border-radius:48px}
    .row{display:flex;gap:10px;align-items:center}.sq{width:64px;height:64px;border-radius:16px}.ci{width:64px;height:64px;border-radius:50%}.xs{width:36px;height:36px;border-radius:9px}</style>${all.map(cell).join('')}</html>`);
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: path.join(D, 'sheet3.png'), fullPage: true });
  await b.close();
})();
