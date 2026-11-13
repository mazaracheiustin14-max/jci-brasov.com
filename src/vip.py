# Bilet VIP (7 nov 2026). Rulează după deploy.py și înainte de security.py:  python3 src/vip.py
# - scoate Acces VIP din pachetele de sponsorizare (și din formularul de sponsori);
# - secțiunea #vip pe pagina evenimentului: comparație Gratuit / VIP, contor de locuri în timp real, buton Stripe;
# - butoane VIP lângă butoanele de înscriere (pagina evenimentului și prima pagină);
# - pagina vip-confirmat (RO/EN), unde ajunge cumpărătorul după plată.
# Contorul citește /api/stats (câmpul vip) prin /assets/js/vip.js. Idempotent.
import os, re

R = '/home/claude/jci-brasov.com/'
P = R + 'public/'
STRIPE = 'https://buy.stripe.com/4gM7sL2iD4a3eype1v3wQ05'
TOTAL, PRESOLD = 40, 15  # trebuie să coincidă cu VIP_TOTAL și VIP_PRESOLD din worker/index.js

CSS = '''<style>
.vip-sec{background:radial-gradient(900px 500px at 85% 0%,rgba(239,196,15,.10),transparent 70%)}
.vip-grid{display:grid;grid-template-columns:1fr 1.15fr;gap:20px;margin-top:40px;align-items:stretch}
.vip-card{background:var(--card,#14113A);border:1px solid rgba(255,255,255,.10);border-radius:20px;padding:30px;display:flex;flex-direction:column;position:relative}
.vip-card.gold{border:2px solid var(--yellow,#EFC40F);box-shadow:0 30px 80px -40px rgba(239,196,15,.55)}
.vip-card small{font-weight:700;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--teal,#57BCBC)}
.vip-card.gold small{color:var(--yellow,#EFC40F)}
.vip-card .price{font-size:44px;font-weight:800;margin:6px 0 4px;font-variant-numeric:tabular-nums}
.vip-card .price span{font-size:18px;font-weight:600;color:var(--muted,#A9ABC8)}
.vip-card ul{list-style:none;margin:14px 0 0;padding:0;font-size:15px;color:var(--soft,#B9BBD6)}
.vip-card li{padding:9px 0 9px 28px;border-top:1px solid rgba(255,255,255,.08);position:relative}
.vip-card li::before{content:"";position:absolute;left:4px;top:16px;width:10px;height:10px;border-radius:50%;background:var(--teal,#57BCBC)}
.vip-card.gold li::before{background:var(--yellow,#EFC40F)}
.vip-card li.all{color:#fff;font-weight:600}.vip-card li.all::before{display:none}.vip-card li.all{padding-left:0}
.vip-card .sp{flex:1;min-height:22px}
.vip-card .btn{justify-content:center;width:100%}
.btn-gold{background:var(--yellow,#EFC40F);color:var(--ink,#130F2D)}.btn-gold:hover{background:#ffd52e}
.btn-gold[aria-disabled=true]{background:rgba(255,255,255,.15);color:rgba(255,255,255,.6);pointer-events:none}
.vip-ribbon{position:absolute;top:-14px;right:24px;background:var(--yellow,#EFC40F);color:var(--ink,#130F2D);font-weight:800;font-size:12px;letter-spacing:.12em;text-transform:uppercase;padding:6px 12px;border-radius:999px}
.vip-live{margin-top:22px;background:rgba(239,196,15,.07);border:1px solid rgba(239,196,15,.25);border-radius:14px;padding:16px 18px}
.vip-live .vl-top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:15px;color:#fff}
.vip-live .vl-top b{color:var(--yellow,#EFC40F);font-size:20px}
.vip-live .meter{height:10px;border-radius:999px;background:rgba(255,255,255,.1);margin-top:12px;overflow:hidden}
.vip-live .meter i{display:block;height:100%;background:linear-gradient(90deg,#f5a524,var(--yellow,#EFC40F));transition:width .8s ease}
.vip-live .vl-foot{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:10px;font-size:13px;color:var(--soft,#B9BBD6)}
.vip-dot{display:inline-flex;align-items:center;gap:7px}
.vip-dot::before{content:"";width:8px;height:8px;border-radius:50%;background:#3ddc84;box-shadow:0 0 0 0 rgba(61,220,132,.6);animation:vipPulse 1.8s infinite}
@keyframes vipPulse{0%{box-shadow:0 0 0 0 rgba(61,220,132,.6)}70%{box-shadow:0 0 0 8px rgba(61,220,132,0)}100%{box-shadow:0 0 0 0 rgba(61,220,132,0)}}
.vip-card .note{margin:12px 0 0;font-size:13px;color:var(--muted,#A9ABC8)}
.vip-hint{margin-top:14px;font-size:15px}.vip-hint a{color:var(--yellow,#EFC40F);font-weight:600}
.vip-bump{animation:vipBump .6s ease}@keyframes vipBump{50%{transform:scale(1.25)}}
@media (max-width:900px){.vip-grid{grid-template-columns:1fr}.vip-card.gold{order:-1}}
@media (prefers-reduced-motion:reduce){.vip-dot::before,.vip-bump{animation:none}}
</style>'''

T = {
    'ro': dict(
        tag='Bilet VIP', h2='Trăiește seara din primul rând',
        lead='Participarea gratuită îți asigură locul în sală. Biletul VIP îți oferă experiența completă: cel mai bun loc, acces direct la invitați și o seară gândită în detaliu.',
        free='Acces gratuit', cur='lei',
        free_li=['Loc în sală, în limita celor 150 de locuri', 'Cele două paneluri ale serii', 'Sesiunile de Blitz Networking', 'Comunitatea evenimentului pe WhatsApp', 'Tot ce se oferă la standul Hillden'],
        free_btn='Înscrie-te gratuit', free_bar='Consumația de la bar se achită separat.', ribbon='Locuri limitate',
        vip='Acces VIP', all='Tot ce include accesul gratuit, plus:',
        vip_li=['Locuri rezervate în primele rânduri', 'Întâlnire directă cu invitații din paneluri', 'Acces prioritar la sesiunile de networking', 'Networking curatoriat: la Blitz Networking ești așezat la masă cu participanți din domeniile tale de interes, în funcție de profilul participanților prezenți', 'Degustare de vin și preparate culinare'],
        left='locuri VIP disponibile', sold='din %d ocupate' % TOTAL, live='Actualizat în timp real',
        buy='Cumpără biletul VIP', note='Plata se face online, cu cardul, prin Stripe. Băuturile comandate de la bar se achită separat.',
        hint='Vrei loc în primele rânduri? Vezi biletul VIP', cd='Bilet VIP, 200 lei',
        home_line='Bilete VIP: <b data-vip="left">%d</b> locuri rămase din %d',
    ),
    'en': dict(
        tag='VIP ticket', h2='Experience the evening from the front row',
        lead='Free registration secures your seat in the room. The VIP ticket gives you the full experience: the best seats, direct access to the speakers and an evening curated in every detail.',
        free='Free access', cur='RON',
        free_li=['A seat in the room, within the 150-seat capacity', 'Both panels of the evening', 'The Blitz Networking sessions', 'The event community on WhatsApp', 'Everything offered at the Hillden stand'],
        free_btn='Register for free', free_bar='Drinks from the bar are paid separately.', ribbon='Limited seats',
        vip='VIP access', all='Everything in free access, plus:',
        vip_li=['Reserved front-row seating', 'Direct meeting with the panel speakers', 'Priority access to the networking sessions', 'Curated networking: at Blitz Networking you are seated with participants from your fields of interest, depending on the profile of those attending', 'Wine and food tasting'],
        left='VIP seats available', sold='of %d taken' % TOTAL, live='Updated in real time',
        buy='Buy the VIP ticket', note='Secure online card payment via Stripe. Drinks ordered at the bar are paid separately.',
        hint='Want a front-row seat? See the VIP ticket', cd='VIP ticket, 200 RON',
        home_line='VIP tickets: <b data-vip="left">%d</b> of %d seats left',
    ),
}


def section(l):
    t = T[l]
    pct = round(PRESOLD * 100 / TOTAL, 1)
    li = lambda xs: ''.join('<li>%s</li>' % x for x in xs)
    return ('<section class="section vip-sec" id="vip">' + CSS + '<div class="wrap">'
            '<span class="tag">%s</span><h2>%s</h2><p class="lead">%s</p><div class="vip-grid">' % (t['tag'], t['h2'], t['lead']) +
            '<div class="vip-card"><small>%s</small><div class="price">0 <span>%s</span></div><ul>%s</ul><p class="note">%s</p><div class="sp"></div>'
            '<a class="btn btn-ghost" href="#rezerva">%s</a></div>' % (t['free'], t['cur'], li(t['free_li']), t['free_bar'], t['free_btn']) +
            '<div class="vip-card gold"><span class="vip-ribbon">%s</span><small>%s</small><div class="price">200 <span>%s</span></div>'
            '<ul><li class="all">%s</li>%s</ul>' % (t['ribbon'], t['vip'], t['cur'], t['all'], li(t['vip_li'])) +
            '<div class="vip-live" data-vipbox><div class="vl-top"><span><b data-vip="left">%d</b> %s</span><span><b data-vip="sold">%d</b> %s</span></div>'
            '<div class="meter"><i data-vip="bar" style="width:%s%%"></i></div>'
            '<div class="vl-foot"><span class="vip-dot">%s</span><span data-vip="last" hidden></span></div></div>' % (TOTAL - PRESOLD, t['left'], PRESOLD, t['sold'], pct, t['live']) +
            '<div class="sp"></div><a class="btn btn-gold" data-vip="buy" href="%s" rel="noopener">%s</a><p class="note">%s</p></div>' % (STRIPE, t['buy'], t['note']) +
            '</div></div></section>')




def rd(p): return open(p, encoding='utf-8').read()
def wr(p, s): open(p, 'w', encoding='utf-8').write(s)


def event_page(l):
    p = P + ('en/' if l == 'en' else '') + 'eveniment.html'
    s = rd(p)
    t = T[l]
    # 1) VIP scos din pachetele de sponsorizare și din formularul de sponsori
    s = re.sub(r'\s*<div class="pack"><small>(?:Acces VIP|VIP Access)</small>.*?</ul>(?:<p [^>]*>[^<]*</p><div [^>]*></div><a [^>]*>[^<]*</a>)?</div>', '', s, count=1, flags=re.S)
    s = s.replace('<option>Acces VIP, 200 lei</option>', '').replace('<option>VIP Access, 200 RON</option>', '')
    if '<div class="packs two">' not in s:
        s = s.replace('<div class="packs">', '<style>.packs.two{grid-template-columns:repeat(2,1fr)}@media (max-width:900px){.packs.two{grid-template-columns:1fr}}</style><div class="packs two">', 1)
    # 2) secțiunea VIP, înaintea înscrierii gratuite
    s = re.sub(r'<section class="section vip-sec" id="vip">.*?</section>', '', s, flags=re.S)
    s = s.replace('<section class="section mist" id="rezerva">', section(l) + '<section class="section mist" id="rezerva">', 1)
    # 3) trimiteri către VIP din înscriere și de sub cronometru
    if 'class="vip-hint"' not in s:
        s = re.sub(r'(<section class="section mist" id="rezerva">.*?<p class="lead">.*?</p>)', lambda m: m.group(1) + '<p class="vip-hint"><a href="#vip">%s</a></p>' % t['hint'], s, count=1, flags=re.S)
    if 'cd-vip' not in s:
        s = re.sub(r'(<a class="btn btn-blue cd-cta" href="#rezerva">[^<]*</a>)',
                   lambda m: '<div class="cd-ctas" style="display:flex;gap:12px;flex-wrap:wrap;margin:4px 0 28px">' + m.group(1).replace('cd-cta"', 'cd-cta" style="margin:0"') +
                   '<a class="btn btn-gold cd-vip" href="#vip" style="background:#EFC40F;color:#130F2D">%s</a></div>' % t['cd'], s, count=1)
    if '/assets/js/vip.js' not in s:
        s = s.replace('</body>', SCRIPT + '\n</body>', 1)
    for bad in ('Un roll-up', 'One roll-up'):
        if bad in s:
            raise SystemExit('a rămas roll-up în ' + p)
    if 'id="vip"' not in s or STRIPE not in s:
        raise SystemExit('secțiunea VIP lipsește în ' + p)
    wr(p, s)
    print('vip: eveniment', l)


def home(l):
    p = P + ('en/' if l == 'en' else '') + 'index.html'
    s = rd(p)
    t = T[l]
    if 'data-vipbox' in s:
        return
    m = re.search(r'(<p class="cd-date">[^<]*</p>)(<a class="btn btn-blue" href="eveniment#rezerva">[^<]*</a>)', s)
    if not m:
        raise SystemExit('nu găsesc butonul din cronometru pe ' + p)
    new = (m.group(1) + '<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">' + m.group(2) +
           '<a class="btn" href="eveniment#vip" style="background:#EFC40F;color:#130F2D">%s</a></div>' % t['cd'] +
           '<p data-vipbox style="margin-top:14px;color:rgba(255,255,255,.85);font-size:15px">' + (t['home_line'] % (TOTAL - PRESOLD, TOTAL)) + '</p>')
    s = s[:m.start()] + new + s[m.end():]
    s = s.replace('</body>', SCRIPT + '\n</body>', 1)
    wr(p, s)
    print('vip: index', l)


JS = r'''// Contorul biletelor VIP (citește /api/stats la 15 secunde cât timp pagina e vizibilă)
(function () {
  var boxes = document.querySelectorAll('[data-vipbox],[data-ticketbox]');
  if (!boxes.length) return;
  var en = (document.documentElement.lang || '').indexOf('en') === 0, prevLeft = null, timer = null;
  function ago(iso) {
    var m = Math.max(0, Math.round((Date.now() - Date.parse(iso.replace(' ', 'T') + 'Z')) / 60000));
    if (m > 1440) return '';
    if (m < 1) return en ? 'Last VIP ticket bought just now' : 'Ultimul bilet VIP a fost cumpărat chiar acum';
    if (m < 60) return en ? 'Last VIP ticket bought ' + m + ' min ago' : 'Ultimul bilet VIP a fost cumpărat acum ' + m + ' min';
    var h = Math.round(m / 60);
    return en ? 'Last VIP ticket bought ' + h + ' h ago' : 'Ultimul bilet VIP a fost cumpărat acum ' + h + (h === 1 ? ' oră' : ' ore');
  }
  function set(sel, v) { document.querySelectorAll('[data-vip="' + sel + '"]').forEach(function (e) { e.textContent = v; }); }
  function apply(v) {
    if (!v || typeof v.total !== 'number') return;
    set('left', v.left); set('sold', v.sold);
    if (prevLeft !== null && v.left < prevLeft) document.querySelectorAll('[data-vip="left"]').forEach(function (e) { e.classList.remove('vip-bump'); void e.offsetWidth; e.classList.add('vip-bump'); });
    prevLeft = v.left;
    document.querySelectorAll('[data-vip="bar"]').forEach(function (e) { e.style.width = Math.min(100, v.sold * 100 / v.total) + '%'; });
    var last = v.last ? ago(v.last) : '';
    document.querySelectorAll('[data-vip="last"]').forEach(function (e) { e.textContent = last; e.hidden = !last; });
    document.querySelectorAll('[data-vip="buy"]').forEach(function (b) {
      if (v.left <= 0) { b.setAttribute('aria-disabled', 'true'); b.textContent = en ? 'VIP seats sold out' : 'Locurile VIP s-au epuizat'; b.removeAttribute('href'); }
    });
  }
  // Caseta de înscrieri în timp real din cardul „Acces gratuit”
  function tickets(d) {
    if (!d || typeof d.capacity !== 'number') return;
    document.querySelectorAll('[data-tk="count"]').forEach(function (e) { e.textContent = d.count; });
    document.querySelectorAll('[data-tk="left"]').forEach(function (e) { e.textContent = d.left; });
    document.querySelectorAll('[data-tk="bar"]').forEach(function (e) { e.style.width = Math.min(100, d.count * 100 / d.capacity) + '%'; });
  }
  function load() {
    fetch('/api/stats', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) { apply(d.vip); tickets(d); }).catch(function () {});
  }
  function start() { if (!timer) { load(); timer = setInterval(load, 15000); } }
  function stop() { clearInterval(timer); timer = null; }
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  start();
})();
'''


def confirm_page(lang):
    pre = P + ('en/' if lang == 'en' else '')
    src = rd(pre + 'inscriere-confirmata.html')
    if lang == 'en':
        rep = [(r'<title>[^<]*</title>', '<title>VIP ticket confirmed | JCI Brașov</title>'),
               (r'<h1 class="as-h2" id="c-h">[^<]*</h1>', '<h1 class="as-h2" id="c-h">Your VIP ticket is confirmed</h1>'),
               (r'<p class="lead" id="c-p">[^<]*</p>', '<p class="lead" id="c-p">Thank you, your payment has been received. See you on Thursday, 26 November 2026, from 5:00 pm at CATTIA Brașov, with a reserved front-row seat. Stripe has emailed you the receipt; drinks ordered at the bar are paid separately.</p>')]
    else:
        rep = [(r'<title>[^<]*</title>', '<title>Bilet VIP confirmat | JCI Brașov</title>'),
               (r'<h1 class="as-h2" id="c-h">[^<]*</h1>', '<h1 class="as-h2" id="c-h">Biletul tău VIP este confirmat</h1>'),
               (r'<p class="lead" id="c-p">[^<]*</p>', '<p class="lead" id="c-p">Mulțumim, plata a fost înregistrată. Te așteptăm joi, 26 noiembrie 2026, de la ora 17:00, la CATTIA Brașov, cu loc rezervat în primele rânduri. Chitanța ți-a fost trimisă pe email de Stripe; băuturile comandate de la bar se achită separat.</p>')]
    src = src.replace('inscriere-confirmata.html', 'vip-confirmat.html')
    for pat, new in rep:
        src, n = re.subn(pat, lambda m: new, src, count=1)
        if not n:
            raise SystemExit('vip-confirmat: lipsește ' + pat)
    if '<meta name="robots" content="noindex">' not in src:
        raise SystemExit('vip-confirmat: lipsește noindex')
    wr(pre + 'vip-confirmat.html', src)


def texts():
    vip = ('- Bilet VIP, 200 lei (separat de pachetele de sponsorizare): locuri în primele rânduri, întâlnire directă cu invitații din paneluri, '
           'acces prioritar la networking, networking curatoriat (la Blitz Networking, invitații VIP sunt așezați la masă cu participanți '
           'din domeniile lor de interes, în funcție de profilul participanților prezenți), degustare de vin și preparate culinare; %d de locuri VIP. Băuturile de la bar se achită separat. '
           'Se cumpără online, cu cardul, de pe /eveniment#vip.' % TOTAL)
    p = R + 'worker/kb.js'
    s = rd(p)
    s = re.sub(r'- Acces VIP[^\n]*\n', vip + '\n', s, count=1)
    wr(p, s)
    for p in (P + 'llms.txt', R + 'src/seo2.py'):
        s = rd(p)
        s = s.replace('Sponsor Premium 2.000 lei, Acces VIP 200 lei; parteneriate', 'Sponsor Premium 2.000 lei; parteneriate')
        if 'Bilet VIP, 200 lei' not in s:
            s = s.replace('; parteneriate și în regim de barter.', '; parteneriate și în regim de barter.\n- Bilet VIP, 200 lei: primele rânduri, întâlnire cu invitații, networking prioritar, degustare de vin și preparate; /eveniment#vip.', 1)
        wr(p, s)


import hashlib
SCRIPT = '<script src="/assets/js/vip.js?v=%s" defer></script>' % hashlib.sha256(JS.encode()).hexdigest()[:8]


def fix_script(p):
    s = rd(p)
    s2 = re.sub(r'<script src="/assets/js/vip\.js[^"]*" defer></script>', SCRIPT, s)
    if s2 != s:
        wr(p, s2)


if __name__ == '__main__':
    os.makedirs(P + 'assets/js', exist_ok=True)
    wr(P + 'assets/js/vip.js', JS)
    for l in ('ro', 'en'):
        event_page(l)
        home(l)
        confirm_page(l)
    texts()
    for f in ('eveniment.html', 'index.html', 'en/eveniment.html', 'en/index.html'):
        fix_script(P + f)
