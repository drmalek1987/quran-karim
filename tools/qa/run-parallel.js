// Runs ui.js on the four editions at the same time (one Chromium each), then prints each edition's TOTAL line and the time.
// Usage: node tools/qa/run-parallel.js [outDir]   (EDS=kfgqpc,kfold to pick editions; ONLY= passes through to ui.js)
// Each run has its own browser and localStorage, so results match a sequential run. Do not build an APK or run the
// emulator meanwhile: the checks use fixed waits, and a loaded PC can make them fail.
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const out = path.resolve(process.argv[2] || path.join(require('os').tmpdir(), 'qk-qa-par'));
fs.mkdirSync(out, { recursive: true });
const eds = (process.env.EDS || 'kfgqpc,kfold,shamarly,harmain').split(',');
const t0 = Date.now();
const runs = eds.map(ed => new Promise(done => {
  const log = fs.createWriteStream(path.join(out, 'ui-' + ed + '.txt')), s = Date.now();
  const c = spawn(process.execPath, [path.join(__dirname, 'ui.js')], { env: Object.assign({}, process.env, { ED: ed }) });
  c.stdout.pipe(log); c.stderr.pipe(log);
  c.on('close', code => done({ ed, code, min: ((Date.now() - s) / 60000).toFixed(1) }));
}));
Promise.all(runs).then(rs => {
  for (const r of rs) {
    const txt = fs.readFileSync(path.join(out, 'ui-' + r.ed + '.txt'), 'utf8');
    const tot = (txt.match(/^TOTAL.*$/m) || ['TOTAL ? (no total line)'])[0];
    console.log(r.ed.padEnd(9), tot, '| exit', r.code, '|', r.min, 'min');
    txt.split('\n').filter(l => /\tFAIL\t/.test(l)).slice(0, 5).forEach(l => console.log('   ', l.slice(0, 200)));
  }
  console.log('wall', ((Date.now() - t0) / 60000).toFixed(1), 'min ->', out);
});
