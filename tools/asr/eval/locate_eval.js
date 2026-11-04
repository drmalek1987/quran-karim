// Ayah id from one-shot recogniser text, as the index/search mics do it: quranLocate (whole-Quran word voting + rLocal)
// vs the old word-overlap voiceAyahs. Usage: node locate_eval.js <repo>/web rows-<tag>.json
const fs = require('fs'), web = process.argv[2], app = fs.readFileSync(web + '/app.js', 'utf8');
globalThis.window = {}; eval(fs.readFileSync(web + '/quran-data.js', 'utf8')); globalThis.Q = window.QURAN;
function grab(name) { const i = app.indexOf('function ' + name + '('); let d = 0, j = app.indexOf('{', i);
  for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && --d === 0) return app.slice(i, k + 1); } }
eval('var QF=null,index=null;' + ['norm', 'rSkel', 'rSame', 'rWords', 'quranFlat', 'rLocal', 'quranLocate', 'pageOf', 'buildIndex', 'voiceAyahs', 'voiceLocate'].map(grab).join('\n')
  + ';globalThis.F={voiceAyahs,voiceLocate}');
const rows = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), tot = {}, add = (set, k) => { tot[set] = tot[set] || { n: 0, loc: 0, locNull: 0, old: 0, comb: 0 }; tot[set][k]++; };
for (const r of rows) { if (!r.ayat) continue;
  const ay = r.ayat.map(x => x.join(':')), set = r.set;
  for (const s of [set, 'all']) add(s, 'n');
  const g = F.voiceLocate(r.hyp), o = F.voiceAyahs(r.hyp)[0], ok = (s, a) => ay.includes(s + ':' + a);
  const okL = g && ok(g.s, g.a), okO = o && ok(o[1], o[2]), okC = g ? okL : okO;
  for (const s of [set, 'all']) { if (okL) add(s, 'loc'); if (!g) add(s, 'locNull'); if (okO) add(s, 'old'); if (okC) add(s, 'comb'); }
}
for (const [s, t] of Object.entries(tot)) console.log(s, 'n', t.n, 'quranLocate', (100 * t.loc / t.n).toFixed(1), '(no answer', t.locNull + ')',
  'voiceAyahs', (100 * t.old / t.n).toFixed(1), 'combined(app)', (100 * t.comb / t.n).toFixed(1));
