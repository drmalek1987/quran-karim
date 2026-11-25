// Like ../rlocal_spans.js, plus a variant arg: base | P4 | P8 (strict rSame; same DP as strict.py).
// Usage: node rlocal_spans_swap.js <repo>/web/app.js jobs.json out.json base|P4|P8   (reads app.js, never edits it)
const fs = require('fs'), app = fs.readFileSync(process.argv[2], 'utf8'), variant = process.argv[5] || 'base';
function grab(name) { const i = app.indexOf('function ' + name + '('); let d = 0, j = app.indexOf('{', i);
  for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && --d === 0) return app.slice(i, k + 1); } }
const P4 = ['ضد', 'صس', 'حه', 'قك'], P8 = P4.concat(['ذز', 'ثس', 'ظض', 'طت']);
const CONF = {}; for (const p of variant === 'P4' ? P4 : variant === 'P8' ? P8 : []) { CONF[p[0] + p[1]] = 1; CONF[p[1] + p[0]] = 1; }
const strict = `function rSame(a, b) {
  if (!a || !b) return false; if (a === b) return true;
  var m = a.length, n = b.length, d = [], f = [], i, j; for (j = 0; j <= n; j++) { d[j] = j; f[j] = false; }
  for (i = 1; i <= m; i++) { var pd = d[0], pf = f[0]; d[0] = i; f[0] = false;
    for (j = 1; j <= n; j++) { var td = d[j], tf = f[j], ne = a[i - 1] !== b[j - 1];
      var best = pd + (ne ? 1 : 0), bf = pf || (ne && CONF[a[i - 1] + b[j - 1]] === 1);
      var u = td + 1; if (u < best) { best = u; bf = tf; } else if (u === best) bf = bf || tf;
      var l = d[j - 1] + 1; if (l < best) { best = l; bf = f[j - 1]; } else if (l === best) bf = bf || f[j - 1];
      d[j] = best; f[j] = bf; pd = td; pf = tf; } }
  if (1 - d[n] / Math.max(m, n) < 0.6) return false; return !f[n]; }`;
const loose = `function rSame(a, b) {
  if (!a || !b) return false; if (a === b) return true;
  var m = a.length, n = b.length, d = [], i, j; for (j = 0; j <= n; j++) d[j] = j;
  for (i = 1; i <= m; i++) { var p = d[0]; d[0] = i; for (j = 1; j <= n; j++) { var t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } }
  return 1 - d[n] / Math.max(m, n) >= 0.6; }`;
// variant 'app' = the real web/app.js code (rSim/R_PAIRS/rSame/rLocal incl. sw marks, whatever app.js now has); base = the old loose rule
const appLines = (app.match(/^\s*var R_PAIRS = .*$/m) || [''])[0];
const src = variant === 'app' ? appLines + ';' + grab('norm') + grab('rSkel') + grab('rSim') + grab('rSame') + grab('rLocal')
  : grab('norm') + grab('rSkel') + grab('rSame') + grab('rLocal') + ';' + (variant === 'base' ? loose : strict) + ';function rSim(a, b) { return rSame(a, b) ? 1 : 0; }';
eval(src + ';globalThis.F={norm,rSkel,rLocal,rSame}');
if (process.argv[6] === 'parity') {   // node ... app.js pairs.json out.json variant parity  -> rSame on each pair
  const P = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')); fs.writeFileSync(process.argv[4], JSON.stringify(P.map(p => F.rSame(p[0], p[1])))); process.exit(0); }
const jobs = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const out = jobs.map(job => {
  const E = job.E.map(F.rSkel); let p0 = 0;
  return job.H.map(t => {
    const r = F.rLocal(F.norm(t).split(' ').filter(Boolean).map(F.rSkel), E, p0);
    if (!r) return null; p0 = r.b; return r;
  });
});
fs.writeFileSync(process.argv[4], JSON.stringify(out));
