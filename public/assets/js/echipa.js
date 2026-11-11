// Panoul de check-in al echipei (/echipa) și fișa deschisă la scanarea unui QR (/c/<cod>).
(function () {
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function post(token, undo) {
    return fetch("/api/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ token: token, undo: !!undo }) }).then(function (r) {
      if (r.status === 401) { location.href = "/checkin"; throw new Error("auth"); }
      return r.json();
    });
  }
  function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

  // ----- fișa de scanare -----
  var go = $("go");
  if (go) {
    go.addEventListener("click", function () {
      go.disabled = true; go.textContent = "Se confirmă...";
      post(go.getAttribute("data-token")).then(function (j) {
        var tk = go.getAttribute("data-token");
        if (j.ok) {
          // Pagina se reîncarcă și arată blocul, numărul și mesele pentru ecuson.
          buzz(80); location.replace("/c/" + tk + "?ok=1");
        } else if (j.already) {
          buzz([80, 60, 80]); location.replace("/c/" + tk);
        } else {
          go.disabled = false; go.textContent = "Încearcă din nou";
        }
      }).catch(function () { go.disabled = false; go.textContent = "Fără conexiune. Încearcă din nou"; });
    });
  }

  // ----- panoul echipei -----
  if (!$("pz")) return;
  function load() {
    fetch("/api/echipa/stats", { credentials: "same-origin", cache: "no-store" }).then(function (r) {
      if (r.status === 401) { location.href = "/checkin"; return null; }
      return r.json();
    }).then(function (j) {
      if (!j) return;
      $("pz").textContent = j.prezenti; $("ins").textContent = j.inscrisi;
      if ($("tr")) { $("tr").textContent = j.trimise; $("cf").textContent = j.confirmari; }
      $("bar").style.width = (j.inscrisi ? Math.min(100, Math.round(100 * j.prezenti / j.inscrisi)) : 0) + "%";
      $("upd").textContent = "Actualizat la " + new Date().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + (j.asteptare ? ". Pe lista de așteptare: " + j.asteptare : "");
      if ($("blk")) $("blk").textContent = j.blocuri && j.blocuri.length ? j.blocuri.map(function (b) { return "Bloc " + b.b + ": " + b.n; }).join(", ") : "Nimeni încă.";
      $("ult").innerHTML = j.ultimii.length ? j.ultimii.map(function (x) {
        return '<div class="res"><span><b>' + esc(x.nume) + "</b><small>" + esc(x.ora) + (x.loc ? ", ecuson " + esc(x.loc) : "") + (x.de ? ", de " + esc(x.de) : "") + (x.companie ? ", " + esc(x.companie) : "") +
          '</small></span><button data-undo="' + esc(x.token) + '" style="background:transparent;border:1px solid rgba(255,255,255,.3)">Anulează</button></div>';
      }).join("") : '<p class="muted mt">Nimeni încă.</p>';
    }).catch(function () { $("upd").textContent = "Fără conexiune, reîncerc..."; });
  }
  var timer;
  function search() {
    var q = $("q").value.trim();
    if (q.length < 2) { $("rez").innerHTML = ""; return; }
    fetch("/api/echipa/cauta?q=" + encodeURIComponent(q), { credentials: "same-origin", cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      $("rez").innerHTML = j.rezultate.length ? j.rezultate.map(function (x) {
        var meta = [x.companie, x.telefon, x.loc ? "ecuson " + x.loc : "", x.status === "asteptare" ? "listă de așteptare" : "", x.vip ? "VIP" : "", x.confirmat ? "a confirmat primirea" : ""].filter(Boolean).map(esc).join(", ");
        var act = x.prezent ? '<span class="ok">Intrat ' + esc(x.ora) + "</span>"
          : (x.status === "confirmat" ? '<button data-in="' + esc(x.token) + '">Confirmă</button>' : "");
        return '<div class="res"><span><b>' + esc(x.nume) + "</b><small>" + meta + "</small></span>" + act + "</div>";
      }).join("") : '<p class="muted mt">Niciun rezultat.</p>';
    });
  }
  $("q").addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(search, 250); });
  document.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-in],button[data-undo]");
    if (!b) return;
    var undo = b.hasAttribute("data-undo");
    if (undo && !confirm("Anulezi intrarea acestei persoane?")) return;
    b.disabled = true;
    var tk = b.getAttribute(undo ? "data-undo" : "data-in");
    post(tk, undo).then(function (j) {
      if (j.ok && !undo) { buzz(60); location.href = "/c/" + tk + "?ok=1"; return; }
      if (j.ok) buzz(60);
      load(); search();
    });
  });
  load(); setInterval(load, 10000);
})();
