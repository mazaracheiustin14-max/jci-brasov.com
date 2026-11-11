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
