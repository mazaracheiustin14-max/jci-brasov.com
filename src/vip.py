# Bilet VIP (7 nov 2026): pachetul Acces VIP fără roll-up, cu degustare de vin și preparate,
# mențiunea despre bar și butonul de plată Stripe; pagina vip-confirmat (RO/EN) după plată.
# Idempotent. Rulează după deploy.py și înainte de security.py:  python3 src/vip.py
import os, re

R = '/home/claude/jci-brasov.com/'
STRIPE = 'https://buy.stripe.com/4gM7sL2iD4a3eype1v3wQ05'

RO_OLD = '<li>Locuri rezervate în primele rânduri</li><li>Întâlnire directă cu invitații din paneluri</li><li>Un roll-up în spațiul evenimentului</li><li>Acces prioritar la sesiunile de networking</li></ul></div>'
RO_NEW = ('<li>Locuri rezervate în primele rânduri</li><li>Întâlnire directă cu invitații din paneluri</li>'
          '<li>Acces prioritar la sesiunile de networking</li><li>Degustare de vin și preparate culinare</li></ul>'
          '<p style="margin:14px 0 0;font-size:13px;color:var(--muted)">Băuturile comandate de la bar se achită separat.</p>'
          '<div style="flex:1;min-height:20px"></div><a class="btn btn-blue" style="justify-content:center;width:100%" href="' + STRIPE + '" rel="noopener">Cumpără biletul VIP</a></div>')
EN_OLD = '<li>Reserved front-row seating</li><li>Direct meeting with the panel speakers</li><li>One roll-up in the event space</li><li>Priority access to the networking sessions</li></ul></div>'
EN_NEW = ('<li>Reserved front-row seating</li><li>Direct meeting with the panel speakers</li>'
          '<li>Priority access to the networking sessions</li><li>Wine and food tasting</li></ul>'
          '<p style="margin:14px 0 0;font-size:13px;color:var(--muted)">Drinks ordered at the bar are paid separately.</p>'
          '<div style="flex:1;min-height:20px"></div><a class="btn btn-blue" style="justify-content:center;width:100%" href="' + STRIPE + '" rel="noopener">Buy the VIP ticket</a></div>')


def patch(path, old, new):
    p = R + path
    if not os.path.exists(p):
        return
    s = open(p, encoding='utf-8').read()
    if new in s:
        return
    if old not in s:
        raise SystemExit('nu găsesc pachetul VIP în ' + path)
    s = s.replace(old, new)
    open(p, 'w', encoding='utf-8').write(s)
    print('vip:', path)


def confirm_page(lang):
    pre = 'public/en/' if lang == 'en' else 'public/'
    src = open(R + pre + 'inscriere-confirmata.html', encoding='utf-8').read()
    if lang == 'en':
        rep = [
            ('<title>', '<title>VIP ticket confirmed | JCI Brașov</title>', r'<title>[^<]*</title>'),
            ('h1', '<h1 class="as-h2" id="c-h">Your VIP ticket is confirmed</h1>', r'<h1 class="as-h2" id="c-h">[^<]*</h1>'),
            ('lead', '<p class="lead" id="c-p">Thank you, your payment has been received. See you on Thursday, 26 November 2026, from 5:00 pm at CATTIA Brașov, with a reserved front-row seat. Stripe has emailed you the receipt; drinks ordered at the bar are paid separately.</p>',
             r'<p class="lead" id="c-p">[^<]*</p>'),
        ]
        src = src.replace('inscriere-confirmata.html', 'vip-confirmat.html')
    else:
        rep = [
            ('<title>', '<title>Bilet VIP confirmat | JCI Brașov</title>', r'<title>[^<]*</title>'),
            ('h1', '<h1 class="as-h2" id="c-h">Biletul tău VIP este confirmat</h1>', r'<h1 class="as-h2" id="c-h">[^<]*</h1>'),
            ('lead', '<p class="lead" id="c-p">Mulțumim, plata a fost înregistrată. Te așteptăm joi, 26 noiembrie 2026, de la ora 17:00, la CATTIA Brașov, cu loc rezervat în primele rânduri. Chitanța ți-a fost trimisă pe email de Stripe; băuturile comandate de la bar se achită separat.</p>',
             r'<p class="lead" id="c-p">[^<]*</p>'),
        ]
        src = src.replace('inscriere-confirmata.html', 'vip-confirmat.html')
    for name, new, pat in rep:
        src, n = re.subn(pat, lambda m: new, src, count=1)
        if not n:
            raise SystemExit('vip-confirmat: lipsește ' + name)
    if '<meta name="robots" content="noindex">' not in src:
        raise SystemExit('vip-confirmat: lipsește noindex')
    open(R + pre + 'vip-confirmat.html', 'w', encoding='utf-8').write(src)
    print('vip-confirmat:', lang)


def kb():
    p = R + 'worker/kb.js'
    s = open(p, encoding='utf-8').read()
    old = '- Acces VIP, 200 lei: locuri în primele rânduri, întâlnire directă cu invitații din paneluri, un roll-up, acces prioritar la networking.'
    new = ('- Acces VIP (bilet), 200 lei: locuri în primele rânduri, întâlnire directă cu invitații din paneluri, acces prioritar la networking, '
           'degustare de vin și preparate culinare. Băuturile de la bar se achită separat. Biletul se cumpără online, cu cardul, din butonul '
           '„Cumpără biletul VIP” de pe /eveniment#parteneri.')
    if new not in s:
        if old not in s:
            raise SystemExit('kb.js: nu găsesc linia VIP')
        open(p, 'w', encoding='utf-8').write(s.replace(old, new))
        print('vip: worker/kb.js')


if __name__ == '__main__':
    for f in ('src/source-onepage.html', 'public/eveniment.html'):
        patch(f, RO_OLD, RO_NEW)
    for f in ('src/source-en.html', 'src/body-en.html', 'public/en/eveniment.html'):
        patch(f, EN_OLD, EN_NEW)
    confirm_page('ro')
    confirm_page('en')
    kb()
