// Teste pentru potrivirea pe domenii la Blitz Networking. Rulare: node --no-warnings src/tests/blitz.test.mjs
// Bază SQLite în memorie, cu date inventate.
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DOMENII, DOM_CODES, parseTinte, domClean } from "../../worker/domenii.js";
import { preallocVip, blockScore, domainCandidates, suggestK, pairScore } from "../../worker/blitz-match.js";
import { assignBlitz, preallocRun } from "../../worker/checkin.js";
import { registerPerson } from "../../worker/inscriere-core.js";

const root = new URL("../../", import.meta.url).pathname;
// 1) aceeași listă de domenii peste tot
const apel = fs.readFileSync(root + "public/assets/js/apeluri.js", "utf8");
const py = fs.readFileSync(root + "src/domenii.py", "utf8");
for (const [c, ro, en] of DOMENII) {
  assert.ok(apel.includes(`["${c}", "${ro}"]`), "apeluri.js are " + c);
  assert.ok(py.includes(`('${c}', '${ro}', '${en}')`), "domenii.py are " + c);
}
for (const f of ["public/eveniment.html", "public/en/eveniment.html", "public/vip-confirmat.html", "public/en/vip-confirmat.html"]) {
  const h = fs.readFileSync(root + f, "utf8");
  for (const c of DOM_CODES) assert.ok(h.includes(`value="${c}"`), f + " are " + c);
  assert.ok(!h.includes("·"), f + " fără punct de mijloc");
}
assert.equal(DOM_CODES.length, 14);

// 2) funcții pure
assert.deepEqual(parseTinte("it, marketing,it,alt,xx,horeca,ong"), ["it", "marketing", "horeca"]);
assert.equal(domClean(" IT "), "it"); assert.equal(domClean("nimic"), "");
const A = { id: 1, dom: "it", tinte: ["horeca"] }, B = { id: 2, dom: "horeca", tinte: ["it"] }, C = { id: 3, dom: "ong", tinte: ["juridic"] }, D = { id: 4, dom: "juridic", tinte: [] };
assert.equal(pairScore(A, B), 2); assert.equal(pairScore(C, D), 1); assert.equal(pairScore(A, C), 0);
const m = preallocVip([A, C, B, D], 2);
assert.equal(m.get(1), m.get(2), "cei care se caută reciproc ajung în același bloc");
assert.equal(m.get(3), m.get(4), "C îl caută pe D");
assert.notEqual(m.get(1), m.get(3), "blocuri echilibrate, câte 2");
// mărimi egale
const many = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, dom: DOM_CODES[i % 13], tinte: [DOM_CODES[(i * 5 + 3) % 13], DOM_CODES[(i * 7 + 1) % 13]] }));
for (const K of [3, 4, 5, 6]) {
  const mm = preallocVip(many, K); const cnt = Array(K).fill(0);
  for (const b of mm.values()) cnt[b - 1]++;
  assert.equal(mm.size, 40); assert.ok(Math.max(...cnt) - Math.min(...cnt) <= 2, "blocuri VIP aproape egale la K=" + K + ": " + cnt);
}
// VIP deja așezați rămân pe loc
const fx = preallocVip([B, C, D], 2, [{ id: 1, bloc: 2, dom: "it", tinte: ["horeca"] }]);
assert.equal(fx.get(2), 2, "B merge lângă A, care are deja loc"); assert.ok(!fx.has(1)); assert.equal(fx.get(3), 1); assert.equal(fx.get(4), 1);
// scor: primul om dintr-un domeniu cerut valorează mai mult decât al doilea
assert.equal(blockScore({ dom: "it", tinte: [] }, [{ dom: "horeca", tinte: ["it"] }]), 1);
assert.equal(blockScore({ dom: "it", tinte: [] }, [{ dom: "horeca", tinte: ["it"] }, { dom: "it", tinte: [] }]), 0.5);
assert.equal(blockScore({ dom: "alt", tinte: [] }, [{ dom: "x", tinte: ["alt"] }]), 0, "„alt” nu intră în potrivire");
const sizes = { 1: 5, 2: 5, 3: 9 }, mem = { 1: [], 2: [{ dom: "ong", tinte: ["it"] }], 3: [{ dom: "ong", tinte: ["it"] }, { dom: "ong", tinte: ["it"] }] };
assert.deepEqual(domainCandidates([1, 2, 3], (b) => sizes[b], (b) => mem[b], { dom: "it", tinte: [] }), [2], "blocul 3 e prea plin față de celelalte");
assert.deepEqual(domainCandidates([1, 2, 3], (b) => sizes[b], (b) => mem[b], { dom: "", tinte: [] }), [], "fără domeniu: regula veche");
assert.equal(suggestK(150, 40), 4); assert.equal(suggestK(37, 5), 1); assert.equal(suggestK(60, 40), 4, "cel mult 12 VIP pe bloc");

// 3) integrare cu baza de date
function makeD1() {
  const db = new DatabaseSync(":memory:");
  const mk = (sql, params = []) => ({
    bind: (...p) => mk(sql, p),
    first: async () => { const r = db.prepare(sql).get(...params); return r ? { ...r } : null; },
    all: async () => ({ results: db.prepare(sql).all(...params).map((r) => ({ ...r })) }),
    run: async () => { const r = db.prepare(sql).run(...params); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
  });
  return { prepare: (s) => mk(s), _db: db };
}
const DB = makeD1();
DB._db.exec(`CREATE TABLE setari (cheie TEXT PRIMARY KEY, valoare TEXT);
CREATE TABLE inscrieri (id INTEGER PRIMARY KEY AUTOINCREMENT, creat TEXT NOT NULL DEFAULT (datetime('now')), eveniment TEXT NOT NULL DEFAULT 'beyond-2026', nume TEXT NOT NULL, email TEXT NOT NULL, telefon TEXT, companie TEXT, functie TEXT, profil TEXT, intrebare TEXT, sursa TEXT, limba TEXT, acord_marketing INTEGER, acord_bcr INTEGER, status TEXT, tara TEXT, token TEXT, prezent_la TEXT, prezent_de TEXT, UNIQUE(eveniment, email));
CREATE TABLE vip (id INTEGER PRIMARY KEY AUTOINCREMENT, sesiune TEXT UNIQUE, eveniment TEXT, nume TEXT, email TEXT, telefon TEXT, suma REAL, moneda TEXT, creat TEXT DEFAULT (datetime('now')));`);
const env = { DB };
const add = async (nume, o = {}) => {
  const r = await registerPerson(env, { nume, email: nume.toLowerCase().replace(/\s/g, "") + "@example.com", telefon: "0700000000", sursa: o.sursa || "Instagram", domeniu: o.dom, tinte: o.tinte }, { limba: "ro" });
  return r.id;
};
const bloc = (id) => DB._db.prepare("SELECT bloc FROM inscrieri WHERE id=?").get(id).bloc;
const scan = async (id) => { DB._db.prepare("UPDATE inscrieri SET prezent_la=datetime('now','-1 hour') WHERE id=?").run(id); return assignBlitz(env, id); };

// 9 VIP: trei plătiți prin Stripe (sursa), unul prin tabelul vip, restul invitați VIP cu domenii țintă completate la apel
const v1 = await add("Vip Unu", { sursa: "Bilet VIP (Stripe)", dom: "it", tinte: ["transport"] });
const v2 = await add("Vip Doi", { sursa: "Bilet VIP (Stripe)", dom: "horeca", tinte: ["juridic", "marketing"] });
const v3 = await add("Vip Trei", { sursa: "Bilet VIP (Stripe)", dom: "ong", tinte: ["sanatate"] });
const v4 = await add("Vip Patru", { dom: "financiar" });
DB._db.prepare("INSERT INTO vip (sesiune, eveniment, email) VALUES ('s1','beyond-2026','vippatru@example.com')").run();
// formularul de după plată a fost trimis de Vip Patru și de cineva fără bilet VIP
await DB.prepare("INSERT INTO vip_domenii (email, domeniu, tinte) VALUES ('vippatru@example.com','financiar','imobiliare'),('liber@example.com','it','ong,horeca')").run();
const liber = await add("Liber", {});
const vs = [];
for (let i = 0; i < 5; i++) vs.push(await add("Invitat " + i, { dom: "educatie", tinte: ["comert"] }));
const r = await preallocRun(env, { k: 3 });
assert.equal(r.total, 9, "9 VIP identificați"); assert.equal(r.placed, 9); assert.equal(r.k, 3);
assert.equal(DB._db.prepare("SELECT tinte FROM inscrieri WHERE id=?").get(v4).tinte, "imobiliare", "răspunsul din formular ajunge pe înscrierea VIP");
assert.equal(DB._db.prepare("SELECT tinte FROM inscrieri WHERE id=?").get(liber).tinte, null, "fără bilet VIP, formularul nu dă loc rezervat");
const perB = DB._db.prepare("SELECT bloc, COUNT(*) AS n FROM inscrieri WHERE bloc IS NOT NULL GROUP BY bloc").all();
assert.deepEqual(perB.map((x) => Number(x.n)), [3, 3, 3], "câte 3 VIP în fiecare dintre cele 3 blocuri");
// VIP-ul care intră își primește locul rezervat
const b1 = bloc(v1);
const info = await scan(v1);
assert.equal(info.bloc, "ABC"[b1 - 1]);
// un om din transport ajunge în blocul lui Vip Unu, un jurist în blocul lui Vip Doi
const t1 = await add("Transportator", { dom: "transport" }); await scan(t1);
assert.equal(bloc(t1), bloc(v1), "transport lângă VIP-ul care l-a cerut");
const j1 = await add("Jurist", { dom: "juridic" }); await scan(j1);
assert.equal(bloc(j1), bloc(v2));
const im = await add("Agent imobiliar", { dom: "imobiliare" }); await scan(im);
assert.equal(bloc(im), bloc(v4), "și VIP-ul din tabelul vip e servit");
// fără domeniu: blocul cel mai liber din val
const n1 = await add("Fara Domeniu", {}); await scan(n1);
assert.ok(bloc(n1) >= 1 && bloc(n1) <= 3);
// echilibru: mulți din același domeniu cerut nu se înghesuie într-un singur bloc
const ids = [];
for (let i = 0; i < 30; i++) { const id = await add("Comert " + i, { dom: "comert" }); await scan(id); ids.push(id); }
const sz = DB._db.prepare("SELECT bloc, COUNT(*) AS n FROM inscrieri WHERE bloc IS NOT NULL GROUP BY bloc ORDER BY bloc").all().map((x) => Number(x.n));
assert.ok(Math.max(...sz.slice(0, 3)) - Math.min(...sz.slice(0, 3)) <= 4, "blocurile rămân echilibrate: " + sz);
assert.ok(sz.every((n) => n <= 25), "niciun bloc peste 25");
// locuri unice
const dup = DB._db.prepare("SELECT COUNT(*) AS n FROM (SELECT bloc, slot FROM inscrieri WHERE bloc IS NOT NULL GROUP BY bloc, slot HAVING COUNT(*) > 1)").get().n;
assert.equal(Number(dup), 0);
// refacerea împărțirii nu mută pe nimeni dintre cei intrați
const before = bloc(v1);
await preallocRun(env, { k: 2, reset: true });
assert.equal(bloc(v1), before, "cine a intrat își păstrează locul");
assert.ok(bloc(v2) >= 1 && bloc(v2) <= 2 || DB._db.prepare("SELECT prezent_la FROM inscrieri WHERE id=?").get(v2).prezent_la, "VIP-ii neintrați sunt reașezați în cele 2 blocuri");
console.log("blitz: toate testele au trecut");
