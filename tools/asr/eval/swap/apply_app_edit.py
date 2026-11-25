# one-shot: patch web/app.js (rSim/rSame strict P8, rLocal sw marks, ctcJudge skip). Exact-string replace; aborts if anything is missing.
import re,sys
p='D:/Quran App/quran-karim/web/app.js'; s=open(p,encoding='utf8').read()
old_r=s[s.index('  function rSame(a, b) {'):s.index('  // Heard words (rSkel) against expected words (rSkel), aligned in one go')]
new_r='''  // Sprint 5b B: a one-letter swap between these letter pairs (ض/د ص/س ح/ه ق/ك ذ/ز ث/س ظ/ض ط/ت) in a word of 3+ letters is a
  // recitation mistake, not a model slip, so it is NOT the same word (plain rSame >= 0.6 let it through; bench
  // plans/sprint5b-B-swap-bench.md: 6% -> 99% of such swaps caught, 0 of 11,779 right words changed). rSim: 1 same, 0 not,
  // 2 = similar enough but only through a pair swap (rLocal marks those words so ctcJudge never rescues them).
  var R_PAIRS = {}; "ضد صس حه قك ذز ثس ظض طت".split(" ").forEach(function (p) { R_PAIRS[p] = R_PAIRS[p[1] + p[0]] = 1; });
  function rSim(a, b) {
    if (!a || !b) return 0; if (a === b) return 1;
    var m = a.length, n = b.length, d = [], f = [], i, j; for (j = 0; j <= n; j++) { d[j] = j; f[j] = false; }
    for (i = 1; i <= m; i++) {
      var pd = d[0], pf = f[0]; d[0] = i; f[0] = false;
      for (j = 1; j <= n; j++) {
        var td = d[j], tf = f[j], ne = a[i - 1] !== b[j - 1], best = pd + (ne ? 1 : 0), bf = pf || (ne && R_PAIRS[a[i - 1] + b[j - 1]] === 1), u = td + 1, l = d[j - 1] + 1;
        if (u < best) { best = u; bf = tf; } else if (u === best) bf = bf || tf;       // f: some best alignment has a pair swap
        if (l < best) { best = l; bf = f[j - 1]; } else if (l === best) bf = bf || f[j - 1];
        d[j] = best; f[j] = bf; pd = td; pf = tf;
      }
    }
    return 1 - d[n] / Math.max(m, n) < 0.6 ? 0 : f[n] ? 2 : 1;
  }
  function rSame(a, b) { return rSim(a, b) === 1; }
'''
s=s.replace(old_r,new_r,1)
a='''      if (b === "d") { v[i - 1] = 0; i--; } else if (b === "j") { v[i - 1] = 1; i--; j -= 2; } else { v[i - 1] = b === "m" ? 1 : 0; i--; j--; }
      a = i;'''
assert s.count(a)==1
s=s.replace(a,'''      if (b === "d") { v[i - 1] = 0; i--; } else if (b === "j") { v[i - 1] = 1; i--; j -= 2; } else {
        v[i - 1] = b === "m" ? 1 : 0; if (b === "s" && rSim(H[j - 1], E[i - 1]) === 2) sw[i - 1] = 1; i--; j--;      // red only because of a pair swap
      }
      a = i;''')
a='    var v = {}, a = bi; i = bi; j = bj;\n    // walk back from the end'
assert s.count(a)==1; s=s.replace(a,'    var v = {}, sw = {}, a = bi; i = bi; j = bj;\n    // walk back from the end')
a='    return { v: v, a: a, b: bi };'
assert s.count(a)==1; s=s.replace(a,'    return { v: v, a: a, b: bi, sw: sw };')
a='    for (i = r.a; i < r.b; i++) if (r.v[i] === 0) {\n      var x = res[own[i]];'
assert s.count(a)==1; s=s.replace(a,'    for (i = r.a; i < r.b; i++) if (r.v[i] === 0 && !(r.sw && r.sw[i])) {      // a pair-swap red (rSim 2) is a mistake: no rescue, no «unsure»\n      var x = res[own[i]];')
open(p,'w',encoding='utf8',newline='').write(s)
