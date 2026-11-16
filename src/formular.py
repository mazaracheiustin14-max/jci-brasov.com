"""Validare la trimitere pentru formularele de pe site (14 nov 2026 -> 16 nov 2026).

Rulează după deploy.py, vip.py, checkin.py, parteneri.py, pixel.py și domenii.py. Idempotent. Nu adaugă scripturi inline,
deci security.py nu trebuie rulat din cauza lui.

Pune assets/js/formular.js (cu versiune din hash de conținut) pe paginile cu formulare care trimit la /api/inscriere sau /api/form
(eveniment și inscriere, RO/EN) și adaugă stilurile stării de eroare în style.css. Scriptul listează toate câmpurile obligatorii
lipsă, marchează câmpurile (aria-invalid și clasa „bad”) și nu lasă formularul să plece până nu e complet.
"""
import hashlib
import os
import re

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..') + '/'
P = R + 'public/'
PAGES = ['eveniment.html', 'inscriere.html', 'en/eveniment.html', 'en/inscriere.html']
CSS_MARK = '/* formulare: eroare la câmpuri lipsă */'
CSS = CSS_MARK + '''
.form-msg.err{background:#47181C;color:#FFD9D2;border:1px solid #D64545}
.field.bad input,.field.bad select,.field.bad textarea{border-color:#D64545!important;box-shadow:0 0 0 2px rgba(214,69,69,.35)}
.field.bad label{color:#FFB4A8}
.check.bad{outline:1.5px solid #D64545;outline-offset:4px;border-radius:10px}
'''


def run():
    v = hashlib.md5(open(P + 'assets/js/formular.js', 'rb').read()).hexdigest()[:8]
    tag = '<script src="/assets/js/formular.js?v=%s" defer></script>' % v
    for pg in PAGES:
        p = P + pg
        s = open(p, encoding='utf-8').read()
        if '/assets/js/formular.js' in s:
            s = re.sub(r'<script src="/assets/js/formular\.js\?v=[0-9a-f]+" defer></script>', tag, s)
        else:
            s = s.replace('</body>', tag + '\n</body>', 1)
        open(p, 'w', encoding='utf-8').write(s)
    css = P + 'assets/css/style.css'
    c = open(css, encoding='utf-8').read()
    if CSS_MARK not in c:
        open(css, 'a', encoding='utf-8').write('\n' + CSS)
    print('formular: validarea formularelor pusă pe', len(PAGES), 'pagini')


if __name__ == '__main__':
    run()
