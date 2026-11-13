// Shared helpers for the promo-video scripts: find the globally installed Playwright, serve web/ with the Play build's
// flags, seed realistic localStorage state, and open the app on a route in a phone-sized page.
const path = require('path'), fs = require('fs'), cp = require('child_process'), http = require('http');
function loadPW() {
  try { return require('playwright'); } catch (e) {}
  let root = ''; try { root = cp.execSync('npm root -g', { encoding: 'utf8', shell: true }).trim(); } catch (e) {}
  for (const c of [root, process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules')].filter(Boolean))
    for (const sub of ['playwright', 'playwright-core', '@playwright/test/node_modules/playwright', '@playwright/test/node_modules/playwright-core'])
      try { return require(path.join(c, sub)); } catch (e) {}
  throw new Error('playwright not found');
}
const R = path.resolve(__dirname, '..', '..');
const url = f => require('url').pathToFileURL(path.isAbsolute(f) ? f : path.join(R, f)).href;

// web/ on a local port; flags.js is swapped for the Google Play build's (no Haramain, no unlicensed books / adhan audio).
const WEB = path.join(R, 'web');
const FLAGS = 'window.NO_HARMAIN = true;\nwindow.NO_BOOKS = ["darwish", "tanwir"];\nwindow.NO_ADHAN_AUDIO = true;\n';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/json' };
function serve() {
  const srv = http.createServer((q, s) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    if (u === '/flags.js') { s.writeHead(200, { 'content-type': 'text/javascript' }); return s.end(FLAGS); }
    const f = path.join(WEB, u === '/' ? 'index.html' : u);
    if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, base: 'http://127.0.0.1:' + srv.address().port + '/index.html' })));
}

// Runs in the page: a month of believable use (hifz, review dates, students, khatma, reading stats, recitation stats).
function seed(ed, mode, tj, turn) {
  const d = new Date(), ds = n => { const x = new Date(d - n * 864e5); return x.getFullYear() + '-' + (x.getMonth() + 1) + '-' + x.getDate(); };
  const S = (k, v) => localStorage.setItem('q.' + k, JSON.stringify(v));
  S('welcomed', true); S('onboarded', true); S('micTips', true); S('modelConsent', false); S('theme', 'light');
  S('edition', ed); S('mode', mode); S('tajweed', tj); S('turn', turn || 'h');
  S('qiblaLoc', [30.0444, 31.2357, 'القاهرة']);
  // hifz: al-Fatiha, al-Baqara 1-141, al-Kahf, Ya-Sin, al-Mulk, Juz' Amma; a few older or with mistakes (yellow on the map)
  const ayat = window.QURAN.t, H = {};
  const add = (s, a0, a1, age, bad) => { for (let a = a0; a <= a1; a++) H[s + ':' + a] = { d: ds(age), ok: bad && a % 7 === 0 ? 0 : 1 }; };
  add(1, 1, 7, 1); add(2, 1, 141, 3); add(18, 1, 110, 20, true); add(36, 1, 83, 2); add(67, 1, 30, 25);
  for (let s = 78; s <= 114; s++) add(s, 1, ayat[s - 1].length, s % 5 === 0 ? 30 : 4, s % 9 === 0);
  S('hifzAyat', H);
  // memorised surahs with spaced-review dates (q.hifzLog / q.hzRev {s: {m, r, iv}}): some due today
  const L = {}; [[1, 3, 7], [18, 9, 7], [36, 2, 14], [67, 30, 14], [78, 8, 7], [87, 1, 7], [112, 40, 30], [114, 2, 30], [2, 6, 7]]
    .forEach(([s, age, iv]) => { L[s] = { m: ds(60), r: ds(age), iv }; });
  S('hifzLog', L); S('hzRev', L);
  const SC = {}; [[1, 100, 3], [18, 91, 9], [36, 96, 2], [67, 88, 30], [78, 94, 8], [2, 92, 6]].forEach(([s, sc, age]) => { SC[s] = { d: ds(age), score: sc }; });
  S('hifzScores', SC);
  // three students' results pasted from their «ابعت للمحفّظ» messages (made-up names)
  const rec = (n, s, a0, a1, sc, age, miss) => ({ n, r: [s + ':' + a0, s + ':' + a1], d: ds(age), k: 'm', sc, ay: a1 - a0 + 1, miss: miss.map(a => s + ':' + a) });
  S('students', {
    'عبد الرحمن': [rec('عبد الرحمن', 18, 1, 31, 94, 0, [17, 22]), rec('عبد الرحمن', 18, 1, 16, 88, 3, [9])],
    'مريم': [rec('مريم', 36, 1, 40, 100, 1, []), rec('مريم', 67, 1, 30, 97, 5, [12])],
    'يوسف': [rec('يوسف', 78, 1, 40, 82, 0, [14, 27, 33]), rec('يوسف', 79, 1, 46, 76, 2, [8, 30, 41])],
  });
  S('khatma.' + ed, { start: ds(11), days: 30, from: 1, to: 604, done: 236 });
  S('lastPage.' + ed, 236);
  S('goal', 20);
  // reading stats: q.stats {day: [s*1000+a]}, q.statsWL {day: [words, letters]}, q.rewards {days, khatmas, got}
  const st = {}, wl = {}, days = {}; let s = 3, a = 1;
  for (let i = 24; i >= 0; i--) {
    if (i % 6 === 5) continue;                       // a few days off, like a real month
    const k = ds(i), ids = [], n = 25 + ((i * 37) % 30);
    for (let j = 0; j < n; j++) { ids.push(s * 1000 + a); if (++a > ayat[s - 1].length) { a = 1; s = s % 114 + 1; } }
    st[k] = ids; wl[k] = [n * 14, n * 60]; days[k] = 1;
  }
  S('stats', st); S('statsWL', wl); S('rewards', { days, khatmas: 1, got: ['d1', 's3', 's7', 's14', 'k1'] });
  // recitation log + recogniser stats of the last week
  const rl = []; [[18, 31, 2], [36, 40, 0], [67, 30, 1], [78, 40, 3], [2, 20, 1], [1, 7, 0]].forEach(([s2, ay, bad], i) =>
    rl.push({ d: ds(i), s: s2, ay, w: ay * 11, bad, wrong: [] }));
  S('reciteLog', rl);
  const as = {}; for (let i = 6; i >= 0; i--) as[ds(i)] = { u: 30 + i * 3, w: 400 + i * 40, ok: 372 + i * 37, bad: 28 + i * 3, rh: 280 + i * 30, rm: 20 + i * 2, loc: 30 + i * 3, lost: 2, dms: 4200 + i * 300, dn: 30 + i * 3, dlen: 120000 + i * 9000 };
  S('asrStats', as);
}

// Opens the app at hash in a fresh 360-wide @3x context with the seed applied; init runs before app.js.
async function openApp(b, base, { ed = 'kfgqpc', mode = 'pages', tj = false, turn = 'h', hash = '#/', height = 640, init, offline } = {}) {
  const ctx = await b.newContext({ viewport: { width: 360, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.addInitScript(() => { window.QA_NOFS = true; });
  if (init) await p.addInitScript(init);
  await p.goto(base); await p.waitForFunction(() => window.QURAN);
  await p.evaluate(`(${seed})(${JSON.stringify(ed)}, ${JSON.stringify(mode)}, ${tj}, ${JSON.stringify(turn)})`);
  await p.goto(base + hash); await p.reload(); await p.waitForTimeout(2500);
  await p.evaluate(() => document.fonts.ready);
  if (offline) await ctx.setOffline(true);
  return { ctx, p };
}
module.exports = { loadPW, R, url, serve, seed, openApp };
