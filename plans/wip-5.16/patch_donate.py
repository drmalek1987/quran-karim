import io,sys
p='tools/qa/donate.js'; s=io.open(p,encoding='utf-8').read()
a="""return w.length > 20 && w[0].dataset.a === '1' && w[0].dataset.w === '0' && w[4].dataset.a === '2' && w[4].dataset.w === '0'; }));"""
b="""// 5.15b: the first words of ayah 1 are open at the start, so ayah 2 is the reference
    const a2 = [...w].filter(x => x.dataset.a === '2'); return w.length > 20 && [...w].every(x => /^\d+$/.test(x.dataset.a) && /^\d+$/.test(x.dataset.w)) && a2.length > 3 && a2[0].dataset.w === '0' && a2[1].dataset.w === '1'; }));"""
if s.count(a)!=1: sys.exit('miss')
io.open(p,'w',encoding='utf-8',newline='\n').write(s.replace(a,b)); print('ok')
