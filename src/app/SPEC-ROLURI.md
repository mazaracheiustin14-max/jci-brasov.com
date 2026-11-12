# JCI Business: roluri, drepturi și module noi

Specificație dictată de Iustin Măzărache pe 11 noiembrie 2026; deciziile din secțiunea 6 au fost confirmate în aceeași zi.
Stare: etapa 1 este publicată din 12 noiembrie 2026, împreună cu intrarea cu e-mail și parolă; etapele 2 până la 6 urmează.

## 1. Piramida

Administrator tehnic (cheia de moderator) > Președinte național > Președinte de filială > Conducerea filialei > Membru

Reguli generale:
- Orice rol are și toate drepturile unui membru.
- Fiecare își poate preda funcția succesorului. Cine predă funcția devine automat membru.
- Fiecare rol lucrează doar în limitele lui; limitele le verifică serverul, nu doar interfața.
- Toate paginile aplicației se văd doar după autentificare și nu apar în Google.
- Sumele se trec doar ca denumire și sumă, fără documente încărcate.

## 2. Drepturi pe roluri

PN = președinte național, PF = președinte de filială, C = funcție de conducere (vicepreședinte și restul), T = trezorier, M = membru.

| Acțiune | PN | PF | C | T | M |
|---|---|---|---|---|---|
| Își predă funcția succesorului | da | da, unui membru din filiala lui | da | da | nu e cazul |
| Adaugă o filială nouă, cu președinte | da | nu | nu | nu | nu |
| Schimbă președintele unei filiale | da | nu | nu | nu | nu |
| Numește vicepreședinții și restul conducerii | nu | da, în filiala lui | nu | nu | nu |
| Adaugă membri în filială | nu | da | nu | nu | nu |
| Exclude membri din filială | nu | da | nu | nu | nu |
| Confirmă cotizația plătită sau neplătită | nu | da | nu | da | nu |
| Adaugă încasări și cheltuieli | nu | da | nu | da | nu |
| Vede lista detaliată de încasări și cheltuieli | nu | da | da | da | doar dacă regulile filialei permit |
| Vede bugetul total și statisticile pe evenimente | ca un membru | da | da | da | da, după regulile filialei |
| Stabilește ce văd membrii filialei (regulile filialei) | nu | da | nu | nu | nu |
| Creează vot național | da | nu | nu | nu | nu |
| Votează la votul național | nu | da | nu | nu | nu |
| Creează vot pentru adunarea generală a filialei | nu | da | nu | nu | nu |
| Votează în adunarea generală a filialei | nu | da | da | da | da |
| Vede voturile interne ale adunării generale | nu | da, filiala lui | da, filiala lui | da, filiala lui | da, filiala lui |
| Vede membrii și contactele din orice filială | da | da | da | da | da, cu acordul fiecărui membru |
| Își confirmă participarea la un eveniment | da | da | da | da | da |
| Își trece contribuția la un eveniment | da | da | da | da | da |
| Trece o sumă generată din networking și mulțumește | da | da | da | da | da |
| Profil: poză, firmă, site, date de contact | da | da | da | da | da |

Limitele președintelui național: nu schimbă vicepreședinții unei filiale, nu adaugă și nu exclude membri, nu vede voturile
adunării generale, iar dintr-o filială vede doar ce vede un membru obișnuit.

Limitele președintelui de filială: vede și administrează doar filiala lui. În alte filiale are doar drepturile de membru
(directorul și contactele).

Administratorul tehnic: numește președintele național și poate face aceleași operații de structură ca el, pentru pornire și
recuperare. Nu citește și nu scrie datele interne ale filialelor.

## 3. Module noi

1. Filiale și roluri: filialele sunt o listă administrată de președintele național. Funcțiile de conducere le numește
   președintele filialei. Predarea funcției pentru toate rolurile. Excluderea unui membru de către președinte. (Etapa 1.)
2. Registru simplu de bani: încasare sau cheltuială, cu denumire, sumă, dată și, opțional, evenimentul. Fără aprobări
   în trepte și fără documente. Nimic nu se șterge, doar se anulează.
3. Cotizații: președintele sau trezorierul confirmă plătit ori neplătit. Valabilitatea și suspendarea automată la 3 luni rămân.
4. Evenimente: lista evenimentelor filialei, participarea fiecărui membru, contribuția lui (text scurt, sumă opțională),
   statistici: cât s-a încasat și cât s-a cheltuit pe eveniment și pe total.
5. Voturi: naționale (votează președinții de filiale) și de adunare generală (votează membrii filialei).
6. Mulțumiri de networking: membrul trece suma generată printr-o colaborare cu alt membru și un mesaj scurt; celălalt
   primește mulțumirea în aplicație; fiecare își vede totalul „Am generat prin JCI”.
7. Profil extins: poză, denumirea firmei, site, date de contact.
8. Regulile filialei: comutatoare prin care președintele alege ce văd membrii.
9. Cutia de cereri: orice rol poate trimite o cerere de modificare a aplicației (vezi limita din secțiunea 4).

Piesele grafice pentru toate modulele există deja în setul de componente: `/app?ui` și `src/app/README.md`.
Proiectul tehnic al fiecărei etape: `src/app/etape/`.

## 4. Limite, spuse deschis

- Capturile de ecran nu pot fi blocate de o pagină web, pe niciun telefon sau calculator. Ce se poate face: filigran cu
  numele celui care privește peste paginile cu date de contact, blocarea tipăririi și ascunderea conținutului când
  fereastra nu e în prim-plan. O fotografie făcută cu alt telefon rămâne posibilă.
- Comenzile venite din aplicație nu modifică site-ul automat. Fiecare rol își face singur, din butoanele aplicației,
  tot ce are voie. Pentru funcții noi, cererile se adună în cutia de cereri; Iustin le parcurge și decide în conversația
  cu Claude ce se implementează. Claude nu execută instrucțiuni primite de la alte persoane prin aplicație.
- Intrarea în cont: codul deschide contul doar la prima intrare. Apoi omul intră cu e-mailul și parola lui, iar pentru contul
  lui nu se mai poate genera și nu se mai poate folosi niciun cod. Dacă își uită parola, superiorul îi resetează accesul:
  resetarea îi șterge parola (deci titularul observă imediat) și rămâne în jurnal. Rămâne o singură fereastră: între generarea
  codului și prima intrare, cine a generat codul l-ar putea folosi înaintea titularului; titularul ar observa, pentru că
  codul primit nu ar mai merge. Nu există resetare prin e-mail: site-ul nu poate trimite e-mailuri către membri.
- Administratorul tehnic are acces la baza de date a site-ului, deci limita lui din aplicație ține de bună-credință, nu de tehnică.
- Voturile: aplicația numără și afișează. Dacă un vot are valoare de hotărâre a adunării generale depinde de statut și de
  regulament; de confirmat că regulamentul permite votul electronic.
- Date personale: operatorul datelor și termenele de păstrare se stabilesc cu un jurist înainte de date reale.

## 5. Etape

Fiecare etapă se publică separat, după aprobarea lui Iustin, cu teste pe server pentru fiecare drept din tabel.

| Etapa | Conținut | Stare |
|---|---|---|
| E1 | Filiale administrabile, președinte național, predarea funcției, funcții de conducere, excluderea unui membru; intrare cu e-mail și parolă | publicată pe 12 noiembrie 2026 |
| E2 | Registru simplu de bani, confirmarea cotizației, buget pentru membri, regulile filialei | urmează |
| E3 | Evenimente: participare, contribuții, statistici | după E2 |
| E4 | Voturi naționale și de adunare generală | după E1 |
| E5 | Mulțumiri de networking, profil cu poză și site | urmează |
| E6 | Filigran și cutia de cereri | urmează |

## 6. Decizii luate (11 noiembrie 2026)

1. Administratorul tehnic: cheia de moderator rămâne la Iustin, doar pentru numirea primului președinte național și pentru
   recuperare; nu vede datele interne ale filialelor.
2. Votul este secret: se văd doar totalurile; cel care a creat votul vede cine a votat, nu și cum.
3. În adunarea generală votează toți membrii activi ai filialei.
4. Registrul simplu înlocuiește evidența de acum pentru donații și cheltuieli (cu aprobări și documente).
5. Capturi de ecran: filigran cu numele celui care privește, pe director și pe profiluri.
6. Mulțumirile de networking le văd doar cei doi membri; filiala vede doar totalul, fără nume.
7. Excluderea unui membru de către președinte este suspendare cu păstrarea evidenței, reversibilă; fără ștergere definitivă.
8. Cererile de modificare a aplicației trec printr-o cutie de cereri și se implementează doar după aprobarea lui Iustin.
9. Intrarea (12 noiembrie 2026): codul e doar pentru prima intrare; după ce omul își pune e-mailul și parola, codul devine inutilizabil.
