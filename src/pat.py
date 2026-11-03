import numpy as np, sys
from PIL import Image, ImageFilter
exec(open('/home/claude/tools/team3.py').read().split("sess=new_session")[0])
fg=Image.open('/tmp/pat-u2net.png')
al=np.array(fg.split()[-1]); al=np.array(Image.fromarray(al).filter(ImageFilter.MedianFilter(5))); fg.putalpha(Image.fromarray(al))
ys,xs=np.where(al>128); top=ys.min()
hx=np.where((al[top:top+int((ys.max()-top)*0.3)]>128).any(0))[0]
cx=(hx.min()+hx.max())//2; side=int((hx.max()-hx.min())*float(sys.argv[1]))
x0=cx-side//2; y0=top-int(side*0.06)
c=Image.new('RGBA',(side,side),(0,0,0,0)); c.paste(fg,(-x0,-y0)); c=c.resize((S,S),Image.LANCZOS)
out=BG.copy().convert('RGBA'); out.alpha_composite(c); out.convert('RGB').save('/home/claude/site/assets/img/patricia.jpg',quality=88,optimize=True,progressive=True)
