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
R=[[[M(*b) for b in a] for a in s] for s in E['r']]
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
