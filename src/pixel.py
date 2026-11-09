# Meta Pixel (9 nov 2026). Rulează după deploy.py, vip.py, checkin.py, parteneri.py și ÎNAINTE de security.py.
# Pune <script src="/assets/js/meta-pixel.js"> și <noscript> chiar deasupra </head> pe paginile RO/EN,
# și adaugă domeniile Meta în CSP din public/_headers. Idempotent.
import glob, re

S = '/home/claude/jci-brasov.com/public/'
PIXEL_ID = '1646950960458698'
TAG = ('<!-- Meta Pixel Code -->\n'
       '<script src="/assets/js/meta-pixel.js" async></script>\n'
       '<noscript><img height="1" width="1" style="display:none" alt="" '
       'src="https://www.facebook.com/tr?id=' + PIXEL_ID + '&amp;ev=PageView&amp;noscript=1"></noscript>\n'
       '<!-- End Meta Pixel Code -->\n')
EXCLUDE = ('p-',)  # previzualizări pentru alți clienți (ex. Dachkraft)


def csp_add(t, directive, hosts):
    m = re.search(directive + r" [^;]*", t)
    v = m.group(0)
    for h in hosts:
        if h not in v.split():
            v += ' ' + h
    return t[:m.start()] + v + t[m.end():]


def run():
    n = 0
    for p in glob.glob(S + '**/*.html', recursive=True):
        if p[len(S):].startswith(EXCLUDE):
            continue
        s = open(p, encoding='utf8').read()
        if 'meta-pixel.js' in s or '</head>' not in s:
            continue
        s = s.replace('</head>', TAG + '</head>', 1)
        open(p, 'w', encoding='utf8').write(s)
        n += 1
    h = S + '_headers'
    t = open(h, encoding='utf8').read()
    t = csp_add(t, 'img-src', ['https://www.facebook.com'])
    t = csp_add(t, 'connect-src', ['https://www.facebook.com', 'https://connect.facebook.net'])
    open(h, 'w', encoding='utf8').write(t)
    print('pixel: %d pagini' % n)


if __name__ == '__main__':
    run()
