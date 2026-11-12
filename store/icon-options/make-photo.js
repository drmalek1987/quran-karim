// Adds the name onto P2 (whole cover) and P4 (medallion close-up), then makes sheet6.png + big6.png.
const path = require('path'), fs = require('fs'), cp = require('child_process');
let root = cp.execSync('npm root -g', { encoding: 'utf8', shell: true }).trim(), pw;
for (const s of ['playwright', '@playwright/test/node_modules/playwright']) { try { pw = require(path.join(root, s)); break; } catch (e) {} }
const D = __dirname, U = n => require('url').pathToFileURL(path.join(D, n)).href;
const word = (cx, cy, w, h, size, plate, clear) => plate
  ? `<div style="position:absolute;left:${cx - w / 2}px;top:${cy - h / 2}px;width:${w}px;height:${h}px;clip-path:ellipse(50% 50%);
      background:radial-gradient(#1e3a5f,#0f1e35);box-shadow:inset 0 0 0 ${Math.max(3, size / 12)}px #e2bd63;display:grid;place-items:center;border-radius:50%">
      <span style="font:700 ${size}px/1 'Aref Ruqaa';color:#f6dc95;padding-top:${size * .12}px">يَسَّرْنَا</span></div>`
  : `<div style="position:absolute;left:${cx - w / 2}px;top:${cy - h / 2}px;width:${w}px;height:${h}px;display:grid;place-items:center">
      <span style="font:700 ${size}px/1 'Aref Ruqaa';padding-top:${size * .12}px;${!clear
        ? `color:#3a2208;text-shadow:0 ${size / 40}px 0 rgba(255,236,170,.85),0 -${size / 60}px 0 rgba(0,0,0,.35)`
        : clear === 1
        ? `color:#2a1503;-webkit-text-stroke:${size / 60}px #fff0c0;paint-order:stroke fill;text-shadow:0 ${size / 30}px ${size / 40}px rgba(0,0,0,.45)`
        : `color:#fff3cf;-webkit-text-stroke:${size / 45}px #2a1503;paint-order:stroke fill;text-shadow:0 ${size / 30}px ${size / 25}px rgba(0,0,0,.6)`}">يَسَّرْنَا</span></div>`;
const page = (img, overlay) => `<!doctype html><html dir="rtl"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@700&display=block">
<style>body{margin:0;width:512px;height:512px;position:relative;background:url(${U(img)}) 0 0/512px 512px}</style></head><body>${overlay}</body></html>`;
(async () => {
  const b = await pw.chromium.launch(), pg = await b.newPage({ viewport: { width: 512, height: 512 } });
  for (const [img, out, ov] of [['P2.png', 'P2w', word(256, 252, 150, 104, 40)], ['P4.png', 'P4w', word(256, 250, 330, 230, 96)], ['P4.png', 'P6w', word(256, 252, 420, 260, 128, 0, 1)], ['P4.png', 'P7w', word(256, 252, 420, 260, 128, 0, 2)], ['P4.png', 'P5w', word(256, 250, 300, 210, 84, 1)]]) {
    const f = path.join(D, '_tmp.html'); fs.writeFileSync(f, page(img, ov));
    await pg.goto(require('url').pathToFileURL(f).href, { waitUntil: 'networkidle' }); await pg.evaluate(() => document.fonts.ready);
    await pg.screenshot({ path: path.join(D, out + '.png') });
  }
  fs.unlinkSync(path.join(D, '_tmp.html'));
  const V = [['P4w', 'قبل'], ['P6w', 'أكبر + محفورة أوضح'], ['P7w', 'أكبر + ذهبي فاتح بحدود']];
  await pg.setViewportSize({ width: 820, height: 420 });
  await pg.setContent(`<html dir="rtl"><style>body{margin:0;background:#eef0f4;font:700 18px sans-serif;display:flex;gap:16px;padding:16px}
    .c{display:flex;flex-direction:column;align-items:center;gap:8px;width:240px}.big{width:220px;height:220px;border-radius:48px}
    .row{display:flex;gap:8px;align-items:center}.sq{width:64px;height:64px;border-radius:16px}.ci{width:64px;height:64px;border-radius:50%}.xs{width:36px;height:36px;border-radius:9px}</style>
    ${V.map(v => `<div class="c"><img class="big" src="${U(v[0] + '.png')}"><div class="row"><img class="sq" src="${U(v[0] + '.png')}"><img class="ci" src="${U(v[0] + '.png')}"><img class="xs" src="${U(v[0] + '.png')}"></div><b>${v[0].replace('w', '')} · ${v[1]}</b></div>`).join('')}</html>`);
  await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(D, 'sheet7.png'), fullPage: true }); await b.close();
  cp.execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...V.flatMap(v => ['-i', path.join(D, v[0] + '.png')]),
    '-filter_complex', '[0][1][2]hstack=3', path.join(D, 'big7.png')]);
  console.log('ok');
})();
