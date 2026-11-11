/* Acțiuni: toate butoanele cu data-act trec prin onAct */
function csv(rows) {
  return rows
    .map(function (r) {
      return r
        .map(function (c) {
          c = String(c == null ? "" : c);
          if (/^[=+\-@\t\r]/.test(c)) c = "'" + c;
          return /[",;\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
        })
        .join(",");
    })
    .join("\n");
}
async function copyText(t, okMsg) {
  try {
    await navigator.clipboard.writeText(t);
    toast(okMsg || "Copiat.");
  } catch (e) {
    openSheet(
      '<h2>Copiază manual</h2><textarea readonly style="min-height:200px" id="manual">' +
        esc(t) +
        '</textarea><div class="sheet-acts"><button class="btn sec" data-act="closesheet">Închide</button></div>',
    );
    var m = document.getElementById("manual");
    if (m) {
      m.focus();
      m.select();
    }
  }
}
async function onAct(act, id) {
  if (S.mode === "ui" && act !== "theme") return;
  var b = curBranch();
  if (WRITE_ACTS[act] && !canWrite()) {
    toast("Rolul tău poate doar consulta această evidență.");
    return;
  }
  if ((act === "expappr" || act === "expreject") && myRole().role !== "president") {
    toast("Doar președintele aprobă sau respinge cheltuieli.");
    return;
  }
  if (act === "exppay") {
    var pe = col("branches/" + b + "/expenses").filter(function (x) {
      return x.id === id;
    })[0];
    if (pe && pe.approvedBy === S.me.id) {
      toast("Cine aprobă nu poate înregistra plata.");
      return;
    }
  }
  if (act === "expappr") {
    var ae = col("branches/" + b + "/expenses").filter(function (x) {
        return x.id === id;
      })[0],
      fp = myProfile();
    if (ae && ae.proposedBy === S.me.id) {
      toast("Cine propune nu poate aproba aceeași cheltuială.");
      return;
    }
    if (ae && fp && fp.firm && ae.supplier && norm(fp.firm) === norm(ae.supplier)) {
      toast("Nu poți aproba o cheltuială către propria firmă.");
      return;
    }
  }
  if (act === "settings" && myRole().role !== "president") {
    toast("Doar președintele filialei modifică setările.");
    return;
  }
  switch (act) {
    case "restart":
      location.reload();
      break;
    case "fillme": {
      var f2 = document.getElementById("ru2");
      if (f2) f2.value = S.me.id;
      break;
    }
    case "demo":
      S.store = makeMemStore(demoSeed);
      S.me = { id: "u-nat", isOwner: false };
      S.tab = "director";
      S.mode = "ready";
      S.err = {};
      subscribeAll();
      render();
      break;
    case "settings": {
      var cs = getSettings(b);
      openSheet(
        "<h2>Setări filială, " +
          esc(b) +
          "</h2><form>" +
          inp("opening", "Sold inițial (RON)", String(cs.opening / 100).replace(".", ","), "text", "so", 'inputmode="decimal"') +
          inp("feeDue", "Cotizația anuală (RON)", String(cs.feeDue / 100).replace(".", ","), "text", "sf", 'inputmode="decimal"') +
          '<p class="help">Soldul inițial se ia din extrasul de cont la începutul perioadei de evidență.</p><div class="err" id="sheeterr"></div><div class="sheet-acts"><button class="btn" type="submit">Salvează</button><button class="btn sec" type="button" data-act="closesheet">Anulează</button></div></form>',
        async function (fd) {
          var so = String(fd.get("opening") || "").trim();
          var neg = so.charAt(0) === "-";
          var ob = toBani(neg ? so.slice(1) : so);
          var fb = toBani(fd.get("feeDue"));
          if (isNaN(ob)) return fieldErr("Introdu soldul inițial în lei, de exemplu 1.250,50.");
          var fm = amtMsg(fd.get("feeDue"), fb);
          if (fm) return fieldErr(fm);
          if (
            await put(
              "branches/" + b + "/settings",
              "main",
              { opening: neg ? -ob : ob, feeDue: fb },
              "update",
              "Setări filială actualizate: " + b,
            )
          ) {
            closeSheet();
            toast("Modificările au fost salvate.");
          }
        },
      );
      break;
    }
    case "tab":
      S.tab = id;
      location.hash = id;
      render();
      window.scrollTo(0, 0);
      break;
    case "goprofil":
      S.tab = "profil";
      render();
      window.scrollTo(0, 0);
      break;
    case "theme": {
      var cur =
        document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      var nx = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", nx);
      lsSet("jcib-theme", nx);
      break;
    }
    case "fb":
      S.fb = id;
      render();
      break;
    case "fd":
      S.fd = id;
      render();
      break;
    case "resetf":
      S.fb = "Toate";
      S.fd = "Toate";
      S.q = "";
      render();
      break;
    case "retry":
      subscribeAll();
      break;
    case "godir":
      S.tab = "director";
      render();
      break;
    case "profile":
      openProfile(id);
      break;
    case "closesheet":
      closeSheet();
      break;
    case "copy":
      copyText(id, "Telefon copiat.");
      break;
    case "logout":
      try {
        await svPost("/api/app/logout", {});
      } catch (e) {}
      location.reload();
      break;
    case "copyid":
      copyText(S.me.id, "Codul a fost copiat.");
      break;
    case "export": {
      var p = myProfile() || {};
      var priv =
        col("data/users/" + S.me.id).filter(function (x) {
          return x.id === "contact";
        })[0] || {};
      copyText(
        JSON.stringify({ cont: S.me.id, profil: p, contactPrivat: priv, insigna: badgeOf(S.me.id) || null }, null, 2),
        "Datele au fost copiate.",
      );
      break;
    }
    case "delprofile":
      openSheet(
        '<h2>Șterge profilul</h2><p>Profilul tău dispare din director imediat. Insigna „Membru activ” o poate retrage conducerea filialei. Înregistrările contabile se păstrează restrâns, pe perioada legală.</p><div class="sheet-acts"><button class="btn crit" data-act="delprofile2">Șterge definitiv</button><button class="btn sec" data-act="closesheet">Renunț</button></div>',
      );
      break;
    case "delprofile2":
      try {
        await S.store.del("profiles", S.me.id);
        await safe(function () {
          return S.store.del("data/users/" + S.me.id, "contact");
        });
        closeSheet();
        toast("Profilul a fost șters.");
      } catch (e) {
        toast("Nu am putut șterge profilul.");
      }
      break;
    case "fv":
      S.feeView = id;
      render();
      break;
    case "ff":
      S.feeFilter = id;
      render();
      break;
    case "ef":
      S.expFilter = id;
      render();
      break;
    case "newmember":
      sheetNewMember();
      break;
    case "newfee":
      sheetFee();
      break;
    case "newdon":
      sheetDon();
      break;
    case "newexp":
      sheetExp();
      break;
    case "fee":
      detailFee(id);
      break;
    case "don":
      detailDon(id);
      break;
    case "exp":
      detailExp(id);
      break;
    case "feepaid":
      openSheet(
        "<h2>Marchează plătită</h2><form>" +
          inp("paidOn", "Data plății", today(), "date", "pp") +
          sel("method", ["transfer bancar", "card", "numerar", "compensare cu președintele"], "transfer bancar", "Metoda", "pm") +
          '<div class="err" id="sheeterr"></div><div class="sheet-acts"><button class="btn" type="submit">Salvează</button><button class="btn sec" type="button" data-act="closesheet">Anulează</button></div></form>',
        async function (fd) {
          if (!fd.get("paidOn")) return fieldErr("Alege data.");
          var f = col("branches/" + b + "/fees").filter(function (x) {
            return x.id === id;
          })[0];
          if (
            await feeUpdate(
              id,
              { state: "platita", paid: f.due, paidOn: fd.get("paidOn"), method: fd.get("method") },
              "Cotizație marcată plătită: " + memberName(b, f.memberId),
            )
          ) {
            closeSheet();
            toast("Modificările au fost salvate.");
          }
        },
      );
      break;
    case "feerec": {
      var ff = col("branches/" + b + "/fees").filter(function (x) {
        return x.id === id;
      })[0];
      if (
        await feeUpdate(id, { recovered: true, recoveredOn: today() }, "Cotizație recuperată de la membru: " + memberName(b, ff.memberId))
      ) {
        closeSheet();
        toast("Modificările au fost salvate.");
      }
      break;
    }
    case "feecancel":
      reasonForm("Anulează cotizația", "Anulează", async function (r) {
        if (await feeUpdate(id, { anulat: true, cancelReason: r }, "Cotizație anulată: " + r.slice(0, 40))) {
          closeSheet();
          toast("Modificările au fost salvate.");
        }
      });
      break;
    case "doncancel":
      reasonForm("Anulează donația", "Anulează", async function (r) {
        var d = col("branches/" + b + "/donations").filter(function (x) {
          return x.id === id;
        })[0];
        var o = Object.assign({}, d);
        delete o.id;
        o.anulat = true;
        o.cancelReason = r;
        if (await put("branches/" + b + "/donations", id, o, "update", "Donație anulată: " + r.slice(0, 40))) {
          closeSheet();
          toast("Modificările au fost salvate.");
        }
      });
      break;
    case "expcancel":
      reasonForm("Anulează cheltuiala", "Anulează", async function (r) {
        if (await expUpdate(id, { anulat: true, cancelReason: r }, "Cheltuială anulată: " + r.slice(0, 40))) {
          closeSheet();
          toast("Modificările au fost salvate.");
        }
      });
      break;
    case "expreject":
      reasonForm(
        "Respinge cheltuiala",
        "Respinge",
        async function (r) {
          if (await expUpdate(id, { state: "respinsa", rejectReason: r }, "Cheltuială respinsă: " + r.slice(0, 40))) {
            closeSheet();
            toast("Modificările au fost salvate.");
          }
        },
        10,
      );
      break;
    case "expappr": {
      var e = col("branches/" + b + "/expenses").filter(function (x) {
        return x.id === id;
      })[0];
      var big = isOver(e);
      openSheet(
        "<h2>Aprobă cheltuiala</h2><form><p>" +
          esc(e.desc) +
          "<br><b>" +
          fmt(e.amount) +
          " RON</b></p>" +
          (big
            ? '<p class="small">Peste 500 RON: introdu hotărârea Consiliului de Conducere (Art. 31).</p>' +
              inp("decision", "Număr hotărâre", "", "text", "hn") +
              inp("decisionDate", "Data hotărârii", today(), "date", "hd")
            : "") +
          '<div class="err" id="sheeterr"></div><div class="sheet-acts"><button class="btn" type="submit">Aprobă</button><button class="btn sec" type="button" data-act="closesheet">Renunț</button></div></form>',
        async function (fd) {
          if (e.proposedBy === S.me.id) return fieldErr("Cine propune nu poate aproba aceeași cheltuială.");
          if (big && (!String(fd.get("decision") || "").trim() || !fd.get("decisionDate")))
            return fieldErr("Completează numărul și data hotărârii.");
          if (
            await expUpdate(
              id,
              {
                state: "aprobata",
                approvedBy: S.me.id,
                decision: big ? String(fd.get("decision")).trim() : "",
                decisionDate: big ? fd.get("decisionDate") : "",
                approvedOn: today(),
              },
              "Cheltuială aprobată: " + e.desc.slice(0, 40),
            )
          ) {
            closeSheet();
            toast("Modificările au fost salvate.");
          }
        },
      );
      break;
    }
    case "exppay": {
      var e2 = col("branches/" + b + "/expenses").filter(function (x) {
        return x.id === id;
      })[0];
      if (isOver(e2) && e2.state !== "aprobata") {
        toast("Peste 500 RON, plata cere aprobarea Consiliului.");
        break;
      }
      openSheet(
        "<h2>Marchează plătită</h2><form>" +
          inp("paidOn", "Data plății", today(), "date", "xp") +
          inp("docNo", "Număr document justificativ", e2.docNo || "", "text", "xq") +
          '<p class="help">Fără document justificativ, cheltuiala nu poate fi marcată plătită.</p><div class="err" id="sheeterr"></div><div class="sheet-acts"><button class="btn" type="submit">Salvează</button><button class="btn sec" type="button" data-act="closesheet">Renunț</button></div></form>',
        async function (fd) {
          if (!fd.get("paidOn")) return fieldErr("Alege data.");
          if (!String(fd.get("docNo") || "").trim()) return fieldErr("Completează numărul documentului justificativ.");
          if (
            await expUpdate(
              id,
              { state: "platita", paidOn: fd.get("paidOn"), docNo: String(fd.get("docNo")).trim() },
              "Cheltuială plătită: " + e2.desc.slice(0, 40),
            )
          ) {
            closeSheet();
            toast("Modificările au fost salvate.");
          }
        },
      );
      break;
    }
    case "member": {
      var mb = b;
      scopeBranches().forEach(function (x) {
        if (
          col("branches/" + x + "/members").some(function (y) {
            return y.id === id;
          })
        )
          mb = x;
      });
      var m = col("branches/" + mb + "/members").filter(function (x) {
        return x.id === id;
      })[0];
      if (!m) break;
      S._mb = mb;
      var isPres = myRole().role === "president";
      var mRole = roleOfMember(m);
      var canCode = isPres && !m.excluded;
      var canExclude = isPres && !isSelf(m) && !(mRole && mRole.role === "national");
      var mv = memberValidity(mb, m);
      var linkTxt = S.server
        ? m.userId
          ? "Cont activ în aplicație."
          : "Contul nu e activat încă."
        : m.userId
          ? "Cont legat. Codul: " + esc(m.userId)
          : "Fără cont în aplicație.";
      openSheet(
        "<h2>" +
          esc(m.name) +
          '</h2><p class="small">' +
          linkTxt +
          (mv.vu ? " Valabil până la " + dro(mv.vu) + "." : "") +
          "</p>" +
          (m.excluded ? '<div class="notice">Contul este suspendat de conducerea filialei.</div>' : "") +
          (isPres
            ? "<form>" +
              inp("validUntil", "Calitatea de membru valabilă până la", m.validUntil || "", "date", "mvu") +
              (S.server ? "" : inp("userId", "Codul contului", m.userId || "", "text", "mu", 'autocomplete="off"')) +
              '<div class="sheet-acts"><button class="btn" type="submit">Salvează</button><button class="btn sec" type="button" data-act="closesheet">Închide</button></div></form>'
            : '<div class="sheet-acts"><button class="btn sec" data-act="closesheet">Închide</button></div>') +
          (canCode && (S.server || !m.userId)
            ? '<div class="sec-h"><h2>Cod de înscriere</h2></div><p class="small">' +
              (S.server && m.userId
                ? "Contul e deja activ. Generează un cod nou dacă membrul își schimbă telefonul sau pierde accesul. "
                : "Generează codul pe care membrul îl introduce la prima intrare în aplicație. ") +
              'Codul e valabil 14 zile și se poate folosi o singură dată.</p><button class="btn sec" data-act="gencode" data-id="' +
              esc(m.id) +
              '">Generează cod</button>'
            : "") +
          (canExclude
            ? '<div class="sec-h"><h2>Acces în aplicație</h2></div><p class="small">' +
              (m.excluded
                ? "Reactivarea readuce contul exact cum era."
                : "Excluderea suspendă contul imediat. Nimic nu se șterge, iar contul se poate reactiva oricând.") +
              '</p><div class="acts">' +
              (m.excluded
                ? '<button class="btn" data-act="reactivate" data-id="' + esc(m.id) + '">Reactivează</button>'
                : '<button class="btn crit" data-act="exclude" data-id="' + esc(m.id) + '">Exclude din aplicație</button>') +
              "</div>"
            : ""),
        isPres
          ? async function (fd) {
              var u = S.server ? m.userId || "" : String(fd.get("userId") || "").trim();
              var o = Object.assign({}, m);
              delete o.id;
              o.userId = u;
              var vu = String(fd.get("validUntil") || "");
              if (vu) o.validUntil = vu;
              if (await put("branches/" + mb + "/members", id, o, "update", "Date membru actualizate: " + m.name)) {
                if (u) {
                  await recomputeBadge(mb, id, Object.assign({ id: id }, o));
                }
                closeSheet();
                toast("Modificările au fost salvate.");
              }
            }
          : undefined,
      );
      break;
    }
    case "gencode": {
      var gb = S._mb || b;
      var gm = col("branches/" + gb + "/members").filter(function (x) {
        return x.id === id;
      })[0];
      if (!gm) break;
      if (S.server) {
        try {
          var rr = await svPost("/api/app/code", { branch: gb, memberId: id });
          if (rr.status !== 200) {
            toast(rr.body.error || "Nu am putut genera codul.");
            break;
          }
          showCode(gm.name, rr.body.code, rr.body.expires);
        } catch (e) {
          toast("Nu am putut genera codul.");
        }
        break;
      }
      if (myRole().role !== "president") break;
      var cd = genCode();
      var exp = addDays(today(), 14);
      if (
        await put(
          "branches/" + gb + "/codes",
          cd,
          { memberId: id, createdAt: today(), createdBy: S.me.id, expiresAt: exp, used: false },
          "code",
          "Cod de înscriere generat pentru " + gm.name,
        )
      )
        showCode(gm.name, cd, exp);
      break;
    }
    case "copycode":
      copyText(fmtCode(id), "Codul a fost copiat.");
      break;
    case "newcode":
      try {
        await S.store.del("claims", S.me.id);
      } catch (e) {}
      try {
        await S.store.del("data/users/" + S.me.id, "claim");
      } catch (e) {}
      break;
    case "handover":
      sheetHandover();
      break;
    case "newrole":
      sheetNewRole();
      break;
    case "role":
      sheetRole(id);
      break;
    case "roleoff":
      doRoleOff(id);
      break;
    case "exclude":
      sheetExclude(id);
      break;
    case "exclude2":
      doExclude(id);
      break;
    case "reactivate":
      doReactivate(id);
      break;
    case "natset":
      sheetSetNational();
      break;
    case "natcode":
      doLeaderCode(id);
      break;
    case "addbranch":
      sheetAddBranch();
      break;
    case "branch":
      sheetBranch(id);
      break;
    case "setpres":
      sheetSetPresident(id);
      break;
    case "prescode":
      doLeaderCode(id);
      break;
    case "claim": {
      var c = col("claims").filter(function (x) {
        return x.id === id;
      })[0];
      if (!c) break;
      if (!c.branch) c = Object.assign({}, c, { branch: curBranch(), name: c.name || "Cerere cu cod" });
      var ms = col("branches/" + c.branch + "/members");
      openSheet(
        "<h2>" +
          esc(c.name) +
          '</h2><p class="small">Cerere pentru filiala ' +
          esc(c.branch) +
          ". Verifică persoana în afara aplicației (o cunoști sau o suni), apoi leagă-o de un membru din evidență.</p><form>" +
          sel(
            "memberId",
            [["", "Membru nou, adăugat din cerere"]].concat(
              ms.map(function (m) {
                return [m.id, m.name];
              }),
            ),
            "",
            "Membru din evidență",
            "cm",
          ) +
          '<div class="sheet-acts"><button class="btn" type="submit">Verifică și leagă</button><button class="btn sec" type="button" data-act="closesheet">Închide</button></div></form>',
        async function (fd) {
          var mid = fd.get("memberId");
          var bb = c.branch;
          try {
            if (mid) {
              var m = ms.filter(function (x) {
                return x.id === mid;
              })[0];
              var o = Object.assign({}, m);
              delete o.id;
              o.userId = id;
              if (!o.validUntil) o.validUntil = defaultValid();
              await S.store.set("branches/" + bb + "/members", mid, o);
            } else {
              mid = uid();
              await S.store.set("branches/" + bb + "/members", mid, { name: c.name, branch: bb, userId: id, validUntil: defaultValid() });
            }
            await S.store.set("badges", id, { verified: true, active: true, validUntil: defaultValid(), excluded: false, branch: bb });
            await recomputeBadge(bb, mid);
            await safe(function () {
              return S.store.set("claims", id, Object.assign({}, c, { id: undefined, processed: true, status: "Verificat manual" }));
            });
            await safe(function () {
              return audit("badges", id, "verify", "Membru verificat: " + c.name);
            });
            closeSheet();
            toast("Modificările au fost salvate.");
          } catch (e) {
            toast("Scrierea a fost refuzată. Verifică nivelul de acces al contului.");
          }
        },
      );
      break;
    }
    case "csvfees":
      copyText(
        csv(
          [["membru", "an", "suma_datorata", "stare", "data_plata", "metoda", "platitor_tert", "recuperat", "anulat"]].concat(
            col("branches/" + b + "/fees").map(function (f) {
              return [
                memberName(b, f.memberId),
                f.year,
                f.due / 100,
                FEE_STATE[f.state][0],
                f.paidOn || "",
                f.method || "",
                f.thirdParty || "",
                f.recovered ? "da" : "nu",
                f.anulat ? "da" : "nu",
              ];
            }),
          ),
        ),
        "CSV copiat.",
      );
      break;
    case "csvdon":
      copyText(
        csv(
          [["donator", "suma", "data", "scop", "tip", "document", "anulat"]].concat(
            col("branches/" + b + "/donations").map(function (d) {
              return [d.anonymous ? "Anonim" : d.donor, d.amount / 100, d.date, d.purpose, d.type, d.doc, d.anulat ? "da" : "nu"];
            }),
          ),
        ),
        "CSV copiat.",
      );
      break;
    case "csvexp":
      copyText(
        csv(
          [["categorie", "descriere", "suma", "data", "furnizor", "document", "stare"]].concat(
            col("branches/" + b + "/expenses").map(function (e) {
              return [e.category, e.desc, e.amount / 100, e.date, e.supplier, e.docNo, e.anulat ? "anulată" : EXP_STATE[e.state][0]];
            }),
          ),
        ),
        "CSV copiat.",
      );
      break;
  }
}
function bindMain() {
  var m = document.getElementById("main");
  var q = document.getElementById("q");
  if (q)
    q.addEventListener("input", function () {
      S.q = q.value;
      document.getElementById("dirlist").innerHTML = dirListHtml();
    });
  var bs = document.getElementById("brsel");
  if (bs)
    bs.addEventListener("change", function () {
      S.branch = bs.value;
      render();
    });
  var pf = document.getElementById("pform");
  if (pf)
    pf.addEventListener("submit", function (ev) {
      ev.preventDefault();
      saveProfile(new FormData(pf));
    });
}
document.addEventListener("click", function (ev) {
  var t = ev.target.closest("[data-act]");
  if (t) {
    onAct(t.getAttribute("data-act"), t.getAttribute("data-id"));
    return;
  }
  if (ev.target.id === "sheetwrap") closeSheet();
});
document.addEventListener("focusout", function () {
  setTimeout(function () {
    if (S._stale) render();
  }, 80);
});
document.addEventListener("change", function (ev) {
  var dr = ev.target;
  if (dr && dr.id === "demorole") {
    S.me = { id: dr.value, isOwner: false };
    S.tab = "director";
    S.mode = "ready";
    subscribeAll();
    render();
  }
});
document.addEventListener("keydown", function (ev) {
  if (ev.key === "Escape") closeSheet();
});
window.addEventListener("hashchange", function () {
  var h = location.hash.replace("#", "");
  if (
    tabsFor().some(function (t) {
      return t[0] === h;
    }) &&
    h !== S.tab
  ) {
    S.tab = h;
    render();
  }
});
