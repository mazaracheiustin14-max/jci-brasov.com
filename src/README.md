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
