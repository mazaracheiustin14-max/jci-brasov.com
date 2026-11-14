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

  // Mesajul de WhatsApp cu linkul personal către chestionarul pe care îl completează singură persoana (/q/<cod>).
  function waText(c, pren) {
    var p = String(pren == null ? c.prenume || "" : pren).replace(/\s+/g, " ").trim();
    var cine = who && who !== "echipa" ? "\nprin " + who : "";
    return [
      (p ? "Dragă " + p + "," : "Bună,") + " 👋",
      "",
      "Mulțumim că faci parte din comunitatea *JCI Brașov – Beyond the Initiative*! 🎉",
      "",
      "Evenimentul marchează *lansarea JCI Brașov* și este unul dintre cele mai mari evenimente de networking ale anului în Brașov.",
      "",
      "📅 *Joi, 26 noiembrie*",
      "🕔 *Ora 17:00*",
      "📍 *CATTIA Brașov*",
      "",
      "Ce te așteaptă:",
      "🤝 *2 sesiuni de Blitz Networking* – peste *24 de contacte de business* într-o singură seară",
      "🎤 *9 lideri pe scenă*, în două paneluri: unul despre puterea comunității și unul despre tehnologia care ne schimbă viața",
      "🍽️ Networking la standul de mâncare *Hillden*",
      "",
      "✅ *Pentru a-ți confirma locul, completează chestionarul de mai jos:*",
      "👉 https://jci-brasov.com/q/" + c.cod,
      "",
      "Răspunsurile tale ne ajută să te așezăm la Blitz Networking *în funcție de interesele tale*, ca să cunoști oamenii potriviți, sau să le adresăm invitaților de pe scenă *întrebările de interes pentru tine*.",
      "",
      "⚠️ Prin completarea chestionarului *îți confirmi locul*. Dacă nu mai poți ajunge, te rugăm să ne anunți *până pe 19 noiembrie* – *locurile sunt limitate* și vrem să le oferim celor de pe lista de așteptare.",
      "",
      "Ne vedem pe 26! 🚀",
      "",
      "Echipa JCI Brașov" + cine
    ].join("\n");
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
    if (c.q_online) t.push('<span class="tag ok">Chestionar completat online</span>');
    else if (c.q_trimis) t.push('<span class="tag info">Chestionar trimis pe WhatsApp</span>');
    if (c.apeluri) t.push('<span class="tag">' + c.apeluri + (c.apeluri === 1 ? " apel" : " apeluri") + "</span>");
    var qs = "";
    if (c.intrebare) qs += '<div class="qbox"><span class="lab">ÎNTREBARE PENTRU INVITAȚI</span><br>' + esc(c.intrebare) + "</div>";
    if (c.intrebare_apel) qs += '<div class="qbox"><span class="lab">ÎNTREBARE PENTRU INVITAȚI, DIN APEL</span><br>' + esc(c.intrebare_apel) + "</div>";
    var digits = (c.telefon || "").replace(/\D/g, "");
    var acts = c.telefon
      ? '<a class="btn b-green" href="tel:' + esc(c.telefon) + '">Sună</a><a class="btn b-blue" href="https://wa.me/' + digits + '" target="_blank" rel="noopener">WhatsApp</a>'
      : "";
    var waq = "";
    if (c.telefon && c.cod) {
      waq = '<label class="lab fl" for="wn' + c.id + '">PRENUMELE DIN MESAJUL DE WHATSAPP (VERIFICĂ ÎNAINTE DE TRIMITERE)</label>' +
        '<input id="wn' + c.id + '" class="mt" maxlength="30" value="' + esc(c.prenume || "") + '" placeholder="Fără prenume, mesajul începe cu Bună">' +
        '<div class="acts"><a class="btn b-blue" data-wa="' + c.id + '" data-tel="' + digits + '" href="https://wa.me/' + digits + "?text=" + encodeURIComponent(waText(c)) + '" target="_blank" rel="noopener">Trimite chestionarul pe WhatsApp</a></div>';
    }
    return '<div class="card mt"><b style="font-size:18px">' + esc(c.nume || "Fără nume") + "</b><br><small class=\"muted\">" + esc(fmtPhone(c.telefon)) +
      (c.alt ? ", alt număr " + esc(fmtPhone(c.alt)) : "") + (c.email ? ", " + esc(c.email) : "") + (c.companie ? ", " + esc(c.companie) : "") + "</small>" +
      (c.surse ? '<br><small class="muted">Surse: ' + esc(c.surse) + "</small>" : "") +
      '<div class="tags">' + t.join("") + "</div>" + qs +
      '<div class="acts">' + acts + '<button class="btn b-ghost" data-form="' + c.id + '">Chestionar</button></div>' + waq +
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

  // Domeniile pentru potrivirea de la Blitz Networking: aceeași listă ca în worker/domenii.js (verificat de src/tests/blitz.test.mjs).
  var DOMENII = [["it", "IT și tehnologie"], ["marketing", "Marketing, comunicare și media"], ["vanzari", "Vânzări și dezvoltare de afaceri"],
    ["financiar", "Financiar, contabilitate și asigurări"], ["juridic", "Juridic și consultanță"], ["horeca", "HoReCa și turism"],
    ["imobiliare", "Imobiliare și construcții"], ["productie", "Producție și industrie"], ["comert", "Comerț și comerț online"],
    ["transport", "Transport și logistică"], ["sanatate", "Sănătate și wellness"], ["educatie", "Educație, training și resurse umane"],
    ["ong", "ONG și sector public"], ["alt", "Alt domeniu"]];

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
    hist.then(function (j) { renderForm(c, j.calls || [], j.dom || { domeniu: "", tinte: [], vip: false }); });
  }
  function renderForm(c, calls, dom) {
    var nou = !c;
    var era = nou ? "nu" : (c.inscris ? "da" : "nu");
    var RASP = { da: "Au vorbit", nu: "Nu a răspuns", mai_tarziu: "Mă suni mai târziu" };
    var prev = calls.length ? '<div class="card mt"><p class="lab">APELURI ANTERIOARE</p>' + calls.map(function (x) {
      var rez = x.raspuns === "da" ? (STATUS[x.status_final] || "Au vorbit") : (RASP[x.raspuns] || "");
      return '<p class="muted mt">' + esc(x.creat) + ", " + esc(x.apelant) + ": " + esc(rez) + (x.observatii ? ". " + esc(x.observatii) : "") + "</p>";
    }).join("") + "</div>" : "";
    var colegi = (D.colegi || []).slice();
    if (who && colegi.indexOf(who) < 0) colegi.unshift(who);
    root.innerHTML = '<button class="btn b-ghost" data-back="1">Înapoi la listă</button>' + prev +
      '<div class="card mt" id="fcard"><p class="lab">SECȚIUNEA 1 – DATE APEL</p><div id="ferr"></div>' +
      fld("f_apelant", "1. Cine a sunat? (obligatoriu)", '<input id="f_apelant" class="mt" list="f_colegi" maxlength="60" value="' + esc(who) + '"><datalist id="f_colegi">' + colegi.map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + "</datalist>") +
      tx("f_nume", "2. Numele persoanei sunate (obligatoriu)", c ? c.nume : "", 120) +
      tx("f_tel", "3. Îmi confirmați, vă rog, numărul de telefon?", c ? c.telefon : "", 40, 'inputmode="tel"') +
      tx("f_email", "4. Pe ce adresă de e-mail vă putem trimite invitația?", c ? c.email : "", 160, 'inputmode="email" autocapitalize="none"') +
      (nou ? fld("f_sursa", "5. Sursa contactului", sel("f_sursa", D.surse.map(function (x) { return [x, x]; }), D.surse[0]).replace("<select", '<select class="mt"'))
        : fld("f_sursa_ro", "5. Sursa contactului", '<input id="f_sursa_ro" class="mt" value="' + esc(c.surse || "") + '" disabled>')) +
      fld("f_raspuns", "6. Ați reușit să vorbiți? (obligatoriu)", sel("f_raspuns", [["", "Alege"], ["da", "Da"], ["nu", "Nu a răspuns"], ["mai_tarziu", "Sună mai târziu"]], "").replace("<select", '<select class="mt"')) +
      fld("f_rev", "7. Când ar fi un moment potrivit să revin cu un telefon?", '<input id="f_rev" class="mt" type="datetime-local">') +
      fld("f_era", "8. Ați reușit să vă înscrieți la eveniment?", sel("f_era", [["da", "Da"], ["nu", "Nu"], ["nu_stie", "Nu știe"]], era).replace("<select", '<select class="mt"')) +
      '</div><div class="card mt" id="sec2"><p class="lab">SECȚIUNEA 2 – RĂSPUNSURI</p>' +
      tx("f_ocupatie", "9. Cu ce vă ocupați în prezent?", "", 200) +
      fld("f_dom", "9a. În ce domeniu activați? Ne ajută să vă așezăm la Blitz Networking lângă oamenii potriviți." + (dom.vip ? " (obligatoriu pentru invitații VIP)" : ""),
        sel("f_dom", [["", "Alege"]].concat(DOMENII), dom.domeniu || "").replace("<select", '<select class="mt"')) +
      ta("f_provocare", "10. Care este cea mai mare provocare cu care vă confruntați acum la locul de muncă sau în business?") +
      ta("f_sfat", "11. Dacă ați putea cere sfatul cuiva care a trecut deja prin asta, ce l-ați întreba?") +
      ta("f_interes", "12. Ce v-a făcut să vă interesați de eveniment?") +
      tx("f_ia", "13. Dacă ar fi să plecați de la eveniment cu un singur lucru, care ar fi acela?", "", 300) +
      tx("f_oameni", "14. Ce fel de oameni v-ar plăcea să cunoașteți acolo?", "", 300) +
      ta("f_intrebare", "15. Avem două paneluri, unul despre puterea comunității și unul despre tehnologia care ne schimbă viața. Ce întrebare le-ați pune invitaților?") +
      ta("f_activ", "16. Ce v-ar face să rămâneți activ în comunitatea JCI Brașov și după eveniment?") +
      '</div><div class="card mt"><p class="lab">SECȚIUNEA 3 – REZULTAT</p><div id="ferr3"></div>' +
      fld("f_status", "17. Pot să vă trec pe listă ca participant confirmat?", sel("f_status", [["", "Alege"], ["confirmat", "Confirmat"], ["revine", "Revine cu răspuns"], ["nu_participa", "Nu participă"]], "").replace("<select", '<select class="mt"')) +
      fld("f_vip", "18. V-ar interesa și biletul VIP, cu locuri în primul rând, întâlniri directe cu invitații și degustare de vin?", sel("f_vip", [["", "Nespecificat"], ["da", "Da"], ["nu", "Nu"], ["poate", "Poate"]], "").replace("<select", '<select class="mt"')) +
      '<p class="lab fl">18a. DOAR PENTRU INVITAȚII VIP: DIN CE DOMENII AȚI DORI SĂ CUNOAȘTEȚI OAMENI LA BLITZ NETWORKING? (CEL MULT 3' + (dom.vip ? ", OBLIGATORIU" : "") + ")</p>" +
      DOMENII.filter(function (d) { return d[0] !== "alt"; }).map(function (d) { return chk("f_t_" + d[0], d[1]); }).join("") +
      fld("f_revine", "19. Când credeți că îmi puteți da un răspuns?", '<input id="f_revine" class="mt" type="datetime-local">') +
      tx("f_motiv", "20. Îmi puteți spune ce vă împiedică să participați?", "", 300) +
      '<p class="lab fl">21. ACORDURI (TREI BIFE SEPARATE)</p>' +
      chk("f_acord", "Sunteți de acord să folosim datele dumneavoastră pentru organizarea evenimentului? (obligatoriu pentru înscrierea prin telefon)") +
      chk("f_viitor", "Vă putem trimite și invitații la evenimentele viitoare JCI Brașov?") +
      chk("f_bcr", "Sunteți de acord să transmitem datele către BCR Asigurări?") +
      fld("f_inv", "22. I s-a trimis linkul de înscriere / invitația?", sel("f_inv", [["", "Nespecificat"], ["da", "Da"], ["nu", "Nu"]], "").replace("<select", '<select class="mt"')) +
      ta("f_obs", "23. Observații") +
      '<button class="btn b-green mt" id="f_save">Salvează apelul</button></div>';
    var g = function (id) { return document.getElementById(id); };
    var val = function (id) { var e = g(id); return e ? e.value : ""; };
    var on = function (id) { var e = g(id); return !!(e && e.checked); };
    (dom.tinte || []).forEach(function (t) { var e = g("f_t_" + t); if (e) e.checked = true; });
    root.onchange = null;
    var arata = function (id) { var e = g(id); if (e && e.scrollIntoView) e.scrollIntoView({ block: "center" }); };
    root.__save = function () {
      g("ferr").innerHTML = ""; g("ferr3").innerHTML = "";
      if (!val("f_raspuns")) { g("ferr").innerHTML = '<div class="err">Alege la întrebarea 6 dacă ați reușit să vorbiți.</div>'; arata("f_raspuns"); return; }
      var tinte = DOMENII.filter(function (d) { return on("f_t_" + d[0]); }).map(function (d) { return d[0]; });
      if (tinte.length > 3) { g("ferr").innerHTML = '<div class="err">Alege cel mult 3 domenii țintă.</div>'; window.scrollTo(0, 0); return; }
      var b = {
        contact_id: c ? c.id : 0, apelant: val("f_apelant"), nume_sunat: val("f_nume"), telefon: val("f_tel"), email: val("f_email"),
        sursa: nou ? val("f_sursa") : "", raspuns: val("f_raspuns"), revenire_la: val("f_rev"), era_inscris: val("f_era"),
        ocupatie: val("f_ocupatie"), provocare: val("f_provocare"), sfat: val("f_sfat"), interes: val("f_interes"), ia_acasa: val("f_ia"),
        oameni: val("f_oameni"), intrebare_invitati: val("f_intrebare"), ramane_activ: val("f_activ"),
        status_final: val("f_raspuns") === "da" ? val("f_status") : "", vip: val("f_vip"), revine_la: val("f_revine"), motiv: val("f_motiv"),
        acord_date: on("f_acord"), acord_viitor: on("f_viitor"), acord_bcr: on("f_bcr"), invitatie_trimisa: val("f_inv"), observatii: val("f_obs"),
        domeniu: val("f_dom"), tinte: tinte
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
  // Linkul de WhatsApp se deschide normal; aici doar se notează că a fost trimis chestionarul.
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a[data-wa]") : null;
    if (!a) return;
    // Mesajul se reface cu prenumele din câmp, exact înainte să se deschidă WhatsApp.
    var id = Number(a.getAttribute("data-wa")), inp = document.getElementById("wn" + id), pren = inp ? inp.value : "";
    var c = (D && D.contacte || []).filter(function (x) { return x.id === id; })[0];
    if (c) a.href = "https://wa.me/" + a.getAttribute("data-tel") + "?text=" + encodeURIComponent(waText(c, pren));
    api("/api/echipa/chestionar-trimis", { id: id, prenume: pren }).then(function () { load(); }).catch(function () {});
  });
  document.addEventListener("change", function (e) {
    var i = e.target;
    if (i && i.hasAttribute && i.hasAttribute("data-cont")) {
      api("/api/echipa/contactat", { id: Number(i.getAttribute("data-cont")), contactat: i.checked }).then(function () { load(); });
    }
  });
  load();
})();
