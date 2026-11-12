/* Catalogul vizual al componentelor, la /app?ui. Date fictive, fără server, nimic nu se salvează.
   Rol: referința grafică a aplicației. Un ecran nou se compune din piesele de aici, fără stiluri noi. */
function renderCatalog() {
  var d = function (n) {
    return addDays(today(), n);
  };
  var sec = function (title, note, html) {
    return uiSection(title) + (note ? '<p class="small" style="margin-bottom:12px">' + esc(note) + "</p>" : "") + html;
  };
  var head =
    '<header class="top">' +
    logoHtml() +
    '<span class="small" style="color:var(--hero-ink)">Catalog</span><button class="ibtn" data-act="theme" aria-label="Schimbă tema">' +
    svg("sun", 22) +
    '</button><span class="ibtn">' +
    uiAvatar("Andrei Popescu") +
    "</span></header>";
  var nav =
    '<nav class="tabs" aria-label="Navigare (exemplu pentru membri)">' +
    [
      ["Director", "dir", 0],
      ["Evenimente", "cal", 1],
      ["Voturi", "vote", 0],
      ["Rețea", "net", 0],
      ["Profil", "me", 0],
    ]
      .map(function (t) {
        return "<button" + (t[2] ? ' aria-current="page"' : "") + ">" + svg(t[1], 24) + "<span>" + t[0] + "</span></button>";
      })
      .join("") +
    "</nav>";
  var h =
    '<div class="page-head"><h1>Catalog de componente</h1></div>' +
    '<div class="notice info">Date fictive. Pagina arată piesele din care se construiesc ecranele aplicației; nimic nu se salvează.</div>';

  h += sec(
    "Roluri și insigne",
    "",
    '<div class="acts" style="margin:0 0 24px">' +
      uiTag("Președinte național", "brand") +
      uiTag("Președinte", "brand") +
      uiTag("Vicepreședinte", "brand") +
      uiTag("Trezorier", "brand") +
      uiTag("Membru", "neutral") +
      '<span class="seal">' +
      svg("seal", 14) +
      "Membru activ</span>" +
      uiTag("Cotizație achitată", "good", "check") +
      uiTag("Expiră în 20 de zile", "warn", "clock") +
      uiTag("Suspendat", "crit", "x") +
      "</div>",
  );

  h += sec(
    "Buget și statistici",
    "Membrii văd totalurile; conducerea vede și fiecare rând.",
    uiHero("Sold 2026, Brașov", 1845000, "Încasat 42.700,00 RON, cheltuit 24.250,00 RON") +
      uiStats([
        { l: "Încasat", n: "42.700,00", unit: "RON", s: "cotizații, sponsorizări, bilete" },
        { l: "Cheltuit", n: "24.250,00", unit: "RON", s: "9 evenimente" },
        { l: "Evenimente", n: "9", s: "312 participări" },
        { l: "Membri activi", n: "38", s: "din 44 în evidență" },
      ]),
  );

  h += sec(
    "Evenimente",
    "Membrul își confirmă participarea și își notează contribuția.",
    '<div class="list">' +
      uiEvent({ id: "e1", title: "Beyond the Initiative", date: d(15), place: "CATTIA Brașov", count: 96, going: false, act: "evopen" }) +
      uiEvent({ id: "e2", title: "Seară de networking", date: d(4), place: "Sediul filialei", count: 21, going: true }) +
      uiEvent({
        id: "e3",
        title: "Atelier de vorbit în public",
        date: d(-20),
        place: "Brașov",
        count: 34,
        going: true,
        past: true,
        income: 420000,
        spent: 265000,
        mine: "am adus sponsorul pentru sală",
      }) +
      "</div>",
  );

  h += sec(
    "Voturi",
    "Un vot deschis, unul la care ai votat deja și unul închis, cu rezultat.",
    '<div class="list">' +
      uiPoll({
        id: "p1",
        title: "Aprobăm bugetul pentru evenimentul din primăvară?",
        scope: "Adunarea generală, Brașov",
        closes: d(6),
        state: "open",
        canVote: true,
        options: [
          { id: "da", label: "Da" },
          { id: "nu", label: "Nu" },
          { id: "ab", label: "Mă abțin" },
        ],
      }) +
      uiPoll({
        id: "p2",
        title: "Data adunării generale de iarnă",
        scope: "Adunarea generală, Brașov",
        closes: d(2),
        state: "open",
        voted: "a",
        options: [
          { id: "a", label: "12 decembrie" },
          { id: "b", label: "19 decembrie" },
        ],
      }) +
      uiPoll({
        id: "p3",
        title: "Orașul conferinței naționale de anul viitor",
        scope: "Președinții de filiale",
        closes: d(-9),
        state: "closed",
        showResults: true,
        voted: "bv",
        voters: 12,
        options: [
          { id: "bv", label: "Brașov", votes: 6 },
          { id: "cj", label: "Cluj", votes: 3 },
          { id: "b", label: "București", votes: 2 },
        ],
      }) +
      "</div>",
  );

  h += sec(
    "Încasări și cheltuieli",
    "Doar denumire și sumă, fără documente încărcate.",
    '<div class="list">' +
      uiMoney({
        id: "m1",
        title: "Sponsorizare eveniment de lansare",
        date: d(-3),
        amount: 500000,
        kind: "in",
        meta: "Beyond the Initiative",
      }) +
      uiMoney({ id: "m2", title: "Închiriere sală", date: d(-5), amount: 120000, kind: "out", meta: "Beyond the Initiative" }) +
      uiMoney({ id: "m3", title: "Materiale tipărite", date: d(-8), amount: 32000, kind: "out", cancelled: true }) +
      '</div><div class="acts" style="margin:-8px 0 24px"><button class="btn sm">Adaugă încasare</button><button class="btn sec sm">Adaugă cheltuială</button></div>',
  );

  h += sec(
    "Mulțumiri de networking",
    "Suma generată printr-o colaborare cu un alt membru și un mesaj scurt. Fără documente.",
    uiHero("Am generat prin JCI", 1250000, "3 colaborări în 2026") +
      '<div class="list">' +
      uiThanks({
        who: "Maria Stoica",
        branch: "Cluj",
        date: d(-2),
        amount: 800000,
        dir: "sent",
        msg: "Mulțumesc pentru recomandare: am semnat contractul de mentenanță.",
      }) +
      uiThanks({
        who: "Radu Ionescu",
        branch: "București",
        date: d(-12),
        amount: 150000,
        dir: "received",
        msg: "Campania făcută împreună a adus primii clienți. Mulțumesc.",
      }) +
      "</div>",
  );

  h += sec(
    "Profil",
    "Poză, firmă, site și date de contact, fiecare cu acordul membrului.",
    uiPhotoPicker("Andrei Popescu", "") +
      '<div class="profile-head">' +
      uiAvatar("Andrei Popescu", "", "lg") +
      '<div><h2>Andrei Popescu</h2><p class="small">Popescu și Asociații<span class="sep"></span>Juridic<span class="sep"></span>Brașov</p></div></div>' +
      '<div class="acts" style="margin:0 0 24px"><button class="btn sm">Sună</button><button class="btn sec sm">Scrie un e-mail</button><button class="btn sec sm">Deschide site-ul</button></div>',
  );

  h += sec(
    "Regulile filialei",
    "Președintele alege ce văd membrii filialei.",
    '<div class="list">' +
      uiSwitch("r1", "Bugetul total, vizibil membrilor", "Cât s-a încasat și cât s-a cheltuit, pe an.", true) +
      uiSwitch("r2", "Sumele pe fiecare eveniment", "Încasat și cheltuit, la fiecare eveniment.", true) +
      uiSwitch("r3", "Lista detaliată de încasări și cheltuieli", "Fără această opțiune, lista o vede doar conducerea.", false) +
      uiSwitch("r4", "Rezultatul votului înainte de închidere", "", false, true) +
      "</div>",
  );

  h += sec(
    "Butoane și câmpuri",
    "",
    '<div class="acts" style="margin:0 0 16px"><button class="btn">Salvează</button><button class="btn sec">Anulează</button><button class="btn crit">Exclude membrul</button><button class="btn" disabled>Inactiv</button></div>' +
      uiChips(
        [
          ["a", "Toate"],
          ["b", "Brașov"],
          ["c", "Cluj"],
          ["d", "București"],
        ],
        "a",
        "none",
      ) +
      '<form style="max-width:420px">' +
      inp("x1", "Denumire", "Sponsorizare", "text", "cx1") +
      inp("x2", "Sumă (RON)", "500,00", "text", "cx2", 'inputmode="decimal"') +
      sel("x3", ["Încasare", "Cheltuială"], "Încasare", "Tip", "cx3") +
      '<label class="check"><input type="checkbox" checked><span>Doresc să afișez în director numărul meu de telefon.</span></label><div class="err">Completează câmpul Denumire.</div></form>',
  );

  h += sec(
    "Stări",
    "",
    '<div class="notice">Calitatea ta de membru a expirat. Accesul se suspendă automat după 3 luni fără plată.</div>' +
      '<div class="notice info">Votul se închide la data stabilită de președinte.</div>' +
      '<div class="list">' +
      row({ avatar: "Bianca Rusu", title: "Bianca Rusu", meta: "Cont activ", right: uiTag("Restanță", "warn", "clock"), stripe: "warn" }) +
      row({ avatar: "Vlad Munteanu", title: "Vlad Munteanu", meta: "Cont neactivat", right: uiTag("Fără cod", "neutral") }) +
      "</div>" +
      emptyBox("Niciun eveniment încă", "Evenimentele filialei apar aici după ce le adaugă conducerea.", "", ""),
  );

  h += sec(
    "Filigran",
    "Numele celui care privește, peste paginile cu date de contact. Descurajează capturile de ecran; o pagină web nu le poate opri.",
    '<div class="wm-box"><div class="list" style="margin:0">' +
      row({ avatar: "Maria Stoica", title: "Maria Stoica", meta: "0722 000 111 | maria@exemplu.ro" }) +
      row({ avatar: "Radu Ionescu", title: "Radu Ionescu", meta: "0733 000 222 | radu@exemplu.ro" }) +
      "</div>" +
      uiWatermark("Andrei Popescu, " + dro(today())) +
      "</div>",
  );

  document.getElementById("app").innerHTML = head + nav + '<main id="main" tabindex="-1">' + h + "</main>";
}
document.addEventListener("submit", function (ev) {
  if (S.mode === "ui") ev.preventDefault();
});
