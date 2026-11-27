#!/usr/bin/env node
// Change-impact analysis for Quran Karim (no dependencies).
//   node tools/qa/impact.js [base=HEAD] [--run] [--ed=kfgqpc] [--deep] [--json] [--check-registry]
// Reads `git diff -U0 base` (+ untracked files under web/ and android/), maps changed lines to the enclosing JS functions,
// Java methods, CSS selectors, HTML ids and q.* keys, maps those to features through the anchors in tools/qa/features.json,
// and prints the ui.js groups to run and the manual QA items (tools/qa/qa-items.json) to re-check on the phone.
//   --run             run ui.js once with ONLY="g1|g2|..." (and ED=...) and summarise TOTAL / FAIL
//   --deep            also count features reached through the callers of a changed function (one level)
//   --check-registry  verify every anchor / ui group / feature id in the two JSON files still exists in the code (exit 1 on drift)
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2), flag = n => argv.includes('--' + n);
const opt = n => { const a = argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : null; };
const BASE = argv.find(a => !a.startsWith('--')) || 'HEAD';
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const jsonOf = f => JSON.parse(rd(f).replace(/^﻿/, ''));
const FEATURES = jsonOf('tools/qa/features.json').features, ITEMS = jsonOf('tools/qa/qa-items.json').items;
const SHARED = new Set(['askYes', 'save', 'load', 'applySettings', 'route', 'esc', 'ic', 'el', 'toast', 'norm', 'ar', 'en', 'edKey', 'tick',
  'showPage', 'openPage', 'switchEdition', 'useEdition', 'tabbar', 'syncAlarms', 'syncWidget', 'askText', 'shareDialog', 'ayahBar', 'hzFlush']);

// ---------- definitions found in a source file ----------
const JS_DEFS = [
  /^(\s*)(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/,
  /^(\s*)(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(?function\b|\{\s*(?:\/\/.*)?$|\(?[\w$, ]*\)?\s*=>)/,
  /^(\s*)(?:window\.|this\.)([A-Za-z_$][\w$]*)\s*=/,
  /^(\s*)([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\b/,
  /^(\s*)([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?function\b/,
];
const JAVA_DEF = /^(\s{2,8})(?:(?:public|private|protected|static|final|synchronized|native|abstract)\s+)+[\w<>\[\],.? ]+?\s+([A-Za-z_]\w*)\s*\(/;
function defsOf(file, text) {
  const lines = text.split('\n'), out = [];
  const isJs = /\.js$/.test(file), isJava = /\.java$/.test(file);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (isJs) { for (const re of JS_DEFS) { const m = re.exec(l); if (m && !/^(if|for|while|switch|catch|return)$/.test(m[2])) { out.push({ name: m[2], line: i + 1, indent: m[1].length }); break; } } }
    else if (isJava) { const m = JAVA_DEF.exec(l); if (m && !/^(if|for|while|switch|catch|return|new)$/.test(m[2])) out.push({ name: m[2], line: i + 1, indent: m[1].length }); }
  }
  return out;
}
// the defs enclosing `line` (innermost first), by indentation
function chainAt(defs, line) {
  const out = []; let ind = Infinity;
  for (let i = defs.length - 1; i >= 0; i--) {
    const d = defs[i]; if (d.line > line) continue;
    if (d.indent < ind) { out.push(d.name); ind = d.indent; if (d.indent === 0) break; }
  }
  return out;
}

// ---------- git diff ----------
function git(args) { try { return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return ''; } }
function parseDiff(txt) {
  const files = {}; let cur = null, hunk = null;
  for (const l of txt.split('\n')) {
    let m;
    if ((m = /^\+\+\+ b\/(.*)$/.exec(l))) { cur = files[m[1]] = files[m[1]] || { hunks: [] }; continue; }
    if (/^--- /.test(l)) continue;
    if ((m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(l)) && cur) { hunk = { start: +m[3], len: m[4] === undefined ? 1 : +m[4], lines: [] }; cur.hunks.push(hunk); continue; }
    if (hunk && /^[+-]/.test(l)) hunk.lines.push(l);
  }
  return files;
}
const CODE = /^(web\/(?!quran-data\.js|books\/|editions\/|pages\/|tjpages\/)[^/]+\.(js|css|html)|android\/.*\.(java|xml)|tools\/qa\/ui\.js)$/;
function collectChanges() {
  const files = parseDiff(git(['diff', '-U0', '--no-color', BASE, '--', 'web', 'android', 'tools/qa/ui.js']));
  const un = git(['ls-files', '--others', '--exclude-standard', 'web', 'android']).split('\n').filter(Boolean);
  for (const f of un) { if (!CODE.test(f)) continue; let n = 0; try { n = rd(f).split('\n').length; } catch (e) { continue; } files[f] = { untracked: true, hunks: [{ start: 1, len: n, lines: [] }] }; }
  return files;
}

// ---------- helpers on the code base ----------
const webJs = fs.readdirSync(path.join(ROOT, 'web')).filter(f => /\.js$/.test(f)).map(f => 'web/' + f);
const javaFiles = []; (function walk(d) { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const p = d + '/' + e.name; if (e.isDirectory()) walk(p); else if (/\.java$/.test(e.name)) javaFiles.push(p); } })('android');
const cache = {}; const src = f => cache[f] || (cache[f] = rd(f));
const defCache = {}; const defsFor = f => defCache[f] || (defCache[f] = defsOf(f, src(f)));
const KEYRE = k => new RegExp('(?:\\b(?:load|save|edKey|rm|del)\\(\\s*|["\'`])"?q?\\.?' + k.replace(/^q\./, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\'`]|\\bq\\.' + k.replace(/^q\./, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
function keysIn(text) {
  const ks = new Set(); let m;
  const re1 = /\b(?:load|save|edKey|localStorage\.(?:get|set|remove)Item)\(\s*["']((?:q\.)?[A-Za-z][\w.]*)["']/g; while ((m = re1.exec(text))) ks.add('q.' + m[1].replace(/^q\./, ''));
  const re2 = /["'`]q\.([A-Za-z][\w.]*)/g; while ((m = re2.exec(text))) ks.add('q.' + m[1].replace(/\.$/, ''));
  return ks;
}
function uiGroups() { const g = {}; for (const m of src('tools/qa/ui.js').matchAll(/const (G[A-Za-z0-9_]*) = '([^']*)'/g)) g[m[1]] = m[2]; return g; }

// ---------- registry check ----------
function checkRegistry() {
  const fail = [], warn = []; const ids = new Set(), groups = Object.values(uiGroups());
  const allJs = webJs.map(f => [f, src(f)]);
  const hasJs = n => { const re = new RegExp('(?:function\\s*\\*?\\s+' + n + '\\s*\\(|(?:var|let|const)\\s+' + n + '\\b|\\b' + n + '\\s*=\\s*function|window\\.' + n + '\\s*=|\\b' + n + '\\s*:\\s*function|\\b' + n + '\\s*=\\s*\\()'); return allJs.some(([, t]) => re.test(t)); };
  const css = src('web/style.css'), html = src('web/index.html'), appjs = src('web/app.js');
  const phoneN = (rd('plans/phone-test-5.43.html').match(/^\s*\["[^"\n]+",\s*"[^"\n]+",\s*\[/gm) || []).length;
  const idRe = /^[a-z0-9]+(?:\.[a-z0-9-]+)+$/;
  for (const f of FEATURES) {
    const tag = 'feature ' + f.id + ': ';
    if (!idRe.test(f.id)) fail.push(tag + 'bad id'); if (ids.has(f.id)) fail.push(tag + 'duplicate id'); ids.add(f.id);
    for (const k of ['name_ar', 'name_en', 'area', 'risk']) if (!f[k]) fail.push(tag + 'missing ' + k);
    if (!['high', 'med', 'low'].includes(f.risk)) fail.push(tag + 'risk must be high|med|low');
    if (typeof f.stable !== 'boolean') fail.push(tag + 'stable must be boolean');
    const a = f.anchors || {};
    for (const n of a.js || []) if (!hasJs(n)) fail.push(tag + 'js anchor not found: ' + n);
    for (const k of a.keys || []) { const re = KEYRE(k); if (!allJs.some(([, t]) => re.test(t))) fail.push(tag + 'key not found: ' + k); }
    for (const j of a.java || []) {
      const [cls, meth] = j.split('.'); const file = javaFiles.find(p => p.endsWith('/' + cls + '.java'));
      if (!file) { fail.push(tag + 'java class not found: ' + j); continue; }
      if (meth && !new RegExp('\\b' + meth + '\\s*\\(').test(src(file))) fail.push(tag + 'java method not found: ' + j);
    }
    for (const c of a.css || []) {
      if (c[0] === '#') { if (!new RegExp('id=["\']' + c.slice(1) + '["\']').test(html) && !new RegExp('["\']' + c.slice(1) + '["\']').test(appjs) && !new RegExp('id=\\\\?["\']' + c.slice(1)).test(appjs)) fail.push(tag + 'id not found: ' + c); }
      else if (!css.includes(c) && !new RegExp('class=\\\\?["\'][^"\']*\\b' + c.replace(/^\./, '') + '\\b').test(appjs)) fail.push(tag + 'css selector not found: ' + c);
    }
    for (const p of a.files || []) if (!fs.existsSync(path.join(ROOT, p))) fail.push(tag + 'file not found: ' + p);
    for (const g of f.ui_groups || []) if (!groups.includes(g)) fail.push(tag + 'ui group not in ui.js: ' + g);
    for (const p of f.phone || []) { const m = /^pt543-(\d+)$/.exec(p); if (!m || +m[1] < 1 || +m[1] > phoneN) fail.push(tag + 'phone id invalid: ' + p + ' (phone-test-5.43 has ' + phoneN + ')'); }
    if (!(f.routes || []).every(r => typeof r === 'string')) fail.push(tag + 'routes must be strings');
    for (const r of f.routes || []) { const base = r.replace(/\/?[:{(].*$/, '').replace(/\/$/, ''); if (base && base !== '#' && !appjs.includes(base.replace(/^#\//, '')) ) fail.push(tag + 'route not in app.js: ' + r); }
  }
  const fid = new Set(FEATURES.map(f => f.id)), iid = new Set(), perFeature = {};
  for (const it of ITEMS) {
    const tag = 'item ' + it.id + ': ';
    if (iid.has(it.id)) fail.push(tag + 'duplicate id'); iid.add(it.id);
    if (!fid.has(it.feature)) fail.push(tag + 'unknown feature ' + it.feature);
    perFeature[it.feature] = (perFeature[it.feature] || 0) + 1;
    if (!['P0', 'P1', 'P2'].includes(it.priority)) fail.push(tag + 'priority');
    if (!['auto', 'manual', 'both'].includes(it.how)) fail.push(tag + 'how');
    if (!['any', 'phone', 'emulator'].includes(it.device)) fail.push(tag + 'device');
    if (it.how !== 'manual' && it.ui_group && !groups.includes(it.ui_group)) fail.push(tag + 'ui_group not in ui.js: ' + it.ui_group);
    if (it.how !== 'manual' && !it.ui_group) fail.push(tag + 'how=' + it.how + ' needs ui_group');
    if (!it.title_ar || !(it.steps_ar || []).length || !it.expected_ar) fail.push(tag + 'missing title/steps/expected');
  }
  for (const f of FEATURES) if (!perFeature[f.id]) fail.push('feature ' + f.id + ': no QA item covers it');
  const mapped = new Set(); for (const f of FEATURES) for (const g of f.ui_groups || []) mapped.add(g);
  for (const g of groups) if (!mapped.has(g)) warn.push('ui.js group not mapped to any feature: ' + g);
  // 5.43: one Arabic key with two English values in web/i18n.js: the later one silently wins (the «إخفاء» Hide/Ikhfa' and
  // «تونس» Tunis/Tunisia bugs). Values that differ only in case / punctuation are the same; the rest need a look.
  const I18N = fs.readFileSync(path.join(ROOT, 'web', 'i18n.js'), 'utf8'), seen = {};
  const re = /"((?:[^"\\]|\\.)*?[؀-ۿ](?:[^"\\]|\\.)*?)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  for (let m; (m = re.exec(I18N));) (seen[m[1]] = seen[m[1]] || new Set()).add(m[2].toLowerCase().replace(/[^a-z0-9#@%]+/g, ' ').trim());
  const dup = Object.keys(seen).filter(k => seen[k].size > 1);
  dup.forEach(k => warn.push('i18n key with ' + seen[k].size + ' meanings: «' + k + '» -> ' + [...seen[k]].join(' | ')));
  console.log('registry: ' + FEATURES.length + ' features, ' + ITEMS.length + ' items, ' + groups.length + ' ui.js groups (' + mapped.size + ' mapped), phone-test items ' + phoneN);
  warn.forEach(w => console.log('WARN  ' + w)); fail.forEach(w => console.log('FAIL  ' + w));
  console.log(fail.length ? 'REGISTRY DRIFT: ' + fail.length + ' problem(s)' : 'REGISTRY OK');
  process.exit(fail.length ? 1 : 0);
}
if (flag('check-registry')) checkRegistry();

// ---------- impact ----------
const changes = collectChanges();
const touched = { js: new Map(), java: new Map(), css: new Set(), ids: new Set(), keys: new Set(), files: new Set(), groups: new Set(), unmapped: [], hunks: [], syntax: [], crlf: [] };
const add = (m, name, file) => { if (!m.has(name)) m.set(name, new Set()); m.get(name).add(file); };
let nAdd = 0, nDel = 0;
for (const [file, info] of Object.entries(changes)) {
  if (!CODE.test(file)) continue;
  touched.files.add(file);
  let text = ''; try { text = src(file); } catch (e) { continue; }   // deleted file
  if (/\r\n/.test(text) && !/\.xml$/.test(file)) touched.crlf.push(file);
  const lines = text.split('\n'), defs = /\.(js|java)$/.test(file) ? defsFor(file) : [];
  for (const h of info.hunks) {
    const a = h.start, b = Math.max(h.start, h.start + h.len - 1);
    for (const l of h.lines) l[0] === '+' ? nAdd++ : nDel++;
    if (info.untracked) nAdd += h.len;
    const body = h.lines.join('\n') || lines.slice(a - 1, b).join('\n');
    if (/\.(js|html)$/.test(file)) keysIn(body).forEach(k => touched.keys.add(k));
    if (/\.js$/.test(file) && file !== 'tools/qa/ui.js') {
      const names = new Set(chainAt(defs, a)); for (const d of defs) if (d.line >= a && d.line <= b) names.add(d.name);
      if (!names.size && !/i18n\.js$/.test(file)) touched.unmapped.push(file + ':' + a + ' (top level)');
      names.forEach(n => add(touched.js, n, file)); if (file.startsWith('web/')) touched.hunks.push({ file, line: a, chain: [...names] });
    } else if (/\.java$/.test(file)) {
      const cls = path.basename(file, '.java'), names = new Set(chainAt(defs, a)); for (const d of defs) if (d.line >= a && d.line <= b) names.add(d.name);
      add(touched.java, cls, file); names.forEach(n => add(touched.java, cls + '.' + n, file));
    } else if (/\.css$/.test(file)) {
      for (let i = a - 1; i < Math.min(lines.length, b); i++) {
        let j = i; while (j >= 0 && !/\{/.test(lines[j])) j--; const sel = j >= 0 ? lines[j].split('{')[0] : ''; if (sel.startsWith('@') || !sel.trim()) continue;
        for (const m of sel.matchAll(/[.#][A-Za-z_][\w-]*/g)) touched.css.add(m[0]);
        if (/^\s*:root/.test(sel)) touched.css.add(':root');
      }
    } else if (/\.html$/.test(file)) {
      for (const m of body.matchAll(/id="([^"]+)"/g)) touched.ids.add('#' + m[1]);
      for (const m of body.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach(c => touched.css.add('.' + c));
    } else if (file === 'tools/qa/ui.js') {
      const gs = uiGroups(); const gl = Object.entries(gs);
      let cur = null; for (let i = Math.min(b, lines.length) - 1; i >= 0 && !cur; i--) { const m = /\bcheck\((G[A-Za-z0-9_]*),/.exec(lines[i]) || /^\s*const (G[A-Za-z0-9_]*) = '/.exec(lines[i]); if (m) cur = m[1]; }
      if (cur && gs[cur]) touched.groups.add(gs[cur]);
    }
  }
  if (/\.js$/.test(file) && file.startsWith('web/')) { const r = cp.spawnSync(process.execPath, ['--check', path.join(ROOT, file)], { encoding: 'utf8' }); if (r.status) touched.syntax.push(file + ': ' + (r.stderr || '').split('\n').filter(Boolean).slice(0, 3).join(' | ')); }
}
// callers (one level) of changed JS functions
const indirect = new Map();   // feature id -> via function names
function callersOf(name) {
  const res = new Set(), re = new RegExp('(?<![\\w$.])' + name.replace(/\$/g, '\\$') + '\\s*\\(');
  for (const f of webJs) { const lines = src(f).split('\n'), defs = defsFor(f);
    lines.forEach((l, i) => { if (re.test(l) && !/function\s+/.test(l.split(name)[0].slice(-12))) chainAt(defs, i + 1).forEach(c => { if (c !== name) res.add(c); }); }); }
  return res;
}
const sharedHit = [];
function featuresFor(touchedNames, kind) {
  const hit = new Map();
  for (const f of FEATURES) { const a = f.anchors || {};
    const why = [];
    if (kind === 'js') for (const n of a.js || []) if (touchedNames.has(n)) why.push(n);
    if (kind === 'java') for (const j of a.java || []) if (touchedNames.has(j) || touchedNames.has(j.split('.')[0])) why.push(j);
    if (kind === 'css') for (const c of a.css || []) if ([...touchedNames].some(t => t === c || (t.startsWith('.') && c.includes(t) && /[\s,>+~:.[]|^$/.test(c.charAt(c.indexOf(t) + t.length) || ' ')))) why.push(c);
    if (kind === 'keys') for (const k of a.keys || []) if ([...touchedNames].some(t => t === k || t.startsWith(k + '.') || k.startsWith(t + '.'))) why.push(k);
    if (kind === 'files') for (const p of a.files || []) if ([...touchedNames].some(t => t === p || t.startsWith(p))) why.push(p);
    if (why.length) hit.set(f.id, why);
  }
  return hit;
}
const direct = new Map(), mark = (m, tag) => m.forEach((why, id) => { const e = direct.get(id) || []; why.forEach(w => e.push(tag + w)); direct.set(id, e); });
const jsNames = new Set(touched.js.keys());
mark(featuresFor(jsNames, 'js'), 'js:'); mark(featuresFor(new Set(touched.java.keys()), 'java'), 'java:');
mark(featuresFor(new Set([...touched.css, ...touched.ids]), 'css'), 'css:'); mark(featuresFor(touched.keys, 'keys'), 'key:');
mark(featuresFor(touched.files, 'files'), 'file:');
if (flag('deep') || true) for (const n of jsNames) { if (!/\.js$/.test([...touched.js.get(n)][0])) continue;
  const cs = callersOf(n); const fm = featuresFor(cs, 'js');
  if (SHARED.has(n) || cs.size >= 12) sharedHit.push(n + ' (' + cs.size + ' calling functions)');
  fm.forEach((why, id) => { if (!direct.has(id)) { const e = indirect.get(id) || new Set(); e.add(n); indirect.set(id, e); } }); }
// unmapped
for (const h of touched.hunks) { if (h.chain.length && !h.chain.some(n => FEATURES.some(f => ((f.anchors || {}).js || []).includes(n))) && !FEATURES.some(f => (f.anchors.files || []).includes(h.file))) touched.unmapped.push('js ' + h.file + ':' + h.line + ' ' + h.chain.slice(0, 3).join(' < ')); }
for (const k of touched.java.keys()) { const cls = k.split('.')[0]; if (!FEATURES.some(f => ((f.anchors || {}).java || []).some(j => j === k || j.split('.')[0] === cls))) touched.unmapped.push('java ' + k); }
for (const k of touched.keys) if (!FEATURES.some(f => ((f.anchors || {}).keys || []).includes(k))) touched.unmapped.push('key ' + k);
touched.unmapped = [...new Set(touched.unmapped)];

const byId = Object.fromEntries(FEATURES.map(f => [f.id, f]));
const ids = [...direct.keys()].sort((x, y) => ({ high: 0, med: 1, low: 2 }[byId[x].risk] - { high: 0, med: 1, low: 2 }[byId[y].risk]) || x.localeCompare(y));
const feats = new Set(ids); if (flag('deep')) indirect.forEach((v, id) => feats.add(id));
const groups = [...new Set([...feats].flatMap(id => byId[id].ui_groups || []).concat([...touched.groups]))];
const manual = ITEMS.filter(it => feats.has(it.feature) && it.how !== 'auto').sort((x, y) => x.priority.localeCompare(y.priority) || x.id.localeCompare(y.id));
const risky = ids.filter(id => byId[id].stable && byId[id].risk === 'high');

if (flag('json')) { console.log(JSON.stringify({ base: BASE, files: [...touched.files], features: ids, indirect: [...indirect.keys()], groups, manual: manual.map(m => m.id), unmapped: touched.unmapped, regression_risk: risky }, null, 1)); }
else {
  const L = s => console.log(s);
  L('== IMPACT vs ' + BASE + ': ' + touched.files.size + ' code file(s), +' + nAdd + ' / -' + nDel + ' lines ==');
  L('\n-- changed files --'); touched.files.forEach(f => L('  ' + f));
  L('\n-- changed functions / selectors / keys --');
  L('  js:   ' + ([...jsNames].join(', ') || '-'));
  L('  java: ' + ([...touched.java.keys()].join(', ') || '-'));
  L('  css:  ' + ([...touched.css, ...touched.ids].join(' ') || '-'));
  L('  keys: ' + ([...touched.keys].join(', ') || '-'));
  if (touched.groups.size) L('  ui.js groups edited: ' + [...touched.groups].join(' | '));
  L('\n-- affected features (' + ids.length + ' direct' + (indirect.size ? ', ' + indirect.size + ' via callers' + (flag('deep') ? '' : ', add --deep to include') : '') + ') --');
  for (const id of ids) { const f = byId[id]; L('  ' + (f.stable && f.risk === 'high' ? '!! ' : '   ') + id.padEnd(24) + ' risk=' + f.risk.padEnd(4) + ' stable=' + String(f.stable).padEnd(5) + ' ' + f.name_ar + '   <- ' + [...new Set(direct.get(id))].slice(0, 4).join(', ')); }
  if (flag('deep')) for (const [id, via] of indirect) L('   ~ ' + id.padEnd(22) + ' risk=' + byId[id].risk.padEnd(4) + ' via ' + [...via].slice(0, 4).join(', '));
  L('\n-- REGRESSION RISK (stable + high) --'); L(risky.length ? '  ' + risky.join(', ') : '  none');
  if (sharedHit.length) { L('\n-- shared helpers touched (check every caller) --'); sharedHit.forEach(s => L('  ' + s)); }
  L('\n-- ui.js groups to run (' + groups.length + ') --'); groups.forEach(g => L('  ' + g));
  L('  command: ONLY="' + groups.join('|') + '" ED=' + (opt('ed') || 'kfgqpc') + ' node tools/qa/ui.js');
  L('\n-- manual QA items to re-check (' + manual.length + '; phone: ' + manual.filter(m => m.device === 'phone').length + ') --');
  manual.slice(0, 60).forEach(m => L('  ' + m.id.padEnd(28) + m.priority + ' ' + m.device.padEnd(8) + m.title_ar)); if (manual.length > 60) L('  ... +' + (manual.length - 60) + ' more');
  L('\n-- unmapped changes (registry gap: add anchors to features.json) --'); L(touched.unmapped.length ? touched.unmapped.slice(0, 40).map(u => '  ' + u).join('\n') : '  none');
  if (touched.syntax.length) { L('\n!! SYNTAX (node --check failed)'); touched.syntax.forEach(s => L('  ' + s)); }
  if (touched.crlf.length) { L('\n!! CRLF line endings (repo is LF): ' + touched.crlf.join(', ')); }
  L('\nReminder: a new feature or check also needs an entry in features.json + qa-items.json (then node tools/qa/impact.js --check-registry).');
}
if (flag('run')) {
  if (!groups.length) { console.log('\n--run: no ui.js groups mapped; nothing to run'); process.exit(0); }
  const env = Object.assign({}, process.env, { ONLY: groups.join('|'), ED: opt('ed') || process.env.ED || 'kfgqpc' });
  console.log('\n--run: ED=' + env.ED + ' ONLY=' + groups.length + ' group(s) ...'); const t0 = Date.now();
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'ui.js')], { env, encoding: 'utf8', maxBuffer: 1 << 28, cwd: ROOT });
  const o = (r.stdout || '') + (r.stderr || ''), tot = (o.match(/^TOTAL.*$/m) || ['TOTAL ? (no total line; exit ' + r.status + ')'])[0];
  const fails = o.split('\n').filter(l => /\bFAIL\b/.test(l) && !/^TOTAL/.test(l));
  console.log(tot + ' | ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s'); fails.slice(0, 15).forEach(l => console.log('  ' + l.slice(0, 220)));
  process.exit(/FAIL 0\b/.test(tot) ? 0 : 1);
}
