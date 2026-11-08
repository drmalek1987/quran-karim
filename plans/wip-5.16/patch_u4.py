import io,sys
p='web/app.js'; s=io.open(p,encoding='utf-8').read()
def rep(a,b):
    global s
    if s.count(a)!=1: sys.exit('miss: '+a[:60])
    s=s.replace(a,b)
rep('''      hifz.items.forEach(function (k) { if (!hifz.shown[k] && (k + ":" + (rWords(k).length - 1)) in disp) { hifz.shown[k] = true; revealed.push(k); } });
    }
    hifz.paint(); hifzBar(); reciteCap();''','''      hifz.items.forEach(function (k) { if (!hifz.shown[k] && (k + ":" + (rWords(k).length - 1)) in disp) { hifz.shown[k] = true; revealed.push(k); } });
    }
    // 5.16 U4: the last word of a place heard right while the piece goes on: the place is done now (no wait for the
    // pause + final), the rest of this piece is skipped in the next place
    var T4 = hifz.test;
    if (!fin && r && T4 && T4.end && !T4.fin && T4.pc && T4.pc.length && disp[T4.end + ":" + (rWords(T4.end).length - 1)] === 1) {
      Object.keys(r.v).forEach(function (i) { disp[keys[i]] = r.v[i]; });
      fin = true; recite.disp = disp; reciteCommit(disp, r, keys); recite.skip = recite.heard; recite.cmt = true;
      hifz.items.forEach(function (k) { if (!hifz.shown[k] && (k + ":" + (rWords(k).length - 1)) in disp) { hifz.shown[k] = true; revealed.push(k); } });
    }
    hifz.paint(); hifzBar(); reciteCap();''')
rep('''hifzNextPlace(); else hifzTestDone(); } }, 900); }''','''hifzNextPlace(); else hifzTestDone(); } }, hifz.test.pc && hifz.test.pc.length ? 300 : 900); }''')
io.open(p,'w',encoding='utf-8',newline='\n').write(s); print('ok')
