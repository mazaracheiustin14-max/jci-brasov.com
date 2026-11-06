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

# --- accesibilitate (Lighthouse) ---
import glob as _g
for p in _g.glob(S+'*.html')+_g.glob(S+'en/*.html'):
    t=open(p,encoding='utf-8').read()
    # meniul mobil: text ascuns pentru cititoare de ecran în loc de aria-label pe <label>
    t=re.sub(r'<label class="burger" for="menu-toggle" aria-label="([^"]+)"><span></span></label>',
             r'<label class="burger" for="menu-toggle"><span></span><span class="sr-only">\1</span></label>',t)
    # butonul de limbă: numele accesibil include textul vizibil
    t=t.replace('aria-label="English version">EN<','aria-label="EN, English version">EN<')
    t=t.replace('aria-label="Versiunea în română">RO<','aria-label="RO, versiunea în română">RO<')
    # ordinea titlurilor
    t=t.replace('<h3>JCI Brașov Beyond the Initiative','<h2 class="as-h3t">JCI Brașov Beyond the Initiative',1)
    t=re.sub(r'(<h2 class="as-h3t">JCI Brașov Beyond the Initiative[^<]*(?:<br>[^<]*)*)</h3>',r'\1</h2>',t,count=1)
    t=t.replace('<h3>Proiecte 2027</h3>','<h2 class="as-h3">Proiecte 2027</h2>').replace('<h3>2027 Projects</h3>','<h2 class="as-h3">2027 Projects</h2>')
    for title in ('Programul serii','Invitați','Evening programme','Programme','Speakers'):
        t=re.sub(r'<h3( style="[^"]*")?>'+title+'</h3>',lambda m:'<h2 class="as-h3"'+(m.group(1) or '')+'>'+title+'</h2>',t)
    open(p,'w',encoding='utf-8').write(t)
css=S+'assets/css/style.css'; c=open(css,encoding='utf-8').read()
if '--blue-ink' not in c:
    open(css,'a',encoding='utf-8').write("""
/* contrast AA: nuanță mai închisă a albastrului JCI doar unde e text pe albastru sau text albastru */
:root{--blue-ink:#0073A6}
.btn-blue,.tag.blue,.blitz{background:var(--blue-ink)}
.btn-blue:hover{background:#00628D}
.teaser .go,.person.lead-role span{color:var(--blue-ink)}
.blitz p,.blitz ul{color:#fff}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
h2.as-h3{font-size:20px;font-weight:600;letter-spacing:0}
h2.as-h3t{font-size:19px;font-weight:600;letter-spacing:0;margin-top:16px}
""")
print('a11y ok')
import sys; sys.path.insert(0,'/home/claude/tools'); import countdown; countdown.run(); import theme; theme.run(); import signup; signup.run()
# versiune pe CSS ca browserele să nu folosească stilul vechi din memorie
import hashlib
v=hashlib.md5(open(S+'assets/css/style.css','rb').read()).hexdigest()[:8]
for p in _g.glob(S+'*.html')+_g.glob(S+'en/*.html'):
    t=open(p,encoding='utf-8').read()
    t=re.sub(r'(assets/css/style\.css)(\?v=[0-9a-f]+)?"',r'\1?v='+v+'"',t)
    t=t.replace('<span class="sr-only">','<span class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap">')
    open(p,'w',encoding='utf-8').write(t)
print('post ok')
