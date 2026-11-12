import sys, re, json
from playwright.sync_api import sync_playwright
BASE = "http://127.0.0.1:8787"
KEY = "Cheie-Locala-Test-2026"
PW = "Parola-Test-2026"
PW2 = "Alta-Parola-2027"
PW3 = "Parola-Noua-2028"
SH = "/tmp/jcib-e2e/"
import os; os.makedirs(SH, exist_ok=True)
from datetime import date, timedelta
def D(n): return (date.today() + timedelta(days=n)).isoformat()
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
    b.click(); pg.wait_for_url(re.compile(r"/app$")); pg.wait_for_selector("#pwform")
    ok(True, "click pe buton duce la /app, ecranul de intrare")
    alllinks |= set(links(pg))
    pg.set_viewport_size({"width": 390, "height": 844}); pg.wait_for_timeout(300)
    pg.screenshot(path=SH + "e1b_intrare.png")
    ok(pg.locator('#pwform input[type="email"][autocomplete="username"]').count() == 1 and pg.locator('#pwform input[type="password"][autocomplete="current-password"]').count() == 1, "ecranul de intrare are e-mail si parola")
    # e-mail necunoscut
    pg.fill("#lg_email", "nimeni@exemplu.ro"); pg.fill("#lg_pass", "oricare-parola"); pg.click("#pwform button[type=submit]")
    pg.wait_for_function("() => document.getElementById('pwerr').textContent.length>0")
    ok("E-mail sau parolă greșită" in pg.inner_text("#pwerr"), "e-mail necunoscut: mesaj generic")
    # cod gresit
    pg.click('summary:has-text("Prima intrare")'); pg.fill("#lg_code", "AAAA-BBBB-CCCC"); pg.click("#svform button[type=submit]"); pg.wait_for_function("() => document.getElementById('lgerr').textContent.length>0")
    ok("Cod invalid" in pg.inner_text("#lgerr"), "cod gresit: mesaj de eroare")
    def sheet_closed(pg):
        pg.wait_for_function("() => !document.getElementById('sheetwrap').classList.contains('open')")
    def submit(pg):
        pg.click("#sheet form button[type=submit]")
    def shown_code(pg):
        pg.wait_for_selector("#sheet p.num"); c = pg.inner_text("#sheet p.num").strip()
        pg.click('#sheet [data-act="closesheet"]'); return c
    def set_cred(q, email, pw=PW, shot=None):
        q.wait_for_selector("#credform", timeout=15000)
        if shot: q.screenshot(path=SH + shot)
        q.fill("#sc_email", email); q.fill("#sc_pass", pw); q.fill("#sc_pass2", pw); q.click("#credform button[type=submit]")
        q.wait_for_function("() => !document.getElementById('credform')", timeout=15000)
    def enter_code(code, email, firm=None, shot=None, check_need=False):
        c, q = ctx()
        q.goto(BASE + "/app"); q.wait_for_selector("#pwform"); q.click('summary:has-text("Prima intrare")')
        q.fill("#lg_code", code.lower()); q.click("#svform button[type=submit]")
        if check_need:
            q.wait_for_selector("#credform", timeout=15000)
            r = pull(q, ["profiles"])
            ok(r.get("needCred") is True, "dupa intrarea cu cod, pana la setarea parolei, API-ul refuza cu needCred")
            ok(q.locator("nav.tabs").count() == 0, "ecranul Seteaza e-mailul si parola nu are nicio alta fila")
        set_cred(q, email, shot=shot)
        if firm: gate(q, firm)
        else: q.wait_for_selector("nav.tabs", timeout=15000)
        return q
    def pass_login(q, email, pw=PW):
        q.fill("#lg_email", email); q.fill("#lg_pass", pw); q.click("#pwform button[type=submit]")
    def logout(q):
        q.locator('button[data-act="logout"]').first.click(); q.wait_for_selector("#pwform", timeout=15000)
    def relogin(q, email, pw=PW):
        logout(q); pass_login(q, email, pw); q.wait_for_selector("nav.tabs", timeout=15000)
    def gob(q, sub):
        q.click('nav.tabs button[data-id="filiala"]'); q.click(f'button[data-act="bsub"][data-id="{sub}"]')
    def tabs(pg):
        return pg.eval_on_selector_all("nav.tabs button", "els=>els.map(e=>e.getAttribute('data-id'))")
    def pull(pg, paths):
        return pg.evaluate("async(p)=>{const r=await fetch('/api/app/pull',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paths:p})});return r.json()}", paths)
    def gate(pg, firm):
        pg.wait_for_selector("#gateform", timeout=15000)
        pg.fill("#f_firm", firm); pg.check('input[name="c_dir"]'); pg.check("#agree"); pg.click("#gatego")
        pg.wait_for_selector("nav.tabs", timeout=15000)

    # 2) administratorul tehnic: doar Structura, numeste presedintele national
    pg.click('summary:has-text("Administrator tehnic")'); pg.fill("#lg_key", KEY); pg.click("#modform button[type=submit]")
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
    pn = enter_code(code_nat, "radu@exemplu.ro", firm="Firma Radu SRL", shot="e1b_seteaza_parola.png", check_need=True)
    relogin(pn, "radu@exemplu.ro")
    ok(tabs(pn) == ["director", "evenimente", "voturi", "structura"], "presedintele national: Director, Evenimente, Voturi, Structura")
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
    p1 = enter_code(code_ana, "ana@exemplu.ro")
    ok("Profilul tău nu e completat" in p1.inner_text("#app"), "presedintele intra direct, cu indemn sa-si completeze profilul")
    p1.click('button[data-act="goprofil"]'); p1.wait_for_selector("#pform")
    ok(p1.input_value("#f_name") == "Ana Președinte" and p1.locator("#f_branch").count() == 0, "profilul are numele din evidenta, filiala fixata de server")
    p1.fill("#f_firm", "Firma Ana SRL"); p1.check('input[name="c_dir"]'); p1.click("#pform button[type=submit]"); p1.wait_for_timeout(1200)
    # Contul: e-mail, schimbarea parolei
    p1.locator('button[data-act="changecred"]').scroll_into_view_if_needed(); p1.wait_for_timeout(300)
    ok("ana@exemplu.ro" in p1.inner_text("#main"), "Profilul meu: Contul arata e-mailul")
    p1.screenshot(path=SH + "e1b_contul.png")
    p1.click('button[data-act="changecred"]'); p1.fill("#cc_c", "parola-gresita-1"); p1.fill("#cc_n", PW2); p1.fill("#cc_n2", PW2); submit(p1)
    p1.wait_for_function("() => document.getElementById('sheeterr').textContent.length>0")
    ok(p1.locator("#sheet #cc_c").count() == 1, "schimbare cu parola actuala gresita: refuzata, foaia ramane")
    p1.fill("#cc_c", PW); submit(p1); sheet_closed(p1)
    logout(p1); pass_login(p1, "ana@exemplu.ro", PW)
    p1.wait_for_function("() => document.getElementById('pwerr').textContent.length>0")
    ok("E-mail sau parolă greșită" in p1.inner_text("#pwerr"), "dupa schimbare, vechea parola nu mai merge")
    p1.fill("#lg_pass", PW2); p1.click("#pwform button[type=submit]"); p1.wait_for_selector("nav.tabs", timeout=15000)
    ok(tabs(p1) == ["director", "evenimente", "voturi", "filiala"], "presedintele intra cu noua parola")
    ok(p1.locator('nav.tabs button[data-id="filiala"]').count() == 1 and p1.locator("#brsel").count() == 0, "presedintele vede tablourile filialei sale")
    gob(p1, "cotizatii"); p1.click('button[data-act="fv"][data-id="members"]')
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
    gob(p1, "tablou"); p1.wait_for_selector('text=Conducerea filialei')
    p1.click('button[data-act="newrole"]'); p1.select_option("#nr_m", label="Tudor Trezorier (cont neactivat)"); p1.select_option("#nr_r", "treasurer"); submit(p1)
    sheet_closed(p1); p1.wait_for_selector('[data-act="role"]:has-text("Vicepreședinte trezorier")', timeout=10000)
    p1.click('button[data-act="newrole"]'); p1.select_option("#nr_m", label="Carmen Conducere (cont neactivat)"); p1.select_option("#nr_r", "board")
    submit(p1); ok("între 2 și 60" in p1.inner_text("#sheet"), "functia de conducere cere titlu")
    p1.fill("#nr_t", "Vicepreședinte proiecte"); submit(p1); sheet_closed(p1)
    p1.wait_for_selector('[data-act="role"]:has-text("Vicepreședinte proiecte")', timeout=10000)
    ok(True, "presedintele numeste un trezorier si o functie de conducere")
    p1.locator('text=Conducerea filialei').first.scroll_into_view_if_needed(); p1.wait_for_timeout(300)
    p1.screenshot(path=SH + "e1_tablou_conducere.png")
    ok(p1.locator('button[data-act="newrole"]').count() == 1 and p1.locator("#brsel").count() == 0, "numirea in functie e la presedinte")
    alllinks |= set(links(p1))

    # 5) membrul, trezorierul si conducerea intra cu codurile lor
    p2 = enter_code(code_bob, "bogdan@exemplu.ro", firm="Atelier Bogdan")
    relogin(p2, "bogdan@exemplu.ro")
    ok(tabs(p2) == ["director", "evenimente", "voturi", "profil"], "membrul vede Director, Evenimente, Voturi, Profilul meu")
    p2.wait_for_selector("text=Ana Președinte")
    ok("Firma Ana SRL" in p2.inner_text("#main"), "membrul vede in director profilul cu acord")
    r = pull(p2, ["branches/Sibiu/fees", "branches/Sibiu/members", "audit", "branches/Sibiu/donations"])
    ok(all(r["errors"].get(k) == 403 for k in ["branches/Sibiu/fees", "branches/Sibiu/members", "audit", "branches/Sibiu/donations"]), "API: membrul nu citeste evidenta, donatiile sau jurnalul")
    r = p2.evaluate("""async()=>{const r=await fetch('/api/app/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'exclude',memberId:'x'})});return r.status}""")
    ok(r == 403, "API: membrul nu poate folosi operatiile de structura")
    p2.screenshot(path=SH + "membru_director.png", full_page=True)
    c3, p3 = ctx()
    p3.goto(BASE + "/app"); p3.wait_for_selector("#pwform"); p3.click('summary:has-text("Prima intrare")'); p3.fill("#lg_code", code_bob); p3.click("#svform button[type=submit]")
    p3.wait_for_function("() => document.getElementById('lgerr').textContent.length>0")
    ok(("Cod invalid" in p3.inner_text("#lgerr") or "deja e-mail" in p3.inner_text("#lgerr")) and p3.locator("#credform").count() == 0, "dupa setarea parolei, codul vechi nu mai poate fi folosit")
    pt = enter_code(code_tudor, "tudor@exemplu.ro")
    relogin(pt, "tudor@exemplu.ro")
    ok(tabs(pt) == ["director", "evenimente", "voturi", "filiala"], "vicepresedintele trezorier are tablourile filialei")
    gob(pt, "cotizatii"); pt.click('button[data-act="fv"][data-id="members"]'); pt.wait_for_selector('[data-act="member"]')
    ok(pt.locator('button[data-act="newmember"]').count() == 0, "trezorierul nu adauga membri")
    pt.click('button[data-act="goprofil"]'); pt.wait_for_selector("text=Funcția mea")
    ok(pt.locator('#main button[data-act="handover"]').count() == 1, "trezorierul are Functia mea cu Preda functia")
    pt.locator('text=Funcția mea').first.scroll_into_view_if_needed(); pt.wait_for_timeout(300); pt.screenshot(path=SH + "e1_functia_mea.png")
    pc = enter_code(code_carmen, "carmen@exemplu.ro", firm="Firma Carmen")
    relogin(pc, "carmen@exemplu.ro")
    ok(tabs(pc) == ["director", "evenimente", "voturi", "filiala"], "functia de conducere: Director, Evenimente, Voturi, Filiala")
    gob(pc, "cheltuieli"); pc.wait_for_selector("text=Cheltuieli")
    ok(pc.locator('button[data-act="newexp"]').count() == 0, "functia de conducere doar citeste cheltuielile")
    r = pull(pc, ["branches/Sibiu/donations", "branches/Sibiu/expenses", "branches/Sibiu/members", "branches/Sibiu/fees"])
    ok(r["errors"].get("branches/Sibiu/members") == 403 and r["errors"].get("branches/Sibiu/fees") == 403 and "branches/Sibiu/donations" not in r["errors"], "API: conducerea citeste donatiile si cheltuielile, nu membrii si cotizatiile")
    pc.click('button[data-act="goprofil"]'); pc.wait_for_selector("text=Funcția mea")
    ok("Vicepreședinte proiecte" in pc.inner_text("#main"), "Functia mea arata titlul functiei")

    # 6) excluderea si reactivarea unui membru
    p1.reload(); p1.wait_for_selector("nav.tabs", timeout=15000)  # evidenta se reimprospateaza: membrii si-au activat conturile
    gob(p1, "cotizatii"); p1.click('button[data-act="fv"][data-id="members"]')
    p1.click('[data-act="member"]:has-text("Bogdan Membru")'); p1.wait_for_selector('button[data-act="exclude"]')
    ok(p1.locator('button[data-act="resetaccess"]').count() == 1 and p1.locator('button[data-act="gencode"]').count() == 0, "fisa unui membru cu cont si parola: Reseteaza accesul, fara Genereaza cod")
    p1.screenshot(path=SH + "e1_fisa_membru_exclude.png")
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
    ok(tabs(p2) == ["director", "evenimente", "voturi", "profil"], "dupa reactivare membrul intra din nou, fara sa-si puna alta parola")

    # 6b) resetarea accesului de catre presedinte: vechea parola si sesiunea nu mai merg, reluare cu cod nou
    p1.click('[data-act="member"]:has-text("Bogdan Membru")'); p1.wait_for_selector('button[data-act="resetaccess"]')
    p1.click('button[data-act="resetaccess"]'); p1.wait_for_selector('[data-act="resetaccess2"]')
    ok("Membrul nu va mai putea intra cu parola veche" in p1.inner_text("#sheet"), "resetare acces: foaie de confirmare")
    p1.screenshot(path=SH + "e1b_reseteaza.png")
    p1.click('button[data-act="resetaccess2"]'); code_bob2 = shown_code(p1)
    ok(re.fullmatch(r"[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}", code_bob2) is not None, "resetarea intoarce un cod nou")
    p2.reload(); p2.wait_for_selector("#pwform", timeout=15000)
    ok(True, "dupa resetare, sesiunea veche a membrului nu mai e valida")
    pass_login(p2, "bogdan@exemplu.ro", PW); p2.wait_for_function("() => document.getElementById('pwerr').textContent.length>0")
    ok("E-mail sau parolă greșită" in p2.inner_text("#pwerr"), "dupa resetare, vechea parola nu mai merge")
    p2.click('summary:has-text("Prima intrare")'); p2.fill("#lg_code", code_bob2); p2.click("#svform button[type=submit]")
    set_cred(p2, "bogdan@exemplu.ro", PW3); p2.wait_for_selector("nav.tabs", timeout=15000)
    ok(tabs(p2) == ["director", "evenimente", "voturi", "profil"], "dupa resetare, membrul intra cu codul nou si isi pune din nou e-mailul si parola")
    relogin(p2, "bogdan@exemplu.ro", PW3)
    ok(tabs(p2) == ["director", "evenimente", "voturi", "profil"], "membrul intra cu noua parola")

    # 6c) evenimente: presedintele creeaza, presedintele consemneaza prezenta, membrul scrie ce a facut, conducerea vede contorul
    p1.click('nav.tabs button[data-id="evenimente"]'); p1.wait_for_selector('button[data-act="newev"]')
    ok(p1.locator('button[data-act="evv"]').count() == 2, "presedinte: Evenimente cu chips Evenimente/Participare")
    p1.click('button[data-act="newev"]'); p1.fill("#ev_t", "Atelier de vorbit în public"); p1.fill("#ev_d", D(-1)); p1.fill("#ev_p", "Sediul filialei"); submit(p1); sheet_closed(p1)
    p1.click('button[data-act="newev"]'); p1.fill("#ev_t", "Seară de networking"); p1.fill("#ev_d", D(10)); p1.fill("#ev_p", "CATTIA Brașov"); p1.fill("#ev_n", "Seară deschisă pentru toți membrii."); submit(p1); sheet_closed(p1)
    p1.wait_for_selector('[data-act="evopen"]:has-text("Seară de networking")', timeout=10000)
    ok(p1.locator('[data-act="evopen"]').count() == 2, "presedintele creeaza doua evenimente: unul trecut, unul viitor")
    p1.screenshot(path=SH + "e3_evenimente.png")
    # membrul: la evenimentul de ieri spune singur ca a participat, apoi scrie ce a facut; la cel viitor spune ca vine
    p2.reload(); p2.wait_for_selector("nav.tabs", timeout=15000); p2.click('nav.tabs button[data-id="evenimente"]')
    p2.wait_for_selector('button[data-act="evgo"]:has-text("Am participat")', timeout=15000)
    ok("Ai participat la 0 evenimente" in p2.inner_text("#main") and p2.locator('button[data-act="newev"]').count() == 0, "membrul nu poate crea evenimente; la cel trecut vede Am participat")
    p2.click('button[data-act="evgo"]:has-text("Am participat")')
    p2.wait_for_selector('button[data-act="evdid"]', timeout=10000)
    ok("Ai participat la 1 eveniment" in p2.inner_text("#main"), "dupa Am participat: contorul 1 si Ce am facut")
    p2.click('button[data-act="evgo"]:has-text("Vin")'); p2.wait_for_selector('button[data-act="evgo"]:has-text("Particip")', timeout=10000)
    ok(True, "membrul spune ca participa la evenimentul viitor")
    p2.click('button[data-act="evdid"]'); p2.wait_for_selector("#dd_t"); p2.fill("#dd_t", "Am făcut fotografiile"); p2.fill("#dd_a", "100")
    p2.screenshot(path=SH + "e3_ce_am_facut.png")
    submit(p2); sheet_closed(p2); p2.wait_for_selector('text=Am făcut fotografiile', timeout=10000)
    ok("100,00 RON" in p2.inner_text("#main"), "membrul isi vede contributia, cu suma")
    r = pull(p2, ["branches/Sibiu/attend", "branches/Sibiu/events"])
    ok(all(x["id"].endswith("_" + x["memberId"]) for x in r["data"]["branches/Sibiu/attend"]) and len(r["data"]["branches/Sibiu/attend"]) == 2, "API: membrul primeste doar randurile lui de participare")
    # presedintele consemneaza si prezenta unui alt membru
    p1.reload(); p1.wait_for_selector("nav.tabs", timeout=15000); p1.click('nav.tabs button[data-id="evenimente"]')
    p1.wait_for_selector('button[data-act="evv"][data-id="part"]'); p1.click('button[data-act="evv"][data-id="part"]'); p1.wait_for_selector('button[data-act="evpresence"]')
    p1.click('button[data-act="evpresence"]'); p1.select_option("#pr_m", label="Tudor Trezorier"); p1.fill("#dd_t", "Am pregătit sala"); submit(p1); sheet_closed(p1)
    p1.wait_for_selector('[data-act="partm"]:has-text("Tudor Trezorier")', timeout=10000)
    ok("1 eveniment" in p1.locator('[data-act="partm"]:has-text("Tudor Trezorier")').inner_text() and "1 eveniment" in p1.locator('[data-act="partm"]:has-text("Bogdan Membru")').inner_text(), "presedintele vede contorul pe persoana si consemneaza prezenta altui membru")
    # functia de conducere: contorul pe persoana
    pc.reload(); pc.wait_for_selector("nav.tabs", timeout=15000); pc.click('nav.tabs button[data-id="evenimente"]')
    pc.wait_for_selector('button[data-act="evv"][data-id="part"]'); pc.click('button[data-act="evv"][data-id="part"]')
    pc.wait_for_selector('[data-act="partm"]:has-text("Bogdan Membru")', timeout=15000)
    ok("1 eveniment" in pc.locator('[data-act="partm"]:has-text("Bogdan Membru")').inner_text(), "Vicepresedinte proiecte: contorul pe persoana")
    pc.screenshot(path=SH + "e3_participare.png")
    pc.click('[data-act="partm"]:has-text("Bogdan Membru")'); pc.wait_for_selector("#sheet .row")
    ok("Am făcut fotografiile" in pc.inner_text("#sheet"), "foaia persoanei arata ce a facut la eveniment")
    pc.click('#sheet [data-act="closesheet"]')
    ok(pc.locator('button[data-act="evpresence"]').count() == 1, "functia de conducere (board) poate consemna prezenta")

    # 6d) voturi de adunare: presedintele creeaza, membrii voteaza, se inchide, apar totalurile
    p1.click('nav.tabs button[data-id="voturi"]'); p1.wait_for_selector('button[data-act="pollnew"]')
    p1.click('button[data-act="pollnew"]'); p1.fill("#pl_t", "Aprobăm bugetul pentru primăvară?"); p1.fill("#pl_o", "Da\nNu\nMă abțin"); p1.fill("#pl_d", D(7)); submit(p1); sheet_closed(p1)
    p1.wait_for_selector('form.poll-f', timeout=10000)
    p2.reload(); p2.wait_for_selector("nav.tabs"); p2.click('nav.tabs button[data-id="voturi"]'); p2.wait_for_selector('form.poll-f', timeout=15000)
    ok("Voturi naționale" not in p2.inner_text("#main") and p2.locator('button[data-act="pollnew"]').count() == 0, "membrul vede doar votul adunarii, fara Vot nou")
    p2.locator('form.poll-f input[type=radio]').first.check(); p2.click('form.poll-f button[type=submit]'); p2.wait_for_selector("text=Ai votat", timeout=10000)
    ok("%" not in p2.inner_text("#main"), "dupa vot, rezultatul ramane ascuns pana la inchidere")
    pc.reload(); pc.wait_for_selector("nav.tabs"); pc.click('nav.tabs button[data-id="voturi"]'); pc.wait_for_selector('form.poll-f', timeout=15000)
    pc.locator('form.poll-f input[type=radio]').nth(1).check(); pc.click('form.poll-f button[type=submit]'); pc.wait_for_selector("text=Ai votat", timeout=10000)
    ok(pc.locator('button[data-act="pollnew"]').count() == 0, "functia de conducere voteaza ca membru, nu creeaza voturi")
    r = pull(p2, ["branches/Sibiu/polls", "polls"])
    pl = r["data"]["branches/Sibiu/polls"][0]
    ok(r["errors"].get("polls") == 403 and not any("votes" in o for o in pl["options"]) and "votedNames" not in pl, "API: membrul nu citeste voturile nationale; totalurile pe optiuni lipsesc cat e deschis")
    p1.reload(); p1.wait_for_selector("nav.tabs"); p1.click('nav.tabs button[data-id="voturi"]'); p1.wait_for_selector('button[data-act="pollwho"]', timeout=15000)
    p1.click('button[data-act="pollwho"]'); p1.wait_for_selector("#sheet .row", timeout=10000)
    ok("Bogdan Membru" in p1.inner_text("#sheet") and "Carmen Conducere" in p1.inner_text("#sheet"), "creatorul vede cine a votat, fara optiune")
    p1.click('#sheet [data-act="closesheet"]')
    p1.screenshot(path=SH + "e4_voturi.png")
    p1.click('button[data-act="pollclose"]'); p1.wait_for_selector('.res', timeout=15000)
    ok(p1.locator(".res").count() == 3 and "2 voturi" in p1.inner_text("#main"), "dupa inchidere apar totalurile pe optiuni")
    p1.screenshot(path=SH + "e4_rezultat.png")
    p2.reload(); p2.wait_for_selector("nav.tabs"); p2.click('nav.tabs button[data-id="voturi"]'); p2.wait_for_selector('.res', timeout=15000)
    ok("votul tău" in p2.inner_text("#main"), "membrul vede rezultatul si votul lui")

    # 6e) vot national: presedintele national creeaza, presedintele de filiala voteaza
    pn.reload(); pn.wait_for_selector("nav.tabs"); pn.click('nav.tabs button[data-id="voturi"]'); pn.wait_for_selector('button[data-act="pollnew"]')
    ok("Adunarea generală" not in pn.inner_text("#main"), "national: doar voturile nationale")
    pn.click('button[data-act="pollnew"]'); pn.fill("#pl_t", "Orașul conferinței naționale?"); pn.fill("#pl_o", "Brașov\nSibiu"); pn.fill("#pl_d", D(7)); submit(pn); sheet_closed(pn)
    pn.wait_for_selector('[data-act="pollwho"]', timeout=10000)
    ok(pn.locator("form.poll-f").count() == 0, "presedintele national nu voteaza")
    p1.reload(); p1.wait_for_selector("nav.tabs"); p1.click('nav.tabs button[data-id="voturi"]'); p1.wait_for_selector('text=Orașul conferinței naționale?', timeout=15000)
    p1.locator('.poll:has-text("Orașul conferinței") input[type=radio]').first.check(); p1.locator('.poll:has-text("Orașul conferinței") button[type=submit]').click()
    p1.wait_for_selector("text=Ai votat", timeout=10000)
    ok(True, "presedintele de filiala voteaza la votul national")
    pn.reload(); pn.wait_for_selector("nav.tabs"); pn.click('nav.tabs button[data-id="voturi"]'); pn.wait_for_selector('[data-act="pollwho"]'); pn.click('[data-act="pollwho"]'); pn.wait_for_selector("#sheet .row", timeout=10000)
    ok("Ana Președinte" in pn.inner_text("#sheet"), "presedintele national vede cine a votat")
    pn.click('#sheet [data-act="closesheet"]')

    # 7) predarea functiei de presedinte: Ana -> Tudor (cont activat)
    gob(p1, "tablou"); p1.wait_for_selector('button[data-act="handover"]')
    p1.click('button[data-act="handover"]'); p1.wait_for_selector("#ho_to")
    ok(p1.locator('#ho_to option:has-text("Bogdan Membru")').count() == 1 and p1.locator('#ho_to option:has-text("Ana")').count() == 0, "candidatii: membri cu cont activat, fara cel care preda")
    p1.select_option("#ho_to", label="Tudor Trezorier"); p1.check("#sheet input[name=ok]"); submit(p1); sheet_closed(p1)
    p1.wait_for_function("() => !!document.querySelector('nav.tabs button[data-id=profil]')", timeout=15000)
    ok(tabs(p1) == ["director", "evenimente", "voturi", "profil"], "fostul presedinte ramane membru simplu dupa predare")
    pt.reload(); pt.wait_for_selector("nav.tabs"); gob(pt, "tablou"); pt.wait_for_selector('text=Conducerea filialei')
    ok(pt.locator('button[data-act="newrole"]').count() == 1, "noul presedinte (fost trezorier) are drepturile presedintelui")
    pn.reload(); pn.wait_for_selector("nav.tabs"); pn.click('nav.tabs button[data-id="structura"]'); pn.wait_for_selector('text=Președinte: Tudor Trezorier', timeout=15000)
    ok(True, "presedintele national vede noul presedinte al filialei")
    # resetarea accesului presedintelui de filiala, din Structura
    pn.click('[data-act="branch"][data-id="Sibiu"]'); pn.wait_for_selector('#sheet [data-act="resetaccess"]')
    ok("Cod nou pentru președinte" not in pn.inner_text("#sheet"), "Structura: Reseteaza accesul in loc de Cod nou")
    pn.click('#sheet [data-act="resetaccess"]'); pn.wait_for_selector('[data-act="resetaccess2"]'); pn.click('[data-act="resetaccess2"]')
    code_pres2 = shown_code(pn)
    ok(re.fullmatch(r"[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}", code_pres2) is not None, "presedintele national reseteaza accesul presedintelui de filiala")
    pt.reload(); pt.wait_for_selector("#pwform", timeout=15000)
    ok(True, "presedintele resetat e deconectat")

    # 8) iesire din cont, tema inchisa, modul demonstrativ
    p2.click('nav.tabs button[data-id="profil"]'); p2.wait_for_selector('button[data-act="logout"]')
    alllinks |= set(links(p2))
    p2.locator('#main button[data-act="logout"]').click(); p2.wait_for_selector("#pwform", timeout=15000)
    ok(p2.evaluate("() => fetch('/api/app/me').then(r=>r.status)") == 401, "dupa iesire sesiunea nu mai e valida")
    c5, p5 = ctx(dark=True); p5.goto(BASE + "/app"); p5.wait_for_selector("#pwform"); p5.screenshot(path=SH + "login_dark.png")
    c6, p6 = ctx(w=1280, h=800)
    p6.goto(BASE + "/app?demo"); p6.wait_for_selector("nav.tabs"); p6.wait_for_timeout(500); p6.screenshot(path=SH + "demo_desktop.png")
    ok("Mod demonstrativ" in p6.inner_text("#app") and tabs(p6) == ["director", "evenimente", "voturi", "structura"], "/app?demo porneste modul demonstrativ, cu presedintele national")
    alllinks |= set(links(p6))

    bad = [l for l in alllinks if not (l.startswith("#") or l.startswith("mailto:") or l.startswith("tel:"))]
    ok(not bad, "aplicatia nu contine niciun link catre site sau in afara: " + json.dumps(sorted(alllinks), ensure_ascii=False))
    csp = [e for e in errs if "Content Security Policy" in e or "Refused" in e]
    ok(not csp, "nicio incalcare CSP: " + json.dumps(csp[:3], ensure_ascii=False))
    other = [e for e in errs if e not in csp and "ERR_TUNNEL_CONNECTION_FAILED" not in e and "401" not in e and "400" not in e and "403" not in e]
    ok(not other, "nicio eroare de script in consola: " + json.dumps(other[:4], ensure_ascii=False))
    br.close()
print(f"\n{n-fails}/{n} ok, {fails} esecuri")
