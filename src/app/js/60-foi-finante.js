/* Foi (formulare și detalii): membri, cotizații, donații, cheltuieli */
function showCode(name, cd, exp) {
  openSheet(
    "<h2>Cod pentru " +
      esc(name) +
      '</h2><p class="small">Transmite-i codul membrului. Expiră la ' +
      dro(exp) +
      '. Nu îl mai poți vedea după ce închizi fereastra.</p><p class="num" style="font-size:28px;font-family:monospace;margin:16px 0;overflow-wrap:anywhere">' +
      fmtCode(cd) +
      '</p><div class="sheet-acts"><button class="btn" data-act="copycode" data-id="' +
      cd +
      '">Copiază codul</button><button class="btn sec" data-act="closesheet">Închide</button></div>',
  );
}
function sheetNewMember() {
  openSheet(
    "<h2>Adaugă membru</h2><form>" +
      inp("name", "Nume complet", "", "text", "m_name") +
      inp("validUntil", "Calitatea de membru valabilă până la", defaultValid(), "date", "m_vu") +
      (S.server
        ? '<p class="help">După salvare, deschide membrul din listă ca să generezi codul de înscriere.</p>'
        : inp("userId", "Codul contului (opțional)", "", "text", "m_uid", 'autocomplete="off"') +
          '<p class="help">Dacă membrul are cont în aplicație, lipește codul lui din „Profilul meu”. Lăsat gol, membrul e doar în evidența de cotizații.</p>') +
      '<div class="err" id="sheeterr"></div><div class="sheet-acts"><button class="btn" type="submit">Salvează</button><button class="btn sec" type="button" data-act="closesheet">Anulează</button></div></form>',
    async function (fd) {
      var n = String(fd.get("name") || "").trim();
      if (!n) return fieldErr("Completează câmpul Nume.");
      var b = curBranch();
      var id = uid();
      var u = String(fd.get("userId") || "").trim();
      var nm = { name: n, branch: b, userId: u, validUntil: String(fd.get("validUntil") || defaultValid()) };
      if (await put("branches/" + b + "/members", id, nm, "create", "Membru adăugat: " + n)) {
        if (u) await recomputeBadge(b, id, Object.assign({ id: id }, nm));
        closeSheet();
        toast("Modificările au fost salvate. Deschide membrul din listă ca să generezi codul de înscriere.");
      }
    },
  );
}
function sheetFee() {
  var b = curBranch();
  var ms = col("branches/" + b + "/members");
  if (!ms.length) {
    toast("Adaugă mai întâi membrii filialei.");
    S.feeView = "members";
    render();
    return;
  }
  var yr = 2027;
  openSheet(
    "<h2>Adaugă cotizație</h2><form>" +
      sel(
        "memberId",
        ms.map(function (m) {
          return [m.id, m.name];
        }),
        "",
        "Membru",
        "fm",
      ) +
      inp("year", "An", yr, "number", "fy", 'min="2026" max="2100"') +
      inp("due", "Suma datorată (RON)", fmt(getSettings(b).feeDue).replace(/\./g, ""), "text", "fd2", "readonly") +
      '<p class="help" style="margin-top:-8px;margin-bottom:12px">Suma o stabilește administratorul național, din setările filialei.</p>' +
      inp("deadline", "Termen de plată", "2026-10-30", "date", "fdl") +
      sel(
        "state",
        [
          ["neplatita", "Neplătită"],
          ["platita", "Plătită"],
          ["avans", "Plătită în avans de terț"],
          ["scutita", "Scutită"],
        ],
        "neplatita",
        "Stare",
        "fs",
      ) +
      inp("paidOn", "Data plății", "", "date", "fp") +
      sel("method", ["transfer bancar", "card", "numerar", "compensare cu președintele"], "transfer bancar", "Metoda", "fmt") +
      inp("thirdParty", "Plătitor terț (la plată în avans)", "", "text", "ft") +
      inp("reason", "Motiv scutire (la scutire)", "", "text", "fr") +
      inp("decision", "Hotărâre Consiliu pentru scutire (număr)", "", "text", "fh") +
      inp("decisionDate", "Data hotărârii", "", "date", "fhd") +
      '<div class="err" id="sheeterr"></div><div class="sheet-acts"><button class="btn" type="submit">Salvează</button><button class="btn sec" type="button" data-act="closesheet">Anulează</button></div></form>',
    async function (fd) {
      var due = getSettings(b).feeDue;
      var yv = Number(fd.get("year"));
      if (!(yv >= 2026 && yv <= 2100)) return fieldErr("Anul trebuie să fie 2026 sau mai mare.");
      var st = fd.get("state");
      var paidOn = fd.get("paidOn");
      if ((st === "platita" || st === "avans") && !paidOn) return fieldErr("Alege data plății.");
      if (st === "avans" && !String(fd.get("thirdParty") || "").trim()) return fieldErr("Completează plătitorul terț.");
      if (
        st === "scutita" &&
        (String(fd.get("reason") || "").trim().length < 10 || !String(fd.get("decision") || "").trim() || !fd.get("decisionDate"))
      )
        return fieldErr("Scutirea cere un motiv de minimum 10 caractere și hotărârea Consiliului (număr și dată).");
      var mid = fd.get("memberId");
      var dup = activeRows("branches/" + b + "/fees").some(function (f) {
        return f.memberId === mid && String(f.year) === String(fd.get("year"));
      });
      if (dup) return fieldErr("Există deja o cotizație pentru acest membru și an. Anulează-o mai întâi, dacă vrei să o refaci.");
      var o = {
        memberId: mid,
        year: yv,
        due: due,
        paid: st === "platita" || st === "avans" ? due : 0,
        state: st,
        deadline: fd.get("deadline"),
        paidOn: paidOn || "",
        method: fd.get("method"),
        thirdParty: st === "avans" ? String(fd.get("thirdParty")).trim() : "",
        recovered: false,
        reason: st === "scutita" ? String(fd.get("reason")).trim() : "",
        decision: st === "scutita" ? String(fd.get("decision")).trim() : "",
        decisionDate: st === "scutita" ? fd.get("decisionDate") : "",
        createdAt: today(),
        createdBy: S.me.id,
        anulat: false,
        branch: b,
      };
      var id = uid();
      if (
        await put(
          "branches/" + b + "/fees",
          id,
          o,
          "create",
          "Cotizație " + o.year + " pentru " + memberName(b, mid) + ": " + FEE_STATE[st][0],
        )
      ) {
        await recomputeBadge(b, mid);
        closeSheet();
        toast("Modificările au fost salvate.");
      }
    },
  );
}
function sheetDon() {
  var b = curBranch();
  openSheet(
    "<h2>Adaugă donație</h2><form>" +
      inp("donor", "Donator", "", "text", "dn") +
      '<label class="check"><input type="checkbox" name="anon"><span>Donator anonim (numele nu se păstrează în aplicație)</span></label>' +
      sel("type", ["persoană fizică", "persoană juridică"], "persoană fizică", "Tip donator", "dt") +
      inp("amount", "Suma (RON)", "", "text", "da", 'inputmode="decimal"') +
      inp("date", "Data", today(), "date", "dd") +
      inp("purpose", "Scop", "Nedestinat", "text", "dp") +
      inp("doc", "Document (număr contract sau extras)", "", "text", "dc") +
      '<p class="help">Nu introduce IBAN, CNP, adrese sau alte date personale.</p><div class="err" id="sheeterr"></div><div class="sheet-acts"><button class="btn" type="submit">Salvează</button><button class="btn sec" type="button" data-act="closesheet">Anulează</button></div></form>',
    async function (fd) {
      var amt = toBani(fd.get("amount"));
      var am = amtMsg(fd.get("amount"), amt);
      if (am) return fieldErr(am);
      var date = fd.get("date");
      if (!date) return fieldErr("Alege data.");
      if (date > today()) return fieldErr("Data nu poate fi în viitor.");
      var anon = !!fd.get("anon");
      var name = String(fd.get("donor") || "").trim();
      if (!anon && !name) return fieldErr("Completează donatorul sau bifează donator anonim.");
      var o = {
        donor: anon ? "Anonim" : name.slice(0, 100),
        anonymous: anon,
        type: fd.get("type"),
        amount: amt,
        date: date,
        purpose: String(fd.get("purpose") || "Nedestinat").slice(0, 150),
        doc: String(fd.get("doc") || "").slice(0, 60),
        anulat: false,
        createdBy: S.me.id,
        branch: b,
      };
      if (await put("branches/" + b + "/donations", uid(), o, "create", "Donație înregistrată: " + fmt(amt) + " RON")) {
        closeSheet();
        toast("Modificările au fost salvate.");
      }
    },
  );
}
function sheetExp() {
  var b = curBranch();
  openSheet(
    "<h2>Adaugă cheltuială</h2><form>" +
      sel("category", CATS, CATS[0], "Categorie", "xc") +
      '<div class="field"><label for="xd">Descriere</label><textarea id="xd" name="desc" maxlength="200"></textarea><span class="help">Minimum 15 caractere, fără formule vagi.</span></div>' +
      inp("amount", "Suma (RON)", "", "text", "xa", 'inputmode="decimal"') +
      inp("date", "Data documentului", today(), "date", "xt") +
      inp("supplier", "Furnizor", "", "text", "xs") +
      inp("cui", "CUI furnizor (persoane juridice)", "", "text", "xu") +
      inp("docNo", "Număr document justificativ", "", "text", "xn") +
      '<p class="help">Peste 500 RON, cheltuiala cere aprobarea Consiliului de Conducere (Art. 31). Nu introduce IBAN, CNP sau alte date personale în descriere.</p><div class="err" id="sheeterr"></div><div class="sheet-acts"><button class="btn" type="submit">Propune cheltuiala</button><button class="btn sec" type="button" data-act="closesheet">Anulează</button></div></form>',
    async function (fd, form) {
      var amt = toBani(fd.get("amount"));
      var am = amtMsg(fd.get("amount"), amt);
      if (am) return fieldErr(am);
      if (String(fd.get("desc") || "").trim().length < 15) return fieldErr("Descrierea are nevoie de minimum 15 caractere.");
      if (!fd.get("date")) return fieldErr("Alege data.");
      var sup = String(fd.get("supplier") || "").trim();
      var o = {
        category: fd.get("category"),
        desc: String(fd.get("desc")).trim(),
        amount: amt,
        date: fd.get("date"),
        supplier: sup,
        cui: String(fd.get("cui") || "").trim(),
        docNo: String(fd.get("docNo") || "").trim(),
        state: "propusa",
        proposedBy: S.me.id,
        anulat: false,
        branch: b,
      };
      var dup = activeRows("branches/" + b + "/expenses").some(function (x) {
        return x.amount === amt && norm(x.supplier) === norm(sup) && x.date === o.date;
      });
      var docDup =
        o.docNo &&
        activeRows("branches/" + b + "/expenses").some(function (x) {
          return x.docNo && norm(x.docNo) === norm(o.docNo);
        });
      var frac = fracWarn(b, o);
      o.fractionat = frac;
      if ((dup || docDup || frac) && !form._ack) {
        form._ack = true;
        return fieldErr(
          (dup ? "Există deja o cheltuială cu aceeași sumă, furnizor și dată. " : "") +
            (docDup ? "Numărul documentului e deja folosit. " : "") +
            (frac ? "Suma cumulată pe acest furnizor în 30 de zile depășește 500 RON: se tratează ca peste prag. " : "") +
            "Apasă din nou „Propune cheltuiala” ca să salvezi oricum.",
        );
      }
      if (
        await put(
          "branches/" + b + "/expenses",
          uid(),
          o,
          "create",
          "Cheltuială propusă: " + o.desc.slice(0, 50) + " (" + fmt(amt) + " RON)",
        )
      ) {
        closeSheet();
        toast("Modificările au fost salvate.");
      }
    },
  );
}

/* ---- detalii ---- */
function reasonForm(title, btn, onOk, needLen, extra) {
  openSheet(
    "<h2>" +
      esc(title) +
      "</h2><form>" +
      (extra || "") +
      '<div class="field"><label for="rs">Motiv</label><textarea id="rs" name="reason" maxlength="200"></textarea><span class="help">Minimum ' +
      (needLen || 15) +
      ' caractere.</span></div><div class="err" id="sheeterr"></div><div class="sheet-acts"><button class="btn crit" type="submit">' +
      esc(btn) +
      '</button><button class="btn sec" type="button" data-act="closesheet">Renunț</button></div></form>',
    async function (fd) {
      var r = String(fd.get("reason") || "").trim();
      if (r.length < (needLen || 15)) return fieldErr("Motivul are nevoie de minimum " + (needLen || 15) + " caractere.");
      await onOk(r, fd);
    },
  );
}
function detailFee(id) {
  var b = curBranch();
  var f = col("branches/" + b + "/fees").filter(function (x) {
    return x.id === id;
  })[0];
  if (!f) return;
  var h =
    "<h2>" +
    esc(memberName(b, f.memberId)) +
    "</h2><p>" +
    pill(FEE_STATE, f.state) +
    (f.anulat ? ' <span class="pill neutral">Anulată</span>' : "") +
    '</p><p style="margin-top:12px"><b>An:</b> ' +
    esc(f.year) +
    "<br><b>Sumă datorată:</b> " +
    fmt(f.due) +
    " RON<br><b>Termen:</b> " +
    dro(f.deadline) +
    (f.paidOn ? "<br><b>Plătită la:</b> " + dro(f.paidOn) + " (" + esc(f.method || "") + ")" : "") +
    (f.thirdParty
      ? "<br><b>Plătitor terț:</b> " + esc(f.thirdParty) + (f.recovered ? " (recuperat de la membru)" : " (nerecuperat)")
      : "") +
    (f.reason ? "<br><b>Motiv scutire:</b> " + esc(f.reason) : "") +
    (f.anulat ? "<br><b>Motiv anulare:</b> " + esc(f.cancelReason || "") : "") +
    '</p><div class="sheet-acts">';
  if (!f.anulat && canWrite()) {
    if (f.state === "neplatita") h += '<button class="btn" data-act="feepaid" data-id="' + id + '">Marchează plătită</button>';
    if (f.state === "avans" && !f.recovered)
      h += '<button class="btn" data-act="feerec" data-id="' + id + '">Marchează recuperată</button>';
    h += '<button class="btn crit" data-act="feecancel" data-id="' + id + '">Anulează</button>';
  }
  h += '<button class="btn sec" data-act="closesheet">Închide</button></div>';
  openSheet(h);
}
function detailDon(id) {
  var b = curBranch();
  var d = col("branches/" + b + "/donations").filter(function (x) {
    return x.id === id;
  })[0];
  if (!d) return;
  var h =
    "<h2>" +
    esc(donorName(d)) +
    "</h2><p><b>Suma:</b> " +
    fmt(d.amount) +
    " RON<br><b>Data:</b> " +
    dro(d.date) +
    "<br><b>Tip:</b> " +
    esc(d.type) +
    "<br><b>Scop:</b> " +
    esc(d.purpose || "") +
    (d.doc ? "<br><b>Document:</b> " + esc(d.doc) : "") +
    (d.anulat ? "<br><b>Anulată:</b> " + esc(d.cancelReason || "") : "") +
    '</p><div class="sheet-acts">' +
    (d.anulat || !canWrite() ? "" : '<button class="btn crit" data-act="doncancel" data-id="' + id + '">Anulează</button>') +
    '<button class="btn sec" data-act="closesheet">Închide</button></div>';
  openSheet(h);
}
function detailExp(id) {
  var b = curBranch();
  var e = col("branches/" + b + "/expenses").filter(function (x) {
    return x.id === id;
  })[0];
  if (!e) return;
  var st = e.anulat ? "anulata" : e.state;
  var h =
    "<h2>" +
    esc(e.desc) +
    "</h2><p>" +
    pill(EXP_STATE, st) +
    '</p><p style="margin-top:12px"><b>Suma:</b> ' +
    fmt(e.amount) +
    " RON<br><b>Categorie:</b> " +
    esc(e.category) +
    "<br><b>Data:</b> " +
    dro(e.date) +
    (e.supplier ? "<br><b>Furnizor:</b> " + esc(e.supplier) + (e.cui ? " (CUI " + esc(e.cui) + ")" : "") : "") +
    (e.docNo ? "<br><b>Document:</b> " + esc(e.docNo) : "") +
    "<br><b>Propusă de:</b> " +
    esc(nameOf(e.proposedBy)) +
    (e.approvedBy
      ? "<br><b>Aprobată de:</b> " +
        esc(nameOf(e.approvedBy)) +
        (e.decision ? " (" + esc(e.decision) + ", " + dro(e.decisionDate) + ")" : "")
      : "") +
    (e.rejectReason ? "<br><b>Motiv respingere:</b> " + esc(e.rejectReason) : "") +
    (e.cancelReason ? "<br><b>Motiv anulare:</b> " + esc(e.cancelReason) : "") +
    "</p>";
  if (e.fractionat)
    h += '<div class="notice" style="margin-top:12px">Suma cumulată pe acest furnizor în 30 de zile depășește 500 RON.</div>';
  h += '<div class="sheet-acts">';
  if (!e.anulat && canWrite()) {
    var r = myRole().role;
    var canApprove = r === "president";
    if (e.state === "propusa" && canApprove) {
      if (e.proposedBy === S.me.id) h += '<p class="small" style="width:100%">Cine propune nu poate aproba aceeași cheltuială.</p>';
      else
        h +=
          '<button class="btn" data-act="expappr" data-id="' +
          id +
          '">Aprobă</button><button class="btn crit" data-act="expreject" data-id="' +
          id +
          '">Respinge</button>';
    }
    if (e.state === "propusa" && !canApprove && !isOver(e))
      h += '<button class="btn" data-act="exppay" data-id="' + id + '">Marchează plătită</button>';
    if (e.state === "propusa" && canApprove && !isOver(e) && e.proposedBy !== S.me.id)
      h += '<button class="btn sec" data-act="exppay" data-id="' + id + '">Marchează plătită</button>';
    if (e.state === "aprobata" && e.approvedBy !== S.me.id)
      h += '<button class="btn" data-act="exppay" data-id="' + id + '">Marchează plătită</button>';
    h += '<button class="btn crit" data-act="expcancel" data-id="' + id + '">Anulează</button>';
  }
  h += '<button class="btn sec" data-act="closesheet">Închide</button></div>';
  openSheet(h);
}
async function expUpdate(id, patch, summary) {
  var b = curBranch();
  var e = col("branches/" + b + "/expenses").filter(function (x) {
    return x.id === id;
  })[0];
  if (!e) return false;
  var o = Object.assign({}, e);
  delete o.id;
  for (var k in patch) o[k] = patch[k];
  return put("branches/" + b + "/expenses", id, o, "update", summary);
}
async function feeUpdate(id, patch, summary) {
  var b = curBranch();
  var f = col("branches/" + b + "/fees").filter(function (x) {
    return x.id === id;
  })[0];
  if (!f) return false;
  var o = Object.assign({}, f);
  delete o.id;
  for (var k in patch) o[k] = patch[k];
  var ok = await put("branches/" + b + "/fees", id, o, "update", summary);
  if (ok) await recomputeBadge(b, f.memberId);
  return ok;
}
