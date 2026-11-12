/* Evenimente: lista filialei mele, participarea fiecăruia, ce a făcut la eveniment, contorul pe persoană.
   Datele: branches/<filiala>/events și branches/<filiala>/attend (id = <eveniment>_<membru>). Drepturile le verifică serverul. */
function evPath() {
  return "branches/" + myBranchName() + "/events";
}
function atPath() {
  return "branches/" + myBranchName() + "/attend";
}
/* Creează și editează evenimente: președintele și conducerea de tip „altă funcție” (board). */
function isEvManager() {
  var r = myRole().role;
  return r === "president" || r === "board";
}
/* Conducerea filialei: vede participarea tuturor. */
function isBranchLeadership() {
  var r = myRole().role;
  return r === "president" || r === "treasurer" || r === "board";
}
function evPast(e) {
  return String(e.date || "") < today();
}
function evById(id) {
  return (
    col(evPath()).filter(function (e) {
      return e.id === id;
    })[0] || null
  );
}
function myAttend(eid) {
  return (
    col(atPath()).filter(function (x) {
      return x.eventId === eid && x.memberId === S.me.id;
    })[0] || null
  );
}
function attRowsOf(eid) {
  return col(atPath()).filter(function (x) {
    return x.eventId === eid && x.going;
  });
}
/* Contorul pe eveniment: serverul îl trimite ca count; în demonstrativ se numără local. */
function evCount(e) {
  return e.count != null ? e.count : attRowsOf(e.id).length;
}
/* Rândurile cu participare la evenimente trecute și neanulate, ale unui membru. */
function pastGoing(mid) {
  return col(atPath()).filter(function (x) {
    if (x.memberId !== mid || !x.going) return false;
    var e = evById(x.eventId);
    return !!e && !e.cancelled && evPast(e);
  });
}
function attName(r) {
  return r.name || nameOf(r.memberId);
}
function memberKey(m) {
  return S.server ? m.id : m.userId || m.id;
}
function didText(r) {
  return (r.did || "") + (r.amount ? (r.did ? " | " : "") + fmt(r.amount) + " RON" : "");
}
function saveErr(e) {
  toast(e && e.message && !/^http /.test(e.message) ? e.message : "Nu am putut salva. Încearcă din nou.");
}
async function saveAttend(eid, mid, o) {
  try {
    await S.store.set(atPath(), eid + "_" + mid, o);
    return true;
  } catch (e) {
    saveErr(e);
    return false;
  }
}
async function saveEvent(id, o) {
  try {
    await S.store.set(evPath(), id, o);
    return true;
  } catch (e) {
    saveErr(e);
    return false;
  }
}

function vEvents() {
  var b = myBranchName();
  var lead = isBranchLeadership();
  var h =
    '<div class="page-head"><h1>Evenimente</h1>' +
    (isEvManager() ? '<button class="btn sm" data-act="newev">Adaugă eveniment</button>' : "") +
    "</div>";
  if (!b) return h + emptyBox("Nicio filială", "Contul tău nu e legat încă de o filială.", "", "");
  if (S.err[evPath()])
    return h + emptyBox("Nu am putut încărca evenimentele", "Verifică conexiunea la internet și încearcă din nou.", "Reîncarcă", "retry");
  if (lead)
    h += uiChips(
      [
        ["list", "Evenimente"],
        ["part", "Participare"],
      ],
      S.evView,
      "evv",
    );
  if (lead && S.evView === "part") return h + vParticipation();
  var n = pastGoing(S.me.id).length;
  h += '<div class="notice info">Ai participat la ' + n + (n === 1 ? " eveniment." : " evenimente.") + "</div>";
  var mgr = isEvManager();
  var evs = col(evPath()).filter(function (e) {
    return mgr || !e.cancelled;
  });
  function card(e) {
    var my = myAttend(e.id);
    var past = evPast(e) || !!e.cancelled;
    var going = !!(my && my.going) && !e.cancelled;
    return uiEvent({
      id: e.id,
      title: e.title + (e.cancelled ? " (anulat)" : ""),
      date: e.date,
      place: e.place,
      count: evCount(e),
      going: going,
      past: past,
      cancelled: !!e.cancelled,
      mine: going && past && my ? didText(my) : "",
      extra: going && past ? '<button class="btn sm sec" data-act="evdid" data-id="' + esc(e.id) + '">Ce am făcut</button>' : "",
      act: "evopen",
    });
  }
  var next = evs
    .filter(function (e) {
      return !e.cancelled && !evPast(e);
    })
    .sort(function (a, c) {
      return a.date < c.date ? -1 : 1;
    });
  var gone = evs
    .filter(function (e) {
      return e.cancelled || evPast(e);
    })
    .sort(function (a, c) {
      return a.date < c.date ? 1 : -1;
    });
  h += uiSection("Urmează");
  h += next.length
    ? '<div class="list">' + next.map(card).join("") + "</div>"
    : emptyBox("Niciun eveniment programat", "Evenimentele noi ale filialei apar aici.", mgr ? "Adaugă eveniment" : "", "newev");
  if (gone.length) h += uiSection("Au trecut") + '<div class="list">' + gone.map(card).join("") + "</div>";
  return h;
}

/* Participare (conducerea filialei): contorul pe persoană */
function vParticipation() {
  var rows = col(atPath());
  var ids = [];
  rows.forEach(function (r) {
    if (ids.indexOf(r.memberId) < 0) ids.push(r.memberId);
  });
  var people = ids
    .map(function (id) {
      var r0 = rows.filter(function (r) {
        return r.memberId === id;
      })[0];
      return { id: id, name: attName(r0), n: pastGoing(id).length };
    })
    .sort(function (a, c) {
      return c.n - a.n || (norm(a.name) < norm(c.name) ? -1 : 1);
    });
  var pastEvs = col(evPath()).filter(function (e) {
    return !e.cancelled && evPast(e);
  });
  var total = people.reduce(function (s, p) {
    return s + p.n;
  }, 0);
  var h = uiStats([
    { l: "Evenimente trecute", n: String(pastEvs.length) },
    { l: "Participări", n: String(total), s: "pe toate evenimentele" },
  ]);
  if (isEvManager()) h += '<div class="acts"><button class="btn sm" data-act="evpresence">Consemnează prezența</button></div>';
  h += uiSection("Participanți");
  h += people.length
    ? '<div class="list">' +
      people
        .map(function (p) {
          return row({
            act: "partm",
            id: p.id,
            avatar: p.name,
            title: p.name,
            meta: esc(p.n + (p.n === 1 ? " eveniment" : " evenimente")),
            right: '<span class="num"><b>' + p.n + "</b></span>",
          });
        })
        .join("") +
      "</div>"
    : emptyBox("Nicio participare înregistrată", "Participările membrilor apar aici.", "", "");
  return h;
}
function sheetPerson(mid) {
  var rows = pastGoing(mid).sort(function (a, c) {
    var ea = evById(a.eventId),
      ec = evById(c.eventId);
    return ea.date < ec.date ? 1 : -1;
  });
  var any = col(atPath()).filter(function (r) {
    return r.memberId === mid;
  })[0];
  openSheet(
    "<h2>" +
      esc(any ? attName(any) : nameOf(mid)) +
      '</h2><p class="small">' +
      rows.length +
      (rows.length === 1 ? " eveniment" : " evenimente") +
      "</p>" +
      (rows.length
        ? '<div class="list">' +
          rows
            .map(function (r) {
              var e = evById(r.eventId);
              return row({ title: e.title, meta: esc(dro(e.date) + " | " + (didText(r) || "fără mențiune")) });
            })
            .join("") +
          "</div>"
        : '<p class="small">Nicio participare la evenimente trecute.</p>') +
      '<div class="sheet-acts"><button class="btn sec" data-act="closesheet">Închide</button></div>',
  );
}

/* Participarea mea */
async function evGo(id) {
  var e = evById(id);
  if (!e || e.cancelled) return;
  var my = myAttend(id);
  var o = { eventId: id, memberId: S.me.id, going: !(my && my.going), did: my ? my.did || "" : "" };
  if (my && my.amount) o.amount = my.amount;
  await saveAttend(id, S.me.id, o);
}
function didFields(r) {
  return (
    '<div class="field"><label for="dd_t">Ce ai făcut</label><textarea id="dd_t" name="did" maxlength="300">' +
    esc(r ? r.did : "") +
    "</textarea></div>" +
    inp(
      "amount",
      "Sumă adusă sau cheltuită (RON, opțional)",
      r && r.amount ? String(r.amount / 100).replace(".", ",") : "",
      "text",
      "dd_a",
      'inputmode="decimal"',
    )
  );
}
function readDid(fd, eid, mid) {
  var did = String(fd.get("did") || "").trim();
  var raw = String(fd.get("amount") || "").trim();
  if (did.length > 300) return fieldErr("Textul are cel mult 300 de caractere.");
  var o = { eventId: eid, memberId: mid, going: true, did: did };
  if (raw) {
    var b = toBani(raw);
    if (isNaN(b)) return fieldErr("Introdu suma în lei, de exemplu 150,00.");
    o.amount = b;
  }
  return o;
}
function sheetDid(eid) {
  var e = evById(eid);
  if (!e) return;
  var my = myAttend(eid);
  openSheet(
    '<h2>Ce am făcut</h2><p class="small">' + esc(e.title) + "</p><form>" + didFields(my) + errActs("Salvează"),
    async function (fd) {
      var o = readDid(fd, eid, S.me.id);
      if (!o) return;
      if (await saveAttend(eid, S.me.id, o)) {
        closeSheet();
        toast("Modificările au fost salvate.");
      }
    },
  );
}

/* Foaia unui eveniment */
function sheetEventDetail(id) {
  var e = evById(id);
  if (!e) return;
  var lead = isBranchLeadership();
  var rows = lead ? attRowsOf(id) : [];
  var past = evPast(e);
  var h =
    "<h2>" +
    esc(e.title) +
    '</h2><p class="small">' +
    dro(e.date) +
    (e.place ? " | " + esc(e.place) : "") +
    (e.cancelled ? " | anulat" : "") +
    "</p>" +
    (e.note ? '<p style="margin:12px 0">' + esc(e.note) + "</p>" : "") +
    '<p class="small">' +
    evCount(e) +
    " participanți</p>";
  if (lead) {
    h += uiSection("Participanți");
    h += rows.length
      ? '<div class="list">' +
        rows
          .map(function (r) {
            return row({ avatar: attName(r), title: attName(r), meta: esc(didText(r) || "fără mențiune") });
          })
          .join("") +
        "</div>"
      : '<p class="small">Niciun participant înregistrat.</p>';
  }
  var acts = "";
  if (isEvManager() && !e.cancelled) {
    acts += '<button class="btn sec" data-act="evedit" data-id="' + esc(id) + '">Editează</button>';
    if (past) acts += '<button class="btn sec" data-act="evpresence" data-id="' + esc(id) + '">Consemnează prezența</button>';
    acts += '<button class="btn crit" data-act="evcancel" data-id="' + esc(id) + '">Anulează evenimentul</button>';
  }
  h +=
    (acts ? '<div class="acts" style="margin-top:12px">' + acts + "</div>" : "") +
    '<div class="sheet-acts"><button class="btn sec" data-act="closesheet">Închide</button></div>';
  openSheet(h);
}
function sheetEventForm(id) {
  var e = id ? evById(id) : null;
  openSheet(
    "<h2>" +
      (e ? "Editează evenimentul" : "Adaugă eveniment") +
      "</h2><form>" +
      inp("title", "Denumirea", e ? e.title : "", "text", "ev_t", 'maxlength="120" autocomplete="off"') +
      inp("date", "Data", e ? e.date : today(), "date", "ev_d") +
      inp("place", "Locul", e ? e.place : "", "text", "ev_p", 'maxlength="120" autocomplete="off"') +
      '<div class="field"><label for="ev_n">Descriere</label><textarea id="ev_n" name="note" maxlength="500">' +
      esc(e ? e.note : "") +
      "</textarea></div>" +
      errActs("Salvează"),
    async function (fd) {
      var title = String(fd.get("title") || "").trim();
      var date = String(fd.get("date") || "");
      var place = String(fd.get("place") || "").trim();
      var note = String(fd.get("note") || "").trim();
      if (title.length < 2 || title.length > 120) return fieldErr("Denumirea are între 2 și 120 de caractere.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fieldErr("Alege data evenimentului.");
      if (place.length > 120) return fieldErr("Locul are cel mult 120 de caractere.");
      if (note.length > 500) return fieldErr("Descrierea are cel mult 500 de caractere.");
      var o = { title: title, date: date, place: place, note: note, cancelled: e ? !!e.cancelled : false };
      /* id scurt: id-ul participării (<eveniment>_<membru>) are cel mult 64 de caractere, iar id-ul unui membru are 36 */
      var nid = id || uid().replace(/-/g, "").slice(0, 20);
      if (!S.server) {
        o.createdBy = e ? e.createdBy : S.me.id;
        o.createdAt = e ? e.createdAt : new Date().toISOString();
      }
      if (await saveEvent(nid, o)) {
        closeSheet();
        toast("Modificările au fost salvate.");
      }
    },
  );
}
function sheetEventCancel(id) {
  var e = evById(id);
  if (!e) return;
  openSheet(
    "<h2>Anulează evenimentul</h2><p>" +
      esc(e.title) +
      ' nu se șterge: rămâne în listă, marcat ca anulat, iar participările rămân consemnate.</p><div class="sheet-acts"><button class="btn crit" data-act="evcancel2" data-id="' +
      esc(id) +
      '">Anulează evenimentul</button><button class="btn sec" data-act="closesheet">Renunț</button></div>',
  );
}
async function doEventCancel(id) {
  var e = evById(id);
  if (!e) return;
  var o = { title: e.title, date: e.date, place: e.place || "", note: e.note || "", cancelled: true };
  if (!S.server) Object.assign(o, { createdBy: e.createdBy, createdAt: e.createdAt });
  if (await saveEvent(id, o)) {
    closeSheet();
    toast("Evenimentul a fost anulat.");
  }
}

/* Consemnarea prezenței unui membru la un eveniment trecut (președinte și conducere de tip board) */
function sheetPresence(eid) {
  var b = myBranchName();
  var evs = col(evPath())
    .filter(function (e) {
      return !e.cancelled && evPast(e);
    })
    .sort(function (a, c) {
      return a.date < c.date ? 1 : -1;
    });
  var people;
  if (myRole().role === "president") {
    people = col("branches/" + b + "/members")
      .filter(function (m) {
        return !m.excluded;
      })
      .sort(byName)
      .map(function (m) {
        return [memberKey(m), m.name];
      });
  } else {
    people = [];
    col(atPath()).forEach(function (r) {
      if (
        !people.some(function (p) {
          return p[0] === r.memberId;
        })
      )
        people.push([r.memberId, attName(r)]);
    });
  }
  if (!evs.length) {
    toast("Nu există evenimente trecute la care să consemnezi prezența.");
    return;
  }
  if (!people.length) {
    toast("Nu există membri în listă.");
    return;
  }
  openSheet(
    '<h2>Consemnează prezența</h2><p class="small">Pentru un membru care a fost la un eveniment trecut.</p><form>' +
      sel("memberId", people, "", "Membrul", "pr_m") +
      sel(
        "eventId",
        evs.map(function (e) {
          return [e.id, e.title + " (" + dro(e.date) + ")"];
        }),
        eid || evs[0].id,
        "Evenimentul",
        "pr_e",
      ) +
      didFields(null) +
      errActs("Salvează"),
    async function (fd) {
      var mid = String(fd.get("memberId") || "");
      var ev = String(fd.get("eventId") || "");
      if (!mid || !ev) return fieldErr("Alege membrul și evenimentul.");
      var o = readDid(fd, ev, mid);
      if (!o) return;
      if (await saveAttend(ev, mid, o)) {
        closeSheet();
        toast("Prezența a fost consemnată.");
      }
    },
  );
}
