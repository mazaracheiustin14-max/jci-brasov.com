# JCI Business la /app (aplicația membrilor). Rulează după checkin.py, înainte de security.py. Idempotent.
# 1) Construiește public/app.html + public/app/app.css + public/app/app.js din sursa unică src/app/source.html
#    (aceeași sursă e și pilotul publicat pe claude.ai). Pe site nu există script inline (CSP), iar fonturile
#    sunt cele ale site-ului, din /assets/fonts, fără cereri către terți.
# 2) Adaugă pe pagina Echipa (RO/EN) butonul de intrare în aplicație, lângă cel de check-in.
#    Legătura e într-un singur sens: site -> aplicație. Aplicația nu are niciun link către site.
# 3) Indexarea: pagina are meta robots noindex, iar worker/index.js pune antetul X-Robots-Tag. robots.txt NU blochează /app,
#    altfel motoarele de căutare nu ar mai putea citi interdicția de indexare.
import hashlib, pathlib, re
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent / 'public'
src = (HERE / 'app' / 'source.html').read_text(encoding='utf-8')

css = re.search(r'<style>(.*?)</style>', src, re.S)
js = re.search(r'<script>(.*?)</script>', src, re.S)
assert css and js, 'sursa nu are <style> si <script>'
assert len(re.findall(r'<script', src)) == 1 and len(re.findall(r'<style', src)) == 1, 'un singur <style> si un singur <script>'
css_t, js_t = css.group(1).strip() + '\n', js.group(1).strip() + '\n'
assert not re.search(r'\son[a-z]+\s*=\s*["\']', js_t), 'atribut de eveniment inline: CSP il blocheaza'
assert chr(183) not in src, 'punct de mijloc in sursa'
assert 'jci-brasov.com' not in src, 'aplicatia nu are voie sa trimita catre site'

FONTS = (
  "@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-display:swap;font-weight:200 800;"
  "src:url(/assets/fonts/plus-jakarta-sans-latin-ext-wght-normal.woff2) format('woff2');"
  "unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}\n"
  "@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-display:swap;font-weight:200 800;"
  "src:url(/assets/fonts/plus-jakarta-sans-latin-wght-normal.woff2) format('woff2');"
  "unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}\n"
)
css_t = FONTS + css_t
vc = hashlib.sha256(css_t.encode()).hexdigest()[:10]
vj = hashlib.sha256(js_t.encode()).hexdigest()[:10]

html = src[:css.start()] + f'<link rel="stylesheet" href="/app/app.css?v={vc}">' + src[css.end():js.start()] + f'<script src="/app/app.js?v={vj}" defer></script>' + src[js.end():]
html = re.sub(r'<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n?', '', html)
assert 'fonts.googleapis' not in html and '<style' not in html and html.count('<script') == 1
assert not re.search(r'https?://', html), 'pagina aplicatiei nu incarca nimic din afara site-ului'

(ROOT / 'app').mkdir(exist_ok=True)
for path, text in ((ROOT / 'app.html', html), (ROOT / 'app' / 'app.css', css_t), (ROOT / 'app' / 'app.js', js_t)):
    if not path.exists() or path.read_text(encoding='utf-8') != text:
        path.write_text(text, encoding='utf-8')
        print('scris', path.relative_to(ROOT))

# ---- Butonul de intrare pe pagina Echipa (RO/EN), lângă „Autentificare check-in” ----
TEAM = {
  'echipa.html': ('Autentificare check-in', 'Intră în JCI Business'),
  'en/echipa.html': ('Check-in login', 'Enter JCI Business'),
}
for rel, (checkin, label) in TEAM.items():
    f = ROOT / rel
    s = f.read_text(encoding='utf-8')
    if 'href="/app"' in s:
        continue
    old = f'<a class="btn btn-ghost" href="/checkin" rel="nofollow">{checkin}</a>'
    assert s.count(old) == 1, rel
    new = ('<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center">' + old +
           f'<a class="btn btn-ghost" href="/app" rel="nofollow">{label}</a></div>')
    f.write_text(s.replace(old, new, 1), encoding='utf-8')
    print('ok', rel)
