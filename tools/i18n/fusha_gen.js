// Sprint 6 (A2): builds fusha_map.json from fusha_phrases.js. Run once on the pre-change sources:
//   node tools/i18n/fusha_gen.js        (then: py -3.11 tools/i18n/fusha_apply.py)
// It only READS the sources. The reviewable result is fusha_map.json (full old/new strings); fusha_apply.py applies it.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const PH = require('./fusha_phrases.js');

const AR = 'ء-يٰ';
const esc = s => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
const sorted = PH.slice().sort((a, b) => b[0].length - a[0].length);
const dict = new Map(sorted.map(p => [p[0], p[1]]));
const isAr = c => /[ء-يٰ]/.test(c);
// a phrase gets a word-boundary guard only on a side that is an Arabic letter (a phrase starting with «،» or «<» matches after a word)
const member = p => (isAr(p[0][0]) ? '(?<![' + AR + '])' : '') + esc(p[0]) + (isAr(p[0][p[0].length - 1]) ? '(?![' + AR + '])' : '');
const re = new RegExp(sorted.map(member).join('|'), 'g');
const used = new Map();
// whole-string overrides (the string is exactly this text)
const WHOLE = { 'لوح': 'لوْح', 'وقف': 'تم الإيقاف', 'لسه': 'لم يبدأ بعد' };
function conv(s) {
  if (WHOLE[s] !== undefined) { used.set('WHOLE:' + s, 1); return WHOLE[s]; }
  return s.replace(re, m => { used.set(m, (used.get(m) || 0) + 1); return dict.get(m); });
}
const hasAr = s => /[؀-ۿ]/.test(s);
const entries = [];
const push = e => entries.push(e);

// ---- web/app.js: every quoted/backtick literal with Arabic, as written in the source (delimiters included) ----
const SKIP_LINES = new Set([3281, 3282, 3283, 3284, 3285]); // Egyptian number words understood by the voice commands (input, not UI)
{
  const f = 'web/app.js', src = read(f).split('\n'), seen = new Map();
  src.forEach((l, i) => {
    if (SKIP_LINES.has(i + 1) || /^\s*\/\//.test(l)) return;
    const rx = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g; let m;
    while ((m = rx.exec(l))) {
      const body = m[1] ?? m[2] ?? m[3]; if (!hasAr(body)) continue;
      const nb = conv(body); if (nb === body) continue;
      const q = m[0][0], old = q + body + q, nw = q + nb + q;
      const e = seen.get(old) || { file: f, kind: 'literal', old, new: nw, lines: [] };
      e.lines.push(i + 1); seen.set(old, e);
    }
  });
  seen.forEach(e => push(e));
}
// ---- web/index.html: whole text lines that contain a hit ----
{
  const f = 'web/index.html', src = read(f).split('\n'), seen = new Map();
  src.forEach((l, i) => {
    if (!hasAr(l)) return;
    const t = l.trim(), nt = conv(t); if (nt === t) return;
    const e = seen.get(t) || { file: f, kind: 'text', old: t, new: nt, lines: [] }; e.lines.push(i + 1); seen.set(t, e);
  });
  seen.forEach(e => push(e));
}
// ---- web/i18n.js: Arabic keys only ----
{
  const f = 'web/i18n.js', src = read(f), lines = src.split('\n');
  // every dictionary object literal in the file: D, D38, D39, D49, D513, D517, D518, DS2, D527 (CITY has only city names)
  const dicts = []; const dr = /^  var (D[0-9A-Za-z]*) = \{/gm; let dm;
  while ((dm = dr.exec(src))) {
    let i = dm.index + dm[0].length - 1, depth = 0, q = null;
    for (; i < src.length; i++) { const c = src[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
      if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
      if (c === '"' || c === "'") q = c; else if (c === '{') depth++; else if (c === '}' && --depth === 0) break; }
    dicts.push([dm[1], eval('(' + src.slice(dm.index + dm[0].length - 1, i + 1) + ')')]);
  }
  const all = new Set(); dicts.forEach(([n, D]) => Object.keys(D).forEach(k => all.add(k)));
  console.error('i18n dictionaries:', dicts.map(d => d[0] + '=' + Object.keys(d[1]).length).join(' '));
  all.forEach(k => {
    const nk = conv(k); if (nk === k) return;
    const lit = JSON.stringify(k) + ':';
    const ln = lines.findIndex(l => l.includes(lit));
    if (ln < 0) { console.error('KEY NOT FOUND IN SOURCE (escaping?):', k); process.exitCode = 1; return; }
    if (all.has(nk)) {
      const en = k0 => dicts.map(d => d[1][k0]).filter(x => x !== undefined)[0];
      if (en(nk) !== en(k)) { console.error('SKIPPED (new key exists with a different English line; old key left as a dead key):', k, '->', nk); return; }
      console.error('NOTE: new key already exists with the same English line:', nk);
    }
    push({ file: f, kind: 'i18n-key', old: k, new: nk, lines: [ln + 1] });
  });
}
// ---- A1: the app name «لوْح» in the remaining places ----
const A1 = [
  ['android/res/values/strings.xml', '<string name="app_name">لوح</string>', '<string name="app_name">لوْح</string>'],
  ['web/manifest.webmanifest', '"name": "لوح - القرآن الكريم"', '"name": "لوْح - القرآن الكريم"'],
  ['web/manifest.webmanifest', '"short_name": "لوح"', '"short_name": "لوْح"'],
  ['web/index.html', '<title>لوح - القرآن الكريم</title>', '<title>لوْح - القرآن الكريم</title>'],
  ['web/index.html', '<h1 id="title">لوح</h1>', '<h1 id="title">لوْح</h1>'],
  ['web/index.html', '<b>لوح</b> · الإصدار', '<b>لوْح</b> · الإصدار'],
  ['docs/privacy-policy.html', '<title>سياسة الخصوصية - لوح</title>', '<title>سياسة الخصوصية - لوْح</title>'],
  ['docs/privacy-policy.html', '«لوح»', '«لوْح»'],
  ['store/privacy-policy.html', '<title>سياسة الخصوصية - لوح</title>', '<title>سياسة الخصوصية - لوْح</title>'],
  ['store/privacy-policy.html', '«لوح»', '«لوْح»'],
];
A1.forEach(([file, old, nw]) => push({ file, kind: 'name', old, new: nw, lines: [] }));

// ---- simulate the application per file (longest first) to get exact hit counts ----
const byFile = {};
entries.forEach(e => (byFile[e.file] = byFile[e.file] || []).push(e));
const out = [], dropped = [];
for (const f of Object.keys(byFile)) {
  let text = read(f);
  const list = byFile[f].sort((x, y) => y.old.length - x.old.length);
  for (const e of list) {
    if (e.kind === 'i18n-key') { const lit = JSON.stringify(e.old) + ':'; e.n = text.split(lit).length - 1; text = text.split(lit).join(JSON.stringify(e.new) + ':'); }
    else { e.n = text.split(e.old).length - 1; text = text.split(e.old).join(e.new); }
    if (e.n === 0) { dropped.push(e); continue; }
    out.push(e);
  }
}
const unused = PH.filter(p => !used.has(p[0]) && !(used.get(p[0]) > 0)).map(p => p[0]);
const WHERE = { 'web/app.js': 'app.js', 'web/index.html': 'index.html', 'web/i18n.js': 'i18n.js' };
const map = out.map(e => ({ old: e.old, new: e.new, where: e.file + (e.lines.length ? ':' + e.lines.slice(0, 6).join(',') : ''), file: e.file, kind: e.kind, n: e.n }));
fs.writeFileSync(path.join(__dirname, 'fusha_map.json'), JSON.stringify(map, null, 1));
const c = {}; map.forEach(m => c[m.file + ' ' + m.kind] = (c[m.file + ' ' + m.kind] || 0) + 1);
console.log('entries', map.length, c);
console.log('dropped (subsumed, 0 hits):', dropped.length);
console.log('UNUSED phrases (' + unused.length + '):\n' + unused.join('\n'));
