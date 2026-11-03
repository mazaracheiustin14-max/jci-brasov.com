from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np, glob, os
B='/home/claude/brand'
shield=Image.open(glob.glob(B+'/3_*/**/Scutul/White Primary - 2026.png',recursive=True)[0]).convert('RGBA')
logo=Image.open(glob.glob(B+'/1__*/**/3. PNG-uri*/2. JCI Bra*/3. Logo JCI Bra*Alb Principal.png',recursive=True)[0]).convert('RGBA')
shield=shield.crop(shield.getbbox()); logo=logo.crop(logo.getbbox())
OUT='/home/claude/site/assets/img'; os.makedirs(OUT,exist_ok=True)
NAVY=(19,15,45)
def icon(sz,rounded=True,pad=0.17):
    im=Image.new('RGBA',(sz,sz),(0,0,0,0)); d=ImageDraw.Draw(im)
    if rounded: d.rounded_rectangle([0,0,sz-1,sz-1],radius=int(sz*0.22),fill=NAVY+(255,))
    else: d.rectangle([0,0,sz,sz],fill=NAVY+(255,))
    s=shield.copy(); s.thumbnail((int(sz*(1-2*pad)),)*2,Image.LANCZOS)
    im.alpha_composite(s,((sz-s.width)//2,(sz-s.height)//2)); return im
icon(32,pad=0.1).save(OUT+'/favicon-32.png'); icon(96,pad=0.12).save(OUT+'/favicon.png')
icon(180,rounded=False).convert('RGB').save(OUT+'/apple-touch-icon.png')
icon(192).save(OUT+'/icon-192.png'); icon(512).save(OUT+'/icon-512.png')
icon(48,pad=0.1).save('/home/claude/site/favicon.ico',sizes=[(16,16),(32,32),(48,48)])
# Open Graph 1200x630
def og(lines,fn):
    W,H=1200,630; y,x=np.mgrid[0:H,0:W]
    d=np.sqrt(((x-W*0.72)/(W*0.6))**2+((y-H*0.5)/(H*0.9))**2); t=np.clip(1-d,0,1)**1.3
    e=np.array([19,15,45]); g=np.array([20,74,138])
    im=Image.fromarray((e*(1-t[...,None])+g*t[...,None]).astype(np.uint8)).convert('RGBA')
    ov=Image.new('RGBA',(W,H),(0,0,0,0)); do=ImageDraw.Draw(ov)
    for k in range(0,W,60): do.line([(k,0),(k,H)],fill=(120,170,230,14))
    for k in range(0,H,60): do.line([(0,k),(W,k)],fill=(120,170,230,14))
    im.alpha_composite(ov); dr=ImageDraw.Draw(im)
    # rings right
    cx,cy=930,315
    for r,w,c in [(250,14,(87,188,188,150)),(215,18,(0,151,215,230)),(175,10,(31,71,137,255))]:
        dr.ellipse([cx-r,cy-r,cx+r,cy+r],outline=c,width=w)
    s=shield.copy(); s.thumbnail((230,230),Image.LANCZOS); im.alpha_composite(s,(cx-s.width//2,cy-s.height//2))
    L=logo.copy(); L.thumbnail((420,200),Image.LANCZOS); im.alpha_composite(L,(80,90))
    fb=[os.path.expanduser('~/.fonts/PlusJakartaSans-700.ttf')] or glob.glob('/usr/share/fonts/**/DejaVuSans-Bold.ttf',recursive=True)
    fr=[os.path.expanduser('~/.fonts/PlusJakartaSans-400.ttf')] or glob.glob('/usr/share/fonts/**/DejaVuSans.ttf',recursive=True)
    f1=ImageFont.truetype(fb[0],50); f2=ImageFont.truetype(fr[0],28); f3=ImageFont.truetype(fb[0],24)
    yy=330
    for ln in lines[0]: dr.text((80,yy),ln,font=f1,fill=(255,255,255)); yy+=62
    dr.text((80,yy+14),lines[1],font=f2,fill=(200,215,235))
    dr.text((80,560),'jci-brasov.com',font=f3,fill=(87,188,188))
    im.convert('RGB').save(fn,quality=90)
og((['Tineri lideri care','schimbă Brașovul'],'Junior Chamber International Brașov'),OUT+'/og-jci-brasov.jpg')
og((['Young leaders','shaping Brașov'],'Junior Chamber International Brașov'),OUT+'/og-jci-brasov-en.jpg')
print('ok')
