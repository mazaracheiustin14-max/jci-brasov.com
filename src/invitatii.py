# Generează invitațiile nominale PNG cu QR (codul din inscrieri.token). Completează TOK cu nume și cod din D1, apoi: python3 invitatii.py
import asyncio, base64
from playwright.async_api import async_playwright
A='/home/claude/site/public/assets/'
b64=lambda p: base64.b64encode(open(A+p,'rb').read()).decode()
lat,ext,logo=b64('fonts/plus-jakarta-sans-latin-wght-normal.woff2'),b64('fonts/plus-jakarta-sans-latin-ext-wght-normal.woff2'),b64('img/logo-jci-brasov-invers.png')

def make(nume, token):
  import qrcode, qrcode.image.svg, io
  img=qrcode.make(f"https://jci-brasov.com/c/{token}", image_factory=qrcode.image.svg.SvgPathImage, border=1, error_correction=qrcode.constants.ERROR_CORRECT_M)
  bio=io.BytesIO(); img.save(bio); qsvg=base64.b64encode(bio.getvalue()).decode()
  return f'''<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><style>
@font-face{{font-family:P;src:url(data:font/woff2;base64,{lat});font-weight:200 800;unicode-range:U+0000-00FF,U+2000-206F,U+20AC}}
@font-face{{font-family:P;src:url(data:font/woff2;base64,{ext});font-weight:200 800;unicode-range:U+0100-02AF,U+0218-021B,U+1E00-1EFF}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1080px;height:1350px;font-family:P,sans-serif;color:#fff;background:#0B0920;overflow:hidden}}
.bg{{position:absolute;inset:0;background:
 radial-gradient(900px 700px at 92% 4%,rgba(0,151,215,.30),transparent 60%),
 radial-gradient(700px 600px at -5% 105%,rgba(87,188,188,.14),transparent 60%),#130F2D}}
.grid{{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:54px 54px}}
.ring{{position:absolute;border-radius:50%;border:2px solid rgba(0,151,215,.22)}}
.wrap{{position:absolute;inset:0;padding:84px 84px 72px;display:flex;flex-direction:column}}
.top{{display:flex;justify-content:space-between;align-items:center}}
.top img{{height:104px}}
.tag{{font-size:20px;font-weight:700;letter-spacing:5px;color:#EFC40F;border:2px solid rgba(239,196,15,.55);padding:12px 22px;border-radius:999px}}
.nm p:last-child{{font-size:46px!important;color:#1F4789;white-space:nowrap!important}}
.nm{{min-width:0;padding-bottom:22px;border-bottom:2px solid #DDE3EE}}
.k{{margin-top:56px;font-size:26px;font-weight:700;letter-spacing:7px;color:#57BCBC}}
h1{{margin-top:20px;font-size:124px;line-height:.95;font-weight:800;letter-spacing:-2px}}
.sub{{margin-top:28px;font-size:32px;line-height:1.4;color:#C9CDE0;width:860px}}
.sub b{{color:#fff;font-weight:700}}
.ticket{{margin-top:auto;margin-bottom:0;display:flex;background:#F5F7FB;color:#130F2D;border-radius:26px;position:relative;box-shadow:0 30px 80px rgba(0,0,0,.45)}}
.main{{flex:1;min-width:0;padding:36px 44px;display:flex;flex-direction:column;gap:24px}}
.row{{display:flex;gap:36px}}
.f p:first-child{{font-size:17px;font-weight:800;letter-spacing:3px;color:#0097D7}}
.f p:last-child{{font-size:34px;font-weight:800;margin-top:6px;white-space:nowrap}}
.prog{{display:flex;gap:12px;flex-wrap:wrap}}
.prog span{{font-size:19px;font-weight:700;color:#1F4789;background:#E3EAF5;padding:10px 16px;border-radius:10px}}
.stub{{flex:0 0 250px;border-left:3px dashed #B9C2D6;padding:40px 30px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:12px;background:#1F4789;color:#fff;border-radius:0 26px 26px 0}}
.stub .s1{{margin-top:6px;font-size:15px;font-weight:800;letter-spacing:3px;color:#EFC40F}}
.qrbox{{background:#fff;border-radius:14px;padding:10px}}
.qrbox img{{width:176px;height:176px;display:block}}
.stub .s2{{font-size:40px;font-weight:800;line-height:1.05}}
.stub .s3{{font-size:16px;color:#C9D6EE;line-height:1.35}}
.notch{{position:absolute;left:calc(100% - 250px);width:40px;height:40px;border-radius:50%;background:#130F2D;transform:translateX(-50%)}}
.foot{{margin-top:44px;display:flex;justify-content:space-between;font-size:24px;color:#A9AEC4}}
.foot b{{color:#fff;letter-spacing:4px;font-size:20px}}
</style></head><body>
<div class="bg"></div><div class="grid"></div>
<div class="ring" style="width:760px;height:760px;right:-300px;top:-260px"></div>
<div class="ring" style="width:520px;height:520px;right:-180px;top:-140px;border-color:rgba(87,188,188,.18)"></div>
<div class="wrap">
 <div class="top"><img src="data:image/png;base64,{logo}"><span class="tag">INVITAȚIE</span></div>
 <p class="k">EVENIMENTUL DE LANSARE JCI BRAȘOV</p>
 <h1>BEYOND<br>THE INITIATIVE</h1>
 <p class="sub">Seara în care JCI Brașov devine <b>organizație cu drepturi depline</b> în JCI România.</p>
 <div class="ticket">
  <div class="main">
   <div class="f nm"><p>{'INVITATĂ' if nume in FEM else 'INVITAT'}</p><p>{nume}</p></div>
   <div class="row">
    <div class="f"><p>DATA</p><p>Joi, 26 noiembrie</p></div>
    <div class="f"><p>ORA</p><p>17:00</p></div>
   </div>
   <div class="f"><p>LOCAȚIA</p><p>CATTIA Brașov</p></div>
   <div class="prog"><span>2 paneluri</span><span>2 sesiuni Blitz Networking</span><span>24+ contacte noi</span></div>
  </div>
  <div class="stub"><div class="qrbox"><img src="data:image/svg+xml;base64,{qsvg}"></div><p class="s1">SCANAȚI LA INTRARE</p><p class="s3">Cod personal, valabil o singură dată</p></div>
  <div class="notch" style="top:-20px"></div><div class="notch" style="bottom:-20px"></div>
 </div>
 <div class="foot"><span>jci-brasov.com</span><b>LEAD  CONNECT  GROW</b></div>
</div></body></html>'''
FEM={'Zaharia Andrea-Roxana'}
TOK={"Stan Marian":"87bde9f700e452214b3459ead50f50da","Stan Timotei":"1a67bf7b673d37a1e8f9151e9ae785a7","Alexandru Negrut":"f6e522f4962a5b142b4c276a0f59296a","Zaharia Andrea-Roxana":"1d072467ff0854edf98300f0607009d5","Cojocaru Cristian":"33b22687925b249f7a9471fc9eb92c51"}
NUME=list(TOK)
import unicodedata,re
def slug(n): return re.sub(r'[^A-Za-z0-9]+','_',unicodedata.normalize('NFKD',n).encode('ascii','ignore').decode()).strip('_')
async def m():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1080,'height':1350},device_scale_factor=2)
        for n in NUME:
            await pg.set_content(make(n, TOK[n])); await pg.wait_for_timeout(300)
            await pg.evaluate("(()=>{const e=document.querySelector('.nm p:last-child');let f=46;while(e.scrollWidth>e.parentElement.clientWidth&&f>28){f--;e.style.setProperty('font-size',f+'px','important')}})()")
            h=await pg.evaluate("document.querySelector('.foot').getBoundingClientRect().bottom")
            print(n,h)
            await pg.screenshot(path=f'/home/claude/inv/Invitatie_{slug(n)}.png')
        await b.close()
asyncio.run(m())
