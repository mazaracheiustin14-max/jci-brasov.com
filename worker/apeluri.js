// Apeluri către contacte, în panoul echipei: /checkin/apeluri.
// O persoană = un rând în `contacte`, indiferent din câte surse vine. Dacă e înscrisă, contactul e legat de rândul din `inscrieri`.
// Tabelul `inscrieri` nu se modifică aici, în afară de înscrierile noi făcute prin apel (aceeași logică ca formularul public).
// Numerele de telefon NU se pun în cod: depozitul e public. Contactele din afara site-ului se încarcă direct în D1.

import { EVENT, DEADLINE, EMAIL_RE, registerPerson } from "./inscriere-core.js";

const SURSE_IMPLICIT = ["Site", "WhatsApp", "Meta Ads", "Partener", "Contact personal", "Telefon", "Altă sursă"];
const RASPUNS = ["da", "nu", "mai_tarziu"];
const STATUS_FINAL = ["confirmat", "revine", "nu_participa"];
const TRI = ["da", "nu", "poate"];

const DDL = [
  "CREATE TABLE IF NOT EXISTS contacte (id INTEGER PRIMARY KEY AUTOINCREMENT, creat TEXT NOT NULL DEFAULT (datetime('now')), nume TEXT, telefon TEXT, alt_telefon TEXT, email TEXT, inscriere_id INTEGER UNIQUE, contactat INTEGER NOT NULL DEFAULT 0, contactat_de TEXT, contactat_la TEXT, status_apel TEXT, revenire TEXT)",
  "CREATE INDEX IF NOT EXISTS contacte_tel ON contacte(telefon)",
  "CREATE TABLE IF NOT EXISTS contact_surse (id INTEGER PRIMARY KEY AUTOINCREMENT, contact_id INTEGER NOT NULL, sursa TEXT NOT NULL, data TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(contact_id, sursa))",
  "CREATE TABLE IF NOT EXISTS call_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, creat TEXT NOT NULL DEFAULT (datetime('now')), contact_id INTEGER NOT NULL, inscriere_id INTEGER, apelant TEXT NOT NULL, nume_sunat TEXT NOT NULL, telefon TEXT, email TEXT, sursa TEXT, raspuns TEXT NOT NULL, revenire_la TEXT, era_inscris TEXT, ocupatie TEXT, provocare TEXT, sfat TEXT, interes TEXT, ia_acasa TEXT, oameni TEXT, intrebare_invitati TEXT, ramane_activ TEXT, status_final TEXT, vip TEXT, revine_la TEXT, motiv TEXT, acord_date INTEGER DEFAULT 0, acord_viitor INTEGER DEFAULT 0, acord_bcr INTEGER DEFAULT 0, invitatie_trimisa TEXT, observatii TEXT, rezultat_inscriere TEXT)",
  "CREATE INDEX IF NOT EXISTS call_logs_contact ON call_logs(contact_id)",
  "CREATE TABLE IF NOT EXISTS posibile_duplicate (id INTEGER PRIMARY KEY AUTOINCREMENT, a INTEGER NOT NULL, b INTEGER NOT NULL, motiv TEXT, status TEXT NOT NULL DEFAULT 'nou', creat TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(a, b))",
];
const ready = new WeakSet();
async function ensure(env) {
  if (ready.has(env.DB)) return;
  await env.DB.batch(DDL.map((s) => env.DB.prepare(s)));
  ready.add(env.DB);
}

// ---------- utilitare ----------
// Telefon normalizat: +40..., fără spații și liniuțe. Numerele străine rămân cu prefixul lor.
export function normPhone(raw) {
  const s = String(raw == null ? "" : raw).trim();
  let d = s.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) return "+" + d.slice(2);
  if (s.startsWith("+")) return "+" + d;
  if (d.startsWith("40") && d.length === 11) return "+" + d;
  if (d.startsWith("0") && d.length === 10) return "+40" + d.slice(1);
  if (d.length === 9 && d.startsWith("7")) return "+40" + d;
  return "+" + d;
}
const phoneOk = (p) => /^\+\d{9,15}$/.test(p);
function normName(n) {
  return String(n || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\s-]/g, " ").replace(/-/g, " ").split(/\s+/).filter((t) => t.length >= 3);
}
const clean = (v, max) => (typeof v === "string" ? v : "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const longText = (v, max) => (typeof v === "string" ? v : "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, max);
const noFormula = (v) => (/^[=+\-@\t\r]/.test(v) ? "'" + v : v);
function dataRo(utc) {
  if (!utc) return "";
  const d = new Date(utc.replace(" ", "T") + "Z");
  return d.toLocaleString("ro-RO", { timeZone: "Europe/Bucharest", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
async function setting(env, k) {
  const r = await env.DB.prepare("SELECT valoare FROM setari WHERE cheie=?").bind(k).first();
  return r ? r.valoare : null;
}
async function listSetting(env, k, dflt) {
  const v = await setting(env, k);
  const a = (v || "").split(",").map((x) => x.trim()).filter(Boolean);
  return a.length ? a : dflt;
}

// ---------- sincronizare cu înscrierile ----------
// Înscrierile reale (confirmat sau listă de așteptare, fără teste) devin contacte. Dacă telefonul există deja ca contact
// (de exemplu din WhatsApp), contactul se leagă de înscriere și primește și sursa „Site”; altfel apare un contact nou.
async function syncContacts(env) {
  await mergeSamePhone(env);
  const ins = (await env.DB.prepare(
    "SELECT id, nume, email, telefon FROM inscrieri WHERE eveniment=? AND status IN ('confirmat','asteptare') AND id NOT IN (SELECT inscriere_id FROM contacte WHERE inscriere_id IS NOT NULL) ORDER BY id"
  ).bind(EVENT).all()).results || [];
  if (!ins.length) return;
  const free = (await env.DB.prepare("SELECT id, telefon FROM contacte WHERE inscriere_id IS NULL").all()).results || [];
  const byPhone = new Map();
  for (const c of free) if (c.telefon && !byPhone.has(c.telefon)) byPhone.set(c.telefon, c.id);
  for (const r of ins) {
    const p = normPhone(r.telefon);
    const cid = p ? byPhone.get(p) : null;
    let id = cid;
    if (cid) {
      byPhone.delete(p);
      await env.DB.prepare("UPDATE contacte SET inscriere_id=?, nume=?, email=? WHERE id=?").bind(r.id, r.nume, r.email, cid).run();
    } else {
      const res = await env.DB.prepare("INSERT INTO contacte (nume, telefon, email, inscriere_id) VALUES (?,?,?,?)").bind(r.nume, p || null, r.email, r.id).run();
      id = res.meta.last_row_id;
    }
    await env.DB.prepare("INSERT OR IGNORE INTO contact_surse (contact_id, sursa) VALUES (?, 'Site')").bind(id).run();
  }
}

// Unește două contacte: apelurile și sursele trec la cel păstrat; telefonul celuilalt rămâne ca „alt număr”.
async function mergeContacts(env, keep, drop, dupId) {
  const alt = drop.telefon && drop.telefon !== keep.telefon ? drop.telefon : (keep.alt_telefon || null);
  const stmts = [
    env.DB.prepare("UPDATE OR IGNORE contact_surse SET contact_id=? WHERE contact_id=?").bind(keep.id, drop.id),
    env.DB.prepare("DELETE FROM contact_surse WHERE contact_id=?").bind(drop.id),
    env.DB.prepare("UPDATE call_logs SET contact_id=? WHERE contact_id=?").bind(keep.id, drop.id),
    env.DB.prepare("UPDATE contacte SET nume=COALESCE(NULLIF(nume,''),?), email=COALESCE(NULLIF(email,''),?), alt_telefon=COALESCE(alt_telefon,?), contactat=MAX(contactat,?), contactat_de=COALESCE(contactat_de,?), contactat_la=COALESCE(contactat_la,?), status_apel=COALESCE(status_apel,?), revenire=COALESCE(revenire,?) WHERE id=?")
      .bind(drop.nume, drop.email, alt, drop.contactat || 0, drop.contactat_de, drop.contactat_la, drop.status_apel, drop.revenire, keep.id),
  ];
  if (dupId) stmts.push(env.DB.prepare("DELETE FROM posibile_duplicate WHERE id=?").bind(dupId));
  stmts.push(env.DB.prepare("DELETE FROM posibile_duplicate WHERE a=? OR b=?").bind(drop.id, drop.id));
  stmts.push(env.DB.prepare("DELETE FROM contacte WHERE id=?").bind(drop.id));
  await env.DB.batch(stmts);
}

// Același telefon normalizat = aceeași persoană (regula de deduplicare). Dacă ambele au înscriere proprie, nu se unesc:
// perechea ajunge la „posibile duplicate”.
async function mergeSamePhone(env) {
  const groups = (await env.DB.prepare("SELECT telefon FROM contacte WHERE telefon IS NOT NULL AND telefon<>'' GROUP BY telefon HAVING COUNT(*)>1").all()).results || [];
  for (const g of groups) {
    const rows = (await env.DB.prepare("SELECT * FROM contacte WHERE telefon=? ORDER BY inscriere_id IS NULL, id").bind(g.telefon).all()).results || [];
    const keep = rows[0];
    for (const r of rows.slice(1)) if (!r.inscriere_id) await mergeContacts(env, keep, r, 0);
  }
}

// Posibile duplicate: același email sau nume care se conțin unul pe altul, cu telefoane diferite. Nu se unesc automat.
async function detectDuplicates(env) {
  const cs = (await env.DB.prepare("SELECT id, nume, telefon, email, inscriere_id FROM contacte").all()).results || [];
  const have = new Set(((await env.DB.prepare("SELECT a, b FROM posibile_duplicate").all()).results || []).map((r) => r.a + "-" + r.b));
  const toks = cs.map((c) => normName(c.nume));
  const add = [];
  for (let i = 0; i < cs.length; i++) {
    for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      let motiv = "";
      if (a.telefon && a.telefon === b.telefon) motiv = "Același telefon, două înscrieri";
      else if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) motiv = "Același email, telefoane diferite";
      else if (toks[i].length && toks[j].length) {
        const [s, l] = toks[i].length <= toks[j].length ? [toks[i], toks[j]] : [toks[j], toks[i]];
        if (s.every((t) => l.includes(t))) motiv = "Nume asemănător, telefoane diferite";
      }
      if (motiv) {
        const k = Math.min(a.id, b.id) + "-" + Math.max(a.id, b.id);
        if (!have.has(k)) { have.add(k); add.push([Math.min(a.id, b.id), Math.max(a.id, b.id), motiv]); }
      }
    }
  }
  for (const [x, y, m] of add) await env.DB.prepare("INSERT OR IGNORE INTO posibile_duplicate (a,b,motiv) VALUES (?,?,?)").bind(x, y, m).run();
}

// ---------- citire ----------
const LIST_SQL = `SELECT c.id, c.nume, c.telefon, c.alt_telefon, c.email, c.inscriere_id, c.contactat, c.contactat_de, c.contactat_la, c.status_apel, c.revenire,
  i.status AS i_status, i.email AS i_email, i.companie, i.intrebare AS i_intrebare, i.invitatie_trimisa, i.primire_confirmata, i.prezent_la,
  (SELECT COUNT(*) FROM call_logs l WHERE l.contact_id=c.id) AS apeluri,
  (SELECT l.intrebare_invitati FROM call_logs l WHERE l.contact_id=c.id AND l.intrebare_invitati<>'' ORDER BY l.id DESC LIMIT 1) AS q_apel,
  (SELECT group_concat(s.sursa, ', ') FROM contact_surse s WHERE s.contact_id=c.id) AS surse
  FROM contacte c LEFT JOIN inscrieri i ON i.id=c.inscriere_id ORDER BY c.nume IS NULL, lower(c.nume), c.telefon`;

function shape(r) {
  const inscris = !!r.inscriere_id && (r.i_status === "confirmat" || r.i_status === "asteptare");
  const inv = r.invitatie_trimisa || "";
  return {
    id: r.id, nume: r.nume || "", telefon: r.telefon || "", alt: r.alt_telefon || "", email: r.email || r.i_email || "", companie: r.companie || "",
    inscris, asteptare: r.i_status === "asteptare", prezent: !!r.prezent_la,
    trimisa: inscris && !!inv && !/^(exclus|eroare)/.test(inv), eroare: /^eroare/.test(inv), confirmat: inscris && !!r.primire_confirmata,
    intrebare: r.i_intrebare || "", intrebare_apel: r.q_apel || "", surse: r.surse || "", apeluri: r.apeluri || 0,
    contactat: !!r.contactat, contactat_de: r.contactat_de || "", contactat_la: dataRo(r.contactat_la), status_apel: r.status_apel || "", revenire: r.revenire || "",
  };
}

async function listContacts(env, h) {
  await syncContacts(env);
  await detectDuplicates(env);
  const rows = (await env.DB.prepare(LIST_SQL).all()).results || [];
  const dup = await env.DB.prepare("SELECT COUNT(*) AS n FROM posibile_duplicate WHERE status='nou'").first();
  return h.json({
    contacte: rows.map(shape), duplicate: (dup && dup.n) || 0,
    colegi: await listSetting(env, "colegi", []), surse: await listSetting(env, "surse_contact", SURSE_IMPLICIT),
    termen_depasit: Date.now() > DEADLINE,
  });
}

async function contactDetail(env, h, id) {
  const r = await env.DB.prepare(LIST_SQL.replace("ORDER BY c.nume IS NULL, lower(c.nume), c.telefon", "") + " WHERE c.id=?").bind(id).first();
  if (!r) return h.json({ error: "Contact negăsit" }, 404);
  const calls = (await env.DB.prepare("SELECT * FROM call_logs WHERE contact_id=? ORDER BY id DESC").bind(id).all()).results || [];
  return h.json({ contact: shape(r), calls: calls.map((x) => ({ ...x, creat: dataRo(x.creat) })) });
}

async function duplicatesList(env, h) {
  const rows = (await env.DB.prepare(
    "SELECT d.id, d.motiv, a.id AS aid, a.nume AS anume, a.telefon AS atel, a.inscriere_id AS ains, (SELECT group_concat(sursa, ', ') FROM contact_surse WHERE contact_id=a.id) AS asurse, b.id AS bid, b.nume AS bnume, b.telefon AS btel, b.inscriere_id AS bins, (SELECT group_concat(sursa, ', ') FROM contact_surse WHERE contact_id=b.id) AS bsurse FROM posibile_duplicate d JOIN contacte a ON a.id=d.a JOIN contacte b ON b.id=d.b WHERE d.status='nou' ORDER BY d.id"
  ).all()).results || [];
  return h.json({ duplicate: rows.map((r) => ({ id: r.id, motiv: r.motiv, a: { id: r.aid, nume: r.anume || "", telefon: r.atel || "", inscris: !!r.ains, surse: r.asurse || "" }, b: { id: r.bid, nume: r.bnume || "", telefon: r.btel || "", inscris: !!r.bins, surse: r.bsurse || "" } })) });
}

// ---------- scriere ----------
async function setContacted(env, h, s, b) {
  const id = Number(b.id) || 0;
  const on = b.contactat === true;
  const r = on
    ? await env.DB.prepare("UPDATE contacte SET contactat=1, contactat_de=?, contactat_la=datetime('now') WHERE id=?").bind(s.who, id).run()
    : await env.DB.prepare("UPDATE contacte SET contactat=0, contactat_de=NULL, contactat_la=NULL WHERE id=?").bind(id).run();
  if (!r.meta || r.meta.changes === 0) return h.json({ ok: false, error: "Contact negăsit" }, 404);
  return h.json({ ok: true });
}

async function resolveDuplicate(env, h, b) {
  const d = await env.DB.prepare("SELECT * FROM posibile_duplicate WHERE id=? AND status='nou'").bind(Number(b.id) || 0).first();
  if (!d) return h.json({ ok: false, error: "Pereche negăsită" }, 404);
  if (b.actiune === "diferiti") {
    await env.DB.prepare("UPDATE posibile_duplicate SET status='diferiti' WHERE id=?").bind(d.id).run();
    return h.json({ ok: true });
  }
  if (b.actiune !== "unire") return h.json({ ok: false, error: "Acțiune necunoscută" }, 400);
  const A = await env.DB.prepare("SELECT * FROM contacte WHERE id=?").bind(d.a).first();
  const B = await env.DB.prepare("SELECT * FROM contacte WHERE id=?").bind(d.b).first();
  if (!A || !B) return h.json({ ok: false, error: "Contact negăsit" }, 404);
  if (A.inscriere_id && B.inscriere_id) return h.json({ ok: false, error: "Ambele sunt înscrise separat. Unirea a două înscrieri se face manual." }, 409);
  const keep = A.inscriere_id ? A : (B.inscriere_id ? B : A);
  const drop = keep.id === A.id ? B : A;
  await mergeContacts(env, keep, drop, d.id);
  return h.json({ ok: true, pastrat: keep.id });
}

const err = (h, msg, extra = {}) => h.json({ ok: false, error: msg, ...extra }, 400);

async function saveCall(env, h, s, b) {
  const g = (k, m) => noFormula(clean(b[k], m));
  const t = (k, m) => longText(b[k], m);
  const apelant = g("apelant", 60);
  const numeSunat = g("nume_sunat", 120);
  const raspuns = clean(b.raspuns, 20);
  if (!apelant) return err(h, "Alege cine a sunat.");
  if (!numeSunat) return err(h, "Completează numele persoanei sunate.");
  if (!RASPUNS.includes(raspuns)) return err(h, "Alege dacă ați reușit să vorbiți.");
  const da = raspuns === "da";
  const statusFinal = clean(b.status_final, 20);
  if (!STATUS_FINAL.includes(statusFinal)) return err(h, "Alege statusul final al discuției.");
  if (!da && statusFinal === "confirmat") return err(h, "„Confirmat” se poate alege doar dacă ați reușit să vorbiți cu persoana.");

  await ensure(env);
  // Contactul: existent (id) sau nou (nume, telefon, sursă), cu verificare după telefon normalizat.
  let contact = null;
  let nou = false;
  const telefon = normPhone(b.telefon);
  if (Number(b.contact_id)) {
    contact = await env.DB.prepare("SELECT * FROM contacte WHERE id=?").bind(Number(b.contact_id)).first();
    if (!contact) return h.json({ ok: false, error: "Contact negăsit" }, 404);
  } else {
    if (!phoneOk(telefon)) return err(h, "Numărul de telefon nu este valid.");
    const sursa = g("sursa", 60);
    if (!sursa) return err(h, "Alege sursa contactului.");
    contact = await env.DB.prepare("SELECT * FROM contacte WHERE telefon=?").bind(telefon).first();
    if (!contact) {
      const res = await env.DB.prepare("INSERT INTO contacte (nume, telefon) VALUES (?,?)").bind(numeSunat, telefon).run();
      await env.DB.prepare("INSERT OR IGNORE INTO contact_surse (contact_id, sursa) VALUES (?,?)").bind(res.meta.last_row_id, sursa).run();
      contact = await env.DB.prepare("SELECT * FROM contacte WHERE id=?").bind(res.meta.last_row_id).first();
      nou = true;
    }
  }
  const sursaFolosita = (await env.DB.prepare("SELECT group_concat(sursa, ', ') AS s FROM contact_surse WHERE contact_id=?").bind(contact.id).first()).s || "";
  const email = clean(b.email, 160).toLowerCase();
  const emailOk = EMAIL_RE.test(email);
  if (email && !emailOk) return err(h, "Adresa de email nu este validă.");
  const acordDate = b.acord_date === true, acordViitor = b.acord_viitor === true, acordBcr = b.acord_bcr === true;

  // Înscriere prin telefon: doar pentru contact neînscris, cu status „Confirmat”.
  let rezultat = "";
  let inscriereId = contact.inscriere_id || null;
  let warning = "";
  if (da && statusFinal === "confirmat" && !inscriereId) {
    if (!emailOk) return err(h, "Pentru înscriere este nevoie de o adresă de email validă.");
    if (!acordDate) return err(h, "Pentru înscriere este obligatoriu acordul verbal pentru prelucrarea datelor.");
    if (!phoneOk(contact.telefon || telefon)) return err(h, "Numărul de telefon nu este valid.");
    if (Date.now() > DEADLINE && b.depasit_termen !== true) {
      return h.json({ ok: false, needsConfirm: true, error: "Termenul de înscriere (24 noiembrie, 23:59) a trecut. Adaugi totuși persoana?" }, 409);
    }
    const reg = await registerPerson(env, {
      nume: numeSunat, email, telefon: contact.telefon || telefon, companie: "", functie: "", profil: "",
      intrebare: noFormula(t("intrebare_invitati", 1500)), sursa: "Telefon (" + apelant + ")",
    }, { limba: "ro", acord_marketing: acordViitor ? 1 : 0, acord_bcr: acordBcr ? 1 : 0, tara: "RO" });
    if (reg.inserted) {
      inscriereId = reg.id;
      await env.DB.prepare("UPDATE contacte SET inscriere_id=?, email=?, nume=COALESCE(NULLIF(nume,''),?) WHERE id=?").bind(reg.id, email, numeSunat, contact.id).run();
      await env.DB.prepare("INSERT OR IGNORE INTO contact_surse (contact_id, sursa) VALUES (?, 'Telefon')").bind(contact.id).run();
      rezultat = reg.status === "asteptare" ? "inscris_asteptare" : "inscris_confirmat";
    } else {
      // Emailul există deja la altă înscriere: datele se contrazic, deci nu se unește nimic automat.
      const other = reg.existingId ? await env.DB.prepare("SELECT id FROM contacte WHERE inscriere_id=?").bind(reg.existingId).first() : null;
      if (other && other.id !== contact.id) {
        await env.DB.prepare("INSERT OR IGNORE INTO posibile_duplicate (a,b,motiv) VALUES (?,?,?)").bind(Math.min(contact.id, other.id), Math.max(contact.id, other.id), "Același email, telefoane diferite").run();
      }
      rezultat = "email_existent";
      warning = "Adresa de email este deja înscrisă la o altă persoană. Nu am creat o a doua înscriere; perechea a fost trecută în posibilele duplicate.";
    }
  }

  const era = clean(b.era_inscris, 10);
  await env.DB.prepare(
    "INSERT INTO call_logs (contact_id, inscriere_id, apelant, nume_sunat, telefon, email, sursa, raspuns, revenire_la, era_inscris, ocupatie, provocare, sfat, interes, ia_acasa, oameni, intrebare_invitati, ramane_activ, status_final, vip, revine_la, motiv, acord_date, acord_viitor, acord_bcr, invitatie_trimisa, observatii, rezultat_inscriere) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).bind(contact.id, inscriereId, apelant, numeSunat, contact.telefon || telefon, email, sursaFolosita, raspuns, clean(b.revenire_la, 20),
    ["da", "nu", "nu_stie"].includes(era) ? era : "",
    da ? g("ocupatie", 200) : "", da ? noFormula(t("provocare", 1500)) : "", da ? noFormula(t("sfat", 1500)) : "", da ? noFormula(t("interes", 1500)) : "",
    da ? g("ia_acasa", 300) : "", da ? g("oameni", 300) : "", da ? noFormula(t("intrebare_invitati", 1500)) : "", da ? noFormula(t("ramane_activ", 1500)) : "",
    statusFinal, TRI.includes(clean(b.vip, 10)) ? clean(b.vip, 10) : "", clean(b.revine_la, 20), g("motiv", 300),
    acordDate ? 1 : 0, acordViitor ? 1 : 0, acordBcr ? 1 : 0, ["da", "nu"].includes(clean(b.invitatie_trimisa, 5)) ? clean(b.invitatie_trimisa, 5) : "",
    noFormula(t("observatii", 2000)), rezultat).run();

  // Starea contactului: „contactat” se bifează când s-a vorbit; reveniri apar în listă după dată.
  let revenire = null;
  if (raspuns === "mai_tarziu") revenire = clean(b.revenire_la, 20) || null;
  if (statusFinal === "revine") revenire = clean(b.revine_la, 20) || revenire;
  const statusApel = da ? statusFinal : (raspuns === "nu" ? "nu_a_raspuns" : "mai_tarziu");
  if (da) {
    await env.DB.prepare("UPDATE contacte SET contactat=1, contactat_de=?, contactat_la=datetime('now'), status_apel=?, revenire=?, email=COALESCE(NULLIF(email,''),?) WHERE id=?")
      .bind(apelant, statusApel, revenire, email || null, contact.id).run();
  } else {
    await env.DB.prepare("UPDATE contacte SET status_apel=?, revenire=? WHERE id=?").bind(statusApel, revenire, contact.id).run();
  }
  return h.json({ ok: true, nou, rezultat, warning, contact_id: contact.id });
}

// ---------- rutare ----------
export function apeluriPage(h, s) {
  return h.html(h.shell("Apeluri Beyond the Initiative", `<p class="k">Panoul echipei</p><h1>Apeluri</h1>
<div id="ap" data-who="${h.esc(s.who)}"><div class="card"><p class="muted">Se încarcă...</p></div></div>
<a class="btn b-ghost mt" href="/checkin">Înapoi la check-in</a>`, `<script src="/assets/js/apeluri.js"></script>`));
}

// h = { json, html, shell, esc, sameOrigin } din checkin.js; s = sesiunea echipei ({ who })
export async function handleApeluri(request, env, url, s, h) {
  const p = url.pathname;
  if (p === "/checkin/apeluri" || p === "/checkin/apeluri/") return apeluriPage(h, s);
  if (!p.startsWith("/api/echipa/")) return null;
  const post = request.method === "POST";
  if (post && !h.sameOrigin(request)) return h.json({ error: "Forbidden" }, 403);
  await ensure(env);
  if (p === "/api/echipa/contacte") return listContacts(env, h);
  if (p === "/api/echipa/contact") return contactDetail(env, h, Number(url.searchParams.get("id")) || 0);
  if (p === "/api/echipa/duplicate") return duplicatesList(env, h);
  if (p === "/api/echipa/contactat" && post) return setContacted(env, h, s, await request.json().catch(() => ({})));
  if (p === "/api/echipa/duplicat" && post) return resolveDuplicate(env, h, await request.json().catch(() => ({})));
  if (p === "/api/echipa/apel" && post) return saveCall(env, h, s, await request.json().catch(() => ({})));
  return null;
}
