// Test de interfață: cere jsdom (în afara depozitului: mkdir /tmp/uitest && cd /tmp/uitest && npm i jsdom). Rulare: node --no-warnings src/tests/apeluri-ui.test.mjs
import { JSDOM } from "jsdom";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import assert from "node:assert/strict";
const R = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const { handleCheckin } = await import(R + "/worker/checkin.js");

function makeD1() {
  const db = new DatabaseSync(":memory:");
  const mk = (sql, params = []) => ({ bind: (...p) => mk(sql, p),
    first: async () => { const r = db.prepare(sql).get(...params); return r ? { ...r } : null; },
    all: async () => ({ results: db.prepare(sql).all(...params).map((r) => ({ ...r })) }),
    run: async () => { const r = db.prepare(sql).run(...params); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; }, _sql: sql, _params: params });
  return { prepare: (s) => mk(s), batch: async (l) => { for (const x of l) db.prepare(x._sql).run(...x._params); return []; }, _db: db };
}
const DB = makeD1();
DB._db.exec(`CREATE TABLE setari (cheie TEXT PRIMARY KEY, valoare TEXT);
CREATE TABLE rate_log (id INTEGER PRIMARY KEY AUTOINCREMENT, bucket TEXT, ip TEXT, creat TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE inscrieri (id INTEGER PRIMARY KEY AUTOINCREMENT, creat TEXT NOT NULL DEFAULT (datetime('now')), eveniment TEXT NOT NULL DEFAULT 'beyond-2026', nume TEXT NOT NULL, email TEXT NOT NULL, telefon TEXT, companie TEXT, functie TEXT, profil TEXT, intrebare TEXT, sursa TEXT, limba TEXT, acord_marketing INTEGER DEFAULT 0, status TEXT DEFAULT 'confirmat', tara TEXT, token TEXT, prezent_la TEXT, prezent_de TEXT, invitatie_trimisa TEXT, primire_confirmata TEXT, acord_bcr INTEGER DEFAULT 0, bloc INTEGER, slot INTEGER, UNIQUE(eveniment, email));
INSERT INTO inscrieri (nume,email,telefon,status,invitatie_trimisa,primire_confirmata,intrebare) VALUES ('Ana Test','a@example.com','0700000001','confirmat','2026-11-10 10:00:00','2026-11-10 11:00:00','Cum ne dezvoltăm ecosistemul?'),('Bob Test','b@example.com','0700000002','confirmat','2026-11-10 10:00:00',NULL,'');
INSERT INTO setari VALUES ('cookie_secret','sec');`);
const env = { DB };
// cookie de sesiune valid
const enc = new TextEncoder();
const key = await crypto.subtle.importKey("raw", enc.encode("sec"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
const exp = String(Date.now() + 3600e3), who = encodeURIComponent("Colega");
const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(exp + "." + who)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const cookie = "jci_echipa=" + encodeURIComponent(exp + "." + who + "." + sig);

async function route(path, init = {}, authed = true) {
  const url = new URL("https://jci-brasov.com" + path);
  const headers = { ...(init.headers || {}) }; if (authed) headers.Cookie = cookie;
  const req = new Request(url, { ...init, headers });
  return handleCheckin(req, env, url, async () => false);
}
// 1. fără sesiune: pagina duce la autentificare, API-ul dă 401
let r = await route("/checkin/apeluri", {}, false); assert.equal(r.status, 302);
r = await route("/api/echipa/contacte", {}, false); assert.equal(r.status, 401);
// 2. cu sesiune: pagina
r = await route("/checkin/apeluri"); assert.equal(r.status, 200);
const page = await r.text();
assert.match(page, /apeluri\.js/); assert.ok(!/<script>/.test(page), "fără script inline (CSP)");
assert.match(r.headers.get("Content-Security-Policy"), /script-src 'self'/);
// dashboard are linkul
r = await route("/checkin"); assert.match(await r.text(), /\/checkin\/apeluri/);

// contacte din afara site-ului
await route("/api/echipa/contacte");
DB._db.exec(`INSERT INTO contacte (nume, telefon) VALUES ('Cineva WhatsApp','+40700000050'),(NULL,'+40700000051');
INSERT INTO contact_surse (contact_id, sursa) SELECT id,'WhatsApp' FROM contacte WHERE inscriere_id IS NULL;`);

// 3. interfața
const dom = new JSDOM(page, { url: "https://jci-brasov.com/checkin/apeluri", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
w.fetch = async (path, o = {}) => {
  const res = await route(path, { method: o.method || "GET", body: o.body, headers: o.headers });
  return { status: res.status, json: () => res.json() };
};
w.confirm = () => true; w.scrollTo = () => {}; w.alert = (m) => { throw new Error("alert: " + m); };
w.eval(fs.readFileSync(R + "/public/assets/js/apeluri.js", "utf8"));
const wait = (ms = 80) => new Promise((ok) => setTimeout(ok, ms));
await wait();
const doc = w.document;
const cards = () => doc.querySelectorAll("#ap .card.mt b").length;
assert.equal(doc.querySelectorAll("#ap .tags").length, 4, "4 contacte afișate");
const txt = () => doc.getElementById("ap").textContent;
assert.match(txt(), /Cum ne dezvoltăm ecosistemul/, "întrebarea pentru invitați apare");
assert.match(txt(), /Gmail confirmat de el/); assert.match(txt(), /Gmail neconfirmat/);
assert.match(txt(), /Fără email, fără invitație/);
assert.ok(doc.querySelector('a[href="tel:+40700000001"]') && doc.querySelector('a[href^="https://wa.me/40700000001"]'), "butoane Sună și WhatsApp");
// filtre
const chip = (f) => doc.querySelector('[data-f="' + f + '"]');
chip("neconfirmat").click(); assert.equal(doc.querySelectorAll("#ap .tags").length, 1);
chip("intrebare").click(); assert.equal(doc.querySelectorAll("#ap .tags").length, 1);
chip("neinscrisi").click(); assert.equal(doc.querySelectorAll("#ap .tags").length, 2);
chip("toti").click();
// bifa Contactat
const cb = doc.querySelector('input[data-cont]'); cb.checked = true; cb.dispatchEvent(new w.Event("change", { bubbles: true }));
await wait();
assert.equal(DB._db.prepare("SELECT COUNT(*) n FROM contacte WHERE contactat=1").get().n, 1);
assert.match(txt(), /Contactat \(Colega/);
// chestionar pentru un contact neînscris
const neins = [...doc.querySelectorAll("button[data-form]")].find((b) => b.closest(".card").textContent.includes("Cineva WhatsApp"));
neins.click(); await wait();
const g = (id) => doc.getElementById(id);
assert.equal(g("f_apelant").value, "Colega"); assert.equal(g("f_nume").value, "Cineva WhatsApp");
assert.equal(g("sec2").hidden, false, "toate întrebările sunt vizibile de la început");
assert.ok(g("f_rev") && g("f_revine") && g("f_motiv") && g("f_ocupatie") && g("f_activ") && g("f_obs"), "întrebările 5, 7-14, 17, 18, 20 există");
assert.ok(g("f_status"), "statusul final e mereu vizibil (obligatoriu)");
g("f_raspuns").value = "da"; g("f_raspuns").dispatchEvent(new w.Event("change", { bubbles: true }));
assert.equal(g("sec2").hidden, false);
// salvare fără status: eroare afișată
g("f_save").click(); await wait();
assert.match(g("ferr").textContent, /statusul final/i);
g("f_status").value = "confirmat"; g("f_status").dispatchEvent(new w.Event("change", { bubbles: true }));
assert.equal(g("g_conf").hidden, false, "email și acord apar la Confirmat");
g("f_intrebare").value = "Cum găsim clienți?";
g("f_save").click(); await wait();
assert.match(g("ferr").textContent, /email/i);
g("f_email").value = "cineva@example.com"; g("f_save").click(); await wait();
assert.match(g("ferr").textContent, /acord/i);
g("f_acord").checked = true; g("f_save").click(); await wait(150);
assert.match(txt(), /Persoana a fost înscrisă/, "mesaj de reușită");
const reg = DB._db.prepare("SELECT nume, sursa, intrebare, status FROM inscrieri WHERE email='cineva@example.com'").get();
assert.deepEqual({ ...reg }, { nume: "Cineva WhatsApp", sursa: "Telefon (Colega)", intrebare: "Cum găsim clienți?", status: "confirmat" });
assert.match(txt(), /Cum găsim clienți\?/, "întrebarea din apel apare pe card");
// contact nou
doc.querySelector("[data-new]").click(); await wait();
g("f_nume").value = "Persoană Nouă"; g("f_tel").value = "0700 000 077"; g("f_sursa").value = "Partener";
g("f_raspuns").value = "nu"; g("f_status").value = "revine"; g("f_save").click(); await wait(150);
assert.equal(DB._db.prepare("SELECT telefon FROM contacte WHERE nume='Persoană Nouă'").get().telefon, "+40700000077");
console.log("UI: toate verificările au trecut");
