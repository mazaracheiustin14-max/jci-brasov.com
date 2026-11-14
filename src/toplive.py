#!/usr/bin/env python3
# Capul paginii evenimentului (14 nov 2026): titlul, cele două rapoarte în timp real (înscrieri și bilete VIP) și cronometrul
# încap pe primul ecran al telefonului, fără spațiul gol de sus. Rapoartele sunt butoane: înscrierile duc la formular (#rezerva),
# biletele VIP la cumpărare (#vip). Cifrele le completează assets/js/vip.js din /api/stats, ca în cardurile „Acces gratuit” și
# „Bilet VIP” de mai jos, care rămân neschimbate. Rulează după checkin.py și vip.py. Idempotent; înlocuiește varianta anterioară.
import pathlib, re, sys
ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent / 'public')
T = {
  'eveniment.html': dict(tag='26 noiembrie 2026', loc='CATTIA Brașov, 17:00', l1='Înscrieri', of1='din 150', left='locuri rămase', go1='Rezervă-ți locul',
                         l2='Bilete VIP', of2='din 40', go2='Cumpără biletul', live='Actualizat în timp real'),
  'en/eveniment.html': dict(tag='26 November 2026', loc='CATTIA Brașov, 5 pm', l1='Registrations', of1='of 150', left='seats left', go1='Save your seat',
                            l2='VIP tickets', of2='of 40', go2='Buy your ticket', live='Updated in real time'),
}
CSS = ('<style>#eveniment{padding-top:30px}'
       '.top-head{margin:0 0 16px}.top-head .tag{display:inline-block;margin:0 10px 10px 0}.top-head .tl-loc{font-size:14px;color:#B9BBD6;font-weight:600}'
       '.top-head h1{font-size:clamp(27px,5.2vw,64px);text-transform:uppercase;font-weight:800;letter-spacing:-.025em;line-height:1.04;margin:0}'
       '.top-live{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 6px}'
       '.top-live .tl-box{display:block;margin-top:0;padding:14px 14px 12px;color:#fff;text-decoration:none;transition:transform .15s ease,border-color .15s ease}'
       '.top-live .tl-box:hover,.top-live .tl-box:focus-visible{transform:translateY(-2px);border-color:rgba(255,255,255,.55)}'
       '.top-live .tl-lab{display:block;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#B9BBD6}'
       '.top-live .tl-big{display:block;font-size:15px;margin-top:6px}.top-live .tl-big b{font-size:30px;line-height:1;font-weight:800;color:#EFC40F}'
       '.top-live .tk-live .tl-big b{color:#7FD3F7}.top-live .meter{margin-top:10px;height:8px}'
       '.top-live .tl-sub{display:block;font-size:13px;color:#B9BBD6;margin-top:8px}.top-live .tl-sub b{color:#fff}'
       '.top-live .tl-go{display:block;margin-top:10px;font-size:14px;font-weight:800;color:#EFC40F}.top-live .tk-live .tl-go{color:#7FD3F7}'
       '.top-note{font-size:12px;color:#B9BBD6;margin:0 0 20px}'
       '@media(min-width:721px){#eveniment{padding-top:56px}.top-live{max-width:760px}.top-live .tl-box{padding:18px 20px 16px}.top-live .tl-big b{font-size:38px}}</style>')
KEY = '<section class="section dark" id="eveniment">\n  <div class="wrap">\n'
OLD = re.compile(r'<style>\.top-live\{.*?</div></div></div>\n', re.S)          # varianta din 14 nov, cu două casete mari
NEW = re.compile(r'<!--toplive-->.*?<!--/toplive-->\n', re.S)
H1 = re.compile(r'\n\s*<span class="tag">[^<]*</span>\n\s*<h1 class="as-h2">JCI Brașov Beyond the Initiative</h1>')
for rel, t in T.items():
    f = ROOT / rel
    s = f.read_text()
    s = NEW.sub('', OLD.sub('', s))
    assert KEY in s, rel
    s, n = H1.subn('', s, count=1)                                               # titlul urcă în cap; mai jos rămâne textul de prezentare
    assert n == 1 or 'as-h2">JCI Brașov Beyond the Initiative' not in s, rel
    block = ('<!--toplive-->' + CSS +
             f'<div class="top-head"><span class="tag">{t["tag"]}</span><span class="tl-loc">{t["loc"]}</span><h1>JCI Brașov Beyond the Initiative</h1></div>'
             '<div class="top-live">'
             f'<a class="vip-live tk-live tl-box" href="#rezerva" data-ticketbox><span class="tl-lab">{t["l1"]}</span>'
             f'<span class="tl-big"><b data-tk="count">0</b> {t["of1"]}</span><div class="meter"><i class="cnf" data-tk="bar" style="width:0"></i></div>'
             f'<span class="tl-sub"><b data-tk="left">150</b> {t["left"]}</span><span class="tl-go">{t["go1"]}</span></a>'
             f'<a class="vip-live tl-box" href="#vip" data-vipbox><span class="tl-lab">{t["l2"]}</span>'
             f'<span class="tl-big"><b data-vip="sold">15</b> {t["of2"]}</span><div class="meter"><i data-vip="bar" style="width:37.5%"></i></div>'
             f'<span class="tl-sub"><b data-vip="left">25</b> {t["left"]}</span><span class="tl-go">{t["go2"]}</span></a></div>'
             f'<p class="top-note"><span class="vip-dot">{t["live"]}</span></p><!--/toplive-->\n')
    f.write_text(s.replace(KEY, KEY + block, 1))
    print('ok', rel)
