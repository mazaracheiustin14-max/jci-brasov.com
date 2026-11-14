// Teste pentru worker/apeluri.js (panoul de apeluri). Rulare: node --no-warnings src/tests/apeluri.test.mjs
// Folosește o bază SQLite în memorie, cu date inventate. Numere reale de telefon nu se pun în teste.
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
import { handleApeluri, normPhone, chestionarPage, chestionarSave } from "../../worker/apeluri.js";

function makeD1() {
  const db = new DatabaseSync(":memory:");
  const mk = (sql, params = []) => ({
    bind: (...p) => mk(sql, p),
    first: async () => { const r = db.prepare(sql).get(...params); return r ? { ...r } : null; },
    all: async () => ({ results: db.prepare(sql).all(...params).map((r) => ({ ...r })) }),
    run: async () => { const r = db.prepare(sql).run(...params); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
    _sql: sql, _params: params,
  });
  return { prepare: (s) => mk(s), batch: async (l) => { for (const x of l) db.prepare(x._sql).run(...x._params); return []; }, _db: db };
}
const DB = makeD1();
DB._db.exec(`CREATE TABLE setari (cheie TEXT PRIMARY KEY, valoare TEXT);
CREATE TABLE inscrieri (id INTEGER PRIMARY KEY AUTOINCREMENT, creat TEXT NOT NULL DEFAULT (datetime('now')), eveniment TEXT NOT NULL DEFAULT 'beyond-2026', nume TEXT NOT NULL, email TEXT NOT NULL, telefon TEXT, companie TEXT, functie TEXT, profil TEXT, intrebare TEXT, sursa TEXT, limba TEXT, acord_marketing INTEGER DEFAULT 0, status TEXT DEFAULT 'confirmat', tara TEXT, token TEXT, prezent_la TEXT, prezent_de TEXT, invitatie_trimisa TEXT, primire_confirmata TEXT, acord_bcr INTEGER DEFAULT 0, bloc INTEGER, slot INTEGER, UNIQUE(eveniment, email));
INSERT INTO inscrieri (nume,email,telefon,status,invitatie_trimisa,primire_confirmata,intrebare) VALUES
 ('Ana Test Unu','a1@example.com','0700000001','confirmat','2026-11-10 10:00:00','2026-11-10 11:00:00','Ce urmeaza?'),
 ('Bob Test Doi','b2@example.com','+40700000002','confirmat','2026-11-10 10:00:00',NULL,''),
 ('Proba Test','t@example.com','0700000009','test','exclus-test',NULL,''),
 ('Diana Mare','d@example.com','0700000004','confirmat','eroare: x',NULL,'');`);
const env = { DB };
const h = {
  json: (o, st = 200) => new Response(JSON.stringify(o), { status: st }),
  html: (b) => new Response(b), shell: (t, i) => i, esc: (s) => String(s), sameOrigin: () => true,
};
const S = { who: "Colega" };
async function call(path, body) {
  const url = new URL("https://jci-brasov.com" + path);
  const req = new Request(url, body ? { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {});
  const r = await handleApeluri(req, env, url, S, h);
  return { status: r.status, j: await r.json() };
}
// contacte din afara site-ului, încărcate direct în D1 (ca în producție)
await call("/api/echipa/contacte"); // creează tabelele
DB._db.exec(`INSERT INTO contacte (nume, telefon) VALUES ('Ana din WhatsApp','+40700000001'),('Diana','+40700000077'),(NULL,'+40700000050'),('Cineva Nou','+40700000060');
INSERT INTO contact_surse (contact_id, sursa) SELECT id,'WhatsApp' FROM contacte;`);

// normalizare telefon
assert.equal(normPhone("0700 000 001"), "+40700000001");
assert.equal(normPhone("+40 700-000-001"), "+40700000001");
assert.equal(normPhone("0040700000001"), "+40700000001");
assert.equal(normPhone("700000001"), "+40700000001");
assert.equal(normPhone("+31 6 4912 2460"), "+31649122460");

// listă: 4 din WhatsApp + 2 înscrieri noi (fără test); Ana se unește cu înscrierea, deci 4 + 3 = 7 minus 1 = 6
let { j } = await call("/api/echipa/contacte");
assert.equal(j.contacte.length, 6, "6 contacte unice");
const ana = j.contacte.find((c) => c.nume === "Ana Test Unu");
assert.ok(ana && ana.inscris && ana.trimisa && ana.confirmat, "Ana: înscrisă, Gmail trimis și confirmat");
assert.equal(ana.intrebare, "Ce urmeaza?");
assert.match(ana.surse, /WhatsApp/); assert.match(ana.surse, /Site/);
const bob = j.contacte.find((c) => c.nume === "Bob Test Doi");
assert.ok(bob.trimisa && !bob.confirmat, "Bob: trimis, neconfirmat");
const diana = j.contacte.find((c) => c.nume === "Diana Mare");
assert.ok(diana.eroare && !diana.trimisa, "Diana Mare: eroare la Gmail");
assert.ok(!j.contacte.some((c) => c.nume === "Proba Test"), "testele nu apar");
assert.equal(j.duplicate, 1, "Diana și Diana Mare: posibil duplicat");
// sincronizarea e idempotentă
({ j } = await call("/api/echipa/contacte"));
assert.equal(j.contacte.length, 6);

// bifa „Contactat”
const cn = j.contacte.find((c) => c.nume === "Cineva Nou");
await call("/api/echipa/contactat", { id: cn.id, contactat: true });
({ j } = await call("/api/echipa/contacte"));
assert.equal(j.contacte.find((c) => c.id === cn.id).contactat_de, "Colega");
await call("/api/echipa/contactat", { id: cn.id, contactat: false });

// validări
let r = await call("/api/echipa/apel", { contact_id: cn.id, nume_sunat: "X", raspuns: "da" });
assert.equal(r.status, 400, "lipsește apelantul");
r = await call("/api/echipa/apel", { contact_id: cn.id, apelant: "Colega", nume_sunat: "X" });
assert.equal(r.status, 400, "lipsește răspunsul de la întrebarea 6");

// nu a răspuns: apel salvat, fără înscriere
r = await call("/api/echipa/apel", { contact_id: cn.id, apelant: "Colega", nume_sunat: "Cineva Nou", raspuns: "nu", status_final: "revine" });
assert.ok(r.j.ok);

// „Confirmat” fără să fi vorbit: refuz; statusul final nu este obligatoriu (14 nov 2026)
r = await call("/api/echipa/apel", { contact_id: cn.id, apelant: "Colega", nume_sunat: "Cineva Nou", raspuns: "nu", status_final: "confirmat" });
assert.equal(r.status, 400); assert.match(r.j.error, /vorbi/);
r = await call("/api/echipa/apel", { contact_id: cn.id, apelant: "Colega", nume_sunat: "Cineva Nou", raspuns: "nu" });
assert.ok(r.j.ok, "nu a răspuns, fără status final");
r = await call("/api/echipa/apel", { contact_id: cn.id, apelant: "Colega", nume_sunat: "Cineva Nou", raspuns: "mai_tarziu", status_final: "" });
assert.ok(r.j.ok, "sună mai târziu, fără status final");
r = await call("/api/echipa/apel", { contact_id: cn.id, apelant: "Colega", nume_sunat: "Cineva Nou", raspuns: "da", status_final: "" });
assert.ok(r.j.ok && r.j.rezultat === "", "a vorbit, fără status final: apel salvat, fără înscriere");

// confirmă, dar fără email: refuz
r = await call("/api/echipa/apel", { contact_id: cn.id, apelant: "Colega", nume_sunat: "Cineva Nou", raspuns: "da", status_final: "confirmat", acord_date: true });
assert.equal(r.status, 400); assert.match(r.j.error, /email/i);
// confirmă, cu email, dar fără acord: refuz
r = await call("/api/echipa/apel", { contact_id: cn.id, apelant: "Colega", nume_sunat: "Cineva Nou", raspuns: "da", status_final: "confirmat", email: "nou@example.com" });
assert.equal(r.status, 400); assert.match(r.j.error, /acord/i);
assert.equal((DB._db.prepare("SELECT COUNT(*) n FROM inscrieri WHERE email='nou@example.com'").get()).n, 0, "nimic creat la refuz");

// termenul a trecut? Testul rulează înainte de 24 nov 2026; simulăm cu Date.now
const realNow = Date.now;
Date.now = () => Date.UTC(2026, 10, 25, 12, 0, 0);
r = await call("/api/echipa/apel", { contact_id: cn.id, apelant: "Colega", nume_sunat: "Cineva Nou", raspuns: "da", status_final: "confirmat", email: "nou@example.com", acord_date: true });
assert.equal(r.status, 409); assert.ok(r.j.needsConfirm, "după termen cere confirmare");
assert.equal((DB._db.prepare("SELECT COUNT(*) n FROM inscrieri WHERE email='nou@example.com'").get()).n, 0);
r = await call("/api/echipa/apel", { contact_id: cn.id, apelant: "Colega", nume_sunat: "Cineva Nou", raspuns: "da", status_final: "confirmat", email: "nou@example.com", acord_date: true, depasit_termen: true });
assert.ok(r.j.ok && r.j.rezultat === "inscris_confirmat", "după confirmare se înscrie");
Date.now = realNow;
const reg = DB._db.prepare("SELECT * FROM inscrieri WHERE email='nou@example.com'").get();
assert.equal(reg.sursa, "Telefon (Colega)"); assert.equal(reg.status, "confirmat"); assert.match(reg.token, /^[a-f0-9]{32}$/); assert.equal(reg.invitatie_trimisa, null, "invitația pleacă prin scriptul Gmail");
({ j } = await call("/api/echipa/contacte"));
const cn2 = j.contacte.find((c) => c.id === cn.id);
assert.ok(cn2.inscris && cn2.contactat && cn2.status_apel === "confirmat" && /Telefon/.test(cn2.surse) && /WhatsApp/.test(cn2.surse), "sursele originale se păstrează");

// a doua înscriere pentru același contact nu se creează
r = await call("/api/echipa/apel", { contact_id: cn.id, apelant: "Colega", nume_sunat: "Cineva Nou", raspuns: "da", status_final: "confirmat", email: "alt@example.com", acord_date: true });
assert.ok(r.j.ok && r.j.rezultat === "");
assert.equal((DB._db.prepare("SELECT COUNT(*) n FROM inscrieri WHERE nume='Cineva Nou'").get()).n, 1, "fără duplicat de înscriere");
assert.equal((DB._db.prepare("SELECT COUNT(*) n FROM call_logs WHERE contact_id=?").get(cn.id)).n, 6, "apelurile se țin separat");

// email existent la altă persoană: nu se creează, perechea intră la duplicate
const cx = j.contacte.find((c) => c.telefon === "+40700000050");
r = await call("/api/echipa/apel", { contact_id: cx.id, apelant: "Colega", nume_sunat: "Necunoscut", raspuns: "da", status_final: "confirmat", email: "a1@example.com", acord_date: true });
assert.ok(r.j.ok && r.j.rezultat === "email_existent" && r.j.warning);
assert.equal((DB._db.prepare("SELECT COUNT(*) n FROM inscrieri WHERE telefon='+40700000050'").get()).n, 0);

// „sună mai târziu” intră în reveniri
r = await call("/api/echipa/apel", { contact_id: bob.id, apelant: "Colega", nume_sunat: "Bob Test Doi", raspuns: "mai_tarziu", status_final: "revine", revenire_la: "2026-11-14T10:00" });
({ j } = await call("/api/echipa/contacte"));
const bob2 = j.contacte.find((c) => c.id === bob.id);
assert.equal(bob2.revenire, "2026-11-14T10:00"); assert.equal(bob2.status_apel, "mai_tarziu"); assert.equal(bob2.contactat, false);

// contact nou, inexistent în bază
r = await call("/api/echipa/apel", { apelant: "Colega", nume_sunat: "Persoană Nouă", telefon: "0700 000 099", sursa: "Partener", raspuns: "nu", status_final: "revine" });
assert.ok(r.j.ok && r.j.nou);
r = await call("/api/echipa/apel", { apelant: "Colega", nume_sunat: "Persoană Nouă", telefon: "+40700000099", sursa: "Partener", raspuns: "nu", status_final: "revine" });
assert.ok(r.j.ok && !r.j.nou, "același telefon normalizat nu creează al doilea contact");
r = await call("/api/echipa/apel", { apelant: "Colega", nume_sunat: "Prost", telefon: "12", sursa: "Partener", raspuns: "nu", status_final: "revine" });
assert.equal(r.status, 400);

// duplicate: „Diana” (WhatsApp) și „Diana Mare” (site), telefoane diferite; unire manuală
({ j } = await call("/api/echipa/duplicate"));
assert.equal(j.duplicate.length, 2, "Diana/Diana Mare și perechea de la emailul existent");
const emailPair = j.duplicate.find((x) => /email/i.test(x.motiv));
assert.ok(emailPair, "perechea cu același email e în listă");
await call("/api/echipa/duplicat", { id: emailPair.id, actiune: "diferiti" });
({ j } = await call("/api/echipa/duplicate"));
assert.equal(j.duplicate.length, 1);
const d = j.duplicate[0];
r = await call("/api/echipa/duplicat", { id: d.id, actiune: "unire" });
assert.ok(r.j.ok);
({ j } = await call("/api/echipa/contacte"));
assert.ok(!j.contacte.some((c) => c.nume === "Diana"), "contactul absorbit dispare");
const dm = j.contacte.find((c) => c.nume === "Diana Mare");
assert.equal(dm.alt, "+40700000077", "telefonul celuilalt rămâne ca alt număr");
assert.match(dm.surse, /WhatsApp/);
assert.equal(j.duplicate, 0);

// „persoane diferite” nu mai reapare
DB._db.exec("INSERT INTO contacte (nume, telefon) VALUES ('Bob','+40700000088')");
({ j } = await call("/api/echipa/contacte"));
assert.equal(j.duplicate, 1);
const d2 = (await call("/api/echipa/duplicate")).j.duplicate[0];
await call("/api/echipa/duplicat", { id: d2.id, actiune: "diferiti" });
({ j } = await call("/api/echipa/contacte"));
assert.equal(j.duplicate, 0, "marcat ca diferit, nu mai reapare");

// ---------- chestionarul completat de persoană (link personal) ----------
DB._db.exec("INSERT INTO contacte (nume, telefon) VALUES ('Online Test','+40700000123'),('Vip Curios','+40700000124')");
({ j } = await call("/api/echipa/contacte"));
assert.ok(j.contacte.every((c) => /^[a-z2-9]{12}$/.test(c.cod)), "fiecare contact are cod");
assert.equal(new Set(j.contacte.map((c) => c.cod)).size, j.contacte.length, "coduri unice");
const on = j.contacte.find((c) => c.nume === "Online Test"), vc = j.contacte.find((c) => c.nume === "Vip Curios");
const pub = async (body) => { const rr = await chestionarSave(new Request("https://jci-brasov.com/api/chestionar", { method: "POST", body: JSON.stringify(body) }), env, h); return { status: rr.status, j: await rr.json() }; };
r = await pub({ cod: "aaaaaaaaaaaa", vine: "da" });
assert.equal(r.status, 404, "cod necunoscut");
r = await pub({ cod: on.cod });
assert.equal(r.status, 400, "fără răspuns la participare");
r = await pub({ cod: on.cod, vine: "da", nume: "Online Test", acord: true });
assert.equal(r.status, 400, "vine, dar fără email"); assert.match(r.j.error, /email/);
r = await pub({ cod: on.cod, vine: "da", nume: "Online Test", email: "online@example.com" });
assert.equal(r.status, 400, "vine, dar fără acord"); assert.match(r.j.error, /acordul/);
r = await pub({ cod: on.cod, vine: "nu" });
assert.equal(r.status, 400, "orice răspuns cere acordul pentru date");
r = await pub({ cod: on.cod, vine: "da", nume: "Online Test Complet", email: "online@example.com", acord: true, domeniu: "it", tinte: ["marketing"], intrebare: "Cum începem?", vip: "nu" });
assert.ok(r.j.ok && r.j.rezultat === "inscris_confirmat", "înscriere prin chestionarul online");
let ir = DB._db.prepare("SELECT nume, sursa, telefon, tinte FROM inscrieri WHERE email='online@example.com'").get();
assert.equal(ir.sursa, "WhatsApp"); assert.equal(ir.nume, "Online Test Complet"); assert.equal(ir.telefon, "+40700000123");
assert.ok(!ir.tinte, "domeniile țintă nu se iau de la cine nu vrea VIP");
let lg = DB._db.prepare("SELECT apelant, status_final, raspuns FROM call_logs WHERE contact_id=? ORDER BY id DESC").get(on.id);
assert.equal(lg.apelant, "Chestionar online"); assert.equal(lg.status_final, "confirmat");
assert.equal(DB._db.prepare("SELECT COUNT(*) n FROM contact_surse WHERE contact_id=? AND sursa='Telefon'").get(on.id).n, 0, "fără sursa Telefon");
// interesat de VIP: domeniile țintă se păstrează; nu participă: fără înscriere
r = await pub({ cod: vc.cod, vine: "poate", vip: "da", tinte: ["it", "marketing"], acord: true });
assert.ok(r.j.ok && r.j.status === "revine");
assert.equal(DB._db.prepare("SELECT tinte FROM call_logs WHERE contact_id=? ORDER BY id DESC").get(vc.id).tinte, "it,marketing");
r = await pub({ cod: vc.cod, vine: "nu", acord: true });
assert.ok(r.j.ok && r.j.rezultat === "");
// nu mai dorește să fie contactat: se salvează fără acord și fără celelalte răspunsuri
r = await pub({ cod: vc.cod, vine: "stop", ocupatie: "ceva", email: "x@example.com" });
assert.ok(r.j.ok && r.j.stop);
lg = DB._db.prepare("SELECT status_final, motiv, ocupatie, email, acord_date FROM call_logs WHERE contact_id=? ORDER BY id DESC").get(vc.id);
assert.equal(lg.status_final, "nu_participa"); assert.match(lg.motiv, /contactat/); assert.equal(lg.ocupatie, ""); assert.equal(lg.email, ""); assert.equal(lg.acord_date, 0);
assert.equal(DB._db.prepare("SELECT inscriere_id FROM contacte WHERE id=?").get(vc.id).inscriere_id, null);
// pagina: arată numele, nu telefonul și nu emailul; pentru cei înscriși nu mai cere emailul
let pg = await (await chestionarPage(env, h, vc.cod)).text();
assert.match(pg, /Bună, mulțumim/, "fără prenume confirmat, salut fără nume"); assert.ok(!pg.includes("700000124")); assert.match(pg, /id="q_email"/);
pg = await (await chestionarPage(env, h, on.cod)).text();
assert.ok(!/id="q_email"/.test(pg) && !pg.includes("online@example.com"), "înscris: fără câmp de email, fără emailul afișat");
// panoul: trimis și completat
r = await call("/api/echipa/chestionar-trimis", { id: vc.id, prenume: " Vio❤️rel " });
assert.ok(r.j.ok);
pg = await (await chestionarPage(env, h, vc.cod)).text();
assert.match(pg, /Dragă Vio rel,/, "prenumele confirmat în panou, fără emoticoane");
DB._db.exec("INSERT INTO contacte (nume, telefon) VALUES ('Bica❤️','+40700000131'),('FARKAS ALEXANDRU','+40700000132'),('AntonelaCoroAMA a…','+40700000133'),('raluca caloian','+40700000134')");
({ j } = await call("/api/echipa/contacte"));
const pn = (n) => j.contacte.find((c) => c.nume === n).prenume;
assert.equal(pn("Bica❤️"), "Bica"); assert.equal(pn("FARKAS ALEXANDRU"), "Farkas"); assert.equal(pn("AntonelaCoroAMA a…"), ""); assert.equal(pn("raluca caloian"), "Raluca");
assert.equal(j.contacte.find((c) => c.id === on.id).prenume, "Online", "pentru înscriși, prenumele vine din înscriere");
({ j } = await call("/api/echipa/contacte"));
assert.ok(j.contacte.find((c) => c.id === vc.id).q_trimis && j.contacte.find((c) => c.id === on.id).q_online);

console.log("apeluri: toate testele au trecut");
