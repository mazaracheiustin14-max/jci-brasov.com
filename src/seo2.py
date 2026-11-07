# SEO, runda 2 (7 nov 2026): imagini de distribuire pentru eveniment, Event și FAQPage complete,
# organizație îmbogățită, sitemap cu data zilei, llms.txt actualizat. Rulat din post.py, după chat.run().
import glob, json, re, datetime
from bs4 import BeautifulSoup

S = '/home/claude/site/'
SITE = 'https://jci-brasov.com/'
TODAY = datetime.date.today().isoformat()

PERF = [("Ioana Ceaușu", "Director operațional", "The Entrepreneurship Academy"),
        ("Rareș Zlătaru", "Fondator", "DBV Management & Training"),
        ("Bogdan Costaș", "Director general", "Aviația Utilitară București"),
        ("Ciprian Văcaru", "Secretar de stat", "Ministerul Muncii")]


def ld_blocks(s):
    return list(re.finditer(r'<script type="application/ld\+json">(.*?)</script>', s, re.S))


def event_page(p, en):
    s = open(p, encoding='utf8').read()
    l = 'en' if en else 'ro'
    og = f'{SITE}assets/img/beyond-og-{l}.jpg'
    alt = 'Beyond the Initiative, 26 November 2026, CATTIA Brașov' if en else 'Beyond the Initiative, 26 noiembrie 2026, CATTIA Brașov'
    s = re.sub(r'(<meta property="og:image" content=")[^"]*', r'\g<1>' + og, s)
    s = re.sub(r'(<meta name="twitter:image" content=")[^"]*', r'\g<1>' + og, s)
    s = re.sub(r'(<meta property="og:image:alt" content=")[^"]*', r'\g<1>' + alt, s)
    url = SITE + ('en/' if en else '') + 'eveniment'
    for m in ld_blocks(s):
        try:
            j = json.loads(m.group(1))
        except Exception:
            continue
        if isinstance(j, dict) and j.get('@type') == 'Event':
            j['image'] = [f'{SITE}assets/img/beyond-{n}-{l}.jpg' for n in ('sq', 'r43', 'og')]
            j['maximumAttendeeCapacity'] = 150
            j['organizer'] = {"@type": "Organization", "name": "JCI Brașov", "url": SITE,
                              "email": "contact@jci-brasov.com", "logo": SITE + "assets/img/icon-512.png"}
            j['performer'] = [{"@type": "Person", "name": n, "jobTitle": t, "worksFor": {"@type": "Organization", "name": o}} for n, t, o in PERF]
            j['offers'] = {"@type": "Offer", "price": "0", "priceCurrency": "RON", "availability": "https://schema.org/InStock",
                           "url": url + "#rezerva", "validFrom": "2026-11-01T00:00:00+02:00", "validThrough": "2026-11-24T23:59:00+02:00"}
            j['location']['address'].update({"addressRegion": "Brașov", "streetAddress": "Strada Institutului 35"})
            j['audience'] = {"@type": "Audience", "audienceType": "Entrepreneurs, managers and young professionals" if en else "Antreprenori, manageri și tineri profesioniști"}
            s = s.replace(m.group(0), '<script type="application/ld+json">' + json.dumps(j, ensure_ascii=False) + '</script>', 1)
    if '"FAQPage"' not in s:
        soup = BeautifulSoup(s, 'lxml')
        faq = soup.find(id='intrebari')
        qa = [(d.summary.get_text(' ', strip=True), d.p.get_text(' ', strip=True)) for d in faq.find_all('details') if d.summary and d.p] if faq else []
        if qa:
            fj = {"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": l,
                  "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in qa]}
            s = s.replace('</head>', '<script type="application/ld+json">' + json.dumps(fj, ensure_ascii=False) + '</script>\n</head>', 1)
    open(p, 'w', encoding='utf8').write(s)


def home_page(p, en):
    s = open(p, encoding='utf8').read()
    for m in ld_blocks(s):
        try:
            j = json.loads(m.group(1))
        except Exception:
            continue
        if isinstance(j, list):
            for o in j:
                if isinstance(o.get('@type'), list) and 'Organization' in o['@type']:
                    o['description'] = ("JCI Brașov is the Brașov chapter of Junior Chamber International, a non-profit organization for young leaders aged 18 to 40, affiliated with JCI Romania." if en else
                                        "JCI Brașov este filiala din Brașov a Junior Chamber International, organizație non-profit pentru tineri lideri între 18 și 40 de ani, afiliată JCI România.")
                    o['foundingDate'] = '2003'
                    o['address'] = {"@type": "PostalAddress", "addressLocality": "Brașov", "addressRegion": "Brașov", "addressCountry": "RO"}
                    o['areaServed'] = {"@type": "City", "name": "Brașov"}
                    o['memberOf'] = {"@type": "Organization", "name": "Junior Chamber International", "url": "https://jci.cc/"}
                    o['contactPoint'] = {"@type": "ContactPoint", "contactType": "customer support", "telephone": "+40790827426",
                                         "email": "contact@jci-brasov.com", "availableLanguage": ["ro", "en"]}
                    o['knowsAbout'] = ["leadership", "antreprenoriat", "networking", "dezvoltare personală", "voluntariat", "Obiectivele de Dezvoltare Durabilă"]
                    o['slogan'] = 'Lead Connect Grow'
                    o['@id'] = SITE + '#org'
                if o.get('@type') == 'WebSite':
                    o['publisher'] = {"@id": SITE + '#org'}
            s = s.replace(m.group(0), '<script type="application/ld+json">' + json.dumps(j, ensure_ascii=False) + '</script>', 1)
    open(p, 'w', encoding='utf8').write(s)


def sitemap():
    p = S + 'sitemap.xml'
    s = open(p, encoding='utf8').read()
    s = re.sub(r'<lastmod>[^<]*</lastmod>', f'<lastmod>{TODAY}</lastmod>', s)
    open(p, 'w', encoding='utf8').write(s)


LLMS = '''# JCI Brașov

> JCI Brașov este filiala din Brașov, România, a Junior Chamber International (JCI): organizație non-profit pentru tineri între 18 și 40 de ani, afiliată JCI România. Activă la Brașov din 2003, relansată în 2026 cu o generație nouă. Site oficial: https://jci-brasov.com

## Pe scurt
- Direcții: dezvoltare personală, afaceri și networking, proiecte în comunitate, oportunități internaționale (rețeaua JCI din peste 100 de țări).
- Conducere 2026: Iustin Mazarache (Președinte), Alexandra Văcărețiu (Vicepreședinte Marketing), Daria Bica (Vicepreședinte Proiecte).
- Cotizație membru: 300 lei pe an plus 15 lei pe lună pentru sediul social.
- Contact: +40 790 827 426, contact@jci-brasov.com, Instagram @jcibrasov.

## Eveniment: JCI Brașov Beyond the Initiative
- Joi, 26 noiembrie 2026, 17:00–22:30, CATTIA Brașov, Strada Institutului 35.
- Marchează trecerea JCI Brașov de la grup de inițiativă la grup cu drepturi depline în JCI România.
- Două paneluri („Puterea comunității” și „Tehnologia care ne schimbă viața”), opt invitați, două sesiuni de Blitz Networking.
- Acces gratuit, cu înscriere: https://jci-brasov.com/eveniment#rezerva (aproximativ 150 de locuri, înscrieri până pe 24 noiembrie 2026, ora 23:59).
- Pachete de sponsorizare: Sponsor 1.000 lei, Sponsor Premium 2.000 lei; parteneriate și în regim de barter.
- Bilet VIP, 200 lei: primele rânduri, întâlnire cu invitații, networking prioritar, degustare de vin și preparate; /eveniment#vip.

## Pagini principale
- [Acasă](https://jci-brasov.com/): prezentarea JCI Brașov
- [Despre și istoric](https://jci-brasov.com/despre): misiune, viziune, istoria JCI Brașov din 2003
- [Eveniment Beyond the Initiative](https://jci-brasov.com/eveniment): program, invitați, înscriere, întrebări frecvente, sponsorizare
- [Proiecte](https://jci-brasov.com/proiecte): Toy Story, podcastul „La un pahar de poveste”, proiectele din 2027
- [Echipa](https://jci-brasov.com/echipa): conducerea, membrii și senatorii JCI
- [Devino membru](https://jci-brasov.com/implica-te): pașii de înscriere și cotizația
- [Contact](https://jci-brasov.com/contact)

## English
- [English version](https://jci-brasov.com/en/): JCI Brașov, the Junior Chamber International chapter in Brașov, Romania, for young leaders aged 18 to 40. Launch event "Beyond the Initiative": 26 November 2026, 17:00, CATTIA Brașov, free entry with registration at https://jci-brasov.com/en/eveniment#rezerva
'''


FONTFACE = """/* fonturi găzduite local (fără Google Fonts) */
@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-display:swap;font-weight:200 800;src:url(../fonts/plus-jakarta-sans-latin-ext-wght-normal.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-display:swap;font-weight:200 800;src:url(../fonts/plus-jakarta-sans-latin-wght-normal.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Arvo';font-style:normal;font-display:swap;font-weight:400;src:url(../fonts/arvo-latin-400-normal.woff2) format('woff2')}
"""
PRELOAD = ('<link rel="preload" href="/assets/fonts/plus-jakarta-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>\n'
           '<link rel="preload" href="/assets/fonts/plus-jakarta-sans-latin-ext-wght-normal.woff2" as="font" type="font/woff2" crossorigin>')


def fonts():
    css = S + 'assets/css/style.css'
    c = open(css, encoding='utf8').read()
    if 'fonturi găzduite local' not in c:
        open(css, 'w', encoding='utf8').write(FONTFACE + c)
    for p in glob.glob(S + '*.html') + glob.glob(S + 'en/*.html'):
        s = open(p, encoding='utf8').read()
        n = re.sub(r'<link rel="preconnect" href="https://fonts\.g[^"]*"[^>]*>\s*', '', s)
        n = re.sub(r'<link href="https://fonts\.googleapis\.com/[^"]*" rel="stylesheet">', PRELOAD, n)
        if n != s:
            open(p, 'w', encoding='utf8').write(n)
    h = S + '_headers'
    t = open(h, encoding='utf8').read()
    t = t.replace(" https://fonts.googleapis.com", "").replace("font-src 'self' https://fonts.gstatic.com", "font-src 'self'")
    open(h, 'w', encoding='utf8').write(t)


def run():
    fonts()
    event_page(S + 'eveniment.html', False)
    event_page(S + 'en/eveniment.html', True)
    home_page(S + 'index.html', False)
    home_page(S + 'en/index.html', True)
    sitemap()
    open(S + 'llms.txt', 'w', encoding='utf8').write(LLMS)


if __name__ == '__main__':
    run()
