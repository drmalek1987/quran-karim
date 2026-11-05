// The app's ctcUnits() and token forms (web/app.js) vs Python's (ctc_units_parity.py output).
// Usage: node ctc_units_parity.js <repo>/web/app.js <repo>/web/quran-data.js py.json
const fs = require('fs'), app = fs.readFileSync(process.argv[2], 'utf8');
function grab(name) { const i = app.indexOf('function ' + name + '('); let d = 0, j = app.indexOf('{', i);
  for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && --d === 0) return app.slice(i, k + 1); } }
const window = {}; eval(fs.readFileSync(process.argv[3], 'utf8')); const Q = window.QURAN;
var CTCU = {};
eval(grab('norm') + grab('rSkel') + grab('rWords') + grab('ctcUnits') + ';globalThis.F={norm,ctcUnits}');
const py = JSON.parse(fs.readFileSync(process.argv[4], 'utf8')); let same = 0, diff = 0, ex = [];
let none = 0;
for (const k of Object.keys(py.units)) {
  if (!py.units[k]) { none++; if (ex.length < 3) ex.push([k, JSON.stringify(F.ctcUnits(k))]); continue; }
  const got = JSON.stringify(F.ctcUnits(k)), want = JSON.stringify(py.units[k]);
  if (got === want) same++; else { diff++; if (ex.length < 400) ex.push([k, got, want]); }
}
let fs1 = 0, fd = 0;
py.vocab.forEach((t, i) => { if (F.norm(t.replace(/▁/g, ' ')).replace(/ /g, '') === py.forms[i]) fs1++; else fd++; });
console.log('ayat same', same, 'diff', diff, 'no python path', none, '| forms same', fs1, 'diff', fd);
if (ex.length) console.log(JSON.stringify(ex));
