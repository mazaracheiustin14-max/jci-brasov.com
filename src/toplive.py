#!/usr/bin/env python3
# Rapoartele în timp real (înscrieri și bilete VIP) urcate în capul paginii evenimentului, deasupra cronometrului (14 nov 2026).
# Sunt primul lucru văzut de cine vine din reclame. Cifrele le completează assets/js/vip.js din /api/stats, la fel ca în
# cardurile „Acces gratuit” și „Bilet VIP”, care rămân neschimbate mai jos. Rulează după checkin.py și vip.py. Idempotent.
import pathlib, sys
ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent / 'public')
T = {
  'eveniment.html': ('Înscrieri la eveniment', 'înscriși din 150', 'locuri rămase', 'Bilete VIP', 'locuri VIP disponibile', 'din 40 ocupate', 'Actualizat în timp real'),
  'en/eveniment.html': ('Event registrations', 'registered of 150', 'seats left', 'VIP tickets', 'VIP seats available', 'of 40 taken', 'Updated in real time'),
}
CSS = ('<style>.top-live{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:0 0 26px}.top-live .vip-live{margin-top:0}'
       '.top-live .tl-lab{display:block;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px;color:#B9BBD6}'
       '@media(max-width:720px){.top-live{grid-template-columns:1fr}}</style>')
KEY = '<section class="section dark" id="eveniment">\n  <div class="wrap">\n'
for rel, (l1, a, b, l2, c, d, live) in T.items():
    f = ROOT / rel
    s = f.read_text()
    if 'class="top-live"' in s:
        continue
    assert KEY in s, rel
    box = (CSS + '<div class="top-live">'
           f'<div class="vip-live tk-live" data-ticketbox><span class="tl-lab">{l1}</span><div class="vl-top"><span><b data-tk="count">0</b> {a}</span>'
           f'<span><b data-tk="left">150</b> {b}</span></div><div class="meter"><i class="cnf" data-tk="bar" style="width:0"></i></div>'
           f'<div class="vl-foot"><span class="vip-dot">{live}</span></div></div>'
           f'<div class="vip-live" data-vipbox><span class="tl-lab">{l2}</span><div class="vl-top"><span><b data-vip="left">25</b> {c}</span>'
           f'<span><b data-vip="sold">15</b> {d}</span></div><div class="meter"><i data-vip="bar" style="width:37.5%"></i></div>'
           f'<div class="vl-foot"><span class="vip-dot">{live}</span><span data-vip="last" hidden></span></div></div></div>\n')
    f.write_text(s.replace(KEY, KEY + box, 1))
    print('ok', rel)
