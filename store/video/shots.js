// Fresh 1080×1920 phone screenshots of the web app (the page the Android WebView shows) for the Play promo video,
// in the Play build's flavour with seeded state (common.js), one per route, to store/video/shots/<name>.png.
// Needs the edition packs unzipped in web/ (web/editions/kfgqpc, kfgqpc-tj, kfold, shamarly; not in git).
// Usage: node store/video/shots.js [name ...]
const path = require('path'), fs = require('fs');
const { loadPW, serve, openApp } = require('./common');
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });

// name: [edition, mode, tajweed, hash]
const SHOTS = {
  home: ['kfgqpc', 'pages', false, '#/'],
  kfgqpc: ['kfgqpc', 'pages', false, '#/p/3'],
  kfold: ['kfold', 'pages', false, '#/p/3'],
  shamarly: ['shamarly', 'pages', false, '#/p/4'],
  tajweed: ['kfgqpc', 'pages', true, '#/p/3'],
  tafsir: ['kfgqpc', 'text', false, '#/a/2/255'],
  hifzmap: ['kfgqpc', 'pages', false, '#/hifzmap'],
  hifztest: ['kfgqpc', 'pages', false, '#/hifztest'],
  khatma: ['kfgqpc', 'pages', false, '#/khatma'],
  azkar: ['kfgqpc', 'pages', false, '#/azkar/m'],
  prayer: ['kfgqpc', 'pages', false, '#/prayer'],
  qibla: ['kfgqpc', 'pages', false, '#/qibla'],
  review: ['kfgqpc', 'pages', false, '#/hifzlog'],
  talqin: ['kfgqpc', 'pages', false, '#/talqin'],
  mutash: ['kfgqpc', 'pages', false, '#/mutash'],
  students: ['kfgqpc', 'pages', false, '#/students'],
};

(async () => {
  const { srv, base } = await serve(); const want = process.argv.slice(2); const b = await loadPW().chromium.launch();
  for (const [name, [ed, mode, tj, hash]] of Object.entries(SHOTS)) {
    if (want.length && !want.includes(name)) continue;
    const { ctx, p } = await openApp(b, base, { ed, mode, tj, hash });
    await p.screenshot({ path: path.join(OUT, name + '.png') });
    console.log(name, p.errs.length ? p.errs : 'ok'); await ctx.close();
  }
  await b.close(); srv.close();
})();
