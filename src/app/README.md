# JCI Business (/app): ghid pentru actualizări

Aplicația membrilor, la `https://jci-brasov.com/app`. Ghidul e scris ca o actualizare să se poată face citind puține fișiere.
Ce urmează să se construiască: `SPEC-ROLURI.md`. Istoricul și detaliile de server: `../README.md`, secțiunea JCI Business.

## Reguli fixe

1. Texte în română, cu diacritice, registru business. Fără emoticoane și fără simboluri decorative.
2. Fără puncte de mijloc ca separator, nicăieri. Separatorul din rânduri e ` | `; build-ul oprește orice punct de mijloc.
3. Legătura e într-un singur sens: site către aplicație. Aplicația nu are niciun link către site (build-ul verifică).
4. Aplicația nu încarcă nimic din afara site-ului și nu are script sau atribute de eveniment inline (CSP).
5. Culori, fonturi și spații doar prin variabilele din `css/10-tokens.css` (manualul JCI: albastru #0097D7, negru #130F2D,
   navy #1F4789, teal #57BCBC, galben #EFC40F doar ca accent, Plus Jakarta Sans).
6. Un ecran nou se compune din piesele setului de componente. Stil nou doar dacă nicio piesă nu se potrivește, și atunci
   piesa se adaugă în `js/12-ui-module.js`, `css/45-componente-module.css` și în catalog.
7. Drepturile se verifică pe server (`worker/app.js`). Interfața doar ascunde ce nu e permis.
8. Sumele se țin în bani (întregi) și se afișează cu `fmt(bani)`. Tot textul venit din date trece prin `esc()`.
9. Nimic nu se șterge din evidențe: se anulează, cu urmă în jurnal.
10. Aplicația nu trebuie să încarce site-ul: fără interogări periodice mai dese de 60 s, fără biblioteci externe,
    imaginile ca fișiere cu `?v=`.

## Structură

```
src/app/index.html        scheletul paginii (fără stil și fără script)
src/app/css/10-tokens.css        culori, fonturi, spații (teme deschisă și închisă)
            20-baza.css          elemente de bază
            30-structura.css     antet, navigare, pagină
            40-componente.css    butoane, câmpuri, rânduri, etichete, cifre
            45-componente-module.css   piese pentru modulele noi
            50-foaie-ecrane.css  foaia de jos, mesaje, ecranele de intrare
src/app/js/00-util.js            constante, formatare, date
           10-ui.js              setul de componente, partea 1
           12-ui-module.js       setul de componente, partea 2 (module noi)
           15-stocare.js         makeHttpStore (server), makeMemStore (demo), pilotul vechi
           20-stare.js           starea S, roluri, abonări, jurnal, put()
           30-calcule.js         rapoarte, valabilitate
           40-randare.js         tabsFor(), render()
           45-acces.js           intrare cu cod, acorduri, formular de profil
           50-director-profil.js ecrane: director, profil
           55-finante.js         ecrane: tablou, cotizații, donații, cheltuieli
           58-structura.js       structură (filiale, președinți), conducerea filialei, predarea funcției, excluderea
           60-foi-finante.js     foi: membri, cotizații, donații, cheltuieli
           70-actiuni.js         onAct(act, id): toate butoanele
           80-catalog.js         catalogul vizual /app?ui
           90-pornire.js         start()
src/app/img/                     logo.png, icon.png
src/app/etape/                   proiectul tehnic al fiecărei etape (E1.md ...)
src/app/tests/                   teste (vezi mai jos)
worker/app.js                    API-ul /api/app/* și regulile de acces
```

Fișierele din `css/` și `js/` se lipesc în ordine alfabetică într-un singur `app.css` și un singur `app.js`.
Totul e în același spațiu global: o funcție nouă se pune în fișierul temei ei sau într-un fișier nou, numerotat.

## Cum se adaugă ceva

- Ecran nou: o funcție `vNume()` care întoarce HTML, o filă în `tabsFor()` (`40-randare.js`) și ramura ei în `render()`.
- Buton: `data-act="nume"` și, opțional, `data-id`; tratarea e un `case "nume":` în `onAct` (`70-actiuni.js`).
- Formular: `openSheet(html, async function (fd) { ... })`; erorile cu `fieldErr("...")`; la final `closeSheet()` și `toast("...")`.
- Date: `col("cale")` citește, `S.store.set(cale, id, obiect)` scrie, `put(cale, id, obiect, acțiune, rezumat)` scrie și
  trece în jurnal. Abonarea la o cale nouă: `sub("cale")` în `subscribeAll()` sau `ensureLeadSubs()` (`20-stare.js`).
- Operație de structură (roluri, filiale, excluderi): `adminOp({ op, ... })` în interfață, `admin()` în `worker/app.js`.
  Rolurile și lista filialelor nu se scriu niciodată direct.
- Colecție nouă pe server: se adaugă în `COLLS` și în `canRead` / `canWrite` din `worker/app.js`, cu teste în
  `tests/t_backend.mjs` pentru fiecare rol care are voie și fiecare rol care nu are voie.
- Date de probă pentru modul demonstrativ: `demoSeed` în `15-stocare.js`.

## Setul de componente

Catalog vizual, cu date fictive: `/app?ui`. Funcțiile întorc HTML.

| Funcție | La ce folosește |
|---|---|
| `row({ act, id, avatar, title, meta, right, stripe })` | rând de listă; `meta` și `right` sunt HTML; `stripe`: good, warn, crit |
| `emptyBox(titlu, text, buton, act)` | stare goală |
| `inp(name, etichetă, valoare, tip, id, extra)`, `sel(name, opțiuni, valoare, etichetă, id)` | câmpuri de formular |
| `openSheet(html, onSubmit)`, `closeSheet()`, `fieldErr(msg)`, `toast(msg)` | foaie, erori, mesaje |
| `svg(nume, mărime)`, `pill(hartă, cheie)` | pictograme din `ICON`, etichete de stare |
| `uiAvatar(nume, poză, mărime)` | inițiale sau poză; mărime: "", "lg", "xl" |
| `uiTag(text, ton, pictogramă)` | etichetă; ton: good, warn, crit, neutral, brand |
| `uiSection(titlu, dreaptaHtml)` | titlu de secțiune |
| `uiHero(etichetă, bani, subtext)` | cifra principală a ecranului |
| `uiStats([{ l, n, unit, s }])` | grilă de cifre |
| `uiKV([[etichetă, valoare]])` | perechi pe un rând |
| `uiBar(procent)` | bară de procent |
| `uiChips([[id, etichetă]], curent, act)` | filtre, comutare între vederi |
| `uiPoll(p)` | vot: deschis, votat, închis cu rezultat |
| `uiEvent(e)` | eveniment, cu participare și sume |
| `uiMoney(m)` | rând de încasare sau cheltuială |
| `uiThanks(t)` | mulțumire de networking |
| `uiSwitch(name, etichetă, ajutor, pornit, blocat)` | comutator pentru reguli |
| `uiPhotoPicker(nume, poză)` | alegerea pozei de profil |
| `uiWatermark(text)` | filigran peste datele de contact |

Câmpurile fiecărei piese sunt descrise în comentariul de deasupra funcției, în `js/12-ui-module.js`.
Clase utile: `.list` (grup de rânduri), `.acts` (rând de butoane), `.btn`, `.btn.sec`, `.btn.sm`, `.btn.crit`,
`.notice`, `.notice.info`, `.small`, `.num`, `.sep`, `.page-head`.

## Build, teste, publicare

```
python3 src/app.py                          # construiește public/app.html și public/app/
cd src/app && npx --yes prettier@3 --write "js/*.js" "css/*.css"     # formatare, înainte de build
cd src/app/tests && npm i --no-package-lock && node t_demo.js        # interfața în mod demonstrativ și catalogul
cd src/app/tests && node --no-warnings t_backend.mjs                 # API-ul și drepturile pe roluri
```

Testul complet în browser (`tests/e2e.py`, Playwright) cere mediul local Cloudflare, pe o bază goală:

```
npx wrangler d1 execute jci-test --local --config src/app/tests/wrangler.test.jsonc --file src/app/tests/init.sql
npx wrangler dev --local --config src/app/tests/wrangler.test.jsonc --port 8787 &
python3 src/app/tests/e2e.py                # apoi se șterge src/app/tests/.wrangler
```

Publicare: commit pe `main` și push. Cloudflare construiește singur; rezultatul se vede la verificările commit-ului
(`gh api repos/<repo>/commits/<sha>/check-runs`). După orice modificare în `public/*.html` cu script inline se rulează
`python3 src/security.py`; aplicația nu are script inline, deci nu cere asta.

Înainte de push: build fără erori, `t_demo.js` și `t_backend.mjs` trecute, niciun punct de mijloc, catalogul verificat
vizual dacă s-a atins grafica.
