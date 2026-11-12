# Etapa 1b: intrare cu e-mail și parolă; codul doar la prima intrare

Cerința lui Iustin (12 noiembrie 2026): codul e doar pentru prima intrare. După ce omul a intrat și și-a pus e-mailul și
parola, codul devine inutilizabil. Astfel nimeni nu mai poate intra în contul altcuiva generând un cod nou.

Se implementează exact ce scrie aici. Contextul: `E1.md`, `../README.md`.

## Regula

1. Codul de unică folosință (generat ca până acum) deschide contul o singură dată. Imediat după intrarea cu cod, omul trebuie
   să își pună e-mail și parolă; până atunci nu poate face nimic altceva în aplicație.
2. De acolo intră doar cu e-mail și parolă. Pentru un cont care are e-mail și parolă nu se mai poate genera și nu se mai
   poate folosi niciun cod.
3. Parolă uitată: superiorul face „Resetează accesul”. Resetarea șterge e-mailul, parola și toate sesiunile contului și
   întoarce un cod nou de primă intrare. Omul reia pasul 1. Resetarea se vede: vechea parolă nu mai merge, iar operația
   rămâne în jurnal. Nu există resetare prin e-mail (site-ul nu poate trimite e-mailuri către membri).
4. Administratorul tehnic intră în continuare cu cheia lui; pentru el nu se schimbă nimic.

## Partea A: server (`worker/app.js`, `tests/t_backend.mjs`)

### Tabel nou (în `ensureSchema`)
`app_auth (member_id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, hash TEXT NOT NULL, iter INTEGER NOT NULL, updated TEXT NOT NULL)`

### Parola
- PBKDF2 cu SHA-256 prin `crypto.subtle`, sare de 16 octeți aleatori pe cont, `PBKDF2_ITER = 20000` (limita de procesor a
  platformei nu permite mult mai mult), rezultat de 32 de octeți, comparat cu `eqConst`. Numărul de iterații se ține pe rând,
  ca să poată fi crescut mai târziu.
- Parola: între 8 și 100 de caractere. E-mailul: tăiat de spații, litere mici, cel mult 120 de caractere, formă
  `ceva@domeniu.ext`; unic pe aplicație.

### Sesiunea și starea „fără parolă”
- `getUser` adaugă `hasCred` (există rând în `app_auth`); pentru `mod` e mereu adevărat.
- Cât timp un membru nu are e-mail și parolă, sesiunea lui poate chema doar `GET /api/app/me`, `POST /api/app/setcred` și
  `POST /api/app/logout`. Orice altceva (`pull`, `write`, `code`, `admin`) primește 403 cu `{ error, needCred: true }`.
- `GET /api/app/me` întoarce în plus `needCred` (adevărat dacă lipsesc e-mailul și parola) și `email` (e-mailul contului, doar titularului).

### Puncte de intrare
| Cale | Corp | Reguli |
|---|---|---|
| `POST /api/app/login` | `{ code }` | ca acum, dar dacă membrul din cod are deja e-mail și parolă: 400, „Contul are deja e-mail și parolă. Intră cu ele.”, codul rămâne nefolosit. Răspuns la succes: `{ ok: true, needCred: true }` |
| `POST /api/app/setcred` | `{ email, password }` la prima setare; `{ email, password, current }` la schimbare | cere sesiune de membru. Prima setare: doar dacă nu are încă. Schimbare: `current` trebuie să fie parola actuală (altfel 403), se pot schimba e-mailul, parola sau ambele. E-mail folosit de alt cont: 400. La succes: `{ ok: true }`; la prima setare se șterg codurile nefolosite ale membrului; la schimbare se închid celelalte sesiuni ale lui |
| `POST /api/app/passlogin` | `{ email, password }` | verifică parola, verifică starea (exclus: 403 cu `excluded`, `reason`, ca la `login`), creează sesiune ca la `login`. Greșit: 400 cu același mesaj pentru e-mail necunoscut și parolă greșită: „E-mail sau parolă greșită.” |

Limitarea încercărilor la `passlogin` (tabelul `rate_log`, ca la coduri): cel mult 10 eșecuri pe oră de la aceeași adresă
(`tooManyFails` cu găleata `apppass`) și cel mult 8 eșecuri pe oră pe același cont (o înregistrare în `rate_log` cu găleata
`appacct` și, în câmpul `ip`, amprenta SHA-256 a e-mailului). Peste limită: 429. Pentru un e-mail necunoscut se face totuși
un calcul PBKDF2 pe o sare fixă, ca timpul de răspuns să nu arate dacă e-mailul există.

### Coduri și resetare
- `POST /api/app/code` (președinte, pentru un membru al filialei lui): refuz 400 dacă membrul are e-mail și parolă:
  „Contul are deja e-mail și parolă. Folosește «Resetează accesul» dacă membrul nu mai poate intra.”
- În `/api/app/admin`, operația `leaderCode` dispare. Operație nouă `resetAccess` cu `{ memberId }`:
  - ținta fără rol sau cu rol `treasurer` ori `board`: doar `president` al filialei ei (nu pentru el însuși);
  - ținta `president`: `national` sau `mod`;
  - ținta `national`: doar `mod`;
  - ținta exclusă: 400.
  Efect: șterge rândul din `app_auth`, toate sesiunile și codurile nefolosite ale țintei, generează un cod nou și întoarce
  `{ ok: true, memberId, code, expires }`. Jurnal: „Acces resetat: <nume>”, cu `path` `branches/<filială>/members` pentru
  membri, `treasurer`, `board` și `path` `roles` pentru `president` și `national`.
- `setNational`, `setPresident`, `addBranch` întorc cod doar dacă persoana nu are e-mail și parolă (în loc de „nu are cont activat”).
- La `exclude` rândul din `app_auth` rămâne (la reactivare omul intră cu aceeași parolă).
- Intrarea din jurnal `relogin` dispare (nu mai poate exista).

### Teste noi (`tests/t_backend.mjs`)
Pregătirea existentă se adaptează: după fiecare intrare cu cod, testul setează e-mail și parolă. Verificări noi:
1. după intrarea cu cod, `pull`, `write`, `admin` dau 403 cu `needCred` până la `setcred`; `/me` are `needCred: true`;
2. `setcred`: parolă scurtă, e-mail greșit, e-mail deja folosit: 400; succes; apoi `/me` are `needCred: false` și `email`;
3. `passlogin` cu parola bună merge; parolă greșită și e-mail necunoscut dau același 400; după 8 eșecuri pe cont: 429;
4. pentru un cont cu parolă: `/api/app/code` dă 400; un cod generat înainte de setarea parolei nu mai merge după;
5. schimbarea parolei: fără `current` sau cu `current` greșit, 403; cu `current` bun merge, vechea parolă nu mai merge, celelalte sesiuni se închid;
6. `resetAccess`: președintele pentru un membru al lui merge (vechea parolă și vechea sesiune nu mai merg, codul nou merge și cere din nou `setcred`); pentru un membru din altă filială 404; pentru el însuși refuz; `national` pentru un președinte merge, pentru un membru simplu 403; `mod` pentru `national` merge;
7. parolele nu apar în niciun răspuns și în niciun document; în `app_auth` nu există parola în clar;
8. administratorul tehnic intră în continuare cu cheia și nu e afectat de `needCred`.

## Partea B: interfață (`src/app/js`, `tests/t_demo.js`, `tests/e2e.py`)

Doar piese existente din setul de componente.

1. Ecranul de intrare (`45-acces.js`): formularul principal are „E-mail” și „Parolă” și butonul „Intră” (`passlogin`).
   Dedesubt, un `details` „Prima intrare? Am un cod” cu formularul de cod de acum și un `details` „Administrator tehnic” cu cheia.
   Câmpurile: `type="email"` cu `autocomplete="username"`, `type="password"` cu `autocomplete="current-password"`.
2. Ecran nou „Setează e-mailul și parola”, afișat când `/api/app/me` întoarce `needCred`: e-mail, parolă, confirmarea
   parolei (`autocomplete="new-password"`), text scurt: „De acum intri cu e-mailul și parola. Codul primit nu mai poate fi
   folosit.” La succes se reîncarcă pagina. Are și „Ieși din cont”.
   Dacă un răspuns oarecare vine cu 403 și `needCred`, pagina se reîncarcă (ajunge pe acest ecran).
3. „Profilul meu”, secțiunea „Contul”: e-mailul contului, „Schimbă e-mailul sau parola” (foaie: e-mail, parola actuală,
   parola nouă, confirmare; parola nouă poate rămâne goală dacă se schimbă doar e-mailul; în acest caz se trimite parola actuală ca `password`)
   și „Ieși din cont”.
4. Fișa membrului (președinte): pentru un membru cu cont activat, în locul generării de cod apare „Resetează accesul”
   (`btn sec`), cu foaie de confirmare: „Membrul nu va mai putea intra cu parola veche. Primește un cod nou și își pune din
   nou e-mailul și parola.” Codul primit se arată cu `showCode`. Pentru un membru cu cont neactivat rămâne „Generează cod”.
5. „Structură”: butoanele „Cod nou de intrare” și „Cod nou pentru președinte” devin „Resetează accesul”, cu aceeași foaie
   de confirmare și operația `resetAccess`.
6. Modul demonstrativ rămâne fără parole (persoanele se aleg din bara demonstrativă); ecranul de intrare cu e-mail și parolă
   există doar în modul cu server.
7. Teste: `t_demo.js` la zi (serverul simulat din jsdom primește `passlogin`, `setcred`, `resetAccess`); `e2e.py`: fiecare
   persoană intră cu cod, își pune e-mail și parolă, iese și intră din nou cu e-mail și parolă; un cod vechi nu mai merge după
   setarea parolei; resetarea accesului unui membru de către președinte, cu reluarea pașilor; capturi `e1b_intrare.png`,
   `e1b_seteaza_parola.png`, `e1b_contul.png`, `e1b_reseteaza.png` în directorul `SH`.
