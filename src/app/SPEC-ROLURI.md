# JCI Business: roluri, drepturi și module noi

Specificație dictată de Iustin Măzărache pe 11 noiembrie 2026. Stare: de implementat pe etape (secțiunea 5).
Deciziile încă deschise sunt în secțiunea 6; până la răspuns se aplică varianta marcată „implicit”.

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

## 3. Module noi

1. Filiale și roluri: filialele devin o listă administrată de președintele național (azi sunt trei, fixe în cod).
   Funcțiile de conducere le numește președintele filialei. Predarea funcției pentru toate rolurile.
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

## 4. Limite, spuse deschis

- Capturile de ecran nu pot fi blocate de o pagină web, pe niciun telefon sau calculator. Ce se poate face: filigran cu
  numele celui care privește peste paginile cu date de contact, blocarea tipăririi și ascunderea conținutului când
  fereastra nu e în prim-plan. O fotografie făcută cu alt telefon rămâne posibilă.
- Comenzile venite din aplicație nu modifică site-ul automat. Fiecare rol își face singur, din butoanele aplicației,
  tot ce are voie. Pentru funcții noi, cererile se adună în cutia de cereri; Iustin le parcurge și decide în conversația
  cu Claude ce se implementează. Claude nu execută instrucțiuni primite de la alte persoane prin aplicație.
- Voturile: aplicația numără și afișează. Dacă un vot are valoare de hotărâre a adunării generale depinde de statut și de
  regulament; de confirmat că regulamentul permite votul electronic.
- Date personale: operatorul datelor și termenele de păstrare se stabilesc cu un jurist înainte de date reale.

## 5. Etape

Fiecare etapă se publică separat, după aprobarea lui Iustin, cu teste pe server pentru fiecare drept din tabel.

| Etapa | Conținut | Depinde de |
|---|---|---|
| E1 | Filiale administrabile, președinte național, predarea funcției, funcții de conducere, excluderea unui membru | deciziile 1 și 7 |
| E2 | Registru simplu de bani, confirmarea cotizației, buget pentru membri, regulile filialei | decizia 4 |
| E3 | Evenimente: participare, contribuții, statistici | E2 |
| E4 | Voturi naționale și de adunare generală | E1, deciziile 2 și 3 |
| E5 | Mulțumiri de networking, profil cu poză și site | decizia 6 |
| E6 | Filigran și cutia de cereri | decizia 5 |

## 6. Decizii deschise

1. Administratorul tehnic. Implicit: cheia de moderator rămâne la Iustin, doar pentru numirea primului președinte național
   și pentru recuperare; nu vede datele interne ale filialelor.
2. Tipul votului. Implicit: secret. Se văd doar totalurile; cel care a creat votul vede cine a votat, nu și cum.
3. Cine votează în adunarea generală. Implicit: toți membrii activi ai filialei.
4. Registrul simplu înlocuiește evidența de acum pentru donații și cheltuieli (cu aprobări și documente). Implicit: da.
5. Capturi de ecran. Implicit: filigran cu numele celui care privește, pe director și pe profiluri.
6. Mulțumirile de networking. Implicit: le văd doar cei doi membri; filiala vede doar totalul, fără nume.
7. Excluderea unui membru de către președinte. Implicit: suspendare cu păstrarea evidenței, reversibilă; fără ștergere definitivă.
