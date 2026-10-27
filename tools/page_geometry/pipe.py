# Per page: warp the text frame (plus a margin) to a fixed size, find ayah-end markers and header bands.
import sys; sys.path.insert(0, sys.argv[1] if len(sys.argv)>1 else '.')
import cv2, json, numpy as np
Q=json.load(open('quads.json'))
P='/mnt/project-files/quran-app/web/pages/%03d.jpg'
SC=2; NW,NH=400*SC,600*SC; MG=14*SC
def warp(n):
    img=cv2.imread(P%n); g=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
    q=np.array(Q[str(n)],np.float32)
    dst=np.array([[MG,MG],[MG+NW,MG],[MG+NW,MG+NH],[MG,MG+NH]],np.float32)
    M=cv2.getPerspectiveTransform(q,dst)
    wg=cv2.warpPerspective(g,M,(NW+2*MG,NH+2*MG),flags=cv2.INTER_CUBIC,borderValue=255)
    return img,M,wg
def analyse(n):
    img,M,wg=warp(n)
    b=cv2.adaptiveThreshold(wg,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,41,12)
    cs,hier=cv2.findContours(b,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
    ms=[]
    if hier is not None:
        hier=hier[0]
        for i,c in enumerate(cs):
            if hier[i][3]!=-1: continue
            x,y,w,h=cv2.boundingRect(c)
            if not(40<=w<=60 and 30<=h<=44): continue
            ch=hier[i][2]; hole=0
            while ch!=-1: hole=max(hole,cv2.contourArea(cs[ch])); ch=hier[ch][0]
            if hole>0.25*w*h: ms.append([int(x),int(y),int(w),int(h)])
    hm=cv2.morphologyEx(b,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_RECT,(500,1)))
    rows=np.nonzero(hm[:, :].sum(1)>0)[0]
    hl=[]
    for y in rows:
        if hl and y-hl[-1][1]<=3: hl[-1][1]=int(y)
        else: hl.append([int(y),int(y)])
    return {'m':ms,'hl':hl,'M':M.tolist()}
if __name__=='__main__':
    out={}
    for n in range(2,542): out[n]=analyse(n)
    json.dump(out,open('scan2.json','w'))
    print('markers', sum(len(v['m']) for v in out.values()))
