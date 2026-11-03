# Copiază /home/claude/site în public/ cu linkuri interne fără .html (evită redirecționările 307 ale Cloudflare)
import re, shutil, os
SRC='/home/claude/site'; DST='/home/claude/jci-brasov.com/public'
PAGES='index|despre|eveniment|proiecte|echipa|implica-te|inscriere|contact|multumim|404'
def clean(t):
    def rep(m):
        pre,name,anchor=m.group(1),m.group(2),m.group(3) or ''
        if name=='index': path=pre if pre else './'
        else: path=pre+name
        return f'href="{path}{anchor}"'
    return re.sub(r'href="((?:\.\./|/en/|/|en/)?)('+PAGES+r')\.html(#[^"]*)?"',rep,t)
for root,dirs,files in os.walk(SRC):
    rel=os.path.relpath(root,SRC); out=os.path.join(DST,rel) if rel!='.' else DST
    os.makedirs(out,exist_ok=True)
    for f in files:
        s=os.path.join(root,f); d=os.path.join(out,f)
        if f.endswith('.html'):
            open(d,'w',encoding='utf-8').write(clean(open(s,encoding='utf-8').read()))
        else: shutil.copy2(s,d)
print('deployed to public/')
