import json
from collections import Counter
S=json.load(open('scan2.json'))
TM=json.load(open('tm.json'))
ALT={541}
THR=float(__import__('os').environ.get('THR','0.65'))
q=json.load(open('/mnt/project-files/quran-app/data/quran-uthmani-quranenc.json'))
cnt=[s['total_verses'] for s in q]
starts=json.load(open('/mnt/project-files/quran-app/data/mushaf-pages.json'))['surahStart']
SC=2; MG=28; NH=1200; LINE=80
def borders(hl):
    hl=[h for h in hl if abs(h[0]-MG)>14 and abs(h[0]-(MG+NH))>14]
    out=[]
    for h in hl:
        if out and h[0]-out[-1][1]<=14: out[-1][1]=h[1]
        else: out.append(list(h))
    return out
def bands(hl):
    bs=borders(hl); out=[]; i=0
    while i<len(bs)-1:
        if 60<=bs[i+1][0]-bs[i][1]<=170: out.append((bs[i][0],bs[i+1][1])); i+=2
        else: i+=1
    return out
k_on=Counter(starts)
seq=[]   # ('S', surah) or ('M', page, marker)
problems=[]
s_next=1
for n in range(2,542):
    d=S[str(n)]; bs=bands(d['hl']); k=k_on[n]
    ev=[]
    ms=[m[:4] for m in TM[str(n)] if m[4]>=THR]
    if n==3: ms=[m for m in ms if m[1]>150]          # decorated page: skip the cartouche number
    if n in ALT:
        # header cartouches touch each other here, so find their number circles instead:
        # fixed x in the cartouche and alone on their row
        hc=[m for m in ms if 500<=m[0]<=570 and not any(o is not m and abs(o[1]-m[1])<30 for o in ms)]
        bs=[(m[1]-5,m[1]+m[3]+5) for m in hc]
    if n in (2,3):
        ev.append((-1,0,('S',-1))) ; bs=[]
    elif k==len(bs): ev+= [(b[0],0,('S',b[1])) for b in bs]
    elif k==len(bs)+1: ev.append((-1,0,('S',-1))); ev+=[(b[0],0,('S',b[1])) for b in bs]
    else:
        problems.append((n,k,len(bs),bs)); ev+=[(-1,0,('S',-1))]*k
    # markers of one text line share a baseline: cluster by y, then read right to left
    keep=sorted([m for m in ms if not any(b[0]<=m[1]+m[3]/2<=b[1] for b in bs)], key=lambda m:m[1])
    rows=[]
    for m in keep:
        if rows and m[1]-rows[-1][-1][1]<25: rows[-1].append(m)
        else: rows.append([m])
    for r in rows:
        ry=sum(m[1] for m in r)/len(r)
        for m in r: ev.append((ry, -(m[0]+m[2]/2), ('M',n,m,int(ry))))
    ev.sort(key=lambda t:(t[0],t[1]))
    for e in ev:
        if e[2][0]=='S': seq.append(('S',s_next,n,e[2][1])); s_next+=1
        else: seq.append(e[2])
print('header problems',problems)
# per-surah counts
cur=0; c=Counter()
for e in seq:
    if e[0]=='S': cur=e[1]
    else: c[cur]+=1
bad=[(s,c[s],cnt[s-1]) for s in range(1,115) if c[s]!=cnt[s-1]]
print('surahs',s_next-1,'total markers',sum(c.values()),'mismatched surahs',len(bad)); print(bad)
json.dump(seq,open('seq.json','w'))
