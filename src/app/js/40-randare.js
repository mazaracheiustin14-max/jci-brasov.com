/* Randarea paginii: antet, navigare, alegerea ecranului */
function tabsFor() {
  if (!isLead())
    return [
      ["director", "Director", "dir"],
      ["profil", "Profilul meu", "me"],
    ];
  return [
    ["director", "Director", "dir"],
    ["tablou", "Tablou", "dash"],
    ["cotizatii", "Cotizații", "fee"],
    ["donatii", "Donații", "gift"],
    ["cheltuieli", "Cheltuieli", "spend"],
  ];
}
function render() {
  var app = document.getElementById("app");
  if (S.mode === "login" || S.mode === "excluded" || S.mode === "ui") return;
  var ae = document.activeElement;
  if (ae && ae.closest && ae.closest("#main") && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) {
    S._stale = true;
    return;
  }
  if (document.getElementById("gateform") && S.D.profiles !== undefined && !myProfile() && !isLead()) {
    S._stale = true;
    return;
  }
  if (document.getElementById("loginform") && S.me && !isLead() && badgeState(badgeOf(S.me.id)) === "none" && !localClaim()) {
    S._stale = true;
    return;
  }
  S._stale = false;
  var waiting =
    S.mode === "ready" &&
    !S.err.profiles &&
    !S.err.roles &&
    (S.D.profiles === undefined ||
      S.D.roles === undefined ||
      S.D.badges === undefined ||
      (S.me && S.D["data/users/" + S.me.id] === undefined && !S.err["data/users/" + S.me.id]));
  if (S.mode === "loading" || waiting) {
    app.innerHTML =
      '<div class="gate"><div class="gate-top">' +
      logoHtml() +
      '</div><div class="gate-in"><h2>Se încarcă</h2><div class="skel" style="margin-top:16px"></div><div class="skel"></div><div class="skel"></div></div></div>';
    return;
  }
  if (S.mode === "error") {
    app.innerHTML =
      '<div class="gate"><div class="gate-top">' +
      logoHtml() +
      '</div><div class="gate-in" style="margin-top:120px"><h1>Nu am putut încărca datele</h1><p style="margin:12px 0">' +
      (S.server
        ? "Serverul nu a răspuns. Verifică conexiunea la internet, apoi încearcă din nou."
        : "Baza de date nu a răspuns. Verifică conexiunea la internet și că ești autentificat în claude.ai, apoi încearcă din nou.") +
      '</p><div class="sheet-acts"><button class="btn" data-act="restart">Reîncearcă</button>' +
      (S.server ? "" : '<button class="btn sec" data-act="demo">Mod demonstrativ</button>') +
      "</div></div></div>";
    return;
  }
  var r = myRole();
  var prof = myProfile();
  if (!isLead()) {
    var bd0 = badgeOf(S.me.id),
      bst = badgeState(bd0);
    if (bst === "excluded") {
      app.innerHTML = renderExcluded(bd0);
      return;
    }
    if (bst === "none" && S.server) {
      app.innerHTML =
        '<div class="gate"><div class="gate-top">' +
        logoHtml() +
        '</div><div class="gate-in" style="margin-top:120px"><h1>Contul nu este activ</h1><p style="margin:12px 0">Nu am găsit un cont activ pentru această sesiune. Ieși din cont și intră din nou cu un cod primit de la președintele filialei.</p><div class="sheet-acts"><button class="btn" data-act="logout">Ieși din cont</button></div></div></div>';
      return;
    }
    if (bst === "none") {
      var cl = localClaim();
      app.innerHTML = cl ? renderWaiting(cl) : renderLogin();
      if (!cl) bindLogin();
      return;
    }
    if (!prof) {
      app.innerHTML = renderGate();
      bindGate();
      return;
    }
  }
  var tabs = tabsFor();
  if (
    S.tab !== "profil" &&
    !tabs.some(function (t) {
      return t[0] === S.tab;
    })
  )
    S.tab = tabs[0][0];
  var head = '<header class="top">' + logoHtml() + "";
  if (r.role === "national")
    head +=
      '<select class="branch" id="brsel" aria-label="Filiala">' +
      BRANCHES.map(function (b) {
        return "<option" + (b === curBranch() ? " selected" : "") + ">" + esc(b) + "</option>";
      }).join("") +
      "</select>";
  else if (isLead()) head += '<span class="small" style="color:var(--hero-ink)">' + esc(r.branch) + "</span>";
  head +=
    '<button class="ibtn" data-act="theme" aria-label="Schimbă tema">' +
    svg("sun", 22) +
    "</button>" +
    (S.server ? '<button class="ibtn" data-act="logout" aria-label="Ieși din cont">' + svg("out", 22) + "</button>" : "") +
    '<button class="ibtn" data-act="goprofil" aria-label="Profilul meu"><span class="avatar">' +
    esc(initials(prof ? prof.name : ROLE_LABEL[r.role])) +
    "</span></button></header>";
  var demo = demoBarHtml();
  var nav =
    '<nav class="tabs" aria-label="Navigare">' +
    tabs
      .map(function (t) {
        return (
          '<button data-act="tab" data-id="' +
          t[0] +
          '"' +
          (S.tab === t[0] ? ' aria-current="page"' : "") +
          ">" +
          svg(t[2], 24) +
          "<span>" +
          esc(t[1]) +
          "</span></button>"
        );
      })
      .join("") +
    "</nav>";
  var body;
  if (S.tab === "director") body = vDirector();
  else if (S.tab === "profil") body = vProfile();
  else if (S.tab === "tablou") body = vDash();
  else if (S.tab === "cotizatii") body = vFees();
  else if (S.tab === "donatii") body = vDon();
  else body = vExp();
  var note =
    (S.note ? '<div class="notice">' + esc(S.note) + "</div>" : "") +
    (S.err.roles ? '<div class="notice">Nu am putut citi rolurile. Reîncarcă pagina; până atunci apari ca membru.</div>' : "");
  var prompt =
    isLead() && !prof && !(S.server && S.me.isOwner)
      ? '<div class="notice info">Profilul tău nu e completat. Deschide „Profilul meu” din avatarul din antet.</div>'
      : "";
  var scroll = window.scrollY;
  app.innerHTML = head + demo + '<main id="main">' + note + prompt + body + "</main>" + nav;
  window.scrollTo(0, scroll);
  bindMain();
  autoProcess();
}

/* ---- gate / profil ---- */
