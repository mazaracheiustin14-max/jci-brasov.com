/* Stocare: server (/api/app), demonstrativ (memorie) și pilotul vechi de pe claude.ai */
function normSnap(s) {
  var out = [];
  var arr = [];
  if (Array.isArray(s)) arr = s;
  else if (s && s.docs) arr = s.docs;
  else if (s && typeof s.forEach === "function")
    s.forEach(function (d) {
      arr.push(d);
    });
  arr.forEach(function (d) {
    var data = typeof d.data === "function" ? d.data() : d.data && typeof d.data === "object" ? d.data : d;
    var id = d.id || (data && data.id);
    if (id == null) return;
    var o = {};
    for (var k in data) o[k] = data[k];
    o.id = id;
    out.push(o);
  });
  return out;
}
function makeLiveStore(db) {
  var unsubs = [];
  return {
    live: true,
    sub: function (path, cb) {
      try {
        var u = db.collection(path).onSnapshot(
          function (s) {
            cb(normSnap(s));
          },
          function (e) {
            cb(null, e);
          },
        );
        if (typeof u === "function") unsubs.push(u);
      } catch (e) {
        cb(null, e);
      }
    },
    set: function (path, id, obj) {
      return db.collection(path).doc(id).set(obj);
    },
    del: function (path, id) {
      return db.collection(path).doc(id).delete();
    },
    reset: function () {
      unsubs.forEach(function (u) {
        try {
          u();
        } catch (e) {}
      });
      unsubs = [];
    },
  };
}
function makeHttpStore() {
  var subs = {},
    revs = {},
    timer = 0,
    t0 = 0,
    inflight = false,
    again = false,
    started = false,
    lastPull = 0,
    lastAct = Date.now();
  /* Economie de cereri: actualizare la 60 s doar cât pagina e vizibilă și omul a fost activ în ultimele 3 minute. */
  var POLL_MS = 60000,
    IDLE_MS = 180000;
  function post(url, body) {
    return fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r
        .json()
        .catch(function () {
          return {};
        })
        .then(function (j) {
          return { status: r.status, body: j };
        });
    });
  }
  function fireAll(paths, err) {
    paths.forEach(function (p) {
      delete revs[p];
      (subs[p] || []).forEach(function (cb) {
        cb(null, err);
      });
    });
  }
  function pull() {
    if (inflight) {
      again = true;
      return Promise.resolve();
    }
    var paths = Object.keys(subs);
    if (!paths.length) return Promise.resolve();
    inflight = true;
    lastPull = Date.now();
    return post("/api/app/pull", { paths: paths, revs: revs })
      .then(function (r) {
        inflight = false;
        if (r.status === 401 || (r.status === 403 && r.body && r.body.excluded)) {
          location.reload();
          return;
        }
        if (r.status !== 200) {
          fireAll(paths, new Error("http " + r.status));
          return;
        }
        var d = r.body.data || {},
          er = r.body.errors || {},
          rv = r.body.rev || {};
        paths.forEach(function (p) {
          if (er[p]) {
            delete revs[p];
            (subs[p] || []).forEach(function (cb) {
              cb(null, new Error("acces " + er[p]));
            });
            return;
          }
          if (rv[p] !== undefined) revs[p] = rv[p];
          if (d[p] !== undefined)
            (subs[p] || []).forEach(function (cb) {
              cb(d[p]);
            });
        });
      })
      .catch(function () {
        inflight = false;
        fireAll(paths, new Error("rețea"));
      })
      .then(function () {
        if (again) {
          again = false;
          return pull();
        }
      });
  }
  function loop() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (!document.hidden && Date.now() - lastAct < IDLE_MS) pull();
      loop();
    }, POLL_MS);
  }
  function write(body) {
    return post("/api/app/write", body).then(function (r) {
      if (r.status === 401) {
        location.reload();
        throw new Error("sesiune");
      }
      if (r.status !== 200) throw new Error((r.body && r.body.error) || "http " + r.status);
      return pull();
    });
  }
  if (!window._jcibVis) {
    window._jcibVis = 1;
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && S.store && S.store.server) S.store.touch(15000);
    });
    ["pointerdown", "keydown"].forEach(function (ev) {
      document.addEventListener(
        ev,
        function () {
          if (S.store && S.store.server) S.store.touch(POLL_MS);
        },
        { passive: true },
      );
    });
  }
  return {
    live: true,
    server: true,
    sub: function (path, cb) {
      (subs[path] = subs[path] || []).push(cb);
      clearTimeout(t0);
      t0 = setTimeout(pull, 20);
      if (!started) {
        started = true;
        loop();
      }
    },
    set: function (path, id, obj) {
      return write({ path: path, id: id, data: obj });
    },
    del: function (path, id) {
      return write({ path: path, id: id, del: true });
    },
    refresh: function () {
      return pull();
    },
    /* semnal de activitate: reîmprospătează doar dacă ultima citire e mai veche de minAge ms */
    touch: function (minAge) {
      lastAct = Date.now();
      if (Date.now() - lastPull > minAge) pull();
    },
    reset: function () {
      subs = {};
      revs = {};
      clearTimeout(timer);
      clearTimeout(t0);
      started = false;
    },
  };
}
function makeMemStore(seed) {
  var data = {},
    subs = {};
  function list(p) {
    var m = data[p] || {};
    return Object.keys(m).map(function (k) {
      var o = JSON.parse(JSON.stringify(m[k]));
      o.id = k;
      return o;
    });
  }
  function emit(p) {
    (subs[p] || []).forEach(function (cb) {
      cb(list(p));
    });
  }
  var st = {
    live: false,
    sub: function (p, cb) {
      (subs[p] = subs[p] || []).push(cb);
      setTimeout(function () {
        cb(list(p));
      }, 0);
    },
    set: function (p, id, o) {
      (data[p] = data[p] || {})[id] = JSON.parse(JSON.stringify(o));
      emit(p);
      return Promise.resolve();
    },
    del: function (p, id) {
      if (data[p]) delete data[p][id];
      emit(p);
      return Promise.resolve();
    },
    reset: function () {
      subs = {};
    },
  };
  if (seed)
    seed(function (p, id, o) {
      (data[p] = data[p] || {})[id] = o;
    });
  return st;
}
function demoSeed(put) {
  var P = [
    ["m1", "Andrei Popescu", "Brașov", "Avocat", "Cabinet Popescu și Asociații", "Drept comercial și contracte"],
    ["m2", "Ioana Dumitrescu", "Brașov", "Fotograf", "Studio Lumină", "Foto de eveniment, reducere 15% pentru membri"],
    ["m3", "Radu Ionescu", "Brașov", "IT și tehnologie", "Nordic Soft", "Site-uri și automatizări, ofertă gratuită de audit"],
    ["m4", "Maria Stoica", "Cluj", "Marketing și comunicare", "Atelier Digital", "Strategie social media"],
    ["m5", "Vlad Munteanu", "Cluj", "Contabilitate și finanțe", "Cont Plus", "Contabilitate pentru ONG-uri"],
    ["m6", "Elena Barbu", "București", "Educație și training", "Skill Lab", "Traininguri pentru echipe"],
  ];
  var ids = {};
  P.forEach(function (p, i) {
    var id = "u-" + p[0];
    ids[p[0]] = id;
    put("profiles", id, {
      name: p[1],
      branch: p[2],
      domain: p[3],
      firm: p[4],
      offer: p[5],
      consent: { directory: true, phone: i % 2 === 0, email: true, offer: true, version: CONSENT_VERSION },
      phone: i % 2 === 0 ? "0722 000 00" + i : "",
      email: p[1].split(" ")[1].toLowerCase() + "@exemplu.ro",
    });
    put("badges", id, {
      verified: true,
      active: i !== 4,
      validUntil: i === 4 ? "2026-07-31" : "2027-12-31",
      excluded: false,
      branch: p[2],
    });
    put("branches/" + p[2] + "/members", "r" + p[0], {
      name: p[1],
      userId: id,
      branch: p[2],
      validUntil: i === 4 ? "2026-07-31" : "2027-12-31",
    });
  });
  ["Bianca Rusu", "Dan Pavel", "Sorin Matei", "Carmen Lupu", "Paul Georgescu"].forEach(function (n, i) {
    put("branches/Brașov/members", "rb" + i, { name: n, branch: "Brașov", userId: "", validUntil: i === 0 ? "2026-09-30" : "2026-12-31" });
  });
  put("branches/Brașov/codes", "DEMOA2B3C4D5", {
    memberId: "rb0",
    createdAt: "2026-11-01",
    createdBy: "u-pres-bv",
    expiresAt: "2027-12-31",
    used: false,
  });
  ["Tudor Neagu", "Alina Preda"].forEach(function (n, i) {
    put("branches/Cluj/members", "rc" + i, { name: n, branch: "Cluj", userId: "" });
  });
  put("branches/București/members", "rx0", { name: "Cezar Vasile", branch: "București", userId: "" });
  var t = today();
  function fee(b, mid, st, extra) {
    var o = {
      memberId: mid,
      year: 2027,
      due: 30000,
      paid: st === "platita" || st === "avans" ? 30000 : 0,
      state: st,
      deadline: "2026-10-30",
      createdAt: t,
      anulat: false,
      branch: b,
    };
    for (var k in extra) o[k] = extra[k];
    return o;
  }
  put(
    "branches/Brașov/fees",
    "f1",
    fee("Brașov", "rm1", "avans", { paidOn: "2026-10-14", method: "transfer bancar", thirdParty: "Președinte", recovered: false }),
  );
  put(
    "branches/Brașov/fees",
    "f2",
    fee("Brașov", "rm2", "avans", { paidOn: "2026-10-14", method: "transfer bancar", thirdParty: "Președinte", recovered: true }),
  );
  put("branches/Brașov/fees", "f3", fee("Brașov", "rm3", "platita", { paidOn: "2026-10-20", method: "card" }));
  put("branches/Brașov/fees", "f4", fee("Brașov", "rb0", "neplatita", {}));
  put(
    "branches/Brașov/fees",
    "f5",
    fee("Brașov", "rb1", "avans", { paidOn: "2026-10-14", method: "transfer bancar", thirdParty: "Președinte", recovered: false }),
  );
  put("branches/Cluj/fees", "f6", fee("Cluj", "rm4", "platita", { paidOn: "2026-10-25", method: "transfer bancar" }));
  put("branches/Cluj/fees", "f7", fee("Cluj", "rc0", "neplatita", {}));
  put("branches/București/fees", "f8", fee("București", "rm6", "platita", { paidOn: "2026-10-28", method: "card" }));
  put("branches/Brașov/donations", "d1", {
    donor: "Anonim",
    anonymous: true,
    type: "persoană fizică",
    amount: 50000,
    date: "2026-10-02",
    purpose: "Beyond the Initiative",
    doc: "",
    anulat: false,
    branch: "Brașov",
  });
  put("branches/Brașov/donations", "d2", {
    donor: "Firma Exemplu SRL",
    anonymous: false,
    type: "persoană juridică",
    amount: 150000,
    date: "2026-10-18",
    purpose: "Nedestinat",
    doc: "Contract 12/2026",
    anulat: false,
    branch: "Brașov",
  });
  put("branches/Cluj/donations", "d3", {
    donor: "Maria Stoica",
    anonymous: false,
    type: "persoană fizică",
    amount: 20000,
    date: "2026-10-22",
    purpose: "Nedestinat",
    doc: "",
    anulat: false,
    branch: "Cluj",
  });
  function ex(b, cat, d, amt, date, sup, st, extra) {
    var o = {
      category: cat,
      desc: d,
      amount: amt,
      date: date,
      supplier: sup,
      cui: "",
      state: st,
      proposedBy: "u-trez-bv",
      docNo: "",
      anulat: false,
      branch: b,
    };
    for (var k in extra) o[k] = extra[k];
    return o;
  }
  put(
    "branches/Brașov/expenses",
    "e1",
    ex("Brașov", CATS[0], "Închiriere sală pentru evenimentul de lansare", 120000, "2026-10-20", "Sala CATTIA", "platita", {
      approvedBy: "u-pres-bv",
      decision: "HCC 7/2026",
      decisionDate: "2026-10-15",
      docNo: "F 2026/114",
      paidOn: "2026-10-22",
    }),
  );
  put(
    "branches/Brașov/expenses",
    "e2",
    ex("Brașov", CATS[3], "Materiale tipărite pentru eveniment", 32000, "2026-11-03", "Tipografia Demo", "platita", {
      docNo: "F 77",
      paidOn: "2026-11-04",
    }),
  );
  put(
    "branches/Brașov/expenses",
    "e3",
    ex("Brașov", CATS[0], "Catering pentru panelul de networking", 85000, "2026-11-09", "Catering Exemplu", "propusa", {}),
  );
  put(
    "branches/Cluj/expenses",
    "e4",
    ex("Cluj", CATS[1], "Training de comunicare pentru membrii noi", 45000, "2026-10-27", "Skill Lab", "platita", {
      docNo: "F 33",
      paidOn: "2026-10-28",
      proposedBy: "u-trez-cj",
    }),
  );
  put(
    "branches/București/expenses",
    "e5",
    ex("București", CATS[7], "Comision bancar anual pentru cont", 12000, "2026-10-30", "Bancă", "platita", {
      docNo: "Extras 10",
      paidOn: "2026-10-30",
      proposedBy: "u-trez-bu",
    }),
  );
  put("branches/Brașov/settings", "main", { opening: 0 });
  put("roles", "u-nat", { role: "national", branch: "" });
  put("roles", "u-pres-bv", { role: "president", branch: "Brașov" });
  put("roles", "u-trez-bv", { role: "treasurer", branch: "Brașov" });
  put("profiles", "u-pres-bv", {
    name: "Iustin Măzărache",
    branch: "Brașov",
    domain: "Turism și HoReCa",
    firm: "Hillden",
    offer: "",
    consent: { directory: false, phone: false, email: false, offer: false, version: CONSENT_VERSION },
  });
  put("profiles", "u-trez-bv", {
    name: "Trezorier Brașov (probă)",
    branch: "Brașov",
    domain: "Contabilitate și finanțe",
    firm: "",
    offer: "",
    consent: { directory: false, phone: false, email: false, offer: false, version: CONSENT_VERSION },
  });
}
