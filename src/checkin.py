# Rulează după deploy.py (și după vip.py), înainte de security.py.
# Adaugă pe paginile de confirmare a înscrierii (RO/EN) cardul „Biletul tău cu cod QR”,
# afișat doar când adresa conține codul biletului (?t=...), prin assets/js/bilet-link.js.
import pathlib
ROOT = pathlib.Path('/home/claude/site/public')
CARDS = {
  'inscriere-confirmata.html': ('Biletul tău de intrare', 'Biletul nominal cu cod QR', 'Arată codul la intrare, pentru check-in rapid. Salvează linkul sau o captură de ecran.', 'Vezi biletul cu cod QR'),
  'en/inscriere-confirmata.html': ('Your entry ticket', 'Your personal ticket with QR code', 'Show the code at the entrance for a quick check-in. Save the link or a screenshot.', 'View your QR ticket'),
}
for rel, (small, h, p, btn) in CARDS.items():
    f = ROOT / rel
    s = f.read_text()
    if 'id="c-bilet"' in s:
        continue
    card = (f'<div class="st2 main" id="c-bilet" hidden><small>{small}</small><h2>{h}</h2><p>{p}</p>'
            f'<a class="btn btn-blue" id="bilet-a" href="#">{btn}</a></div>\n  ')
    s = s.replace('<div class="steps2">\n  ', '<div class="steps2">\n  ' + card, 1) if '<div class="steps2">\n  ' in s else s.replace('<div class="steps2">', '<div class="steps2">' + card, 1)
    s = s.replace('</body>', '<script src="/assets/js/bilet-link.js"></script>\n</body>', 1)
    f.write_text(s)
    print('ok', rel)

# ---- Butonul „Acces echipă” pe pagina Echipa (RO/EN) -> /checkin ----
TEAM = {
  'echipa.html': ('Acces echipă', 'Check-in la evenimente', 'Pentru membrii echipei care scanează biletele cu cod QR la intrare.', 'Autentificare check-in'),
  'en/echipa.html': ('Team access', 'Event check-in', 'For team members scanning QR tickets at the entrance.', 'Check-in login'),
}
for rel, (tag, h, p, btn) in TEAM.items():
    f = ROOT / rel
    s = f.read_text()
    if 'id="acces-echipa"' in s:
        continue
    block = (f'<section class="section" id="acces-echipa"><div class="wrap" style="text-align:center">'
             f'<span class="tag teal">{tag}</span><h2 style="font-size:clamp(22px,2.6vw,30px)">{h}</h2>'
             f'<p class="lead" style="margin:10px auto 20px">{p}</p>'
             f'<a class="btn btn-ghost" href="/checkin" rel="nofollow">{btn}</a></div></section>\n')
    s = s.replace('</main>', block + '</main>', 1)
    f.write_text(s)
    print('ok', rel)

# ---- Raportul biletelor nominale în cardul „Acces gratuit” (RO/EN), citit de assets/js/vip.js din /api/stats ----
BOX = {
  'eveniment.html': ('bilete emise din 150', 'au confirmat venirea', 'Actualizat în timp real', '#rezerva">Înscrie-te gratuit'),
  'en/eveniment.html': ('tickets issued of 150', 'confirmed attendance', 'Updated in real time', '#rezerva">Register for free'),
}
CSS = ('<style>.tk-live{background:rgba(0,151,215,.08)!important;border-color:rgba(0,151,215,.3)!important}'
       '.tk-live .vl-top b{color:#7FD3F7!important}.tk-live .meter{position:relative}'
       '.tk-live .meter i{position:absolute;left:0;top:0;bottom:0;transition:width .8s ease}'
       '.tk-live .meter i.iss{background:rgba(0,151,215,.45)!important}.tk-live .meter i.cnf{background:linear-gradient(90deg,#0097D7,#57BCBC)!important}'
       '.tk-live .lg{display:inline-flex;align-items:center;gap:6px}.tk-live .lg i{width:10px;height:10px;border-radius:3px;display:inline-block}</style>')
for rel, (a, b, live, anchor) in BOX.items():
    f = ROOT / rel
    s = f.read_text()
    if 'data-ticketbox' in s:
        continue
    box = (CSS + '<div class="vip-live tk-live" data-ticketbox><div class="vl-top">'
           f'<span><b data-tk="issued">0</b> {a}</span><span><b data-tk="conf">0</b> {b}</span></div>'
           '<div class="meter"><i class="iss" data-tk="bar" style="width:0"></i><i class="cnf" data-tk="cbar" style="width:0"></i></div>'
           f'<div class="vl-foot"><span class="vip-dot">{live}</span></div></div>')
    key = '<div class="sp"></div><a class="btn btn-ghost" href="' + anchor
    assert key in s, rel
    s = s.replace(key, box + key, 1)
    f.write_text(s)
    print('ok', rel)
