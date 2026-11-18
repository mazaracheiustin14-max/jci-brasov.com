#!/usr/bin/env python3
"""Parteneri noi la eveniment (18 nov 2026): Organizația Femeilor Antreprenor (partener de comunitate)
și Adorjan Balazs Fotograf (partener foto), cu logo, în blocul „Partenerii evenimentului” (RO/EN),
plus mențiunea în asistentul „Întreabă-ne” (worker/kb.js).

Rulează după parteneri.py, înainte de security.py. Idempotent.
Logouri: public/assets/img/partener-ofa.webp, public/assets/img/partener-adorjan-balazs.webp
Uz: python3 src/parteneri2.py [cale_public]  (implicit ./public)
"""
import sys, pathlib

PUB = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "public")
KB = pathlib.Path(__file__).resolve().parent.parent / "worker" / "kb.js"

LOGO = ('<div class="plogo" style="background:{bg};border-radius:12px;padding:{pad};margin:4px 0 14px;'
        'display:flex;align-items:center;justify-content:center;height:110px">'
        '<img src="/assets/img/{f}" alt="{alt}" loading="lazy" style="max-height:100%;max-width:100%;width:auto"></div>')

def card(role, name, logo, lis):
    return (f'\n      <div class="pack"><small>{role}</small>{logo}'
            f'<div class="price" style="font-size:30px">{name}</div>\n        <ul>'
            + "".join(f"<li>{x}</li>" for x in lis) + '</ul></div>')

OFA_LOGO = LOGO.format(bg="#fff", pad="10px", f="partener-ofa.webp", alt="Organizația Femeilor Antreprenor")
FOTO_LOGO = LOGO.format(bg="#130F2D", pad="18px 22px", f="partener-adorjan-balazs.webp", alt="Adorjan Balazs Fotograf")

T = {
    "ro": (PUB / "eveniment.html", '<li>Strada Institutului 35, Brașov</li></ul></div>\n    </div>',
           card("Partener de comunitate", "Organizația Femeilor Antreprenor", OFA_LOGO,
                ["Aduce la eveniment o parte din comunitatea sa", "Moderează panelurile evenimentului"])
           + card("Partener foto", "Adorjan Balazs Fotograf", FOTO_LOGO,
                  ["Fotografiile oficiale ale evenimentului", "Parteneriat în regim de barter"])),
    "en": (PUB / "en" / "eveniment.html", '<li>Strada Institutului 35, Brașov</li></ul></div>\n    </div>',
           card("Community partner", "Organizația Femeilor Antreprenor", OFA_LOGO.replace('alt="Organizația Femeilor Antreprenor"', 'alt="Women Entrepreneurs Organisation (OFA)"'),
                ["Brings part of its community to the event", "Moderates the event panels"])
           + card("Photo partner", "Adorjan Balazs Fotograf", FOTO_LOGO,
                  ["Official event photography", "Barter partnership"])),
}

for lang, (p, anchor, cards) in T.items():
    h = p.read_text(encoding="utf-8")
    if "partener-ofa.webp" in h:
        print(lang, "deja aplicat"); continue
    assert anchor in h, f"{lang}: nu găsesc ancora"
    h = h.replace(anchor, anchor.replace("\n    </div>", cards + "\n    </div>"), 1)
    p.write_text(h, encoding="utf-8")
    print(lang, "ok")

if KB.exists():
    t = KB.read_text(encoding="utf-8")
    old = "BCR Asigurări, cu un reprezentant printre invitații panelului."
    add = (" Partener de comunitate: Organizația Femeilor Antreprenor (OFA), care aduce la eveniment o parte din comunitatea sa"
           " și moderează panelurile. Partener foto: Adorjan Balazs Fotograf, care realizează fotografiile oficiale ale evenimentului.")
    if "Adorjan Balazs" in t:
        print("kb deja aplicat")
    elif old in t:
        KB.write_text(t.replace(old, old + add, 1), encoding="utf-8"); print("kb ok")
    else:
        print("kb: ancora lipsește, de completat manual")
