import io,sys
p='web/app.js'; s=io.open(p,encoding='utf-8').read()
def rep(a,b):
    global s
    if s.count(a)!=1: sys.exit('miss: '+a[:60])
    s=s.replace(a,b)
rep('''      // 5.16 U9: memorised surahs only (q.hifzLog + ayat recited right); the review list has no say here
      ss.forEach(function (s) { if (L[s]) on++; });
      var c = !on ? 0 : on < ss.length ? 1 : 3, pa = PA[n];
      if (pa && pa.got) c = Math.max(c, pa.got < pa.n || pa.bad ? 1 : 3);''',
'''      ss.forEach(function (s) { var e = L[s], r = RV[s]; if (e) { on++; if (r && hzDueInfo(r, hzScoreOf(sc, s)).due) weak = true; } });
      var c = !on ? 0 : on < ss.length ? 1 : weak ? 2 : 3, pa = PA[n];
      if (pa && pa.got) c = Math.max(c, pa.got < pa.n ? 1 : pa.age > 14 || pa.bad ? 2 : 3);''')
rep('''      var e = L[s], c = !e ? 0 : 3, got = 0, tot = 0, age = 0, bad = false;''','''      var e = L[s], c = !e ? 0 : RV[s] && hzDueInfo(RV[s], hzScoreOf(sc, s)).due ? 2 : 3, got = 0, tot = 0, age = 0, bad = false;''')
rep('''      if (got) c = Math.max(c, got < tot || bad ? 1 : 3);''','''      if (got) c = Math.max(c, got < tot ? 1 : age > 14 || bad ? 2 : 3);''')
io.open(p,'w',encoding='utf-8',newline='\n').write(s); print('ok')
