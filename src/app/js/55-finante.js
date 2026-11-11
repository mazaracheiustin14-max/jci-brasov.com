/* Ecrane: tablou, cotizații, donații, cheltuieli */
function vDash() {
  var b = curBranch();
  var r = report(b);
  var role = myRole();
  var h = '<div class="page-head"><h1>Tablou, ' + esc(b) + "</h1></div>";
  if (S.err["branches/" + b + "/fees"])
    return (
      h +
      emptyBox(
        "Nu ai acces la această secțiune",
        "Evidențele financiare sunt vizibile doar conducerii filialei.",
        "Înapoi la Director",
        "godir",
      )
    );
  h +=
    '<div class="hero"><div class="l">Sold</div><div class="n">' +
    (r.sold < 0 ? "−" : "") +
    fmt(Math.abs(r.sold)) +
    ' <small>RON</small></div><div class="s">' +
    (r.sold < 0 ? "Deficit. " : "") +
    "Disponibil după angajamente: " +
    fmt(r.disponibil) +
    " RON</div></div>";
  h +=
    '<div class="sums"><div><div class="l">Încasat cotizații</div><div class="n">' +
    fmt(r.incasat) +
    ' <small>RON</small></div><div class="small">' +
    r.nrPlatite +
    " din " +
    r.nrFees +
    " cotizații</div></div>" +
    '<div><div class="l">Restanțieri</div><div class="n">' +
    r.restanti.length +
    '</div><div class="small">' +
    fmt(r.restSum) +
    " RON</div></div>" +
    '<div><div class="l">Donații</div><div class="n">' +
    fmt(r.donatii) +
    ' <small>RON</small></div><div class="small">anonime: ' +
    fmt(r.donA) +
    "</div></div>" +
    '<div><div class="l">Cheltuieli plătite</div><div class="n">' +
    fmt(r.cheltPlatit) +
    ' <small>RON</small></div><div class="small">angajate: ' +
    fmt(r.angajat) +
    "</div></div></div>";
  if (r.avansTotal > 0)
    h +=
      '<div class="notice">Cotizații plătite în avans de președinte: ' +
      fmt(r.avansTotal) +
      " RON, din care recuperate de la membri " +
      fmt(r.avansRec) +
      " RON. Creanță nerecuperată: " +
      fmt(r.creanta) +
      " RON (" +
      r.nrCreanta +
      " cotizații). Aceste sume nu intră în sold până la decontarea cu președintele.</div>";
  if (r.restanti.length) {
    var tt = today();
    h +=
      '<div class="sec-h"><h2>Restanțieri</h2></div><div class="list">' +
      r.restanti
        .slice()
        .sort(function (a, c) {
          return a.deadline < c.deadline ? -1 : 1;
        })
        .map(function (f) {
          var zile = Math.max(0, Math.floor((new Date(tt) - new Date(f.deadline)) / 864e5));
          return row({
            stripe: "crit",
            avatar: memberName(b, f.memberId),
            title: memberName(b, f.memberId),
            meta: esc(zile + " zile de întârziere | termen " + dro(f.deadline)),
            right: '<span class="num"><b>' + fmt(f.due - (f.paid || 0)) + " RON</b></span>",
          });
        })
        .join("") +
      "</div>";
  }
  var cats = Object.keys(r.pe).sort(function (a, c) {
    return r.pe[c] - r.pe[a];
  });
  h += '<div class="sec-h"><h2>Cheltuieli pe categorie</h2></div>';
  h += cats.length
    ? '<div class="list">' +
      cats
        .map(function (c) {
          return row({ title: c, meta: "plătite", right: '<span class="num">' + fmt(r.pe[c]) + " RON</span>" });
        })
        .join("") +
      "</div>"
    : emptyBox("Nicio cheltuială plătită", "Nu există cheltuieli plătite în această filială.", "", "");
  if (role.role === "president") {
    h +=
      '<div class="sec-h"><h2>Setări filială</h2></div><p class="small" style="margin-bottom:8px">Sold inițial: ' +
      fmt(getSettings(b).opening) +
      " RON. Cotizația anuală: " +
      fmt(getSettings(b).feeDue) +
      ' RON.</p><button class="btn sec sm" data-act="settings">Modifică setările</button>';
  }
  h += '<div class="sec-h"><h2>Valabilitatea calității de membru</h2></div>';
  var vrows = [];
  scopeBranches().forEach(function (bb) {
    col("branches/" + bb + "/members").forEach(function (m) {
      var v = memberValidity(bb, m);
      if (v.state === "grace" || v.state === "excluded" || v.state === "soon") vrows.push({ m: m, v: v, bb: bb });
    });
  });
  var VL = { grace: ["warn", "În perioada de grație"], excluded: ["bad", "Exclus automat"], soon: ["warn", "Expiră în curând"] };
  h += vrows.length
    ? '<div class="list">' +
      vrows
        .map(function (x) {
          return row({
            act: "member",
            id: x.m.id,
            avatar: x.m.name,
            title: x.m.name,
            meta: esc(
              x.bb +
                " | valabil până la " +
                dro(x.v.vu) +
                (x.v.state === "excluded"
                  ? " | exclus din " + dro(x.v.ex)
                  : x.v.state === "grace"
                    ? " | excludere automată la " + dro(x.v.ex)
                    : ""),
            ),
            right: '<span class="pill ' + VL[x.v.state][0] + '">' + VL[x.v.state][1] + "</span>",
          });
        })
        .join("") +
      '</div><p class="help">Un membru este exclus automat din aplicație la 3 luni după expirarea valabilității, dacă nu a achitat. Accesul revine când se înregistrează plata cotizației.</p>'
    : '<p class="small" style="margin-bottom:16px">Nicio expirare apropiată.</p>';
  if (!S.server) {
    h += '<div class="sec-h"><h2>Cereri de verificare</h2></div>';
    var claims = col("claims")
      .filter(function (c) {
        return !c.processed && (!badgeOf(c.id) || !badgeOf(c.id).verified);
      })
      .filter(function (c) {
        return c.code || scopeBranches().indexOf(c.branch) >= 0;
      });
    h += claims.length
      ? '<div class="list">' +
        claims
          .map(function (c) {
            return row({
              act: "claim",
              id: c.id,
              avatar: c.name || "?",
              title: c.name || "Cod ...-" + String(c.code || "").slice(-4),
              meta: esc((c.branch || "") + (c.branch ? " | " : "") + (c.status || "cod necunoscut sau în filiala altei conduceri")),
              right: '<span class="pill warn">' + svg("clock", 14) + "În așteptare</span>",
            });
          })
          .join("") +
        "</div>"
      : '<p class="small" style="margin-bottom:16px">Nicio cerere în așteptare.</p>';
  }
  h += leadershipBlock(b);
  var au = col("audit")
    .slice()
    .sort(function (a, c) {
      return a.at < c.at ? 1 : -1;
    })
    .slice(0, 12);
  h +=
    '<div class="sec-h"><h2>Jurnal de modificări</h2></div>' +
    (au.length
      ? '<div class="list">' +
        au
          .map(function (a) {
            return row({
              title: a.summary || a.action,
              meta: esc(
                (a.byName || "") +
                  " | " +
                  fmtAt(a.at) +
                  (a.changes && a.changes[0] && a.changes[0].f !== "(document nou)"
                    ? " | " +
                      a.changes
                        .slice(0, 2)
                        .map(function (c) {
                          return c.f + ": " + c.o + " → " + c.n;
                        })
                        .join("; ")
                    : ""),
              ),
            });
          })
          .join("") +
        "</div>"
      : '<p class="small">Nicio modificare înregistrată.</p>');
  h += '<p class="small" style="margin-top:16px">Aplicația este evidență operațională, nu înlocuiește contabilitatea legală.</p>';
  return h;
}

/* ---- cotizatii / membri ---- */
function vFees() {
  var b = curBranch();
  var h =
    '<div class="page-head"><h1>Cotizații</h1>' +
    (S.feeView === "fees"
      ? canWrite()
        ? '<button class="btn sm" data-act="newfee">Adaugă cotizație</button>'
        : ""
      : myRole().role === "president"
        ? '<button class="btn sm" data-act="newmember">Adaugă membru</button>'
        : "") +
    "</div>";
  h +=
    '<div class="chips"><button class="chip" data-act="fv" data-id="fees" aria-pressed="' +
    (S.feeView === "fees") +
    '">Cotizații</button><button class="chip" data-act="fv" data-id="members" aria-pressed="' +
    (S.feeView === "members") +
    '">Membrii filialei</button></div>';
  if (S.err["branches/" + b + "/fees"])
    return (
      h +
      emptyBox(
        "Nu ai acces la această secțiune",
        "Evidențele financiare sunt vizibile doar conducerii filialei.",
        "Înapoi la Director",
        "godir",
      )
    );
  if (S.feeView === "members") {
    var ms = col("branches/" + b + "/members")
      .slice()
      .sort(function (a, c) {
        return norm(a.name) < norm(c.name) ? -1 : 1;
      });
    return (
      h +
      (ms.length
        ? '<div class="list">' +
          ms
            .map(function (m) {
              var bd = m.userId ? badgeOf(m.userId) : null;
              return row({
                act: "member",
                id: m.id,
                avatar: m.name,
                title: m.name,
                stripe: m.excluded ? "crit" : "",
                meta: m.userId ? (S.server ? "Cont activ" : "Cont legat") : S.server ? "Cont neactivat" : "Fără cont în aplicație",
                right: m.excluded
                  ? uiTag("Exclus", "crit")
                  : badgeState(bd) === "active"
                    ? '<span class="seal">' + svg("seal", 14) + "Membru activ</span>"
                    : "",
              });
            })
            .join("") +
          "</div>"
        : emptyBox(
            "Niciun membru în evidență",
            "Adaugă membrii filialei ca să le poți înregistra cotizațiile.",
            myRole().role === "president" ? "Adaugă membru" : "",
            "newmember",
          ))
    );
  }
  var t = today();
  var chips = [
    ["Toate", "Toate"],
    ["plătită", "Plătite"],
    ["restantă", "Restante"],
    ["avans", "Avans terț"],
    ["scutită", "Scutite"],
  ];
  h +=
    '<div class="chips">' +
    chips
      .map(function (c) {
        return (
          '<button class="chip" data-act="ff" data-id="' + c[0] + '" aria-pressed="' + (S.feeFilter === c[0]) + '">' + c[1] + "</button>"
        );
      })
      .join("") +
    "</div>";
  var fees = col("branches/" + b + "/fees")
    .filter(function (f) {
      if (f.anulat) return S.feeFilter === "Toate";
      if (S.feeFilter === "Toate") return true;
      if (S.feeFilter === "plătită") return f.state === "platita";
      if (S.feeFilter === "restantă") return f.state === "neplatita" && f.deadline && f.deadline < t;
      if (S.feeFilter === "avans") return f.state === "avans";
      return f.state === "scutita";
    })
    .sort(function (a, c) {
      return (c.createdAt || "") < (a.createdAt || "") ? -1 : 1;
    });
  if (!fees.length)
    return h + emptyBox("Nicio cotizație înregistrată", "Nu există cotizații pentru filtrele alese.", "Adaugă cotizație", "newfee");
  return (
    h +
    '<div class="list">' +
    fees
      .map(function (f) {
        var overdue = f.state === "neplatita" && f.deadline && f.deadline < t;
        var pl = f.anulat
          ? '<span class="pill neutral">' + svg("x", 14) + "Anulată</span>"
          : overdue
            ? '<span class="pill crit">' + svg("warn", 14) + "Restantă</span>"
            : pill(FEE_STATE, f.state);
        return row({
          act: "fee",
          id: f.id,
          stripe: f.anulat ? "" : f.state === "platita" ? "good" : overdue ? "crit" : f.state === "avans" ? "warn" : "",
          title: memberName(b, f.memberId),
          meta: esc("An " + f.year + " | termen " + dro(f.deadline) + (f.recovered ? " | recuperat" : "")),
          right: '<span class="num"><b>' + fmt(f.due) + " RON</b></span>" + pl,
        });
      })
      .join("") +
    '</div><button class="btn sec sm" data-act="csvfees">Copiază CSV</button>'
  );
}

/* ---- donatii ---- */
function vDon() {
  var b = curBranch();
  var h =
    '<div class="page-head"><h1>Donații</h1>' +
    (canWrite() ? '<button class="btn sm" data-act="newdon">Adaugă donație</button>' : "") +
    "</div>";
  if (S.err["branches/" + b + "/donations"])
    return (
      h +
      emptyBox(
        "Nu ai acces la această secțiune",
        "Evidențele financiare sunt vizibile doar conducerii filialei.",
        "Înapoi la Director",
        "godir",
      )
    );
  var ds = col("branches/" + b + "/donations")
    .slice()
    .sort(function (a, c) {
      return (c.date || "") < (a.date || "") ? -1 : 1;
    });
  if (!ds.length) return h + emptyBox("Nicio donație înregistrată", "Nu există donații pentru filtrele alese.", "Adaugă donație", "newdon");
  return (
    h +
    '<div class="list">' +
    ds
      .map(function (d) {
        return row({
          act: "don",
          id: d.id,
          stripe: d.anulat ? "" : "good",
          title: donorName(d),
          meta: esc(dro(d.date) + " | " + (d.purpose || "Nedestinat")),
          right:
            '<span class="num"><b>' +
            fmt(d.amount) +
            " RON</b></span>" +
            (d.anulat ? '<span class="pill neutral">' + svg("x", 14) + "Anulată</span>" : ""),
        });
      })
      .join("") +
    '</div><button class="btn sec sm" data-act="csvdon">Copiază CSV</button>'
  );
}

/* ---- cheltuieli ---- */
function vExp() {
  var b = curBranch();
  var h =
    '<div class="page-head"><h1>Cheltuieli</h1>' +
    (canWrite() ? '<button class="btn sm" data-act="newexp">Adaugă cheltuială</button>' : "") +
    "</div>";
  if (S.err["branches/" + b + "/expenses"])
    return (
      h +
      emptyBox(
        "Nu ai acces la această secțiune",
        "Evidențele financiare sunt vizibile doar conducerii filialei.",
        "Înapoi la Director",
        "godir",
      )
    );
  var chips = [
    ["Toate", "Toate"],
    ["propusa", "Propuse"],
    ["aprobata", "Aprobate"],
    ["platita", "Plătite"],
    ["respinsa", "Respinse"],
  ];
  h +=
    '<div class="chips">' +
    chips
      .map(function (c) {
        return (
          '<button class="chip" data-act="ef" data-id="' + c[0] + '" aria-pressed="' + (S.expFilter === c[0]) + '">' + c[1] + "</button>"
        );
      })
      .join("") +
    "</div>";
  var es = col("branches/" + b + "/expenses")
    .filter(function (e) {
      return S.expFilter === "Toate" ? true : !e.anulat && e.state === S.expFilter;
    })
    .sort(function (a, c) {
      return (c.date || "") < (a.date || "") ? -1 : 1;
    });
  if (!es.length)
    return h + emptyBox("Nicio cheltuială înregistrată", "Nu există cheltuieli pentru filtrele alese.", "Adaugă cheltuială", "newexp");
  return (
    h +
    '<div class="list">' +
    es
      .map(function (e) {
        var st = e.anulat ? "anulata" : e.state;
        var sev = st === "platita" || st === "aprobata" ? "good" : st === "respinsa" ? "crit" : st === "propusa" ? "warn" : "";
        var big = isOver(e) && st === "propusa" ? '<span class="pill warn">' + svg("warn", 14) + "Peste 500 RON</span>" : "";
        return row({
          act: "exp",
          id: e.id,
          stripe: sev,
          title: e.desc,
          meta: esc(dro(e.date) + " | " + e.category + (e.supplier ? " | " + e.supplier : "")),
          right: '<span class="num"><b>' + fmt(e.amount) + " RON</b></span>" + pill(EXP_STATE, st) + big,
        });
      })
      .join("") +
    '</div><button class="btn sec sm" data-act="csvexp">Copiază CSV</button>'
  );
}
