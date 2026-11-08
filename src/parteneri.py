#!/usr/bin/env python3
"""Parteneri confirmați (BCR Asigurări, CATTIA Brașov) și bifa de acord BCR (8 nov 2026).

Rulează după deploy.py, vip.py și checkin.py, înainte de security.py.
Lucrează direct pe public/eveniment.html și public/en/eveniment.html. Idempotent.
Uz: python3 src/parteneri.py [cale_public]  (implicit ./public)
"""
import sys, pathlib

PUB = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "public")

T = {
    "ro": {
        "file": PUB / "eveniment.html",
        "anchor": '<span class="tag blue">Parteneri</span>\n    <h2>Parteneriat de sponsorizare</h2>',
        "block": '''<span class="tag blue">Parteneri</span>
    <h2>Partenerii evenimentului</h2>
    <div class="packs two partners-now">
      <div class="pack hi"><small>Partenerul Panelului I</small><div class="price" style="font-size:30px">BCR Asigurări</div>
        <ul><li>Susține panelul „Puterea comunității”</li><li>Un reprezentant BCR Asigurări printre invitații panelului</li></ul></div>
      <div class="pack"><small>Partener de locație</small><div class="price" style="font-size:30px">CATTIA Brașov</div>
        <ul><li>Centrul de Afaceri, Transfer Tehnologic și Incubator</li><li>Strada Institutului 35, Brașov</li></ul></div>
    </div>
    <h2 style="margin-top:56px">Parteneriat de sponsorizare</h2>''',
        "venue": '\n    <p class="venue">Partener de locație: <b>CATTIA Brașov</b>, Centrul de Afaceri, Transfer Tehnologic și Incubator.</p>',
        "mk": '<label class="check"><input type="checkbox" name="acord_marketing" value="da"><span>Vreau să primesc invitații la următoarele evenimente JCI Brașov.</span></label>',
        "bcr": '<label class="check"><input type="checkbox" name="acord_bcr" value="da"><span>Doresc să fiu contactat de BCR Asigurări, partenerul evenimentului. JCI Brașov îi transmite doar numele, emailul și telefonul meu.</span></label>',
        "faq_old": "Le folosim doar pentru organizarea evenimentului și, dacă ai bifat, pentru invitații la evenimentele JCI Brașov. Nu le transmitem altor organizații.",
        "faq_new": "Le folosim doar pentru organizarea evenimentului și, dacă ai bifat, pentru invitații la evenimentele JCI Brașov. Numele, emailul și telefonul ajung la BCR Asigurări numai dacă ai bifat separat acordul pentru asta. Nu le transmitem altor organizații.",
    },
    "en": {
        "file": PUB / "en" / "eveniment.html",
        "anchor": '<span class="tag blue">Partners</span>\n    <h2>Sponsorship partnership</h2>',
        "block": '''<span class="tag blue">Partners</span>
    <h2>Event partners</h2>
    <div class="packs two partners-now">
      <div class="pack hi"><small>Panel I partner</small><div class="price" style="font-size:30px">BCR Asigurări</div>
        <ul><li>Supports the panel “The Power of Community”</li><li>A BCR Asigurări representative joins the panel</li></ul></div>
      <div class="pack"><small>Venue partner</small><div class="price" style="font-size:30px">CATTIA Brașov</div>
        <ul><li>Business Centre, Technology Transfer and Incubator</li><li>Strada Institutului 35, Brașov</li></ul></div>
    </div>
    <h2 style="margin-top:56px">Sponsorship partnership</h2>''',
        "venue": '\n    <p class="venue">Venue partner: <b>CATTIA Brașov</b>, Business Centre, Technology Transfer and Incubator.</p>',
        "mk": '<label class="check"><input type="checkbox" name="acord_marketing" value="da"><span>I would like to receive invitations to future JCI Brașov events.</span></label>',
        "bcr": '<label class="check"><input type="checkbox" name="acord_bcr" value="da"><span>I would like to be contacted by BCR Asigurări, the event partner. JCI Brașov shares only my name, email and phone number.</span></label>',
        "faq_old": "We use it only to organise the event and, if you opted in, to invite you to future JCI Brașov events. We do not share it with other organisations.",
        "faq_new": "We use it only to organise the event and, if you opted in, to invite you to future JCI Brașov events. Your name, email and phone number go to BCR Asigurări only if you tick the separate consent box for it. We do not share it with other organisations.",
    },
}

for lang, t in T.items():
    p = t["file"]
    h = p.read_text(encoding="utf-8")
    if "partners-now" in h:
        print(lang, "deja aplicat"); continue
    for key in ("anchor", "venue", "mk", "faq_old"):
        assert t[key] in h, f"{lang}: nu găsesc {key}"
    h = h.replace(t["anchor"], t["block"], 1)
    h = h.replace(t["venue"], "", 1)
    h = h.replace(t["mk"], t["mk"] + "\n      " + t["bcr"], 1)
    n = h.count(t["faq_old"])
    h = h.replace(t["faq_old"], t["faq_new"])
    p.write_text(h, encoding="utf-8")
    print(lang, "ok, FAQ înlocuit de", n, "ori")
