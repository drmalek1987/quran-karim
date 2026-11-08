import io,sys
p='web/app.js'; s=io.open(p,encoding='utf-8').read()
a='''    var endA = rg ? gAy(rg.end) : null, last = endA && endA[0] === s ? endA[1] : cnt;'''
b='''    // 5.16e: a range left over from an earlier «المراجعة» test does not follow into «اختبار الحفظ» (opened from its tab,
    // home or the map): the test here is a plain one, «قلب تلقائي» works
    if (rg && !hzFrom) { rg = null; ["end", "n", "acc", "pc", "pn", "pt", "cont"].forEach(function (x) { delete st[x]; }); save("hifzTest", st); }
    var endA = rg ? gAy(rg.end) : null, last = endA && endA[0] === s ? endA[1] : cnt;'''
if s.count(a)!=1: sys.exit('miss')
io.open(p,'w',encoding='utf-8',newline='\n').write(s.replace(a,b)); print('ok')
