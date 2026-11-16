// Chestionarul completat de persoană, la /q/<cod> (worker/apeluri.js). Fără script inline (CSP).
(function () {
  var root = document.getElementById("cq");
  if (!root) return;
  var g = function (id) { return document.getElementById(id); };
  var val = function (id) { var e = g(id); return e ? e.value.trim() : ""; };
  var on = function (id) { var e = g(id); return !!(e && e.checked); };
  var paid = root.getAttribute("data-vip") === "1";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function mark(id, bad) {
    var e = g(id);
    if (!e) return;
    if (bad) { e.classList.add("bad"); e.setAttribute("aria-invalid", "true"); }
    else { e.classList.remove("bad"); e.removeAttribute("aria-invalid"); }
    var l = e.closest ? e.closest(".chk") : null;
    if (l) { if (bad) l.classList.add("bad"); else l.classList.remove("bad"); }
  }
  function clearErr(id) {
    mark(id, false);
    if (!root.querySelector(".bad")) g("qerr").innerHTML = "";
  }
  function fail(msg, ids) {
    g("qerr").innerHTML = '<div class="err" role="alert">' + esc(msg) + "</div>";
    (ids || []).forEach(function (id) { mark(id, true); });
    var first = ids && ids.length ? g(ids[0]) : g("qerr");
    if (first && first.scrollIntoView) first.scrollIntoView({ block: "center" });
    if (first && first.focus && ids && ids.length) first.focus({ preventScroll: true });
  }
  // Domeniile țintă apar doar pentru cine vrea bilet VIP sau are deja unul.
  g("q_vip").addEventListener("change", function () { g("q_tinte").hidden = !(paid || val("q_vip") === "da"); });
  // Starea de eroare dispare de pe câmpul modificat.
  ["q_vine", "q_nume", "q_email", "q_ocupatie", "q_dom", "q_vip", "q_acord"].forEach(function (id) {
    var e = g(id);
    if (e) { e.addEventListener("input", function () { clearErr(id); }); e.addEventListener("change", function () { clearErr(id); }); }
  });
  root.querySelectorAll("[data-tinta]").forEach(function (c) { c.addEventListener("change", function () { clearErr("q_tinte"); }); });
  // Câmpurile lipsă, în ordinea din formular, după aceleași reguli ca pe server (chestionarSave).
  function missing() {
    var m = [], v = val("q_vine"), tinte = [];
    var add = function (id, name) { m.push({ id: id, name: name }); };
    if (!v) return [{ id: "q_vine", name: "1. Participarea la eveniment" }];
    if (v === "stop") return m;
    if (val("q_nume").length < 3) add("q_nume", "2. Numele și prenumele");
    if (v === "da") {
      if (g("q_email") && !/^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/.test(val("q_email"))) add("q_email", "3. Adresa de e-mail");
      if (!val("q_ocupatie")) add("q_ocupatie", "4. Ocupația");
      if (!val("q_dom")) add("q_dom", "5. Domeniul de activitate");
      if (!val("q_vip")) add("q_vip", "7. Interesul pentru biletul VIP");
    }
    if (!g("q_tinte").hidden) root.querySelectorAll("[data-tinta]").forEach(function (c) { if (c.checked) tinte.push(c.getAttribute("data-tinta")); });
    if (v === "da" && !g("q_tinte").hidden && val("q_vip") && tinte.length < 1) add("q_tinte", "7a. Domeniile pentru Blitz Networking");
    if (tinte.length > 3) add("q_tinte", "7a. Cel mult 3 domenii pentru Blitz Networking");
    if (!on("q_acord")) add("q_acord", "Acordul privind prelucrarea datelor");
    return m;
  }
  g("q_save").addEventListener("click", function () {
    var btn = g("q_save");
    g("qerr").innerHTML = "";
    root.querySelectorAll(".bad").forEach(function (e) { e.classList.remove("bad"); e.removeAttribute("aria-invalid"); });
    var miss = missing();
    if (miss.length) return fail("Completează: " + miss.map(function (x) { return x.name; }).join(", ") + ".", miss.map(function (x) { return x.id; }));
    var tinte = [];
    if (!g("q_tinte").hidden) root.querySelectorAll("[data-tinta]").forEach(function (c) { if (c.checked) tinte.push(c.getAttribute("data-tinta")); });
    btn.disabled = true; btn.textContent = "Se trimite...";
    fetch("/api/chestionar", {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({
        cod: root.getAttribute("data-cod"), vine: val("q_vine"), nume: val("q_nume"), email: val("q_email"), ocupatie: val("q_ocupatie"),
        domeniu: val("q_dom"), intrebare: val("q_intrebare"), vip: val("q_vip"), tinte: tinte,
        acord: on("q_acord"), viitor: on("q_viitor"), bcr: on("q_bcr")
      })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) { btn.disabled = false; btn.textContent = "Trimite răspunsurile"; return fail(j.error || "Nu s-a putut trimite. Încearcă din nou.", (j.lipsa || []).filter(function (id) { return g(id); })); }
      var msg = "Am primit răspunsurile tale.", val2 = val("q_vip");
      if (j.rezultat === "inscris_confirmat") msg = "Locul tău este confirmat. Biletul ajunge pe e-mail în câteva minute.";
      else if (j.rezultat === "inscris_asteptare") msg = "Locurile din sală sunt ocupate, așa că te-am trecut pe lista de așteptare. Te anunțăm imediat ce se eliberează un loc.";
      else if (j.rezultat === "email_existent") msg = "Adresa de e-mail este deja înscrisă la eveniment. Am păstrat răspunsurile tale.";
      else if (j.stop) msg = "Am notat. Nu te vom mai contacta în legătură cu acest eveniment.";
      else if (j.status === "confirmat") msg = "Locul tău este confirmat. Te așteptăm pe 26 noiembrie, de la ora 17:00, la CATTIA Brașov.";
      else if (j.status === "nu_participa") msg = "Ne pare rău că nu poți ajunge. Sperăm să ne vedem la un eveniment viitor.";
      root.innerHTML = '<div class="card"><h1>Mulțumim!</h1><p class="mt">' + esc(msg) + "</p>" +
        (val2 === "da" ? '<p class="mt">Pentru biletul VIP: jci-brasov.com/eveniment#vip</p>' : "") + "</div>";
      window.scrollTo(0, 0);
    }).catch(function () { btn.disabled = false; btn.textContent = "Fără conexiune. Încearcă din nou"; });
  });
})();
