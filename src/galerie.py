#!/usr/bin/env python3
"""Pozele de la Beyond the Initiative (26 nov 2026): galerie pe pagina Eveniment și poza echipei pe prima pagină.
Rulează după cozonaci.py și înainte de security.py. Idempotent. Pozele sursă: src/galerie/ (originalele trimise de Iustin)."""
import os, re, hashlib
from PIL import Image, ImageOps

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = R + '/public/'
SRC = R + '/src/galerie/'
OUT = 'assets/img/eveniment/'
YT1 = 'https://youtu.be/vVvcE72qQ74'  # Panelul I, Puterea comunității

PH = [  # fișier, lățime maximă, alt RO, alt EN
    ('echipa-jci-brasov', 1200, 'Echipa JCI Brașov cu steagul organizației, la Beyond the Initiative', 'The JCI Brașov team holding the chapter flag at Beyond the Initiative'),
    ('deschidere', 1000, 'Deschiderea oficială a evenimentului Beyond the Initiative, în amfiteatrul CATTIA', 'The official opening of Beyond the Initiative in the CATTIA amphitheatre'),
    ('lobby', 1400, 'Participanți la primire și networking în lobby-ul CATTIA Brașov', 'Guests arriving and networking in the CATTIA Brașov lobby'),
    ('panel-2', 1000, 'Panelul II, „Tehnologia care ne schimbă viața”, pe scena amfiteatrului', 'Panel II, "The technology that changes our lives", on the amphitheatre stage'),
    ('panel-2-sala', 1000, 'Invitații Panelului II în dialog cu sala', 'Panel II speakers in conversation with the audience'),
]

CSS = """.ev-gal{columns:3;column-gap:18px;margin-top:36px}
.ev-gal figure{margin:0 0 18px;break-inside:avoid}
.ev-gal img,.team-shot img{display:block;width:100%;height:auto;border-radius:18px}
.team-shot{display:grid;grid-template-columns:minmax(0,440px) 1fr;gap:56px;align-items:center}
.team-shot figure{margin:0}
.team-shot .lead{margin-bottom:28px}
.hero h1{line-height:1.12;font-size:clamp(34px,5.4vw,80px)}
.yt-link{display:inline-block;margin-top:8px;color:#0097D7;font-weight:700;font-size:14px;text-decoration:underline;text-underline-offset:3px}
@media(max-width:900px){.ev-gal{columns:2;column-gap:12px}.ev-gal figure{margin-bottom:12px}.team-shot{grid-template-columns:1fr;gap:28px}}
"""

T = {
    'ro': dict(tag='Galerie', h='Imagini de la eveniment', lead='Câteva cadre din seara de 26 noiembrie 2026, de la CATTIA Brașov.',
               ttag='Echipa', th='Oamenii din spatele JCI Brașov',
               tlead='Pe 26 noiembrie 2026, la Beyond the Initiative, JCI Brașov a devenit organizație locală cu drepturi depline în JCI România. Aceasta este echipa care a făcut pasul.',
               h1='Lideri tineri, <em>impact real</em>.', hlead='Suntem organizația locală JCI pentru tinerii între 18 și 40 de ani care vor să se dezvolte prin acțiune: antreprenori, profesioniști și oameni implicați în viața orașului. Prezenți la Brașov din 2003, din noiembrie 2026 cu drepturi depline în JCI România.',
               both='Panelul I și II', yt='Urmărește Panelul I pe YouTube', b1='Cunoaște echipa', b2='Vezi evenimentul'),
    'en': dict(tag='Gallery', h='Photos from the event', lead='A few moments from the evening of 26 November 2026 at CATTIA Brașov.',
               ttag='The team', th='The people behind JCI Brașov',
               tlead='On 26 November 2026, at Beyond the Initiative, JCI Brașov became a full local organisation within JCI Romania. This is the team that made it happen.',
               h1='Young leaders, <em>real impact</em>.', hlead='We are the local JCI organisation for people aged 18 to 40 who want to grow through action: entrepreneurs, professionals and people involved in the life of the city. Present in Brașov since 2003, a full member of JCI Romania since November 2026.',
               both='Panels I and II', yt='Watch Panel I on YouTube', b1='Meet the team', b2='See the event'),
}


def rd(f):
    return open(P + f, encoding='utf-8').read()


def wr(f, s):
    open(P + f, 'w', encoding='utf-8').write(s)


def images():
    os.makedirs(P + OUT, exist_ok=True)
    dims = {}
    for name, w, _, _ in PH:
        im = ImageOps.exif_transpose(Image.open(SRC + name + '.jpg')).convert('RGB')
        if im.width > w:
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        dst = P + OUT + name + '.webp'
        if not os.path.exists(dst):
            im.save(dst, 'WEBP', quality=80, method=6)
        dims[name] = im.size
    return dims


def img(name, lang, dims):
    alt = [p for p in PH if p[0] == name][0][2 if lang == 'ro' else 3]
    return '<figure><img loading="lazy" decoding="async" src="/%s%s.webp" alt="%s" width="%d" height="%d"></figure>' % (OUT, name, alt, dims[name][0], dims[name][1])


def link(s, v):
    if '/assets/css/galerie.css' in s:
        return re.sub(r'/assets/css/galerie\.css\?v=\w+', '/assets/css/galerie.css?v=' + v, s)
    return s.replace('</head>', '<link rel="stylesheet" href="/assets/css/galerie.css?v=%s">\n</head>' % v, 1)


BLOCK = re.compile(r'<!--galerie-->.*?<!--/galerie-->\n?', re.S)


def run():
    dims = images()
    wr('assets/css/galerie.css', CSS)
    v = hashlib.sha1(CSS.encode()).hexdigest()[:8]
    for lang in ('ro', 'en'):
        d = '' if lang == 'ro' else 'en/'
        t = T[lang]
        # pagina Eveniment: galerie înaintea partenerilor
        s = BLOCK.sub('', rd(d + 'eveniment.html'))
        gal = ('<!--galerie--><section class="section" id="galerie">\n  <div class="wrap">\n    <span class="tag">%s</span>\n    <h2>%s</h2>\n    <p class="lead">%s</p>\n    <div class="cta-row"><a class="btn btn-blue" href="%s" target="_blank" rel="noopener">%s</a></div>\n    <div class="ev-gal">%s</div>\n  </div>\n</section><!--/galerie-->\n'
               % (t['tag'], t['h'], t['lead'], YT1, t['yt'], ''.join(img(n, lang, dims) for n in ('deschidere', 'lobby', 'panel-2', 'echipa-jci-brasov', 'panel-2-sala'))))
        # după eveniment: Ciprian Văcaru nu a participat; Rareș Zlătaru a fost în ambele paneluri
        s = re.sub(r'\s*<div class="speaker"><img[^>]*ciprian-vacaru\.jpg.*?</div>', '', s)
        s = re.sub(r'(rares-zlataru\.jpg"[^>]*><small>)[^<]*', r'\g<1>' + t['both'], s)
        s = re.sub(r',?\s*\{"@type": "Person", "name": "Ciprian Văcaru".*?\}\}', '', s)
        s = s.replace('opt invitați', 'șapte invitați').replace('eight speakers', 'seven speakers').replace('eight guests', 'seven guests')
        # înregistrarea Panelului I, în program
        s = re.sub(r'<a class="yt-link".*?</a>', '', s)
        s, n = re.subn(r'(<li class="key"><time>17:45</time><div><b>[^<]*</b><span>[^<]*</span>)', r'\g<1><a class="yt-link" href="%s" target="_blank" rel="noopener">%s</a>' % (YT1, t['yt']), s)
        assert n == 1
        assert 'Văcaru' not in s
        a = '<section class="section mist" id="parteneri">'
        assert a in s
        wr(d + 'eveniment.html', link(s.replace(a, gal + a, 1), v))
        # prima pagină: poza echipei, imediat după cronometru
        s = BLOCK.sub('', rd(d + 'index.html'))
        team = ('<!--galerie--><section class="section mist" id="echipa-foto">\n  <div class="wrap team-shot">\n    %s\n    <div>\n      <span class="tag blue">%s</span>\n      <h2>%s</h2>\n      <p class="lead">%s</p>\n      <div class="cta-row"><a class="btn btn-blue" href="echipa">%s</a><a class="btn btn-ghost" href="eveniment#galerie">%s</a></div>\n    </div>\n  </div>\n</section><!--/galerie-->\n'
                % (img('echipa-jci-brasov', lang, dims), t['ttag'], t['th'], t['tlead'], t['b1'], t['b2']))
        m = re.search(r'<section class="countdown".*?</section>\n?', s, re.S)
        assert m
        s = s[:m.end()] + team + s[m.end():]
        # titlul și textul din hero, după eveniment (vechiul „JCI revine în Brașov” nu mai e de actualitate)
        s = re.sub(r'(<section class="hero" id="acasa">.*?<h1>).*?(</h1>\s*<p class="lead">).*?(</p>)', lambda m: m.group(1) + t['h1'] + m.group(2) + t['hlead'] + m.group(3), s, count=1, flags=re.S)
        # bara fixă de pe telefon: evenimentul s-a încheiat, duce la campania de cozonaci
        s = re.sub(r'<a class="btn btn-blue sticky-cta" href="[^"]*">[^<]*</a>',
                   '<a class="btn btn-blue sticky-cta" href="cozonaci">%s</a>' % ('Cozonaci de casă, din 3 decembrie' if lang == 'ro' else 'Homemade cozonac, from 3 December'), s)
        wr(d + 'index.html', link(s, v))
    print('galerie: gata')


if __name__ == '__main__':
    run()
