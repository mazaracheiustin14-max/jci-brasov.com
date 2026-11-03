# Post-procesare după build.py și build_en.py: 404 cu linkuri absolute, noindex pe paginile tehnice
import re
S='/home/claude/site/'
def noindex(s):
    s=re.sub(r'<link rel="(canonical|alternate)"[^>]*>\n','',s)
    s=re.sub(r'<meta (property="og:[^"]+"|name="twitter:[^"]+")[^>]*>\n','',s)
    return s.replace('<meta name="viewport"','<meta name="robots" content="noindex">\n<meta name="viewport"',1)
p=S+'404.html'; s=open(p,encoding='utf-8').read()
s=re.sub(r'(href|src)="(?!https?:|/|#|mailto:|tel:)([^"]+)"',lambda m:f'{m.group(1)}="/{m.group(2)}"',s)
s=s.replace('href="/en/404.html"','href="/en/"')
open(p,'w',encoding='utf-8').write(noindex(s))
for p in (S+'multumim.html',S+'en/multumim.html'):
    t=noindex(open(p,encoding='utf-8').read())
    open(p,'w',encoding='utf-8').write(t)
# un singur h1 pe paginile care încep cu secțiunea (contact, eveniment)
for p in (S+'contact.html',S+'eveniment.html',S+'en/contact.html',S+'en/eveniment.html'):
    t=open(p,encoding='utf-8').read()
    if '<h1' not in t:
        i=t.index('<main>'); j=t.index('<h2>',i); k=t.index('</h2>',j)
        t=t[:j]+'<h1 class="as-h2">'+t[j+4:k]+'</h1>'+t[k+5:]
    # imagini sub ecranul inițial: încărcare amânată
    open(p,'w',encoding='utf-8').write(t)
for p in [S+f for f in ('index.html','despre.html','eveniment.html','proiecte.html','echipa.html','implica-te.html','contact.html','inscriere.html')]+[S+'en/'+f for f in ('index.html','despre.html','eveniment.html','proiecte.html','echipa.html','implica-te.html','contact.html','inscriere.html')]:
    t=open(p,encoding='utf-8').read()
    t=re.sub(r'<img (?![^>]*loading=)(?![^>]*logo-jci)',r'<img loading="lazy" decoding="async" ',t)
    open(p,'w',encoding='utf-8').write(t)
css=S+'assets/css/style.css'; c=open(css,encoding='utf-8').read()
if '.as-h2' not in c:
    open(css,'a',encoding='utf-8').write('\nh1.as-h2{font-size:clamp(28px,3.6vw,42px);font-weight:500;letter-spacing:-.01em}\n')
print('post ok')
