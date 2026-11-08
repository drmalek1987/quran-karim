import io,sys
p='web/app.js'; s=io.open(p,encoding='utf-8').read()
a='''      rd + " · " + (kh ? kh + " · " : "") + rv + "</small></span>"'''
b='''      [rd, kh, rv].filter(Boolean).map(function (x) { return "<span>" + x + "</span>"; }).join(" · ") + "</small></span>"'''
if s.count(a)!=1: sys.exit('miss')
io.open(p,'w',encoding='utf-8',newline='\n').write(s.replace(a,b)); print('ok')
