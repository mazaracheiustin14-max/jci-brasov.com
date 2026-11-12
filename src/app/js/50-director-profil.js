/* Ecrane: profilul meu, directorul membrilor */
function vProfile() {
  if (S.server && S.me.isOwner)
    return '<div class="page-head"><h1>Contul meu</h1></div><p class="small" style="margin-bottom:16px">Ești conectat ca administrator tehnic.</p><button class="btn sec" data-act="logout">Ieși din cont</button>';
  var p = myProfile() || {};
  var priv =
    col("data/users/" + S.me.id).filter(function (x) {
      return x.id === "contact";
    })[0] || {};
  var pe = Object.assign({}, p);
  if (!pe.offer && priv.offerDraft) pe.offer = priv.offerDraft;
  if (S.server && !pe.name) pe.name = S.me.name || "";
  var b = badgeOf(S.me.id);
  return (
    '<div class="page-head"><h1>Profilul meu</h1>' +
    (badgeState(b) === "active" ? '<span class="seal">' + svg("seal", 14) + "Membru activ</span>" : "") +
    "</div>" +
    (badgeState(b) === "grace"
      ? '<div class="notice">Calitatea ta de membru a expirat la ' +
        dro(b.validUntil) +
        ". Dacă cotizația nu e achitată până la " +
        dro(addMonths(b.validUntil, 3)) +
        ", accesul tău în aplicație se suspendă automat.</div>"
      : b && b.validUntil
        ? '<p class="small" style="margin-bottom:12px">Calitatea de membru este valabilă până la ' + dro(b.validUntil) + ".</p>"
        : "") +
    (b && b.verified
      ? ""
      : '<div class="notice info">Calitatea ta de membru urmează să fie verificată de conducerea filialei. Până atunci nu apari în director.</div>') +
    '<form id="pform"><div class="sec-h"><h2>Datele mele</h2></div>' +
    profileForm(pe, priv) +
    '<div class="sec-h"><h2>Ce date public</h2></div>' +
    consentBlock(p.consent) +
    '<div class="sheet-acts"><button class="btn" type="submit">Salvează alegerile</button></div></form>' +
    myFunctionBlock() +
    '<div class="sec-h"><h2>Drepturile tale</h2></div><p class="small">Poți descărca datele tale sau poți șterge profilul. Evidențele financiare se păstrează restrâns pe perioada legală. Pentru cereri speciale (obiecție, restricționare) scrie conducerii filialei.</p>' +
    '<div class="acts"><button class="btn sec" data-act="export">Descarcă datele mele</button><button class="btn crit" data-act="delprofile">Șterge profilul</button></div>' +
    (S.server
      ? uiSection("Contul") +
        uiKV([["E-mail", S.me.email || "nesetat"]]) +
        '<div class="acts" style="margin-top:12px"><button class="btn sec" data-act="changecred">Schimbă e-mailul sau parola</button><button class="btn sec" data-act="logout">Ieși din cont</button></div>'
      : '<div class="sec-h"><h2>Codul contului</h2></div><p class="small">Dacă conducerea îți cere codul contului, copiază-l de aici.</p><p class="num" style="overflow-wrap:anywhere;font-family:monospace;margin:8px 0">' +
        esc(S.me.id) +
        '</p><button class="btn sec sm" data-act="copyid">Copiază codul</button>')
  );
}

/* ---- director ---- */
function dirRows() {
  var q = norm(S.q);
  return (S.D.profiles || [])
    .filter(function (p) {
      var b = badgeOf(p.id);
      var bs = badgeState(b);
      if (bs !== "active" && bs !== "grace") return false;
      if (!(p.consent && p.consent.directory)) return false;
      if (S.fb !== "Toate" && (b.branch || p.branch) !== S.fb) return false;
      if (S.fd !== "Toate" && p.domain !== S.fd) return false;
      if (q && norm([p.name, p.firm, p.domain, p.offer].join(" ")).indexOf(q) < 0) return false;
      return true;
    })
    .sort(function (a, b) {
      return norm(a.name) < norm(b.name) ? -1 : 1;
    });
}
function dirListHtml() {
  var rows = dirRows();
  if (S.err.profiles)
    return emptyBox("Nu am putut încărca datele", "Verifică conexiunea la internet și încearcă din nou.", "Reîncearcă", "retry");
  if (!rows.length)
    return emptyBox(
      "Niciun membru găsit",
      "Încearcă alt nume sau elimină un filtru. Căutarea ignoră diacriticele.",
      "Resetează filtrele",
      "resetf",
    );
  return (
    '<div class="list">' +
    rows
      .map(function (p) {
        var b = badgeOf(p.id);
        return row({
          act: "profile",
          id: p.id,
          avatar: p.name,
          title: p.name,
          meta: esc([p.firm, p.domain, (b && b.branch) || p.branch].filter(Boolean).join(" | ")),
          right: badgeState(b) === "active" ? '<span class="seal">' + svg("seal", 14) + "Membru activ</span>" : "",
        });
      })
      .join("") +
    "</div>"
  );
}
function vDirector() {
  return (
    '<div class="page-head"><h1>Director membri</h1></div><div class="field"><label for="q">Căutare</label><input type="search" id="q" value="' +
    esc(S.q) +
    '" placeholder="Caută după nume, firmă sau domeniu" autocomplete="off"></div>' +
    '<div class="chips" role="group" aria-label="Filiala">' +
    ["Toate"]
      .concat(BRANCHES)
      .map(function (b) {
        return '<button class="chip" data-act="fb" data-id="' + esc(b) + '" aria-pressed="' + (S.fb === b) + '">' + esc(b) + "</button>";
      })
      .join("") +
    "</div>" +
    '<div class="chips" role="group" aria-label="Domeniul">' +
    ["Toate"]
      .concat(DOMAINS)
      .map(function (b) {
        return '<button class="chip" data-act="fd" data-id="' + esc(b) + '" aria-pressed="' + (S.fd === b) + '">' + esc(b) + "</button>";
      })
      .join("") +
    "</div>" +
    '<div id="dirlist">' +
    dirListHtml() +
    "</div>"
  );
}
function openProfile(id) {
  var p = (S.D.profiles || []).filter(function (x) {
    return x.id === id;
  })[0];
  if (!p) return;
  var b = badgeOf(id);
  var c = p.consent || {};
  var h =
    '<div class="profile-head"><span class="avatar">' +
    esc(initials(p.name)) +
    "</span><div><h1>" +
    esc(p.name) +
    '</h1><p class="small">' +
    esc([p.firm, (b && b.branch) || p.branch].filter(Boolean).join(" | ")) +
    "</p></div></div>";
  if (badgeState(b) === "active") h += '<span class="seal">' + svg("seal", 14) + "Membru activ</span>";
  h += '<p style="margin-top:12px"><b>Domeniu:</b> ' + esc(p.domain || "") + "</p>";
  if (p.offer && c.offer) h += '<div class="offer"><span class="lab">Ofertă pentru membri</span><br>' + esc(p.offer) + "</div>";
  var acts = "";
  if (c.phone && p.phone) {
    var tel = String(p.phone).replace(/[^\d+]/g, "");
    acts +=
      '<a class="btn" href="tel:' +
      esc(tel) +
      '">Sună</a><button class="btn sec" data-act="copy" data-id="' +
      esc(p.phone) +
      '">Copiază telefonul</button>';
  }
  if (c.email && p.email) {
    acts += '<a class="btn sec" href="mailto:' + esc(p.email) + '">Trimite e-mail</a>';
  }
  if (c.phone && p.phone) h += '<p class="small" style="margin-top:8px">Telefon: ' + esc(p.phone) + "</p>";
  if (c.email && p.email) h += '<p class="small">E-mail: ' + esc(p.email) + "</p>";
  if (!acts) h += '<p class="small" style="margin-top:12px">Membrul nu a ales să afișeze date de contact.</p>';
  h += '<div class="acts">' + acts + '</div><div class="sheet-acts"><button class="btn sec" data-act="closesheet">Închide</button></div>';
  openSheet(h);
}

/* ---- tablou ---- */
