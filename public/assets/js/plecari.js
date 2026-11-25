// Plecări și mutări la Blitz Networking (worker/checkin.js, /checkin/plecari).
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function row(x, extra) {
    var b = x.plecat
      ? '<button type="button" data-a="revine" data-t="' + esc(x.token) + '">A revenit</button>'
      : '<span style="display:flex;gap:6px;flex:none"><button type="button" data-a="muta" data-t="' + esc(x.token) + '">Mută</button>' +
        '<button type="button" data-a="pleaca" data-t="' + esc(x.token) + '" style="background:#D64545">A plecat</button></span>';
    return '<div class="res"><div><b>' + esc(x.cod) + " " + esc(x.nume) + "</b><small>" + esc(extra || ("Mese: " + x.mese.join(", "))) + "</small></div>" + b + "</div>";
  }
  function post(url, body) {
    return fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { if (r.status === 401) { location.href = "/checkin"; throw new Error("auth"); } return r.json(); });
  }
  function load() {
    var q = $("q").value.trim();
    return fetch("/api/echipa/plecari?q=" + encodeURIComponent(q), { credentials: "same-origin" })
      .then(function (r) { if (r.status === 401) { location.href = "/checkin"; throw new Error("auth"); } return r.json(); })
      .then(function (d) {
        $("rez").innerHTML = q.length < 2 ? "" : (d.rezultate.map(function (x) { return row(x); }).join("") || '<p class="muted mt">Nimeni cu acest nume sau telefon printre cei intrați.</p>');
        $("mici").innerHTML = d.mici.map(function (x) { return row(x, "Grupă prea mică la runda " + x.runde.join(", ")); }).join("") || '<p class="muted mt">Toate grupele au cel puțin 3 persoane.</p>';
        $("plecati").innerHTML = d.plecati.map(function (x) { return row(x); }).join("") || '<p class="muted mt">Nimeni.</p>';
      }).catch(function () {});
  }
  var qt;
  $("q").addEventListener("input", function () { clearTimeout(qt); qt = setTimeout(load, 250); });
  document.addEventListener("click", function (e) {
    var a = e.target.getAttribute && e.target.getAttribute("data-a"), t = e.target.getAttribute && e.target.getAttribute("data-t");
    if (!a || !t) return;
    e.target.disabled = true;
    var p = a === "muta" ? post("/api/echipa/muta", { token: t, from: Number($("from").value) || 1 }) : post("/api/echipa/plecare", { token: t, undo: a === "revine" });
    p.then(function (d) {
      if (a === "muta") {
        var msg = !d.ok ? (d.error || "Eroare") : d.mutat ? "Mutat la runda " + d.runde.join(", ") + ". Mese noi: " + d.mese.join(", ") + ". Ecusonul se retipărește la laptop." : "Grupele persoanei au deja cel puțin 3 oameni. Nu a fost mutată.";
        var n = document.createElement("p"); n.className = "muted mt"; n.style.color = "#EFC40F"; n.textContent = msg;
        e.target.closest(".card").appendChild(n); setTimeout(function () { n.remove(); }, 9000);
      }
      return load();
    }).catch(function () { e.target.disabled = false; });
  });
  load(); setInterval(load, 15000);
})();
