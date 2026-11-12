/* Intrare în aplicație, acorduri, formularul de profil */
function consentBlock(c) {
  c = c || {};
  return (
    '<p class="small" style="margin-bottom:12px">Operatorul datelor tale este Federația JCI România sau filiala ta (se stabilește în scris înainte de lansarea oficială). Folosim datele ca să administrăm calitatea ta de membru și ca membrii să se găsească între ei. Poți schimba orice alegere oricând din „Profilul meu”.</p>' +
    '<p class="small" style="margin-bottom:12px"><b>Necesar:</b> nume, filială și contul tău. Conducerea filialei tale vede dacă ai cotizația achitată. Ceilalți membri văd doar insigna „Membru activ”, fără sumă și fără date de plată.</p>' +
    '<p class="lab">Opțional, casete separate</p>' +
    '<label class="check"><input type="checkbox" name="c_dir"' +
    (c.directory ? " checked" : "") +
    "><span>Doresc să apar în directorul membrilor, vizibil membrilor JCI autentificați: nume, firmă, domeniu.</span></label>" +
    '<label class="check"><input type="checkbox" name="c_phone"' +
    (c.phone ? " checked" : "") +
    "><span>Doresc să afișez în director numărul meu de telefon.</span></label>" +
    '<label class="check"><input type="checkbox" name="c_mail"' +
    (c.email ? " checked" : "") +
    "><span>Doresc să afișez în director adresa mea de e-mail.</span></label>" +
    '<label class="check"><input type="checkbox" name="c_offer"' +
    (c.offer ? " checked" : "") +
    "><span>Doresc să public o ofertă pentru membri, vizibilă membrilor autentificați.</span></label>" +
    '<p class="help">Datele din director sunt vizibile doar membrilor autentificați. Poți retrage acordurile oricând; retragerea nu afectează prelucrările anterioare. Ai dreptul să te plângi la ANSPDCP.</p>'
  );
}
function profileForm(p, priv) {
  p = p || {};
  priv = priv || {};
  return (
    '<div class="field"><label for="f_name">Nume complet</label><input type="text" id="f_name" name="name" value="' +
    esc(p.name) +
    '" required autocomplete="name"></div>' +
    (S.server && S.me && S.me.branch
      ? '<div class="field"><span class="lab">Filiala</span><p style="margin:4px 0 0">' +
        esc(S.me.branch) +
        '</p><input type="hidden" name="branch" value="' +
        esc(S.me.branch) +
        '"></div>'
      : '<div class="field"><label for="f_branch">Filiala</label><select class="f" id="f_branch" name="branch">' +
        BRANCHES.map(function (b) {
          return "<option" + (p.branch === b ? " selected" : "") + ">" + b + "</option>";
        }).join("") +
        "</select></div>") +
    '<div class="field"><label for="f_firm">Firma</label><input type="text" id="f_firm" name="firm" value="' +
    esc(p.firm) +
    '"></div>' +
    '<div class="field"><label for="f_domain">Domeniu de activitate</label><select class="f" id="f_domain" name="domain">' +
    DOMAINS.map(function (b) {
      return "<option" + (p.domain === b ? " selected" : "") + ">" + b + "</option>";
    }).join("") +
    "</select></div>" +
    '<div class="field"><label for="f_phone">Telefon</label><input type="tel" id="f_phone" name="phone" value="' +
    esc(priv.phone || p.phone) +
    '" autocomplete="tel"></div>' +
    '<div class="field"><label for="f_email">E-mail</label><input type="email" id="f_email" name="email" value="' +
    esc(priv.email || p.email) +
    '" autocomplete="email"></div>' +
    '<div class="field"><label for="f_offer">Ofertă pentru membri</label><textarea id="f_offer" name="offer" maxlength="400">' +
    esc(p.offer) +
    '</textarea><span class="help">Nu introduce date personale ale altor persoane sau date sensibile.</span></div>'
  );
}
function demoBarHtml() {
  if (S.server || !S.store || S.store.live) return "";
  return (
    '<div class="demo-bar"><span>Mod demonstrativ: date fictive, nimic nu se salvează. Cod de probă pentru membru nou: DEMO-A2B3-C4D5.</span><label>Vezi ca <select id="demorole" aria-label="Vezi ca">' +
    [
      ["u-nat", "Președinte național"],
      ["u-pres-bv", "Președinte Brașov"],
      ["u-pres-cj", "Președinte Cluj"],
      ["u-trez-bv", "Vicepreședinte trezorier Brașov"],
      ["u-board-bv", "Conducere Brașov"],
      ["u-m1", "Membru"],
      ["u-new", "Membru nou, fără cod"],
      ["u-m5", "Membru exclus"],
    ]
      .map(function (x) {
        return '<option value="' + x[0] + '"' + (S.me.id === x[0] ? " selected" : "") + ">" + x[1] + "</option>";
      })
      .join("") +
    "</select></label></div>"
  );
}
function localClaim() {
  return col("data/users/" + S.me.id).filter(function (x) {
    return x.id === "claim";
  })[0];
}
function renderLogin() {
  return (
    demoBarHtml() +
    '<div class="gate"><div class="gate-top">' +
    logoHtml() +
    '</div><div class="gate-in" style="margin-top:120px"><h1>Intră în aplicație</h1><p class="small" style="margin:8px 0 16px">Introdu codul de membru primit de la președintele filialei tale la înscriere.</p><form id="loginform"><div class="field"><label for="lg_code">Codul de membru</label><input type="text" id="lg_code" name="code" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" maxlength="20"></div><div class="err" id="lgerr"></div><div class="sheet-acts"><button class="btn" type="submit">Continuă</button></div></form>' +
    '<div class="sec-h"><h2>Ai o funcție de conducere?</h2></div><p class="small">Contul de conducere îl creează persoana care te numește în funcție. Trimite-i codul contului tău:</p><p class="num" style="overflow-wrap:anywhere;font-family:monospace;margin:8px 0">' +
    esc(S.me.id) +
    '</p><button class="btn sec sm" data-act="copyid">Copiază codul contului</button></div></div>'
  );
}
function renderWaiting(cl) {
  return (
    demoBarHtml() +
    '<div class="gate"><div class="gate-top">' +
    logoHtml() +
    '</div><div class="gate-in" style="margin-top:120px"><h1>Cerere trimisă</h1><p style="margin:12px 0">Am primit codul care se termină în <b>' +
    esc(String(cl.code || "").slice(-4)) +
    '</b>. Conducerea filialei îl verifică. Confirmarea vine automat când președintele sau trezorierul deschide aplicația; poți închide pagina și reveni.</p><div class="sheet-acts"><button class="btn sec" data-act="newcode">Introdu alt cod</button></div></div></div>'
  );
}
function renderExcluded(bd) {
  var txt =
    bd.reason === "manual"
      ? "Contul tău a fost suspendat de conducerea filialei" +
        (bd.branch ? " " + esc(bd.branch) : "") +
        ". Pentru detalii, contactează președintele filialei."
      : "Calitatea ta de membru a expirat la " +
        dro(bd.validUntil) +
        ", iar de peste 3 luni cotizația nu a fost achitată, deci contul a fost scos automat din aplicație. Accesul revine după plata cotizației. Contactează președintele filialei" +
        (bd.branch ? " " + esc(bd.branch) : "") +
        ".";
  return (
    demoBarHtml() +
    '<div class="gate"><div class="gate-top">' +
    logoHtml() +
    '</div><div class="gate-in" style="margin-top:120px"><h1>Accesul tău a fost suspendat</h1><p style="margin:12px 0">' +
    txt +
    "</p>" +
    (S.server ? '<div class="sheet-acts"><button class="btn sec" data-act="logout">Ieși din cont</button></div>' : "") +
    "</div></div>"
  );
}
function bindLogin() {
  var f = document.getElementById("loginform");
  if (f)
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      submitCode(new FormData(f));
    });
}
async function submitCode(fd) {
  var c = normCode(fd.get("code"));
  var e = document.getElementById("lgerr");
  if (c.length !== 12) {
    e.textContent = "Codul are 12 caractere, de exemplu K7M2-9QXA-4TLD.";
    return;
  }
  var id = S.me.id;
  var rec = { code: c, at: new Date().toISOString() };
  try {
    await S.store.set("claims", id, rec);
  } catch (err) {
    e.textContent = "Nu am putut trimite codul. Încearcă din nou.";
    return;
  }
  try {
    await S.store.set("data/users/" + id, "claim", rec);
  } catch (err) {}
  toast("Codul a fost trimis.");
}
function renderServerLogin() {
  return (
    '<div class="gate"><div class="gate-top">' +
    logoHtml() +
    '</div><div class="gate-in" style="margin-top:120px"><h1>Intră în aplicație</h1><p class="small" style="margin:8px 0 16px">Intră cu e-mailul și parola contului tău. Codul primit de la președintele filialei se folosește o singură dată, la prima intrare.</p><form id="pwform"><div class="field"><label for="lg_email">E-mail</label><input type="email" id="lg_email" name="email" autocomplete="username" maxlength="120"></div><div class="field"><label for="lg_pass">Parolă</label><input type="password" id="lg_pass" name="password" autocomplete="current-password" maxlength="100"></div><div class="err" id="pwerr" role="alert"></div><div class="sheet-acts"><button class="btn" type="submit">Intră</button></div></form>' +
    '<details style="margin-top:24px"><summary class="small">Prima intrare? Am un cod</summary><form id="svform" style="margin-top:12px"><div class="field"><label for="lg_code">Codul de membru</label><input type="text" id="lg_code" name="code" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" maxlength="20"></div><div class="err" id="lgerr" role="alert"></div><div class="sheet-acts"><button class="btn sec" type="submit">Continuă</button></div></form></details>' +
    '<details style="margin-top:16px"><summary class="small">Administrator tehnic</summary><form id="modform" style="margin-top:12px"><div class="field"><label for="lg_key">Cheia administratorului</label><input type="password" id="lg_key" name="key" autocomplete="off"></div><div class="err" id="mderr" role="alert"></div><div class="sheet-acts"><button class="btn sec" type="submit">Intră ca administrator</button></div></form></details></div></div>'
  );
}
/* Ecranul „Setează e-mailul și parola”: după intrarea cu cod, până se pun e-mailul și parola nu se poate face nimic altceva. */
function renderNeedCred() {
  return (
    '<div class="gate"><div class="gate-top">' +
    logoHtml() +
    '</div><div class="gate-in" style="margin-top:120px"><h1>Setează e-mailul și parola</h1><p class="small" style="margin:8px 0 16px">De acum intri cu e-mailul și parola. Codul primit nu mai poate fi folosit.</p><form id="credform"><div class="field"><label for="sc_email">E-mail</label><input type="email" id="sc_email" name="email" autocomplete="username" maxlength="120"></div><div class="field"><label for="sc_pass">Parolă</label><input type="password" id="sc_pass" name="password" autocomplete="new-password" maxlength="100"><span class="help">Între 8 și 100 de caractere.</span></div><div class="field"><label for="sc_pass2">Confirmă parola</label><input type="password" id="sc_pass2" name="password2" autocomplete="new-password" maxlength="100"></div><div class="err" id="crerr" role="alert"></div><div class="sheet-acts"><button class="btn" type="submit">Salvează</button><button class="btn sec" type="button" data-act="logout">Ieși din cont</button></div></form></div></div>'
  );
}
function validEmail(e) {
  return e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
function bindNeedCred() {
  var f = document.getElementById("credform");
  if (!f) return;
  f.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var fd = new FormData(f);
    var e = document.getElementById("crerr");
    var em = String(fd.get("email") || "")
      .trim()
      .toLowerCase();
    var pw = String(fd.get("password") || "");
    e.textContent = "";
    if (!validEmail(em)) {
      e.textContent = "Introdu o adresă de e-mail validă.";
      return;
    }
    if (pw.length < 8 || pw.length > 100) {
      e.textContent = "Parola are între 8 și 100 de caractere.";
      return;
    }
    if (pw !== String(fd.get("password2") || "")) {
      e.textContent = "Parolele nu coincid.";
      return;
    }
    svPost("/api/app/setcred", { email: em, password: pw })
      .then(function (r) {
        if (r.status === 200) {
          location.reload();
          return;
        }
        e.textContent = (r.body && r.body.error) || "Nu am putut salva. Încearcă din nou.";
      })
      .catch(function () {
        e.textContent = "Nu am putut contacta serverul. Verifică conexiunea.";
      });
  });
}
function svPost(url, body) {
  return fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(function (r) {
    return r
      .json()
      .catch(function () {
        return {};
      })
      .then(function (j) {
        if (r.status === 403 && j && j.needCred) location.reload();
        return { status: r.status, body: j };
      });
  });
}
function showServerLogin() {
  var app = document.getElementById("app");
  app.innerHTML = renderServerLogin();
  /* fields: numele câmpurilor trimise; parola nu se păstrează nicăieri, câmpul se golește după trimitere */
  function handle(form, errId, url, fields) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var e = document.getElementById(errId);
      e.textContent = "";
      var fd = new FormData(form);
      var b = {};
      fields.forEach(function (f) {
        b[f] = String(fd.get(f) || "");
      });
      if (b.code !== undefined && normCode(b.code).length !== 12) {
        e.textContent = "Codul are 12 caractere, de exemplu K7M2-9QXA-4TLD.";
        return;
      }
      if (b.email !== undefined) {
        b.email = b.email.trim().toLowerCase();
        if (!b.email || !b.password) {
          e.textContent = "Completează e-mailul și parola.";
          return;
        }
      }
      if (b.password !== undefined) {
        var pf = form.querySelector('input[type="password"]');
        if (pf) pf.value = "";
      }
      svPost(url, b)
        .then(function (r) {
          if (r.status === 200) {
            location.reload();
            return;
          }
          if (r.status === 403 && r.body.excluded) {
            S.mode = "excluded";
            app.innerHTML = renderExcluded(r.body);
            return;
          }
          e.textContent =
            r.body.error || (r.status === 429 ? "Prea multe încercări. Așteaptă o oră." : "Nu am putut intra. Încearcă din nou.");
        })
        .catch(function () {
          e.textContent = "Nu am putut contacta serverul. Verifică conexiunea.";
        });
    });
  }
  handle(document.getElementById("pwform"), "pwerr", "/api/app/passlogin", ["email", "password"]);
  handle(document.getElementById("svform"), "lgerr", "/api/app/login", ["code"]);
  handle(document.getElementById("modform"), "mderr", "/api/app/modlogin", ["key"]);
}
function renderGate() {
  return (
    demoBarHtml() +
    '<div class="gate"><div class="gate-top">' +
    logoHtml() +
    '</div><div class="gate-in" style="margin-top:120px"><h1>Datele tale în JCI Business</h1><form id="gateform" style="margin-top:16px">' +
    profileForm(S.server && S.me ? { name: S.me.name || "" } : null, null) +
    consentBlock(null) +
    '<label class="check"><input type="checkbox" name="agree" id="agree"><span>Am citit și accept prelucrarea datelor necesare pentru contul meu.</span></label><div class="err" id="agreeerr"></div>' +
    '<div class="sheet-acts"><button class="btn" type="submit" id="gatego" disabled>Continuă</button></div></form></div></div>'
  );
}
function bindGate() {
  var f = document.getElementById("gateform");
  var ag = document.getElementById("agree"),
    go = document.getElementById("gatego");
  ag.addEventListener("change", function () {
    go.disabled = !ag.checked;
  });
  f.addEventListener("submit", function (ev) {
    ev.preventDefault();
    saveProfile(new FormData(f));
  });
}
async function saveProfile(fd) {
  var gate = !!document.getElementById("gateform");
  if (gate && !fd.get("agree")) {
    var ee = document.getElementById("agreeerr");
    if (ee) ee.textContent = "Pentru a continua, trebuie să accepți prelucrarea datelor.";
    return;
  }
  var name = String(fd.get("name") || "").trim();
  if (!name) {
    toast("Completează câmpul Nume.");
    return;
  }
  var em = String(fd.get("email") || "").trim();
  if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    toast("Adresa de e-mail nu este validă.");
    return;
  }
  var c = {
    directory: !!fd.get("c_dir"),
    phone: !!fd.get("c_phone"),
    email: !!fd.get("c_mail"),
    offer: !!fd.get("c_offer"),
    version: CONSENT_VERSION,
    at: new Date().toISOString(),
  };
  var phone = String(fd.get("phone") || "")
      .trim()
      .slice(0, 30),
    email = em.slice(0, 120);
  var p = {
    name: name.slice(0, 100),
    branch: fd.get("branch"),
    firm: String(fd.get("firm") || "").slice(0, 100),
    domain: fd.get("domain"),
    offer: c.offer ? String(fd.get("offer") || "").slice(0, 400) : "",
    phone: c.phone ? phone : "",
    email: c.email ? email : "",
    consent: c,
  };
  var id = S.me.id;
  var warn = false;
  try {
    await S.store.set("profiles", id, p);
  } catch (e) {
    toast("Nu am putut salva profilul. Încearcă din nou.");
    return;
  }
  try {
    await S.store.set("data/users/" + id, "contact", {
      phone: phone,
      email: email,
      offerDraft: String(fd.get("offer") || "").slice(0, 400),
    });
  } catch (e) {
    warn = true;
  }
  toast(
    warn
      ? "Profilul a fost salvat, dar o parte din date nu s-a scris. Salvează din nou din Profilul meu."
      : "Modificările au fost salvate.",
  );
}
