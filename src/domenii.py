"""Domeniile de activitate pentru potrivirea de la Blitz Networking (13 nov 2026).

Rulează după deploy.py, vip.py, checkin.py, parteneri.py și pixel.py. Idempotent. Nu adaugă scripturi inline,
deci security.py nu trebuie rulat din cauza lui.

  1. Formularul de înscriere (eveniment, RO/EN): câmpul obligatoriu „Domeniul tău de activitate”.
  2. Pagina vip-confirmat (RO/EN): formularul „Networking curatoriat” (domeniul propriu și cel mult 3 domenii țintă),
     trimis de public/assets/js/vip-domenii.js la /api/vip-domenii.

Lista DOMENII este aceeași ca în worker/domenii.js (verificat de src/tests/blitz.test.mjs).
"""
import hashlib
import os
import re

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..') + '/'
P = R + 'public/'

DOMENII = [
    ('it', 'IT și tehnologie', 'IT and technology'),
    ('marketing', 'Marketing, comunicare și media', 'Marketing, communication and media'),
    ('vanzari', 'Vânzări și dezvoltare de afaceri', 'Sales and business development'),
    ('financiar', 'Financiar, contabilitate și asigurări', 'Finance, accounting and insurance'),
    ('juridic', 'Juridic și consultanță', 'Legal and consulting'),
    ('horeca', 'HoReCa și turism', 'Hospitality and tourism'),
    ('imobiliare', 'Imobiliare și construcții', 'Real estate and construction'),
    ('productie', 'Producție și industrie', 'Manufacturing and industry'),
    ('comert', 'Comerț și comerț online', 'Retail and e-commerce'),
    ('transport', 'Transport și logistică', 'Transport and logistics'),
    ('sanatate', 'Sănătate și wellness', 'Health and wellness'),
    ('educatie', 'Educație, training și resurse umane', 'Education, training and human resources'),
    ('ong', 'ONG și sector public', 'NGO and public sector'),
    ('alt', 'Alt domeniu', 'Other field'),
]

T = {
    'ro': dict(
        choose='Alege', dom='Domeniul tău de activitate',
        tag='Networking curatoriat', h='Spune-ne pe cine vrei să întâlnești',
        p='La Blitz Networking te așezăm la masă cu participanți din domeniile care te interesează, în funcție de profilul participanților prezenți. Durează sub un minut.',
        email='Adresa de email folosită la plată', tinte='Din ce domenii vrei să cunoști oameni? Alege cel mult trei.',
        send='Trimite răspunsurile',
    ),
    'en': dict(
        choose='Choose', dom='Your field of activity',
        tag='Curated networking', h='Tell us who you would like to meet',
        p='At Blitz Networking we seat you with participants from the fields you are interested in, depending on the profile of those attending. It takes less than a minute.',
        email='Email address used for the payment', tinte='Which fields would you like to meet people from? Choose up to three.',
        send='Send my answers',
    ),
}


def rd(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def wr(p, s):
    with open(p, 'w', encoding='utf-8') as f:
        f.write(s)


def options(lang, with_alt=True):
    i = 2 if lang == 'en' else 1
    return ''.join('<option value="%s">%s</option>' % (d[0], d[i]) for d in DOMENII if with_alt or d[0] != 'alt')


def signup(lang):
    p = P + ('en/' if lang == 'en' else '') + 'eveniment.html'
    s = rd(p)
    if 'id="i-dom"' in s:
        return
    t = T[lang]
    field = ('<div class="field"><label for="i-dom">%s <span class="req" aria-hidden="true">*</span></label>'
             '<select id="i-dom" name="domeniu" required><option value="">%s</option>%s</select></div>') % (t['dom'], t['choose'], options(lang))
    m = re.search(r'<div class="field"><label for="i-src">.*?</select></div>', s, re.S)
    assert m, 'nu găsesc câmpul „De unde ai aflat” în ' + p
    s = s[:m.end()] + '\n      ' + field + s[m.end():]
    wr(p, s)


def vip_form(lang):
    p = P + ('en/' if lang == 'en' else '') + 'vip-confirmat.html'
    s = rd(p)
    t = T[lang]
    i = 2 if lang == 'en' else 1
    v = hashlib.md5(open(P + 'assets/js/vip-domenii.js', 'rb').read()).hexdigest()[:8]
    tag = '<script src="/assets/js/vip-domenii.js?v=%s" defer></script>' % v
    if 'id="c-dom"' in s:
        s = re.sub(r'<script src="/assets/js/vip-domenii\.js\?v=[0-9a-f]+" defer></script>', tag, s)
        wr(p, s)
        return
    checks = ''.join('<label class="check"><input type="checkbox" name="tinte" value="%s"><span>%s</span></label>' % (d[0], d[i])
                     for d in DOMENII if d[0] != 'alt')
    block = (
        '<div class="st2 main" id="c-dom"><small>%s</small><h2>%s</h2><p>%s</p>\n'
        '    <form id="vd-form" class="vd">\n'
        '      <div class="field"><label for="vd-email">%s</label><input id="vd-email" name="email" type="email" required maxlength="160" autocomplete="email" autocapitalize="none"></div>\n'
        '      <div class="field"><label for="vd-dom">%s</label><select id="vd-dom" name="domeniu" required><option value="">%s</option>%s</select></div>\n'
        '      <fieldset class="vd-set"><legend>%s</legend>%s</fieldset>\n'
        '      <button class="btn btn-blue" type="submit">%s</button>\n'
        '    </form><p id="vd-msg" class="vd-msg" role="status" hidden></p>\n'
        '  </div>\n  '
    ) % (t['tag'], t['h'], t['p'], t['email'], t['dom'], t['choose'], options(lang), t['tinte'], checks, t['send'])
    css = ('\n  .conf .vd{display:grid;gap:14px}.conf .vd-set{border:0;padding:0;margin:0;display:grid;gap:10px}'
           '.conf .vd-set legend{font-weight:600;font-size:15px;color:#fff;padding:0;margin-bottom:10px}'
           '.conf .vd .check{font-size:15px;color:#fff}.conf .vd-msg{margin:0;font-size:15px}</style>')
    a = '<div class="steps2">\n  '
    assert s.count(a) == 1, 'nu găsesc pașii în ' + p
    s = s.replace(a, a + block, 1)
    k = s.index('id="c-h"')
    j = s.rindex('</style>', 0, k)
    s = s[:j] + css + s[j + len('</style>'):]
    assert s.count('</body>') == 1
    s = s.replace('</body>', tag + '\n</body>')
    wr(p, s)


if __name__ == '__main__':
    for lang in ('ro', 'en'):
        signup(lang)
        vip_form(lang)
    print('domenii: formularul de înscriere și pagina vip-confirmat actualizate')
