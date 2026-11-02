import re, os
SRC='/home/claude/tools/source-onepage.html'; OUT='/home/claude/site'
s=open(SRC,encoding='utf-8').read()
css=re.search(r'<style>(.*?)</style>',s,re.S).group(1)
css+='''
/* multi-pagină */
.nav ul a[aria-current="page"]{opacity:1;color:var(--teal)}
.mobile-menu a[aria-current="page"]{color:var(--teal)}
.teasers{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:44px}
@media (max-width:900px){.teasers{grid-template-columns:1fr}}
.teaser{display:flex;flex-direction:column;gap:10px;padding:28px;border-radius:20px;background:#fff;border:1px solid var(--line);text-decoration:none;color:var(--ink);transition:border-color .15s ease,transform .15s ease}
.teaser:hover{border-color:var(--blue);transform:translateY(-2px)}
.teaser small{font-weight:700;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--navy)}
.teaser h3{font-size:22px}
.teaser p{color:var(--muted);font-size:15px}
.teaser .go{margin-top:auto;font-weight:600;color:var(--blue)}
.page-intro{background:var(--ink);color:#fff;padding:64px 0 56px;position:relative;overflow:hidden}
.page-intro svg{position:absolute;right:-160px;top:-160px;width:460px;height:460px;opacity:.55}
.page-intro .crumb{font-size:14px;color:#A9ABC8}
.page-intro .crumb a{color:#A9ABC8}
.page-intro h1{font-size:clamp(34px,5vw,56px);font-weight:600;letter-spacing:-.02em;margin-top:12px;position:relative}
.page-intro p{color:#D5D7EA;margin-top:14px;max-width:60ch;font-size:19px;font-weight:300;position:relative}
.person img{object-fit:cover;height:auto}
.nav-actions{display:flex;align-items:center;gap:14px}
.lang{color:#fff;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:.06em;border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:8px 12px}
.lang:hover{border-color:var(--teal);color:var(--teal)}
@media (max-width:980px){.nav-actions .btn{display:none}.nav-actions{margin-left:auto;margin-right:8px}}
/* înscriere */
.fees{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:28px;max-width:720px}
@media (max-width:620px){.fees{grid-template-columns:1fr}}
.fee{background:#fff;border:1px solid var(--line);border-radius:18px;padding:22px 24px}
.fee small{font-weight:700;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--navy)}
.fee .amt{font-size:34px;font-weight:700;margin-top:4px;font-variant-numeric:tabular-nums}
.fee .amt span{font-size:16px;font-weight:600;color:var(--muted)}
.fee p{font-size:14px;color:var(--muted);margin-top:4px}
.form-wrap{display:grid;grid-template-columns:1.1fr .9fr;gap:56px;align-items:start}
@media (max-width:900px){.form-wrap{grid-template-columns:1fr;gap:36px}}
form.signup{background:#fff;border:1px solid var(--line);border-radius:20px;padding:30px;display:grid;gap:18px}
.field{display:grid;gap:6px}
.field label{font-weight:600;font-size:15px}
.field input,.field select,.field textarea{font:400 16px/1.4 var(--font);color:var(--ink);padding:13px 14px;border:1px solid #C6D2DE;border-radius:12px;background:#fff;width:100%}
.field input:focus,.field select:focus,.field textarea:focus{outline:3px solid rgba(0,151,215,.25);border-color:var(--blue)}
.field textarea{min-height:110px;resize:vertical}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media (max-width:560px){.row2{grid-template-columns:1fr}}
.check{display:grid;grid-template-columns:22px 1fr;gap:10px;font-size:14px;color:var(--muted);align-items:start}
.check input{width:20px;height:20px;margin:2px 0 0;accent-color:var(--blue)}
.form-note{font-size:14px;color:var(--muted)}
.form-msg{display:none;border-radius:12px;padding:14px 16px;font-size:15px}
.form-msg.show{display:block}
.form-msg.ok{background:#E3F6F6;color:#1B5E5E}
.form-msg.info{background:#FFF7D1;color:#6A5300}
.hp{position:absolute;left:-9999px}
section[id]{scroll-margin-top:84px}

'''
os.makedirs(f'{OUT}/assets/css',exist_ok=True)
open(f'{OUT}/assets/css/style.css','w',encoding='utf-8').write(css.strip()+'\n')

def sec(i):
    m=re.search(r'<section[^>]*id="%s".*?</section>'%i,s,re.S); return m.group(0)
footer=re.search(r'<footer>.*?</footer>',s,re.S).group(0)
script=re.search(r'<script>.*?</script>',s,re.S).group(0)

LINKS={'#acasa':'index.html','#despre':'despre.html','#istoric':'despre.html#istoric','#eveniment':'eveniment.html',
 '#parteneri':'eveniment.html#parteneri','#proiecte':'proiecte.html','#echipa':'echipa.html','#implica-te':'implica-te.html','#contact':'contact.html'}
def relink(h):
    for k,v in LINKS.items(): h=h.replace(f'href="{k}"',f'href="{v}"')
    return h

NAV=[('despre.html','Despre'),('eveniment.html','Eveniment'),('proiecte.html','Proiecte'),('echipa.html','Echipa'),('contact.html','Contact')]
MNAV=[('index.html','Acasă')]+NAV[:2]+[('proiecte.html','Proiecte'),('echipa.html','Echipa'),('implica-te.html','Devino membru'),('contact.html','Contact')]
LANG_SW=('en/','EN','English version')
PFX=''
def header(cur,fn=''):
    a=lambda h,t:f'<li><a href="{h}"'+(' aria-current="page"' if h==cur else '')+f'>{t}</a></li>'
    return f'''<header>
  <input type="checkbox" id="menu-toggle" aria-hidden="true">
  <div class="wrap nav">
    <a class="logo" href="index.html" aria-label="JCI Brașov, prima pagină"><img src="{PFX}assets/img/logo-jci-brasov-invers.png" alt="JCI Brașov" width="640" height="312"></a>
    <ul>
      {''.join(a(h,t) for h,t in NAV)}
    </ul>
    <div class="nav-actions"><a class="lang" href="{LANG_SW[0]}{fn or 'index.html'}" hreflang="{LANG_SW[1].lower()}" aria-label="{LANG_SW[2]}">{LANG_SW[1]}</a>
    <a class="btn btn-blue" href="implica-te.html">Devino membru</a></div>
    <label class="burger" for="menu-toggle" aria-label="Deschide meniul"><span></span></label>
  </div>
  <nav class="mobile-menu" aria-label="Meniu mobil">
    <ul>
      {''.join(a(h,t) for h,t in MNAV)}
      <li><a href="{LANG_SW[0]}{fn or 'index.html'}" hreflang="{LANG_SW[1].lower()}">{LANG_SW[2]}</a></li>
    </ul>
  </nav>
</header>'''

RIP=''
def intro(crumb,title,text):
    return f'''<section class="page-intro">{RIP}<div class="wrap"><div class="crumb"><a href="index.html">Acasă</a> / {crumb}</div><h1>{title}</h1><p>{text}</p></div></section>'''

DESC='JCI Brașov, comunitatea locală Junior Chamber International pentru tineri lideri între 18 și 40 de ani.'
def page(fn,title,desc,body,cur):
    html=f'''<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="icon" type="image/png" href="{PFX}assets/img/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Arvo&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{PFX}assets/css/style.css">
</head>
<body>
{header(cur,fn)}
<main>
{body}
</main>
{footer}
{script}
</body>
</html>
'''
    html=relink(html)
    if PFX: html=html.replace('src="assets/','src="'+PFX+'assets/')
    open(f'{OUT}/{fn}','w',encoding='utf-8').write(html)

def strip_tag_h2(h):  # sub-pages keep section content but drop duplicate tag+h2 when an intro is present
    h=re.sub(r'<span class="tag[^"]*">[^<]*</span>\s*','',h,count=1)
    h=re.sub(r'<h2>[^<]*</h2>\s*','',h,count=1)
    return h

teasers='''<section class="section mist">
  <div class="wrap">
    <span class="tag">Descoperă</span>
    <h2>Ce se întâmplă în JCI Brașov</h2>
    <div class="teasers">
      <a class="teaser" href="eveniment.html"><small>26 noiembrie 2026</small><h3>Beyond the Initiative</h3><p>Evenimentul de lansare de la CATTIA: două paneluri, opt invitați și Blitz Networking.</p><span class="go">Vezi programul →</span></a>
      <a class="teaser" href="proiecte.html"><small>Proiecte</small><h3>Ce construim</h3><p>Toy Story, podcastul „La un pahar de poveste” și proiectele pentru 2027.</p><span class="go">Vezi proiectele →</span></a>
      <a class="teaser" href="echipa.html"><small>Echipa</small><h3>Oamenii JCI Brașov</h3><p>Echipa de conducere, senatorii și membrii de onoare care ne susțin.</p><span class="go">Cunoaște echipa →</span></a>
    </div>
  </div>
</section>'''

despre=sec('despre')
pillars=re.search(r'<ul class="pillars">.*?</ul>',despre,re.S).group(0)
home_about=f'''<section class="section">
  <div class="wrap">
    <span class="tag">Despre noi</span>
    <h2>Nu intri într-o rețea. Intri într-o mișcare.</h2>
    <p class="lead">JCI este o rețea globală de tineri lideri care învață făcând, cresc împărtășind și conduc acționând. Brașovul face parte din ea din 2003.</p>
    {pillars}
    <div class="cta-row"><a class="btn btn-ghost on-light" href="despre.html">Povestea noastră</a></div>
  </div>
</section>'''

FEES='''<section class="section mist" id="cotizatie">
  <div class="wrap">
    <span class="tag teal">Cotizație</span>
    <h2>Cât costă să fii membru</h2>
    <p class="lead">Cotizația anuală acoperă afilierea la JCI România și la JCI internațional, precum și materialele de training. Contribuția lunară susține sediul social al organizației.</p>
    <div class="fees">
      <div class="fee"><small>Cotizație anuală</small><div class="amt">300 <span>lei / an</span></div><p>Membru JCI Brașov, afiliat JCI România</p></div>
      <div class="fee"><small>Contribuție sediu social</small><div class="amt">15 <span>lei / lună</span></div><p>Pentru spațiul de întâlnire al organizației</p></div>
    </div>
    <div class="cta-row"><a class="btn btn-blue" href="inscriere.html">Completează formularul de înscriere</a></div>
  </div>
</section>'''

FORM_EMAIL='contact@jci-brasov.com'   # adresa Gmail JCI Brașov; formularul se activează când e completată
form_action=f'https://formsubmit.co/{FORM_EMAIL}' if FORM_EMAIL else ''
FORM=f'''<section class="section">
  <div class="wrap form-wrap">
    <form class="signup" id="signup" method="POST" action="{form_action}" novalidate>
      <input type="hidden" name="_subject" value="Cerere nouă de înscriere JCI Brașov">
      <input type="hidden" name="_template" value="table">
      <input type="hidden" name="_captcha" value="false">
      <input type="hidden" name="_next" value="https://jci-brasov.com/multumim.html">
      <input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="row2">
        <div class="field"><label for="f-nume">Nume și prenume</label><input id="f-nume" name="Nume" required autocomplete="name"></div>
        <div class="field"><label for="f-varsta">Vârsta</label><input id="f-varsta" name="Varsta" type="number" min="18" max="40" required inputmode="numeric"></div>
      </div>
      <div class="row2">
        <div class="field"><label for="f-email">Email</label><input id="f-email" name="email" type="email" required autocomplete="email"></div>
        <div class="field"><label for="f-tel">Telefon</label><input id="f-tel" name="Telefon" type="tel" required autocomplete="tel"></div>
      </div>
      <div class="field"><label for="f-ocupatie">Ocupație sau domeniu de activitate</label><input id="f-ocupatie" name="Ocupatie" required></div>
      <div class="field"><label for="f-arie">Ce te interesează cel mai mult</label>
        <select id="f-arie" name="Arie de interes"><option>Dezvoltare personală</option><option>Afaceri și antreprenoriat</option><option>Proiecte pentru comunitate</option><option>Oportunități internaționale</option></select></div>
      <div class="field"><label for="f-motiv">De ce vrei să te alături JCI Brașov?</label><textarea id="f-motiv" name="Motivatie"></textarea></div>
      <div class="field"><label for="f-sursa">Cum ai aflat de noi</label>
        <select id="f-sursa" name="Sursa"><option>Recomandarea unui membru</option><option>Instagram sau Facebook</option><option>Comunitatea WhatsApp</option><option>Un eveniment JCI</option><option>Altă sursă</option></select></div>
      <label class="check" for="f-cotizatie"><input id="f-cotizatie" name="Accept cotizatie" type="checkbox" value="da" required><span>Am luat la cunoștință cotizația anuală de 300 lei și contribuția de 15 lei pe lună pentru sediul social.</span></label>
      <label class="check" for="f-gdpr"><input id="f-gdpr" name="Acord date" type="checkbox" value="da" required><span>Sunt de acord ca JCI Brașov să folosească datele mele doar pentru procesul de înscriere și pentru a mă contacta în legătură cu activitatea organizației.</span></label>
      <div class="form-msg" role="status"></div>
      <button class="btn btn-blue" type="submit" style="justify-content:center">Trimite cererea</button>
      <p class="form-note">Te contactăm în câteva zile pentru o discuție de cunoaștere.</p>
    </form>
    <aside>
      <h2 style="font-size:clamp(24px,2.6vw,32px)">Ce urmează după ce trimiți</h2>
      <ol class="steps" style="grid-template-columns:1fr;margin-top:24px">
        <li><h3>Discuție de cunoaștere</h3><p>Un membru al echipei te sună sau te invită la o cafea.</p></li>
        <li><h3>Primul eveniment</h3><p>Participi la o întâlnire și vezi cum lucrăm.</p></li>
        <li><h3>Devii membru</h3><p>Achiți cotizația și te alături unui proiect.</p></li>
      </ol>
      <div class="fees" style="grid-template-columns:1fr;margin-top:24px">
        <div class="fee"><small>Cotizație anuală</small><div class="amt">300 <span>lei / an</span></div></div>
        <div class="fee"><small>Contribuție sediu social</small><div class="amt">15 <span>lei / lună</span></div></div>
      </div>
    </aside>
  </div>
</section>
<script>
document.querySelectorAll('form.signup').forEach(function(f){{
  var m=f.querySelector('.form-msg');
  function say(t,c){{m.textContent=t;m.className='form-msg show '+c;}}
  f.addEventListener('submit',function(e){{
    if(!f.checkValidity()){{e.preventDefault();say('Completează câmpurile obligatorii și bifează acordurile.','info');f.reportValidity();return;}}
    if(!f.getAttribute('action')){{e.preventDefault();say('Formularul se activează în curând. Până atunci, sună-ne la +40 790 827 426.','info');return;}}
    say('Se trimite…','ok');
  }});
}});
</script>'''

page('inscriere.html','Formular de înscriere | JCI Brașov','Formularul de înscriere în JCI Brașov.',
     intro('<a href="implica-te.html">Devino membru</a> / Înscriere','Formular de înscriere','Completează cererea și te contactăm pentru o discuție de cunoaștere.')+FORM,'')

SPONSOR=f'''<section class="section" id="formular-sponsor">
  <div class="wrap form-wrap">
    <div>
      <span class="tag blue">Parteneriat</span>
      <h2>Solicitare de parteneriat</h2>
      <p class="lead">Completați formularul, iar în cel mult două zile lucrătoare vă transmitem propunerea detaliată și contractul de sponsorizare.</p>
      <p class="lead" style="font-size:16px">Pentru informații suplimentare ne puteți contacta la <a href="tel:+40790827426">+40 790 827 426</a> sau la <a href="mailto:contact@jci-brasov.com">contact@jci-brasov.com</a>.</p>
    </div>
    <form class="signup" method="POST" action="{form_action}" novalidate>
      <input type="hidden" name="_subject" value="Cerere nouă de parteneriat JCI Brașov Beyond the Initiative">
      <input type="hidden" name="_template" value="table">
      <input type="hidden" name="_captcha" value="false">
      <input type="hidden" name="_next" value="https://jci-brasov.com/multumim.html">
      <input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="field"><label for="s-firma">Companie sau organizație</label><input id="s-firma" name="Companie" required autocomplete="organization"></div>
      <div class="row2">
        <div class="field"><label for="s-nume">Persoană de contact</label><input id="s-nume" name="Persoana de contact" required autocomplete="name"></div>
        <div class="field"><label for="s-functie">Funcție</label><input id="s-functie" name="Functie"></div>
      </div>
      <div class="row2">
        <div class="field"><label for="s-email">Email</label><input id="s-email" name="email" type="email" required autocomplete="email"></div>
        <div class="field"><label for="s-tel">Telefon</label><input id="s-tel" name="Telefon" type="tel" required autocomplete="tel"></div>
      </div>
      <div class="field"><label for="s-pachet">Pachetul de interes</label>
        <select id="s-pachet" name="Pachet"><option>Sponsor, 1.000 lei</option><option>Sponsor Premium, 2.000 lei</option><option>Acces VIP, 200 lei</option><option>Parteneriat în natură</option><option>Doresc mai multe detalii</option></select></div>
      <div class="field"><label for="s-mesaj">Mesaj</label><textarea id="s-mesaj" name="Mesaj" placeholder="Produsele sau serviciile pe care doriți să le promovați"></textarea></div>
      <label class="check" for="s-gdpr"><input id="s-gdpr" name="Acord date" type="checkbox" value="da" required><span>Sunt de acord ca JCI Brașov să utilizeze aceste date exclusiv pentru a mă contacta în legătură cu parteneriatul.</span></label>
      <div class="form-msg" role="status"></div>
      <button class="btn btn-blue" type="submit" style="justify-content:center">Trimiteți solicitarea</button>
    </form>
  </div>
</section>'''
THANKS='''<section class="section"><div class="wrap" style="max-width:720px">
  <span class="tag teal">Mulțumim</span>
  <h2>Am primit cererea ta</h2>
  <p class="lead">Un membru al echipei JCI Brașov te contactează în următoarele zile. Până atunci, intră în comunitatea noastră de WhatsApp ca să afli primul de evenimente.</p>
  <div class="cta-row"><a class="btn btn-blue" href="https://chat.whatsapp.com/KAzFP6u8oMZDeslr1SfsNs" target="_blank" rel="noopener">Intră în comunitate</a><a class="btn btn-ghost on-light" href="index.html">Înapoi la prima pagină</a></div>
</div></section>'''

page('index.html','JCI Brașov','Comunitatea JCI pentru tineri lideri din Brașov. Evenimentul de lansare: 26 noiembrie 2026, CATTIA Brașov.',
     sec('acasa')+'\n'+home_about+'\n'+teasers+'\n'+sec('implica-te'),'index.html')
page('despre.html','Despre JCI Brașov',DESC,
     intro('Despre','Despre JCI Brașov','O mișcare globală a tinerilor lideri, cu rădăcini la Brașov din 2003.')+strip_tag_h2(despre).replace('<p class="lead">','<h2>Nu intri într-o rețea. Intri într-o mișcare.</h2><p class="lead">',1)+sec('istoric'),'despre.html')
page('eveniment.html','Beyond the Initiative, 26 noiembrie | JCI Brașov','Evenimentul de lansare JCI Brașov, 26 noiembrie 2026, ora 17:00, CATTIA Brașov. Acces gratuit cu înscriere.',
     sec('eveniment')+sec('parteneri')+SPONSOR,'eveniment.html')
page('proiecte.html','Proiecte JCI Brașov',DESC,
     intro('Proiecte','Ce construim','Proiecte care pornesc de la nevoi reale ale comunității, legate de Obiectivele de Dezvoltare Durabilă.')+strip_tag_h2(sec('proiecte')),'proiecte.html')
page('echipa.html','Echipa JCI Brașov',DESC,
     intro('Echipa','Oamenii JCI Brașov','Echipa de conducere, senatorii și membrii de onoare.')+strip_tag_h2(sec('echipa')),'echipa.html')
page('implica-te.html','Devino membru | JCI Brașov',DESC,
     intro('Devino membru','Devino membru','Patru pași de la curiozitate la implicare.')+sec('implica-te')+FEES,'implica-te.html')

page('multumim.html','Mulțumim | JCI Brașov',DESC,THANKS,'')
page('contact.html','Contact | JCI Brașov',DESC,sec('contact'),'contact.html')
print('built',sorted(f for f in os.listdir(OUT) if f.endswith('.html')))
