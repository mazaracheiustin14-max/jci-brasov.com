# Poza Mădălinei Okur (26 nov 2026): decupaj rembg u2net_human_seg salvat în fg.png (vezi veronica.py), apoi cadru pătrat pe fundalul comun.
from PIL import Image, ImageDraw
import numpy as np
S=600
y,x=np.mgrid[0:S,0:S]
d=np.sqrt(((x-S*0.5)/(S*0.55))**2+((y-S*0.42)/(S*0.6))**2)
t=np.clip(1-d,0,1)**1.4
edge=np.array([24,26,66]); glow=np.array([20,74,138])
bg=(edge[None,None,:]*(1-t[...,None])+glow[None,None,:]*t[...,None]).astype(np.uint8)
bg=Image.fromarray(bg,'RGB'); dr=ImageDraw.Draw(bg,'RGBA')
for k in range(0,S,40):
    dr.line([(k,0),(k,S)],fill=(120,170,230,10)); dr.line([(0,k),(S,k)],fill=(120,170,230,10))
fg=Image.open('fg.png')
side=620; cx=548; top=330
crop=fg.crop((cx-side//2,top,cx-side//2+side,top+side)).resize((S,S),Image.LANCZOS)
out=bg.copy().convert('RGBA'); out.alpha_composite(crop)
out.convert('RGB').save('madalina-okur.jpg',quality=88,optimize=True,progressive=True)
R='/home/claude/jci-brasov.com/public/assets/img/'
sheet=Image.new('RGB',(4*260,260),'white')
for i,n in enumerate([R+'ioana-ceausu.jpg','madalina-okur.jpg',R+'rares-zlataru.jpg',R+'veronica-costache.jpg']):
    sheet.paste(Image.open(n).resize((250,250)),(i*260,5))
sheet.save('preview.jpg')
