from rembg import remove, new_session
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
S=600
# unified background: deep navy with blue radial glow and faint grid, like the first speaker cards
y,x=np.mgrid[0:S,0:S]
d=np.sqrt(((x-S*0.5)/(S*0.55))**2+((y-S*0.42)/(S*0.6))**2)
t=np.clip(1-d,0,1)**1.4
edge=np.array([24,26,66]); glow=np.array([20,74,138])
bg=(edge[None,None,:]*(1-t[...,None])+glow[None,None,:]*t[...,None]).astype(np.uint8)
bg=Image.fromarray(bg,'RGB'); dr=ImageDraw.Draw(bg,'RGBA')
for k in range(0,S,40):
    dr.line([(k,0),(k,S)],fill=(120,170,230,10)); dr.line([(0,k),(S,k)],fill=(120,170,230,10))
sess=new_session('u2net_human_seg')
for n in ['ioana-ceausu','bogdan-costas','rares-zlataru','ciprian-vacaru']:
    src=Image.open(f'/home/claude/site/assets/img/{n}.jpg').convert('RGB')
    src.save(f'/home/claude/cutout/{n}-orig.jpg')
    fg=remove(src,session=sess,alpha_matting=True,alpha_matting_foreground_threshold=240,alpha_matting_background_threshold=15,alpha_matting_erode_size=6)
    out=bg.copy().convert('RGBA'); out.alpha_composite(fg)
    out.convert('RGB').save(f'/home/claude/site/assets/img/{n}.jpg',quality=88,optimize=True,progressive=True)
sheet=Image.new('RGB',(4*260,260),'white')
for i,n in enumerate(['ioana-ceausu','bogdan-costas','rares-zlataru','ciprian-vacaru']):
    sheet.paste(Image.open(f'/home/claude/site/assets/img/{n}.jpg').resize((250,250)),(i*260,5))
sheet.save('/home/claude/preview/spk-unified.jpg')
