# Campania „Dar din Dar” (cozonaci, comenzi din 3 decembrie 2026) și trecerea evenimentului din 26 noiembrie la evenimente încheiate.
# Rulează pe public/, DUPĂ toate celelalte scripturi și ÎNAINTE de security.py (scoate și adaugă scripturi inline). Idempotent.
#   python3 src/cozonaci.py && python3 src/security.py
# Ce face:
#  1. pagina /cozonaci și /en/cozonaci (pe scheletul paginii Proiecte), cu assets/css/cozonaci.css și assets/js/cozonaci.js (fără script inline)
#  2. prima pagină: cardul din hero, butonul principal și cronometrul trec pe campanie (cronometrul vechi, inline, e scos)
#  3. pagina Eveniment devine arhivă: fără înscriere, bilete VIP, cronometru, întrebări frecvente, pachete și formular de sponsorizare
#  4. meniul („Cozonaci”, „Evenimente”), subsolul, mesajul asistentului, sitemap
# Imaginile și clipul (poze și filmări reale, din bucătărie) stau în public/assets/img/cozonaci și public/assets/video.
import os, re, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'public') + '/'
WA = 'https://chat.whatsapp.com/KAzFP6u8oMZDeslr1SfsNs'


def rd(p):
    return open(P + p, encoding='utf8').read()


def wr(p, s):
    open(P + p, 'w', encoding='utf8').write(s)


CSS = """/* Campania Dar din Dar (src/cozonaci.py) */
.coz-hero{background:radial-gradient(70% 110% at 85% 10%,rgba(239,196,15,.14),transparent 60%),radial-gradient(80% 120% at 10% 0%,rgba(0,151,215,.20),transparent 60%),#0B0920;color:#fff;padding:44px 0 64px}
.coz-grid{display:grid;grid-template-columns:1.05fr 1fr;gap:48px;align-items:center}
.coz-hero .crumb{font-size:14px;color:#A9ABC8;margin-bottom:18px}
.coz-hero .crumb a{color:inherit}
.coz-hero h1{text-transform:uppercase;font-weight:800;letter-spacing:-.03em;line-height:.98;font-size:clamp(44px,5.6vw,80px);margin:0 0 20px;white-space:nowrap}
.coz-hero .lead{max-width:34em}
.coz-prices{list-style:none;padding:0;margin:28px 0 10px;display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:460px}
.coz-prices li{background:#14113A;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:16px 18px}
.coz-prices span{display:block;font-size:14px;color:#B9BBD6;font-weight:600}
.coz-prices b{display:block;font-size:34px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.15}
.coz-prices li+li{border-color:rgba(239,196,15,.55)}
.coz-when{font-weight:700;color:#EFC40F;margin:14px 0 24px}
.coz-ctas{display:flex;gap:12px;flex-wrap:wrap}
.coz-media{margin:0;position:relative}
.coz-media video,.coz-media img{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;border-radius:24px;box-shadow:0 40px 90px -30px rgba(0,0,0,.9),0 0 0 1px rgba(255,255,255,.10)}
.coz-media figcaption{font-size:14px;color:#B9BBD6;margin-top:12px}
.coz-pause{position:absolute;left:14px;top:14px;border:0;border-radius:999px;background:rgba(11,9,32,.72);color:#fff;font:inherit;font-size:13px;font-weight:700;padding:8px 14px;cursor:pointer}
.coz-pause:focus-visible{outline:2px solid #EFC40F;outline-offset:2px}
.coz-proverb{font-family:Arvo,Georgia,serif;font-size:clamp(20px,2.6vw,28px);line-height:1.4;text-align:center;max-width:26em;margin:0 auto;color:#fff}
.coz-gal{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:40px}
.coz-gal figure{margin:0}
.coz-gal img{display:block;width:100%;height:auto;aspect-ratio:4/5;object-fit:cover;border-radius:18px}
.coz-gal figcaption{font-size:14px;color:#B9BBD6;margin-top:10px}
.coz-sort{max-width:820px;margin-inline:auto;grid-template-columns:1fr 1fr}
.coz .steps{grid-template-columns:repeat(3,1fr)}
.coz-proverb{margin-top:48px}
.coz-note{color:#B9BBD6;font-size:15px;text-align:center;margin-top:22px}
.countdown .cta-row{justify-content:center;margin-top:22px}
.ev-next{display:block;margin:0 0 26px;padding:14px 18px;border-radius:14px;background:rgba(239,196,15,.10);border:1px solid rgba(239,196,15,.45);color:#fff;text-decoration:none;font-weight:600}
.ev-next b{color:#EFC40F}
.ev-done{color:#B9BBD6;margin:0 0 28px;max-width:44em}
@media(max-width:900px){.coz .steps,.coz-sort{grid-template-columns:1fr}.coz-grid{grid-template-columns:1fr;gap:28px}.coz-hero{padding:28px 0 44px}.coz-gal{grid-template-columns:1fr 1fr}.coz-gal figure:first-child{grid-column:1/-1}.coz-gal figure:first-child img{aspect-ratio:4/3}}
@media(max-width:420px){.coz-prices b{font-size:28px}}
"""

JS = """// Campania Dar din Dar: cronometru până la deschiderea comenzilor și controlul clipului (src/cozonaci.py)
(function(){
var start=Date.UTC(2026,11,2,22,0,0); // 3 decembrie 2026, 00:00, ora României
function pad(n){return(n<10?'0':'')+n}
function tick(){var now=Date.now();
document.querySelectorAll('.cd-box[data-coz]').forEach(function(b){
if(now>=start){var c=b.querySelector('.cd-clock');if(c&&!b.dataset.fin){b.dataset.fin=1;var p=document.createElement('p');p.className='cd-msg';p.textContent=b.dataset.live;c.replaceWith(p);}return;}
var s=Math.floor((start-now)/1000),v={d:Math.floor(s/86400),h:Math.floor(s%86400/3600),m:Math.floor(s%3600/60),s:s%60};
b.querySelectorAll('.cd-num').forEach(function(e){e.textContent=pad(v[e.dataset.u]);});});}
if(document.querySelector('.cd-box[data-coz]')){tick();setInterval(tick,1000);}
var v=document.querySelector('.coz-media video'),btn=document.querySelector('.coz-pause');
if(v&&btn){
var calm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var save=navigator.connection&&navigator.connection.saveData;
function lab(){btn.textContent=v.paused?btn.dataset.play:btn.dataset.pause;btn.setAttribute('aria-pressed',v.paused?'true':'false');}
btn.hidden=false;
if(calm||save){v.removeAttribute('autoplay');v.pause();}else{var p=v.play();if(p&&p.catch)p.catch(function(){});}
v.addEventListener('play',lab);v.addEventListener('pause',lab);lab();
btn.addEventListener('click',function(){if(v.paused){v.play();}else{v.pause();}});
}
})();
"""


def ver(s):
    return hashlib.sha256(s.encode('utf8')).hexdigest()[:8]


T = {
 'ro': dict(
  title='Dar din Dar: cozonaci de casă, din 3 decembrie | JCI Brașov',
  desc='Campania caritabilă JCI Brașov: cozonac simplu 75 lei, babka 90 lei. Primele comenzi din 3 decembrie 2026. O parte din fiecare cozonac devine cadou pentru copii.',
  crumb='Cozonaci', home='Acasă', nav='Cozonaci', events='Evenimente', foot_ev='Evenimente încheiate', foot_coz='Cozonaci de casă',
  tag='Campanie caritabilă JCI Brașov', h1='Dar din Dar',
  lead='Cozonaci de casă, făcuți într-o bucătărie profesională, cu ingrediente de calitate. O parte din fiecare cozonac comandat devine cadou pentru copii din familii defavorizate.',
  p1='Cozonac simplu', p2='Babka', cur='lei', when='Primele comenzi: joi, 3 decembrie 2026',
  cta1='Intră în comunitate', cta2='Cum funcționează',
  cap='Babka, filmată în bucătărie', pause='Pauză', play='Redă', valt='Babka proaspăt coaptă, cu umplutură de cacao',
  kick='Până la primele comenzi', live='Comenzile sunt deschise. Detalii în comunitatea JCI Brașov și la +40 790 827 426.',
  cdl='Timp rămas până la deschiderea comenzilor', u=('Zile', 'Ore', 'Min', 'Sec'), cddate='Joi, 3 decembrie 2026',
  s_tag='Sortimente', s_h='Două sortimente, aceeași grijă',
  s1=('Tradițional, din aluat de casă', 'Făcut într-o bucătărie profesională', 'Ingrediente de calitate'),
  s2=('Împletită, cu umplutură de cacao', 'Făcută într-o bucătărie profesională', 'Ingrediente de calitate'),
  s_note='Prețul este per bucată. Comenzile se deschid joi, 3 decembrie 2026.',
  c_tag='Cum funcționează', c_h='De la cuptor la un copil care primește un cadou',
  c=(('Alegi sortimentul', 'Cozonac simplu, la 75 lei, sau babka, la 90 lei.'),
     ('Comanzi din 3 decembrie', 'Modalitatea de comandă o anunțăm pe această pagină și în comunitatea JCI Brașov.'),
     ('Darul merge mai departe', 'O parte din fiecare cozonac devine cadou pentru copii din familii defavorizate.')),
  prov='O vorbă veche spune că dar din dar se face rai.',
  g_tag='Din bucătărie', g_h='Făcuți de mână, în serii mici',
  g=(('Babka împletită, în tăvi, înainte de cuptor', 'Împletite și așezate în tăvi'), ('Aluat de cozonac la dospit', 'Aluatul, la dospit'), ('Babka proaspăt coaptă, în tavă', 'Proaspăt scoasă din cuptor')),
  f_tag='Primele comenzi din 3 decembrie', f_h='Află primul când deschidem comenzile',
  f_lead='Anunțăm deschiderea comenzilor în comunitatea JCI Brașov. Pentru detalii ne poți scrie sau suna oricând.',
  f_b2='Sună-ne: +40 790 827 426',
  # prima pagină
  hero_cta='Cozonaci de casă, din 3 decembrie', t_aria='Campania Dar din Dar', t_tag='Campanie caritabilă', t_date='decembrie 2026<br>primele comenzi',
  t_h='Dar din Dar: cozonaci de casă', t_dl=(('Cozonac simplu', '75 lei'), ('Babka', '90 lei'), ('Scop', 'Cadouri pentru copii')), t_btn='Vezi cozonacii',
  cd_aria='Până la primele comenzi de cozonaci', cd_btn='Vezi campania Dar din Dar',
  tz=('Din 3 decembrie 2026', 'Dar din Dar', 'Cozonaci de casă: cozonac simplu la 75 lei și babka la 90 lei. O parte devine cadou pentru copii.', 'Vezi campania →'),
  step='Cunoaște oamenii și vezi cum lucrăm. Urmărește anunțurile din comunitate.',
  step_old='Cunoaște oamenii și vezi cum lucrăm. Primul pas: 26 noiembrie.',
  # arhiva evenimentului
  e_title='Beyond the Initiative, 26 noiembrie 2026 | Eveniment încheiat | JCI Brașov',
  e_desc='Evenimentul de lansare JCI Brașov a avut loc pe 26 noiembrie 2026, la CATTIA Brașov: două paneluri, opt invitați și Blitz Networking. Programul, invitații și partenerii.',
  e_tag='Eveniment încheiat', e_loc='26 noiembrie 2026',
  e_done='Evenimentul a avut loc joi, 26 noiembrie 2026. Mulțumim invitaților, partenerilor și tuturor celor care au fost alături de noi. Mai jos rămân programul, invitații și partenerii serii.',
  e_next='<b>Urmează:</b> Dar din Dar, cozonaci de casă. Primele comenzi din 3 decembrie.',
  e_part='Pentru parteneriate la proiectele și evenimentele viitoare, ne puteți scrie la <a href="mailto:contact@jci-brasov.com">contact@jci-brasov.com</a> sau ne puteți suna la <a href="tel:+40790827426">+40 790 827 426</a>.',
  tz_ev=('Eveniment încheiat', 'Evenimentul de lansare din 26 noiembrie 2026, de la CATTIA: două paneluri, opt invitați și Blitz Networking.', 'Vezi cum a fost →'),
  hello='Bună! Te pot ajuta cu informații despre campania de cozonaci Dar din Dar, proiecte, evenimente sau cum devii membru. Ce vrei să afli?',
  sug=('Cât costă cozonacii?', 'Când pot comanda cozonaci?', 'Cum devin membru JCI Brașov?', 'Ce proiecte are JCI Brașov?'),
 ),
 'en': dict(
  title='Dar din Dar: homemade cozonac, from 3 December | JCI Brașov',
  desc='JCI Brașov charity campaign: classic cozonac 75 RON, babka 90 RON. First orders from 3 December 2026. Part of every loaf becomes a gift for children.',
  crumb='Cozonac', home='Home', nav='Cozonac', events='Events', foot_ev='Past events', foot_coz='Homemade cozonac',
  tag='JCI Brașov charity campaign', h1='Dar din Dar',
  lead='Homemade cozonac, the Romanian festive sweet bread, baked in a professional kitchen with quality ingredients. Part of every loaf ordered becomes a gift for children from disadvantaged families.',
  p1='Classic cozonac', p2='Babka', cur='RON', when='First orders: Thursday, 3 December 2026',
  cta1='Join the community', cta2='How it works',
  cap='Babka, filmed in the kitchen', pause='Pause', play='Play', valt='Freshly baked babka with cocoa filling',
  kick='Countdown to the first orders', live='Orders are open. Details in the JCI Brașov community and on +40 790 827 426.',
  cdl='Time left until orders open', u=('Days', 'Hours', 'Min', 'Sec'), cddate='Thursday, 3 December 2026',
  s_tag='The range', s_h='Two loaves, the same care',
  s1=('Traditional, made from homemade dough', 'Baked in a professional kitchen', 'Quality ingredients'),
  s2=('Braided, with cocoa filling', 'Baked in a professional kitchen', 'Quality ingredients'),
  s_note='Prices are per loaf. Orders open on Thursday, 3 December 2026.',
  c_tag='How it works', c_h='From the oven to a child who receives a gift',
  c=(('Choose your loaf', 'Classic cozonac at 75 RON or babka at 90 RON.'),
     ('Order from 3 December', 'We will announce how to order on this page and in the JCI Brașov community.'),
     ('The gift goes further', 'Part of every loaf becomes a gift for children from disadvantaged families.')),
  prov='An old Romanian saying goes: a gift made from a gift builds heaven.',
  g_tag='From the kitchen', g_h='Made by hand, in small batches',
  g=(('Braided babka in tins, before baking', 'Braided and set in the tins'), ('Cozonac dough proving', 'The dough, proving'), ('Freshly baked babka in its tin', 'Fresh out of the oven')),
  f_tag='First orders from 3 December', f_h='Be the first to know when orders open',
  f_lead='We will announce the opening of orders in the JCI Brașov community. For details, write to us or call us at any time.',
  f_b2='Call us: +40 790 827 426',
  hero_cta='Homemade cozonac, from 3 December', t_aria='The Dar din Dar campaign', t_tag='Charity campaign', t_date='December 2026<br>first orders',
  t_h='Dar din Dar: homemade cozonac', t_dl=(('Classic cozonac', '75 RON'), ('Babka', '90 RON'), ('Purpose', 'Gifts for children')), t_btn='See the cozonac',
  cd_aria='Countdown to the first cozonac orders', cd_btn='See the Dar din Dar campaign',
  tz=('From 3 December 2026', 'Dar din Dar', 'Homemade cozonac: classic at 75 RON and babka at 90 RON. Part becomes a gift for children.', 'See the campaign →'),
  step='Meet the people and see how we work. Follow the announcements in the community.',
  step_old='Meet the people and see how we work. The first step is 26 November.',
  e_title='Beyond the Initiative, 26 November 2026 | Past event | JCI Brașov',
  e_desc='The JCI Brașov launch event took place on 26 November 2026 at CATTIA Brașov: two panels, eight speakers and Blitz Networking. Programme, speakers and partners.',
  e_tag='Past event', e_loc='26 November 2026',
  e_done='The event took place on Thursday, 26 November 2026. Thank you to our speakers, our partners and everyone who joined us. The programme, speakers and partners of the evening remain below.',
  e_next='<b>Next:</b> Dar din Dar, homemade cozonac. First orders from 3 December.',
  e_part='For partnerships on future projects and events, please write to <a href="mailto:contact@jci-brasov.com">contact@jci-brasov.com</a> or call <a href="tel:+40790827426">+40 790 827 426</a>.',
  tz_ev=('Past event', 'Our launch event of 26 November 2026 at CATTIA: two panels, eight speakers and Blitz Networking.', 'See how it went →'),
  hello='Hi! I can help with the Dar din Dar cozonac campaign, projects, events or how to become a member. What would you like to know?',
  sug=('How much is the cozonac?', 'When can I order cozonac?', 'How do I become a member?', 'What projects does JCI Brașov run?'),
 ),
}


def clock(t, cls=''):
    u = ''.join('<div class="cd-unit"><span class="cd-num" data-u="%s">00</span><span class="cd-lab">%s</span></div>%s' % (k, l, '<span class="cd-sep" aria-hidden="true">:</span>' if k != 's' else '')
                for k, l in zip('dhms', t['u']))
    return ('<div class="cd-box" data-coz data-live="%s"><div class="kicker">%s</div><div class="cd-clock" role="timer" aria-label="%s">%s</div><p class="cd-date">%s</p>'
            % (t['live'], t['kick'], t['cdl'], u, t['cddate']))


def main_html(t, a):
    """a = prefixul pentru resurse (gol în RO; paginile EN folosesc căi absolute)."""
    def pack(name, price, items, hi=''):
        return '<div class="pack%s"><small>%s</small><div class="price">%s <span>%s</span></div><ul>%s</ul></div>' % (hi, name, price, t['cur'], ''.join('<li>%s</li>' % i for i in items))
    gal = ''.join('<figure><img loading="lazy" decoding="async" src="/assets/img/cozonaci/%s.webp" alt="%s" width="960" height="1200"><figcaption>%s</figcaption></figure>' % (f, al, cp)
                  for f, (al, cp) in zip(('tavi', 'aluat', 'copt'), t['g']))
    steps = ''.join('<li><h3>%s</h3><p>%s</p></li>' % x for x in t['c'])
    return '''<main class="coz">
<section class="coz-hero">
  <div class="wrap coz-grid">
    <div class="coz-copy">
      <div class="crumb"><a href="./">{home}</a> / {crumb}</div>
      <span class="tag">{tag}</span>
      <h1>{h1}</h1>
      <p class="lead">{lead}</p>
      <ul class="coz-prices"><li><span>{p1}</span><b>75 {cur}</b></li><li><span>{p2}</span><b>90 {cur}</b></li></ul>
      <p class="coz-when">{when}</p>
      <div class="coz-ctas"><a class="btn btn-blue" href="{wa}" target="_blank" rel="noopener">{cta1}</a><a class="btn btn-ghost" href="#cum">{cta2}</a></div>
    </div>
    <figure class="coz-media">
      <video autoplay muted loop playsinline preload="metadata" poster="/assets/img/cozonaci/babka-poster.webp" width="960" height="720" aria-label="{valt}"><source src="/assets/video/babka.webm" type="video/webm"><source src="/assets/video/babka.mp4" type="video/mp4"></video>
      <button type="button" class="coz-pause" data-pause="{pause}" data-play="{play}" hidden>{pause}</button>
      <figcaption>{cap}</figcaption>
    </figure>
  </div>
</section>
<section class="countdown" aria-label="{kick}"><div class="wrap">{clock}</div></div></section>
<section class="section" id="sortimente">
  <div class="wrap">
    <span class="tag">{s_tag}</span>
    <h2>{s_h}</h2>
    <div class="packs two coz-sort">{k1}{k2}</div>
    <p class="coz-note">{s_note}</p>
  </div>
</section>
<section class="section mist" id="cum">
  <div class="wrap">
    <span class="tag blue">{c_tag}</span>
    <h2>{c_h}</h2>
    <ol class="steps">{steps}</ol>
    <p class="coz-proverb">{prov}</p>
  </div>
</section>
<section class="section" id="bucatarie">
  <div class="wrap">
    <span class="tag teal">{g_tag}</span>
    <h2>{g_h}</h2>
    <div class="coz-gal">{gal}</div>
  </div>
</section>
<section class="section mist" id="comanda">
  <div class="wrap">
    <span class="tag">{f_tag}</span>
    <h2>{f_h}</h2>
    <p class="lead">{f_lead}</p>
    <div class="cta-row"><a class="btn btn-blue" href="{wa}" target="_blank" rel="noopener">{cta1}</a><a class="btn btn-ghost on-light" href="tel:+40790827426">{f_b2}</a></div>
  </div>
</section>
</main>'''.format(wa=WA, clock=clock(t), k1=pack(t['p1'], '75', t['s1']), k2=pack(t['p2'], '90', t['s2'], ' hi'), steps=steps, gal=gal,
                 **{k: v for k, v in t.items() if isinstance(v, str)})


def cut_div(s, start):
    """Scoate blocul <div ...>...</div> care începe la poziția start."""
    i, depth = start, 0
    for m in re.finditer(r'<div\b|</div>', s[start:]):
        depth += 1 if m.group(0) != '</div>' else -1
        if depth == 0:
            return s[:start] + s[start + m.end():]
    return s


def cut_section(s, sid):
    m = re.search(r'<section\b[^>]*\bid="%s"[^>]*>' % sid, s)
    if not m:
        return s
    e = s.index('</section>', m.start()) + len('</section>')
    return s[:m.start()] + s[e:]


def page(lang):
    t = T[lang]
    d = '' if lang == 'ro' else 'en/'
    s = rd(d + 'proiecte.html')
    url_old, url_new = 'https://jci-brasov.com/' + d + 'proiecte', 'https://jci-brasov.com/' + d + 'cozonaci'
    s = s.replace('https://jci-brasov.com/proiecte', 'https://jci-brasov.com/cozonaci').replace('https://jci-brasov.com/en/proiecte', 'https://jci-brasov.com/en/cozonaci')
    old_title = re.search(r'<title>(.*?)</title>', s).group(1)
    old_desc = re.search(r'<meta name="description" content="(.*?)">', s).group(1)
    s = s.replace(old_title, t['title']).replace(old_desc, t['desc'])
    s = re.sub(r'https://jci-brasov\.com/assets/img/og-jci-brasov(-en)?\.jpg', 'https://jci-brasov.com/assets/img/cozonaci/og-cozonaci.jpg', s)
    s = re.sub(r'(<meta property="og:image:height" content=")\d+', r'\g<1>630', s)
    s = re.sub(r'(<meta property="og:image:alt" content=")[^"]*', r'\g<1>' + t['valt'], s)
    s = re.sub(r'<script type="application/ld\+json">.*?</script>',
               '<script type="application/ld+json">{"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "JCI Brașov", "item": "https://jci-brasov.com/%s"}, {"@type": "ListItem", "position": 2, "name": "%s", "item": "%s"}]}</script>' % (d, t['h1'], url_new),
               s, count=1, flags=re.S)
    css_v, js_v = ver(CSS), ver(JS)
    s = s.replace('</head>', '<link rel="stylesheet" href="/assets/css/cozonaci.css?v=%s">\n<link rel="preload" as="image" href="/assets/img/cozonaci/babka-poster.webp" fetchpriority="high">\n<script src="/assets/js/cozonaci.js?v=%s" defer></script>\n</head>' % (css_v, js_v), 1)
    s = re.sub(r'<main>.*?</main>', lambda m: main_html(t, ''), s, count=1, flags=re.S)
    s = s.replace(' aria-current="page"', '')
    wr(d + 'cozonaci.html', s)


def nav(s, lang, name):
    t = T[lang]
    old = 'Eveniment' if lang == 'ro' else 'Event'
    for pre in ('', '/'):
        s = s.replace('<li><a href="%seveniment">%s</a></li>' % (pre, old), '<li><a href="%seveniment">%s</a></li>' % (pre, t['events']))
        s = s.replace('<li><a href="%seveniment" aria-current="page">%s</a></li>' % (pre, old), '<li><a href="%seveniment" aria-current="page">%s</a></li>' % (pre, t['events']))
    if '>%s</a></li><li><a href="' % t['nav'] not in s and 'cozonaci">%s</a></li>' % t['nav'] not in s:
        s = re.sub(r'<li><a href="(/?)eveniment"( aria-current="page")?>(?=%s</a>)' % t['events'], lambda m: '<li><a href="%scozonaci">%s</a></li>' % (m.group(1), t['nav']) + m.group(0), s)
    if name == 'cozonaci.html':
        s = s.replace('cozonaci">%s</a></li>' % t['nav'], 'cozonaci" aria-current="page">%s</a></li>' % t['nav'])
    # subsol
    for old_f in ('Evenimentul din 26 noiembrie', 'The 26 November event'):
        s = re.sub(r'<li><a href="(/?)eveniment">%s</a></li>' % re.escape(old_f),
                   lambda m: '<li><a href="%scozonaci">%s</a></li>\n        <li><a href="%seveniment">%s</a></li>' % (m.group(1), t['foot_coz'], m.group(1), t['foot_ev']), s)
    # asistentul
    s = re.sub(r'(<div id="jchat" data-hello=")[^"]*', lambda m: m.group(1) + t['hello'], s)
    s = re.sub(r'<div class="jc-sug">.*?</div>', lambda m: '<div class="jc-sug">' + ''.join('<button type="button">%s</button>' % q for q in t['sug']) + '</div>', s, count=1, flags=re.S)
    return s


OLD_CD = re.compile(r'<script>\(function\(\)\{var start=Date\.UTC\(2026,10,26.*?</script>\n?', re.S)


def home(lang):
    t = T[lang]
    d = '' if lang == 'ro' else 'en/'
    s = rd(d + 'index.html')
    s = re.sub(r'<a class="btn btn-blue" href="eveniment#rezerva">(Vino pe 26 noiembrie|Join us on 26 November)</a>', '<a class="btn btn-blue" href="cozonaci">%s</a>' % t['hero_cta'], s)
    dl = ''.join('\n        <dt>%s</dt><dd>%s</dd>' % x for x in t['t_dl'])
    ticket = ('<aside class="ticket" aria-label="%s">\n      <span class="tag">%s</span>\n      <div class="date"><b>3</b><span>%s</span></div>\n      <h2 class="as-h3t">%s</h2>\n      <dl>%s\n      </dl>\n      <a class="btn btn-blue" href="cozonaci">%s</a>\n    </aside>'
              % (t['t_aria'], t['t_tag'], t['t_date'], t['t_h'], dl, t['t_btn']))
    s = re.sub(r'<aside class="ticket".*?</aside>', lambda m: ticket, s, count=1, flags=re.S)
    cd = '<section class="countdown" aria-label="%s"><div class="wrap">%s<div class="cta-row"><a class="btn btn-blue" href="cozonaci">%s</a></div></div></div></section>' % (t['cd_aria'], clock(t), t['cd_btn'])
    s = re.sub(r'<section class="countdown".*?</section>', lambda m: cd, s, count=1, flags=re.S)
    tz = '<a class="teaser" href="cozonaci"><small>%s</small><h3>%s</h3><p>%s</p><span class="go">%s</span></a>' % t['tz']
    ev = '<a class="teaser" href="eveniment"><small>%s</small><h3>Beyond the Initiative</h3><p>%s</p><span class="go">%s</span></a>' % t['tz_ev']
    if 'class="teaser" href="cozonaci"' not in s:
        s = re.sub(r'<a class="teaser" href="eveniment">.*?</a>', lambda m: tz + '\n      ' + ev, s, count=1, flags=re.S)
        s = s.replace('<div class="teasers">', '<div class="teasers coz-four">', 1)
    s = s.replace(t['step_old'], t['step'])
    s = OLD_CD.sub('', s)
    s = re.sub(r'<script src="/assets/js/vip\.js[^>]*></script>\n?', '', s)
    if '/assets/js/cozonaci.js' not in s:
        s = s.replace('</head>', '<link rel="stylesheet" href="/assets/css/cozonaci.css?v=%s">\n<script src="/assets/js/cozonaci.js?v=%s" defer></script>\n</head>' % (ver(CSS), ver(JS)), 1)
    wr(d + 'index.html', s)


def event(lang):
    t = T[lang]
    d = '' if lang == 'ro' else 'en/'
    s = rd(d + 'eveniment.html')
    if 'class="ev-done"' in s:
        return
    old_title = re.search(r'<title>(.*?)</title>', s).group(1)
    old_desc = re.search(r'<meta name="description" content="(.*?)">', s).group(1)
    s = s.replace(old_title, t['e_title']).replace(old_desc, t['e_desc'])
    m = re.search(r'<!--toplive-->(<style>.*?</style>).*?<!--/toplive-->', s, re.S)
    top = ('<!--toplive-->%s<a class="ev-next" href="cozonaci">%s</a><div class="top-head"><span class="tag">%s</span><span class="tl-loc">%s</span><h1>JCI Brașov Beyond the Initiative</h1></div><p class="ev-done">%s</p><!--/toplive-->'
           % (m.group(1), t['e_next'], t['e_tag'], t['e_loc'], t['e_done']))
    s = s[:m.start()] + top + s[m.end():]
    for cls in ('<div class="countdown compact">', '<div class="cd-ctas"', '<div class="reg">'):
        i = s.find(cls)
        if i >= 0:
            s = cut_div(s, i)
    for sid in ('cu-ce-pleci', 'vip', 'rezerva', 'intrebari', 'formular-sponsor'):
        s = cut_section(s, sid)
    # pachetele de sponsorizare ale evenimentului: scoase; rămân partenerii
    a = s.find('<h2 style="margin-top:56px">')
    if a >= 0:
        b = s.index('</section>', a)
        s = s[:a] + '<p class="coz-note">%s</p>\n  </div>\n' % t['e_part'] + s[b:]
    s = re.sub(r'<a class="btn btn-blue sticky-cta"[^>]*>.*?</a>\n?', '', s)
    s = re.sub(r'<script type="application/ld\+json">(?:(?!</script>).)*"FAQPage".*?</script>\n?', '', s, flags=re.S)
    s = OLD_CD.sub('', s)
    for js in ('vip', 'formular'):
        s = re.sub(r'<script src="/assets/js/%s\.js[^>]*></script>\n?' % js, '', s)
    if '/assets/css/cozonaci.css' not in s:
        s = s.replace('</head>', '<link rel="stylesheet" href="/assets/css/cozonaci.css?v=%s">\n</head>' % ver(CSS), 1)
    wr(d + 'eveniment.html', s)


def sitemap():
    s = rd('sitemap.xml')
    if '/cozonaci' in s:
        return
    alt = '<xhtml:link rel="alternate" hreflang="ro" href="https://jci-brasov.com/cozonaci"/><xhtml:link rel="alternate" hreflang="en" href="https://jci-brasov.com/en/cozonaci"/>'
    add = ''.join('  <url><loc>https://jci-brasov.com/%scozonaci</loc><lastmod>2026-11-27</lastmod>%s</url>\n' % (d, alt) for d in ('', 'en/'))
    wr('sitemap.xml', s.replace('  <url><loc>https://jci-brasov.com/despre</loc>', add + '  <url><loc>https://jci-brasov.com/despre</loc>', 1))


def run():
    os.makedirs(P + 'assets/js', exist_ok=True)
    wr('assets/css/cozonaci.css', CSS + '.teasers.coz-four{grid-template-columns:repeat(4,1fr)}@media(max-width:1100px){.teasers.coz-four{grid-template-columns:1fr 1fr}}@media(max-width:640px){.teasers.coz-four{grid-template-columns:1fr}}\n')
    wr('assets/js/cozonaci.js', JS)
    for lang in ('ro', 'en'):
        event(lang)
        home(lang)
        page(lang)
        d = '' if lang == 'ro' else 'en/'
        for f in sorted(os.listdir(P + d)):
            if f.endswith('.html') and f != 'app.html':
                s = rd(d + f)
                n = nav(s, lang, f)
                if n != s:
                    wr(d + f, n)
    sitemap()
    print('cozonaci: gata')


if __name__ == '__main__':
    run()
