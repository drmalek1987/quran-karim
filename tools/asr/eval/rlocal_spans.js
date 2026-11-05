// The app's rLocal (web/app.js) run piece by piece, as reciteHear/htv do on finals: each piece placed from where the last
// one ended. Usage: node rlocal_spans.js <repo>/web/app.js jobs.json out.json
// jobs: [{H: [piece text, ...], E: [expected word, ...]}] -> [[{a, b, v} | null per piece], ...]
const fs = require('fs'), app = fs.readFileSync(process.argv[2], 'utf8');
function grab(name) { const i = app.indexOf('function ' + name + '('); let d = 0, j = app.indexOf('{', i);
  for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && --d === 0) return app.slice(i, k + 1); } }
eval(grab('norm') + grab('rSkel') + grab('rSame') + grab('rLocal') + ';globalThis.F={norm,rSkel,rLocal}');
const jobs = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const out = jobs.map(job => {
  const E = job.E.map(F.rSkel); let p0 = 0;
  return job.H.map(t => {
    const r = F.rLocal(F.norm(t).split(' ').filter(Boolean).map(F.rSkel), E, p0);
    if (!r) return null; p0 = r.b; return r;
  });
});
fs.writeFileSync(process.argv[4], JSON.stringify(out));
