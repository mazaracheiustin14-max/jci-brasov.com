from rembg import remove, new_session
from PIL import Image, ImageDraw, ImageFilter, ImageOps
import numpy as np
S=800
def make_bg():
    y,x=np.mgrid[0:S,0:S]
    d=np.sqrt(((x-S*0.5)/(S*0.55))**2+((y-S*0.42)/(S*0.6))**2)
    t=np.clip(1-d,0,1)**1.4
    edge=np.array([24,26,66]); glow=np.array([20,74,138])
    bg=Image.fromarray((edge*(1-t[...,None])+glow*t[...,None]).astype(np.uint8),'RGB')
    dr=ImageDraw.Draw(bg,'RGBA'); step=S//15
    for k in range(0,S,step):
        dr.line([(k,0),(k,S)],fill=(120,170,230,10)); dr.line([(0,k),(S,k)],fill=(120,170,230,10))
    return bg
BG=make_bg()
sess=new_session('u2net_human_seg')
src={'iustin-mazarache':('/home/claude/foto/v2/iustin-clean.jpg',None),
 'alexandra-vacaretiu':('/home/claude/site-assets/echipa/alexandra-vacaretiu.jpg',None),
 'daria-bica':('/home/claude/site-assets/echipa/daria-vica.jpg',(300,1040,1300,2048)),
 'mircea-voicu':('/home/claude/site-assets/echipa/mircea-voicu.jpg',(430,0,1230,900)),
 'julia':('/home/claude/site-assets/echipa/julia.jpg',None),
 'patricia':('/home/claude/site-assets/echipa/patricia.jpg',None),
 'andreea':('/home/claude/site-assets/echipa/andreea.jpg',None)}
ONLY=__import__('sys').argv[1:]
for n,(p,box) in src.items():
    if ONLY and n not in ONLY: continue
    im=ImageOps.exif_transpose(Image.open(p)).convert('RGB')
    if box: im=im.crop(box)
    im.thumbnail((1600,1600))
    if n=='iustin-OLD':
        im=im.filter(ImageFilter.UnsharpMask(radius=2,percent=60,threshold=3))
    fg=remove(im,session=sess,alpha_matting=True,alpha_matting_foreground_threshold=235,alpha_matting_background_threshold=15,alpha_matting_erode_size=8)
    if n=='iustin-OLD':
        arr=np.array(fg); h,w=arr.shape[:2]
        reg=arr[int(h*0.45):,int(w*0.60):]
        lum=reg[...,:3].mean(-1)
        kill=((reg[...,3]<200)&(lum>150))|((lum>205)&(np.arange(reg.shape[1])[None,:]>w*0.14))
        reg[...,3][kill]=0
        arr[int(h*0.45):,int(w*0.60):]=reg
        fg=Image.fromarray(arr,'RGBA')
        al=fg.split()[-1].filter(ImageFilter.MedianFilter(7)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2)); fg.putalpha(al)
    if n=='iustin-mazarache':
        import cv2
        al=np.array(fg.split()[-1]); m=(al>110).astype(np.uint8)*255
        k=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(41,41))
        m=cv2.morphologyEx(m,cv2.MORPH_OPEN,k); m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,k)
        # keep largest component
        nlab,lab,st,_=cv2.connectedComponentsWithStats(m); big=1+np.argmax(st[1:,4]); m=np.where(lab==big,255,0).astype(np.uint8)
        m=cv2.GaussianBlur(m,(0,0),2.2)
        # hair keeps fine matte; elsewhere use smoothed mask
        hh=int(m.shape[0]*0.30)
        out=m.copy(); out[:hh]=np.minimum(np.maximum(al[:hh],0),255); out[:hh]=np.where(m[:hh]>0,np.maximum(al[:hh],m[:hh]//2),0)
        fg.putalpha(Image.fromarray(out))
    a=np.array(fg.split()[-1])
    ys,xs=np.where(a>128); top=ys.min(); bot=ys.max()
    # head region: rows within 25% below top -> its horizontal centre
    hr=a[top:top+int((bot-top)*0.22)]>128
    cx=int(np.mean(np.where(hr)[1]))
    headw=np.where(hr.any(0))[0]; hw=headw.max()-headw.min()
    side=int(min(hw*(2.0 if n=='alexandra-vacaretiu' else 2.05 if n=='andreea' else 2.6),(bot-top)/0.92))   # head ~38% of frame width; person reaches the bottom edge
    if n=='iustin-mazarache':
        side=int(side*2.4/2.6); x0=cx-side//2-int(side*0.045); y0=top-int(side*0.07)
    else:
        x0=cx-side//2; y0=top-int(side*(0.08 if n in ('alexandra-vacaretiu','andreea') else 0.10))
    canvas=Image.new('RGBA',(side,side),(0,0,0,0)); canvas.paste(fg,(-x0,-y0))
    canvas=canvas.resize((S,S),Image.LANCZOS)
    if n=='iustin-OLD':
        c=np.array(canvas).astype(int); yy,xx=np.mgrid[0:S,0:S]
        lum=c[...,:3].mean(-1); sat=c[...,:3].max(-1)-c[...,:3].min(-1)
        zone=(xx>S*0.69)&(yy>S*0.70)
        c[...,3][zone&(lum>165)&(sat<45)]=0
        ramp=np.clip((S*0.705-xx)/(S*0.04),0,1); m=(yy>S*0.70)&(xx>S*0.665)
        c[...,3][m]=(c[...,3][m]*ramp[m]).astype(int)
        canvas=Image.fromarray(c.astype(np.uint8),'RGBA')
        al=canvas.split()[-1].filter(ImageFilter.MedianFilter(5)); canvas.putalpha(al)
    out=BG.copy().convert('RGBA'); out.alpha_composite(canvas)
    out.convert('RGB').save(f'/home/claude/site/assets/img/{n}.jpg',quality=88,optimize=True,progressive=True)
    print(n,'side',side)
names=list(src)
sheet=Image.new('RGB',(5*260,260),'white')
for i,n in enumerate(names): sheet.paste(Image.open(f'/home/claude/site/assets/img/{n}.jpg').resize((250,250)),(i*260,5))
sheet.save('/home/claude/preview/team2.jpg')
