# Writes each ayah's rectangles on the scanned pages, in per-mille of the page image.
import sys; sys.path.insert(0,'.')
import json, cv2, numpy as np, words, pipe
sp=words.spans()
Minv={}
def inv(n):
    if n not in Minv:
        img,M,wg=pipe.warp(n)
        Minv[n]=(np.linalg.inv(np.array(M)), img.shape[1], img.shape[0])
    return Minv[n]
out=[[] for _ in range(114)]
for x in sp:
    rects=[]
    for p,sl,xr,xl in x['segs']:
        c=words.center(p,sl); h=words.slotsize(p)/2-3
        Mi,W,H=inv(p)
        pts=np.array([[[xl,c-h],[xr,c-h],[xr,c+h],[xl,c+h]]],np.float64)
        o=cv2.perspectiveTransform(pts,Mi)[0]
        x0,y0=o.min(0); x1,y1=o.max(0)
        rects.append([p,int(round(x0/W*1000)),int(round(y0/H*1000)),int(round(x1/W*1000)),int(round(y1/H*1000))])
    out[x['s']-1].append(rects)
assert sum(len(s) for s in out)==6236
json.dump(out,open('/mnt/project-files/quran-app/data/ayah-rects.json','w'),separators=(',',':'))
print('ok', sum(len(r) for s in out for r in s))
