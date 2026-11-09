# Meta Pixel cu acord GDPR + politica de confidențialitate (9 nov 2026).
# Rulează după deploy.py, vip.py, checkin.py, parteneri.py și ÎNAINTE de security.py. Idempotent.
#  - pune consent.css și meta-pixel.js (pixelul pornește doar după „Accept”) deasupra </head> pe paginile RO/EN
#  - generează /confidentialitate și /en/confidentialitate din src/confidentialitate-ro.html și -en.html
#  - adaugă în subsol „Politica de confidențialitate” și „Setări cookie-uri”; leagă bifele de acord de politică
#  - adaugă domeniile Meta în CSP (img-src, connect-src); security.py le pune în script-src
import glob, re, hashlib, os

S = '/home/claude/jci-brasov.com/public/'
SRC = os.path.dirname(os.path.abspath(__file__)) + '/'
BANNER = False  # 9 nov 2026: banner scos temporar la cererea lui Iustin; pixelul pornește fără acord. True = varianta cu acord GDPR.
EXCLUDE = ('p-',)  # previzualizări pentru alți clienți (ex. Dachkraft)


def ver(path):
    return hashlib.md5(open(S + path, 'rb').read()).hexdigest()[:8]


INLINE = """<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('consent', (function(){try{var c=JSON.parse(localStorage.getItem('jci_consent'));return c&&c.v==='granted'&&Date.now()-c.t<15724800000?'grant':'revoke'}catch(e){return 'revoke'}})());
fbq('init', '1646950960458698');
window.jciPv='pv'+Date.now()+Math.random().toString(36).slice(2,8);
fbq('track', 'PageView', {}, {eventID: window.jciPv});
</script>"""


def head_tags():
    inline = INLINE if BANNER else re.sub(r"fbq\('consent', \(function.*?\)\(\)\);", "fbq('consent', 'grant');", INLINE, flags=re.S)
    # Codul de bază Meta, inline (ca să-l recunoască verificatorul Meta), blocat cu fbq('consent','revoke') până la „Accept”.
    return ('<!-- Meta Pixel Code -->\n' + inline + '\n'
            '<link rel="stylesheet" href="/assets/css/consent.css?v=' + ver('assets/css/consent.css') + '">\n'
            '<script src="/assets/js/meta-pixel.js?v=' + ver('assets/js/meta-pixel.js') + '" async></script>\n'
            '<!-- End Meta Pixel Code -->\n')


FOOT = {
    'ro': '<span class="legal-links"><a href="/confidentialitate">Politica de confidențialitate</a>' + ('' if not BANNER else
          '<button type="button" class="cookie-link" data-cookie-settings>Setări cookie-uri</button>') + '</span>',
    'en': '<span class="legal-links"><a href="/en/confidentialitate">Privacy policy</a>' + ('' if not BANNER else
          '<button type="button" class="cookie-link" data-cookie-settings>Cookie settings</button>') + '</span>',
}
ACORD = {
    'ro': [('legătură cu participarea.', 'legătură cu participarea. Detalii în <a href="/confidentialitate" target="_blank">politica de confidențialitate</a>.'),
           ('legătură cu parteneriatul.', 'legătură cu parteneriatul. Detalii în <a href="/confidentialitate" target="_blank">politica de confidențialitate</a>.'),
           ('legătură cu activitatea organizației.', 'legătură cu activitatea organizației. Detalii în <a href="/confidentialitate" target="_blank">politica de confidențialitate</a>.')],
    'en': [('contact me about my attendance.', 'contact me about my attendance. See our <a href="/en/confidentialitate" target="_blank">privacy policy</a>.'),
           ('contact me about the partnership.', 'contact me about the partnership. See our <a href="/en/confidentialitate" target="_blank">privacy policy</a>.'),
           ("contact me about the organisation's activities.", "contact me about the organisation's activities. See our <a href=\"/en/confidentialitate\" target=\"_blank\">privacy policy</a>.")],
}


def make_policy(lang):
    shell = S + ('en/multumim.html' if lang == 'en' else 'multumim.html')
    dst = S + ('en/confidentialitate.html' if lang == 'en' else 'confidentialitate.html')
    s = open(shell, encoding='utf8').read()
    body = open(SRC + 'confidentialitate-%s.html' % lang, encoding='utf8').read()
    title = 'Privacy policy | JCI Brașov' if lang == 'en' else 'Politica de confidențialitate | JCI Brașov'
    desc = ('How JCI Brașov collects, uses and protects personal data, and how cookies work on jci-brasov.com.' if lang == 'en'
            else 'Cum colectează, folosește și protejează JCI Brașov datele personale și cum funcționează cookie-urile pe jci-brasov.com.')
    s = re.sub(r'<title>[^<]*</title>', '<title>' + title + '</title>', s, count=1)
    s = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="' + desc + '">', s, count=1)
    s = s.replace('<meta name="robots" content="noindex">\n', '')
    s = re.sub(r'<main>.*?</main>', lambda m: '<main>\n' + body + '</main>', s, count=1, flags=re.S)
    s = s.replace('multumim', 'confidentialitate')
    open(dst, 'w', encoding='utf8').write(s)


def run():
    tags = head_tags()
    pages = [p for p in glob.glob(S + '**/*.html', recursive=True) if not p[len(S):].startswith(EXCLUDE)]
    n = 0
    for p in pages:
        s = open(p, encoding='utf8').read()
        if '</head>' not in s:
            continue
        lang = 'en' if p[len(S):].startswith('en/') else 'ro'
        s = re.sub(r'<!-- Meta Pixel Code.*?<!-- End Meta Pixel Code -->\n', '', s, flags=re.S)
        s = s.replace('</head>', tags + '</head>', 1)
        s = re.sub(r'<span class="legal-links">.*?</span>', '', s, count=1, flags=re.S)
        if True:
            s = s.replace('<span>© 2026 JCI Brașov</span>', '<span>© 2026 JCI Brașov</span>' + FOOT[lang], 1)
        if 'confidentialitate" target' not in s:
            for a, b in ACORD[lang]:
                s = s.replace(a, b)
        open(p, 'w', encoding='utf8').write(s)
        n += 1
    make_policy('ro')
    make_policy('en')

    # sitemap
    sm = S + 'sitemap.xml'
    if os.path.exists(sm):
        t = open(sm, encoding='utf8').read()
        if '/confidentialitate' not in t:
            add = ''.join('  <url><loc>https://jci-brasov.com%s</loc><lastmod>2026-11-09</lastmod></url>\n' % u
                          for u in ('/confidentialitate', '/en/confidentialitate'))
            t = t.replace('</urlset>', add + '</urlset>')
            open(sm, 'w', encoding='utf8').write(t)

    # CSP + COOP: unealta Meta de configurare a evenimentelor deschide site-ul din fereastra Facebook (window.opener)
    # și încarcă bara ei din domeniile Meta. COOP same-origin rupea legătura, iar CSP bloca cadrele/stilurile/imaginile.
    h = S + '_headers'
    t = open(h, encoding='utf8').read()
    t = t.replace('  Cross-Origin-Opener-Policy: same-origin\n', '  Cross-Origin-Opener-Policy: unsafe-none\n', 1)
    FB = ['https://*.facebook.com', 'https://*.facebook.net', 'https://*.fbcdn.net']
    for d, hosts in (('style-src', FB), ('font-src', FB), ('img-src', FB),
                     ('connect-src', FB), ('frame-src', FB)):
        m = re.search(d + r" [^;]*", t)
        if not m:
            t = t.replace('; form-action', "; frame-src 'self'; form-action", 1)
            m = re.search(d + r" [^;]*", t)
        v = m.group(0)
        for x in hosts:
            if x not in v.split():
                v += ' ' + x
        t = t[:m.start()] + v + t[m.end():]
    open(h, 'w', encoding='utf8').write(t)
    print('pixel + confidențialitate: %d pagini' % n)


if __name__ == '__main__':
    run()
