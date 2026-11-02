import torch,torch.nn as nn,torch.nn.functional as F,numpy as np,cv2,sys
class RDB(nn.Module):
    def __init__(s,nf=64,gc=32):
        super().__init__()
        s.conv1=nn.Conv2d(nf,gc,3,1,1);s.conv2=nn.Conv2d(nf+gc,gc,3,1,1);s.conv3=nn.Conv2d(nf+2*gc,gc,3,1,1)
        s.conv4=nn.Conv2d(nf+3*gc,gc,3,1,1);s.conv5=nn.Conv2d(nf+4*gc,nf,3,1,1);s.l=nn.LeakyReLU(0.2,True)
    def forward(s,x):
        x1=s.l(s.conv1(x));x2=s.l(s.conv2(torch.cat((x,x1),1)));x3=s.l(s.conv3(torch.cat((x,x1,x2),1)))
        x4=s.l(s.conv4(torch.cat((x,x1,x2,x3),1)));x5=s.conv5(torch.cat((x,x1,x2,x3,x4),1));return x5*0.2+x
class RRDB(nn.Module):
    def __init__(s,nf=64,gc=32):
        super().__init__();s.rdb1=RDB(nf,gc);s.rdb2=RDB(nf,gc);s.rdb3=RDB(nf,gc)
    def forward(s,x): return s.rdb3(s.rdb2(s.rdb1(x)))*0.2+x
class Net(nn.Module):
    def __init__(s,nf=64,nb=23,gc=32):
        super().__init__()
        s.conv_first=nn.Conv2d(3,nf,3,1,1);s.body=nn.Sequential(*[RRDB(nf,gc) for _ in range(nb)]);s.conv_body=nn.Conv2d(nf,nf,3,1,1)
        s.conv_up1=nn.Conv2d(nf,nf,3,1,1);s.conv_up2=nn.Conv2d(nf,nf,3,1,1);s.conv_hr=nn.Conv2d(nf,nf,3,1,1);s.conv_last=nn.Conv2d(nf,3,3,1,1);s.l=nn.LeakyReLU(0.2,True)
    def forward(s,x):
        f=s.conv_first(x);f=f+s.conv_body(s.body(f))
        f=s.l(s.conv_up1(F.interpolate(f,scale_factor=2,mode='nearest')));f=s.l(s.conv_up2(F.interpolate(f,scale_factor=2,mode='nearest')))
        return s.conv_last(s.l(s.conv_hr(f)))
m=Net();sd=torch.load('/tmp/realesr.pth',map_location='cpu');sd=sd.get('params_ema',sd);m.load_state_dict(sd,strict=True);m.eval()
torch.set_num_threads(max(1,__import__('os').cpu_count()))
img=cv2.imread(sys.argv[1]);sc=float(sys.argv[3])
img=cv2.resize(img,None,fx=sc,fy=sc,interpolation=cv2.INTER_AREA)
x=torch.from_numpy(img[...,::-1].copy()).permute(2,0,1).float()[None]/255
H,W=x.shape[2:];T=200;P=12;out=torch.zeros(1,3,H*4,W*4)
with torch.no_grad():
  for y in range(0,H,T):
    for xx in range(0,W,T):
      y0,x0=max(y-P,0),max(xx-P,0);y1,x1=min(y+T+P,H),min(xx+T+P,W)
      o=m(x[:,:,y0:y1,x0:x1])
      ty1,tx1=min(y+T,H),min(xx+T,W)
      out[:,:,y*4:ty1*4,xx*4:tx1*4]=o[:,:,(y-y0)*4:(y-y0+ty1-y)*4,(xx-x0)*4:(xx-x0+tx1-xx)*4]
      print('.',end='',flush=True)
r=(out[0].clamp(0,1).permute(1,2,0).numpy()[...,::-1]*255).round().astype(np.uint8)
cv2.imwrite(sys.argv[2],r,[cv2.IMWRITE_JPEG_QUALITY,95]);print(r.shape)
