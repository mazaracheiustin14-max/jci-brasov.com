/* Voturi: naționale (votează președinții de filiale) și de adunare generală (votează membrii filialei).
   Votul e secret: serverul nu trimite cine ce a votat, iar totalurile apar doar după închidere. */
function pollPaths() {
  var r = myRole().role,
    b = myBranchName(),
    out = [];
  if (r === "national" || r === "president") out.push("polls");
  if (b && r !== "national" && r !== "mod") out.push("branches/" + b + "/polls");
  return out;
}
function pollScope(path) {
  return path === "polls" ? "Președinții de filiale" : "Adunarea generală, " + myBranchName();
}
/* Naționale: doar președintele național; de adunare generală: doar președintele filialei. */
function canCreatePoll(path) {
  var r = myRole().role;
  return path === "polls" ? r === "national" : r === "president";
}
function findPoll(id) {
  var paths = pollPaths();
  for (var i = 0; i < paths.length; i++) {
    var p = col(paths[i]).filter(function (x) {
      return x.id === id;
    })[0];
    if (p) return { p: p, path: paths[i] };
  }
  return null;
}
/* Modul demonstrativ: starea votului se calculează local, din câmpul votes al documentului. */
function demoPoll(p, path) {
  var votes = p.votes || {};
  var r = myRole().role;
  var closed = !!p.closed || !!p.cancelled || String(p.closes) < today();
  var voters =
    path === "polls"
      ? col("roles").filter(function (x) {
          return x.role === "president";
        }).length
      : (S.D.profiles || []).filter(function (x) {
          var bd = badgeOf(x.id);
          var rl = roleOfMember({ id: x.id });
          return x.branch === myBranchName() && !!bd && bd.verified && bd.excluded !== true && !(rl && rl.role === "national");
        }).length;
  var v = {
    state: closed ? "closed" : "open",
    mine: votes[S.me.id] || "",
    canVote: path === "polls" ? r === "president" : r !== "national" && r !== "mod",
    total: Object.keys(votes).length,
    voters: voters,
    options: p.options.map(function (o) {
      var n = 0;
      Object.keys(votes).forEach(function (k) {
        if (votes[k] === o.id) n++;
      });
      return closed ? { id: o.id, label: o.label, votes: n } : { id: o.id, label: o.label };
    }),
  };
  if (p.createdBy === S.me.id) v.votedNames = Object.keys(votes).map(nameOf);
  return v;
}
function pollCard(p, path) {
  var v = p.state !== undefined ? p : demoPoll(p, path);
  var creator = p.createdBy === S.me.id || v.votedNames !== undefined;
  var open = v.state === "open" && !p.cancelled;
  var extra = "";
  if (creator) {
    extra =
      '<div class="acts" style="margin-top:12px">' +
      (open
        ? '<button class="btn sm sec" data-act="pollclose" data-id="' +
          esc(p.id) +
          '">Închide votul acum</button><button class="btn sm crit" data-act="pollcancel" data-id="' +
          esc(p.id) +
          '">Anulează votul</button>'
        : "") +
      '<button class="btn sm sec" data-act="pollwho" data-id="' +
      esc(p.id) +
      '">Cine a votat</button></div>';
  }
  return uiPoll({
    id: p.id,
    title: p.title,
    cancelled: !!p.cancelled,
    scope: pollScope(path),
    closes: p.closes,
    state: p.cancelled ? "closed" : v.state,
    voted: v.mine || "",
    canVote: !!v.canVote && !p.cancelled,
    showResults: v.state === "closed" && !p.cancelled,
    voters: v.voters,
    options: v.options,
    extra: extra,
  });
}
function vVotes() {
  var paths = pollPaths();
  var h = '<div class="page-head"><h1>Voturi</h1></div>';
  if (!paths.length) return h + emptyBox("Niciun vot disponibil", "Contul tău nu e legat încă de o filială.", "", "");
  paths.forEach(function (path) {
    var title = path === "polls" ? "Voturi naționale" : pollScope(path);
    h += uiSection(
      title,
      canCreatePoll(path) ? '<button class="btn sm" data-act="pollnew" data-id="' + esc(path) + '">Vot nou</button>' : "",
    );
    if (S.err[path]) {
      h += '<p class="small">Nu am putut încărca voturile. Reîncarcă pagina.</p>';
      return;
    }
    var list = col(path)
      .filter(function (p) {
        return !p.cancelled || p.createdBy === S.me.id;
      })
      .sort(function (a, c) {
        var ao = !a.closed && String(a.closes) >= today(),
          co = !c.closed && String(c.closes) >= today();
        if (ao !== co) return ao ? -1 : 1;
        return ao ? (a.closes < c.closes ? -1 : 1) : a.closes < c.closes ? 1 : -1;
      });
    h += list.length
      ? '<div class="list">' +
        list
          .map(function (p) {
            return pollCard(p, path);
          })
          .join("") +
        "</div>"
      : '<p class="small" style="margin-bottom:16px">Niciun vot deocamdată.</p>';
  });
  return h;
}

/* Votarea: formularul uiPoll are data-poll = id-ul votului */
async function castVote(pollId, optionId) {
  var f = findPoll(pollId);
  if (!f) return;
  if (!optionId) {
    toast("Alege o opțiune.");
    return;
  }
  if (S.server) {
    var r;
    try {
      r = await svPost("/api/app/vote", { path: f.path, pollId: pollId, optionId: String(optionId) });
    } catch (e) {
      toast("Nu am putut contacta serverul. Încearcă din nou.");
      return;
    }
    if (r.status !== 200) {
      toast((r.body && r.body.error) || "Votul nu a fost înregistrat.");
      return;
    }
    await safe(function () {
      return S.store.refresh();
    });
  } else {
    var votes = Object.assign({}, f.p.votes || {});
    votes[S.me.id] = String(optionId);
    var o = stripId(f.p);
    o.votes = votes;
    await S.store.set(f.path, pollId, o);
  }
  toast("Votul tău a fost înregistrat.");
}
document.addEventListener("submit", function (ev) {
  var f = ev.target && ev.target.closest ? ev.target.closest("form.poll-f") : null;
  if (!f || S.mode === "ui") return;
  ev.preventDefault();
  castVote(f.getAttribute("data-poll"), new FormData(f).get("opt"));
});

/* Documentul de scris: doar câmpurile permise (după primul vot, titlul și opțiunile nu se mai schimbă). */
function pollDoc(p, patch) {
  var o = {
    title: p.title,
    options: p.options.map(function (x) {
      return { id: x.id, label: x.label };
    }),
    closes: p.closes,
    closed: !!p.closed,
    cancelled: !!p.cancelled,
  };
  if (!S.server) Object.assign(o, { createdBy: p.createdBy, createdAt: p.createdAt, votes: p.votes || {} });
  return Object.assign(o, patch || {});
}
async function savePoll(path, id, o) {
  try {
    await S.store.set(path, id, o);
    return true;
  } catch (e) {
    toast(e && e.message && !/^http /.test(e.message) ? e.message : "Nu am putut salva. Încearcă din nou.");
    return false;
  }
}
function sheetPollNew(path) {
  openSheet(
    '<h2>Vot nou</h2><p class="small">' +
      esc(pollScope(path)) +
      " votează. Votul e secret: totalurile apar după închidere. După primul vot, întrebarea și opțiunile nu se mai pot schimba.</p><form>" +
      inp("title", "Întrebarea", "", "text", "pl_t", 'maxlength="200" autocomplete="off"') +
      '<div class="field"><label for="pl_o">Opțiunile, câte una pe rând (între 2 și 8)</label><textarea id="pl_o" name="options"></textarea></div>' +
      inp("closes", "Data închiderii", addDays(today(), 7), "date", "pl_d") +
      errActs("Creează votul"),
    async function (fd) {
      var title = String(fd.get("title") || "").trim();
      var lines = String(fd.get("options") || "")
        .split(/\r?\n/)
        .map(function (x) {
          return x.trim();
        })
        .filter(Boolean);
      var closes = String(fd.get("closes") || "");
      if (title.length < 4 || title.length > 200) return fieldErr("Întrebarea are între 4 și 200 de caractere.");
      if (lines.length < 2 || lines.length > 8) return fieldErr("Scrie între 2 și 8 opțiuni, câte una pe rând.");
      if (
        lines.some(function (x) {
          return x.length > 80;
        })
      )
        return fieldErr("O opțiune are cel mult 80 de caractere.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(closes) || closes < today()) return fieldErr("Alege o dată de închidere de azi înainte.");
      var o = {
        title: title,
        options: lines.map(function (l, i) {
          return { id: "o" + (i + 1), label: l };
        }),
        closes: closes,
        closed: false,
        cancelled: false,
      };
      if (!S.server) Object.assign(o, { createdBy: S.me.id, createdAt: new Date().toISOString(), votes: {} });
      if (await savePoll(path, uid(), o)) {
        closeSheet();
        toast("Votul a fost creat.");
      }
    },
  );
}
async function doPollClose(id) {
  var f = findPoll(id);
  if (!f) return;
  if (await savePoll(f.path, id, pollDoc(f.p, { closed: true }))) toast("Votul a fost închis.");
}
function sheetPollCancel(id) {
  var f = findPoll(id);
  if (!f) return;
  openSheet(
    "<h2>Anulează votul</h2><p>" +
      esc(f.p.title) +
      ' rămâne în listă, marcat ca anulat, și nu mai primește voturi.</p><div class="sheet-acts"><button class="btn crit" data-act="pollcancel2" data-id="' +
      esc(id) +
      '">Anulează votul</button><button class="btn sec" data-act="closesheet">Renunț</button></div>',
  );
}
async function doPollCancel(id) {
  var f = findPoll(id);
  if (!f) return;
  if (await savePoll(f.path, id, pollDoc(f.p, { cancelled: true }))) {
    closeSheet();
    toast("Votul a fost anulat.");
  }
}
/* Cine a votat: doar numele, fără opțiunea aleasă */
function sheetPollWho(id) {
  var f = findPoll(id);
  if (!f) return;
  var v = f.p.state !== undefined ? f.p : demoPoll(f.p, f.path);
  var names = (v.votedNames || []).map(function (x) {
    return typeof x === "string" ? x : x && x.name;
  });
  openSheet(
    '<h2>Cine a votat</h2><p class="small">' +
      esc(f.p.title) +
      "</p>" +
      (names.length
        ? '<div class="list">' +
          names
            .map(function (n) {
              return row({ avatar: n, title: n, meta: "A votat" });
            })
            .join("") +
          "</div>"
        : '<p class="small">Nimeni nu a votat încă.</p>') +
      '<p class="help">Lista arată doar cine a votat, nu și ce a ales.</p><div class="sheet-acts"><button class="btn sec" data-act="closesheet">Închide</button></div>',
  );
}
