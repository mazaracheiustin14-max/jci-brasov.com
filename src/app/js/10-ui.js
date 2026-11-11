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
var LOGO_SRC = "/app/logo.png";
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
