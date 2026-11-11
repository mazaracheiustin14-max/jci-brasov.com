/* Calcule: rapoarte, valabilitate, verificări (pilotul vechi) */
function activeRows(p) {
  return col(p).filter(function (x) {
    return !x.anulat;
  });
}
function memberName(b, mid) {
  var m = col("branches/" + b + "/members").filter(function (x) {
    return x.id === mid;
  })[0];
  return m ? m.name : "Membru șters";
}
function getSettings(b) {
  var st =
    col("branches/" + b + "/settings").filter(function (x) {
      return x.id === "main";
    })[0] || {};
  return { opening: st.opening || 0, feeDue: st.feeDue || 30000, id: "main" };
}
function report(b) {
  var fees = activeRows("branches/" + b + "/fees"),
    don = activeRows("branches/" + b + "/donations"),
    exp = activeRows("branches/" + b + "/expenses");
  var st = getSettings(b);
  var opening = st.opening || 0;
  var r = {
    opening: opening,
    incasat: 0,
    avansTotal: 0,
    creanta: 0,
    restanti: [],
    donN: 0,
    donA: 0,
    cheltPlatit: 0,
    angajat: 0,
    pe: {},
    nrCreanta: 0,
    nrFees: fees.length,
    nrPlatite: 0,
    avansRec: 0,
  };
  var t = today();
  fees.forEach(function (f) {
    if (f.state === "platita") {
      r.incasat += f.paid || 0;
      r.nrPlatite++;
    } else if (f.state === "avans") {
      r.avansTotal += f.paid || 0;
      r.nrPlatite++;
      if (f.recovered) {
        r.avansRec += f.paid || 0;
      } else {
        r.creanta += f.paid || 0;
        r.nrCreanta++;
      }
    } else if (f.state === "neplatita" && f.deadline && f.deadline < t) {
      r.restanti.push(f);
    }
  });
  don.forEach(function (d) {
    if (d.anonymous) r.donA += d.amount;
    else r.donN += d.amount;
  });
  exp.forEach(function (e) {
    if (e.state === "platita") {
      r.cheltPlatit += e.amount;
      r.pe[e.category] = (r.pe[e.category] || 0) + e.amount;
    } else if (e.state === "aprobata") {
      r.angajat += e.amount;
    }
  });
  r.donatii = r.donN + r.donA;
  r.restSum = r.restanti.reduce(function (s, f) {
    return s + (f.due - (f.paid || 0));
  }, 0);
  r.sold = opening + r.incasat + r.donatii - r.cheltPlatit;
  r.disponibil = r.sold - r.angajat;
  return r;
}
function fracWarn(b, e) {
  if (!e.supplier || e.amount > THRESH) return false;
  var d0 = new Date(e.date || today()).getTime();
  var sum = e.amount;
  activeRows("branches/" + b + "/expenses").forEach(function (x) {
    if (x.id === e.id || !x.supplier || x.state === "respinsa") return;
    if (norm(x.supplier) === norm(e.supplier)) {
      var dt = new Date(x.date || today()).getTime();
      if (Math.abs(dt - d0) <= 30 * 864e5) sum += x.amount;
    }
  });
  return sum > THRESH;
}
function isOver(e) {
  return e.amount > THRESH || !!e.fractionat;
}
async function recomputeBadge(b, memberId, memObj, over) {
  if (S.server) return;
  var m =
    memObj ||
    col("branches/" + b + "/members").filter(function (x) {
      return x.id === memberId;
    })[0];
  if (!m || !m.userId) return;
  var vu = memberValidUntil(b, Object.assign({}, m, { id: memberId }), over);
  var exc = vu ? addMonths(vu, 3) < today() : false;
  await put(
    "badges",
    m.userId,
    { verified: true, active: !!vu && vu >= today(), validUntil: vu, excluded: exc, branch: b },
    "badge",
    "Insignă actualizată pentru " + m.name,
  );
}

/* ---- verificare automata a cererilor cu cod si excludere automata ---- */
async function verifyClaim(b, code, c) {
  var t = today();
  if (code.used) {
    await put("claims", c.id, Object.assign(stripId(c), { status: "Cod deja folosit" }), "claim", "Cerere cu cod deja folosit");
    return;
  }
  if (code.expiresAt && code.expiresAt < t) {
    await put("claims", c.id, Object.assign(stripId(c), { status: "Cod expirat" }), "claim", "Cerere cu cod expirat");
    return;
  }
  var m = col("branches/" + b + "/members").filter(function (x) {
    return x.id === code.memberId;
  })[0];
  if (!m) {
    await put(
      "claims",
      c.id,
      Object.assign(stripId(c), { status: "Membrul nu mai există în evidență" }),
      "claim",
      "Cerere fără membru în evidență",
    );
    return;
  }
  var mo = stripId(m);
  mo.userId = c.id;
  mo.validUntil = code.validUntil || m.validUntil || defaultValid();
  if (!(await put("branches/" + b + "/members", m.id, mo, "update", "Cont legat prin cod: " + m.name))) return;
  await recomputeBadge(b, m.id, Object.assign({ id: m.id }, mo));
  await put(
    "branches/" + b + "/codes",
    code.id,
    Object.assign(stripId(code), { used: true, usedBy: c.id, usedAt: t }),
    "code",
    "Cod folosit de " + m.name,
  );
  await put(
    "claims",
    c.id,
    Object.assign(stripId(c), { processed: true, status: "Verificat", branch: b, memberId: m.id, name: m.name }),
    "claim",
    "Membru verificat prin cod: " + m.name,
  );
}
S.auto = {};
async function autoProcess() {
  if (S.server || S.mode !== "ready" || !isLead() || !canWrite() || S._busy) return;
  S._busy = true;
  try {
    var claims = col("claims").slice();
    for (var i = 0; i < claims.length; i++) {
      var c = claims[i];
      if (!c.code || c.processed) continue;
      var key = "c:" + c.id + ":" + c.code;
      if (S.auto[key]) continue;
      var bs = scopeBranches();
      for (var k = 0; k < bs.length; k++) {
        var code = col("branches/" + bs[k] + "/codes").filter(function (x) {
          return x.id === c.code;
        })[0];
        if (code) {
          S.auto[key] = 1;
          await verifyClaim(bs[k], code, c);
          break;
        }
      }
    }
    var scope = scopeBranches();
    for (var j = 0; j < scope.length; j++) {
      var ms = col("branches/" + scope[j] + "/members");
      for (var q = 0; q < ms.length; q++) {
        var m = ms[q];
        if (!m.userId) continue;
        var bd = badgeOf(m.userId);
        if (bd && bd.verified && !bd.excluded && badgeState(bd) === "excluded") {
          var k2 = "x:" + m.userId + ":" + bd.validUntil;
          if (S.auto[k2]) continue;
          S.auto[k2] = 1;
          await put(
            "badges",
            m.userId,
            Object.assign(stripId(bd), { excluded: true, active: false }),
            "exclusion",
            "Exclus automat din aplicație: " + m.name + " (peste 3 luni de la expirare)",
          );
        }
      }
    }
  } catch (e) {
  } finally {
    S._busy = false;
  }
}
