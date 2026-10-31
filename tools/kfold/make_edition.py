import json,subprocess,sys
from PIL import Image,ImageDraw
E=json.loads(subprocess.check_output(['node','-e','global.window={};eval(require("fs").readFileSync("/mnt/project-files/quran-app/web/editions/kfgqpc.js","utf8"));process.stdout.write(JSON.stringify(window.ED_KFGQPC))']))
SP={1:((252,686,371,641),(352,690,398,640)),2:((353,762,402,633),(352,690,428,652))}
def M(p,x0,y0,x1,y1):
    if p in SP:
        (a,b,c,d),(A,B,C,D)=SP[p]
        fx=lambda x:A+(x-a)*(B-A)/(b-a); fy=lambda y:C+(y-c)*(D-C)/(d-c)
    else:
        a,b,A,B=(241,841,214,873) if p%2==0 else (161,759,129,788)
        fx=lambda x:A+(x-a)*(B-A)/(b-a); fy=lambda y:112+(y-156)*776/688
    return [p,round(fx(x0)),round(fy(y0)),round(fx(x1)),round(fy(y1))]
# Page 2 sits in a circle, so its lines differ in length: each line is mapped on its own (crop-measured, per mille).
P2=[(140,525,25,72),(75,560,82,128),(50,578,140,186),(60,575,196,244),(120,525,254,300),(190,450,308,355)]
P2=[(250+a/1.153,250+b/1.153,400+c/1.657,400+d/1.657) for a,b,c,d in P2]
L2=sorted({b[2] for s in E['r'] for a in s for b in a if b[0]==2})
X2={}
for s in E['r']:
    for a in s:
        for b in a:
            if b[0]==2: k=L2.index(b[2]); X2[k]=(min(X2.get(k,(9e9,0))[0],b[1]),max(X2.get(k,(0,0))[1],b[3]))
def M2(p,x0,y0,x1,y1):
    k=L2.index(y0); a,b=X2[k]; A,B,C,D=P2[k]
    f=lambda x:A+(x-a)*(B-A)/(b-a)
    return [p,round(f(x0)),round(C),round(f(x1)),round(D)]
R=[[[M2(*b) if b[0]==2 else M(*b) for b in a] for a in s] for s in E['r']]
if __name__=='__main__':
    for p in map(int,sys.argv[1:]):
        im=Image.open('/tmp/claude-0/kfold/raw/p-%03d.jpg'%(p-1)).convert('RGB');d=ImageDraw.Draw(im,'RGBA');w,h=im.size
        k=0
        for s in R:
            for a in s:
                for b in a:
                    if b[0]==p: k+=1;d.rectangle((b[1]*w/1000,b[2]*h/1000,b[3]*w/1000,b[4]*h/1000),fill=((k*70)%255,200,0,70))
        im.resize((w//2,h//2)).save('/tmp/claude-0/kfold/ov%d.png'%p)
    json.dump({'p':E['p'],'r':R,'first':1,'last':604,'count':605},open('/tmp/claude-0/kfold/ed.json','w'))

# Snap ayah ends to the medallions found on the scan (the King Fahd boxes give the line, the scan gives the exact x).
import sys as _s; _s.path.insert(0, '/mnt/project-files/quran-app/tools/kfold')
from markers import find
def snap(R):
    snapped = 0
    for p in range(1, 605):
        try: mk = find('/mnt/project-files/quran-app/web/editions/kfold/%03d.avif' % p, p)
        except Exception: continue
        H, Wd = 1139, 794
        mk = [(x * 1000 / Wd, (x + w) * 1000 / Wd, (y + h / 2) * 1000 / H) for x, y, w, h in mk]
        ends = [(s, a) for s in range(114) for a in range(len(R[s])) if R[s][a][-1][0] == p]
        lines = {}
        for s, a in ends:
            b = R[s][a][-1]; lines.setdefault(b[2], []).append((s, a))
        for y0, L in lines.items():
            y1 = R[L[0][0]][L[0][1]][-1][4]
            M = sorted([m for m in mk if y0 - 5 <= m[2] <= y1 + 5], key=lambda m: -m[0])
            L = sorted(L, key=lambda sa: -R[sa[0]][sa[1]][-1][1])
            if len(M) != len(L): continue
            for (s, a), m in zip(L, M):
                R[s][a][-1][1] = round(m[0])
                nx = (s, a + 1) if a + 1 < len(R[s]) else (s + 1, 0) if s + 1 < 114 else None
                if nx and R[nx[0]][nx[1]][0][0] == p and R[nx[0]][nx[1]][0][2] == y0: R[nx[0]][nx[1]][0][3] = round(m[0])
                snapped += 1
    # a piece left with no width (the medallion closed the line) is dropped, unless it is the ayah's only one
    for sur in R:
        for i, a in enumerate(sur):
            keep = [b for b in a if b[3] - b[1] >= 4]
            sur[i] = keep or [[a[0][0], min(a[0][1], a[0][3]), a[0][2], max(a[0][1], a[0][3]) + 4, a[0][4]]]
    return snapped
if __name__ == '__main__' and len(sys.argv) == 1:
    print('snapped', snap(R))
    json.dump({'p':E['p'],'r':R,'first':1,'last':604,'count':605},open('/tmp/claude-0/kfold/ed.json','w'))
