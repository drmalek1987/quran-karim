// Dumps every Quran word the way the app's recite matcher sees it (web/app.js norm + rSkel + rWords), so bench.py
// compares exactly like the phone. Usage: node quran_words.js <repo>/web/quran-data.js out.json
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.argv[2], 'utf8'), window = {};
eval(src);
const app = fs.readFileSync(path.join(path.dirname(process.argv[2]), 'app.js'), 'utf8');
const nb = app.slice(app.indexOf('function norm(t)')); const nf = nb.slice(0, nb.indexOf('\n  }\n') + 4);
eval(nf);                                              // the app's own norm(), copied at run time
const Q = window.QURAN;
Q.t = Q.t.map(su => su.map(t => t.replace(/ٞ/g, 'ࣱ')));
const rSkel = w => norm(w).replace(/[اءؤئوي]/g, '');
const out = [];
Q.t.forEach((su, s) => su.forEach((t, a) => {
  const ws = t.split(' ').filter(w => norm(w).replace(/\s/g, ''));
  out.push({ s: s + 1, a: a + 1, w: ws.map(norm), k: ws.map(rSkel) });
}));
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log('ayat', out.length, 'words', out.reduce((n, x) => n + x.w.length, 0));
