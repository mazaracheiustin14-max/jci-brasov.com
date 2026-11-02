import cv2, numpy as np
from PIL import Image, ImageFilter
from rembg import remove, new_session
import importlib.util,sys
src='/mnt/user-data/uploads/21f75c08-image.jpg'
im=cv2.imread(src)
# reduce print glitter: NL-means + light bilateral
d=cv2.fastNlMeansDenoisingColored(im,None,7,9,7,21)
d=cv2.bilateralFilter(d,7,30,7)
# white balance (gray world on the shirt/background brights)
f=d.astype(np.float32)
br=f[f.mean(2)>170]; g=br.mean(0); f*= (g.mean()/g)[None,None,:]
# gentle contrast / vibrance
lab=cv2.cvtColor(np.clip(f,0,255).astype(np.uint8),cv2.COLOR_BGR2LAB)
l,a,b=cv2.split(lab); l=cv2.createCLAHE(clipLimit=1.6,tileGridSize=(8,8)).apply(l)
lab=cv2.merge([l,a,b]); out=cv2.cvtColor(lab,cv2.COLOR_LAB2BGR)
out=cv2.addWeighted(out,1.35,cv2.GaussianBlur(out,(0,0),2.2),-0.35,0)
cv2.imwrite('/home/claude/foto/v2/iustin-clean.jpg',out,[cv2.IMWRITE_JPEG_QUALITY,95])
