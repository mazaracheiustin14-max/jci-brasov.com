// Stația de printare a ecusoanelor Blitz Networking (worker/checkin.js, /checkin/print).
(function () {
  "use strict";
  var SYM = {
    A: '<circle cx="50" cy="50" r="46"/>',
    B: '<polygon points="50,4 96,90 4,90"/>',
    C: '<rect x="8" y="8" width="84" height="84"/>',
    D: '<polygon points="50,2 98,50 50,98 2,50"/>',
    E: '<polygon points="50,2 61,37 98,37 68,59 79,95 50,73 21,95 32,59 2,37 39,37"/>',
    F: '<polygon points="98,50 74,92 26,92 2,50 26,8 74,8"/>'
  };
  var $ = function (id) { return document.getElementById(id); };
  var on = false, busy = false, done = 0, log = [];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function labelHtml(j) {
    var sym = SYM[j.bloc] || SYM.A;
    function grup(titlu, from) {
      var h = '<div class="sg"><div class="sh">' + titlu + '</div><div class="cs">';
      for (var i = from; i < from + 3; i++) h += "<div><span>Runda " + (i + 1) + "</span><b>" + esc(j.mese[i] || "") + "</b></div>";
      return h + "</div></div>";
    }
    var dm = [j.domeniu, j.companie].filter(Boolean).join(" | ");
    return '<div class="eb' + (j.vip ? " vip" : "") + '"><div class="band"><div class="sym"><svg viewBox="0 0 100 100" fill="#fff">' + sym + "</svg></div>" +
      '<div class="code">' + esc(j.bloc + j.nr) + '</div><div class="bn">' + (j.vip ? '<span class="vipt">VIP</span>' : "") + "<span>" + esc(j.blocNume) + "</span></div></div>" +
      '<div class="nm">' + esc(j.nume) + "</div>" + (dm ? '<div class="dm">' + esc(dm) + "</div>" : "") +
      '<div class="rt">' + grup("SESIUNEA 1", 0) + grup("SESIUNEA 2", 3) + "</div></div>";
  }
  function fit(root) {
    var n = root.querySelector(".nm"); if (!n) return;
    var size = 25; n.style.fontSize = size + "pt";
    while (n.scrollWidth > n.clientWidth && size > 12) { size -= 0.5; n.style.fontSize = size + "pt"; }
  }
  function render(j) {
    $("label").innerHTML = labelHtml(j); $("lab-host").innerHTML = labelHtml(j);
    $("label").style.display = "block"; fit($("label")); $("label").style.display = "";
    fit($("lab-host"));
  }
  function printJob(j) {
    render(j);
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    return ready.then(function () {
      return new Promise(function (res) { setTimeout(function () { window.print(); setTimeout(res, 1200); }, 120); });
    });
  }
  function post(url, body) {
    return fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { if (r.status === 401) { location.href = "/checkin"; throw new Error("auth"); } return r.json(); });
  }
  function addLog(j) {
    log.unshift(j); log = log.slice(0, 15);
    $("log").innerHTML = log.map(function (x, i) {
      return '<div class="it"><span><b>' + esc(x.bloc + x.nr) + "</b> " + esc(x.nume) + (x.vip ? " (VIP)" : "") + '</span><button type="button" data-i="' + i + '">Retipărește</button></div>';
    }).join("");
  }
  $("log").addEventListener("click", function (e) {
    var i = e.target.getAttribute && e.target.getAttribute("data-i");
    if (i != null && !busy) { busy = true; printJob(log[+i]).then(function () { busy = false; }); }
  });
  function tick() {
    if (!on || busy) return;
    busy = true;
    post("/api/echipa/print-next").then(function (d) {
      $("left").textContent = d.left || 0;
      $("warn").textContent = d.faraLoc ? d.faraLoc + " persoane intrate nu au primit loc în bloc. Verifică în panoul de check-in." : "";
      if (!d.job) { busy = false; return; }
      return printJob(d.job).then(function () { done++; $("done").textContent = done; addLog(d.job); busy = false; if (d.left) tick(); });
    }).catch(function () { busy = false; $("warn").textContent = "Fără legătură cu site-ul. Se reîncearcă."; });
  }
  function setOn(v) {
    on = v;
    $("st").textContent = on ? "Pornită" : "Oprită";
    $("go").textContent = on ? "Oprește printarea automată" : "Pornește printarea automată";
    $("go").className = "btn " + (on ? "b-red" : "b-green");
    try { localStorage.setItem("printOn", on ? "1" : ""); } catch (e) {}
    if (on) tick();
  }
  $("go").addEventListener("click", function () { setOn(!on); });
  $("test").addEventListener("click", function () {
    if (busy) return; busy = true;
    printJob({ nume: "Etichetă de test", companie: "JCI Brașov", domeniu: "Test", vip: false, bloc: "C", blocNume: "Puntea", nr: 7, mese: ["C2", "C2", "C3", "C4", "C5", "C1"] })
      .then(function () { busy = false; });
  });
  $("skip").addEventListener("click", function () {
    if (!confirm("Toate ecusoanele din coadă vor fi marcate ca tipărite, fără să se tipărească. Continui?")) return;
    post("/api/echipa/print-skip").then(function (d) { $("left").textContent = 0; alert(d.n + " ecusoane scoase din coadă."); });
  });
  var qt;
  $("q").addEventListener("input", function () {
    clearTimeout(qt); var q = this.value.trim();
    if (q.length < 2) { $("rez").innerHTML = ""; return; }
    qt = setTimeout(function () {
      fetch("/api/echipa/cauta?q=" + encodeURIComponent(q), { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (d) {
        var list = d.rezultate || [];
        if (!Array.isArray(list)) list = [];
        $("rez").innerHTML = list.map(function (x) {
          return '<div class="it"><span><b>' + esc(x.loc || "fără loc") + "</b> " + esc(x.nume) + "</span>" +
            (x.loc ? '<button type="button" data-t="' + esc(x.token) + '">Pune în coadă</button>' : "") + "</div>";
        }).join("") || '<p class="muted">Niciun rezultat.</p>';
      });
    }, 250);
  });
  $("rez").addEventListener("click", function (e) {
    var t = e.target.getAttribute && e.target.getAttribute("data-t");
    if (!t) return;
    post("/api/echipa/print-again", { token: t }).then(function (d) {
      e.target.textContent = d.ok ? "În coadă" : (d.error || "Eroare"); e.target.disabled = true; tick();
    });
  });
  setInterval(tick, 2000);
  try { if (localStorage.getItem("printOn")) setOn(true); } catch (e) {}
})();
