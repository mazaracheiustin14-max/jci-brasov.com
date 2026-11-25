// Plecări și mutări la Blitz Networking: test cu bază SQLite în memorie (node >= 22).
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
import { _test } from "../../worker/checkin.js";
const db = new DatabaseSync(":memory:");
db.exec(`CREATE TABLE inscrieri (id INTEGER PRIMARY KEY, eveniment TEXT, token TEXT, nume TEXT, telefon TEXT, companie TEXT, domeniu TEXT, tinte TEXT, sursa TEXT, email TEXT, status TEXT, prezent_la TEXT, prezent_de TEXT, bloc INTEGER, slot INTEGER);
CREATE TABLE checkin_log (id INTEGER PRIMARY KEY, inscriere_id INTEGER, actiune TEXT, de TEXT);`);
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  first: async () => db.prepare(sql).get(...args) ?? null,
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
});
const env = { DB: { prepare: (sql) => stmt(sql) } };
const tok = (i) => i.toString(16).padStart(32, "0");
const ins = db.prepare("INSERT INTO inscrieri (id,eveniment,token,nume,telefon,status,prezent_la,bloc,slot,email,sursa) VALUES (?,?,?,?,?,'confirmat',datetime('now'),1,?,?,'')");
for (let i = 1; i <= 25; i++) ins.run(i, "beyond-2026", tok(i), "Om " + i, "07220000" + String(i).padStart(2, "0"), i - 1, `o${i}@x.ro`);
const S = { who: "Test" };
const J = async (r) => r.json();
let d = await J(await _test.plecariList(env, ""));
assert.equal(d.mici.length, 0); assert.equal(d.activi, 25);
// căutare după telefon și după nume
d = await J(await _test.plecariList(env, "0722000007")); assert.equal(d.rezultate.length, 1); assert.equal(d.rezultate[0].nume, "Om 7");
d = await J(await _test.plecariList(env, "om 12")); assert.equal(d.rezultate[0].nume, "Om 12");
// colegii de masă din runda 1 ai lui Om 1
const m1 = d0 => d0.mese[0];
const all = (await J(await _test.plecariList(env, "om"))).rezultate;
const full = db.prepare("SELECT id, token FROM inscrieri").all();
const meseDe = {};
for (const r of full) { const x = (await J(await _test.plecariList(env, "0722000" + String(r.id).padStart(3, "0")))).rezultate[0]; meseDe[r.id] = x.mese; }
const colegi = full.filter((r) => r.id !== 1 && meseDe[r.id][0] === meseDe[1][0]).map((r) => r.id);
assert.equal(colegi.length, 4);
// pleacă 3 dintre cei 5: rămân Om 1 și un coleg, grupă de 2 la runda 1
for (const id of colegi.slice(0, 3)) await _test.plecareSet(env, tok(id), false, S);
d = await J(await _test.plecariList(env, ""));
assert.equal(d.plecati.length, 3);
assert.ok(d.mici.some((x) => x.nume === "Om 1" && x.runde.includes(1)));
let r = await J(await _test.mutaPersoana(env, tok(1), 1, S));
assert.ok(r.mutat && r.runde.includes(1)); assert.notEqual(r.mese[0], meseDe[1][0]);
// ecusonul lui Om 1 e din nou în coadă, cu mesele noi; cei plecați nu se tipăresc
db.exec("UPDATE inscrieri SET ecuson_la=datetime('now') WHERE id<>1");
const pj = await J(await _test.printApi(new Request("https://x/"), env, "/api/echipa/print-next"));
assert.equal(pj.job.nume, "Om 1"); assert.deepEqual(pj.job.mese, r.mese);
// după mutări, nimeni activ nu mai e în grupă sub 3
for (let pass = 0; pass < 3; pass++) { d = await J(await _test.plecariList(env, "")); for (const x of d.mici) await _test.mutaPersoana(env, x.token, 1, S); }
d = await J(await _test.plecariList(env, "")); assert.equal(d.mici.length, 0, JSON.stringify(d.mici));
// nicio masă peste 6
const cnt = {}; for (const rr of db.prepare("SELECT id FROM inscrieri WHERE plecat_la IS NULL").all()) { const x = (await J(await _test.plecariList(env, "0722000" + String(rr.id).padStart(3, "0")))).rezultate[0]; x.mese.forEach((t, k) => { cnt[k + t] = (cnt[k + t] || 0) + 1; }); }
assert.ok(Math.max(...Object.values(cnt)) <= 6);
// revenire
await _test.plecareSet(env, tok(colegi[0]), true, S);
d = await J(await _test.plecariList(env, "")); assert.equal(d.plecati.length, 2);
console.log("plecari: toate testele au trecut");
