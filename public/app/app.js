"use strict";
/* ===================== utilitare ===================== */
/* Lista vine din colecția branchlist (20-stare.js); se rescrie pe loc, ca variabila să rămână aceeași. */
var BRANCHES = [];
var DOMAINS = [
  "IT și tehnologie",
  "Juridic",
  "Contabilitate și finanțe",
  "Marketing și comunicare",
  "Medical",
  "Construcții și imobiliare",
  "Turism și HoReCa",
  "Educație și training",
  "Producție și comerț",
  "Alte domenii",
];
var CATS = [
  "Evenimente și proiecte",
  "Training și dezvoltare membri",
  "Cotizații și taxe către organizația națională",
  "Comunicare, promovare și materiale tipărite",
  "Deplasări și transport",
  "Cazare și participare la conferințe",
  "Servicii digitale",
  "Taxe bancare și comisioane",
  "Servicii profesionale",
  "Birotică și consumabile",
  "Protocol și reprezentare",
  "Acțiuni caritabile și implicare comunitară",
  "Alte cheltuieli",
];
var ROLE_LABEL = {
  mod: "Administrator",
  national: "Președinte național",
  president: "Președinte",
  treasurer: "Vicepreședinte trezorier",
  board: "Conducere",
  member: "Membru",
};
var FEE_STATE = {
  neplatita: ["Neplătită", "warn", "clock"],
  platita: ["Plătită", "good", "check"],
  avans: ["Plătită în avans de terț", "warn", "clock"],
  scutita: ["Scutită", "neutral", "check"],
};
var EXP_STATE = {
  propusa: ["Propusă", "warn", "clock"],
  aprobata: ["Aprobată", "good", "check2"],
  respinsa: ["Respinsă", "crit", "x"],
  platita: ["Plătită", "good", "check"],
  anulata: ["Anulată", "neutral", "x"],
};
var THRESH = 50000; /* 500 RON in bani, Art. 31 */
var CONSENT_VERSION = "2026-11-11";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function norm(s) {
  return String(s || "")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ţ/g, "t")
    .replace(/Ţ/g, "T")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
function fmt(b) {
  return (b / 100).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function toBani(s) {
  s = String(s == null ? "" : s).trim();
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+(,\d{1,2})?$/.test(s)) s = s.replace(",", ".");
  else if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  var n = Math.round(parseFloat(s) * 100);
  return isFinite(n) && n <= 100000000000 ? n : NaN;
}
function amtMsg(raw, b) {
  if (!String(raw == null ? "" : raw).trim()) return "Completează câmpul Suma.";
  if (isNaN(b)) return "Introdu suma în lei, de exemplu 1.250,50.";
  if (!(b > 0)) return "Suma trebuie să fie mai mare ca zero.";
  return "";
}
function safe(fn) {
  try {
    return Promise.resolve(fn()).catch(function () {});
  } catch (e) {
    return Promise.resolve();
  }
}
function today() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function addMonths(ds, n) {
  var p = String(ds).split("-");
  var y = +p[0],
    m = +p[1] - 1 + n,
    d = +p[2];
  var ny = y + Math.floor(m / 12),
    nm = ((m % 12) + 12) % 12;
  var last = new Date(ny, nm + 1, 0).getDate();
  return ny + "-" + String(nm + 1).padStart(2, "0") + "-" + String(Math.min(d, last)).padStart(2, "0");
}
function addDays(ds, n) {
  var d = new Date(ds + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function defaultValid() {
  return new Date().getFullYear() + "-12-31";
}
function normCode(c) {
  return String(c || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
var CODE_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode() {
  var a = new Uint32Array(12);
  try {
    crypto.getRandomValues(a);
  } catch (e) {
    for (var i = 0; i < 12; i++) a[i] = Math.floor(Math.random() * 4294967296);
  }
  var o = "";
  for (var j = 0; j < 12; j++) o += CODE_ALPHA.charAt(a[j] % 32);
  return o;
}
function fmtCode(c) {
  return String(c).replace(/(.{4})(?=.)/g, "$1-");
}
function stripId(o) {
  var r = Object.assign({}, o);
  delete r.id;
  return r;
}
function fmtAt(iso) {
  var d = new Date(iso);
  if (!iso || isNaN(d))
    return String(iso || "")
      .slice(0, 16)
      .replace("T", " ");
  function z(n) {
    return String(n).padStart(2, "0");
  }
  return z(d.getDate()) + "." + z(d.getMonth() + 1) + "." + d.getFullYear() + " " + z(d.getHours()) + ":" + z(d.getMinutes());
}
function dro(d) {
  if (!d) return "";
  d = String(d);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return esc(d);
  var p = d.split("-");
  return p[2] + "." + p[1] + "." + p[0];
}
function uid() {
  try {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  } catch (e) {}
  var a = "";
  for (var i = 0; i < 4; i++) a += Math.random().toString(36).slice(2, 8);
  return Date.now().toString(36) + a;
}
function initials(n) {
  var p = String(n || "?")
    .trim()
    .split(/\s+/);
  return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}
function safeHttps(u) {
  return /^https:\/\//i.test(u) ? u : "";
}
/* Setul de componente (UI kit): pictograme, rânduri, formulare, foaie, mesaje. Vezi src/app/README.md */
var ICON = {
  check: '<path d="M5 12l4 4 10-10"/>',
  check2: '<path d="M2 12l4 4 6-8M10 16l2 2 10-12"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  x: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  seal: '<circle cx="12" cy="10" r="6"/><path d="M8 15l-2 7 6-3 6 3-2-7"/>',
  dir: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-4 3-6 6.5-6s5.9 2 6.5 6M16 5.5a3.2 3.2 0 010 6M18 14c2 .6 3.3 2.3 3.5 5"/>',
  me: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/>',
  dash: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  fee: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/>',
  gift: '<rect x="3" y="9" width="18" height="12" rx="1"/><path d="M12 9v12M3 13h18M12 9c-3 0-5-1-5-3s3-3 5 3c2-6 5-5 5-3s-2 3-5 3"/>',
  spend: '<path d="M4 6h16M4 12h16M4 18h10"/><circle cx="19" cy="18" r="2"/>',
  out: '<path d="M10 4H5a1 1 0 00-1 1v14a1 1 0 001 1h5M15 8l4 4-4 4M19 12H9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  empty: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 10h8M8 14h5"/>',
};
var LOGO_SRC = "/app/logo.png?v=b4a1539125";
function logoHtml() {
  return (
    '<div class="logo" style="display:flex;align-items:center"><img src="' +
    LOGO_SRC +
    '" alt="JIB, JCI in Business" style="height:46px;width:auto;display:block"></div>'
  );
}
function svg(n, sz) {
  return (
    '<svg viewBox="0 0 24 24" width="' +
    (sz || 24) +
    '" height="' +
    (sz || 24) +
    '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    ICON[n] +
    "</svg>"
  );
}
function pill(map, key) {
  var m = map[key] || [key, "neutral", "check"];
  return '<span class="pill ' + m[1] + '">' + svg(m[2], 14) + esc(m[0]) + "</span>";
}
function toast(msg) {
  var t = document.getElementById("toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(function () {
    t.style.display = "none";
  }, 4000);
}
function emptyBox(title, text, btn, act) {
  if (/^new(fee|don|exp)$/.test(act) && !canWrite()) btn = "";
  return (
    '<div class="empty">' +
    svg("empty", 48) +
    "<h2>" +
    esc(title) +
    "</h2><p>" +
    esc(text) +
    "</p>" +
    (btn ? '<button class="btn" data-act="' + act + '">' + esc(btn) + "</button>" : "") +
    "</div>"
  );
}
function row(o) {
  var tag = o.act ? "button" : "div";
  return (
    "<" +
    tag +
    ' class="row ' +
    (o.stripe ? "stripe-" + o.stripe : "") +
    '" ' +
    (o.act ? 'data-act="' + o.act + '" data-id="' + esc(o.id || "") + '"' : "") +
    ">" +
    (o.avatar ? '<span class="avatar">' + esc(initials(o.avatar)) + "</span>" : "") +
    '<span class="grow"><h3>' +
    esc(o.title) +
    '</h3><span class="meta">' +
    o.meta +
    "</span></span>" +
    (o.right ? '<span class="val">' + o.right + "</span>" : "") +
    "</" +
    tag +
    ">"
  );
}
function openSheet(html, onSubmit) {
  var s = document.getElementById("sheet");
  s.innerHTML = html;
  /* un mesaj rămas pe ecran nu are voie să acopere foaia (de exemplu un cod abia generat) */
  document.getElementById("toast").style.display = "none";
  document.getElementById("sheetwrap").classList.add("open");
  var f = s.querySelector("form");
  if (f && onSubmit)
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      onSubmit(new FormData(f), f);
    });
  var first = s.querySelector("input,select,textarea,button");
  if (first && window.innerWidth > 700) first.focus();
}
function closeSheet() {
  document.getElementById("sheetwrap").classList.remove("open");
  document.getElementById("sheet").innerHTML = "";
}
function sel(name, opts, val, label, id) {
  return (
    '<div class="field"><label for="' +
    id +
    '">' +
    label +
    '</label><select class="f" id="' +
    id +
    '" name="' +
    name +
    '">' +
    opts
      .map(function (o) {
        var v = Array.isArray(o) ? o[0] : o,
          l = Array.isArray(o) ? o[1] : o;
        return '<option value="' + esc(v) + '"' + (String(v) === String(val) ? " selected" : "") + ">" + esc(l) + "</option>";
      })
      .join("") +
    "</select></div>"
  );
}
function inp(name, label, val, type, id, extra) {
  return (
    '<div class="field"><label for="' +
    id +
    '">' +
    label +
    '</label><input type="' +
    (type || "text") +
    '" id="' +
    id +
    '" name="' +
    name +
    '" value="' +
    esc(val == null ? "" : val) +
    '" ' +
    (extra || "") +
    "></div>"
  );
}
function fieldErr(msg) {
  var e = document.getElementById("sheeterr");
  if (e) {
    e.textContent = msg;
    e.setAttribute("role", "alert");
  }
  return false;
}
/* Setul de componente, partea a doua: piese pentru modulele noi (voturi, evenimente, registru de bani,
   mulțumiri de networking, reguli de filială, poză de profil). Funcții pure: primesc date, întorc HTML.
   Textele primite se trec prin esc() aici; parametrii al căror nume se termină în Html se pun ca atare.
   Catalogul vizual: /app?ui (js/80-catalog.js). Descrierea fiecărei piese: src/app/README.md */
Object.assign(ICON, {
  vote: '<path d="M4 12h16v8H4z"/><path d="M8 12V4h8v8"/><path d="M10 8l1.5 1.5L14 6.5"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  net: '<circle cx="6" cy="7" r="3"/><circle cx="18" cy="7" r="3"/><circle cx="12" cy="18" r="3"/><path d="M8.5 9l2 6.5M15.5 9l-2 6.5M9 7h6"/>',
  heart: '<path d="M12 20s-7-4.5-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.5-9 9-9 9z"/>',
  build: '<path d="M4 21V5l8-2v18M12 9l8 2v10M2 21h20M7 8v.5M7 12v.5M7 16v.5M16 14v.5M16 17v.5"/>',
  rules: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  bell: '<path d="M6 16v-5a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0"/>',
});
var MONTHS = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];

/* Avatar: inițiale sau poză. size: "" (40 px), "lg" (56 px), "xl" (96 px). */
function uiAvatar(name, photo, size) {
  return (
    '<span class="avatar' +
    (size ? " " + size : "") +
    '">' +
    (photo ? '<img src="' + esc(photo) + '" alt="" loading="lazy" decoding="async">' : esc(initials(name))) +
    "</span>"
  );
}
/* Etichetă scurtă. tone: good | warn | crit | neutral | brand (funcții de conducere). icon: nume din ICON, opțional. */
function uiTag(text, tone, icon) {
  return '<span class="pill ' + (tone || "neutral") + '">' + (icon ? svg(icon, 14) : "") + esc(text) + "</span>";
}
/* Titlu de secțiune, cu un buton sau o etichetă în dreapta (rightHtml, opțional). */
function uiSection(title, rightHtml) {
  return '<div class="sec-h' + (rightHtml ? " split" : "") + '"><h2>' + esc(title) + "</h2>" + (rightHtml || "") + "</div>";
}
/* Cifra principală a unui ecran. bani: sumă în bani (întreg), afișată în RON. */
function uiHero(label, bani, sub) {
  return (
    '<div class="hero"><div class="l">' +
    esc(label) +
    '</div><div class="n">' +
    fmt(bani) +
    " <small>RON</small></div>" +
    (sub ? '<div class="s">' + esc(sub) + "</div>" : "") +
    "</div>"
  );
}
/* Grilă de cifre. items: [{ l: etichetă, n: valoare deja formatată, unit: opțional, s: rând mic opțional }] */
function uiStats(items) {
  return (
    '<div class="sums">' +
    items
      .map(function (x) {
        return (
          '<div><div class="l">' +
          esc(x.l) +
          '</div><div class="n">' +
          esc(x.n) +
          (x.unit ? " <small>" + esc(x.unit) + "</small>" : "") +
          "</div>" +
          (x.s ? '<div class="small">' + esc(x.s) + "</div>" : "") +
          "</div>"
        );
      })
      .join("") +
    "</div>"
  );
}
/* Perechi etichetă și valoare pe un rând. pairs: [[etichetă, valoare], ...] */
function uiKV(pairs) {
  return (
    '<div class="kv">' +
    pairs
      .map(function (p) {
        return "<span>" + esc(p[0]) + " <b>" + esc(p[1]) + "</b></span>";
      })
      .join('<span class="sep"></span>') +
    "</div>"
  );
}
/* Bară de procent, 0 până la 100. */
function uiBar(pct) {
  return '<div class="bar" aria-hidden="true"><i style="width:' + Math.max(0, Math.min(100, +pct || 0)) + '%"></i></div>';
}
/* Filtre sau comutare între vederi. items: [[id, etichetă], ...]; act: acțiunea data-act primită de onAct(act, id). */
function uiChips(items, current, act) {
  return (
    '<div class="chips">' +
    items
      .map(function (x) {
        return (
          '<button class="chip" data-act="' +
          esc(act) +
          '" data-id="' +
          esc(x[0]) +
          '" aria-pressed="' +
          (x[0] === current) +
          '">' +
          esc(x[1]) +
          "</button>"
        );
      })
      .join("") +
    "</div>"
  );
}
/* Vot. p: { id, title, scope, closes: "AAAA-LL-ZZ", state: "open" | "closed", options: [{ id, label, votes }],
   voted: id-ul opțiunii alese sau "", canVote, showResults, voters: câți au drept de vot (opțional) }.
   Formularul are data-poll="id"; trimiterea se tratează în modulul de voturi. */
function uiPoll(p) {
  var open = p.state === "open";
  var total = p.options.reduce(function (s, o) {
    return s + (o.votes || 0);
  }, 0);
  var head =
    '<div class="poll-h"><h3>' +
    esc(p.title) +
    "</h3>" +
    uiTag(open ? "Deschis până la " + dro(p.closes) : "Închis", open ? "good" : "neutral", open ? "clock" : "check") +
    '</div><p class="small">' +
    esc(p.scope) +
    (p.showResults ? '<span class="sep"></span>' + total + (total === 1 ? " vot" : " voturi") + (p.voters ? " din " + p.voters : "") : "") +
    "</p>";
  var body;
  if (open && p.canVote && !p.voted) {
    body =
      '<form class="poll-f" data-poll="' +
      esc(p.id) +
      '">' +
      p.options
        .map(function (o) {
          return '<label class="opt"><input type="radio" name="opt" value="' + esc(o.id) + '"><span>' + esc(o.label) + "</span></label>";
        })
        .join("") +
      '<div class="sheet-acts"><button class="btn sm" type="submit">Votează</button></div></form>';
  } else if (p.showResults) {
    body = p.options
      .map(function (o) {
        var pct = total ? Math.round((100 * (o.votes || 0)) / total) : 0;
        var mine = p.voted === o.id;
        return (
          '<div class="res' +
          (mine ? " mine" : "") +
          '"><div class="res-t"><span>' +
          esc(o.label) +
          (mine ? " (votul tău)" : "") +
          '</span><span class="num">' +
          pct +
          "%</span></div>" +
          uiBar(pct) +
          "</div>"
        );
      })
      .join("");
  } else {
    body = '<p class="small">' + (p.voted ? "Ai votat. " : "") + "Rezultatul apare după închiderea votului.</p>";
  }
  return '<div class="poll">' + head + body + "</div>";
}
/* Eveniment. e: { id, title, date: "AAAA-LL-ZZ", place, count, going, past, income, spent (în bani; lipsesc dacă
   regulile filialei ascund sumele), mine: contribuția mea, text scurt }. Butonul trimite data-act="evgo". */
function uiEvent(e) {
  var d = String(e.date || "").split("-");
  var money =
    e.income != null || e.spent != null
      ? uiKV([
          ["Încasat", fmt(e.income || 0) + " RON"],
          ["Cheltuit", fmt(e.spent || 0) + " RON"],
          ["Rezultat", fmt((e.income || 0) - (e.spent || 0)) + " RON"],
        ])
      : "";
  var right = e.past
    ? e.going
      ? uiTag("Am participat", "good", "check")
      : ""
    : '<button class="btn sm' +
      (e.going ? " sec" : "") +
      '" data-act="evgo" data-id="' +
      esc(e.id) +
      '">' +
      (e.going ? "Particip" : "Vin și eu") +
      "</button>";
  return (
    '<div class="ev"><div class="ev-date"><b>' +
    esc(d[2] || "") +
    "</b><span>" +
    (MONTHS[+d[1] - 1] || "") +
    '</span></div><div class="grow"><h3>' +
    esc(e.title) +
    '</h3><span class="meta">' +
    esc(e.place || "") +
    (e.count != null ? '<span class="sep"></span>' + e.count + " participanți" : "") +
    "</span>" +
    money +
    (e.mine ? '<span class="meta">Contribuția mea: ' + esc(e.mine) + "</span>" : "") +
    "</div>" +
    (right ? '<div class="val">' + right + "</div>" : "") +
    "</div>"
  );
}
/* Rând din registrul de încasări și cheltuieli: doar denumire și sumă.
   m: { id, title, date, amount (în bani), kind: "in" | "out", meta, cancelled, act: acțiunea la apăsare, opțional } */
function uiMoney(m) {
  var out = m.kind === "out";
  return row({
    act: m.act,
    id: m.id,
    title: m.title,
    /* în row() separatorul e text: elementele din .grow se așază fiecare pe rândul lui */
    meta: esc(dro(m.date)) + (m.meta ? " | " + esc(m.meta) : "") + (m.cancelled ? " | anulat" : ""),
    right: '<span class="amt num ' + (out ? "out" : "in") + '">' + (out ? "−" : "+") + fmt(m.amount) + " RON</span>",
    stripe: m.cancelled ? "crit" : "",
  });
}
/* Mulțumire de networking. t: { who, photo, branch, date, amount (în bani), msg, dir: "sent" | "received" } */
function uiThanks(t) {
  return (
    '<div class="thanks">' +
    uiAvatar(t.who, t.photo) +
    '<div class="grow"><div class="th-h"><h3>' +
    (t.dir === "sent" ? "Către " : "De la ") +
    esc(t.who) +
    '</h3><span class="amt num in">' +
    fmt(t.amount) +
    ' RON</span></div><span class="meta">' +
    esc(dro(t.date)) +
    (t.branch ? '<span class="sep"></span>' + esc(t.branch) : "") +
    '</span><p class="quote">' +
    esc(t.msg) +
    "</p></div></div>"
  );
}
/* Comutator pornit sau oprit, pentru regulile filialei și alte setări. */
function uiSwitch(name, label, help, on, disabled) {
  return (
    '<label class="switch"><span class="grow"><b>' +
    esc(label) +
    "</b>" +
    (help ? '<span class="help">' + esc(help) + "</span>" : "") +
    '</span><input type="checkbox" role="switch" name="' +
    esc(name) +
    '"' +
    (on ? " checked" : "") +
    (disabled ? " disabled" : "") +
    "><i></i></label>"
  );
}
/* Alegerea pozei de profil. Câmpul de fișier are name="photo"; micșorarea se face în modulul de profil. */
function uiPhotoPicker(name, photo) {
  return (
    '<div class="photo-pick">' +
    uiAvatar(name, photo, "xl") +
    '<div><label class="btn sec sm">' +
    svg("cam", 18) +
    'Alege o poză<input type="file" name="photo" accept="image/*" hidden></label><p class="help">Poza se micșorează automat înainte de trimitere.</p></div></div>'
  );
}
/* Filigran cu numele celui care privește, peste paginile cu date de contact. Descurajează capturile, nu le poate opri. */
function uiWatermark(text) {
  var s =
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><text x="6" y="68" transform="rotate(-24 120 60)" font-family="sans-serif" font-size="15" font-weight="700" fill="#808080">' +
    esc(text) +
    "</text></svg>";
  return '<div class="wm" aria-hidden="true" style="background-image:url(\'data:image/svg+xml,' + encodeURIComponent(s) + "')\"></div>";
}
/* Stocare: server (/api/app), demonstrativ (memorie) și pilotul vechi de pe claude.ai */
function normSnap(s) {
  var out = [];
  var arr = [];
  if (Array.isArray(s)) arr = s;
  else if (s && s.docs) arr = s.docs;
  else if (s && typeof s.forEach === "function")
    s.forEach(function (d) {
      arr.push(d);
    });
  arr.forEach(function (d) {
    var data = typeof d.data === "function" ? d.data() : d.data && typeof d.data === "object" ? d.data : d;
    var id = d.id || (data && data.id);
    if (id == null) return;
    var o = {};
    for (var k in data) o[k] = data[k];
    o.id = id;
    out.push(o);
  });
  return out;
}
function makeLiveStore(db) {
  var unsubs = [];
  return {
    live: true,
    sub: function (path, cb) {
      try {
        var u = db.collection(path).onSnapshot(
          function (s) {
            cb(normSnap(s));
          },
          function (e) {
            cb(null, e);
          },
        );
        if (typeof u === "function") unsubs.push(u);
      } catch (e) {
        cb(null, e);
      }
    },
    set: function (path, id, obj) {
      return db.collection(path).doc(id).set(obj);
    },
    del: function (path, id) {
      return db.collection(path).doc(id).delete();
    },
    reset: function () {
      unsubs.forEach(function (u) {
        try {
          u();
        } catch (e) {}
      });
      unsubs = [];
    },
  };
}
function makeHttpStore() {
  var subs = {},
    revs = {},
    timer = 0,
    t0 = 0,
    inflight = false,
    again = false,
    started = false,
    gen = 0,
    lastPull = 0,
    lastAct = Date.now();
  /* Economie de cereri: actualizare la 60 s doar cât pagina e vizibilă și omul a fost activ în ultimele 3 minute. */
  var POLL_MS = 60000,
    IDLE_MS = 180000;
  function post(url, body) {
    return fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r
        .json()
        .catch(function () {
          return {};
        })
        .then(function (j) {
          return { status: r.status, body: j };
        });
    });
  }
  function fireAll(paths, err) {
    paths.forEach(function (p) {
      delete revs[p];
      (subs[p] || []).forEach(function (cb) {
        cb(null, err);
      });
    });
  }
  function pull() {
    if (inflight) {
      again = true;
      return Promise.resolve();
    }
    var paths = Object.keys(subs);
    if (!paths.length) return Promise.resolve();
    inflight = true;
    lastPull = Date.now();
    var g = gen;
    return post("/api/app/pull", { paths: paths, revs: revs })
      .then(function (r) {
        inflight = false;
        if (g !== gen) return; /* abonările au fost refăcute între timp: răspunsul e depășit */
        if (r.status === 401 || (r.status === 403 && r.body && r.body.excluded)) {
          location.reload();
          return;
        }
        if (r.status !== 200) {
          fireAll(paths, new Error("http " + r.status));
          return;
        }
        var d = r.body.data || {},
          er = r.body.errors || {},
          rv = r.body.rev || {};
        paths.forEach(function (p) {
          if (er[p]) {
            delete revs[p];
            (subs[p] || []).forEach(function (cb) {
              cb(null, new Error("acces " + er[p]));
            });
            return;
          }
          if (rv[p] !== undefined) revs[p] = rv[p];
          if (d[p] !== undefined)
            (subs[p] || []).forEach(function (cb) {
              cb(d[p]);
            });
        });
      })
      .catch(function () {
        inflight = false;
        fireAll(paths, new Error("rețea"));
      })
      .then(function () {
        if (again) {
          again = false;
          return pull();
        }
      });
  }
  function loop() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (!document.hidden && Date.now() - lastAct < IDLE_MS) pull();
      loop();
    }, POLL_MS);
  }
  function write(body) {
    return post("/api/app/write", body).then(function (r) {
      if (r.status === 401) {
        location.reload();
        throw new Error("sesiune");
      }
      if (r.status !== 200) throw new Error((r.body && r.body.error) || "http " + r.status);
      return pull();
    });
  }
  if (!window._jcibVis) {
    window._jcibVis = 1;
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && S.store && S.store.server) S.store.touch(15000);
    });
    ["pointerdown", "keydown"].forEach(function (ev) {
      document.addEventListener(
        ev,
        function () {
          if (S.store && S.store.server) S.store.touch(POLL_MS);
        },
        { passive: true },
      );
    });
  }
  return {
    live: true,
    server: true,
    sub: function (path, cb) {
      (subs[path] = subs[path] || []).push(cb);
      clearTimeout(t0);
      t0 = setTimeout(pull, 20);
      if (!started) {
        started = true;
        loop();
      }
    },
    set: function (path, id, obj) {
      return write({ path: path, id: id, data: obj });
    },
    del: function (path, id) {
      return write({ path: path, id: id, del: true });
    },
    refresh: function () {
      return pull();
    },
    /* semnal de activitate: reîmprospătează doar dacă ultima citire e mai veche de minAge ms */
    touch: function (minAge) {
      lastAct = Date.now();
      if (Date.now() - lastPull > minAge) pull();
    },
    reset: function () {
      gen++;
      subs = {};
      revs = {};
      clearTimeout(timer);
      clearTimeout(t0);
      started = false;
    },
  };
}
function makeMemStore(seed) {
  var data = {},
    subs = {};
  function list(p) {
    var m = data[p] || {};
    return Object.keys(m).map(function (k) {
      var o = JSON.parse(JSON.stringify(m[k]));
      o.id = k;
      return o;
    });
  }
  function emit(p) {
    (subs[p] || []).forEach(function (cb) {
      cb(list(p));
    });
  }
  var st = {
    live: false,
    sub: function (p, cb) {
      (subs[p] = subs[p] || []).push(cb);
      setTimeout(function () {
        cb(list(p));
      }, 0);
    },
    set: function (p, id, o) {
      (data[p] = data[p] || {})[id] = JSON.parse(JSON.stringify(o));
      emit(p);
      return Promise.resolve();
    },
    del: function (p, id) {
      if (data[p]) delete data[p][id];
      emit(p);
      return Promise.resolve();
    },
    reset: function () {
      subs = {};
    },
  };
  if (seed)
    seed(function (p, id, o) {
      (data[p] = data[p] || {})[id] = o;
    });
  return st;
}
function demoSeed(put) {
  var P = [
    ["m1", "Andrei Popescu", "Brașov", "Avocat", "Cabinet Popescu și Asociații", "Drept comercial și contracte"],
    ["m2", "Ioana Dumitrescu", "Brașov", "Fotograf", "Studio Lumină", "Foto de eveniment, reducere 15% pentru membri"],
    ["m3", "Radu Ionescu", "Brașov", "IT și tehnologie", "Nordic Soft", "Site-uri și automatizări, ofertă gratuită de audit"],
    ["m4", "Maria Stoica", "Cluj", "Marketing și comunicare", "Atelier Digital", "Strategie social media"],
    ["m5", "Vlad Munteanu", "Cluj", "Contabilitate și finanțe", "Cont Plus", "Contabilitate pentru ONG-uri"],
    ["m6", "Elena Barbu", "București", "Educație și training", "Skill Lab", "Traininguri pentru echipe"],
  ];
  var ids = {};
  [
    ["brasov", "Brașov"],
    ["cluj", "Cluj"],
    ["bucuresti", "București"],
  ].forEach(function (b) {
    put("branchlist", b[0], { name: b[1], createdAt: "2026-01-01", createdBy: "u-nat" });
  });
  P.forEach(function (p, i) {
    var id = "u-" + p[0];
    ids[p[0]] = id;
    put("profiles", id, {
      name: p[1],
      branch: p[2],
      domain: p[3],
      firm: p[4],
      offer: p[5],
      consent: { directory: true, phone: i % 2 === 0, email: true, offer: true, version: CONSENT_VERSION },
      phone: i % 2 === 0 ? "0722 000 00" + i : "",
      email: p[1].split(" ")[1].toLowerCase() + "@exemplu.ro",
    });
    put("badges", id, {
      verified: true,
      active: i !== 4,
      validUntil: i === 4 ? "2026-07-31" : "2027-12-31",
      excluded: false,
      branch: p[2],
    });
    put("branches/" + p[2] + "/members", "r" + p[0], {
      name: p[1],
      userId: id,
      branch: p[2],
      validUntil: i === 4 ? "2026-07-31" : "2027-12-31",
    });
  });
  ["Bianca Rusu", "Dan Pavel", "Sorin Matei", "Carmen Lupu", "Paul Georgescu"].forEach(function (n, i) {
    var mo = { name: n, branch: "Brașov", userId: "", validUntil: i === 0 ? "2026-09-30" : "2026-12-31" };
    if (i === 4) mo.excluded = true;
    put("branches/Brașov/members", "rb" + i, mo);
  });
  put("branches/Brașov/codes", "DEMOA2B3C4D5", {
    memberId: "rb0",
    createdAt: "2026-11-01",
    createdBy: "u-pres-bv",
    expiresAt: "2027-12-31",
    used: false,
  });
  ["Tudor Neagu", "Alina Preda"].forEach(function (n, i) {
    put("branches/Cluj/members", "rc" + i, { name: n, branch: "Cluj", userId: "" });
  });
  put("branches/București/members", "rx0", { name: "Cezar Vasile", branch: "București", userId: "" });
  var t = today();
  function fee(b, mid, st, extra) {
    var o = {
      memberId: mid,
      year: 2027,
      due: 30000,
      paid: st === "platita" || st === "avans" ? 30000 : 0,
      state: st,
      deadline: "2026-10-30",
      createdAt: t,
      anulat: false,
      branch: b,
    };
    for (var k in extra) o[k] = extra[k];
    return o;
  }
  put(
    "branches/Brașov/fees",
    "f1",
    fee("Brașov", "rm1", "avans", { paidOn: "2026-10-14", method: "transfer bancar", thirdParty: "Președinte", recovered: false }),
  );
  put(
    "branches/Brașov/fees",
    "f2",
    fee("Brașov", "rm2", "avans", { paidOn: "2026-10-14", method: "transfer bancar", thirdParty: "Președinte", recovered: true }),
  );
  put("branches/Brașov/fees", "f3", fee("Brașov", "rm3", "platita", { paidOn: "2026-10-20", method: "card" }));
  put("branches/Brașov/fees", "f4", fee("Brașov", "rb0", "neplatita", {}));
  put(
    "branches/Brașov/fees",
    "f5",
    fee("Brașov", "rb1", "avans", { paidOn: "2026-10-14", method: "transfer bancar", thirdParty: "Președinte", recovered: false }),
  );
  put("branches/Cluj/fees", "f6", fee("Cluj", "rm4", "platita", { paidOn: "2026-10-25", method: "transfer bancar" }));
  put("branches/Cluj/fees", "f7", fee("Cluj", "rc0", "neplatita", {}));
  put("branches/București/fees", "f8", fee("București", "rm6", "platita", { paidOn: "2026-10-28", method: "card" }));
  put("branches/Brașov/donations", "d1", {
    donor: "Anonim",
    anonymous: true,
    type: "persoană fizică",
    amount: 50000,
    date: "2026-10-02",
    purpose: "Beyond the Initiative",
    doc: "",
    anulat: false,
    branch: "Brașov",
  });
  put("branches/Brașov/donations", "d2", {
    donor: "Firma Exemplu SRL",
    anonymous: false,
    type: "persoană juridică",
    amount: 150000,
    date: "2026-10-18",
    purpose: "Nedestinat",
    doc: "Contract 12/2026",
    anulat: false,
    branch: "Brașov",
  });
  put("branches/Cluj/donations", "d3", {
    donor: "Maria Stoica",
    anonymous: false,
    type: "persoană fizică",
    amount: 20000,
    date: "2026-10-22",
    purpose: "Nedestinat",
    doc: "",
    anulat: false,
    branch: "Cluj",
  });
  function ex(b, cat, d, amt, date, sup, st, extra) {
    var o = {
      category: cat,
      desc: d,
      amount: amt,
      date: date,
      supplier: sup,
      cui: "",
      state: st,
      proposedBy: "u-trez-bv",
      docNo: "",
      anulat: false,
      branch: b,
    };
    for (var k in extra) o[k] = extra[k];
    return o;
  }
  put(
    "branches/Brașov/expenses",
    "e1",
    ex("Brașov", CATS[0], "Închiriere sală pentru evenimentul de lansare", 120000, "2026-10-20", "Sala CATTIA", "platita", {
      approvedBy: "u-pres-bv",
      decision: "HCC 7/2026",
      decisionDate: "2026-10-15",
      docNo: "F 2026/114",
      paidOn: "2026-10-22",
    }),
  );
  put(
    "branches/Brașov/expenses",
    "e2",
    ex("Brașov", CATS[3], "Materiale tipărite pentru eveniment", 32000, "2026-11-03", "Tipografia Demo", "platita", {
      docNo: "F 77",
      paidOn: "2026-11-04",
    }),
  );
  put(
    "branches/Brașov/expenses",
    "e3",
    ex("Brașov", CATS[0], "Catering pentru panelul de networking", 85000, "2026-11-09", "Catering Exemplu", "propusa", {}),
  );
  put(
    "branches/Cluj/expenses",
    "e4",
    ex("Cluj", CATS[1], "Training de comunicare pentru membrii noi", 45000, "2026-10-27", "Skill Lab", "platita", {
      docNo: "F 33",
      paidOn: "2026-10-28",
      proposedBy: "u-trez-cj",
    }),
  );
  put(
    "branches/București/expenses",
    "e5",
    ex("București", CATS[7], "Comision bancar anual pentru cont", 12000, "2026-10-30", "Bancă", "platita", {
      docNo: "Extras 10",
      paidOn: "2026-10-30",
      proposedBy: "u-trez-bu",
    }),
  );
  put("branches/Brașov/settings", "main", { opening: 0 });
  put("roles", "u-nat", { role: "national", branch: "Brașov", title: "Președinte național", since: "2026-11-01" });
  put("roles", "u-pres-bv", { role: "president", branch: "Brașov", title: "Președinte", since: "2026-11-01" });
  put("roles", "u-pres-cj", { role: "president", branch: "Cluj", title: "Președinte", since: "2026-11-01" });
  put("roles", "u-trez-bv", { role: "treasurer", branch: "Brașov", title: "Vicepreședinte trezorier", since: "2026-11-01" });
  put("roles", "u-board-bv", { role: "board", branch: "Brașov", title: "Vicepreședinte comunicare", since: "2026-11-01" });
  [
    ["u-nat", "Președinte național (probă)", "Brașov"],
    ["u-pres-cj", "Președinte Cluj (probă)", "Cluj"],
    ["u-board-bv", "Conducere Brașov (probă)", "Brașov"],
  ].forEach(function (x) {
    put("profiles", x[0], {
      name: x[1],
      branch: x[2],
      domain: "Alte domenii",
      firm: "",
      offer: "",
      consent: { directory: false, phone: false, email: false, offer: false, version: CONSENT_VERSION },
    });
    put("badges", x[0], { verified: true, active: true, validUntil: "2027-12-31", excluded: false, branch: x[2] });
  });
  put("profiles", "u-pres-bv", {
    name: "Iustin Măzărache",
    branch: "Brașov",
    domain: "Turism și HoReCa",
    firm: "Hillden",
    offer: "",
    consent: { directory: false, phone: false, email: false, offer: false, version: CONSENT_VERSION },
  });
  put("profiles", "u-trez-bv", {
    name: "Trezorier Brașov (probă)",
    branch: "Brașov",
    domain: "Contabilitate și finanțe",
    firm: "",
    offer: "",
    consent: { directory: false, phone: false, email: false, offer: false, version: CONSENT_VERSION },
  });
}
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
    if (path === "roles" && rows) {
      var sig = myRole().role + "|" + myRole().branch;
      if (S._sig && S._sig !== sig) {
        /* funcția mea s-a schimbat (predare, retragere): abonările se refac după noul rol */
        S._sig = sig;
        setTimeout(subscribeAll, 0);
        return;
      }
      S._sig = sig;
      ensureLeadSubs();
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
/* Randarea paginii: antet, navigare, alegerea ecranului */
function tabsFor() {
  var rl = myRole().role;
  if (rl === "mod") return [["structura", "Structură", "build"]];
  if (rl === "national")
    return [
      ["director", "Director", "dir"],
      ["structura", "Structură", "build"],
      ["profil", "Profilul meu", "me"],
    ];
  if (rl === "board")
    return [
      ["director", "Director", "dir"],
      ["donatii", "Donații", "gift"],
      ["cheltuieli", "Cheltuieli", "spend"],
      ["profil", "Profilul meu", "me"],
    ];
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
  if (document.getElementById("gateform") && S.D.profiles !== undefined && !myProfile() && needsGate()) {
    S._stale = true;
    return;
  }
  if (document.getElementById("loginform") && S.me && needsGate() && badgeState(badgeOf(S.me.id)) === "none" && !localClaim()) {
    S._stale = true;
    return;
  }
  S._stale = false;
  var waiting =
    S.mode === "ready" &&
    !S.err.profiles &&
    !S.err.roles &&
    (S.D.profiles === undefined ||
      (S.D.branchlist === undefined && !S.err.branchlist) ||
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
  if (needsGate()) {
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
    (S.tab !== "profil" || isMod()) &&
    !tabs.some(function (t) {
      return t[0] === S.tab;
    })
  )
    S.tab = tabs[0][0];
  var head = '<header class="top">' + logoHtml() + "";
  if (scopeBranches().length) head += '<span class="small" style="color:var(--hero-ink)">' + esc(r.branch) + "</span>";
  head +=
    '<button class="ibtn" data-act="theme" aria-label="Schimbă tema">' +
    svg("sun", 22) +
    "</button>" +
    (S.server ? '<button class="ibtn" data-act="logout" aria-label="Ieși din cont">' + svg("out", 22) + "</button>" : "") +
    (isMod()
      ? ""
      : '<button class="ibtn" data-act="goprofil" aria-label="Profilul meu"><span class="avatar">' +
        esc(initials(prof ? prof.name : roleTitle(r))) +
        "</span></button>") +
    "</header>";
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
  else if (S.tab === "structura") body = vStructure();
  else if (S.tab === "tablou") body = vDash();
  else if (S.tab === "cotizatii") body = vFees();
  else if (S.tab === "donatii") body = vDon();
  else if (S.tab === "cheltuieli") body = vExp();
  else body = vDirector();
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
/* Intrare în aplicație, acorduri, formularul de profil */
function consentBlock(c) {
  c = c || {};
  return (
    '<p class="small" style="margin-bottom:12px">Operatorul datelor tale este Federația JCI România sau filiala ta (se stabilește în scris înainte de lansarea oficială). Folosim datele ca să administrăm calitatea ta de membru și ca membrii să se găsească între ei. Poți schimba orice alegere oricând din „Profilul meu”.</p>' +
    '<p class="small" style="margin-bottom:12px"><b>Necesar:</b> nume, filială și contul tău. Conducerea filialei tale vede dacă ai cotizația achitată. Ceilalți membri văd doar insigna „Membru activ”, fără sumă și fără date de plată.</p>' +
    '<p class="lab">Opțional, casete separate</p>' +
    '<label class="check"><input type="checkbox" name="c_dir"' +
    (c.directory ? " checked" : "") +
    "><span>Doresc să apar în directorul membrilor, vizibil membrilor JCI autentificați: nume, firmă, domeniu.</span></label>" +
    '<label class="check"><input type="checkbox" name="c_phone"' +
    (c.phone ? " checked" : "") +
    "><span>Doresc să afișez în director numărul meu de telefon.</span></label>" +
    '<label class="check"><input type="checkbox" name="c_mail"' +
    (c.email ? " checked" : "") +
    "><span>Doresc să afișez în director adresa mea de e-mail.</span></label>" +
    '<label class="check"><input type="checkbox" name="c_offer"' +
    (c.offer ? " checked" : "") +
    "><span>Doresc să public o ofertă pentru membri, vizibilă membrilor autentificați.</span></label>" +
    '<p class="help">Datele din director sunt vizibile doar membrilor autentificați. Poți retrage acordurile oricând; retragerea nu afectează prelucrările anterioare. Ai dreptul să te plângi la ANSPDCP.</p>'
  );
}
function profileForm(p, priv) {
  p = p || {};
  priv = priv || {};
  return (
    '<div class="field"><label for="f_name">Nume complet</label><input type="text" id="f_name" name="name" value="' +
    esc(p.name) +
    '" required autocomplete="name"></div>' +
    (S.server && S.me && S.me.branch
      ? '<div class="field"><span class="lab">Filiala</span><p style="margin:4px 0 0">' +
        esc(S.me.branch) +
        '</p><input type="hidden" name="branch" value="' +
        esc(S.me.branch) +
        '"></div>'
      : '<div class="field"><label for="f_branch">Filiala</label><select class="f" id="f_branch" name="branch">' +
        BRANCHES.map(function (b) {
          return "<option" + (p.branch === b ? " selected" : "") + ">" + b + "</option>";
        }).join("") +
        "</select></div>") +
    '<div class="field"><label for="f_firm">Firma</label><input type="text" id="f_firm" name="firm" value="' +
    esc(p.firm) +
    '"></div>' +
    '<div class="field"><label for="f_domain">Domeniu de activitate</label><select class="f" id="f_domain" name="domain">' +
    DOMAINS.map(function (b) {
      return "<option" + (p.domain === b ? " selected" : "") + ">" + b + "</option>";
    }).join("") +
    "</select></div>" +
    '<div class="field"><label for="f_phone">Telefon</label><input type="tel" id="f_phone" name="phone" value="' +
    esc(priv.phone || p.phone) +
    '" autocomplete="tel"></div>' +
    '<div class="field"><label for="f_email">E-mail</label><input type="email" id="f_email" name="email" value="' +
    esc(priv.email || p.email) +
    '" autocomplete="email"></div>' +
    '<div class="field"><label for="f_offer">Ofertă pentru membri</label><textarea id="f_offer" name="offer" maxlength="400">' +
    esc(p.offer) +
    '</textarea><span class="help">Nu introduce date personale ale altor persoane sau date sensibile.</span></div>'
  );
}
function demoBarHtml() {
  if (S.server || !S.store || S.store.live) return "";
  return (
    '<div class="demo-bar"><span>Mod demonstrativ: date fictive, nimic nu se salvează. Cod de probă pentru membru nou: DEMO-A2B3-C4D5.</span><label>Vezi ca <select id="demorole" aria-label="Vezi ca">' +
    [
      ["u-nat", "Președinte național"],
      ["u-pres-bv", "Președinte Brașov"],
      ["u-pres-cj", "Președinte Cluj"],
      ["u-trez-bv", "Vicepreședinte trezorier Brașov"],
      ["u-board-bv", "Conducere Brașov"],
      ["u-m1", "Membru"],
      ["u-new", "Membru nou, fără cod"],
      ["u-m5", "Membru exclus"],
    ]
      .map(function (x) {
        return '<option value="' + x[0] + '"' + (S.me.id === x[0] ? " selected" : "") + ">" + x[1] + "</option>";
      })
      .join("") +
    "</select></label></div>"
  );
}
function localClaim() {
  return col("data/users/" + S.me.id).filter(function (x) {
    return x.id === "claim";
  })[0];
}
function renderLogin() {
  return (
    demoBarHtml() +
    '<div class="gate"><div class="gate-top">' +
    logoHtml() +
    '</div><div class="gate-in" style="margin-top:120px"><h1>Intră în aplicație</h1><p class="small" style="margin:8px 0 16px">Introdu codul de membru primit de la președintele filialei tale la înscriere.</p><form id="loginform"><div class="field"><label for="lg_code">Codul de membru</label><input type="text" id="lg_code" name="code" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" maxlength="20"></div><div class="err" id="lgerr"></div><div class="sheet-acts"><button class="btn" type="submit">Continuă</button></div></form>' +
    '<div class="sec-h"><h2>Ai o funcție de conducere?</h2></div><p class="small">Contul de conducere îl creează persoana care te numește în funcție. Trimite-i codul contului tău:</p><p class="num" style="overflow-wrap:anywhere;font-family:monospace;margin:8px 0">' +
    esc(S.me.id) +
    '</p><button class="btn sec sm" data-act="copyid">Copiază codul contului</button></div></div>'
  );
}
function renderWaiting(cl) {
  return (
    demoBarHtml() +
    '<div class="gate"><div class="gate-top">' +
    logoHtml() +
    '</div><div class="gate-in" style="margin-top:120px"><h1>Cerere trimisă</h1><p style="margin:12px 0">Am primit codul care se termină în <b>' +
    esc(String(cl.code || "").slice(-4)) +
    '</b>. Conducerea filialei îl verifică. Confirmarea vine automat când președintele sau trezorierul deschide aplicația; poți închide pagina și reveni.</p><div class="sheet-acts"><button class="btn sec" data-act="newcode">Introdu alt cod</button></div></div></div>'
  );
}
function renderExcluded(bd) {
  var txt =
    bd.reason === "manual"
      ? "Contul tău a fost suspendat de conducerea filialei" +
        (bd.branch ? " " + esc(bd.branch) : "") +
        ". Pentru detalii, contactează președintele filialei."
      : "Calitatea ta de membru a expirat la " +
        dro(bd.validUntil) +
        ", iar de peste 3 luni cotizația nu a fost achitată, deci contul a fost scos automat din aplicație. Accesul revine după plata cotizației. Contactează președintele filialei" +
        (bd.branch ? " " + esc(bd.branch) : "") +
        ".";
  return (
    demoBarHtml() +
    '<div class="gate"><div class="gate-top">' +
    logoHtml() +
    '</div><div class="gate-in" style="margin-top:120px"><h1>Accesul tău a fost suspendat</h1><p style="margin:12px 0">' +
    txt +
    "</p>" +
    (S.server ? '<div class="sheet-acts"><button class="btn sec" data-act="logout">Ieși din cont</button></div>' : "") +
    "</div></div>"
  );
}
function bindLogin() {
  var f = document.getElementById("loginform");
  if (f)
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      submitCode(new FormData(f));
    });
}
async function submitCode(fd) {
  var c = normCode(fd.get("code"));
  var e = document.getElementById("lgerr");
  if (c.length !== 12) {
    e.textContent = "Codul are 12 caractere, de exemplu K7M2-9QXA-4TLD.";
    return;
  }
  var id = S.me.id;
  var rec = { code: c, at: new Date().toISOString() };
  try {
    await S.store.set("claims", id, rec);
  } catch (err) {
    e.textContent = "Nu am putut trimite codul. Încearcă din nou.";
    return;
  }
  try {
    await S.store.set("data/users/" + id, "claim", rec);
  } catch (err) {}
  toast("Codul a fost trimis.");
}
function renderServerLogin() {
  return (
    '<div class="gate"><div class="gate-top">' +
    logoHtml() +
    '</div><div class="gate-in" style="margin-top:120px"><h1>Intră în aplicație</h1><p class="small" style="margin:8px 0 16px">Introdu codul de membru primit de la președintele filialei tale. Conducerea intră tot cu un cod, primit de la persoana care a numit-o în funcție.</p><form id="svform"><div class="field"><label for="lg_code">Codul de membru</label><input type="text" id="lg_code" name="code" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" maxlength="20"></div><div class="err" id="lgerr" role="alert"></div><div class="sheet-acts"><button class="btn" type="submit">Continuă</button></div></form>' +
    '<details style="margin-top:24px"><summary class="small">Administrator tehnic</summary><form id="modform" style="margin-top:12px"><div class="field"><label for="lg_key">Cheia administratorului</label><input type="password" id="lg_key" name="key" autocomplete="off"></div><div class="err" id="mderr" role="alert"></div><div class="sheet-acts"><button class="btn sec" type="submit">Intră ca administrator</button></div></form></details></div></div>'
  );
}
function svPost(url, body) {
  return fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(function (r) {
    return r
      .json()
      .catch(function () {
        return {};
      })
      .then(function (j) {
        return { status: r.status, body: j };
      });
  });
}
function showServerLogin() {
  var app = document.getElementById("app");
  app.innerHTML = renderServerLogin();
  function handle(form, errId, url, field) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var e = document.getElementById(errId);
      e.textContent = "";
      var v = String(new FormData(form).get(field) || "");
      if (field === "code" && normCode(v).length !== 12) {
        e.textContent = "Codul are 12 caractere, de exemplu K7M2-9QXA-4TLD.";
        return;
      }
      var b = {};
      b[field] = v;
      svPost(url, b)
        .then(function (r) {
          if (r.status === 200) {
            location.reload();
            return;
          }
          if (r.status === 403 && r.body.excluded) {
            S.mode = "excluded";
            app.innerHTML = renderExcluded(r.body);
            return;
          }
          e.textContent = r.body.error || "Nu am putut intra. Încearcă din nou.";
        })
        .catch(function () {
          e.textContent = "Nu am putut contacta serverul. Verifică conexiunea.";
        });
    });
  }
  handle(document.getElementById("svform"), "lgerr", "/api/app/login", "code");
  handle(document.getElementById("modform"), "mderr", "/api/app/modlogin", "key");
}
function renderGate() {
  return (
    demoBarHtml() +
    '<div class="gate"><div class="gate-top">' +
    logoHtml() +
    '</div><div class="gate-in" style="margin-top:120px"><h1>Datele tale în JCI Business</h1><form id="gateform" style="margin-top:16px">' +
    profileForm(S.server && S.me ? { name: S.me.name || "" } : null, null) +
    consentBlock(null) +
    '<label class="check"><input type="checkbox" name="agree" id="agree"><span>Am citit și accept prelucrarea datelor necesare pentru contul meu.</span></label><div class="err" id="agreeerr"></div>' +
    '<div class="sheet-acts"><button class="btn" type="submit" id="gatego" disabled>Continuă</button></div></form></div></div>'
  );
}
function bindGate() {
  var f = document.getElementById("gateform");
  var ag = document.getElementById("agree"),
    go = document.getElementById("gatego");
  ag.addEventListener("change", function () {
    go.disabled = !ag.checked;
  });
  f.addEventListener("submit", function (ev) {
    ev.preventDefault();
    saveProfile(new FormData(f));
  });
}
async function saveProfile(fd) {
  var gate = !!document.getElementById("gateform");
  if (gate && !fd.get("agree")) {
    var ee = document.getElementById("agreeerr");
    if (ee) ee.textContent = "Pentru a continua, trebuie să accepți prelucrarea datelor.";
    return;
  }
  var name = String(fd.get("name") || "").trim();
  if (!name) {
    toast("Completează câmpul Nume.");
    return;
  }
  var em = String(fd.get("email") || "").trim();
  if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    toast("Adresa de e-mail nu este validă.");
    return;
  }
  var c = {
    directory: !!fd.get("c_dir"),
    phone: !!fd.get("c_phone"),
    email: !!fd.get("c_mail"),
    offer: !!fd.get("c_offer"),
    version: CONSENT_VERSION,
    at: new Date().toISOString(),
  };
  var phone = String(fd.get("phone") || "")
      .trim()
      .slice(0, 30),
    email = em.slice(0, 120);
  var p = {
    name: name.slice(0, 100),
    branch: fd.get("branch"),
    firm: String(fd.get("firm") || "").slice(0, 100),
    domain: fd.get("domain"),
    offer: c.offer ? String(fd.get("offer") || "").slice(0, 400) : "",
    phone: c.phone ? phone : "",
    email: c.email ? email : "",
    consent: c,
  };
  var id = S.me.id;
  var warn = false;
  try {
    await S.store.set("profiles", id, p);
  } catch (e) {
    toast("Nu am putut salva profilul. Încearcă din nou.");
    return;
  }
  try {
    await S.store.set("data/users/" + id, "contact", {
      phone: phone,
      email: email,
      offerDraft: String(fd.get("offer") || "").slice(0, 400),
    });
  } catch (e) {
    warn = true;
  }
  toast(
    warn
      ? "Profilul a fost salvat, dar o parte din date nu s-a scris. Salvează din nou din Profilul meu."
      : "Modificările au fost salvate.",
  );
}
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
      ? '<div class="sec-h"><h2>Contul</h2></div><button class="btn sec" data-act="logout">Ieși din cont</button>'
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
/* Acțiuni: toate butoanele cu data-act trec prin onAct */
function csv(rows) {
  return rows
    .map(function (r) {
      return r
        .map(function (c) {
          c = String(c == null ? "" : c);
          if (/^[=+\-@\t\r]/.test(c)) c = "'" + c;
          return /[",;\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
        })
        .join(",");
    })
    .join("\n");
}
async function copyText(t, okMsg) {
  try {
    await navigator.clipboard.writeText(t);
    toast(okMsg || "Copiat.");
  } catch (e) {
    openSheet(
      '<h2>Copiază manual</h2><textarea readonly style="min-height:200px" id="manual">' +
        esc(t) +
        '</textarea><div class="sheet-acts"><button class="btn sec" data-act="closesheet">Închide</button></div>',
    );
    var m = document.getElementById("manual");
    if (m) {
      m.focus();
      m.select();
    }
  }
}
async function onAct(act, id) {
  if (S.mode === "ui" && act !== "theme") return;
  var b = curBranch();
  if (WRITE_ACTS[act] && !canWrite()) {
    toast("Rolul tău poate doar consulta această evidență.");
    return;
  }
  if ((act === "expappr" || act === "expreject") && myRole().role !== "president") {
    toast("Doar președintele aprobă sau respinge cheltuieli.");
    return;
  }
  if (act === "exppay") {
    var pe = col("branches/" + b + "/expenses").filter(function (x) {
      return x.id === id;
    })[0];
    if (pe && pe.approvedBy === S.me.id) {
      toast("Cine aprobă nu poate înregistra plata.");
      return;
    }
  }
  if (act === "expappr") {
    var ae = col("branches/" + b + "/expenses").filter(function (x) {
        return x.id === id;
      })[0],
      fp = myProfile();
    if (ae && ae.proposedBy === S.me.id) {
      toast("Cine propune nu poate aproba aceeași cheltuială.");
      return;
    }
    if (ae && fp && fp.firm && ae.supplier && norm(fp.firm) === norm(ae.supplier)) {
      toast("Nu poți aproba o cheltuială către propria firmă.");
      return;
    }
  }
  if (act === "settings" && myRole().role !== "president") {
    toast("Doar președintele filialei modifică setările.");
    return;
  }
  switch (act) {
    case "restart":
      location.reload();
      break;
    case "fillme": {
      var f2 = document.getElementById("ru2");
      if (f2) f2.value = S.me.id;
      break;
    }
    case "demo":
      S.store = makeMemStore(demoSeed);
      S.me = { id: "u-nat", isOwner: false };
      S.tab = "director";
      S.mode = "ready";
      S.err = {};
      subscribeAll();
      render();
      break;
    case "settings": {
      var cs = getSettings(b);
      openSheet(
        "<h2>Setări filială, " +
          esc(b) +
          "</h2><form>" +
          inp("opening", "Sold inițial (RON)", String(cs.opening / 100).replace(".", ","), "text", "so", 'inputmode="decimal"') +
          inp("feeDue", "Cotizația anuală (RON)", String(cs.feeDue / 100).replace(".", ","), "text", "sf", 'inputmode="decimal"') +
          '<p class="help">Soldul inițial se ia din extrasul de cont la începutul perioadei de evidență.</p><div class="err" id="sheeterr"></div><div class="sheet-acts"><button class="btn" type="submit">Salvează</button><button class="btn sec" type="button" data-act="closesheet">Anulează</button></div></form>',
        async function (fd) {
          var so = String(fd.get("opening") || "").trim();
          var neg = so.charAt(0) === "-";
          var ob = toBani(neg ? so.slice(1) : so);
          var fb = toBani(fd.get("feeDue"));
          if (isNaN(ob)) return fieldErr("Introdu soldul inițial în lei, de exemplu 1.250,50.");
          var fm = amtMsg(fd.get("feeDue"), fb);
          if (fm) return fieldErr(fm);
          if (
            await put(
              "branches/" + b + "/settings",
              "main",
              { opening: neg ? -ob : ob, feeDue: fb },
              "update",
              "Setări filială actualizate: " + b,
            )
          ) {
            closeSheet();
            toast("Modificările au fost salvate.");
          }
        },
      );
      break;
    }
    case "tab":
      S.tab = id;
      location.hash = id;
      render();
      window.scrollTo(0, 0);
      break;
    case "goprofil":
      S.tab = "profil";
      render();
      window.scrollTo(0, 0);
      break;
    case "theme": {
      var cur =
        document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      var nx = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", nx);
      lsSet("jcib-theme", nx);
      break;
    }
    case "fb":
      S.fb = id;
      render();
      break;
    case "fd":
      S.fd = id;
      render();
      break;
    case "resetf":
      S.fb = "Toate";
      S.fd = "Toate";
      S.q = "";
      render();
      break;
    case "retry":
      subscribeAll();
      break;
    case "godir":
      S.tab = "director";
      render();
      break;
    case "profile":
      openProfile(id);
      break;
    case "closesheet":
      closeSheet();
      break;
    case "copy":
      copyText(id, "Telefon copiat.");
      break;
    case "logout":
      try {
        await svPost("/api/app/logout", {});
      } catch (e) {}
      location.reload();
      break;
    case "copyid":
      copyText(S.me.id, "Codul a fost copiat.");
      break;
    case "export": {
      var p = myProfile() || {};
      var priv =
        col("data/users/" + S.me.id).filter(function (x) {
          return x.id === "contact";
        })[0] || {};
      copyText(
        JSON.stringify({ cont: S.me.id, profil: p, contactPrivat: priv, insigna: badgeOf(S.me.id) || null }, null, 2),
        "Datele au fost copiate.",
      );
      break;
    }
    case "delprofile":
      openSheet(
        '<h2>Șterge profilul</h2><p>Profilul tău dispare din director imediat. Insigna „Membru activ” o poate retrage conducerea filialei. Înregistrările contabile se păstrează restrâns, pe perioada legală.</p><div class="sheet-acts"><button class="btn crit" data-act="delprofile2">Șterge definitiv</button><button class="btn sec" data-act="closesheet">Renunț</button></div>',
      );
      break;
    case "delprofile2":
      try {
        await S.store.del("profiles", S.me.id);
        await safe(function () {
          return S.store.del("data/users/" + S.me.id, "contact");
        });
        closeSheet();
        toast("Profilul a fost șters.");
      } catch (e) {
        toast("Nu am putut șterge profilul.");
      }
      break;
    case "fv":
      S.feeView = id;
      render();
      break;
    case "ff":
      S.feeFilter = id;
      render();
      break;
    case "ef":
      S.expFilter = id;
      render();
      break;
    case "newmember":
      sheetNewMember();
      break;
    case "newfee":
      sheetFee();
      break;
    case "newdon":
      sheetDon();
      break;
    case "newexp":
      sheetExp();
      break;
    case "fee":
      detailFee(id);
      break;
    case "don":
      detailDon(id);
      break;
    case "exp":
      detailExp(id);
      break;
    case "feepaid":
      openSheet(
        "<h2>Marchează plătită</h2><form>" +
          inp("paidOn", "Data plății", today(), "date", "pp") +
          sel("method", ["transfer bancar", "card", "numerar", "compensare cu președintele"], "transfer bancar", "Metoda", "pm") +
          '<div class="err" id="sheeterr"></div><div class="sheet-acts"><button class="btn" type="submit">Salvează</button><button class="btn sec" type="button" data-act="closesheet">Anulează</button></div></form>',
        async function (fd) {
          if (!fd.get("paidOn")) return fieldErr("Alege data.");
          var f = col("branches/" + b + "/fees").filter(function (x) {
            return x.id === id;
          })[0];
          if (
            await feeUpdate(
              id,
              { state: "platita", paid: f.due, paidOn: fd.get("paidOn"), method: fd.get("method") },
              "Cotizație marcată plătită: " + memberName(b, f.memberId),
            )
          ) {
            closeSheet();
            toast("Modificările au fost salvate.");
          }
        },
      );
      break;
    case "feerec": {
      var ff = col("branches/" + b + "/fees").filter(function (x) {
        return x.id === id;
      })[0];
      if (
        await feeUpdate(id, { recovered: true, recoveredOn: today() }, "Cotizație recuperată de la membru: " + memberName(b, ff.memberId))
      ) {
        closeSheet();
        toast("Modificările au fost salvate.");
      }
      break;
    }
    case "feecancel":
      reasonForm("Anulează cotizația", "Anulează", async function (r) {
        if (await feeUpdate(id, { anulat: true, cancelReason: r }, "Cotizație anulată: " + r.slice(0, 40))) {
          closeSheet();
          toast("Modificările au fost salvate.");
        }
      });
      break;
    case "doncancel":
      reasonForm("Anulează donația", "Anulează", async function (r) {
        var d = col("branches/" + b + "/donations").filter(function (x) {
          return x.id === id;
        })[0];
        var o = Object.assign({}, d);
        delete o.id;
        o.anulat = true;
        o.cancelReason = r;
        if (await put("branches/" + b + "/donations", id, o, "update", "Donație anulată: " + r.slice(0, 40))) {
          closeSheet();
          toast("Modificările au fost salvate.");
        }
      });
      break;
    case "expcancel":
      reasonForm("Anulează cheltuiala", "Anulează", async function (r) {
        if (await expUpdate(id, { anulat: true, cancelReason: r }, "Cheltuială anulată: " + r.slice(0, 40))) {
          closeSheet();
          toast("Modificările au fost salvate.");
        }
      });
      break;
    case "expreject":
      reasonForm(
        "Respinge cheltuiala",
        "Respinge",
        async function (r) {
          if (await expUpdate(id, { state: "respinsa", rejectReason: r }, "Cheltuială respinsă: " + r.slice(0, 40))) {
            closeSheet();
            toast("Modificările au fost salvate.");
          }
        },
        10,
      );
      break;
    case "expappr": {
      var e = col("branches/" + b + "/expenses").filter(function (x) {
        return x.id === id;
      })[0];
      var big = isOver(e);
      openSheet(
        "<h2>Aprobă cheltuiala</h2><form><p>" +
          esc(e.desc) +
          "<br><b>" +
          fmt(e.amount) +
          " RON</b></p>" +
          (big
            ? '<p class="small">Peste 500 RON: introdu hotărârea Consiliului de Conducere (Art. 31).</p>' +
              inp("decision", "Număr hotărâre", "", "text", "hn") +
              inp("decisionDate", "Data hotărârii", today(), "date", "hd")
            : "") +
          '<div class="err" id="sheeterr"></div><div class="sheet-acts"><button class="btn" type="submit">Aprobă</button><button class="btn sec" type="button" data-act="closesheet">Renunț</button></div></form>',
        async function (fd) {
          if (e.proposedBy === S.me.id) return fieldErr("Cine propune nu poate aproba aceeași cheltuială.");
          if (big && (!String(fd.get("decision") || "").trim() || !fd.get("decisionDate")))
            return fieldErr("Completează numărul și data hotărârii.");
          if (
            await expUpdate(
              id,
              {
                state: "aprobata",
                approvedBy: S.me.id,
                decision: big ? String(fd.get("decision")).trim() : "",
                decisionDate: big ? fd.get("decisionDate") : "",
                approvedOn: today(),
              },
              "Cheltuială aprobată: " + e.desc.slice(0, 40),
            )
          ) {
            closeSheet();
            toast("Modificările au fost salvate.");
          }
        },
      );
      break;
    }
    case "exppay": {
      var e2 = col("branches/" + b + "/expenses").filter(function (x) {
        return x.id === id;
      })[0];
      if (isOver(e2) && e2.state !== "aprobata") {
        toast("Peste 500 RON, plata cere aprobarea Consiliului.");
        break;
      }
      openSheet(
        "<h2>Marchează plătită</h2><form>" +
          inp("paidOn", "Data plății", today(), "date", "xp") +
          inp("docNo", "Număr document justificativ", e2.docNo || "", "text", "xq") +
          '<p class="help">Fără document justificativ, cheltuiala nu poate fi marcată plătită.</p><div class="err" id="sheeterr"></div><div class="sheet-acts"><button class="btn" type="submit">Salvează</button><button class="btn sec" type="button" data-act="closesheet">Renunț</button></div></form>',
        async function (fd) {
          if (!fd.get("paidOn")) return fieldErr("Alege data.");
          if (!String(fd.get("docNo") || "").trim()) return fieldErr("Completează numărul documentului justificativ.");
          if (
            await expUpdate(
              id,
              { state: "platita", paidOn: fd.get("paidOn"), docNo: String(fd.get("docNo")).trim() },
              "Cheltuială plătită: " + e2.desc.slice(0, 40),
            )
          ) {
            closeSheet();
            toast("Modificările au fost salvate.");
          }
        },
      );
      break;
    }
    case "member": {
      var mb = b;
      scopeBranches().forEach(function (x) {
        if (
          col("branches/" + x + "/members").some(function (y) {
            return y.id === id;
          })
        )
          mb = x;
      });
      var m = col("branches/" + mb + "/members").filter(function (x) {
        return x.id === id;
      })[0];
      if (!m) break;
      S._mb = mb;
      var isPres = myRole().role === "president";
      var mRole = roleOfMember(m);
      var canCode = isPres && !m.excluded;
      var canExclude = isPres && !isSelf(m) && !(mRole && mRole.role === "national");
      var mv = memberValidity(mb, m);
      var linkTxt = S.server
        ? m.userId
          ? "Cont activ în aplicație."
          : "Contul nu e activat încă."
        : m.userId
          ? "Cont legat. Codul: " + esc(m.userId)
          : "Fără cont în aplicație.";
      openSheet(
        "<h2>" +
          esc(m.name) +
          '</h2><p class="small">' +
          linkTxt +
          (mv.vu ? " Valabil până la " + dro(mv.vu) + "." : "") +
          "</p>" +
          (m.excluded ? '<div class="notice">Contul este suspendat de conducerea filialei.</div>' : "") +
          (isPres
            ? "<form>" +
              inp("validUntil", "Calitatea de membru valabilă până la", m.validUntil || "", "date", "mvu") +
              (S.server ? "" : inp("userId", "Codul contului", m.userId || "", "text", "mu", 'autocomplete="off"')) +
              '<div class="sheet-acts"><button class="btn" type="submit">Salvează</button><button class="btn sec" type="button" data-act="closesheet">Închide</button></div></form>'
            : '<div class="sheet-acts"><button class="btn sec" data-act="closesheet">Închide</button></div>') +
          (canCode && (S.server || !m.userId)
            ? '<div class="sec-h"><h2>Cod de înscriere</h2></div><p class="small">' +
              (S.server && m.userId
                ? "Contul e deja activ. Generează un cod nou dacă membrul își schimbă telefonul sau pierde accesul. "
                : "Generează codul pe care membrul îl introduce la prima intrare în aplicație. ") +
              'Codul e valabil 14 zile și se poate folosi o singură dată.</p><button class="btn sec" data-act="gencode" data-id="' +
              esc(m.id) +
              '">Generează cod</button>'
            : "") +
          (canExclude
            ? '<div class="sec-h"><h2>Acces în aplicație</h2></div><p class="small">' +
              (m.excluded
                ? "Reactivarea readuce contul exact cum era."
                : "Excluderea suspendă contul imediat. Nimic nu se șterge, iar contul se poate reactiva oricând.") +
              '</p><div class="acts">' +
              (m.excluded
                ? '<button class="btn" data-act="reactivate" data-id="' + esc(m.id) + '">Reactivează</button>'
                : '<button class="btn crit" data-act="exclude" data-id="' + esc(m.id) + '">Exclude din aplicație</button>') +
              "</div>"
            : ""),
        isPres
          ? async function (fd) {
              var u = S.server ? m.userId || "" : String(fd.get("userId") || "").trim();
              var o = Object.assign({}, m);
              delete o.id;
              o.userId = u;
              var vu = String(fd.get("validUntil") || "");
              if (vu) o.validUntil = vu;
              if (await put("branches/" + mb + "/members", id, o, "update", "Date membru actualizate: " + m.name)) {
                if (u) {
                  await recomputeBadge(mb, id, Object.assign({ id: id }, o));
                }
                closeSheet();
                toast("Modificările au fost salvate.");
              }
            }
          : undefined,
      );
      break;
    }
    case "gencode": {
      var gb = S._mb || b;
      var gm = col("branches/" + gb + "/members").filter(function (x) {
        return x.id === id;
      })[0];
      if (!gm) break;
      if (S.server) {
        try {
          var rr = await svPost("/api/app/code", { branch: gb, memberId: id });
          if (rr.status !== 200) {
            toast(rr.body.error || "Nu am putut genera codul.");
            break;
          }
          showCode(gm.name, rr.body.code, rr.body.expires);
        } catch (e) {
          toast("Nu am putut genera codul.");
        }
        break;
      }
      if (myRole().role !== "president") break;
      var cd = genCode();
      var exp = addDays(today(), 14);
      if (
        await put(
          "branches/" + gb + "/codes",
          cd,
          { memberId: id, createdAt: today(), createdBy: S.me.id, expiresAt: exp, used: false },
          "code",
          "Cod de înscriere generat pentru " + gm.name,
        )
      )
        showCode(gm.name, cd, exp);
      break;
    }
    case "copycode":
      copyText(fmtCode(id), "Codul a fost copiat.");
      break;
    case "newcode":
      try {
        await S.store.del("claims", S.me.id);
      } catch (e) {}
      try {
        await S.store.del("data/users/" + S.me.id, "claim");
      } catch (e) {}
      break;
    case "handover":
      sheetHandover();
      break;
    case "newrole":
      sheetNewRole();
      break;
    case "role":
      sheetRole(id);
      break;
    case "roleoff":
      doRoleOff(id);
      break;
    case "exclude":
      sheetExclude(id);
      break;
    case "exclude2":
      doExclude(id);
      break;
    case "reactivate":
      doReactivate(id);
      break;
    case "natset":
      sheetSetNational();
      break;
    case "natcode":
      doLeaderCode(id);
      break;
    case "addbranch":
      sheetAddBranch();
      break;
    case "branch":
      sheetBranch(id);
      break;
    case "setpres":
      sheetSetPresident(id);
      break;
    case "prescode":
      doLeaderCode(id);
      break;
    case "claim": {
      var c = col("claims").filter(function (x) {
        return x.id === id;
      })[0];
      if (!c) break;
      if (!c.branch) c = Object.assign({}, c, { branch: curBranch(), name: c.name || "Cerere cu cod" });
      var ms = col("branches/" + c.branch + "/members");
      openSheet(
        "<h2>" +
          esc(c.name) +
          '</h2><p class="small">Cerere pentru filiala ' +
          esc(c.branch) +
          ". Verifică persoana în afara aplicației (o cunoști sau o suni), apoi leagă-o de un membru din evidență.</p><form>" +
          sel(
            "memberId",
            [["", "Membru nou, adăugat din cerere"]].concat(
              ms.map(function (m) {
                return [m.id, m.name];
              }),
            ),
            "",
            "Membru din evidență",
            "cm",
          ) +
          '<div class="sheet-acts"><button class="btn" type="submit">Verifică și leagă</button><button class="btn sec" type="button" data-act="closesheet">Închide</button></div></form>',
        async function (fd) {
          var mid = fd.get("memberId");
          var bb = c.branch;
          try {
            if (mid) {
              var m = ms.filter(function (x) {
                return x.id === mid;
              })[0];
              var o = Object.assign({}, m);
              delete o.id;
              o.userId = id;
              if (!o.validUntil) o.validUntil = defaultValid();
              await S.store.set("branches/" + bb + "/members", mid, o);
            } else {
              mid = uid();
              await S.store.set("branches/" + bb + "/members", mid, { name: c.name, branch: bb, userId: id, validUntil: defaultValid() });
            }
            await S.store.set("badges", id, { verified: true, active: true, validUntil: defaultValid(), excluded: false, branch: bb });
            await recomputeBadge(bb, mid);
            await safe(function () {
              return S.store.set("claims", id, Object.assign({}, c, { id: undefined, processed: true, status: "Verificat manual" }));
            });
            await safe(function () {
              return audit("badges", id, "verify", "Membru verificat: " + c.name);
            });
            closeSheet();
            toast("Modificările au fost salvate.");
          } catch (e) {
            toast("Scrierea a fost refuzată. Verifică nivelul de acces al contului.");
          }
        },
      );
      break;
    }
    case "csvfees":
      copyText(
        csv(
          [["membru", "an", "suma_datorata", "stare", "data_plata", "metoda", "platitor_tert", "recuperat", "anulat"]].concat(
            col("branches/" + b + "/fees").map(function (f) {
              return [
                memberName(b, f.memberId),
                f.year,
                f.due / 100,
                FEE_STATE[f.state][0],
                f.paidOn || "",
                f.method || "",
                f.thirdParty || "",
                f.recovered ? "da" : "nu",
                f.anulat ? "da" : "nu",
              ];
            }),
          ),
        ),
        "CSV copiat.",
      );
      break;
    case "csvdon":
      copyText(
        csv(
          [["donator", "suma", "data", "scop", "tip", "document", "anulat"]].concat(
            col("branches/" + b + "/donations").map(function (d) {
              return [d.anonymous ? "Anonim" : d.donor, d.amount / 100, d.date, d.purpose, d.type, d.doc, d.anulat ? "da" : "nu"];
            }),
          ),
        ),
        "CSV copiat.",
      );
      break;
    case "csvexp":
      copyText(
        csv(
          [["categorie", "descriere", "suma", "data", "furnizor", "document", "stare"]].concat(
            col("branches/" + b + "/expenses").map(function (e) {
              return [e.category, e.desc, e.amount / 100, e.date, e.supplier, e.docNo, e.anulat ? "anulată" : EXP_STATE[e.state][0]];
            }),
          ),
        ),
        "CSV copiat.",
      );
      break;
  }
}
function bindMain() {
  var m = document.getElementById("main");
  var q = document.getElementById("q");
  if (q)
    q.addEventListener("input", function () {
      S.q = q.value;
      document.getElementById("dirlist").innerHTML = dirListHtml();
    });
  var bs = document.getElementById("brsel");
  if (bs)
    bs.addEventListener("change", function () {
      S.branch = bs.value;
      render();
    });
  var pf = document.getElementById("pform");
  if (pf)
    pf.addEventListener("submit", function (ev) {
      ev.preventDefault();
      saveProfile(new FormData(pf));
    });
}
document.addEventListener("click", function (ev) {
  var t = ev.target.closest("[data-act]");
  if (t) {
    onAct(t.getAttribute("data-act"), t.getAttribute("data-id"));
    return;
  }
  if (ev.target.id === "sheetwrap") closeSheet();
});
document.addEventListener("focusout", function () {
  setTimeout(function () {
    if (S._stale) render();
  }, 80);
});
document.addEventListener("change", function (ev) {
  var dr = ev.target;
  if (dr && dr.id === "demorole") {
    S.me = { id: dr.value, isOwner: false };
    S.tab = "director";
    S.mode = "ready";
    subscribeAll();
    render();
  }
});
document.addEventListener("keydown", function (ev) {
  if (ev.key === "Escape") closeSheet();
});
window.addEventListener("hashchange", function () {
  var h = location.hash.replace("#", "");
  if (
    tabsFor().some(function (t) {
      return t[0] === h;
    }) &&
    h !== S.tab
  ) {
    S.tab = h;
    render();
  }
});
/* Catalogul vizual al componentelor, la /app?ui. Date fictive, fără server, nimic nu se salvează.
   Rol: referința grafică a aplicației. Un ecran nou se compune din piesele de aici, fără stiluri noi. */
function renderCatalog() {
  var d = function (n) {
    return addDays(today(), n);
  };
  var sec = function (title, note, html) {
    return uiSection(title) + (note ? '<p class="small" style="margin-bottom:12px">' + esc(note) + "</p>" : "") + html;
  };
  var head =
    '<header class="top">' +
    logoHtml() +
    '<span class="small" style="color:var(--hero-ink)">Catalog</span><button class="ibtn" data-act="theme" aria-label="Schimbă tema">' +
    svg("sun", 22) +
    '</button><span class="ibtn">' +
    uiAvatar("Andrei Popescu") +
    "</span></header>";
  var nav =
    '<nav class="tabs" aria-label="Navigare (exemplu pentru membri)">' +
    [
      ["Director", "dir", 0],
      ["Evenimente", "cal", 1],
      ["Voturi", "vote", 0],
      ["Rețea", "net", 0],
      ["Profil", "me", 0],
    ]
      .map(function (t) {
        return "<button" + (t[2] ? ' aria-current="page"' : "") + ">" + svg(t[1], 24) + "<span>" + t[0] + "</span></button>";
      })
      .join("") +
    "</nav>";
  var h =
    '<div class="page-head"><h1>Catalog de componente</h1></div>' +
    '<div class="notice info">Date fictive. Pagina arată piesele din care se construiesc ecranele aplicației; nimic nu se salvează.</div>';

  h += sec(
    "Roluri și insigne",
    "",
    '<div class="acts" style="margin:0 0 24px">' +
      uiTag("Președinte național", "brand") +
      uiTag("Președinte", "brand") +
      uiTag("Vicepreședinte", "brand") +
      uiTag("Trezorier", "brand") +
      uiTag("Membru", "neutral") +
      '<span class="seal">' +
      svg("seal", 14) +
      "Membru activ</span>" +
      uiTag("Cotizație achitată", "good", "check") +
      uiTag("Expiră în 20 de zile", "warn", "clock") +
      uiTag("Suspendat", "crit", "x") +
      "</div>",
  );

  h += sec(
    "Buget și statistici",
    "Membrii văd totalurile; conducerea vede și fiecare rând.",
    uiHero("Sold 2026, Brașov", 1845000, "Încasat 42.700,00 RON, cheltuit 24.250,00 RON") +
      uiStats([
        { l: "Încasat", n: "42.700,00", unit: "RON", s: "cotizații, sponsorizări, bilete" },
        { l: "Cheltuit", n: "24.250,00", unit: "RON", s: "9 evenimente" },
        { l: "Evenimente", n: "9", s: "312 participări" },
        { l: "Membri activi", n: "38", s: "din 44 în evidență" },
      ]),
  );

  h += sec(
    "Evenimente",
    "Membrul își confirmă participarea și își notează contribuția.",
    '<div class="list">' +
      uiEvent({ id: "e1", title: "Beyond the Initiative", date: d(15), place: "CATTIA Brașov", count: 96, going: false }) +
      uiEvent({ id: "e2", title: "Seară de networking", date: d(4), place: "Sediul filialei", count: 21, going: true }) +
      uiEvent({
        id: "e3",
        title: "Atelier de vorbit în public",
        date: d(-20),
        place: "Brașov",
        count: 34,
        going: true,
        past: true,
        income: 420000,
        spent: 265000,
        mine: "am adus sponsorul pentru sală",
      }) +
      "</div>",
  );

  h += sec(
    "Voturi",
    "Un vot deschis, unul la care ai votat deja și unul închis, cu rezultat.",
    '<div class="list">' +
      uiPoll({
        id: "p1",
        title: "Aprobăm bugetul pentru evenimentul din primăvară?",
        scope: "Adunarea generală, Brașov",
        closes: d(6),
        state: "open",
        canVote: true,
        options: [
          { id: "da", label: "Da" },
          { id: "nu", label: "Nu" },
          { id: "ab", label: "Mă abțin" },
        ],
      }) +
      uiPoll({
        id: "p2",
        title: "Data adunării generale de iarnă",
        scope: "Adunarea generală, Brașov",
        closes: d(2),
        state: "open",
        voted: "a",
        options: [
          { id: "a", label: "12 decembrie" },
          { id: "b", label: "19 decembrie" },
        ],
      }) +
      uiPoll({
        id: "p3",
        title: "Orașul conferinței naționale de anul viitor",
        scope: "Președinții de filiale",
        closes: d(-9),
        state: "closed",
        showResults: true,
        voted: "bv",
        voters: 12,
        options: [
          { id: "bv", label: "Brașov", votes: 6 },
          { id: "cj", label: "Cluj", votes: 3 },
          { id: "b", label: "București", votes: 2 },
        ],
      }) +
      "</div>",
  );

  h += sec(
    "Încasări și cheltuieli",
    "Doar denumire și sumă, fără documente încărcate.",
    '<div class="list">' +
      uiMoney({
        id: "m1",
        title: "Sponsorizare eveniment de lansare",
        date: d(-3),
        amount: 500000,
        kind: "in",
        meta: "Beyond the Initiative",
      }) +
      uiMoney({ id: "m2", title: "Închiriere sală", date: d(-5), amount: 120000, kind: "out", meta: "Beyond the Initiative" }) +
      uiMoney({ id: "m3", title: "Materiale tipărite", date: d(-8), amount: 32000, kind: "out", cancelled: true }) +
      '</div><div class="acts" style="margin:-8px 0 24px"><button class="btn sm">Adaugă încasare</button><button class="btn sec sm">Adaugă cheltuială</button></div>',
  );

  h += sec(
    "Mulțumiri de networking",
    "Suma generată printr-o colaborare cu un alt membru și un mesaj scurt. Fără documente.",
    uiHero("Am generat prin JCI", 1250000, "3 colaborări în 2026") +
      '<div class="list">' +
      uiThanks({
        who: "Maria Stoica",
        branch: "Cluj",
        date: d(-2),
        amount: 800000,
        dir: "sent",
        msg: "Mulțumesc pentru recomandare: am semnat contractul de mentenanță.",
      }) +
      uiThanks({
        who: "Radu Ionescu",
        branch: "București",
        date: d(-12),
        amount: 150000,
        dir: "received",
        msg: "Campania făcută împreună a adus primii clienți. Mulțumesc.",
      }) +
      "</div>",
  );

  h += sec(
    "Profil",
    "Poză, firmă, site și date de contact, fiecare cu acordul membrului.",
    uiPhotoPicker("Andrei Popescu", "") +
      '<div class="profile-head">' +
      uiAvatar("Andrei Popescu", "", "lg") +
      '<div><h2>Andrei Popescu</h2><p class="small">Popescu și Asociații<span class="sep"></span>Juridic<span class="sep"></span>Brașov</p></div></div>' +
      '<div class="acts" style="margin:0 0 24px"><button class="btn sm">Sună</button><button class="btn sec sm">Scrie un e-mail</button><button class="btn sec sm">Deschide site-ul</button></div>',
  );

  h += sec(
    "Regulile filialei",
    "Președintele alege ce văd membrii filialei.",
    '<div class="list">' +
      uiSwitch("r1", "Bugetul total, vizibil membrilor", "Cât s-a încasat și cât s-a cheltuit, pe an.", true) +
      uiSwitch("r2", "Sumele pe fiecare eveniment", "Încasat și cheltuit, la fiecare eveniment.", true) +
      uiSwitch("r3", "Lista detaliată de încasări și cheltuieli", "Fără această opțiune, lista o vede doar conducerea.", false) +
      uiSwitch("r4", "Rezultatul votului înainte de închidere", "", false, true) +
      "</div>",
  );

  h += sec(
    "Butoane și câmpuri",
    "",
    '<div class="acts" style="margin:0 0 16px"><button class="btn">Salvează</button><button class="btn sec">Anulează</button><button class="btn crit">Exclude membrul</button><button class="btn" disabled>Inactiv</button></div>' +
      uiChips(
        [
          ["a", "Toate"],
          ["b", "Brașov"],
          ["c", "Cluj"],
          ["d", "București"],
        ],
        "a",
        "none",
      ) +
      '<form style="max-width:420px">' +
      inp("x1", "Denumire", "Sponsorizare", "text", "cx1") +
      inp("x2", "Sumă (RON)", "500,00", "text", "cx2", 'inputmode="decimal"') +
      sel("x3", ["Încasare", "Cheltuială"], "Încasare", "Tip", "cx3") +
      '<label class="check"><input type="checkbox" checked><span>Doresc să afișez în director numărul meu de telefon.</span></label><div class="err">Completează câmpul Denumire.</div></form>',
  );

  h += sec(
    "Stări",
    "",
    '<div class="notice">Calitatea ta de membru a expirat. Accesul se suspendă automat după 3 luni fără plată.</div>' +
      '<div class="notice info">Votul se închide la data stabilită de președinte.</div>' +
      '<div class="list">' +
      row({ avatar: "Bianca Rusu", title: "Bianca Rusu", meta: "Cont activ", right: uiTag("Restanță", "warn", "clock"), stripe: "warn" }) +
      row({ avatar: "Vlad Munteanu", title: "Vlad Munteanu", meta: "Cont neactivat", right: uiTag("Fără cod", "neutral") }) +
      "</div>" +
      emptyBox("Niciun eveniment încă", "Evenimentele filialei apar aici după ce le adaugă conducerea.", "", ""),
  );

  h += sec(
    "Filigran",
    "Numele celui care privește, peste paginile cu date de contact. Descurajează capturile de ecran; o pagină web nu le poate opri.",
    '<div class="wm-box"><div class="list" style="margin:0">' +
      row({ avatar: "Maria Stoica", title: "Maria Stoica", meta: "0722 000 111 | maria@exemplu.ro" }) +
      row({ avatar: "Radu Ionescu", title: "Radu Ionescu", meta: "0733 000 222 | radu@exemplu.ro" }) +
      "</div>" +
      uiWatermark("Andrei Popescu, " + dro(today())) +
      "</div>",
  );

  document.getElementById("app").innerHTML = head + nav + '<main id="main" tabindex="-1">' + h + "</main>";
}
document.addEventListener("submit", function (ev) {
  if (S.mode === "ui") ev.preventDefault();
});
/* Pornirea aplicației */
async function start() {
  var th = lsGet("jcib-theme");
  if (th) document.documentElement.setAttribute("data-theme", th);
  if (/(^|[?&])ui(=|&|$)/.test(location.search.slice(1))) {
    S.mode = "ui";
    renderCatalog();
    return;
  }
  S.mode = "loading";
  render();
  if (S.server) {
    try {
      var rs = await fetch("/api/app/me", { credentials: "same-origin" });
      var js = await rs.json().catch(function () {
        return {};
      });
      if (rs.status === 200) {
        S.me = {
          id: String(js.id),
          isOwner: js.isOwner === true,
          name: String(js.name || ""),
          branch: String(js.branch || ""),
          role: String(js.role || ""),
          title: String(js.title || ""),
        };
        S.store = makeHttpStore();
        S.mode = "ready";
        var hs = location.hash.replace("#", "");
        if (hs) S.tab = hs;
        subscribeAll();
        render();
        return;
      }
      if (rs.status === 403 && js.excluded) {
        S.mode = "excluded";
        document.getElementById("app").innerHTML = renderExcluded(js);
        return;
      }
      if (rs.status === 401) {
        S.mode = "login";
        showServerLogin();
        return;
      }
    } catch (e) {}
    S.mode = "error";
    render();
    return;
  }
  var live = false;
  try {
    if (window.claude && typeof window.claude.use === "function") {
      var timeout = new Promise(function (r) {
        setTimeout(function () {
          r(null);
        }, 6000);
      });
      var got = await Promise.race([Promise.all([window.claude.use("db"), window.claude.use("user")]), timeout]);
      if (got && got[0] && got[1]) {
        var db = got[0],
          user = got[1];
        var id = await user.id();
        var ow = await Promise.resolve(user.isOwner && user.isOwner());
        S.me = { id: String(id), isOwner: ow === true };
        S.store = makeLiveStore(db);
        live = true;
      }
    }
  } catch (e) {
    live = false;
  }
  if (!live) {
    if (window.claude && typeof window.claude.use === "function") {
      S.mode = "error";
      render();
      return;
    }
    S.store = makeMemStore(demoSeed);
    S.me = { id: "u-nat", isOwner: false };
    S.note = "";
  }
  S.mode = "ready";
  var h = location.hash.replace("#", "");
  if (h) S.tab = h;
  subscribeAll();
  render();
}
start();
