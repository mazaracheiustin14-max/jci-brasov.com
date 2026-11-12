/* Starea aplicației, roluri, abonări la date, jurnal */
var S = {
  server: false,
  store: null,
  me: null,
  mode: "loading",
  D: {},
  err: {},
  tab: "director",
  branch: "Brașov",
  q: "",
  fb: "Toate",
  fd: "Toate",
  sel: null,
  feeFilter: "Toate",
  feeView: "fees",
  bsub: "tablou",
  evView: "list",
  expFilter: "Toate",
  theme: null,
  note: "",
  nm: {} /* nume învățate în sesiune (liste de candidați, persoane numite), pentru conturi fără profil citibil */,
};

S.server =
  !(window.claude && typeof window.claude.use === "function") &&
  /^\/app(\/|$)/.test(location.pathname) &&
  !/(^|[?&])(demo|ui)(=|&|$)/.test(location.search.slice(1));
function lsGet(k) {
  try {
    return localStorage.getItem(k);
  } catch (e) {
    return null;
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch (e) {}
}

function myRole() {
  var me = S.me;
  if (!me) return { role: "member", branch: "", title: "" };
  var r = (S.D.roles || []).filter(function (x) {
    return x.id === me.id;
  })[0];
  if (r) return { role: r.role, branch: r.branch || "", title: r.title || "" };
  if (me.isOwner) return { role: "mod", branch: "", title: "" };
  return { role: "member", branch: "", title: "" };
}
/* Funcția afișată: titlul din rol, dacă există, altfel denumirea implicită. */
function roleTitle(r) {
  return (r && r.title) || ROLE_LABEL[r && r.role] || "";
}
function canWrite() {
  var r = myRole().role;
  return r === "president" || r === "treasurer";
}
function isMod() {
  return myRole().role === "mod";
}
function isNational() {
  return myRole().role === "national";
}
/* Rolul unui membru din evidența filialei: în server cheia rolului e id-ul membrului, în demonstrativ e id-ul contului. */
function roleOfMember(m) {
  return (
    (S.D.roles || []).filter(function (x) {
      return x.id === m.id || (m.userId && x.id === m.userId);
    })[0] || null
  );
}
function isSelf(m) {
  return !!S.me && (m.id === S.me.id || m.userId === S.me.id);
}
var WRITE_ACTS = {
  newfee: 1,
  newdon: 1,
  newexp: 1,
  feepaid: 1,
  feerec: 1,
  feecancel: 1,
  doncancel: 1,
  expcancel: 1,
  expreject: 1,
  expappr: 1,
  exppay: 1,
};
/* Conducerea care lucrează cu evidența filialei: președinte și trezorier. */
function isLead() {
  var r = myRole().role;
  return r === "president" || r === "treasurer";
}
function isBoard() {
  return myRole().role === "board";
}
/* Intră prin ecranul de acorduri și profil: toți, în afară de administratorul tehnic și de conducerea cu evidență. */
function needsGate() {
  return !isMod() && !isLead();
}
function scopeBranches() {
  var r = myRole();
  return (r.role === "president" || r.role === "treasurer" || r.role === "board") && r.branch ? [r.branch] : [];
}
function curBranch() {
  var sb = scopeBranches();
  return sb.indexOf(S.branch) >= 0 ? S.branch : sb[0] || "";
}
function myProfile() {
  return (S.D.profiles || []).filter(function (p) {
    return S.me && p.id === S.me.id;
  })[0];
}
function badgeState(b) {
  if (!b || !b.verified) return "none";
  var t = today();
  if (b.excluded === true) return "excluded";
  if (b.validUntil) {
    if (addMonths(b.validUntil, 3) < t) return "excluded";
    if (b.validUntil < t) return "grace";
    return "active";
  }
  return b.active ? "active" : "grace";
}
function feeList(b, over) {
  var list = col("branches/" + b + "/fees").map(function (x) {
    return over && over[x.id] ? Object.assign({}, over[x.id], { id: x.id }) : x;
  });
  Object.keys(over || {}).forEach(function (id) {
    if (
      !list.some(function (x) {
        return x.id === id;
      })
    )
      list.push(Object.assign({}, over[id], { id: id }));
  });
  return list.filter(function (x) {
    return !x.anulat;
  });
}
function memberValidUntil(b, m, over) {
  var vu = m.validUntil || "";
  feeList(b, over).forEach(function (f) {
    if (f.memberId === m.id && (f.state === "platita" || f.state === "avans" || f.state === "scutita")) {
      var e = f.year + "-12-31";
      if (e > vu) vu = e;
    }
  });
  return vu;
}
function memberValidity(b, m) {
  var vu = memberValidUntil(b, m);
  var t = today();
  if (!vu) return { vu: "", state: "necunoscut" };
  var ex = addMonths(vu, 3);
  if (ex < t) return { vu: vu, ex: ex, state: "excluded" };
  if (vu < t) return { vu: vu, ex: ex, state: "grace" };
  if (vu <= addDays(t, 30)) return { vu: vu, ex: ex, state: "soon" };
  return { vu: vu, ex: ex, state: "active" };
}
function badgeOf(id) {
  return (S.D.badges || []).filter(function (b) {
    return b.id === id;
  })[0];
}
function nameOf(id) {
  var r = (S.D.roles || []).filter(function (x) {
    return x.id === id;
  })[0];
  if (r && r.name) return r.name;
  var p = (S.D.profiles || []).filter(function (x) {
    return x.id === id;
  })[0];
  if (p) return p.name;
  var rm = null;
  BRANCHES.forEach(function (b) {
    (S.D["branches/" + b + "/members"] || []).forEach(function (m) {
      if (m.id === id || m.userId === id) rm = m;
    });
  });
  if (rm) return rm.name;
  if (S.nm[id]) return S.nm[id];
  if (S.me && id === S.me.id && S.me.isOwner) return ROLE_LABEL.mod;
  return r ? roleTitle(r) : "necunoscut";
}
function donorName(d) {
  return d.anonymous ? "Donator anonim" : d.donor;
}
function col(p) {
  return S.D[p] || [];
}

var subbed = {};
function sub(path) {
  if (subbed[path]) return;
  subbed[path] = true;
  S.store.sub(path, function (rows, e) {
    if (e) {
      S.err[path] = true;
    } else {
      S.D[path] = rows;
      delete S.err[path];
    }
    if (path === "branchlist" && rows) syncBranches(rows);
    if ((path === "badges" || path === "profiles") && rows) ensureAppSubs();
    if (path === "roles" && rows) {
      var sig = myRole().role + "|" + myRole().branch;
      if (S._sig && S._sig !== sig) {
        /* funcția mea s-a schimbat (predare, retragere): abonările se refac după noul rol */
        S._sig = sig;
        setTimeout(subscribeAll, 0);
        return;
      }
      S._sig = sig;
      ensureAppSubs();
    }
    schedule();
  });
}
/* branchlist -> BRANCHES: aceeași variabilă, rescrisă pe loc, în ordine alfabetică */
function syncBranches(rows) {
  var names = rows
    .map(function (x) {
      return String(x.name || "");
    })
    .filter(Boolean)
    .sort(function (a, c) {
      return norm(a) < norm(c) ? -1 : norm(a) > norm(c) ? 1 : 0;
    });
  BRANCHES.length = 0;
  names.forEach(function (n) {
    BRANCHES.push(n);
  });
}
/* Filiala mea: din rol, din cont (server), din insigna sau din profil (demonstrativ). */
function myBranchName() {
  var r = myRole();
  if (r.branch) return r.branch;
  if (!S.me) return "";
  if (S.me.branch) return S.me.branch;
  var b = badgeOf(S.me.id);
  if (b && b.branch) return b.branch;
  var p = myProfile();
  return (p && p.branch) || "";
}
/* Abonările după rol: evidența conducerii, apoi evenimentele și voturile filialei mele. */
function ensureAppSubs() {
  ensureLeadSubs();
  if (!S.me) return;
  var rl = myRole().role;
  if (rl === "mod") return;
  if (rl === "national" || rl === "president") sub("polls");
  var b = myBranchName();
  if (!b) return;
  sub("branches/" + b + "/events");
  sub("branches/" + b + "/attend");
  if (rl !== "national") sub("branches/" + b + "/polls");
}
function ensureLeadSubs() {
  var rl = myRole().role;
  if (rl === "mod" || rl === "national") {
    sub("audit");
    return;
  }
  if (rl === "board") {
    scopeBranches().forEach(function (b) {
      sub("branches/" + b + "/donations");
      sub("branches/" + b + "/expenses");
    });
    return;
  }
  if (!isLead()) return;
  if (!S.server) sub("claims");
  sub("audit");
  scopeBranches().forEach(function (b) {
    ["members", "fees", "donations", "expenses", "settings"].concat(S.server ? [] : ["codes"]).forEach(function (c) {
      sub("branches/" + b + "/" + c);
    });
  });
}
function subscribeAll() {
  S.store.reset();
  S.D = {};
  S.err = {};
  subbed = {};
  S._sig = "";
  sub("branchlist");
  sub("profiles");
  sub("badges");
  sub("roles");
  if (S.me) sub("data/users/" + S.me.id);
  ensureAppSubs();
}
function fixGateTop() {
  var g = document.querySelector(".demo-bar+.gate .gate-top"),
    bar = document.querySelector(".demo-bar");
  if (g && bar) g.style.top = bar.offsetHeight + "px";
}
try {
  new MutationObserver(fixGateTop).observe(document.getElementById("app"), { childList: true });
} catch (e) {}
window.addEventListener("resize", fixGateTop);
var _raf = 0;
function schedule() {
  if (_raf) return;
  _raf = setTimeout(function () {
    _raf = 0;
    render();
  }, 30);
}

async function audit(path, id, action, summary, changes) {
  await S.store.set("audit", uid(), {
    at: new Date().toISOString(),
    by: S.me.id,
    byName: nameOf(S.me.id),
    path: path,
    docId: id,
    action: action,
    summary: summary,
    changes: changes || [],
  });
}
function diffDoc(path, id, obj) {
  var prev = col(path).filter(function (x) {
    return x.id === id;
  })[0];
  if (!prev) return [{ f: "(document nou)", o: "", n: "" }];
  var ch = [];
  Object.keys(obj).forEach(function (k) {
    var pa = prev[k] == null ? "" : prev[k],
      pb = obj[k] == null ? "" : obj[k];
    if (JSON.stringify(pa) !== JSON.stringify(pb)) ch.push({ f: k, o: String(pa).slice(0, 60), n: String(pb).slice(0, 60) });
  });
  return ch;
}
async function put(path, id, obj, action, summary) {
  var ch = diffDoc(path, id, obj);
  try {
    await S.store.set(path, id, obj);
  } catch (e) {
    toast(
      S.server && e && e.message && !/^http /.test(e.message)
        ? e.message
        : "Scrierea a fost refuzată. Verifică nivelul de acces al contului.",
    );
    return false;
  }
  try {
    await audit(path, id, action, summary, ch);
  } catch (e) {
    toast("Atenție: modificarea a fost salvată, dar jurnalul nu a putut fi scris. Notează-o separat.");
  }
  return true;
}

/* Operații de structură: POST /api/app/admin. La succes reîmprospătează datele și întoarce răspunsul; la eroare arată mesajul și întoarce null. */
async function adminOp(body) {
  if (!S.server) {
    toast("În modul demonstrativ, structura nu se poate modifica.");
    return null;
  }
  var r;
  try {
    r = await svPost("/api/app/admin", body);
  } catch (e) {
    toast("Nu am putut contacta serverul. Încearcă din nou.");
    return null;
  }
  if (r.status === 401) {
    location.reload();
    return null;
  }
  if (r.status !== 200 || !r.body || r.body.error) {
    toast((r.body && r.body.error) || "Operația a fost refuzată.");
    return null;
  }
  await safe(function () {
    return S.store.refresh();
  });
  return r.body;
}
