# Surse site JCI Brașov

Folderul `public/` este ce se publică (Cloudflare Worker `jci-brasov-com`, auto-deploy la push pe `main`).
Aici sunt sursele din care se generează paginile.

- `source-onepage.html` – sursa principală RO (stiluri + toate secțiunile)
- `body-en.html` – corpul în engleză; `source-en.html` = antetul + `body-en.html`
- `build.py` – generează paginile RO și `assets/css/style.css`
- `build_en.py` – generează paginile EN în `/en/`
- `team3.py`, `spk.py` – prelucrarea pozelor (decupare rembg + fundal unificat bleumarin cu grilă)
- `esrgan.py` – mărire de rezoluție (neaprobată pentru poze, aspect artificial)

Notă: căile din scripturi sunt cele din mediul de lucru (/home/claude/tools, /home/claude/site);
la reluare se copiază `src/` în `/home/claude/tools` și `public/` în `/home/claude/site`.

Reguli: fără „·”, fără coduri ODD colorate, cercul din hero rămâne în spatele cardului,
poze netăiate pe același fundal, numele „Iustin Mazarache” fără diacritice.
Nu se publică: cursa de bărcuțe (2028), proiectul de depozitare bagaje, acțiunile inspirate de JCE Laval.

## Ordinea de build (actualizat 3 nov 2026)
1. `python3 build.py && python3 build_en.py && python3 post.py (rulează și countdown, theme, signup, chat, seo2) && python3 deploy.py && python3 security.py` (post.py: 404, noindex, h1, lazy; deploy.py copiază în public/ cu linkuri fără .html)
2. `icons.py` generează favicon, iconițe și imaginile de previzualizare (og-jci-brasov*.jpg); fontul Plus Jakarta Sans din @fontsource (npm)
3. Fișierele fixe din public/: `_headers` (antete de securitate), `robots.txt`, `sitemap.xml`, `site.webmanifest`, `.well-known/security.txt`, `favicon.ico`
4. Formularele trimit la `/api/form`, tratat de `worker/index.js` (același domeniu). Trimite prin Email Routing dacă variabila `DEST`
   e setată în Cloudflare (Worker → Settings → Variables), altfel prin FormSubmit, de pe server.


security.py: calculează amprentele SHA-256 ale scripturilor inline și le pune în CSP din public/_headers. Orice script inline nou sau modificat cere rularea lui după deploy.py.

## Bilet VIP prin Stripe (7 nov 2026)
- `vip.py` (după deploy.py, înainte de security.py): biletul VIP e separat de sponsorizări (scos din pachete și din formularul de sponsori);
  secțiunea #vip pe pagina evenimentului (Gratuit / VIP, contor în timp real, buton Stripe), butoane VIP lângă înscriere și pe prima pagină,
  `assets/js/vip.js` (citește /api/stats la 15 s) și `vip-confirmat.html` (RO/EN).
- Locuri VIP: 40, dintre care 15 rezervate deja; constante VIP_TOTAL/VIP_PRESOLD în worker și TOTAL/PRESOLD în vip.py.
- În Stripe, Payment Link-ul redirecționează după plată la https://jci-brasov.com/vip-confirmat (pagina deschide calendarul automat pe telefon).
- Worker: `/api/stripe-webhook` (evenimentul checkout.session.completed). Cere secretul `STRIPE_WEBHOOK_SECRET` în Cloudflare.
  Salvează cumpărătorul în D1, tabelul `vip`, îl adaugă în `inscrieri` (sursa „Bilet VIP (Stripe)”) și trimite email organizatorilor.

## Bilete nominale cu QR și check-in (7 nov 2026)
- `worker/checkin.js`: fiecare înscriere are un cod secret (`inscrieri.token`, 32 de caractere hex). Coloane noi: `prezent_la`, `prezent_de`.
  Tabele noi în D1: `setari` (PIN-ul echipei: `pin_salt` + `pin_hash` = SHA-256(sare:PIN); `cookie_secret` pentru sesiune) și `checkin_log`.
- `/bilet/<cod>`: biletul public al participantului, cu QR (assets/js/qrcode.js, licență MIT, și bilet.js). QR-ul duce la `/c/<cod>`.
- `/c/<cod>`: pentru echipa conectată, fișa de check-in (invitație validă, deja folosită sau listă de așteptare, buton „Confirmă intrarea”);
  pentru oricine altcineva, redirecționează la bilet, fără să confirme nimic.
- `/checkin` (inițial /echipa, mutat pe 7 nov ca să nu ascundă pagina Echipa): autentificare cu nume + PIN (sesiune 16 ore, max. 10 încercări/oră), contor live, căutare după nume/email/telefon/companie,
  ultimele intrări cu anulare, export CSV (`/api/echipa/export.csv`). Script: assets/js/echipa.js.
- Înscrierile noi primesc codul la salvare; pagina de confirmare afișează cardul „Biletul tău” (assets/js/bilet-link.js, adăugat de `src/checkin.py`,
  care rulează după deploy.py și vip.py). Codurile lipsă (ex. biletele VIP din Stripe) se completează automat la fiecare încărcare a panoului.
- Schimbarea PIN-ului: se generează altă sare și alt hash și se actualizează rândurile `pin_salt` și `pin_hash` din `setari`.

## Invitații automate pe email, din Gmail (7 nov 2026)
- `worker/invitatii.js`: `/api/invitatii/de-trimis?key=` dă lista înscrierilor confirmate fără invitație (coloana `inscrieri.invitatie_trimisa`),
  cu subiect, HTML și text gata construite; `/api/invitatii/trimis` marchează trimiterea; `/bilet/<cod>/qr.png` dă QR-ul ca PNG (Gmail nu afișează SVG).
- Setări D1 (`setari`): `invit_key` (cheia scriptului), `invit_mod` = `test` (trimite doar adreselor din `invit_test`) sau `live` (tuturor).
  Rândurile de test se exclud cu `invitatie_trimisa = 'exclus-test'`.
- `src/gmail/Invitatii.gs`: Google Apps Script din contul Gmail care trimite; `instaleaza()` creează declanșatorul la 5 minute, `opreste()` îl șterge.
  Limita Gmail pentru cont personal: aproximativ 100 de destinatari pe zi; restul pleacă automat a doua zi.
- Butonul „Confirm primirea invitației” din email duce la `/confirma/<cod>`; confirmarea se salvează prin POST (automat în browser, prin assets/js/confirma.js),
  în coloana `inscrieri.primire_confirmata`. Panoul /echipa arată invitațiile trimise și confirmările; exportul CSV le include.
- Rânduri cu `status = 'test'`: primesc invitația (dacă adresa e în `invit_test`), au bilet valid, dar nu intră în numărul de înscriși.

## Parteneri confirmați și acordul BCR (8 nov 2026)
- `toplive.py` (după vip.py și checkin.py): rapoartele în timp real de înscrieri și de bilete VIP, urcate în capul paginii evenimentului (RO/EN), deasupra cronometrului.
- `parteneri.py` (după deploy.py, vip.py și checkin.py, înainte de security.py): blocul „Partenerii evenimentului” pe pagina evenimentului (RO/EN),
  cu BCR Asigurări (Partenerul Panelului I) și CATTIA Brașov (partener de locație); bifa opțională „Doresc să fiu contactat de BCR Asigurări”
  în formularul de înscriere și întrebarea frecventă despre date actualizată.
- D1: coloana nouă `inscrieri.acord_bcr` (0/1), salvată de `/api/inscriere`; exportul CSV din /checkin are coloana „Acord BCR”.
  La BCR se transmit doar numele, emailul și telefonul celor cu `acord_bcr = 1`.

## Meta Pixel cu acord GDPR și politica de confidențialitate (9 nov 2026)
- Pixel ID 1646950960458698. Codul de bază Meta e INLINE în <head> (altfel verificatorul Meta nu recunoaște instalarea), cu fbq('consent','revoke')
  până la „Accept”; `public/assets/js/meta-pixel.js` face bannerul și fbq('consent','grant'). Alegerea se ține
  (6 luni în localStorage, cheia `jci_consent`; „Refuz” șterge _fbp/_fbc). Fără `<noscript>` (ar urmări fără acord).
  Evenimente: PageView; CompleteRegistration pe inscriere-confirmata și vip-confirmat; Lead pe multumim.
- `public/assets/css/consent.css`: bannerul (stânga jos, butoane egale) și stilul paginii de politică.
- `src/confidentialitate-ro.html` / `-en.html`: conținutul politicii. `pixel.py` generează /confidentialitate și /en/confidentialitate
  pe scheletul paginii multumim, adaugă în subsol „Politica de confidențialitate” și „Setări cookie-uri” (redeschide bannerul),
  leagă bifele de acord din formulare de politică, adaugă paginile în sitemap și domeniile Meta în CSP.
- Ordine: după parteneri.py, ÎNAINTE de security.py (`security.py` pune connect.facebook.net în script-src). Idempotent.
- Paginile private (/bilet, /c, /checkin, generate de worker) nu au pixel.
- 9 nov 2026: bannerul e SCOS temporar (BANNER = False în pixel.py și meta-pixel.js): pixelul pornește cu fbq('consent','grant'). Pentru revenire: True în ambele, apoi pixel.py + security.py.
- Unealta Meta „Configurează evenimente” (9 nov 2026): cere `Cross-Origin-Opener-Policy: unsafe-none` (fereastra Facebook comunică prin window.opener)
  și domeniile *.facebook.com, *.facebook.net, *.fbcdn.net în script/style/font/img/connect/frame-src. Le pune `pixel.py` (și `security.py` la script-src).

## Blitz Networking: bloc, număr și mese la check-in (11 nov 2026)
- La scanarea biletului (`/c/<cod>`) și la confirmarea manuală din panou, `worker/checkin.js` alocă automat blocul (A, B, C...),
  numărul de pe ecuson (1–25) și masa pentru fiecare dintre cele 6 runde (3 în Blitz #1, 3 în Blitz #2). Ecranul arată ce se scrie pe ecuson.
- Blocuri de câte 25, grila 5x5 peste Z5, cele 6 clase de drepte paralele = cele 6 runde: într-un bloc complet fiecare pereche se întâlnește
  exact o dată (24 de contacte noi). În bloc incomplet nu există repetări, dar sunt mai puține contacte și grupe de 2–5 persoane.
- Alocarea pe valuri (WAVES în worker: 3, 2, 1, apoi câte unul): întâi se umplu A, B, C, apoi D, E, apoi F. În val, persoana nouă merge în blocul cu cei
  mai puțini oameni (la egalitate, la întâmplare), deci cei care sosesc împreună ajung în blocuri diferite, iar la prezență mică primele blocuri sunt pline.
  Un loc eliberat prin anulare într-un val anterior se ocupă primul.
  Cei care intră în aceeași perioadă (FRIEND_WINDOW_S, 3 minute) sunt împrăștiați în blocuri diferite; la scanări în aceeași fracțiune de secundă,
  persoana cu id-ul mai mare se mută dacă a nimerit în același bloc (spreadFriends). Limită: în valul B-C cu 2 blocuri sau în F cu un singur bloc, trei prieteni nu pot fi separați.
- Coloane noi în `inscrieri`: `bloc`, `slot` (index unic pe eveniment, bloc, slot). Anularea intrării eliberează locul.
- Blocurile au nume (BLOC_NAMES: Scânteia, Busola, Puntea, Urcușul, Vârful, Orizontul, Farul, Zorii), doar ca etichetă; codurile rămân litera și numerele (persoana C7, mesele C1 până la C5). Panoul echipei arată câți oameni are fiecare bloc; exportul CSV conține blocul, numărul și cele 6 mese.
- `FILL_ORDER` din worker este ordinea de ocupare a grilei, aleasă ca grupele să rămână echilibrate la blocuri incomplete.

## JCI Business la /app: aplicația membrilor (11 nov 2026)
- Adresa: `https://jci-brasov.com/app`. Intrarea de pe site e butonul „Intră în JCI Business” din secțiunea „Acces echipă” a paginii Echipa (RO/EN),
  lângă cel de check-in. Legătura e într-un singur sens: site către aplicație. Aplicația nu conține niciun link către site (`src/app.py` verifică asta la build).
- Sursa e pe module, în `src/app/`: `index.html` (scheletul), `css/*.css`, `js/*.js`, `img/`. Ghidul pentru actualizări: `src/app/README.md`;
  ce urmează (roluri, drepturi, etape): `src/app/SPEC-ROLURI.md`. `python3 src/app.py` lipește modulele în `public/app.html`,
  `public/app/app.css` și `public/app/app.js` (fără script inline, din cauza CSP), copiază logoul și pictograma, pune fonturile site-ului din `/assets/fonts`
  și adaugă butonul pe Echipa. Fișierele au `?v=<amprentă>` și antet de cache de un an (îl pune `worker/index.js`); `app.html` se revalidează mereu.
  Pagina nu se indexează (meta robots noindex și antetul X-Robots-Tag din worker); robots.txt nu o blochează, ca interdicția să poată fi citită. Idempotent. Ordine: ULTIMUL înainte de `security.py` (după `pixel.py`). `pixel.py` exclude `app.html`: aplicația nu are pixel și nu încarcă nimic din afara site-ului.
- Viteză: paginile publice ale site-ului nu încarcă nimic din aplicație. În aplicație, datele se reîmprospătează la 60 s doar cât pagina e vizibilă
  și omul a fost activ în ultimele 3 minute, plus la revenirea în pagină și după fiecare scriere.
- `worker/app.js` (API la `/api/app/*`) și `worker/index.js` (antete noindex și no-cache pentru `/app`). Tabele D1, create automat la prima cerere:
  `app_docs` (path, id, data JSON), `app_meta` (revizii pe cale), `app_sessions`, `app_codes`, `app_state` (valabilitatea și suspendarea fiecărui cont),
  `app_auth` (e-mailul și amprenta parolei fiecărui cont).
- Autentificare (12 nov 2026, `src/app/etape/E1b-autentificare.md`):
  - codul de 12 caractere, de unică folosință, valabil 14 zile, deschide contul doar la PRIMA intrare. Imediat după, omul își pune e-mail și parolă
    și de acolo intră doar cu ele. Pentru un cont cu parolă nu se mai poate genera și nu se mai poate folosi niciun cod.
  - parola: PBKDF2 cu SHA-256, sare pe cont, 20.000 de iterații (limita de procesor a platformei); în bază nu există parola în clar.
  - parolă uitată: superiorul face „Resetează accesul” (președintele pentru membrii lui, președintele național pentru președinți, administratorul
    pentru președintele național și președinți). Resetarea șterge e-mailul, parola și sesiunile, întoarce un cod nou și rămâne în jurnal.
  - sesiunea ține 60 de zile (cookie `jci_app`, HttpOnly, Secure, SameSite=Strict, doar pe `/api/app`), maximum 5 dispozitive.
  - administratorul tehnic intră cu o cheie; în `setari` se țin doar `app_mod_salt` și `app_mod_hash` = SHA-256(sare:cheie). Sesiune de 14 zile.
    Schimbarea cheii: se rescriu cele două rânduri din `setari`, apoi `DELETE FROM app_sessions WHERE user_id='mod'`.
  - se numără doar încercările greșite (tabelul `rate_log`): 10 pe oră de la aceeași adresă la coduri și la parole, 8 pe oră pe același cont, 5 pe oră la cheia administratorului.
- Roluri și structură (etapa 1, `src/app/etape/E1.md`): administrator tehnic, președinte național, președinte de filială, vicepreședinte trezorier,
  alte funcții de conducere (cu titlu liber), membru. Filialele sunt o listă în baza de date (`branchlist`). Rolurile și filialele se schimbă doar prin
  operațiile de la `/api/app/admin`: `setNational`, `addBranch`, `setPresident`, `setRole`, `handover`, `exclude`, `reactivate`, `resetAccess`, `candidates`.
  Administratorul tehnic și președintele național nu citesc datele interne ale filialelor. Președintele poate suspenda și reactiva un membru.
- Evenimente și voturi (12 nov 2026, `src/app/etape/E3-E4-evenimente-voturi.md`): `branches/<b>/events` (le creează președintele și funcțiile de conducere),
  `branches/<b>/attend` (participarea și „ce am făcut”; conducerea filialei vede toate rândurile, membrul doar pe ale lui), `polls` și `branches/<b>/polls`
  cu `POST /api/app/vote`. Votul e secret: tabelul `app_votes` nu se citește niciodată pe om, totalurile pe opțiuni apar doar după închidere.
- Excluderea automată: contul e suspendat când au trecut mai mult de 3 luni de la expirarea calității de membru (`valid_until`), fără cotizație achitată.
  Se calculează pe server la fiecare cerere, după data din Europe/Bucharest; plata cotizației sau prelungirea valabilității redă accesul. Se aplică și conducerii.
- Ce verifică serverul: filialele sunt izolate (conducerea unei filiale citește doar datele ei; un identificator de membru aparține unei singure filiale);
  membrii simpli nu citesc cotizații, donații, cheltuieli, evidență sau jurnal; profilul fără acord pentru director ajunge doar la titular și la președintele
  și trezorierul filialei lui; data de valabilitate a altui membru nu se trimite membrilor; numele donatorilor ajung doar la președintele și trezorierul filialei;
  jurnalul nu se rescrie și nu poate imita intrări de structură; cotizațiile, donațiile și cheltuielile nu se șterg, doar se anulează.
  Regulile de separare a atribuțiilor la cheltuieli (cine propune nu aprobă) sunt deocamdată doar în interfață.
- Mod demonstrativ, cu date fictive și fără server: `/app?demo`. Catalogul vizual al componentelor (referința grafică): `/app?ui`.
- Teste (`src/app/tests/`): `t_backend.mjs` (drepturile fiecărui rol și autentificarea, pe o bază SQLite locală), `t_demo.js`
  (interfața în mod demonstrativ, catalogul și un server simulat, în jsdom) și `e2e.py` (Playwright pe mediul local Cloudflare: fluxul complet
  administrator, președinte național, președinte, trezorier, membru; CSP și lipsa linkurilor către site). Comenzile sunt în `src/app/README.md`.

## Apeluri către contacte (12 nov 2026)
- Pagina `/checkin/apeluri` (la fiecare modificare a apeluri.js se schimbă `JS_VERSION` din worker/apeluri.js, altfel telefoanele păstrează scriptul vechi din cache) (PIN-ul echipei, buton „Apeluri și contacte” în panoul /checkin). Cod: `worker/apeluri.js`, interfața `public/assets/js/apeluri.js` (fără script inline, CSP).
- Înscrierea la eveniment e acum în `worker/inscriere-core.js` (eveniment, capacitate 150, termen 24 noiembrie 23:59, `registerPerson`), folosită și de formularul public, și de apeluri. Orice schimbare de capacitate sau termen se face doar acolo.
- D1, tabele noi (create automat, `CREATE TABLE IF NOT EXISTS`): `contacte` (o persoană = un rând, `inscriere_id` leagă de înscriere), `contact_surse` (toate sursele, cu dată), `call_logs` (apelurile, toate răspunsurile chestionarului), `posibile_duplicate`. `inscrieri` nu se modifică, în afară de înscrierile noi făcute prin apel (sursa „Telefon (Nume)”).
- Sincronizare la fiecare deschidere a listei: înscrierile reale (confirmat sau listă de așteptare, fără teste) devin contacte; dacă telefonul normalizat (+40...) există deja ca contact, se leagă și primesc sursa „Site”. Același telefon normalizat = aceeași persoană (se unesc automat, dacă nu au două înscrieri). Același email sau nume care se conțin, cu telefoane diferite = „posibile duplicate”, rezolvate manual (unire sau persoane diferite).
- Contactele din afara site-ului (WhatsApp, Meta Ads, parteneri) se încarcă direct în D1 (`INSERT INTO contacte (nume, telefon)` cu telefon +40..., apoi `INSERT INTO contact_surse`). NU se pun numere de telefon în cod: depozitul e public.
- Starea invitației pe Gmail: „trimis” = `invitatie_trimisa` completat (fără „exclus” sau „eroare”); „confirmat” = `primire_confirmata` (a apăsat butonul din email; nu există urmărire de deschidere). Întrebarea pentru invitați vine din `inscrieri.intrebare` sau din chestionar (`call_logs.intrebare_invitati`).
- Înscriere prin telefon: doar pentru contact neînscris, cu „Confirmat”, email valid și acord verbal; după termen cere confirmare; capacitate plină = listă de așteptare. Emailul de invitație pleacă prin scriptul Gmail existent (la 5 minute).
- Setări opționale în `setari`: `colegi` (nume separate prin virgulă, pentru „Cine a sunat”) și `surse_contact` (lista surselor, implicit Site, WhatsApp, Meta Ads, Partener, Contact personal, Telefon, Altă sursă).
- Chestionarul urmează formularul echipei (12 nov 2026): 23 de întrebări în 3 secțiuni, toate vizibile mereu, cu formulări către persoana sunată; obligatorii doar 1 (cine a sunat), 2 (nume), 6 (ați reușit să vorbiți) și 17 (status final). „Confirmat” se poate alege doar dacă s-a vorbit. Întrebarea 21 are trei bife separate (date eveniment, invitații viitoare, BCR). Coloana `call_logs.invitatie_trimisa` păstrează răspunsul la întrebarea 22 („I s-a trimis linkul de înscriere / invitația?”, da/nu). Întrebările 1, 2, 5, 6, 22 și 23 sunt pentru apelant, nu se citesc cu voce tare.
- Chestionarul completat de persoană (14 nov 2026): fiecare contact are un cod (`contacte.cod`, 12 caractere). Butonul „Trimite chestionarul” din panou
  deschide WhatsApp cu mesajul și linkul personal `/q/<cod>`; pagina publică (`chestionarPage`) arată doar numele, iar `POST /api/chestionar`
  (`chestionarSave`) salvează prin `saveCall`, cu apelantul „Chestionar online”. Cine răspunde că participă și nu e înscris este înscris cu sursa
  „WhatsApp”. Domeniile țintă se iau doar de la cine vrea bilet VIP sau are unul plătit. Interfața: `public/assets/js/chestionar.js`.
- Întrebarea 17 (statusul final) nu este obligatorie în chestionarul de apel (14 nov 2026).
- Teste: `node --no-warnings src/tests/apeluri.test.mjs` (backend) și `src/tests/apeluri-ui.test.mjs` (interfață, cere jsdom).

## Blitz Networking pe domenii și „Networking curatoriat” pentru VIP (13 nov 2026)
- Lista de domenii (14, inclusiv „Alt domeniu”, care nu intră în potrivire): `worker/domenii.js`. Copii în `public/assets/js/apeluri.js`,
  `src/domenii.py` (formularele publice); `src/tests/blitz.test.mjs` verifică faptul că listele coincid.
- D1: `inscrieri.domeniu` (cod), `inscrieri.tinte` (cel mult 3 coduri, cu virgulă), `call_logs.domeniu`, `call_logs.tinte`, tabelul `vip_domenii` (email, domeniu, tinte).
- De unde vin datele: câmp obligatoriu „Domeniul tău de activitate” în formularul de înscriere (`/api/inscriere`); formularul „Networking curatoriat”
  de pe `vip-confirmat` (`assets/js/vip-domenii.js`, `/api/vip-domenii`, legat de înscriere doar pentru bilete VIP plătite); întrebările 9a și 18a
  din chestionarul de apeluri (obligatorii la apel pentru cine are bilet VIP plătit și nu le are deja).
- `src/domenii.py` (după pixel.py; fără scripturi inline, deci nu cere security.py): pune câmpul în formularul de înscriere și formularul pe vip-confirmat, RO/EN.
- VIP pentru potrivire = bilet plătit (sursa „Bilet VIP (Stripe)” sau emailul în tabelul `vip`) sau orice înscriere cu domenii țintă completate
  (invitații VIP cu loc rezervat, completați de echipă la apel).
- Alocarea (`worker/blitz-match.js`, funcții pure; folosite de `worker/checkin.js`):
  1. Cu o zi înainte: pagina `/checkin/blitz` (buton în panoul echipei) așază VIP-ii în primele K blocuri, cei care se caută reciproc împreună.
     K se alege din pagină; recomandarea presupune că vin 70% dintre înscriși (`SHOW_RATE`, presupunere nemăsurată) și cel mult 12 VIP pe bloc.
     Dacă nu apasă nimeni, împărțirea se face singură la prima scanare de după 25 noiembrie, ora 00:00. Setări: `blitz_vip_blocuri`, `blitz_vip_prealoc`.
  2. La scanare: participantul merge în blocul deschis unde domeniul lui e cel mai cerut de cei de acolo (împărțit la câți din același domeniu sunt deja),
     dacă blocul nu depășește cu mai mult de 3 oameni cel mai liber bloc din val. Fără domeniu sau fără cerere: regula veche.
  3. Dacă VIP-ii stau în mai mult de 3 blocuri, primul val cuprinde toate blocurile lor. Cine e așezat după domeniu nu mai e mutat de `spreadFriends`.
  4. Anularea unui check-in eliberează locul, inclusiv pe cel rezervat al unui VIP; la rescanare primește loc după domeniu.
- Panoul /checkin: „Blocuri, câți au primit ecuson” numără doar persoanele intrate (locurile rezervate VIP nu se văd acolo, ci pe /checkin/blitz).
- Teste: `node --no-warnings src/tests/blitz.test.mjs`. Simulare cu date inventate: `node src/tests/blitz-sim.mjs`.
