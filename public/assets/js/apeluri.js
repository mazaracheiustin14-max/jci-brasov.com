// Apeluri către contacte (panoul echipei, /checkin/apeluri): listă cu filtre, bifă „Contactat”, chestionar de apel.
// Datele vin din /api/echipa/* (worker/apeluri.js). Tot textul venit din date trece prin esc().
(function () {
  var root = document.getElementById("ap");
  if (!root) return;
  var who = root.getAttribute("data-who") || "";
  var D = null, filter = "toti", q = "", view = "list", flash = "";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function api(path, body) {
    var o = { credentials: "same-origin", cache: "no-store" };
    if (body) { o.method = "POST"; o.headers = { "Content-Type": "application/json" }; o.body = JSON.stringify(body); }
    return fetch(path, o).then(function (r) {
      if (r.status === 401) { location.href = "/checkin"; throw new Error("auth"); }
      return r.json().then(function (j) { j.__status = r.status; return j; });
    });
  }
  function fmtPhone(p) {
    var m = /^\+40(\d{3})(\d{3})(\d{3})$/.exec(p || "");
    return m ? "+40 " + m[1] + " " + m[2] + " " + m[3] : (p || "");
  }
  function fmtWhen(v) { return String(v || "").replace("T", " "); }
  var STATUS = { confirmat: "Confirmat", revine: "Revine cu răspuns", nu_participa: "Nu participă", nu_a_raspuns: "Nu a răspuns", mai_tarziu: "De sunat mai târziu" };

  var FILTERS = [["toti", "Toți"], ["desunat", "De sunat"], ["contactati", "Contactați"], ["reveniri", "Reveniri"], ["inscrisi", "Înscriși"], ["neinscrisi", "Neînscriși"],
    ["neconfirmat", "Gmail neconfirmat"], ["confirmat", "Gmail confirmat"], ["intrebare", "Cu întrebare"]];
  function match(c, f) {
    switch (f) {
      case "desunat": return !c.contactat;
      case "contactati": return c.contactat;
      case "reveniri": return !!c.revenire || c.status_apel === "mai_tarziu" || c.status_apel === "revine";
      case "inscrisi": return c.inscris;
      case "neinscrisi": return !c.inscris;
      case "neconfirmat": return c.inscris && !c.confirmat;
      case "confirmat": return c.confirmat;
      case "intrebare": return !!(c.intrebare || c.intrebare_apel);
      default: return true;
    }
  }
  function matchQ(c) {
    if (!q) return true;
    var s = q.toLowerCase(), digits = q.replace(/\D/g, "");
    return (c.nume || "").toLowerCase().indexOf(s) >= 0 || (c.email || "").toLowerCase().indexOf(s) >= 0 || (c.companie || "").toLowerCase().indexOf(s) >= 0 ||
      (digits.length >= 3 && (c.telefon || "").replace(/\D/g, "").indexOf(digits) >= 0);
  }

  // ----- listă -----
  function card(c) {
    var t = [];
    t.push(c.inscris ? '<span class="tag ok">Înscris' + (c.asteptare ? ", listă de așteptare" : "") + "</span>" : '<span class="tag">Neînscris</span>');
    if (c.inscris) {
      t.push(c.trimisa ? '<span class="tag info">Gmail trimis</span>' : (c.eroare ? '<span class="tag warn">Gmail cu eroare</span>' : '<span class="tag warn">Gmail netrimis încă</span>'));
      t.push(c.confirmat ? '<span class="tag ok">Gmail confirmat de el</span>' : '<span class="tag warn">Gmail neconfirmat</span>');
    } else t.push('<span class="tag">Fără email, fără invitație</span>');
    if (c.status_apel) t.push('<span class="tag info">' + esc(STATUS[c.status_apel] || c.status_apel) + "</span>");
    if (c.revenire) t.push('<span class="tag warn">Revenire ' + esc(fmtWhen(c.revenire)) + "</span>");
    if (c.apeluri) t.push('<span class="tag">' + c.apeluri + (c.apeluri === 1 ? " apel" : " apeluri") + "</span>");
    var qs = "";
    if (c.intrebare) qs += '<div class="qbox"><span class="lab">ÎNTREBARE PENTRU INVITAȚI</span><br>' + esc(c.intrebare) + "</div>";
    if (c.intrebare_apel) qs += '<div class="qbox"><span class="lab">ÎNTREBARE PENTRU INVITAȚI, DIN APEL</span><br>' + esc(c.intrebare_apel) + "</div>";
    var digits = (c.telefon || "").replace(/\D/g, "");
    var acts = c.telefon
      ? '<a class="btn b-green" href="tel:' + esc(c.telefon) + '">Sună</a><a class="btn b-blue" href="https://wa.me/' + digits + '" target="_blank" rel="noopener">WhatsApp</a>'
      : "";
    return '<div class="card mt"><b style="font-size:18px">' + esc(c.nume || "Fără nume") + "</b><br><small class=\"muted\">" + esc(fmtPhone(c.telefon)) +
      (c.alt ? ", alt număr " + esc(fmtPhone(c.alt)) : "") + (c.email ? ", " + esc(c.email) : "") + (c.companie ? ", " + esc(c.companie) : "") + "</small>" +
      (c.surse ? '<br><small class="muted">Surse: ' + esc(c.surse) + "</small>" : "") +
      '<div class="tags">' + t.join("") + "</div>" + qs +
      '<div class="acts">' + acts + '<button class="btn b-ghost" data-form="' + c.id + '">Chestionar</button></div>' +
      '<label class="chk"><input type="checkbox" data-cont="' + c.id + '"' + (c.contactat ? " checked" : "") + "><span>Contactat" +
      (c.contactat && (c.contactat_de || c.contactat_la) ? " (" + esc([c.contactat_de, c.contactat_la].filter(Boolean).join(", ")) + ")" : "") + "</span></label></div>";
  }
  function renderList() {
    root.onchange = null;
    var cs = D.contacte;
    var counts = {};
    FILTERS.forEach(function (f) { counts[f[0]] = cs.filter(function (c) { return match(c, f[0]); }).length; });
    var shown = cs.filter(function (c) { return match(c, filter) && matchQ(c); });
    if (filter === "reveniri") shown.sort(function (a, b) { return (a.revenire || "9999").localeCompare(b.revenire || "9999"); });
    var inscrisi = counts.inscrisi, conf = counts.confirmat;
    root.innerHTML = (flash ? '<div class="ok-msg">' + esc(flash) + "</div>" : "") +
      '<div class="card"><div class="row"><div><p class="lab">CONTACTE</p><p class="big">' + cs.length + '</p></div><div><p class="lab">CONTACTAȚI</p><p class="big" style="color:#4ED39A">' + counts.contactati + "</p></div></div>" +
      '<div class="row mt"><div><p class="lab">ÎNSCRIȘI</p><p class="val" style="color:#fff">' + inscrisi + '</p></div><div><p class="lab">GMAIL CONFIRMAT</p><p class="val" style="color:#fff">' + conf + " din " + inscrisi + "</p></div></div></div>" +
      '<div class="chips">' + FILTERS.map(function (f) { return '<button class="chip' + (filter === f[0] ? " on" : "") + '" data-f="' + f[0] + '">' + esc(f[1]) + " (" + counts[f[0]] + ")</button>"; }).join("") +
      (D.duplicate ? '<button class="chip" data-dup="1">Posibile duplicate (' + D.duplicate + ")</button>" : "") + "</div>" +
      '<input id="aq" class="mt" placeholder="Caută după nume, telefon sau email" value="' + esc(q) + '" autocomplete="off" enterkeyhint="search">' +
      '<button class="btn b-ghost mt" data-new="1">Adaugă un contact nou</button>' +
      (shown.length ? shown.map(card).join("") : '<div class="card mt"><p class="muted">Niciun contact în această listă.</p></div>');
    flash = "";
    var inp = document.getElementById("aq");
    inp.addEventListener("input", function () {
      q = inp.value.trim();
      var pos = inp.selectionStart;
      renderList();
      var n = document.getElementById("aq"); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {}
    });
  }
  function load() {
    return api("/api/echipa/contacte").then(function (j) { D = j; if (view === "list") renderList(); }).catch(function () {
      root.innerHTML = '<div class="err">Fără conexiune. Reîncearcă.</div>';
    });
  }

  // ----- chestionar -----
  function sel(id, opts, val) {
    return '<select id="' + id + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === val ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>";
  }
  function fld(id, label, inner) { return '<label class="lab fl" for="' + id + '">' + esc(label) + "</label>" + inner; }
  function ta(id, label, ph) { return fld(id, label, '<textarea id="' + id + '" maxlength="1500" class="mt"' + (ph ? ' placeholder="' + esc(ph) + '"' : "") + "></textarea>"); }
  function tx(id, label, val, max, extra) { return fld(id, label, '<input id="' + id + '" class="mt" maxlength="' + (max || 200) + '" value="' + esc(val || "") + '" ' + (extra || "") + ">"); }
  function chk(id, text) { return '<label class="chk"><input type="checkbox" id="' + id + '"><span>' + esc(text) + "</span></label>"; }

  function openForm(id) {
    view = "form";
    var c = null;
    if (id) c = D.contacte.filter(function (x) { return x.id === id; })[0];
    root.innerHTML = '<div class="card"><p class="muted">Se încarcă...</p></div>';
    var hist = id ? api("/api/echipa/contact?id=" + id) : Promise.resolve({ calls: [] });
    hist.then(function (j) { renderForm(c, j.calls || []); });
  }
  function renderForm(c, calls) {
    var nou = !c;
    var era = nou ? "nu" : (c.inscris ? "da" : "nu");
    var RASP = { da: "Au vorbit", nu: "Nu a răspuns", mai_tarziu: "Mă suni mai târziu" };
    var prev = calls.length ? '<div class="card mt"><p class="lab">APELURI ANTERIOARE</p>' + calls.map(function (x) {
      var rez = x.raspuns === "da" ? (STATUS[x.status_final] || "Au vorbit") : (RASP[x.raspuns] || "");
      return '<p class="muted mt">' + esc(x.creat) + ", " + esc(x.apelant) + ": " + esc(rez) + (x.observatii ? ". " + esc(x.observatii) : "") + "</p>";
    }).join("") + "</div>" : "";
    var colegi = (D.colegi || []).slice();
    if (who && colegi.indexOf(who) < 0) colegi.unshift(who);
    var needReg = !(c && c.inscris); // înscriere nouă prin telefon: cere email și acord
    root.innerHTML = '<button class="btn b-ghost" data-back="1">Înapoi la listă</button>' + prev +
      '<div class="card mt" id="fcard"><p class="lab">SECȚIUNEA 1 – DATE APEL</p><div id="ferr"></div>' +
      fld("f_apelant", "1. Cine a sunat? (obligatoriu)", '<input id="f_apelant" class="mt" list="f_colegi" maxlength="60" value="' + esc(who) + '"><datalist id="f_colegi">' + colegi.map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + "</datalist>") +
      tx("f_nume", "2. Numele persoanei sunate (obligatoriu)", c ? c.nume : "", 120) +
      tx("f_tel", "3. Telefon", c ? c.telefon : "", 40, 'inputmode="tel"') +
      (nou ? fld("f_sursa", "Sursa contactului (contact nou)", sel("f_sursa", D.surse.map(function (x) { return [x, x]; }), D.surse[0]).replace("<select", '<select class="mt"')) : "") +
      fld("f_raspuns", "4. Ați reușit să vorbiți? (obligatoriu)", sel("f_raspuns", [["", "Alege"], ["da", "Da"], ["nu", "Nu a răspuns"], ["mai_tarziu", "Mă suni mai târziu"]], "").replace("<select", '<select class="mt"')) +
      '<div id="g_rev" hidden>' + fld("f_rev", "5. Dacă te-a rugat să suni mai târziu, când?", '<input id="f_rev" class="mt" type="datetime-local">') + "</div>" +
      fld("f_era", "6. Era deja înscris la eveniment?", sel("f_era", [["da", "Da"], ["nu", "Nu"], ["nu_stie", "Nu știe"]], era).replace("<select", '<select class="mt"')) +
      '</div><div class="card mt" id="sec2" hidden><p class="lab">SECȚIUNEA 2 – RĂSPUNSURI</p>' +
      tx("f_ocupatie", "7. Cu ce se ocupă în prezent?", "", 200) +
      ta("f_provocare", "8. Care e cea mai mare provocare cu care se confruntă acum la locul de muncă sau în business?") +
      ta("f_sfat", "9. Dacă ar putea cere sfatul cuiva care a trecut deja prin asta, ce l-ar întreba?") +
      ta("f_interes", "10. Ce l-a făcut să intre în grupul evenimentului?") +
      tx("f_ia", "11. Dacă ar pleca de la eveniment cu un singur lucru, care ar fi acela?", "", 300) +
      tx("f_oameni", "12. Ce fel de oameni i-ar plăcea să cunoască acolo?", "", 300) +
      ta("f_intrebare", "13. Ce întrebare ar pune invitaților din paneluri (puterea comunității / tehnologia care ne schimbă viața)?") +
      ta("f_activ", "14. Ce l-ar face să rămână activ în comunitatea JCI Brașov și după eveniment?") +
      '</div><div class="card mt"><p class="lab">SECȚIUNEA 3 – REZULTAT</p>' +
      fld("f_status", "15. Status final (obligatoriu)", sel("f_status", [["", "Alege"], ["confirmat", "Confirmat"], ["revine", "Revine cu răspuns"], ["nu_participa", "Nu participă"]], "").replace("<select", '<select class="mt"')) +
      fld("f_vip", "16. E interesat de biletul VIP?", sel("f_vip", [["", "Nespecificat"], ["da", "Da"], ["nu", "Nu"], ["poate", "Poate"]], "").replace("<select", '<select class="mt"')) +
      '<div id="g_revine" hidden>' + fld("f_revine", "17. Dacă revine cu răspuns, când îl sunăm din nou?", '<input id="f_revine" class="mt" type="datetime-local">') + "</div>" +
      '<div id="g_motiv" hidden>' + tx("f_motiv", "18. Dacă nu participă, care e motivul?", "", 300) + "</div>" +
      fld("f_inv", "19. I s-a trimis linkul pe WhatsApp?", sel("f_inv", [["", "Nespecificat"], ["da", "Da"], ["nu", "Nu"]], "").replace("<select", '<select class="mt"')) +
      ta("f_obs", "20. Observații (opțional)") +
      (needReg ? '<div id="g_conf" hidden><p class="muted mt">Pentru înscriere sunt necesare un email valid și acordul verbal pentru prelucrarea datelor.</p>' +
        tx("f_email", "Email pentru înscriere", c ? c.email : "", 160, 'inputmode="email" autocapitalize="none"') +
        chk("f_acord", "Acord verbal pentru prelucrarea datelor în scopul organizării evenimentului") +
        chk("f_viitor", "Acord pentru invitații viitoare JCI Brașov") + chk("f_bcr", "Acord pentru transmiterea datelor către BCR Asigurări") + "</div>" : "") +
      '<button class="btn b-green mt" id="f_save">Salvează apelul</button></div>';
    var g = function (id) { return document.getElementById(id); };
    var val = function (id) { var e = g(id); return e ? e.value : ""; };
    var on = function (id) { var e = g(id); return !!(e && e.checked); };
    function sync() {
      var r = g("f_raspuns").value, st = g("f_status").value;
      g("sec2").hidden = r !== "da"; g("g_rev").hidden = r !== "mai_tarziu";
      g("g_revine").hidden = st !== "revine"; g("g_motiv").hidden = st !== "nu_participa";
      if (g("g_conf")) g("g_conf").hidden = !(st === "confirmat" && r === "da");
    }
    root.onchange = sync;
    root.__save = function () {
      var b = {
        contact_id: c ? c.id : 0, apelant: val("f_apelant"), nume_sunat: val("f_nume"), telefon: val("f_tel"), email: val("f_email"),
        sursa: nou ? val("f_sursa") : "", raspuns: val("f_raspuns"), revenire_la: val("f_rev"), era_inscris: val("f_era"),
        ocupatie: val("f_ocupatie"), provocare: val("f_provocare"), sfat: val("f_sfat"), interes: val("f_interes"), ia_acasa: val("f_ia"),
        oameni: val("f_oameni"), intrebare_invitati: val("f_intrebare"), ramane_activ: val("f_activ"),
        status_final: val("f_status"), vip: val("f_vip"), revine_la: val("f_revine"), motiv: val("f_motiv"),
        acord_date: on("f_acord"), acord_viitor: on("f_viitor"), acord_bcr: on("f_bcr"), invitatie_trimisa: val("f_inv"), observatii: val("f_obs")
      };
      var btn = g("f_save");
      function send(extra) {
        btn.disabled = true; btn.textContent = "Se salvează...";
        if (extra) for (var k in extra) b[k] = extra[k];
        api("/api/echipa/apel", b).then(function (j) {
          if (j.needsConfirm) {
            btn.disabled = false; btn.textContent = "Salvează apelul";
            if (confirm(j.error)) send({ depasit_termen: true });
            return;
          }
          if (!j.ok) {
            g("ferr").innerHTML = '<div class="err">' + esc(j.error || "Nu s-a putut salva.") + "</div>";
            btn.disabled = false; btn.textContent = "Salvează apelul"; window.scrollTo(0, 0); return;
          }
          var msg = "Apel salvat.";
          if (j.rezultat === "inscris_confirmat") msg = "Apel salvat. Persoana a fost înscrisă și primește invitația pe email în câteva minute.";
          if (j.rezultat === "inscris_asteptare") msg = "Apel salvat. Locurile sunt ocupate, deci persoana a intrat pe lista de așteptare.";
          if (j.warning) msg = "Apel salvat. " + j.warning;
          flash = msg; view = "list"; load(); window.scrollTo(0, 0);
        }).catch(function () { btn.disabled = false; btn.textContent = "Fără conexiune. Încearcă din nou"; });
      }
      send();
    };
  }

  // ----- duplicate -----
  function openDup() {
    view = "dup";
    root.innerHTML = '<div class="card"><p class="muted">Se încarcă...</p></div>';
    api("/api/echipa/duplicate").then(function (j) {
      function side(x) { return "<b>" + esc(x.nume || "Fără nume") + "</b><br><small class=\"muted\">" + esc(fmtPhone(x.telefon)) + (x.inscris ? ", înscris" : "") + (x.surse ? ", " + esc(x.surse) : "") + "</small>"; }
      root.innerHTML = '<button class="btn b-ghost" data-back="1">Înapoi la listă</button>' +
        (j.duplicate.length ? j.duplicate.map(function (d) {
          return '<div class="card mt"><p class="lab">' + esc(d.motiv).toUpperCase() + "</p><p class=\"mt\">" + side(d.a) + '</p><p class="mt">' + side(d.b) + '</p><div class="acts">' +
            '<button class="btn b-blue" data-dupid="' + d.id + '" data-act="unire">Aceeași persoană</button><button class="btn b-ghost" data-dupid="' + d.id + '" data-act="diferiti">Persoane diferite</button></div></div>';
        }).join("") : '<div class="card mt"><p class="muted">Nu sunt perechi de rezolvat.</p></div>');
    });
  }

  // ----- evenimente -----
  document.addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    if (t.hasAttribute("data-f")) { filter = t.getAttribute("data-f"); renderList(); }
    else if (t.hasAttribute("data-form")) openForm(Number(t.getAttribute("data-form")));
    else if (t.hasAttribute("data-new")) openForm(0);
    else if (t.hasAttribute("data-dup")) openDup();
    else if (t.hasAttribute("data-back")) { view = "list"; load(); }
    else if (t.id === "f_save") root.__save();
    else if (t.hasAttribute("data-dupid")) {
      t.disabled = true;
      api("/api/echipa/duplicat", { id: Number(t.getAttribute("data-dupid")), actiune: t.getAttribute("data-act") }).then(function (j) {
        if (!j.ok) alert(j.error || "Nu s-a putut rezolva.");
        load().then(function () { if (D.duplicate) openDup(); else { view = "list"; renderList(); } });
      });
    }
  });
  document.addEventListener("change", function (e) {
    var i = e.target;
    if (i && i.hasAttribute && i.hasAttribute("data-cont")) {
      api("/api/echipa/contactat", { id: Number(i.getAttribute("data-cont")), contactat: i.checked }).then(function () { load(); });
    }
  });
  load();
})();
