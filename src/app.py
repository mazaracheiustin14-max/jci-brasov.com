# JCI Business la /app (aplicația membrilor). Rulează după checkin.py și pixel.py, înainte de security.py. Idempotent.
#   python3 src/app.py                  construiește public/app.html și public/app/*
#   python3 src/app.py --single F.html  scrie și o variantă într-un singur fișier (CSS și JS în pagină), pentru testele jsdom
#
# 1) Sursa e pe module, în src/app/: index.html (scheletul), css/*.css, js/*.js (în ordine alfabetică), img/.
#    Build-ul le lipește în public/app/app.css și public/app/app.js. Fără script inline (CSP), fără nimic din afara site-ului.
#    Fișierele primesc ?v=<amprentă>, deci se pot ține în cache un an (antetul îl pune worker/index.js).
# 2) Adaugă pe pagina Echipa (RO/EN) butonul de intrare în aplicație, lângă cel de check-in.
#    Legătura e într-un singur sens: site -> aplicație. Aplicația nu are niciun link către site.
# 3) Indexarea: pagina are meta robots noindex, iar worker/index.js pune antetul X-Robots-Tag. robots.txt NU blochează /app,
#    altfel motoarele de căutare nu ar mai putea citi interdicția de indexare.
import hashlib, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / 'app'
ROOT = HERE.parent / 'public'
OUT = ROOT / 'app'


def read_all(folder, ext):
    files = sorted((SRC / folder).glob('*.' + ext))
    assert files, 'lipsesc fișierele din ' + folder
    return ''.join(f.read_text(encoding='utf-8').rstrip() + '\n' for f in files)


def ver(data):
    return hashlib.sha256(data if isinstance(data, bytes) else data.encode()).hexdigest()[:10]


css_src, js_src = read_all('css', 'css'), read_all('js', 'js')
shell = (SRC / 'index.html').read_text(encoding='utf-8')
logo, icon = (SRC / 'img' / 'logo.png').read_bytes(), (SRC / 'img' / 'icon.png').read_bytes()

# ---- verificări: regulile aplicației ----
everything = css_src + js_src + shell
assert chr(183) not in everything, 'punct de mijloc în sursă'
assert 'jci-brasov.com' not in everything, 'aplicația nu are voie să trimită către site'
assert not re.search(r'\son(?:click|dblclick|change|submit|input|load|error|focus|blur|key[a-z]+|mouse[a-z]+|touch[a-z]+|pointer[a-z]+)=', js_src + shell), 'atribut de eveniment inline: CSP îl blochează'
assert '<script' not in shell and '<style' not in shell and '<!--CSS-->' in shell and '<!--JS-->' in shell
assert not re.search(r'https?://', shell), 'pagina aplicației nu încarcă nimic din afara site-ului'
assert js_src.count('"/app/logo.png"') == 1 and shell.count('"/app/icon.png"') == 1

FONTS = (
  "@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-display:swap;font-weight:200 800;"
  "src:url(/assets/fonts/plus-jakarta-sans-latin-ext-wght-normal.woff2) format('woff2');"
  "unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}\n"
  "@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-display:swap;font-weight:200 800;"
  "src:url(/assets/fonts/plus-jakarta-sans-latin-wght-normal.woff2) format('woff2');"
  "unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}\n"
)
css_out = FONTS + css_src
js_out = js_src.replace('"/app/logo.png"', '"/app/logo.png?v=' + ver(logo) + '"')
html = (shell
        .replace('"/app/icon.png"', '"/app/icon.png?v=' + ver(icon) + '"')
        .replace('<!--CSS-->', '<link rel="stylesheet" href="/app/app.css?v=' + ver(css_out) + '">')
        .replace('<!--JS-->', '<script src="/app/app.js?v=' + ver(js_out) + '" defer></script>'))


def put(path, data):
    old = path.read_bytes() if path.exists() else None
    new = data if isinstance(data, bytes) else data.encode('utf-8')
    if old != new:
        path.write_bytes(new)
        print('scris', path.relative_to(ROOT))


OUT.mkdir(exist_ok=True)
put(ROOT / 'app.html', html)
put(OUT / 'app.css', css_out)
put(OUT / 'app.js', js_out)
put(OUT / 'logo.png', logo)
put(OUT / 'icon.png', icon)

# ---- varianta într-un singur fișier, pentru testele jsdom (nu se publică) ----
if '--single' in sys.argv:
    target = pathlib.Path(sys.argv[sys.argv.index('--single') + 1])
    single = shell.replace('<!--CSS-->', '<style>\n' + css_src + '</style>').replace('<!--JS-->', '<script>\n' + js_src + '</script>')
    target.write_text(single, encoding='utf-8')
    print('scris', target)

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
