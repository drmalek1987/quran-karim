// C1 (Madinah-style navy leather cover) with the name in several calligraphic fonts and the ayah in a cartouche.
// node store/icon-options/make-c1.js -> F1..F6.png (512) + sheet5.png + big5.png
const path = require('path'), fs = require('fs'), cp = require('child_process');
let root = cp.execSync('npm root -g', { encoding: 'utf8', shell: true }).trim(), pw;
for (const s of ['playwright', '@playwright/test/node_modules/playwright']) { try { pw = require(path.join(root, s)); break; } catch (e) {} }
const D = __dirname, R = path.resolve(D, '..', '..');
global.window = global; require(path.join(R, 'web', 'quran-data.js'));
const AYAH = window.QURAN.t[53][16].split(' ').slice(0, 4).join(' ');
// [id, label, css family, weight, size, the word, baseline y]
const V = [
  ['F1', 'Amiri Quran (الحالي)', 'AmiriQ', 400, 50, 'يَسَّرۡنَا', 222],
  ['F2', 'Amiri (نسخ)', 'Amiri', 700, 50, 'يَسَّرْنَا', 220],
  ['F3', 'Aref Ruqaa (رقعة)', 'Aref Ruqaa', 700, 54, 'يَسَّرْنَا', 214],
  ['F4', 'Reem Kufi (كوفي)', 'Reem Kufi', 700, 50, 'يسّرنا', 216],
  ['F5', 'El Messiri', 'El Messiri', 700, 52, 'يَسَّرْنَا', 214],
  ['F6', 'Lalezar', 'Lalezar', 400, 52, 'يسّرنا', 214],
];
const defs = fs.readFileSync(path.join(D, 'icons4.html'), 'utf8').match(/<defs>[\s\S]*?<\/defs>/)[0];
const cover = ([id, , fam, w, size, word, y]) => `<svg id="${id}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="url(#bg)"/>
  <g filter="url(#sh)"><rect x="98" y="78" width="306" height="362" rx="12" fill="url(#pages)"/>
    <rect x="108" y="70" width="306" height="362" rx="12" fill="#183456" filter="url(#leather)"/></g>
  <rect x="380" y="70" width="34" height="362" fill="#0f2442" opacity=".7"/>
  <rect x="108" y="70" width="306" height="362" rx="12" fill="url(#shine)"/>
  <g fill="none" stroke="url(#gold)" filter="url(#emboss)">
    <rect x="126" y="88" width="238" height="326" rx="4" stroke-width="7"/><rect x="138" y="100" width="214" height="302" rx="2" stroke-width="2.5"/>
    <rect x="152" y="350" width="186" height="40" rx="20" stroke-width="3"/></g>
  <g fill="url(#gold)" filter="url(#emboss)">
    <use href="#corner" transform="translate(138 100) scale(.55)"/><use href="#corner" transform="translate(352 100) scale(-.55 .55)"/>
    <use href="#shamsa" transform="translate(245 216) scale(1.38 .82)"/></g>
  <use href="#shamsa" transform="translate(245 216) scale(1.22 .7)" fill="#183456"/>
  <text x="245" y="${y}" dominant-baseline="central" text-anchor="middle" font-family="${fam}" font-weight="${w}" font-size="${size}" fill="url(#gold)" filter="url(#emboss)">${word}</text>
  <text x="245" y="377" text-anchor="middle" font-family="AmiriQ" font-size="19" fill="#f3dc9a">${AYAH}</text>
</svg>`;
const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@700&family=Aref+Ruqaa:wght@700&family=Reem+Kufi:wght@700&family=El+Messiri:wght@700&family=Lalezar&display=block">
<style>@font-face{font-family:AmiriQ;src:url(../../web/fonts/amiri-quran.woff2)}body{margin:0}svg{display:block;width:512px;height:512px}</style></head><body>
<svg width="0" height="0" style="position:absolute">${defs}</svg>${V.map(cover).join('\n')}</body></html>`;
(async () => {
  const f = path.join(D, 'icons5.html'); fs.writeFileSync(f, html);
  const b = await pw.chromium.launch(), pg = await b.newPage({ viewport: { width: 512, height: 4000 } });
  await pg.goto(require('url').pathToFileURL(f).href, { waitUntil: 'networkidle' }); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(500);
  for (const v of V) await (await pg.$('#' + v[0])).screenshot({ path: path.join(D, v[0] + '.png') });
  const U = n => require('url').pathToFileURL(path.join(D, n + '.png')).href;
  await pg.setViewportSize({ width: 1500, height: 420 });
  await pg.setContent(`<html dir="rtl"><style>body{margin:0;background:#eef0f4;font:700 18px sans-serif;display:flex;gap:14px;padding:16px}
    .c{display:flex;flex-direction:column;align-items:center;gap:8px;width:230px}.big{width:220px;height:220px;border-radius:48px}
    .row{display:flex;gap:8px;align-items:center}.sq{width:64px;height:64px;border-radius:16px}.ci{width:64px;height:64px;border-radius:50%}.xs{width:36px;height:36px;border-radius:9px}</style>
    ${V.map(v => `<div class="c"><img class="big" src="${U(v[0])}"><div class="row"><img class="sq" src="${U(v[0])}"><img class="ci" src="${U(v[0])}"><img class="xs" src="${U(v[0])}"></div><b>${v[0]} · ${v[1]}</b></div>`).join('')}</html>`);
  await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(D, 'sheet5.png'), fullPage: true });
  await b.close();
  cp.execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...V.flatMap(v => ['-i', path.join(D, v[0] + '.png')]),
    '-filter_complex', '[0][1][2]hstack=3[a];[3][4][5]hstack=3[b];[a][b]vstack', path.join(D, 'big5.png')]);
  console.log('ok');
})();
