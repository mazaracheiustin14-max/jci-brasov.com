// Validare comună pentru formularele de pe site (eveniment: înscriere și sponsori; inscriere: membri), RO și EN.
// Unele browsere încorporate (Instagram, Facebook) sar peste validarea nativă, iar formularele cu novalidate nu o au deloc.
// La trimitere se verifică fiecare câmp obligatoriu; dacă lipsesc, formularul nu pleacă, iar mesajul din formular
// listează toate câmpurile lipsă, fiecare câmp primește aria-invalid și clasa "bad", iar primul e centrat și primește focus.
// Fără script inline (CSP). Pagina trimite după aceleași reguli și la worker (worker/index.js).
(function () {
  var en = (document.documentElement.lang || "ro").slice(0, 2) === "en";
  var T = en
    ? { lead: "Please complete the required fields: ", sep: ", ", end: ".", email: "Please enter a valid email address.", consent: "Consent to data processing", fee: "Membership fee acknowledgement" }
    : { lead: "Completează câmpurile obligatorii: ", sep: ", ", end: ".", email: "Introdu o adresă de email validă.", consent: "Acordul privind datele personale", fee: "Confirmarea cotizației" };
  var NAMES = { "acord": T.consent, "Acord date": T.consent, "Accept cotizatie": T.fee };
  var EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/;

  function labelOf(el) {
    var nm = el.getAttribute("name");
    if (el.type === "checkbox" && NAMES[nm]) return NAMES[nm];
    var l = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
    if (!l && el.closest) l = el.closest("label");
    if (!l) return nm || el.id || "";
    var c = l.cloneNode(true);
    c.querySelectorAll(".req,.optl,a").forEach(function (x) { x.parentNode.removeChild(x); });
    var t = (c.textContent || "").replace(/\s+/g, " ").replace(/\*/g, "").trim().replace(/[?:.]+$/, "");
    if (t.length > 60) t = t.slice(0, 57).replace(/\s+\S*$/, "") + "…";
    return t;
  }
  function isBad(el) {
    var t = (el.type || "").toLowerCase(), v = (el.value || "").trim();
    if (t === "checkbox" || t === "radio") return !el.checked;
    if (!v) return true;
    var min = parseInt(el.getAttribute("minlength") || "0", 10);
    if (min && v.length < min) return true;
    if (t === "email") return !EMAIL.test(v);
    if (t === "tel") return v.replace(/\D/g, "").length < 9;
    if (t === "number") {
      var n = parseFloat(v), lo = el.getAttribute("min"), hi = el.getAttribute("max");
      return isNaN(n) || (lo !== null && lo !== "" && n < parseFloat(lo)) || (hi !== null && hi !== "" && n > parseFloat(hi));
    }
    return false;
  }
  function mark(el, bad) {
    if (bad) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
    var box = el.closest ? el.closest(".field,.check") : null;
    if (box) box.classList.toggle("bad", !!bad);
  }
  function msgBox(f) {
    var m = f.querySelector(".form-msg");
    if (!m) {
      m = document.createElement("div");
      m.className = "form-msg"; m.setAttribute("role", "status");
      var b = f.querySelector("button[type=submit]");
      if (b && b.parentNode) b.parentNode.insertBefore(m, b); else f.appendChild(m);
    }
    return m;
  }
  function required(f) {
    return Array.prototype.filter.call(f.querySelectorAll("input[required],select[required],textarea[required]"), function (el) {
      return el.type !== "hidden" && !el.disabled;
    });
  }
  // Întoarce lista câmpurilor lipsă: [{ el, name }]
  function check(f) {
    var out = [];
    required(f).forEach(function (el) { if (isBad(el)) out.push({ el: el, name: labelOf(el) }); });
    return out;
  }
  function wire(f) {
    required(f).forEach(function (el) {
      var clear = function () {
        mark(el, false);
        if (!f.querySelector('[aria-invalid="true"]')) { var m = msgBox(f); m.className = "form-msg"; m.textContent = ""; }
      };
      el.addEventListener("input", clear); el.addEventListener("change", clear);
    });
    // Faza de captură: dacă ceva lipsește, restul handlerelor de submit (starea „Se trimite”, mesajele generice) nu mai rulează.
    f.addEventListener("submit", function (e) {
      var miss = check(f);
      f.querySelectorAll('[aria-invalid="true"]').forEach(function (x) { mark(x, false); });
      if (!miss.length) return;
      e.preventDefault(); e.stopImmediatePropagation();
      miss.forEach(function (x) { mark(x.el, true); });
      var m = msgBox(f), names = [];
      miss.forEach(function (x) { if (x.name && names.indexOf(x.name) < 0) names.push(x.name); });
      m.textContent = T.lead + names.join(T.sep) + T.end;
      m.className = "form-msg show err";
      var first = miss[0].el;
      if (first.scrollIntoView) first.scrollIntoView({ block: "center", behavior: "smooth" });
      if (first.focus) first.focus({ preventScroll: true });
    }, true);
  }
  Array.prototype.forEach.call(document.querySelectorAll("form.signup"), function (f) {
    var a = f.getAttribute("action") || "";
    if (a === "/api/form" || a === "/api/inscriere") wire(f);
  });
  window.jciFormCheck = check;
})();
