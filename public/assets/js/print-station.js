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
          var btn = "";
          if (x.loc) btn = '<button type="button" data-t="' + esc(x.token) + '">Retipărește</button>';
          else if (!x.prezent && x.status === "confirmat") btn = '<button type="button" data-c="' + esc(x.token) + '">Check-in și tipărește</button>';
          else if (x.status !== "confirmat") btn = '<span class="muted">' + esc(x.status === "asteptare" ? "listă de așteptare" : x.status) + "</span>";
          return '<div class="it"><span><b>' + esc(x.loc || (x.prezent ? "fără loc" : "neintrat")) + "</b> " + esc(x.nume) +
            (x.telefon ? ' <span class="muted">' + esc(String(x.telefon).slice(-4)) + "</span>" : "") + "</span>" + btn +
            (x.status === "confirmat" ? '<button type="button" data-n="' + esc(x.token) + '" data-v="' + esc(x.nume) + '">Schimbă numele</button>' : "") + "</div>";
        }).join("") || '<p class="muted">Niciun rezultat.</p>';
      });
    }, 250);
  });
  $("rez").addEventListener("click", function (e) {
    var n = e.target.getAttribute && e.target.getAttribute("data-n");
    if (n) {
      var cur = e.target.getAttribute("data-v") || "";
      var nou = prompt("Numele corect, așa cum apare pe ecuson:", /^invitat jci/i.test(cur) ? "" : cur);
      if (nou == null) return;
      nou = nou.trim();
      if (nou.length < 3) { alert("Numele e prea scurt."); return; }
      e.target.disabled = true; e.target.textContent = "Se salvează...";
      post("/api/echipa/nume", { token: n, nume: nou }).then(function (d) {
        if (!d.ok) { e.target.textContent = d.error || "Eroare"; e.target.disabled = false; return; }
        e.target.textContent = d.retiparit ? "Salvat, se retipărește" : "Salvat";
        var sp = e.target.parentNode.querySelector("span b");
        if (sp && sp.nextSibling) sp.nextSibling.textContent = " " + d.nume;
        tick();
      }).catch(function () { e.target.textContent = "Fără legătură, apasă din nou"; e.target.disabled = false; });
      return;
    }
    var c = e.target.getAttribute && e.target.getAttribute("data-c");
    if (c) {
      // Participant înscris fără QR la el: check-in după nume, primește loc în bloc și ecusonul intră în coadă.
      e.target.disabled = true; e.target.textContent = "Se face check-in...";
      post("/api/checkin", { token: c }).then(function (d) {
        if (d.ok) { e.target.textContent = "Intrat" + (d.loc ? ", ecuson " + d.loc.bloc + d.loc.nr : "") + (on ? ", se tipărește" : ", pornește printarea"); tick(); }
        else if (d.already) { e.target.textContent = "Era deja intrat"; }
        else { e.target.textContent = d.error || "Eroare"; e.target.disabled = false; }
      }).catch(function () { e.target.textContent = "Fără legătură, apasă din nou"; e.target.disabled = false; });
      return;
    }
    var t = e.target.getAttribute && e.target.getAttribute("data-t");
    if (!t) return;
    post("/api/echipa/print-again", { token: t }).then(function (d) {
      e.target.textContent = d.ok ? "În coadă" : (d.error || "Eroare"); e.target.disabled = true; tick();
    });
  });
  // Participant fără invitație: salvare în baza de înscrieri, check-in și ecuson în coadă.
  var wf = { nume: "w-nume", telefon: "w-tel", domeniu: "w-dom", companie: "w-comp", email: "w-email" }, wbusy = false;
  function wmsg(t, ok) { $("w-msg").textContent = t; $("w-msg").className = "muted " + (ok ? "w-ok" : "w-err"); }
  function wmark(lipsa) { Object.keys(wf).forEach(function (k) { $(wf[k]).classList.toggle("bad", lipsa.indexOf(k) >= 0); }); }
  $("w-go").addEventListener("click", function () {
    if (wbusy) return;
    var b = {}, lipsa = [];
    Object.keys(wf).forEach(function (k) { b[k] = $(wf[k]).value.trim(); });
    if (b.nume.length < 3) lipsa.push("nume");
    if (b.telefon.replace(/\D/g, "").length < 9) lipsa.push("telefon");
    if (!b.domeniu) lipsa.push("domeniu");
    wmark(lipsa);
    if (lipsa.length) { wmsg("Completează câmpurile marcate cu roșu.", false); return; }
    wbusy = true; $("w-go").disabled = true; wmsg("Se salvează...", true);
    post("/api/echipa/walkin", b).then(function (d) {
      wbusy = false; $("w-go").disabled = false;
      if (!d.ok) { wmark(d.lipsa || []); wmsg(d.error || "Nu s-a putut salva. Încearcă din nou.", false); return; }
      Object.keys(wf).forEach(function (k) { $(wf[k]).value = ""; });
      var t = d.nume + (d.loc ? ", ecuson " + d.loc : ", fără loc în bloc") + ". ";
      t += d.already ? "Era deja intrat, ecusonul se retipărește." : d.existent ? "Era deja înscris, a primit check-in." : "Salvat în baza de înscrieri.";
      if (!on) t += " Pornește printarea automată ca să iasă ecusonul.";
      wmsg(t, true); $("w-nume").focus(); tick();
    }).catch(function () { wbusy = false; $("w-go").disabled = false; wmsg("Fără legătură cu site-ul. Datele au rămas în formular, apasă din nou.", false); });
  });
  setInterval(tick, 2000);
  try { if (localStorage.getItem("printOn")) setOn(true); } catch (e) {}
})();
