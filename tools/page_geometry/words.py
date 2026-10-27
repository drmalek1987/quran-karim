# Ayah spans and word boxes on the scanned pages.
import sys; sys.path.insert(0,'.')
import cv2, numpy as np, json, pipe
MG,NW,NH=pipe.MG,pipe.NW,pipe.NH
SLOT=80
q=json.load(open('/mnt/project-files/quran-app/data/quran-uthmani-quranenc.json'))
WORDS=[[v['text'].split(' ') for v in s['verses']] for s in q]
seq=json.load(open('seq.json'))
S2=json.load(open('scan2.json'))
_cache={}
def page(n):
    if n not in _cache:
        img,M,wg=pipe.warp(n)
        b=cv2.adaptiveThreshold(wg,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,41,12)
        _cache.clear(); _cache[n]=(img,M,wg,b)
    return _cache[n]
# slot grid offset per page, fitted to marker rows
marks_by_page={}
for e in seq:
    if e[0]=='M': marks_by_page.setdefault(e[1],[]).append(e[2])
def grid(n):
    ms=marks_by_page.get(n,[])
    base=MG+40
    if not ms: return base
    res=[((m[1]+m[3]/2)-base) % SLOT for m in ms]
    res=[r-SLOT if r>SLOT/2 else r for r in res]
    return base+float(np.median(res))
def slot_of(n,y):
    return int(round((y-grid(n))/SLOT))
def center(n,i): return grid(n)+i*SLOT
def gaps(b,cy,xr,xl):
    """zero-ink column runs in the core band of a line between xl..xr (xl<xr)"""
    y0,y1=int(cy-26),int(cy+20)
    strip=b[y0:y1, int(xl):int(xr)]
    col=strip.sum(0)
    ink=np.nonzero(col)[0]
    if len(ink)==0: return [],None
    a,z=ink[0],ink[-1]
    runs=[]; i=a
    while i<=z:
        if col[i]==0:
            j=i
            while j<=z and col[j]==0: j+=1
            runs.append((int(xl)+i,int(xl)+j))   # [start,end) in page coords
            i=j
        else: i+=1
    return runs,(int(xl)+a,int(xl)+z+1)

SLOTS={2:107,3:107}
def slotsize(n): return SLOTS.get(n,SLOT)
def grid(n):
    ms=marks_by_page.get(n,[]); sz=slotsize(n)
    base=MG+sz/2
    if not ms: return base
    res=[((m[1]+m[3]/2)-base) % sz for m in ms]
    res=[r-sz if r>sz/2 else r for r in res]
    return base+float(np.median(res))
def slot_of(n,y): return int(round((y-grid(n))/slotsize(n)))
def center(n,i): return grid(n)+i*slotsize(n)
def nslots(n): return int((NH)//slotsize(n))
L,R=MG+2,MG+NW-2

def ayah_list():
    out=[]; cur=None; a=0
    for e in seq:
        if e[0]=='S': cur=e; a=0
        else:
            a+=1; out.append(dict(s=cur[1],a=a,page=e[1],m=e[2],sstart=(cur[2],cur[3]) if a==1 else None))
    return out

def spans():
    ays=ayah_list(); res=[]
    prev=None
    for A in ays:
        s,a=A['s'],A['a']; n=A['page']; m=A['m']
        if a==1:
            sp,ey=A['sstart']
            if ey<0: slot=0
            else:
                slot=0
                while center(sp,slot) < ey+20: slot+=1
            if s not in (1,9): slot+=1
            while slot>=nslots(sp): slot-=nslots(sp); sp+=1   # header at the foot of the previous page
            start=(sp,slot,R)
        else:
            pn,pm=prev['page'],prev['m']
            ps=slot_of(pn,pm[1]+pm[3]/2)
            start=(pn,ps,pm[0]-2)
            if start[2]<L+45:      # previous ayah ended at line end
                start=(pn,ps+1,R)
            if start[1]>=nslots(pn): start=(pn+1,0,R)
        es=slot_of(n,m[1]+m[3]/2)
        segs=[]
        p,sl,xr=start
        while True:
            last=(p==n and sl==es)
            xl=(m[0]-1) if last else L      # the ayah number circle is part of the ayah
            segs.append([p,sl,xr,xl])
            if last: break
            sl+=1; xr=R
            if sl>=nslots(p): p+=1; sl=0
            if p>n: segs=None; break
        res.append(dict(s=s,a=a,segs=segs,m=[n]+list(m)))
        prev=A
    return res

def word_boxes(x, band=(26,20)):
    """Split the ayah's segments at the widest blank columns into as many words as the text has."""
    k=len(WORDS[x['s']-1][x['a']-1]); segs=x['segs']
    cand=[]; ext=[]
    for i,(p,sl,xr,xl) in enumerate(segs):
        img,M,wg,b=page(p); c=center(p,sl)
        y0,y1=int(c-band[0]),int(c+band[1])
        strip=b[y0:y1, int(xl):int(xr)]
        col=strip.sum(0)
        inkc=np.nonzero(col)[0]
        if len(inkc)==0: ext.append(None); continue
        a,z=inkc[0],inkc[-1]
        ext.append((int(xl)+a,int(xl)+z+1))
        j=a
        while j<=z:
            if col[j]==0:
                t=j
                while t<=z and col[t]==0: t+=1
                cand.append((t-j,i,int(xl)+j,int(xl)+t)); j=t
            else: j+=1
    m=sum(1 for e in ext if e)
    need=k-m
    cand.sort(key=lambda g:-g[0])
    if need<0 or need>len(cand): return None,0.0
    chosen=cand[:need]; rest=cand[need:]
    conf=(chosen[-1][0]/max(1,rest[0][0])) if chosen and rest else (9.0 if not rest else 0.0)
    if chosen and chosen[-1][0]<3: conf=0.0
    boxes=[]
    for i,(p,sl,xr,xl) in enumerate(segs):
        if not ext[i]: continue
        cuts=sorted([(g[2],g[3]) for g in chosen if g[1]==i], key=lambda g:-g[0])
        right=ext[i][1]
        for g0,g1 in cuts:
            boxes.append([p,sl,right,g1]); right=g0
        boxes.append([p,sl,right,ext[i][0]])
    return boxes,conf

import unicodedata
def units(w):
    return sum(1 for ch in w if unicodedata.category(ch)[0]=='L' and ch not in 'ـ') + 0.6
def seg_ink(p,sl,xr,xl,band=(26,20)):
    img,M,wg,b=page(p); c=center(p,sl)
    strip=b[int(c-band[0]):int(c+band[1]), int(xl):int(xr)]
    col=strip.sum(0); inkc=np.nonzero(col)[0]
    if len(inkc)==0: return None,[]
    a,z=inkc[0],inkc[-1]
    gaps=[]; j=a
    while j<=z:
        if col[j]==0:
            t=j
            while t<=z and col[t]==0: t+=1
            gaps.append((int(xl)+j,int(xl)+t)); j=t
        else: j+=1
    return (int(xl)+a,int(xl)+z+1),gaps
def word_boxes2(x):
    W=WORDS[x['s']-1][x['a']-1]; U=[units(w) for w in W]; k=len(W)
    segs=[]; 
    for (p,sl,xr,xl) in x['segs']:
        e,g=seg_ink(p,sl,xr,xl)
        if e: segs.append((p,sl,e,g))
    m=len(segs)
    if m==0 or k<m: return None
    D=[s[2][1]-s[2][0] for s in segs]
    f=sum(D)/sum(U)
    # contiguous split of words over segments, matching widths
    INF=1e18; cu=np.concatenate([[0],np.cumsum(U)])
    best=[[INF]*(k+1) for _ in range(m+1)]; arg=[[0]*(k+1) for _ in range(m+1)]
    best[0][0]=0
    for i in range(1,m+1):
        for j in range(i,k-(m-i)+1):
            for t in range(i-1,j):
                if best[i-1][t]>=INF: continue
                c=best[i-1][t]+((cu[j]-cu[t])*f-D[i-1])**2
                if c<best[i][j]: best[i][j]=c; arg[i][j]=t
    cuts=[k]; j=k
    for i in range(m,0,-1): j=arg[i][j]; cuts.append(j)
    cuts=cuts[::-1]
    boxes=[]; snapped=0; total=0
    for i,(p,sl,(a,z),gaps) in enumerate(segs):
        ws=list(range(cuts[i],cuts[i+1]))
        us=[U[w] for w in ws]; fi=(z-a)/sum(us)
        pos=z; bounds=[]
        for u in us[:-1]:
            pos-=u*fi; bounds.append(pos)
        # snap each boundary to a gap: near the prediction, wide gaps preferred, keep order
        chosen=[]; lastx=z
        avgw=(z-a)/len(us)
        for bp in bounds:
            best_g=None; bs=1e9
            for g in gaps:
                gc=(g[0]+g[1])/2
                if gc>=lastx-2: continue
                d=abs(gc-bp)
                if d>0.7*avgw: continue
                sc=d-2.0*(g[1]-g[0])
                if sc<bs: bs=sc; best_g=g
            total+=1
            if best_g: snapped+=1; chosen.append(best_g); lastx=(best_g[0]+best_g[1])/2
            else: chosen.append((int(bp),int(bp))); lastx=bp
        right=z
        for wi,g in zip(ws,chosen):
            boxes.append([wi,p,sl,right,g[1]]); right=g[0]
        boxes.append([ws[-1],p,sl,right,a])
    return boxes, (snapped/total if total else 1.0)

LW=json.load(open('letterw.json'))
def units(w):
    t=[ch for ch in unicodedata.normalize('NFC',w) if unicodedata.category(ch)[0]=='L' and ch!='ـ']
    return max(4.0, LW.get('_w',0)+sum(LW.get(ch,12.0) for ch in t))

def split_segment(a,z,gaps,us,lam=6.0):
    """Choose len(us)-1 gaps (right to left) so word widths best match the predicted widths us."""
    n=len(us)
    if n==1: return []
    fi=(z-a)/sum(us)
    pw=[u*fi for u in us]
    G=sorted(gaps,key=lambda g:-g[0])     # right to left
    C=len(G)
    if C<n-1: return None
    INF=1e18
    # dp[j][c]: best cost placing boundary j (0-based) at gap c
    dp=np.full((n-1,C),INF); bk=np.zeros((n-1,C),int)
    sig=max(8.0,0.35*np.mean(pw))
    def cost(width,j,gw): return ((width-pw[j])/sig)**2 - lam*min(gw,12)/12
    for c in range(C):
        g=G[c]; gc=(g[0]+g[1])/2
        dp[0][c]=cost(z-gc,0,g[1]-g[0])
    for j in range(1,n-1):
        for c in range(j,C):
            g=G[c]; gc=(g[0]+g[1])/2; gw=g[1]-g[0]
            best=INF;bi=0
            for d in range(j-1,c):
                if dp[j-1][d]>=INF: continue
                h=G[d]; hc=(h[0]+h[1])/2
                v=dp[j-1][d]+cost(hc-gc,j,gw)
                if v<best: best=v;bi=d
            dp[j][c]=best; bk[j][c]=bi
    # last word width term
    best=INF;bc=0
    for c in range(n-2,C):
        if dp[n-2][c]>=INF: continue
        g=G[c]; gc=(g[0]+g[1])/2
        v=dp[n-2][c]+((gc-a-pw[-1])/sig)**2
        if v<best: best=v;bc=c
    path=[bc]
    for j in range(n-2,0,-1): path.append(bk[j][path[-1]])
    path=path[::-1]
    return [G[c] for c in path]

def word_boxes3(x, lam=6.0):
    W=WORDS[x['s']-1][x['a']-1]; U=[units(w) for w in W]; k=len(W)
    segs=[]
    for (p,sl,xr,xl) in x['segs']:
        e,g=seg_ink(p,sl,xr,xl)
        if e: segs.append((p,sl,e,g))
    m=len(segs)
    if m==0 or k<m: return None
    D=[s[2][1]-s[2][0] for s in segs]
    f=sum(D)/sum(U)
    INF=1e18; cu=np.concatenate([[0],np.cumsum(U)])
    best=[[INF]*(k+1) for _ in range(m+1)]; arg=[[0]*(k+1) for _ in range(m+1)]
    best[0][0]=0
    for i in range(1,m+1):
        for j in range(i,k-(m-i)+1):
            for t in range(i-1,j):
                if best[i-1][t]>=INF: continue
                c=best[i-1][t]+((cu[j]-cu[t])*f-D[i-1])**2
                if c<best[i][j]: best[i][j]=c; arg[i][j]=t
    cuts=[k]; j=k
    for i in range(m,0,-1): j=arg[i][j]; cuts.append(j)
    cuts=cuts[::-1]
    boxes=[]
    for i,(p,sl,(a,z),gaps) in enumerate(segs):
        ws=list(range(cuts[i],cuts[i+1]))
        ch=split_segment(a,z,gaps,[U[w] for w in ws],lam)
        if ch is None: return None
        right=z
        for wi,g in zip(ws,ch):
            boxes.append([wi,p,sl,right,g[1]]); right=g[0]
        boxes.append([ws[-1],p,sl,right,a])
    return boxes,1.0
word_boxes2=word_boxes3

def seg_cands(p,sl,xr,xl,band=(26,20)):
    """Ink extent and boundary candidates (x, score) right-to-left for one line segment.
    Blank column runs score by width; thin ink valleys (touching words) score negative."""
    img,M,wg,b=page(p); c=center(p,sl)
    strip=b[int(c-band[0]):int(c+band[1]), int(xl):int(xr)]
    col=strip.sum(0)/255.0; inkc=np.nonzero(col)[0]
    if len(inkc)==0: return None,[]
    a,z=inkc[0],inkc[-1]
    cands=[]; j=a
    while j<=z:
        if col[j]==0:
            t=j
            while t<=z and col[t]==0: t+=1
            cands.append((int(xl)+(j+t)/2.0, float(t-j))); j=t
        else: j+=1
    for j in range(a+2,z-1):
        v=col[j]
        if 0<v<=3 and v<=col[j-1] and v<=col[j+1] and v<col[j-2] and v<col[j+2]:
            cands.append((int(xl)+j+0.5, -v*1.5))
    cands.sort(key=lambda t:-t[0])
    return (int(xl)+a,int(xl)+z+1),cands

def word_boxes4(x, lam=4.0):
    W=WORDS[x['s']-1][x['a']-1]; U=[units(w) for w in W]; k=len(W)
    segs=[]
    for (p,sl,xr,xl) in x['segs']:
        e,cd=seg_cands(p,sl,xr,xl)
        if e: segs.append((p,sl,e,cd))
    if not segs or k<len(segs): return None
    D=sum(s[2][1]-s[2][0] for s in segs); f=D/sum(U)
    # unified candidate list: ('g',seg,x,score) gaps and ('b',seg,x) line ends; line starts are implicit
    C=[]
    for si,(p,sl,(a,z),cd) in enumerate(segs):
        for xg,sc in cd: C.append((si,xg,sc,False))
        C.append((si,a,0.0,True))
    nC=len(C)
    segstart=[s[2][1] for s in segs]
    pw=[u*f for u in U]; sig=max(8.0,0.3*np.mean(pw))
    INF=1e18
    dp=np.full((k,nC),INF); bk=np.full((k,nC),-1)
    def start_x(d,c):
        # where word that ends at c begins, given previous word ended at candidate d (or -1 = ayah start)
        if d<0: return segstart[0]
        if C[d][3]: return segstart[C[d][0]+1]
        return C[d][1]
    def valid(d,c):
        # no line end strictly between d and c, and same segment (or d is the previous segment's end)
        sd = 0 if d<0 else (C[d][0]+1 if C[d][3] else C[d][0])
        return sd==C[c][0] and c>d
    for c in range(nC):
        if valid(-1,c):
            w=start_x(-1,c)-C[c][1]
            dp[0][c]=((w-pw[0])/sig)**2 - (0 if C[c][3] else lam*min(C[c][2],10)/10)
    for j in range(1,k):
        for c in range(nC):
            best=INF;bi=-1
            for d in range(c):
                if dp[j-1][d]>=INF or not valid(d,c): continue
                w=start_x(d,c)-C[c][1]
                if w<=2: continue
                v=dp[j-1][d]+((w-pw[j])/sig)**2 - (0 if C[c][3] else lam*min(C[c][2],10)/10)
                if v<best: best=v;bi=d
            dp[j][c]=best; bk[j][c]=bi
    last=nC-1
    if dp[k-1][last]>=INF: return None
    # every line end must be used: enforced because words cannot skip a line end
    path=[last]
    for j in range(k-1,0,-1): path.append(bk[j][path[-1]])
    path=path[::-1]
    boxes=[]; prev=-1
    for j,c in enumerate(path):
        si=C[c][0]; p,sl,(a,z),_=segs[si]
        xr=start_x(prev,c); xl=C[c][1]
        boxes.append([j,p,sl,xr,xl]); prev=c
    return boxes,1.0
word_boxes2=word_boxes4

# The two decorated opening pages have their own line layout (read off the page images).
CENTERS={2:[308,446,553,664,768,884,999], 3:[330,446,558,664,772,880,989]}
_grid,_slot_of,_center,_nslots=grid,slot_of,center,nslots
def slot_of(n,y):
    if n in CENTERS: return int(np.argmin([abs(c-y) for c in CENTERS[n]]))
    return _slot_of(n,y)
def center(n,i):
    return CENTERS[n][i] if n in CENTERS else _center(n,i)
def nslots(n): return len(CENTERS[n]) if n in CENTERS else _nslots(n)
def slotsize(n): return 108 if n in CENTERS else SLOT
