// Drives the app's web UI (web/index.html, the same page the Android WebView shows) in headless Chromium.
// Usage (from the repo root): NODE_PATH=$(npm root -g) node .claude/skills/run-quran-karim/driver.mjs [hash ...]
// Each hash (e.g. "#/", "#/s/2/255" = surah 2 ayah 255 in text view, "#/a/2/255" = ayah tafsir screen) is opened and screenshotted to $OUT (default /tmp/qk-shots).
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(process.env.WEB || 'web');
const out = process.env.OUT || '/tmp/qk-shots';
fs.mkdirSync(out, { recursive: true });
const hashes = process.argv.slice(2).length ? process.argv.slice(2) : ['#/', '#/s/1/1', '#/a/2/255'];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { window.QA_NOFS = true; });   // no full-screen request (it hides the nav in headless runs)
await p.goto('file://' + root + '/index.html');
// Text mode: needs no downloaded page images (editions come as zips from the "editions" branch at runtime).
await p.evaluate(() => { localStorage.setItem('q.mode', JSON.stringify('text')); localStorage.setItem('q.welcomed', 'true'); });
await p.reload(); await p.waitForTimeout(800);
for (const [i, h] of hashes.entries()) {
  await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(900);
  const f = path.join(out, `${i}-${h.replace(/[^a-z0-9]+/gi, '_')}.png`);
  await p.screenshot({ path: f });
  console.log('shot', f, '| title:', await p.evaluate(() => (document.getElementById('title') || {}).textContent || document.title));
}
if (process.env.SETTINGS) { await p.click('#btnSettings').catch(() => {}); await p.waitForTimeout(500); await p.screenshot({ path: path.join(out, 'settings.png') }); console.log('shot settings'); }
console.log('page errors:', errs.length ? errs : 'none');
await b.close();
