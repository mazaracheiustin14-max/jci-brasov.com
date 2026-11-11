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
    def sheet_closed(pg):
        pg.wait_for_function("() => !document.getElementById('sheetwrap').classList.contains('open')")
    def submit(pg):
        pg.click("#sheet form button[type=submit]")
    def shown_code(pg):
        pg.wait_for_selector("#sheet p.num"); c = pg.inner_text("#sheet p.num").strip()
        pg.click('#sheet [data-act="closesheet"]'); return c
    def login(code, dark=False):
        c, q = ctx(dark=dark)
        q.goto(BASE + "/app"); q.wait_for_selector("#svform"); q.fill("#lg_code", code.lower()); q.click("#svform button[type=submit]")
        return q
    def tabs(pg):
        return pg.eval_on_selector_all("nav.tabs button", "els=>els.map(e=>e.getAttribute('data-id'))")
    def pull(pg, paths):
        return pg.evaluate("async(p)=>{const r=await fetch('/api/app/pull',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paths:p})});return r.json()}", paths)
    def gate(pg, firm):
        pg.wait_for_selector("#gateform", timeout=15000)
        pg.fill("#f_firm", firm); pg.check('input[name="c_dir"]'); pg.check("#agree"); pg.click("#gatego")
        pg.wait_for_selector("nav.tabs", timeout=15000)

    # 2) administratorul tehnic: doar Structura, numeste presedintele national
    pg.click("details summary"); pg.fill("#lg_key", KEY); pg.click("#modform button[type=submit]")
    pg.wait_for_selector("nav.tabs", timeout=15000)
    ok(tabs(pg) == ["structura"], "administratorul vede doar fila Structura")
    ok(pg.locator("#brsel").count() == 0 and pg.locator('[data-act="goprofil"]').count() == 0, "administratorul nu are selector de filiala si nici profil")
    pg.wait_for_selector('text=Nenumit')
    ok(pg.locator('[data-act="branch"]').count() == 3, "Structura: cele trei filiale initiale")
    pg.click('button[data-act="natset"]'); pg.select_option("#ns_b", "Brașov"); pg.fill("#ns_n", "Radu Național"); submit(pg)
    code_nat = shown_code(pg)
    ok(re.fullmatch(r"[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}", code_nat) is not None, "numirea presedintelui national intoarce un cod de intrare")
    pg.screenshot(path=SH + "e1_structura_admin.png")
    r = pull(pg, ["branches/Brașov/members", "branches/Brașov/fees", "branches/Brașov/expenses", "branches/Brașov/codes"])
    ok(all(r["errors"].get(k) == 403 for k in ["branches/Brașov/members", "branches/Brașov/fees", "branches/Brașov/expenses"]) and not r.get("data", {}).get("branches/Brașov/codes"), "API: administratorul nu citeste evidenta filialelor (codurile nu se vad)")
    alllinks |= set(links(pg))

    # 3) presedintele national: gate, apoi adauga o filiala cu presedinte
    cn, pn = ctx(); pn.goto(BASE + "/app"); pn.wait_for_selector("#svform"); pn.fill("#lg_code", code_nat); pn.click("#svform button[type=submit]")
    gate(pn, "Firma Radu SRL")
    ok(tabs(pn) == ["director", "structura", "profil"], "presedintele national: Director, Structura, Profilul meu")
    ok(pn.locator("#brsel").count() == 0, "presedintele national nu are selector de filiala")
    pn.click('nav.tabs button[data-id="structura"]'); pn.wait_for_selector('text=Radu Național')
    ok(pn.locator('button[data-act="natset"]').count() == 0 and pn.locator('button[data-act="handover"]').count() == 1, "national: Preda functia, fara Numeste presedintele national")
    pn.click('button[data-act="addbranch"]'); pn.fill("#ab_n", "Sibiu"); pn.fill("#ab_p", "Ana Președinte"); submit(pn)
    pn.wait_for_selector("#sheet p.num"); pn.screenshot(path=SH + "e1_filiala_noua_cod.png")
    code_ana = shown_code(pn)
    pn.wait_for_selector('[data-act="branch"][data-id="Sibiu"]', timeout=15000)
    ok(pn.locator('[data-act="branch"][data-id="Sibiu"]').count() == 1, "filiala noua apare in Structura")
    pn.screenshot(path=SH + "e1_structura_national.png")
    r = pull(pn, ["branches/Sibiu/members", "branches/Brașov/fees", "audit"])
    ok(r["errors"].get("branches/Sibiu/members") == 403 and r["errors"].get("branches/Brașov/fees") == 403, "API: presedintele national nu citeste evidenta unei filiale")
    alllinks |= set(links(pn))

    # 4) presedintele filialei noi
    c1, p1 = ctx()
    p1.goto(BASE + "/app"); p1.wait_for_selector("#svform"); p1.fill("#lg_code", code_ana.lower()); p1.click("#svform button[type=submit]")
    p1.wait_for_selector("nav.tabs", timeout=15000)
    ok("Profilul tău nu e completat" in p1.inner_text("#app"), "presedintele intra direct, cu indemn sa-si completeze profilul")
    p1.click('button[data-act="goprofil"]'); p1.wait_for_selector("#pform")
    ok(p1.input_value("#f_name") == "Ana Președinte" and p1.locator("#f_branch").count() == 0, "profilul are numele din evidenta, filiala fixata de server")
    p1.fill("#f_firm", "Firma Ana SRL"); p1.check('input[name="c_dir"]'); p1.click("#pform button[type=submit]"); p1.wait_for_timeout(1200)
    ok(p1.locator('nav.tabs button[data-id="cheltuieli"]').count() == 1 and p1.locator("#brsel").count() == 0, "presedintele vede tablourile filialei sale")
    p1.click('nav.tabs button[data-id="cotizatii"]'); p1.click('button[data-act="fv"][data-id="members"]')
    def add_member(name):
        p1.click('button[data-act="newmember"]'); p1.fill("#m_name", name); submit(p1)
        p1.wait_for_selector(f'[data-act="member"]:has-text("{name}")', timeout=10000)
    def gen_code(name):
        p1.click(f'[data-act="member"]:has-text("{name}")'); p1.click('button[data-act="gencode"]')
        return shown_code(p1)
    for nm in ["Bogdan Membru", "Tudor Trezorier", "Carmen Conducere"]: add_member(nm)
    code_bob = gen_code("Bogdan Membru"); code_tudor = gen_code("Tudor Trezorier"); code_carmen = gen_code("Carmen Conducere")
    ok(len(code_bob) == 14, "presedintele genereaza coduri pentru membri")
    # functii de conducere
    p1.click('nav.tabs button[data-id="tablou"]'); p1.wait_for_selector('text=Conducerea filialei')
    p1.click('button[data-act="newrole"]'); p1.select_option("#nr_m", label="Tudor Trezorier (cont neactivat)"); p1.select_option("#nr_r", "treasurer"); submit(p1)
    sheet_closed(p1); p1.wait_for_selector('[data-act="role"]:has-text("Vicepreședinte trezorier")', timeout=10000)
    p1.click('button[data-act="newrole"]'); p1.select_option("#nr_m", label="Carmen Conducere (cont neactivat)"); p1.select_option("#nr_r", "board")
    submit(p1); ok("între 2 și 60" in p1.inner_text("#sheet"), "functia de conducere cere titlu")
    p1.fill("#nr_t", "Secretar"); submit(p1); sheet_closed(p1)
    p1.wait_for_selector('[data-act="role"]:has-text("Secretar")', timeout=10000)
    ok(True, "presedintele numeste un trezorier si o functie de conducere")
    p1.locator('text=Conducerea filialei').first.scroll_into_view_if_needed(); p1.wait_for_timeout(300)
    p1.screenshot(path=SH + "e1_tablou_conducere.png")
    ok(p1.locator('button[data-act="newrole"]').count() == 1 and p1.locator("#brsel").count() == 0, "numirea in functie e la presedinte")
    alllinks |= set(links(p1))

    # 5) membrul, trezorierul si conducerea intra cu codurile lor
    c2, p2 = ctx()
    p2.goto(BASE + "/app"); p2.wait_for_selector("#svform"); p2.fill("#lg_code", code_bob); p2.click("#svform button[type=submit]")
    gate(p2, "Atelier Bogdan")
    ok(tabs(p2) == ["director", "profil"], "membrul vede doar Director si Profilul meu")
    p2.wait_for_selector("text=Ana Președinte")
    ok("Firma Ana SRL" in p2.inner_text("#main"), "membrul vede in director profilul cu acord")
    r = pull(p2, ["branches/Sibiu/fees", "branches/Sibiu/members", "audit", "branches/Sibiu/donations"])
    ok(all(r["errors"].get(k) == 403 for k in ["branches/Sibiu/fees", "branches/Sibiu/members", "audit", "branches/Sibiu/donations"]), "API: membrul nu citeste evidenta, donatiile sau jurnalul")
    r = p2.evaluate("""async()=>{const r=await fetch('/api/app/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'exclude',memberId:'x'})});return r.status}""")
    ok(r == 403, "API: membrul nu poate folosi operatiile de structura")
    p2.screenshot(path=SH + "membru_director.png", full_page=True)
    c3, p3 = ctx()
    p3.goto(BASE + "/app"); p3.wait_for_selector("#svform"); p3.fill("#lg_code", code_bob); p3.click("#svform button[type=submit]")
    p3.wait_for_function("() => document.getElementById('lgerr').textContent.length>0")
    ok("Cod invalid" in p3.inner_text("#lgerr"), "codul folosit o data nu mai poate fi refolosit")
    pt = login(code_tudor); pt.wait_for_selector("nav.tabs", timeout=15000)
    ok(tabs(pt) == ["director", "tablou", "cotizatii", "donatii", "cheltuieli"], "vicepresedintele trezorier are tablourile filialei")
    pt.click('nav.tabs button[data-id="cotizatii"]'); pt.click('button[data-act="fv"][data-id="members"]'); pt.wait_for_selector('[data-act="member"]')
    ok(pt.locator('button[data-act="newmember"]').count() == 0, "trezorierul nu adauga membri")
    pt.click('button[data-act="goprofil"]'); pt.wait_for_selector("text=Funcția mea")
    ok(pt.locator('#main button[data-act="handover"]').count() == 1, "trezorierul are Functia mea cu Preda functia")
    pt.locator('text=Funcția mea').first.scroll_into_view_if_needed(); pt.wait_for_timeout(300); pt.screenshot(path=SH + "e1_functia_mea.png")
    pc = login(code_carmen); gate(pc, "Firma Carmen")
    ok(tabs(pc) == ["director", "donatii", "cheltuieli", "profil"], "functia de conducere: Director, Donatii, Cheltuieli, Profilul meu")
    pc.click('nav.tabs button[data-id="cheltuieli"]'); pc.wait_for_selector("text=Cheltuieli")
    ok(pc.locator('button[data-act="newexp"]').count() == 0, "functia de conducere doar citeste cheltuielile")
    r = pull(pc, ["branches/Sibiu/donations", "branches/Sibiu/expenses", "branches/Sibiu/members", "branches/Sibiu/fees"])
    ok(r["errors"].get("branches/Sibiu/members") == 403 and r["errors"].get("branches/Sibiu/fees") == 403 and "branches/Sibiu/donations" not in r["errors"], "API: conducerea citeste donatiile si cheltuielile, nu membrii si cotizatiile")
    pc.click('nav.tabs button[data-id="profil"]'); pc.wait_for_selector("text=Funcția mea")
    ok("Secretar" in pc.inner_text("#main"), "Functia mea arata titlul functiei")

    # 6) excluderea si reactivarea unui membru
    p1.click('nav.tabs button[data-id="cotizatii"]'); p1.click('button[data-act="fv"][data-id="members"]')
    p1.click('[data-act="member"]:has-text("Bogdan Membru")'); p1.wait_for_selector('button[data-act="exclude"]'); p1.screenshot(path=SH + "e1_fisa_membru_exclude.png")
    p1.click('button[data-act="exclude"]'); p1.wait_for_selector('[data-act="exclude2"]')
    p1.click('button[data-act="exclude2"]'); sheet_closed(p1)
    p1.wait_for_selector('[data-act="member"]:has-text("Bogdan Membru") >> text=Exclus', timeout=10000)
    ok(True, "presedintele exclude un membru: eticheta Exclus")
    p2.reload(); p2.wait_for_selector("text=Accesul tău a fost suspendat", timeout=15000)
    ok("suspendat de conducerea filialei Sibiu" in p2.inner_text("#app"), "membrul exclus vede textul de suspendare manuala")
    p2.screenshot(path=SH + "e1_suspendat_manual.png")
    p1.click('[data-act="member"]:has-text("Bogdan Membru")'); p1.wait_for_selector('button[data-act="reactivate"]')
    ok(p1.locator('button[data-act="gencode"]').count() == 0, "membrul exclus nu primeste cod nou")
    p1.click('button[data-act="reactivate"]'); sheet_closed(p1)
    p2.reload(); p2.wait_for_selector("nav.tabs", timeout=15000)
    ok(tabs(p2) == ["director", "profil"], "dupa reactivare membrul intra din nou")

    # 7) predarea functiei de presedinte: Ana -> Tudor (cont activat)
    p1.click('nav.tabs button[data-id="tablou"]'); p1.wait_for_selector('button[data-act="handover"]')
    p1.click('button[data-act="handover"]'); p1.wait_for_selector("#ho_to")
    ok(p1.locator('#ho_to option:has-text("Bogdan Membru")').count() == 1 and p1.locator('#ho_to option:has-text("Ana")').count() == 0, "candidatii: membri cu cont activat, fara cel care preda")
    p1.select_option("#ho_to", label="Tudor Trezorier"); p1.check("#sheet input[name=ok]"); submit(p1); sheet_closed(p1)
    p1.wait_for_function("() => document.querySelectorAll('nav.tabs button').length===2", timeout=15000)
    ok(tabs(p1) == ["director", "profil"], "fostul presedinte ramane membru simplu dupa predare")
    pt.reload(); pt.wait_for_selector("nav.tabs"); pt.click('nav.tabs button[data-id="tablou"]'); pt.wait_for_selector('text=Conducerea filialei')
    ok(pt.locator('button[data-act="newrole"]').count() == 1, "noul presedinte (fost trezorier) are drepturile presedintelui")
    pn.reload(); pn.wait_for_selector("nav.tabs"); pn.click('nav.tabs button[data-id="structura"]'); pn.wait_for_selector('text=Președinte: Tudor Trezorier', timeout=15000)
    ok(True, "presedintele national vede noul presedinte al filialei")

    # 8) iesire din cont, tema inchisa, modul demonstrativ
    p2.click('nav.tabs button[data-id="profil"]'); p2.wait_for_selector('button[data-act="logout"]')
    alllinks |= set(links(p2))
    p2.locator('#main button[data-act="logout"]').click(); p2.wait_for_selector("#svform", timeout=15000)
    ok(p2.evaluate("() => fetch('/api/app/me').then(r=>r.status)") == 401, "dupa iesire sesiunea nu mai e valida")
    c5, p5 = ctx(dark=True); p5.goto(BASE + "/app"); p5.wait_for_selector("#svform"); p5.screenshot(path=SH + "login_dark.png")
    c6, p6 = ctx(w=1280, h=800)
    p6.goto(BASE + "/app?demo"); p6.wait_for_selector("nav.tabs"); p6.wait_for_timeout(500); p6.screenshot(path=SH + "demo_desktop.png")
    ok("Mod demonstrativ" in p6.inner_text("#app") and tabs(p6) == ["director", "structura", "profil"], "/app?demo porneste modul demonstrativ, cu presedintele national")
    alllinks |= set(links(p6))

    bad = [l for l in alllinks if not (l.startswith("#") or l.startswith("mailto:") or l.startswith("tel:"))]
    ok(not bad, "aplicatia nu contine niciun link catre site sau in afara: " + json.dumps(sorted(alllinks), ensure_ascii=False))
    csp = [e for e in errs if "Content Security Policy" in e or "Refused" in e]
    ok(not csp, "nicio incalcare CSP: " + json.dumps(csp[:3], ensure_ascii=False))
    other = [e for e in errs if e not in csp and "ERR_TUNNEL_CONNECTION_FAILED" not in e and "401" not in e and "400" not in e and "403" not in e]
    ok(not other, "nicio eroare de script in consola: " + json.dumps(other[:4], ensure_ascii=False))
    br.close()
print(f"\n{n-fails}/{n} ok, {fails} esecuri")
