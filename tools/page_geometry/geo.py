import cv2, numpy as np, sys
P='/mnt/project-files/quran-app/web/pages/%03d.jpg'
NW,NH=400,600
def binarize(g):
    return cv2.adaptiveThreshold(g,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,25,15)
def _lines(m, horizontal, minlen):
    # segments of a broken/bowed frame line are grouped by position and fitted together
    n,lab,st,_=cv2.connectedComponentsWithStats(m)
    segs=[]
    for i in range(1,n):
        x,y,w,h,a=st[i]
        ys,xs=np.nonzero(lab==i)
        pos = ys.mean() if horizontal else xs.mean()
        segs.append([pos, (w if horizontal else h), xs, ys])
    segs.sort(key=lambda t: t[0])
    groups=[]
    for sg in segs:
        if groups and abs(groups[-1][-1][0]-sg[0])<5: groups[-1].append(sg)
        else: groups.append([sg])
    out=[]
    for g in groups:
        L=sum(t[1] for t in g)
        if L<minlen: continue
        xs=np.concatenate([t[2] for t in g]); ys=np.concatenate([t[3] for t in g])
        if horizontal:
            k,c=np.polyfit(xs,ys,1); out.append((ys.mean(), ('h',k,c)))
        else:
            k,c=np.polyfit(ys,xs,1); out.append((xs.mean(), ('v',k,c)))
    return out
def frame_quad(b):
    H,W=b.shape
    h=cv2.morphologyEx(b,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_RECT,(W//10,1)))
    v=cv2.morphologyEx(b,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_RECT,(1,H//14)))
    hs=_lines(h,True,0.6*W); vs=_lines(v,False,0.45*H)
    top=[l for l in hs if l[0]<0.25*H]; bot=[l for l in hs if l[0]>0.75*H]
    lef=[l for l in vs if l[0]<0.25*W]; rig=[l for l in vs if l[0]>0.75*W]
    global MISSING
    MISSING=[nm for nm,l in (('top',top),('bot',bot),('left',lef),('right',rig)) if not l]
    if MISSING: return None
    # frame lines come in close pairs; take the inner line of the outermost pair
    def inner(ls, outer_is_min):
        ls=sorted(ls, key=lambda l: l[0], reverse=not outer_is_min)
        o=ls[0][0]; grp=[l for l in ls if abs(l[0]-o)<12]
        return grp[-1][1]
    T=inner(top,True); B=inner(bot,False); Lf=inner(lef,True); R=inner(rig,False)
    def inter(hl,vl):
        # y = kh x + ch ; x = kv y + cv
        _,kh,ch=hl; _,kv,cv=vl
        y=(kh*cv+ch)/(1-kh*kv); x=kv*y+cv
        return [x,y]
    return np.array([inter(T,Lf),inter(T,R),inter(B,R),inter(B,Lf)],np.float32)
def warp(n):
    img=cv2.imread(P%n); g=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY); b=binarize(g)
    q=frame_quad(b)
    if q is None: return img,None,None
    # shrink inward by a few px to skip the frame line itself
    dst=np.array([[0,0],[NW,0],[NW,NH],[0,NH]],np.float32)
    M=cv2.getPerspectiveTransform(q,dst)
    wb=cv2.warpPerspective(b,M,(NW,NH))
    return img,q,wb
if __name__=='__main__':
    for n in map(int,sys.argv[1:]):
        img,q,wb=warp(n)
        print(n, None if q is None else q.round(1).tolist())
        if wb is not None:
            prof=wb[:,10:-10].sum(1)/255
            cv2.imwrite('w%d.png'%n,255-wb)
