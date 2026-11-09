# Securitate (rulat după deploy.py): CSP fără 'unsafe-inline' la scripturi. Calculează amprenta SHA-256 a fiecărui script inline
# de pe site și o trece în Content-Security-Policy din _headers.
import glob, re, hashlib, base64

S = '/home/claude/jci-brasov.com/public/'  # după deploy.py, ca amprentele să corespundă fișierelor publicate


def run():
    hashes = set()
    for p in glob.glob(S + '**/*.html', recursive=True):
        s = open(p, encoding='utf8').read()
        if re.search(r'<[a-z][^>]*\son[a-z]+="', s.split('<body', 1)[-1]):
            raise SystemExit('handler inline în ' + p)
        for m in re.finditer(r'<script(?![^>]*\bsrc=)(?![^>]*application/ld\+json)[^>]*>(.*?)</script>', s, re.S):
            hashes.add("'sha256-" + base64.b64encode(hashlib.sha256(m.group(1).encode('utf8')).digest()).decode() + "'")
    h = S + '_headers'
    t = open(h, encoding='utf8').read()
    src = "script-src 'self' " + ' '.join(sorted(hashes)) + " https://static.cloudflareinsights.com https://connect.facebook.net https://*.facebook.net https://*.facebook.com"
    t = re.sub(r"script-src [^;]*", src, t, count=1)
    if 'X-Permitted-Cross-Domain-Policies' not in t:
        t = t.replace('  Cross-Origin-Opener-Policy: same-origin', '  Cross-Origin-Opener-Policy: same-origin\n  X-Permitted-Cross-Domain-Policies: none', 1)
    open(h, 'w', encoding='utf8').write(t)
    print('csp: %d scripturi inline' % len(hashes))


if __name__ == '__main__':
    run()
