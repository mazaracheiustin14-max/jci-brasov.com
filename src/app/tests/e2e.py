import sys, re, json
from playwright.sync_api import sync_playwright
BASE = "http://127.0.0.1:8787"
KEY = "Cheie-Locala-Test-2026"
SH = "/tmp/jcib-e2e/"
import os; os.makedirs(SH, exist_ok=True)
fails = 0; n = 0
def ok(c, m):
    global fails, n
    n += 1
    if not c: fails += 1
    print(("ok  : " if c else "ESEC: ") + m)

with sync_playwright() as p:
    br = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    errs = []
    def ctx(dark=False, w=390, h=844):
        c = br.new_context(viewport={"width": w, "height": h}, color_scheme="dark" if dark else "light", device_scale_factor=2)
        pg = c.new_page()
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
        return c, pg
    def links(pg):
        return pg.eval_on_selector_all("a[href]", "els=>els.map(e=>e.getAttribute('href'))")
    alllinks = set()

    # 1) pagina Echipa -> buton -> /app
    c0, pg = ctx(w=1200, h=900)
    pg.goto(BASE + "/echipa"); pg.wait_for_load_state("networkidle")
    b = pg.locator('#acces-echipa a[href="/app"]')
    ok(b.count() == 1 and "JCI Business" in b.inner_text(), "butonul de intrare exista pe pagina Echipa")
    pg.locator("#acces-echipa").scroll_into_view_if_needed(); pg.wait_for_timeout(400)
    pg.locator("#acces-echipa").screenshot(path=SH + "echipa_buton.png")
    b.click(); pg.wait_for_url(re.compile(r"/app$")); pg.wait_for_selector("#svform")
    ok(True, "click pe buton duce la /app, ecranul de intrare")
    alllinks |= set(links(pg))
    pg.set_viewport_size({"width": 390, "height": 844}); pg.wait_for_timeout(300)
    pg.screenshot(path=SH + "login.png")
    # cod gresit
    pg.fill("#lg_code", "AAAA-BBBB-CCCC"); pg.click("#svform button[type=submit]"); pg.wait_for_function("() => document.getElementById('lgerr').textContent.length>0")
    ok("Cod invalid" in pg.inner_text("#lgerr"), "cod gresit: mesaj de eroare")
    # 2) moderator
    pg.click("details summary"); pg.fill("#lg_key", KEY); pg.click("#modform button[type=submit]")
    pg.wait_for_selector("nav.tabs", timeout=15000)
    ok(pg.locator("#brsel").count() == 1, "moderatorul vede selectorul de filiala")
    pg.click('nav.tabs button[data-id="cotizatii"]'); pg.click('button[data-act="fv"][data-id="members"]')
    def add_member(name):
        pg.click('button[data-act="newmember"]'); pg.fill("#m_name", name); pg.click("#sheet form button[type=submit]")
        pg.wait_for_selector(f'[data-act="member"]:has-text("{name}")', timeout=10000)
    def gen_code(name):
        pg.click(f'[data-act="member"]:has-text("{name}")'); pg.click('button[data-act="gencode"]')
        pg.wait_for_selector("#sheet p.num"); code = pg.inner_text("#sheet p.num").strip()
        pg.click('#sheet [data-act="closesheet"]'); return code
    add_member("Ana Președinte"); add_member("Tudor Trezorier")
    ok(pg.locator('[data-act="member"]:has-text("Cont neactivat")').count() == 2, "membrii noi apar cu cont neactivat")
    pg.click('nav.tabs button[data-id="tablou"]')
    def role(label, r):
        pg.click('button[data-act="newrole"]'); pg.select_option("#ru", label=label); pg.select_option("#rr", r); pg.select_option("#rb", "Brașov")
        pg.click("#sheet form button[type=submit]"); pg.wait_for_function("() => !document.getElementById('sheetwrap').classList.contains('open')")
    role("Ana Președinte (Brașov)", "president"); role("Tudor Trezorier (Brașov)", "treasurer")
    pg.wait_for_selector('text=Ana Președinte')
    pg.screenshot(path=SH + "mod_tablou.png", full_page=True)
    pg.click('nav.tabs button[data-id="cotizatii"]'); pg.click('button[data-act="fv"][data-id="members"]')
    code_ana = gen_code("Ana Președinte"); code_tudor = gen_code("Tudor Trezorier")
    ok(re.fullmatch(r"[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}", code_ana) is not None, "moderatorul genereaza cod pentru presedinte: format corect")
    alllinks |= set(links(pg))
    ok(pg.locator('button[data-act="newfee"]').count() == 0, "moderatorul nu are butoane de scriere financiara")

    # 3) presedinte
    c1, p1 = ctx()
    p1.goto(BASE + "/app"); p1.wait_for_selector("#svform"); p1.fill("#lg_code", code_ana.lower()); p1.click("#svform button[type=submit]")
    p1.wait_for_selector("nav.tabs", timeout=15000)
    ok("Profilul tău nu e completat" in p1.inner_text("#app"), "presedintele intra direct, cu indemn sa-si completeze profilul")
    p1.click('button[data-act="goprofil"]'); p1.wait_for_selector("#pform")
    ok(p1.input_value("#f_name") == "Ana Președinte", "formularul de profil are numele din evidenta")
    ok(p1.locator("#f_branch").count() == 0 and "Brașov" in p1.inner_text("#pform"), "filiala e fixata de server, nu se alege")
    p1.fill("#f_firm", "Firma Ana SRL"); p1.check('input[name="c_dir"]'); p1.click("#pform button[type=submit]"); p1.wait_for_timeout(1200)
    p1.screenshot(path=SH + "pres_profil.png", full_page=True)
    ok(p1.locator('nav.tabs button[data-id="cheltuieli"]').count() == 1 and p1.locator("#brsel").count() == 0, "presedintele vede tablourile filialei sale, fara selector de filiale")
    p1.click('nav.tabs button[data-id="cotizatii"]'); p1.click('button[data-act="fv"][data-id="members"]')
    p1.click('button[data-act="newmember"]'); p1.fill("#m_name", "Bogdan Membru"); p1.click("#sheet form button[type=submit]")
    p1.wait_for_selector('[data-act="member"]:has-text("Bogdan Membru")')
    p1.click('[data-act="member"]:has-text("Bogdan Membru")'); p1.click('button[data-act="gencode"]'); p1.wait_for_selector("#sheet p.num")
    code_bob = p1.inner_text("#sheet p.num").strip(); p1.screenshot(path=SH + "cod.png"); p1.click('#sheet [data-act="closesheet"]')
    ok(len(code_bob) == 14, "presedintele genereaza cod pentru membru")
    ok(p1.locator('[data-act="member"]:has-text("Ana Președinte") >> text=Cont activ').count() >= 1, "contul presedintelui apare activ")
    # cotizatie pentru Bogdan
    p1.click('button[data-act="fv"][data-id="fees"]'); p1.click('button[data-act="newfee"]')
    p1.wait_for_selector("#sheet form")
    p1.screenshot(path=SH + "fee_sheet.png")
    alllinks |= set(links(p1))

    # 4) membru
    c2, p2 = ctx()
    p2.goto(BASE + "/app"); p2.wait_for_selector("#svform"); p2.fill("#lg_code", code_bob); p2.click("#svform button[type=submit]")
    p2.wait_for_selector("#gateform", timeout=15000)
    p2.fill("#f_firm", "Atelier Bogdan"); p2.fill("#f_phone", "0722000111"); p2.check('input[name="c_dir"]'); p2.check('input[name="c_phone"]'); p2.check("#agree"); p2.click("#gatego")
    p2.wait_for_selector("nav.tabs", timeout=15000)
    ok(p2.locator("nav.tabs button").count() == 2, "membrul vede doar Director si Profilul meu")
    p2.wait_for_selector("text=Ana Președinte")
    ok("Firma Ana SRL" in p2.inner_text("#main"), "membrul vede in director profilul cu acord")
    p2.screenshot(path=SH + "membru_director.png", full_page=True)
    # membrul nu poate citi date financiare nici prin API
    r = p2.evaluate("""async()=>{const r=await fetch('/api/app/pull',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paths:['branches/Brașov/fees','branches/Brașov/members','audit','roles']})});return r.json()}""")
    ok(r["errors"].get("branches/Brașov/fees") == 403 and r["errors"].get("branches/Brașov/members") == 403 and r["errors"].get("audit") == 403, "API: membrul nu citeste cotizatii, evidenta sau jurnalul")
    # codul folosit nu mai merge
    c3, p3 = ctx()
    p3.goto(BASE + "/app"); p3.wait_for_selector("#svform"); p3.fill("#lg_code", code_bob); p3.click("#svform button[type=submit]")
    p3.wait_for_function("() => document.getElementById('lgerr').textContent.length>0")
    ok("Cod invalid" in p3.inner_text("#lgerr"), "codul folosit o data nu mai poate fi refolosit")
    # presedintele vede acum membrul in director (interogare periodica / la revenire)
    p1.click('#sheet [data-act="closesheet"]'); p1.click('nav.tabs button[data-id="director"]')
    p1.reload(); p1.wait_for_selector("nav.tabs"); p1.wait_for_selector("text=Bogdan Membru", timeout=15000)
    ok(True, "presedintele vede membrul nou in director dupa reincarcare")
    p1.screenshot(path=SH + "pres_director.png", full_page=True)
    p1.click('nav.tabs button[data-id="tablou"]'); p1.wait_for_timeout(600); p1.screenshot(path=SH + "pres_tablou.png", full_page=True)
    ok(p1.locator('button[data-act="newrole"]').count() == 0, "presedintele nu atribuie roluri (doar moderatorul)")
    # profilul membrului + iesire din cont
    p2.click('nav.tabs button[data-id="profil"]'); p2.wait_for_selector('button[data-act="logout"]')
    p2.screenshot(path=SH + "membru_profil.png", full_page=True)
    alllinks |= set(links(p2))
    p2.locator('#main button[data-act="logout"]').click(); p2.wait_for_selector("#svform", timeout=15000)
    ok(True, "iesirea din cont duce inapoi la ecranul de intrare")
    r = p2.evaluate("() => fetch('/api/app/me').then(r=>r.status)")
    ok(r == 401, "dupa iesire sesiunea nu mai e valida")

    # 5) predarea mandatului (moderator): Ana -> Tudor
    pg.click('nav.tabs button[data-id="tablou"]'); pg.reload(); pg.wait_for_selector("nav.tabs"); pg.click('nav.tabs button[data-id="tablou"]')
    pg.wait_for_selector('[data-act="role"]:has-text("Ana Președinte")', timeout=15000)
    pg.click('[data-act="role"]:has-text("Ana Președinte")'); pg.click('button[data-act="handover"]')
    pg.wait_for_selector("#hu"); pg.select_option("#hu", label="Tudor Trezorier"); pg.click("#sheet form button[type=submit]")
    pg.wait_for_function("() => !document.getElementById('sheetwrap').classList.contains('open')"); pg.wait_for_timeout(800)
    r = pg.evaluate("""async()=>{const r=await fetch('/api/app/pull',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paths:['roles']})});return r.json()}""")
    roles = {x["id"]: x["role"] for x in r["data"]["roles"]}
    ok(list(roles.values()).count("president") == 1 and len(roles) == 1, "predarea mandatului: un singur presedinte, fostul pierde rolul")
    p1.reload(); p1.wait_for_selector("nav.tabs"); p1.wait_for_timeout(800)
    ok(p1.locator("nav.tabs button").count() == 2, "fostul presedinte ramane membru simplu dupa predare")

    # 6) tema inchisa + desktop
    c4, p4 = ctx(dark=True)
    p4.goto(BASE + "/app"); p4.wait_for_selector("#svform"); p4.screenshot(path=SH + "login_dark.png")
    p4.fill("#lg_code", code_tudor); p4.click("#svform button[type=submit]"); p4.wait_for_selector("nav.tabs", timeout=15000)
    p4.click('nav.tabs button[data-id="tablou"]'); p4.wait_for_timeout(600); p4.screenshot(path=SH + "tablou_dark.png", full_page=True)
    ok(p4.locator('nav.tabs button[data-id="cheltuieli"]').count() == 1, "noul presedinte (fost trezorier) intra cu codul lui si are tablourile")
    c5, p5 = ctx(w=1280, h=800)
    p5.goto(BASE + "/app?demo"); p5.wait_for_selector("nav.tabs"); p5.wait_for_timeout(500); p5.screenshot(path=SH + "demo_desktop.png")
    ok("Mod demonstrativ" in p5.inner_text("#app"), "/app?demo porneste modul demonstrativ, fara server")
    alllinks |= set(links(p5))

    bad = [l for l in alllinks if not (l.startswith("#") or l.startswith("mailto:") or l.startswith("tel:"))]
    ok(not bad, "aplicatia nu contine niciun link catre site sau in afara: " + json.dumps(sorted(alllinks), ensure_ascii=False))
    csp = [e for e in errs if "Content Security Policy" in e or "Refused" in e]
    ok(not csp, "nicio incalcare CSP: " + json.dumps(csp[:3], ensure_ascii=False))
    other = [e for e in errs if e not in csp and "ERR_TUNNEL_CONNECTION_FAILED" not in e and "401" not in e and "400" not in e and "403" not in e]
    ok(not other, "nicio eroare de script in consola: " + json.dumps(other[:4], ensure_ascii=False))
    br.close()
print(f"\n{n-fails}/{n} ok, {fails} esecuri")
