import re, os
SRC='/home/claude/tools/source-en.html'; OUT='/home/claude/site/en'
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
os.makedirs(OUT,exist_ok=True)

def sec(i):
    m=re.search(r'<section[^>]*id="%s".*?</section>'%i,s,re.S); return m.group(0)
footer=re.search(r'<footer>.*?</footer>',s,re.S).group(0)
script=re.search(r'<script>.*?</script>',s,re.S).group(0)

LINKS={'#acasa':'index.html','#despre':'despre.html','#istoric':'despre.html#istoric','#eveniment':'eveniment.html',
 '#parteneri':'eveniment.html#parteneri','#proiecte':'proiecte.html','#echipa':'echipa.html','#implica-te':'implica-te.html','#contact':'contact.html'}
def relink(h):
    for k,v in LINKS.items(): h=h.replace(f'href="{k}"',f'href="{v}"')
    return h

NAV=[('despre.html','About'),('eveniment.html','Event'),('proiecte.html','Projects'),('echipa.html','Team'),('contact.html','Contact')]
MNAV=[('index.html','Home')]+NAV[:2]+[('proiecte.html','Projects'),('echipa.html','Team'),('implica-te.html','Become a member'),('contact.html','Contact')]
LANG_SW=('../','RO','Versiunea în română')
PFX='../'
def header(cur,fn=''):
    a=lambda h,t:f'<li><a href="{h}"'+(' aria-current="page"' if h==cur else '')+f'>{t}</a></li>'
    return f'''<header>
  <input type="checkbox" id="menu-toggle" aria-hidden="true">
  <div class="wrap nav">
    <a class="logo" href="index.html" aria-label="JCI Brașov, home page"><img src="{PFX}assets/img/logo-jci-brasov-invers.png" alt="JCI Brașov" width="640" height="312"></a>
    <ul>
      {''.join(a(h,t) for h,t in NAV)}
    </ul>
    <div class="nav-actions"><a class="lang" href="{LANG_SW[0]}{fn or 'index.html'}" hreflang="{LANG_SW[1].lower()}" aria-label="{LANG_SW[2]}">{LANG_SW[1]}</a>
    <a class="btn btn-blue" href="implica-te.html">Become a member</a></div>
    <label class="burger" for="menu-toggle" aria-label="Open menu"><span></span></label>
  </div>
  <nav class="mobile-menu" aria-label="Mobile menu">
    <ul>
      {''.join(a(h,t) for h,t in MNAV)}
      <li><a href="{LANG_SW[0]}{fn or 'index.html'}" hreflang="{LANG_SW[1].lower()}">{LANG_SW[2]}</a></li>
    </ul>
  </nav>
</header>'''

RIP=''
def intro(crumb,title,text):
    return f'''<section class="page-intro">{RIP}<div class="wrap"><div class="crumb"><a href="index.html">Home</a> / {crumb}</div><h1>{title}</h1><p>{text}</p></div></section>'''

DESC='JCI Brașov, the local Junior Chamber International chapter for young leaders aged 18 to 40.'

import json as _json
SITE='https://jci-brasov.com/'
def seo(fn,title,desc):
    en=bool(PFX)
    path='' if fn=='index.html' else fn[:-5]
    ro_url=SITE+path; en_url=SITE+'en/'+path
    url=en_url if en else ro_url
    img=SITE+('assets/img/og-jci-brasov-en.jpg' if en else 'assets/img/og-jci-brasov.jpg')
    t=title.replace('"','&quot;'); d=desc.replace('"','&quot;')
    out=f"""<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="ro" href="{ro_url}">
<link rel="alternate" hreflang="en" href="{en_url}">
<link rel="alternate" hreflang="x-default" href="{ro_url}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon-32.png">
<link rel="icon" type="image/png" sizes="96x96" href="/assets/img/favicon.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/img/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#130F2D">
<meta property="og:type" content="website">
<meta property="og:site_name" content="JCI Brașov">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="JCI Brașov">
<meta property="og:locale" content="{'en_GB' if en else 'ro_RO'}">
<meta property="og:locale:alternate" content="{'ro_RO' if en else 'en_GB'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{t}">
<meta name="twitter:description" content="{d}">
<meta name="twitter:image" content="{img}">"""
    if fn=='index.html':
        org={"@context":"https://schema.org","@type":"Organization","name":"JCI Brașov","alternateName":"Junior Chamber International Brașov",
             "url":SITE,"logo":SITE+"assets/img/icon-512.png","image":img,"email":"contact@jci-brasov.com","telephone":"+40790827426",
             "address":{"@type":"PostalAddress","addressLocality":"Brașov","addressCountry":"RO"},
             "parentOrganization":{"@type":"Organization","name":"JCI România"},
             "sameAs":["https://www.instagram.com/jcibrasov","https://www.facebook.com/share/1G4xX5D4Mi/"]}
        site={"@context":"https://schema.org","@type":"WebSite","name":"JCI Brașov","url":SITE,"inLanguage":"en" if en else "ro"}
        out+='\n<script type="application/ld+json">'+_json.dumps([org,site],ensure_ascii=False)+'</script>'
    return out

def page(fn,title,desc,body,cur):
    html=f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
{seo(fn,title,desc)}
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
    <span class="tag">Discover</span>
    <h2>What's happening at JCI Brașov</h2>
    <div class="teasers">
      <a class="teaser" href="eveniment.html"><small>26 November 2026</small><h3>Beyond the Initiative</h3><p>Our launch event at CATTIA: two panels, eight speakers and Blitz Networking.</p><span class="go">See the programme →</span></a>
      <a class="teaser" href="proiecte.html"><small>Projects</small><h3>What we're building</h3><p>Toy Story, the “La un pahar de poveste” podcast and our plans for 2027.</p><span class="go">See the projects →</span></a>
      <a class="teaser" href="echipa.html"><small>Team</small><h3>The people of JCI Brașov</h3><p>The leadership team, plus the Senators and honorary members who support us.</p><span class="go">Meet the team →</span></a>
    </div>
  </div>
</section>'''

despre=sec('despre')
pillars=re.search(r'<ul class="pillars">.*?</ul>',despre,re.S).group(0)
home_about=f'''<section class="section">
  <div class="wrap">
    <span class="tag">About us</span>
    <h2>Not just another network. A movement.</h2>
    <p class="lead">JCI is a global network of young leaders who learn by doing, grow by sharing and lead by acting. Brașov has been part of it since 2003.</p>
    {pillars}
    <div class="cta-row"><a class="btn btn-ghost on-light" href="despre.html">Our story</a></div>
  </div>
</section>'''

FEES='''<section class="section mist" id="cotizatie">
  <div class="wrap">
    <span class="tag teal">Membership fees</span>
    <h2>What membership costs</h2>
    <p class="lead">The annual fee covers affiliation to JCI Romania and JCI International, as well as training materials. The monthly contribution supports our registered office.</p>
    <div class="fees">
      <div class="fee"><small>Annual fee</small><div class="amt">300 <span>RON / year</span></div><p>JCI Brașov membership, affiliated to JCI Romania</p></div>
      <div class="fee"><small>Office contribution</small><div class="amt">15 <span>RON / month</span></div><p>Towards our meeting space</p></div>
    </div>
    <div class="cta-row"><a class="btn btn-blue" href="inscriere.html">Complete the application form</a></div>
  </div>
</section>'''

FORM_EMAIL='contact@jci-brasov.com'   # adresa Gmail JCI Brașov; formularul se activează când e completată
form_action='/api/form'
FORM=f'''<section class="section">
  <div class="wrap form-wrap">
    <form class="signup" id="signup" method="POST" action="{form_action}" novalidate>
      <input type="hidden" name="_subject" value="New membership application JCI Brașov (EN)">
      <input type="hidden" name="_template" value="table">
      <input type="hidden" name="_captcha" value="false">
      <input type="hidden" name="_next" value="/en/multumim.html">
      <input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="row2">
        <div class="field"><label for="f-nume">Full name</label><input id="f-nume" name="Nume" required autocomplete="name"></div>
        <div class="field"><label for="f-varsta">Age</label><input id="f-varsta" name="Varsta" type="number" min="18" max="40" required inputmode="numeric"></div>
      </div>
      <div class="row2">
        <div class="field"><label for="f-email">Email</label><input id="f-email" name="email" type="email" required autocomplete="email"></div>
        <div class="field"><label for="f-tel">Phone</label><input id="f-tel" name="Telefon" type="tel" required autocomplete="tel"></div>
      </div>
      <div class="field"><label for="f-ocupatie">Occupation or field</label><input id="f-ocupatie" name="Ocupatie" required></div>
      <div class="field"><label for="f-arie">What interests you most</label>
        <select id="f-arie" name="Arie de interes"><option>Personal growth</option><option>Business and entrepreneurship</option><option>Community projects</option><option>International opportunities</option></select></div>
      <div class="field"><label for="f-motiv">Why do you want to join JCI Brașov?</label><textarea id="f-motiv" name="Motivatie"></textarea></div>
      <div class="field"><label for="f-sursa">How did you hear about us</label>
        <select id="f-sursa" name="Sursa"><option>Referral from a member</option><option>Instagram or Facebook</option><option>WhatsApp community</option><option>A JCI event</option><option>Other</option></select></div>
      <label class="check" for="f-cotizatie"><input id="f-cotizatie" name="Accept cotizatie" type="checkbox" value="da" required><span>I understand the annual fee of 300 RON and the office contribution of 15 RON per month.</span></label>
      <label class="check" for="f-gdpr"><input id="f-gdpr" name="Acord date" type="checkbox" value="da" required><span>I agree that JCI Brașov may use my data solely for the application process and to contact me about the organisation's activities.</span></label>
      <div class="form-msg" role="status"></div>
      <button class="btn btn-blue" type="submit" style="justify-content:center">Submit application</button>
      <p class="form-note">We'll be in touch within a few days for an introductory chat.</p>
    </form>
    <aside>
      <h2 style="font-size:clamp(24px,2.6vw,32px)">What happens next</h2>
      <ol class="steps" style="grid-template-columns:1fr;margin-top:24px">
        <li><h3>Introductory chat</h3><p>A team member calls you or invites you for a coffee.</p></li>
        <li><h3>Your first event</h3><p>Join a meeting and see how we work.</p></li>
        <li><h3>You become a member</h3><p>Pay the fee and join a project.</p></li>
      </ol>
      <div class="fees" style="grid-template-columns:1fr;margin-top:24px">
        <div class="fee"><small>Annual fee</small><div class="amt">300 <span>RON / year</span></div></div>
        <div class="fee"><small>Office contribution</small><div class="amt">15 <span>RON / month</span></div></div>
      </div>
    </aside>
  </div>
</section>
<script>
document.querySelectorAll('form.signup').forEach(function(f){{
  var m=f.querySelector('.form-msg');
  function say(t,c){{m.textContent=t;m.className='form-msg show '+c;}}
  f.addEventListener('submit',function(e){{
    if(!f.checkValidity()){{e.preventDefault();say('Please complete the required fields and tick both boxes.','info');f.reportValidity();return;}}
    if(!f.getAttribute('action')){{e.preventDefault();say('The form will be live soon. In the meantime, call us on +40 790 827 426.','info');return;}}
    say('Sending…','ok');
  }});
}});
</script>'''

page('inscriere.html','Application form | JCI Brașov','Apply to join JCI Brașov.',
     intro('<a href="implica-te.html">Become a member</a> / Application','Application form','Complete the form and we\'ll get in touch for an introductory chat.')+FORM,'')

SPONSOR=f'''<section class="section" id="formular-sponsor">
  <div class="wrap form-wrap">
    <div>
      <span class="tag blue">Partnership</span>
      <h2>Partnership request</h2>
      <p class="lead">Complete the form and within two working days we will send you a detailed proposal and the sponsorship agreement.</p>
      <p class="lead" style="font-size:16px">For further information, call <a href="tel:+40790827426">+40 790 827 426</a> or email <a href="mailto:contact@jci-brasov.com">contact@jci-brasov.com</a>.</p>
    </div>
    <form class="signup" method="POST" action="{form_action}" novalidate>
      <input type="hidden" name="_subject" value="New partnership request JCI Brașov Beyond the Initiative (EN)">
      <input type="hidden" name="_template" value="table">
      <input type="hidden" name="_captcha" value="false">
      <input type="hidden" name="_next" value="/en/multumim.html">
      <input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="field"><label for="s-firma">Company or organisation</label><input id="s-firma" name="Companie" required autocomplete="organization"></div>
      <div class="row2">
        <div class="field"><label for="s-nume">Contact person</label><input id="s-nume" name="Persoana de contact" required autocomplete="name"></div>
        <div class="field"><label for="s-functie">Job title</label><input id="s-functie" name="Functie"></div>
      </div>
      <div class="row2">
        <div class="field"><label for="s-email">Email</label><input id="s-email" name="email" type="email" required autocomplete="email"></div>
        <div class="field"><label for="s-tel">Phone</label><input id="s-tel" name="Telefon" type="tel" required autocomplete="tel"></div>
      </div>
      <div class="field"><label for="s-pachet">Package of interest</label>
        <select id="s-pachet" name="Pachet"><option>Sponsor, 1,000 RON</option><option>Premium Sponsor, 2,000 RON</option><option>VIP Access, 200 RON</option><option>Barter partnership</option><option>I would like more details</option></select></div>
      <div class="field"><label for="s-mesaj">Message</label><textarea id="s-mesaj" name="Mesaj" placeholder="The products or services you would like to promote"></textarea></div>
      <label class="check" for="s-gdpr"><input id="s-gdpr" name="Acord date" type="checkbox" value="da" required><span>I agree that JCI Brașov may use this data solely to contact me about the partnership.</span></label>
      <div class="form-msg" role="status"></div>
      <button class="btn btn-blue" type="submit" style="justify-content:center">Submit request</button>
    </form>
  </div>
</section>'''
THANKS='''<section class="section"><div class="wrap" style="max-width:720px">
  <span class="tag teal">Thank you</span>
  <h2>We've received your request</h2>
  <p class="lead">A member of the JCI Brașov team will be in touch over the next few days. In the meantime, join our WhatsApp community to hear about events first.</p>
  <div class="cta-row"><a class="btn btn-blue" href="https://chat.whatsapp.com/KAzFP6u8oMZDeslr1SfsNs" target="_blank" rel="noopener">Join the community</a><a class="btn btn-ghost on-light" href="index.html">Back to home page</a></div>
</div></section>'''

page('index.html','JCI Brașov | The young leaders community in Brașov','The JCI community for young leaders in Brașov. Launch event: 26 November 2026, CATTIA Brașov.',
     sec('acasa')+'\n'+home_about+'\n'+teasers+'\n'+sec('implica-te'),'index.html')
page('despre.html','About JCI Brașov',DESC,
     intro('About','About JCI Brașov','A global movement of young leaders, rooted in Brașov since 2003.')+strip_tag_h2(despre).replace('<p class="lead">','<h2>Not just another network. A movement.</h2><p class="lead">',1)+sec('istoric'),'despre.html')
page('eveniment.html','Beyond the Initiative, 26 November | JCI Brașov','JCI Brașov launch event, 26 November 2026, 5:00 pm, CATTIA Brașov. Free entry with registration.',
     sec('eveniment')+sec('parteneri')+SPONSOR,'eveniment.html')
page('proiecte.html','JCI Brașov Projects',DESC,
     intro('Projects','What we\'re building','Projects that start from real community needs, linked to the Sustainable Development Goals.')+strip_tag_h2(sec('proiecte')),'proiecte.html')
page('echipa.html','JCI Brașov Team',DESC,
     intro('Team','The people of JCI Brașov','The leadership team, Senators and honorary members.')+strip_tag_h2(sec('echipa')),'echipa.html')
page('implica-te.html','Become a member | JCI Brașov',DESC,
     intro('Become a member','Become a member','Four steps from curiosity to involvement.')+sec('implica-te')+FEES,'implica-te.html')

page('multumim.html','Thank you | JCI Brașov',DESC,THANKS,'')
page('contact.html','Contact | JCI Brașov',DESC,sec('contact'),'contact.html')
print('built',sorted(f for f in os.listdir(OUT) if f.endswith('.html')))
