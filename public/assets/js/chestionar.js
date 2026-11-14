// Chestionarul completat de persoană, la /q/<cod> (worker/apeluri.js). Fără script inline (CSP).
(function () {
  var root = document.getElementById("cq");
  if (!root) return;
  var g = function (id) { return document.getElementById(id); };
  var val = function (id) { var e = g(id); return e ? e.value.trim() : ""; };
  var on = function (id) { var e = g(id); return !!(e && e.checked); };
  var paid = root.getAttribute("data-vip") === "1";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fail(msg, id) {
    g("qerr").innerHTML = '<div class="err">' + esc(msg) + "</div>";
    var e = g(id || "qerr");
    if (e && e.scrollIntoView) e.scrollIntoView({ block: "center" });
  }
  // Domeniile țintă apar doar pentru cine vrea bilet VIP sau are deja unul.
  g("q_vip").addEventListener("change", function () { g("q_tinte").hidden = !(paid || val("q_vip") === "da"); });
  g("q_save").addEventListener("click", function () {
    var btn = g("q_save");
    g("qerr").innerHTML = "";
    if (!val("q_vine")) return fail("Alege dacă participi la eveniment.", "q_vine");
    var vine = val("q_vine") === "da", stop = val("q_vine") === "stop", nou = !!g("q_email");
    if (vine && nou && !/^\S+@\S+\.\S+$/.test(val("q_email"))) return fail("Pentru bilet avem nevoie de o adresă de e-mail validă.", "q_email");
    if (!stop && !on("q_acord")) return fail("Pentru a trimite răspunsurile este necesar acordul privind prelucrarea datelor.", "q_acord");
    var tinte = [];
    if (!g("q_tinte").hidden) root.querySelectorAll("[data-tinta]").forEach(function (c) { if (c.checked) tinte.push(c.getAttribute("data-tinta")); });
    if (tinte.length > 3) return fail("Alege cel mult 3 domenii.", "q_tinte");
    btn.disabled = true; btn.textContent = "Se trimite...";
    fetch("/api/chestionar", {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({
        cod: root.getAttribute("data-cod"), vine: val("q_vine"), nume: val("q_nume"), email: val("q_email"), ocupatie: val("q_ocupatie"),
        domeniu: val("q_dom"), intrebare: val("q_intrebare"), vip: val("q_vip"), tinte: tinte,
        acord: on("q_acord"), viitor: on("q_viitor"), bcr: on("q_bcr")
      })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) { btn.disabled = false; btn.textContent = "Trimite răspunsurile"; return fail(j.error || "Nu s-a putut trimite. Încearcă din nou."); }
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
