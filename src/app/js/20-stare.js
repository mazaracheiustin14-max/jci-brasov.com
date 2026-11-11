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
  expFilter: "Toate",
  theme: null,
  note: "",
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
  if (!me) return { role: "member", branch: "" };
  var r = (S.D.roles || []).filter(function (x) {
    return x.id === me.id;
  })[0];
  if (r) return { role: r.role, branch: r.branch || "" };
  if (me.isOwner) return { role: "national", branch: "" };
  return { role: "member", branch: "" };
}
function canWrite() {
  var r = myRole().role;
  return r === "president" || r === "treasurer";
}
function canSeeRoles() {
  if (S.server) return !!(S.me && S.me.isOwner);
  return myRole().role === "national" || (S.me && S.me.isOwner);
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
function isLead() {
  var r = myRole().role;
  return r === "national" || r === "president" || r === "treasurer";
}
function scopeBranches() {
  var r = myRole();
  return r.role === "national" ? BRANCHES : r.branch ? [r.branch] : [];
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
  var p = (S.D.profiles || []).filter(function (x) {
    return x.id === id;
  })[0];
  if (p) return p.name;
  var r = (S.D.roles || []).filter(function (x) {
    return x.id === id;
  })[0];
  var rm = null;
  BRANCHES.forEach(function (b) {
    (S.D["branches/" + b + "/members"] || []).forEach(function (m) {
      if (m.id === id) rm = m;
    });
  });
  if (rm) return rm.name;
  if (S.me && id === S.me.id && S.me.isOwner) return "Moderator";
  return r ? ROLE_LABEL[r.role] : "necunoscut";
}
function donorName(d) {
  return d.anonymous ? "Donator anonim" : myRole().role === "national" ? "Donator (nume vizibil doar conducerii filialei)" : d.donor;
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
    if (path === "roles") ensureLeadSubs();
    schedule();
  });
}
function ensureLeadSubs() {
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
  sub("profiles");
  sub("badges");
  sub("roles");
  if (S.me) sub("data/users/" + S.me.id);
  ensureLeadSubs();
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
