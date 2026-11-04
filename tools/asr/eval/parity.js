// Checks that the app's rAlign (web/app.js) gives the same verdicts as bench.py's recite_dp on a bench run's cached
// pieces. Usage: node parity.js <repo>/web/app.js rows-<tag>-dp1.0.json
const fs = require('fs'), app = fs.readFileSync(process.argv[2], 'utf8');
function grab(name) { const i = app.indexOf('function ' + name + '('); let d = 0, j = app.indexOf('{', i);
  for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && --d === 0) return app.slice(i, k + 1); } }
eval(grab('norm') + grab('rSkel') + grab('rSame') + grab('rAlign') + ';globalThis.F={norm,rSkel,rAlign}');
const rows = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')); let same = 0, diff = 0, ex = [];
for (const r of rows) {
  const H = r.piece_texts.flatMap(t => F.norm(t).split(' ').filter(Boolean).map(F.rSkel));
  const E = r.exp.split(' ').map(F.rSkel), neg = E.slice(); neg[r.neg_j] = r.neg_w;
  for (const [e, want] of [[E, r.pos], [neg, r.neg]]) {
    const got = F.rAlign(H, e).v;
    if (JSON.stringify(got) === JSON.stringify(want)) same++; else { diff++; if (ex.length < 3) ex.push([r.id, got, want]); }
  }
}
console.log('same', same, 'diff', diff, JSON.stringify(ex));
