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
