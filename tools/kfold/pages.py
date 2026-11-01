import glob,sys
from PIL import Image
fs=sorted(glob.glob('/tmp/claude-0/kfold/raw/p-*.jpg'))
for i,f in enumerate(fs):
    n=i+1; im=Image.open(f).convert('RGB'); im=im.resize((794,round(im.height*794/im.width)),Image.LANCZOS)
    im.save('/tmp/claude-0/kfold/out/%03d.avif'%n,quality=35)
print(len(fs))
