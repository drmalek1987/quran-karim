import io,sys
p='web/app.js'; s=io.open(p,encoding='utf-8').read()
def rep(a,b):
    global s
    if s.count(a)!=1: sys.exit('miss: '+a[:60])
    s=s.replace(a,b)
rep('''        var span = rs0.reduce(function (t, r) { return t + r[3] - r[1]; }, 0), acc = 0, mids = [], c0 = 0;
        wl.forEach(function (w) { mids.push((c0 + lw(w) / 2) / tot * span); c0 += lw(w); });''','''        var span = rs0.reduce(function (t, r) { return t + r[3] - r[1]; }, 0), acc = 0, mids = [], cs = [], c0 = 0;
        wl.forEach(function (w) { cs.push(c0); mids.push((c0 + lw(w) / 2) / tot * span); c0 += lw(w); });''')
rep('''          var bx = boxOf(b[0]); if (!bx) return;
          var d = document.createElement("div"); d.className = "hifz-mask"; d.dataset.k = k;
          d.style.cssText = "left:" + b[1] / 10 + "%;top:" + (b[2] + 5) / 10 + "%;width:" + (b[3] - b[1]) / 10 + "%;height:" + (b[4] - b[2] - 9) / 10 + "%";
          bx.appendChild(d);''','''          var bx = boxOf(b[0]); if (!bx) return;
          // 5.16 U3: a line opens word by word as it is recited (it used to wait for the whole line, 7–10 words late):
          // the words up to the furthest one heard show (wrong ones red), the mask covers the rest of the line only
          var rev = 0; if (recite.on) while (rev < mine.length && mine[rev] <= past) rev++;
          var right = b[3];
          if (rev) {
            mine.slice(0, rev).forEach(function (i) { if (V[k + ":" + i] === 0) wordBoxes(+sa[0], +sa[1], wl, i, boxOf, "rc-badw"); });
            var a0 = x0 / span * tot, a1 = x1 / span * tot, st = Math.min(a1, Math.max(a0, cs[mine[rev]]));
            right = b[3] - (st - a0) / (a1 - a0) * (b[3] - b[1]);
          }
          var d = document.createElement("div"); d.className = "hifz-mask"; d.dataset.k = k;
          d.style.cssText = "left:" + b[1] / 10 + "%;top:" + (b[2] + 5) / 10 + "%;width:" + (right - b[1]) / 10 + "%;height:" + (b[4] - b[2] - 9) / 10 + "%";
          bx.appendChild(d);''')
io.open(p,'w',encoding='utf-8',newline='\n').write(s); print('ok')
