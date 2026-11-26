// Participanți fără invitație, adăugați din stația de printare: test cu bază SQLite în memorie (node >= 22).
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
import { _test } from "../../worker/checkin.js";
const db = new DatabaseSync(":memory:");
db.exec(`CREATE TABLE inscrieri (id INTEGER PRIMARY KEY, creat TEXT DEFAULT (datetime('now')), eveniment TEXT, token TEXT, nume TEXT, telefon TEXT, companie TEXT, functie TEXT, profil TEXT, intrebare TEXT, limba TEXT, acord_marketing INTEGER, acord_bcr INTEGER, invitatie_trimisa TEXT, domeniu TEXT, tinte TEXT, sursa TEXT, email TEXT, status TEXT, prezent_la TEXT, prezent_de TEXT, bloc INTEGER, slot INTEGER, UNIQUE(eveniment,email));
CREATE TABLE checkin_log (id INTEGER PRIMARY KEY, inscriere_id INTEGER, actiune TEXT, de TEXT);
CREATE TABLE setari (cheie TEXT PRIMARY KEY, valoare TEXT);`);
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  first: async () => db.prepare(sql).get(...args) ?? null,
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
});
const env = { DB: { prepare: (sql) => stmt(sql), batch: async (l) => { for (const x of l) await x.run(); } } };
const S = { who: "Test" };
const call = async (b) => (await _test.walkIn(new Request("https://jci-brasov.com/api/echipa/walkin", { method: "POST", body: JSON.stringify(b) }), env, S)).json();
// câmpuri lipsă
let d = await call({ nume: "A", telefon: "12", domeniu: "" });
assert.equal(d.ok, false); assert.deepEqual(d.lipsa, ["nume", "telefon", "domeniu"]);
// persoană nouă
d = await call({ nume: "Maria  Ionescu", telefon: "0722 111 222", domeniu: "it", companie: "Firma SRL" });
assert.equal(d.ok, true); assert.equal(d.existent, false); assert.ok(d.loc, "are loc în bloc");
let r = db.prepare("SELECT * FROM inscrieri WHERE nume='Maria Ionescu'").get();
assert.equal(r.status, "confirmat"); assert.ok(r.prezent_la); assert.ok(r.bloc); assert.equal(r.ecuson_la, null);
assert.match(r.sursa, /^Fără invitație/); assert.equal(r.domeniu, "it"); assert.equal(r.token.length, 32);
// ecusonul iese din coadă
const next = async () => (await _test.printApi(new Request("https://jci-brasov.com/x", { method: "POST", body: "{}" }), env, "/api/echipa/print-next")).json();
let j = await next(); assert.equal(j.job.nume, "Maria Ionescu"); assert.equal(j.job.companie, "Firma SRL");
// același telefon, alt format: nu se dublează, se retipărește
d = await call({ nume: "Maria Ionescu", telefon: "+40722111222", domeniu: "it" });
assert.equal(d.ok, true); assert.equal(d.existent, true); assert.equal(d.already, true);
assert.equal(db.prepare("SELECT COUNT(*) n FROM inscrieri").get().n, 1);
j = await next(); assert.equal(j.job.nume, "Maria Ionescu");
// înscris dinainte, neintrat: check-in pe înscrierea existentă
db.prepare("INSERT INTO inscrieri (eveniment,token,nume,telefon,email,status,sursa) VALUES ('beyond-2026','" + "a".repeat(32) + "','Dan Pop','+40733000111','dan@x.ro','confirmat','Facebook')").run();
d = await call({ nume: "Dan Pop", telefon: "0733000111", domeniu: "financiar" });
assert.equal(d.existent, true); assert.equal(d.already, false); assert.ok(d.loc);
assert.equal(db.prepare("SELECT COUNT(*) n FROM inscrieri").get().n, 2);
assert.equal(db.prepare("SELECT sursa FROM inscrieri WHERE nume='Dan Pop'").get().sursa, "Facebook");
console.log("walkin: ok");
