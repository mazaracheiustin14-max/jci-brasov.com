# Etapele 3 și 4: evenimente cu participare și contor pe persoană; voturi

Cerința lui Iustin (12 noiembrie 2026): evenimente la care membrii spun că participă, o contorizare a evenimentelor la care a
fost fiecare persoană și a ce a făcut acolo, vizibilă mai ales vicepreședintelui de proiecte; voturi (naționale și de adunare
generală). Partea de bani pe eveniment vine cu registrul simplu (etapa 2), nu acum.

Se implementează exact ce scrie aici. Context: `../README.md`, `../SPEC-ROLURI.md`, `E1.md`, `E1b-autentificare.md`.
„Conducerea filialei” înseamnă `president`, `treasurer`, `board` ai acelei filiale. „Membru al filialei” înseamnă orice cont
activ cu filiala proprie egală cu filiala din cale, indiferent de rol.

## Partea A: server (`worker/app.js`, `tests/t_backend.mjs`)

### A1. Evenimente: colecția `branches/<b>/events`
- Document: `{ title (2..120), date "AAAA-LL-ZZ", place (0..120), note (0..500), cancelled (bool), createdBy, createdAt }`.
- Scriere prin `/api/app/write`: `president` și `board` ai filialei; fără ștergere (se anulează cu `cancelled: true`);
  `createdBy` și `createdAt` le pune serverul la creare și le păstrează apoi.
- Citire: toți membrii filialei. `mod` nu citește. La `pull`, fiecare eveniment primește în plus `count` (câți au `going: true`).

### A2. Participare: colecția `branches/<b>/attend`
- Id-ul documentului este `<eventId>_<memberId>`; serverul îl verifică și îl reconstruiește din câmpuri.
- Document: `{ eventId, memberId, going (bool), did (0..300, ce a făcut omul la eveniment), amount (întreg >= 0, în bani, opțional), at, by }`.
- Scriere: membrul filialei pentru el însuși (`memberId` egal cu id-ul lui); `president` și `board` ai filialei pentru orice
  membru din evidența filialei (ca să poată consemna prezența). Evenimentul trebuie să existe în aceeași filială și să nu fie
  anulat. `at` și `by` le pune serverul. Fără ștergere (retragerea se face cu `going: false`).
- Citire la `pull`: conducerea filialei primește toate rândurile, fiecare cu `name` (numele membrului din evidență);
  un membru simplu primește doar rândurile lui. `mod` nu citește.

### A3. Voturi
- Colecții: `polls` (naționale) și `branches/<b>/polls` (adunarea generală a filialei).
- Document: `{ title (4..200), options: [{ id, label (1..80) }] între 2 și 8, closes "AAAA-LL-ZZ", closed (bool), cancelled (bool), createdBy, createdAt }`.
- Creare și modificare prin `/api/app/write`: `polls` doar de `national`; `branches/<b>/polls` doar de `president` al filialei.
  După primul vot primit, `title` și `options` nu se mai pot schimba (400); se mai pot schimba doar `closes`, `closed`, `cancelled`. Fără ștergere.
- Cine votează: la `polls`, conturile cu rol `president`; la `branches/<b>/polls`, membrii filialei, cu excepția celui cu rol `national`.
- Tabel nou `app_votes (path TEXT, poll_id TEXT, voter_id TEXT, option_id TEXT, at TEXT, PRIMARY KEY (path, poll_id, voter_id))`.
  Voturile nu se trimit niciodată individual către nimeni.
- `POST /api/app/vote` cu `{ path, pollId, optionId }`: verifică dreptul de vot, că votul e deschis (`closes` >= azi, în
  Europe/Bucharest, nu e `closed`, nu e `cancelled`), că opțiunea există și că omul nu a mai votat (al doilea vot: 400). Răspuns `{ ok: true }`.
- Citire la `pull`: `polls` îl citesc `national` și conturile cu rol `president`; `branches/<b>/polls` îl citesc membrii filialei,
  cu excepția celui cu rol `national`; `mod` nu citește niciunul. Fiecare vot din listă primește:
  `state` (`open` sau `closed`), `mine` (opțiunea aleasă de cel care citește, sau `""`), `canVote` (bool), `total` (câte voturi),
  `voters` (câți au drept de vot), iar `options[i].votes` doar când votul e închis (votul e secret: până la închidere nu se
  văd totalurile pe opțiuni). Doar pentru cel care a creat votul: `votedNames` (numele celor care au votat, fără opțiune).
- Un vot primit ridică revizia căii, ca listele să se reîmprospăteze.

### A4. Teste noi
Câte o verificare pentru fiecare regulă de mai sus, în special:
1. eveniment: `president` și `board` creează; `treasurer` și membrul simplu nu (403); altă filială 403; `mod` și un membru din altă filială nu citesc;
2. participare: membrul scrie pentru el; nu pentru altul (403); `board` scrie pentru un membru din evidență; eveniment anulat sau inexistent 400;
   membrul simplu primește la `pull` doar rândurile lui; `board` le primește pe toate, cu `name`; `count` corect pe eveniment;
3. vot național: îl creează doar `national`; votează doar `president`; `national` nu votează; un membru simplu nu îl citește;
4. vot de filială: îl creează doar `president`; votează membrii filialei; `national` din acea filială nu îl citește și nu votează; alt filială 403;
5. al doilea vot 400; vot după `closes` sau pe vot închis ori anulat 400; opțiune inexistentă 400;
6. totalurile pe opțiuni lipsesc cât e deschis și apar după închidere; `votedNames` apare doar la creator; niciun răspuns nu conține cine ce a votat;
7. după primul vot, schimbarea titlului sau a opțiunilor dă 400.

## Partea B: interfață

Doar piese existente: `uiEvent`, `uiPoll`, `uiChips`, `uiStats`, `uiTag`, `row`, `openSheet`. Niciun stil nou.

### B1. Navigare (`tabsFor()`)
Cinci file sunt maximul. Profilul rămâne la avatarul din antet pentru cine are fila „Filială”.
- membru: Director, Evenimente, Voturi, Profilul meu;
- `president`, `treasurer`: Director, Evenimente, Voturi, Filială. „Filială” adună ecranele de acum (Tablou, Cotizații, Donații,
  Cheltuieli) sub un rând de `uiChips`; conținutul lor nu se schimbă;
- `board`: Director, Evenimente, Voturi, Filială (doar Donații și Cheltuieli, citire);
- `national`: Director, Evenimente, Voturi, Structură (profilul la avatar);
- `mod`: doar Structură.
Pictograme: `cal` pentru Evenimente, `vote` pentru Voturi, `build` pentru Filială și Structură.

### B2. Evenimente (fișier nou `62-evenimente.js`)
- Lista evenimentelor filialei proprii: „Urmează” și „Au trecut”, cu `uiEvent` (fără sume). Butonul „Vin și eu” / „Particip”
  scrie `going`. La un eveniment trecut la care omul a spus că participă: „Am participat” și un buton „Ce am făcut” (foaie:
  text scurt și, opțional, o sumă în RON), care scrie `did` și `amount`.
- Sus, pentru fiecare om: „Ai participat la N evenimente” (N = rândurile lui cu `going` la evenimente trecute, neanulate).
- `president` și `board`: buton „Adaugă eveniment” (foaie: denumire, dată, loc, descriere), editare și anulare din foaia
  evenimentului. La apăsarea unui eveniment, foaia arată participanții cu ce a făcut fiecare.
- Conducerea filialei (`president`, `treasurer`, `board`): un al doilea ecran, ales cu `uiChips` („Evenimente”, „Participare”).
  „Participare” arată, pentru fiecare membru care apare în rânduri, numărul de evenimente la care a participat (descrescător);
  la apăsare, foaia cu lista evenimentelor lui și ce a făcut la fiecare. `president` și `board` pot consemna aici prezența
  unui membru la un eveniment trecut (foaie: membrul, evenimentul, ce a făcut); lista membrilor pentru `president` vine din evidență,
  pentru `board` din rândurile existente.

### B3. Voturi (fișier nou `64-voturi.js`)
- Lista: voturile naționale (pentru `national` și `president`) și voturile filialei (pentru membrii ei, mai puțin `national`),
  cu `uiPoll`. Trimiterea formularului cheamă `POST /api/app/vote`, apoi reîmprospătează.
- `uiPoll` primește: `voted` = `mine`, `canVote`, `showResults` = votul e închis, `voters`, `scope` („Președinții de filiale” sau
  „Adunarea generală, <filiala>”).
- Creatorul: „Vot nou” (foaie: întrebarea, opțiunile câte una pe rând, data închiderii), „Închide votul acum”, „Anulează votul”,
  și „Cine a votat” (lista `votedNames`).

### B4. Mod demonstrativ și teste
- `demoSeed`: două evenimente, câteva participări, un vot deschis și unul închis; votarea în demo se ține local.
- `t_demo.js` și `e2e.py` la zi cu navigarea nouă și cu fluxurile: președintele creează un eveniment, un membru spune că
  participă și scrie ce a făcut, o funcție de conducere („Vicepreședinte proiecte”) vede contorul pe persoană; președintele
  creează un vot, membrii votează, votul se închide și apar totalurile; președintele național creează un vot național și un
  președinte votează. Capturi: `e3_evenimente.png`, `e3_participare.png`, `e3_ce_am_facut.png`, `e4_voturi.png`, `e4_rezultat.png`.
