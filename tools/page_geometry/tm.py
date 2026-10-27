import sys; sys.path.insert(0, sys.argv[1])
import json, cv2, numpy as np, pipe
from multiprocessing import Pool
T=np.load('T.npy')
ring=(T<150).astype(np.uint8)
mask=cv2.dilate(ring,np.ones((5,5),np.uint8))*255
def page(n):
    img,M,wg=pipe.warp(n)
    r=cv2.matchTemplate(wg,T,cv2.TM_CCOEFF_NORMED,mask=mask)
    r=np.nan_to_num(r,nan=0,posinf=0,neginf=0)
    out=[]
    # greedy NMS
    rr=r.copy()
    while True:
        _,mx,_,(x,y)=cv2.minMaxLoc(rr)
        if mx<0.45: break
        out.append([int(x),int(y),60,44,round(float(mx),3)])
        rr[max(0,y-30):y+30, max(0,x-40):x+40]=0
    return n,out
if __name__=='__main__':
    with Pool(8) as p: res=dict(p.map(page, range(2,542)))
    json.dump(res,open('tm.json','w'))
    import collections
    h=collections.Counter(round(m[4],1) for v in res.values() for m in v)
    print(sorted(h.items()))
