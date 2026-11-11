/* Structură: președinte național, filiale, funcții de conducere, predarea funcției, excluderea unui membru.
   Toate schimbările trec prin adminOp() (20-stare.js); drepturile le verifică serverul. */
function byName(a, c) {
  return norm(a.name) < norm(c.name) ? -1 : norm(a.name) > norm(c.name) ? 1 : 0;
}
function rememberNames(list) {
  (list || []).forEach(function (x) {
    if (x && x.id && x.name) S.nm[x.id] = String(x.name);
  });
}
/* Numele unui cont din roluri: profil, evidență sau nume învățat în sesiune; altfel o mențiune clară. */
function structName(id) {
  var n = nameOf(id);
  var r = (S.D.roles || []).filter(function (x) {
    return x.id === id;
  })[0];
  return r && n === roleTitle(r) ? "Profil necompletat" : n;
}
function errActs(okLabel) {
  return (
    '<div class="err" id="sheeterr"></div><div class="sheet-acts"><button class="btn" type="submit">' +
    esc(okLabel) +
    '</button><button class="btn sec" type="button" data-act="closesheet">Anulează</button></div>'
  );
}
function roleOfBranch(role, b) {
  return (
    (S.D.roles || []).filter(function (x) {
      return x.role === role && (role === "national" || x.branch === b);
    })[0] || null
  );
}

/* ---- ecranul Structură (administrator tehnic și președinte național) ---- */
function vStructure() {
  var me = myRole();
  var nat = roleOfBranch("national");
  var h = '<div class="page-head"><h1>Structură</h1></div>';
  h += uiSection("Președinte național");
  h +=
    '<div class="list">' +
    row({
      avatar: nat ? structName(nat.id) : "",
      title: nat ? structName(nat.id) : "Nenumit",
      meta: esc(nat ? roleTitle(nat) : "Nicio persoană în această funcție"),
    }) +
    "</div>";
  var acts = "";
  if (me.role === "mod") {
    acts +=
      '<button class="btn" data-act="natset">' +
      (nat ? "Înlocuiește președintele național" : "Numește președintele național") +
      "</button>";
    if (nat) acts += '<button class="btn sec" data-act="natcode" data-id="' + esc(nat.id) + '">Cod nou de intrare</button>';
  }
  if (me.role === "national") acts += '<button class="btn sec" data-act="handover">Predă funcția</button>';
  if (acts) h += '<div class="acts">' + acts + "</div>";

  h += uiSection("Filiale", '<button class="btn sm" data-act="addbranch">Adaugă filială</button>');
  h += BRANCHES.length
    ? '<div class="list">' +
      BRANCHES.map(function (b) {
        var p = roleOfBranch("president", b);
        return row({
          act: "branch",
          id: b,
          avatar: b,
          title: b,
          meta: esc(p ? "Președinte: " + structName(p.id) : "Fără președinte"),
          right: p ? "" : uiTag("Fără președinte", "warn"),
        });
      }).join("") +
      "</div>"
    : emptyBox("Nicio filială", "Adaugă prima filială, cu președintele ei.", "Adaugă filială", "addbranch");

  var au = col("audit")
    .filter(function (a) {
      return a.path === "roles" || a.path === "branchlist";
    })
    .sort(function (a, c) {
      return a.at < c.at ? 1 : -1;
    })
    .slice(0, 20);
  h += uiSection("Jurnal");
  h += au.length
    ? '<div class="list">' +
      au
        .map(function (a) {
          return row({ title: a.summary || a.action, meta: esc((a.byName || "") + " | " + fmtAt(a.at)) });
        })
        .join("") +
      "</div>"
    : '<p class="small">Nicio modificare de structură înregistrată.</p>';
  return h;
}

/* ---- administrator tehnic: președintele național ---- */
function sheetSetNational() {
  openSheet(
    '<h2>Numește președintele național</h2><p class="small">Persoana nouă se adaugă în evidența filialei alese și primește un cod de intrare. Un singur președinte național: cel de acum își pierde funcția și rămâne membru.</p><form>' +
      sel("branch", BRANCHES, BRANCHES[0], "Filiala", "ns_b") +
      inp("name", "Numele complet", "", "text", "ns_n", 'maxlength="100" autocomplete="off"') +
      errActs("Numește"),
    async function (fd) {
      var name = String(fd.get("name") || "").trim();
      if (name.length < 2) return fieldErr("Scrie numele complet, de cel puțin 2 caractere.");
      var res = await adminOp({ op: "setNational", branch: String(fd.get("branch") || ""), name: name });
      if (!res) return;
      if (res.memberId) S.nm[res.memberId] = name;
      if (res.code) showCode(name, res.code, res.expires);
      else {
        closeSheet();
        toast("Președintele național a fost numit.");
      }
    },
  );
}
/* Cod nou de intrare pentru o funcție de conducere. id = id-ul membrului. */
async function doLeaderCode(id) {
  var res = await adminOp({ op: "leaderCode", memberId: id });
  if (!res || !res.code) return;
  showCode(structName(id), res.code, res.expires);
}

/* ---- filiale ---- */
function sheetAddBranch() {
  openSheet(
    '<h2>Adaugă filială</h2><p class="small">Filiala nouă pornește cu președintele ei, care primește un cod de intrare.</p><form>' +
      inp("name", "Denumirea filialei", "", "text", "ab_n", 'maxlength="40" autocomplete="off"') +
      inp("presidentName", "Numele președintelui", "", "text", "ab_p", 'maxlength="100" autocomplete="off"') +
      errActs("Adaugă"),
    async function (fd) {
      var name = String(fd.get("name") || "").trim();
      var pn = String(fd.get("presidentName") || "").trim();
      if (name.length < 2 || name.length > 40) return fieldErr("Denumirea filialei are între 2 și 40 de caractere.");
      if (pn.length < 2) return fieldErr("Scrie numele președintelui, de cel puțin 2 caractere.");
      var res = await adminOp({ op: "addBranch", name: name, presidentName: pn });
      if (!res) return;
      if (res.memberId) S.nm[res.memberId] = pn;
      if (res.code) showCode(pn, res.code, res.expires);
      else {
        closeSheet();
        toast("Filiala a fost adăugată.");
      }
    },
  );
}
function sheetBranch(b) {
  var p = roleOfBranch("president", b);
  openSheet(
    "<h2>" +
      esc(b) +
      '</h2><p class="small">' +
      esc(p ? "Președinte: " + structName(p.id) : "Filiala nu are președinte.") +
      '</p><div class="acts"><button class="btn" data-act="setpres" data-id="' +
      esc(b) +
      '">Schimbă președintele</button>' +
      (p ? '<button class="btn sec" data-act="prescode" data-id="' + esc(p.id) + '">Cod nou pentru președinte</button>' : "") +
      '</div><div class="sheet-acts"><button class="btn sec" data-act="closesheet">Închide</button></div>',
  );
}
async function sheetSetPresident(b) {
  var res = await adminOp({ op: "candidates", for: "president", branch: b });
  if (!res) return;
  var list = (res.list || []).slice().sort(byName);
  rememberNames(list);
  var cur = roleOfBranch("president", b);
  var nat = roleOfBranch("national");
  var opts = [["", "Persoană nouă (scrie numele mai jos)"]].concat(
    list
      .filter(function (c) {
        return !(cur && c.id === cur.id) && !(nat && c.id === nat.id);
      })
      .map(function (c) {
        return [c.id, c.name + (c.active ? "" : " (cont neactivat)")];
      }),
  );
  openSheet(
    "<h2>Schimbă președintele, " +
      esc(b) +
      '</h2><p class="small">Președintele de acum își pierde funcția și rămâne membru. Dacă noul președinte nu are cont activat, primește un cod de intrare.</p><form>' +
      sel("memberId", opts, "", "Din evidența filialei", "sp_m") +
      inp("name", "Sau numele unei persoane noi", "", "text", "sp_n", 'maxlength="100" autocomplete="off"') +
      errActs("Schimbă președintele"),
    async function (fd) {
      var mid = String(fd.get("memberId") || "");
      var name = String(fd.get("name") || "").trim();
      var body = { op: "setPresident", branch: b };
      if (mid) body.memberId = mid;
      else if (name.length >= 2) body.name = name;
      else return fieldErr("Alege un membru din listă sau scrie numele unei persoane noi.");
      var res2 = await adminOp(body);
      if (!res2) return;
      var shown = mid ? S.nm[mid] || "președintele nou" : name;
      if (res2.memberId && !mid) S.nm[res2.memberId] = name;
      if (res2.code) showCode(shown, res2.code, res2.expires);
      else {
        closeSheet();
        toast("Președintele filialei a fost schimbat.");
      }
    },
  );
}

/* ---- predarea funcției (orice rol cu funcție) ---- */
async function sheetHandover() {
  var r = myRole();
  var res = await adminOp({ op: "candidates", for: "handover" });
  if (!res) return;
  var list = (res.list || []).slice().sort(byName);
  rememberNames(list);
  if (!list.length) {
    toast("Nu există niciun membru cu cont activat căruia să-i poți preda funcția.");
    return;
  }
  var what =
    r.role === "president"
      ? "funcția de președinte al filialei " + r.branch
      : r.role === "national"
        ? "funcția de președinte național"
        : "funcția „" + roleTitle(r) + "”";
  openSheet(
    "<h2>Predă funcția</h2><p>Predai " +
      esc(what) +
      ". Persoana aleasă o primește imediat, iar tu rămâi membru, cu drepturile unui membru.</p><form>" +
      sel(
        "to",
        list.map(function (c) {
          return [c.id, c.name + (r.role === "national" && c.branch ? " (" + c.branch + ")" : "")];
        }),
        "",
        "Cui predai funcția",
        "ho_to",
      ) +
      '<label class="check"><input type="checkbox" name="ok"><span>Confirm că vreau să predau funcția. Schimbarea se aplică imediat.</span></label>' +
      errActs("Predă funcția"),
    async function (fd) {
      if (!fd.get("ok")) return fieldErr("Bifează confirmarea ca să predai funcția.");
      var to = String(fd.get("to") || "");
      if (!to) return fieldErr("Alege persoana căreia îi predai funcția.");
      var res2 = await adminOp({ op: "handover", to: to });
      if (!res2) return;
      closeSheet();
      toast("Funcția a fost predată. Ai rămas membru.");
    },
  );
}
/* "Funcția mea", în Profilul meu, pentru vicepreședintele trezorier și celelalte funcții de conducere. */
function myFunctionBlock() {
  var r = myRole();
  if (r.role !== "treasurer" && r.role !== "board") return "";
  return (
    uiSection("Funcția mea") +
    uiKV([
      ["Funcția", roleTitle(r)],
      ["Filiala", r.branch],
    ]) +
    '<p class="small" style="margin:12px 0">Poți preda funcția unui alt membru al filialei. După predare rămâi membru.</p><button class="btn sec" data-act="handover">Predă funcția</button>'
  );
}

/* ---- președintele filialei: conducerea ---- */
function leadershipBlock(b) {
  var isPres = myRole().role === "president";
  var order = { president: 0, treasurer: 1, board: 2 };
  var rs = col("roles")
    .filter(function (x) {
      return x.branch === b && order[x.role] !== undefined;
    })
    .sort(function (a, c) {
      return order[a.role] - order[c.role];
    });
  var h = uiSection("Conducerea filialei", isPres ? '<button class="btn sm" data-act="newrole">Numește în funcție</button>' : "");
  h += rs.length
    ? '<div class="list">' +
      rs
        .map(function (x) {
          return row({
            act: isPres && x.role !== "president" ? "role" : "",
            id: x.id,
            avatar: structName(x.id),
            title: structName(x.id),
            meta: esc(roleTitle(x)),
          });
        })
        .join("") +
      "</div>"
    : '<p class="small">Nicio funcție de conducere înregistrată.</p>';
  if (isPres) h += '<div class="acts"><button class="btn sec" data-act="handover">Predă funcția de președinte</button></div>';
  return h;
}
function sheetNewRole() {
  var b = curBranch();
  var ms = col("branches/" + b + "/members")
    .filter(function (m) {
      var r = roleOfMember(m);
      return !m.excluded && !isSelf(m) && !(r && (r.role === "national" || r.role === "president"));
    })
    .sort(byName);
  if (!ms.length) {
    toast("Nu există membri cărora să le poți atribui o funcție. Adaugă mai întâi membri în evidență.");
    return;
  }
  openSheet(
    '<h2>Numește în funcție</h2><p class="small">Funcția se aplică imediat. Membrul își activează contul cu un cod de intrare, generat din fișa lui.</p><form>' +
      sel(
        "memberId",
        ms.map(function (m) {
          return [m.id, m.name + (m.userId ? "" : " (cont neactivat)")];
        }),
        "",
        "Membrul",
        "nr_m",
      ) +
      sel(
        "role",
        [
          ["treasurer", "Vicepreședinte trezorier"],
          ["board", "Altă funcție de conducere"],
        ],
        "treasurer",
        "Funcția",
        "nr_r",
      ) +
      inp("title", "Titlul funcției (pentru altă funcție de conducere)", "", "text", "nr_t", 'maxlength="60" autocomplete="off"') +
      errActs("Numește"),
    async function (fd) {
      var role = String(fd.get("role") || "");
      var title = String(fd.get("title") || "").trim();
      var body = { op: "setRole", memberId: String(fd.get("memberId") || ""), role: role };
      if (!body.memberId) return fieldErr("Alege membrul.");
      if (role === "board") {
        if (title.length < 2 || title.length > 60) return fieldErr("Titlul funcției are între 2 și 60 de caractere.");
        body.title = title;
      }
      var res = await adminOp(body);
      if (!res) return;
      closeSheet();
      toast("Funcția a fost atribuită.");
    },
  );
}
function sheetRole(id) {
  var x = col("roles").filter(function (y) {
    return y.id === id;
  })[0];
  if (!x) return;
  openSheet(
    "<h2>" +
      esc(structName(id)) +
      '</h2><p class="small">' +
      esc(roleTitle(x)) +
      '</p><p class="small" style="margin-top:8px">Dacă retragi funcția, persoana rămâne membru al filialei.</p><div class="acts"><button class="btn crit" data-act="roleoff" data-id="' +
      esc(id) +
      '">Retrage funcția</button></div><div class="sheet-acts"><button class="btn sec" data-act="closesheet">Închide</button></div>',
  );
}
async function doRoleOff(id) {
  var res = await adminOp({ op: "setRole", memberId: id, role: "member" });
  if (!res) return;
  closeSheet();
  toast("Funcția a fost retrasă.");
}

/* ---- excluderea și reactivarea unui membru (președintele filialei) ---- */
function sheetExclude(id) {
  var m = col("branches/" + (S._mb || curBranch()) + "/members").filter(function (x) {
    return x.id === id;
  })[0];
  if (!m) return;
  openSheet(
    "<h2>Exclude din aplicație: " +
      esc(m.name) +
      '</h2><p>Contul lui este suspendat imediat: nu mai poate intra, nici cu un cod nou, și nu mai apare în director. Nimic nu se șterge, iar contul se poate reactiva oricând, exact cum era.</p><div class="sheet-acts"><button class="btn crit" data-act="exclude2" data-id="' +
      esc(id) +
      '">Exclude</button><button class="btn sec" data-act="closesheet">Renunț</button></div>',
  );
}
async function doExclude(id) {
  var res = await adminOp({ op: "exclude", memberId: id });
  if (!res) return;
  closeSheet();
  toast("Membrul a fost exclus din aplicație.");
}
async function doReactivate(id) {
  var res = await adminOp({ op: "reactivate", memberId: id });
  if (!res) return;
  closeSheet();
  toast("Contul a fost reactivat.");
}
