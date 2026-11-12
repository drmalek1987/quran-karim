// Final app icon (chosen 2026-11-12, "P6"): the Met 56.222 binding's medallion (CC0) with «يَسَّرْنَا» engraved in it.
// The word's INK box (canvas measureText) is centred on the medallion centre, so it sits in the middle optically.
// node store/icon-options/make-icon.js -> store/icon-options/icon-1024.png + adaptive-fg-1024.png (Android sizes: make-icon.py)
const path = require('path'), fs = require('fs'), cp = require('child_process');
let root = cp.execSync('npm root -g', { encoding: 'utf8', shell: true }).trim(), pw;
for (const s of ['playwright', '@playwright/test/node_modules/playwright']) { try { pw = require(path.join(root, s)); break; } catch (e) {} }
const D = __dirname, U = n => require('url').pathToFileURL(path.join(D, n)).href;
// medallion centre in the base-1024 framing (measured on the photo), and the word size there
const CX = 500, CY = 492, SIZE = 256, WORD = 'يَسَّرْنَا';
const html = (img, scale) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@700&display=block"></head>
<body style="margin:0"><canvas id="c" width="1024" height="1024"></canvas><script>
(async () => {
  await document.fonts.load('700 ${SIZE}px "Aref Ruqaa"', '${WORD}');
  const c = document.getElementById('c'), x = c.getContext('2d'), im = new Image();
  im.src = '${U(img)}'; await im.decode(); x.drawImage(im, 0, 0, 1024, 1024);
  const s = ${SIZE} * ${scale}, cx = 512 + (${CX} - 512) * ${scale}, cy = 512 + (${CY} - 512) * ${scale};
  x.font = '700 ' + s + 'px "Aref Ruqaa"'; x.direction = 'rtl'; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
  const m = x.measureText('${WORD}');
  // ink box: left = -actualBoundingBoxLeft, right = actualBoundingBoxRight, top = -ascent, bottom = descent
  const ox = cx - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2, oy = cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  const t = (dx, dy, fill, blur, sc) => { x.save(); x.shadowColor = sc || 'transparent'; x.shadowBlur = blur || 0; x.fillStyle = fill; x.fillText('${WORD}', ox + dx, oy + dy); x.restore(); };
  // Tooled like the cover's own cartouches: raised gold letters cut from the photo's gold, on a sunken brown leather ground.
  const e = s / 48;
  x.save(); x.lineJoin = 'round'; x.strokeStyle = 'rgba(58,30,9,.85)'; x.lineWidth = s / 6.5;          // leather ground
  x.shadowColor = 'rgba(30,14,3,.75)'; x.shadowBlur = s / 12; x.strokeText('${WORD}', ox, oy); x.restore();
  t(e, e * 1.2, 'rgba(20,9,2,.9)', e * 1.5, 'rgba(0,0,0,.55)');                                          // cast shadow (light from the top-left)
  t(-e * .6, -e * .6, 'rgba(255,243,200,.95)');                                                          // lit top-left rim
  const g = document.createElement('canvas'); g.width = g.height = 1024; const gx = g.getContext('2d');
  gx.filter = 'brightness(1.22) contrast(1.15) saturate(1.1)'; gx.drawImage(im, 0, 0, 1024, 1024); gx.filter = 'none';
  gx.globalCompositeOperation = 'destination-in'; gx.font = x.font; gx.direction = 'rtl'; gx.textAlign = 'left'; gx.fillText('${WORD}', ox, oy);
  x.drawImage(g, 0, 0);                                                                                   // the gold itself, with its tooling
  document.title = 'done';
})();
</script></body></html>`;
(async () => {
  const b = await pw.chromium.launch(), pg = await b.newPage({ viewport: { width: 1024, height: 1024 } });
  for (const [img, scale, out] of [['base-1024.png', 1, 'icon-1024.png'], ['adaptive-1024.png', .60 / .90, 'adaptive-fg-1024.png']]) {
    const f = path.join(D, '_icon.html'); fs.writeFileSync(f, html(img, scale));
    await pg.goto(require('url').pathToFileURL(f).href, { waitUntil: 'networkidle' }); await pg.waitForFunction(() => document.title === 'done');
    await (await pg.$('#c')).screenshot({ path: path.join(D, out) });   // (a file:// image taints the canvas for toDataURL)
  }
  fs.unlinkSync(path.join(D, '_icon.html')); await b.close(); console.log('ok');
})();
