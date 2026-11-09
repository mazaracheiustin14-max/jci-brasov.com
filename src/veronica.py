from rembg import remove, new_session
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
src=Image.open('/mnt/user-data/uploads/851c97e5-image.jpg').convert('RGB')
W,H=src.size; print(W,H)
sess=new_session('u2net_human_seg')
fg=remove(src,session=sess,alpha_matting=True,alpha_matting_foreground_threshold=240,alpha_matting_background_threshold=15,alpha_matting_erode_size=6)
# crop square: head to mid-torso, centered on face, with headroom like the others
top=int(H*0.14); side=int(W*0.68); left=int(W*0.535)-side//2
crop=fg.crop((left,top,left+side,top+side)).resize((S,S),Image.LANCZOS)
out=bg.copy().convert('RGBA'); out.alpha_composite(crop)
out.convert('RGB').save('veronica-costache.jpg',quality=88,optimize=True,progressive=True)
sheet=Image.new('RGB',(3*260,260),'white')
for i,n in enumerate(['/home/claude/jci-brasov.com/public/assets/img/florin-dragoslav.jpg','veronica-costache.jpg','/home/claude/jci-brasov.com/public/assets/img/ioana-ceausu.jpg']):
    sheet.paste(Image.open(n).resize((250,250)),(i*260,5))
sheet.save('preview.jpg')
