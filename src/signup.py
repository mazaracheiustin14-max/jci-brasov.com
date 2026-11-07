# Înscrieri la Beyond the Initiative: formular pe site (D1), contor, termen-limită, „Cu ce pleci”, întrebări frecvente,
# calendar și pagină de confirmare. Rulat din post.py după build.
import re
S='/home/claude/site/'
WA='https://chat.whatsapp.com/KAzFP6u8oMZDeslr1SfsNs'
MAPS='https://www.google.com/maps/search/?api=1&query=CATTIA+Bra%C8%99ov+Strada+Institutului+35'
GCAL=('https://calendar.google.com/calendar/render?action=TEMPLATE&text=JCI+Bra%C8%99ov+Beyond+the+Initiative'
      '&dates=20261126T150000Z/20261126T203000Z&location=CATTIA+Bra%C8%99ov%2C+Strada+Institutului+35%2C+Bra%C8%99ov'
      '&details=Evenimentul+de+lansare+JCI+Bra%C8%99ov.+https%3A%2F%2Fjci-brasov.com%2Feveniment')
ICS="""BEGIN:VCALENDAR\r
VERSION:2.0\r
PRODID:-//JCI Brasov//Beyond the Initiative//RO\r
CALSCALE:GREGORIAN\r
METHOD:PUBLISH\r
BEGIN:VEVENT\r
UID:beyond-2026@jci-brasov.com\r
DTSTAMP:20261106T100000Z\r
DTSTART:20261126T150000Z\r
DTEND:20261126T203000Z\r
SUMMARY:JCI Brașov Beyond the Initiative\r
LOCATION:CATTIA Brașov\\, Strada Institutului 35\\, Brașov\r
DESCRIPTION:Evenimentul de lansare JCI Brașov. Detalii: https://jci-brasov.com/eveniment\r
URL:https://jci-brasov.com/eveniment\r
BEGIN:VALARM\r
TRIGGER:-P1D\r
ACTION:DISPLAY\r
DESCRIPTION:Mâine: JCI Brașov Beyond the Initiative\r
END:VALARM\r
BEGIN:VALARM\r
TRIGGER:-PT2H\r
ACTION:DISPLAY\r
DESCRIPTION:În 2 ore: JCI Brașov Beyond the Initiative\r
END:VALARM\r
END:VEVENT\r
END:VCALENDAR\r
"""
T={'ro':dict(
 take_tag='Cu ce pleci acasă', take_h='O seară, trei câștiguri concrete',
 take=[('24+','contacte noi','Două sesiuni de Blitz Networking în grupuri mici, gândite ca să pleci cu oameni pe care chiar îi poți suna a doua zi.'),
       ('2','paneluri cu răspunsuri la întrebările tale','Întrebările trimise la înscriere ajung la moderatori și stau la baza discuțiilor cu invitații.'),
       ('1','comunitate care continuă după eveniment','Acces la comunitatea JCI Brașov: proiecte, traininguri și rețeaua JCI din peste 100 de țări.')],
 res_tag='Înscriere', res_h='Rezervă&#8209;ți locul',
 res_lead='Accesul este gratuit, dar locurile sunt limitate la capacitatea sălii. Înscrierea durează sub un minut.',
 cap='150 de locuri în sală', dl='Înscrierile se închid pe 24 noiembrie, ora 23:59.',
 stats='Până acum s-au înscris <b data-stat="count">0</b> participanți. Au mai rămas <b data-stat="left">150</b> locuri.',
 f_nume='Nume și prenume', f_email='Email', f_tel='Telefon', f_comp='Companie sau organizație', f_func='Funcție', f_prof='Te descrie cel mai bine',
 prof=['Antreprenor','Manager','Angajat','Student','Freelancer sau consultant','ONG sau sector public','Altul'], prof0='Alege',
 f_q='Ce întrebare ai pentru invitați?', f_q_ph='Opțional. Întrebările primite ajung la moderatorii panelurilor.',
 f_src='De unde ai aflat de eveniment?', src=['Instagram','Facebook','WhatsApp','LinkedIn','Recomandare','JCI România','Altă sursă'],
 opt='opțional',
 acord='Sunt de acord ca JCI Brașov să folosească aceste date pentru organizarea evenimentului și pentru a mă contacta în legătură cu participarea.',
 mkt='Vreau să primesc invitații la următoarele evenimente JCI Brașov.',
 submit='Rezervă-mi locul gratuit', busy='Se trimite…', more='Adaugă detalii despre tine (opțional)', trust='Fără costuri și fără spam. Primești confirmarea imediat.', sticky='Rezervă-ți locul gratuit', hero_cta='Rezervă-ți locul gratuit', closed='Înscrierile s-au închis. Pentru locuri rămase, scrie-ne la contact@jci-brasov.com.',
 cal='Adaugă în calendar', gcal='Google Calendar', ics='Telefon sau Outlook', map='Deschide în Google Maps',
 faq_tag='Întrebări frecvente', faq_h='Ce trebuie să știi',
 faq=[('Cât costă participarea?','Nimic. Accesul este gratuit, iar evenimentul este susținut integral de parteneri. Înscrierea este necesară pentru a-ți păstra locul.'),
      ('Trebuie să fiu membru JCI?','Nu. Evenimentul este deschis tuturor celor interesați de antreprenoriat, leadership și comunitate.'),
      ('Am peste 40 de ani. Pot veni?','Da. Membrii JCI au între 18 și 40 de ani, dar la eveniment sunt bineveniți toți: antreprenori, mentori, parteneri.'),
      ('Pot veni cu un coleg?','Da, cu condiția ca fiecare participant să se înscrie separat, ca să avem locurile și ecusoanele pregătite.'),
      ('Ce se întâmplă dacă se ocupă toate locurile?','Înscrierile primite după ocuparea sălii intră pe lista de așteptare și te anunțăm dacă se eliberează un loc.'),
      ('Unde are loc și cum ajung?','La CATTIA Brașov, Strada Institutului 35. Programul începe la 17:00, cu primirea invitaților și înregistrarea.'),
      ('Ce se întâmplă cu datele mele?','Le folosim doar pentru organizarea evenimentului și, dacă ai bifat, pentru invitații la evenimentele JCI Brașov. Nu le transmitem altor organizații.')],
 cta_index='Rezervă-ți locul', conf_title='Înscriere confirmată | JCI Brașov'),
'en':dict(
 take_tag='What you take home', take_h='One evening, three concrete gains',
 take=[('24+','new contacts','Two Blitz Networking sessions in small groups, designed so you leave with people you can actually call the next day.'),
       ('2','panels that answer your questions','The questions you send when registering go to the moderators and shape the panel discussions.'),
       ('1','community that continues after the event','Access to the JCI Brașov community: projects, training and the JCI network in more than 100 countries.')],
 res_tag='Registration', res_h='Save your seat',
 res_lead='Entry is free, but seats are limited to the capacity of the room. Registration takes less than a minute.',
 cap='150 seats in the room', dl='Registration closes on 24 November at 23:59.',
 stats='<b data-stat="count">0</b> people have registered so far. <b data-stat="left">150</b> seats left.',
 f_nume='Full name', f_email='Email', f_tel='Phone', f_comp='Company or organisation', f_func='Job title', f_prof='Best describes you',
 prof=['Entrepreneur','Manager','Employee','Student','Freelancer or consultant','NGO or public sector','Other'], prof0='Choose',
 f_q='What would you like to ask the speakers?', f_q_ph='Optional. Questions go to the panel moderators.',
 f_src='How did you hear about the event?', src=['Instagram','Facebook','WhatsApp','LinkedIn','Referral','JCI Romania','Other'],
 opt='optional',
 acord='I agree that JCI Brașov may use this data to organise the event and to contact me about my attendance.',
 mkt='I would like to receive invitations to future JCI Brașov events.',
 submit='Save my free seat', busy='Sending…', more='Add details about yourself (optional)', trust='No cost and no spam. You get confirmation straight away.', sticky='Save your free seat', hero_cta='Save your free seat', closed='Registration is closed. For remaining seats, email contact@jci-brasov.com.',
 cal='Add to calendar', gcal='Google Calendar', ics='Phone or Outlook', map='Open in Google Maps',
 faq_tag='FAQ', faq_h='Good to know',
 faq=[('How much does it cost?','Nothing. Entry is free and the event is fully funded by our partners. Registration is required to hold your seat.'),
      ('Do I need to be a JCI member?','No. The event is open to anyone interested in entrepreneurship, leadership and community.'),
      ('I am over 40. Can I attend?','Yes. JCI members are aged 18 to 40, but everyone is welcome at the event: entrepreneurs, mentors and partners.'),
      ('Can I bring a colleague?','Yes, as long as each person registers separately so we can prepare seats and badges.'),
      ('What if all seats are taken?','Registrations received after the room is full go on a waiting list, and we will let you know if a seat becomes available.'),
      ('Where is it and how do I get there?','At CATTIA Brașov, Strada Institutului 35. The programme starts at 5:00 pm with arrivals and check-in.'),
      ('What happens to my data?','We use it only to organise the event and, if you opted in, to invite you to future JCI Brașov events. We do not share it with other organisations.')],
 cta_index='Save your seat', conf_title='Registration confirmed | JCI Brașov')}
CSS="""
/* înscrieri eveniment */
.take{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:40px}
@media(max-width:860px){.take{grid-template-columns:1fr}}
.take li{list-style:none;border-radius:20px;padding:28px;border:1px solid var(--line);background:radial-gradient(120% 90% at 0% 0%,rgba(0,151,215,.16),transparent 55%),var(--card,#14113A)}
.take ol,.take{padding:0}
.take .big{display:block;font-size:64px;font-weight:800;line-height:1;letter-spacing:-.03em;color:#fff}
.take b{display:block;font-size:20px;margin-top:8px}
.take p{color:var(--soft,#B9BBD6);font-size:15px;margin-top:8px}
.res{display:grid;grid-template-columns:.9fr 1.1fr;grid-template-areas:"head form" "meta form";column-gap:48px;row-gap:0;align-items:start}
.res-head{grid-area:head}.res .signup{grid-area:form}.res-meta{grid-area:meta}
@media(max-width:900px){.res{grid-template-columns:1fr;grid-template-areas:"head" "form" "meta";row-gap:24px}}
.res .res-meta .stat{margin-top:0}
details.more{border:1px dashed rgba(255,255,255,.2);border-radius:12px;padding:12px 14px}
details.more summary{cursor:pointer;font-weight:600;color:#7FCDEE}
details.more[open]{display:grid;gap:16px}
.sticky-cta{position:fixed;left:12px;right:12px;bottom:12px;z-index:60;display:none;text-align:center;box-shadow:0 12px 40px -10px rgba(0,0,0,.6)}
@media(max-width:900px){.sticky-cta.on{display:block}}
.cd-cta{margin:4px 0 28px}
.res{grid-template-rows:auto 1fr}
@media(max-width:900px){.res{grid-template-rows:auto}}
.res-info .stat{margin-top:24px;border:1px solid var(--line);border-radius:18px;padding:22px 24px;background:rgba(0,151,215,.08)}
.res-info .stat b{color:#fff;font-size:1.25em;font-variant-numeric:tabular-nums}
.res-info .stat p+p{margin-top:8px}
.res-info .meter{height:10px;border-radius:999px;background:rgba(255,255,255,.1);margin-top:14px;overflow:hidden}
.res-info .meter i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--teal),var(--blue));transition:width .6s ease}
.res-info .dl{color:#FFE27A;font-weight:600;margin-top:14px}
.res-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.res-links a{display:inline-flex;align-items:center;gap:8px;padding:11px 16px;border:1px solid rgba(255,255,255,.22);border-radius:999px;color:#fff;text-decoration:none;font-size:15px;font-weight:600}
.res-links a:hover{border-color:var(--blue)}
form.signup .req{color:#FFB4A8}
form.signup .optl{font-weight:400;color:var(--soft,#B9BBD6);font-size:13px}
form.signup .closed{background:#3A3200;color:#FFF3B8;border-radius:12px;padding:14px 16px}
.faq{max-width:860px;margin:36px auto 0}
.faq details{border-bottom:1px solid var(--line);padding:18px 4px}
.faq summary{cursor:pointer;font-weight:700;font-size:18px;list-style:none;display:flex;justify-content:space-between;gap:16px}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";color:var(--blue);font-size:26px;line-height:1}
.faq details[open] summary::after{content:"–"}
.faq p{color:var(--soft,#B9BBD6);margin-top:10px}
.cd-stats{margin-top:6px;color:rgba(255,255,255,.85)}
.cd-stats b{color:#fff}
.conf{max-width:760px;margin:0 auto;text-align:center}
.conf .res-links{justify-content:center}
.conf .lead{margin-inline:auto}
"""
JS_STATS="""<script>(function(){var els=document.querySelectorAll('[data-stats]');if(!els.length)return;
fetch('/api/stats',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
els.forEach(function(el){if(d.count>=20){el.querySelectorAll('[data-stat="count"]').forEach(function(e){e.textContent=d.count});
el.querySelectorAll('[data-stat="left"]').forEach(function(e){e.textContent=d.left});el.hidden=false;}
var m=el.querySelector('.meter i');if(m&&d.count>=20)m.style.width=Math.min(100,Math.round(d.count/d.capacity*100))+'%';});
if(d.closed){document.querySelectorAll('form[data-event]').forEach(function(f){f.querySelectorAll('input,select,textarea,button').forEach(function(x){x.disabled=true});var c=f.querySelector('.closed');if(c)c.hidden=false;});}
}).catch(function(){});})();</script>"""
def opt_list(items,first=None):
    o=(f'<option value="">{first}</option>' if first else '')
    return o+''.join(f'<option>{x}</option>' for x in items)
def sections(lang):
    t=T[lang]; pre='/en' if lang=='en' else ''
    take=''.join(f'<li><span class="big">{a}</span><b>{b}</b><p>{c}</p></li>' for a,b,c in t['take'])
    faq=''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q,a in t['faq'])
    form=f'''<form class="signup" method="POST" action="/api/inscriere" data-event>
      <input type="hidden" name="limba" value="{lang}">
      <input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p class="closed" hidden>{t['closed']}</p>
      <div class="field"><label for="i-nume">{t['f_nume']} <span class="req" aria-hidden="true">*</span></label><input id="i-nume" name="nume" required minlength="3" maxlength="120" autocomplete="name"></div>
      <div class="row2">
        <div class="field"><label for="i-email">{t['f_email']} <span class="req" aria-hidden="true">*</span></label><input id="i-email" name="email" type="email" required maxlength="160" autocomplete="email" inputmode="email"></div>
        <div class="field"><label for="i-tel">{t['f_tel']} <span class="req" aria-hidden="true">*</span></label><input id="i-tel" name="telefon" type="tel" required minlength="9" maxlength="40" autocomplete="tel" inputmode="tel"></div>
      </div>
      <div class="field"><label for="i-q">{t['f_q']}</label><textarea id="i-q" name="intrebare" rows="2" maxlength="1500" placeholder="{t['f_q_ph']}"></textarea></div>
      <details class="more"><summary>{t['more']}</summary>
      <div class="row2">
        <div class="field"><label for="i-comp">{t['f_comp']} <span class="optl">({t['opt']})</span></label><input id="i-comp" name="companie" maxlength="160" autocomplete="organization"></div>
        <div class="field"><label for="i-func">{t['f_func']} <span class="optl">({t['opt']})</span></label><input id="i-func" name="functie" maxlength="120" autocomplete="organization-title"></div>
      </div>
      <div class="row2">
        <div class="field"><label for="i-prof">{t['f_prof']}</label><select id="i-prof" name="profil">{opt_list(t['prof'],t['prof0'])}</select></div>
        <div class="field"><label for="i-src">{t['f_src']}</label><select id="i-src" name="sursa">{opt_list(t['src'],t['prof0'])}</select></div>
      </div>
      </details>
      <label class="check"><input type="checkbox" name="acord" value="da" required><span>{t['acord']}</span></label>
      <label class="check"><input type="checkbox" name="acord_marketing" value="da"><span>{t['mkt']}</span></label>
      <button class="btn btn-blue" type="submit" data-busy="{t['busy']}">{t['submit']}</button>
      <p class="form-note">{t['trust']}</p>
    </form>'''
    info=f'''<div class="res-info res-head">
      <span class="tag blue">{t['res_tag']}</span>
      <h2>{t['res_h']}</h2>
      <p class="lead">{t['res_lead']}</p>
    </div>
    <div class="res-info res-meta"><div class="stat"><p><b>{t['cap']}</b></p><div data-stats hidden><p>{t['stats']}</p><div class="meter"><i></i></div></div><p class="dl">{t['dl']}</p></div>
      <div class="res-links"><a href="{GCAL}" target="_blank" rel="noopener">{t['cal']}: {t['gcal']}</a><a href="/assets/beyond-the-initiative.ics">{t['ics']}</a><a href="{MAPS}" target="_blank" rel="noopener">{t['map']}</a></div>
    </div>'''
    return (f'<section class="section" id="cu-ce-pleci"><div class="wrap"><span class="tag teal">{t["take_tag"]}</span><h2>{t["take_h"]}</h2><ol class="take">{take}</ol></div></section>'
            f'<section class="section mist" id="rezerva"><div class="wrap res">{info.split("<div class=\"res-info res-meta\">")[0]}{form}<div class="res-info res-meta">{info.split("<div class=\"res-info res-meta\">")[1]}</div></section>'
            f'<section class="section" id="intrebari"><div class="wrap"><span class="tag teal">{t["faq_tag"]}</span><h2>{t["faq_h"]}</h2><div class="faq">{faq}</div></div></section>')
CONF={'ro':dict(h='Locul tău este rezervat',lead='Mulțumim pentru înscriere. Te așteptăm joi, 26 noiembrie 2026, de la ora 17:00, la CATTIA Brașov.',
  wa='Intră în comunitatea evenimentului pe WhatsApp: acolo anunțăm programul final, invitații și noutățile.',wab='Intră în comunitatea WhatsApp',
  asteptare=('Ești pe lista de așteptare','Sala este momentan plină. Te-am trecut pe lista de așteptare și te anunțăm imediat ce se eliberează un loc.'),
  deja=('Ești deja înscris','Avem deja o înscriere cu această adresă de email. Locul tău rămâne rezervat.'),
  inchis=('Înscrierile s-au închis','Termenul de înscriere a trecut. Scrie-ne la contact@jci-brasov.com și verificăm dacă mai sunt locuri disponibile.'),
  back='Înapoi la pagina evenimentului',share='Invită un prieten: trimite-i linkul jci-brasov.com/eveniment'),
 'en':dict(h='Your seat is reserved',lead='Thank you for registering. See you on Thursday, 26 November 2026, from 5:00 pm at CATTIA Brașov.',
  wa='Join the event community on WhatsApp, where we share the final programme, speakers and updates.',wab='Join the WhatsApp community',
  asteptare=('You are on the waiting list','The room is currently full. We have added you to the waiting list and will let you know as soon as a seat becomes available.'),
  deja=('You are already registered','We already have a registration with this email address. Your seat remains reserved.'),
  inchis=('Registration is closed','The registration deadline has passed. Email contact@jci-brasov.com and we will check whether seats are still available.'),
  back='Back to the event page',share='Invite a friend: send them jci-brasov.com/en/eveniment')}
def conf_page(lang):
    t=T[lang]; c=CONF[lang]; pre='en/' if lang=='en' else ''
    base=open(S+pre+'multumim.html',encoding='utf-8').read()
    i=base.index('<main'); j=base.index('</main>')+len('</main>')
    msgs=_json(dict(asteptare=c['asteptare'],deja=c['deja'],inchis=c['inchis']))
    main=f'''<main id="main"><section class="section"><div class="wrap conf">
  <span class="tag">Beyond the Initiative</span>
  <h1 class="as-h2" id="c-h">{c['h']}</h1>
  <p class="lead" id="c-p">{c['lead']}</p>
  <p class="lead" style="font-size:17px">{c['wa']}</p>
  <div class="cta-row" style="justify-content:center"><a class="btn btn-blue" href="{WA}" target="_blank" rel="noopener">{c['wab']}</a></div>
  <div class="res-links"><a href="{GCAL}" target="_blank" rel="noopener">{t['cal']}: {t['gcal']}</a><a href="/assets/beyond-the-initiative.ics">{t['ics']}</a><a href="{MAPS}" target="_blank" rel="noopener">{t['map']}</a></div>
  <p class="lead" style="font-size:16px;margin-top:28px">{c['share']}</p>
  <p style="margin-top:20px"><a href="{'/en/' if lang=='en' else '/'}eveniment">{c['back']}</a></p>
</div></section></main>
<script>(function(){{var m={msgs};var s=new URLSearchParams(location.search).get('s');if(m[s]){{document.getElementById('c-h').textContent=m[s][0];document.getElementById('c-p').textContent=m[s][1];}}}})();</script>'''
    out=base[:i]+main+base[j:]
    out=re.sub(r'<title>.*?</title>',f'<title>{t["conf_title"]}</title>',out,count=1)
    out=out.replace('multumim.html"','inscriere-confirmata.html"')
    open(S+pre+'inscriere-confirmata.html','w',encoding='utf-8').write(out)
def _json(d):
    import json; return json.dumps(d,ensure_ascii=False)
JS_UX="""<script>(function(){
var f=document.querySelector('form[data-event]');
if(f){f.addEventListener('submit',function(){var b=f.querySelector('button[type=submit]');if(b&&f.checkValidity()){b.disabled=true;b.textContent=b.dataset.busy;}});}
var st=document.querySelector('.sticky-cta');if(!st)return;var target=document.getElementById('rezerva');
function upd(){var y=window.scrollY,show=y>500;if(target){var r=target.getBoundingClientRect();if(r.top<window.innerHeight&&r.bottom>0)show=false;}
var ft=document.querySelector('footer');if(ft&&ft.getBoundingClientRect().top<window.innerHeight)show=false;st.classList.toggle('on',show);}
window.addEventListener('scroll',upd,{passive:true});upd();})();</script>"""
def run():
    open(S+'assets/beyond-the-initiative.ics','w',encoding='utf-8',newline='').write(ICS)
    for lang,pre in (('ro',''),('en','en/')):
        t=T[lang]
        # pagina evenimentului
        p=S+pre+'eveniment.html'; s=open(p,encoding='utf-8').read()
        if 'id="rezerva"' not in s:
            s=s.replace('<section class="section mist" id="parteneri">',sections(lang)+'<section class="section mist" id="parteneri">',1)
            # blocul .reg: butonul de WhatsApp devine buton spre formular
            i=s.index('<div class="reg">'); j=s.index('</a>',i)+4
            k=s.index('<a class="btn btn-blue"',i)
            s=s[:k]+f'<a class="btn btn-blue" href="#rezerva">{t["cta_index"]}</a>'+s[j:]
            s=s.replace('Invitațiile se trimit membrilor comunității de WhatsApp a evenimentului. Intră acum în comunitate și rezervă-ți locul.',
                        'Completează formularul de înscriere și primești imediat confirmarea locului.')
            s=s.replace("Invitations are sent to members of the event's WhatsApp community. Join now to secure your seat.",
                        'Complete the registration form and your seat is confirmed straight away.')
            s=s.replace('<div class="event-head">',f'<a class="btn btn-blue cd-cta" href="#rezerva">{t["hero_cta"]}</a>\n    <div class="event-head">',1)
            s=s.replace('</body>',f'<a class="btn btn-blue sticky-cta" href="#rezerva">{t["sticky"]}</a>\n'+JS_STATS+JS_UX+'\n</body>',1)
            open(p,'w',encoding='utf-8').write(s)
        # prima pagină: cardul evenimentului și cronometrul duc la formular
        p=S+pre+'index.html'; s=open(p,encoding='utf-8').read()
        for lbl in ('Înscrie-te prin WhatsApp','Register via WhatsApp','Rezervă-ți locul','Save your seat'):
            s=s.replace(f'<a class="btn btn-blue" href="{WA}" target="_blank" rel="noopener">{lbl}</a>',f'<a class="btn btn-blue" href="eveniment.html#rezerva">{t["cta_index"]}</a>')
        s=s.replace('href="eveniment.html">Vino pe 26 noiembrie','href="eveniment.html#rezerva">Vino pe 26 noiembrie').replace('href="eveniment.html">Join us on 26 November','href="eveniment.html#rezerva">Join us on 26 November')
        if 'sticky-cta' not in s:
            s=s.replace('</body>',f'<a class="btn btn-blue sticky-cta" href="eveniment.html#rezerva">{t["sticky"]}</a>\n'+JS_UX+'\n</body>',1)
        if 'data-stats' not in s:
            s=s.replace('<p class="cd-date">',f'<p class="cd-stats" data-stats hidden>{t["stats"]}</p><p class="cd-date">',1)
            s=s.replace('</body>',JS_STATS+'\n</body>',1)
        open(p,'w',encoding='utf-8').write(s)
        conf_page(lang)
    css=S+'assets/css/style.css'; c=open(css,encoding='utf-8').read()
    if 'înscrieri eveniment' not in c: open(css,'a',encoding='utf-8').write(CSS)
