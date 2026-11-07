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
