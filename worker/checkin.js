// Check-in cu QR pentru Beyond the Initiative.
// Fiecare înscriere are un cod secret (coloana token). QR-ul de pe invitație duce la /c/<token>:
//  - pentru echipă (autentificată cu PIN pe /echipa), se deschide fișa de check-in;
//  - pentru oricine altcineva, se deschide biletul (/bilet/<token>), fără să confirme nimic.
// PIN-ul (hash + sare) și secretul de semnare a sesiunii stau în D1, tabelul setari.

import { handleApeluri } from "./apeluri.js";

const EVENT = "beyond-2026";
const COOKIE = "jci_echipa";
const SESSION_HOURS = 16;
const TOKEN_RE = /^[a-f0-9]{32}$/;

// ---------- utilitare ----------
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sha256(s) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(s))); }
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}
function eqConst(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function oraRo(utc) {
  if (!utc) return "";
  const d = new Date(utc.replace(" ", "T") + "Z");
  return d.toLocaleTimeString("ro-RO", { timeZone: "Europe/Bucharest", hour: "2-digit", minute: "2-digit" });
}
const SEC_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};
function html(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", ...SEC_HEADERS, ...extra } });
}
function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...SEC_HEADERS, ...extra } });
}

async function setting(env, k) {
  const r = await env.DB.prepare("SELECT valoare FROM setari WHERE cheie=?").bind(k).first();
  return r ? r.valoare : null;
}
async function ensureTokens(env) {
  await env.DB.prepare("UPDATE inscrieri SET token = lower(hex(randomblob(16))) WHERE token IS NULL").run();
}
async function findByToken(env, t) {
  if (!TOKEN_RE.test(t)) return null;
  return env.DB.prepare("SELECT * FROM inscrieri WHERE token=? AND eveniment=?").bind(t, EVENT).first();
}
async function isVip(env, row) {
  if (!row) return false;
  if ((row.sursa || "").includes("VIP")) return true;
  try {
    const v = await env.DB.prepare("SELECT 1 AS x FROM vip WHERE eveniment=? AND lower(email)=lower(?) LIMIT 1").bind(EVENT, row.email).first();
    return !!v;
  } catch (e) { return false; }
}
// Numărul de serie al biletului VIP: locurile 01–15 sunt rezervate invitaților VIP (VIP_PRESOLD din index.js),
// cumpărătorii din Stripe primesc 16, 17, ... în ordinea plății. Fără plată în tabelul vip → fără număr.
const VIP_PRESOLD = 15, VIP_TOTAL = 40;
async function vipNumber(env, row) {
  try {
    const v = await env.DB.prepare("SELECT id FROM vip WHERE eveniment=? AND lower(email)=lower(?) ORDER BY id LIMIT 1").bind(EVENT, row.email).first();
    if (!v) return null;
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM vip WHERE eveniment=? AND id<=?").bind(EVENT, v.id).first();
    const n = VIP_PRESOLD + ((r && r.n) || 1);
    return n <= VIP_TOTAL ? n : null;
  } catch (e) { return null; }
}

// ---------- Blitz Networking: bloc, număr pe ecuson și grupele celor 6 runde ----------
// Participanții sunt împărțiți în blocuri de câte 25 (litera A, B, C...), fiecare cu zona ei în sală. În bloc, fiecare
// persoană ocupă un loc din grila 5x5 (numărul de pe ecuson, 1–25). Cele 6 runde (3 în Blitz #1, 3 în Blitz #2) sunt
// cele 6 clase de drepte paralele din planul afin peste Z5: într-un bloc complet, fiecare pereche de persoane se
// întâlnește exact o dată, adică 24 de contacte noi pentru fiecare. Locul se alocă la scanarea biletului: blocul cu cei
// mai puțini oameni primește următoarea persoană, deci cei care sosesc împreună ajung în blocuri diferite.
// Blocurile se umplu pe valuri: întâi primele 3 (A, B, C), apoi următoarele 2 (D, E), apoi F, apoi câte unul. În cadrul valului,
// persoana nouă merge în blocul cu cei mai puțini oameni (la egalitate, alegere la întâmplare), deci cei care sosesc împreună
// ajung în blocuri diferite, iar dacă nu vin toți, primele blocuri sunt cele pline și echipele sunt formate.
// Când cineva e anulat și se eliberează un loc dintr-un val anterior, următoarea persoană îl ocupă.
const BLOC_SIZE = 25;
const WAVES = [3, 2, 1]; // mărimile valurilor; după ele, câte un bloc pe rând
const MAX_BLOCKS = 26;
const BLOC_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
// Numele blocurilor (doar etichetă de anunțat în sală, codurile rămân litera și numerele): povestea grupului, de la idee la orizont.
const BLOC_NAMES = ["Scânteia", "Busola", "Puntea", "Urcușul", "Vârful", "Orizontul", "Farul", "Zorii"];
// Ordinea în care se ocupă punctele grilei, aleasă ca grupele să rămână echilibrate și când blocul nu e plin.
const FILL_ORDER = [4, 3, 13, 10, 1, 23, 6, 21, 20, 12, 19, 0, 17, 18, 22, 8, 24, 2, 7, 16, 14, 11, 15, 5, 9];
function blitzInfo(bloc, slot) {
  if (!bloc || slot == null || slot < 0 || slot >= BLOC_SIZE) return null;
  const p = FILL_ORDER[slot], x = p % 5, y = Math.floor(p / 5);
  const grupe = [];
  for (let k = 0; k < 5; k++) grupe.push((((y - k * x) % 5) + 5) % 5 + 1);
  grupe.push(x + 1);
  return { bloc: BLOC_LETTERS[bloc - 1], nume: BLOC_NAMES[bloc - 1] || "", nr: slot + 1, grupe };
}
let blitzCols = false;
async function ensureBlitzCols(env) {
  if (blitzCols) return;
  for (const col of ["bloc INTEGER", "slot INTEGER"]) {
    try { await env.DB.prepare(`ALTER TABLE inscrieri ADD COLUMN ${col}`).run(); } catch (e) { /* există deja */ }
  }
  try { await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_blitz_slot ON inscrieri(eveniment,bloc,slot) WHERE bloc IS NOT NULL").run(); } catch (e) { /* există deja */ }
  // Se reține că schema e gata doar dacă interogarea pe coloanele noi funcționează și indexul unic există:
  // fără el, două scanări simultane ar putea primi același loc.
  await env.DB.prepare("SELECT bloc, slot FROM inscrieri LIMIT 1").first();
  const ix = await env.DB.prepare("SELECT 1 AS x FROM sqlite_master WHERE type='index' AND name='idx_blitz_slot'").first();
  if (!ix) throw new Error("lipsește indexul unic idx_blitz_slot");
  blitzCols = true;
}
// Cei care intră în aceeași perioadă scurtă pot fi prieteni: sunt împrăștiați în blocuri diferite, ca să se vadă la Blitz Networking.
const FRIEND_WINDOW_S = 180;
async function blitzState(env, id) {
  const rows = (await env.DB.prepare(
    "SELECT bloc, slot, CASE WHEN prezent_la >= datetime('now', ?) THEN 1 ELSE 0 END AS rec FROM inscrieri WHERE eveniment=? AND bloc IS NOT NULL AND id<>?"
  ).bind(`-${FRIEND_WINDOW_S} seconds`, EVENT, id).all()).results || [];
  const used = {}, rec = {};
  for (const r of rows) {
    (used[r.bloc] = used[r.bloc] || new Set()).add(r.slot);
    if (r.rec) rec[r.bloc] = (rec[r.bloc] || 0) + 1;
  }
  return { used, size: (b) => (used[b] ? used[b].size : 0), rec: (b) => rec[b] || 0 };
}
// Intervalele de blocuri ale valurilor: [1..3], [4..5], [6], apoi câte unul.
function waveRanges() {
  const out = []; let from = 1, w = 0;
  while (from <= MAX_BLOCKS) { const len = w < WAVES.length ? WAVES[w] : 1; out.push([from, Math.min(MAX_BLOCKS, from + len - 1)]); from += len; w++; }
  return out;
}
function openIn(st, [from, to]) {
  const open = [];
  for (let b = from; b <= to; b++) if (st.size(b) < BLOC_SIZE) open.push(b);
  return open;
}
// Între blocurile deschise ale valului: cele cu cel mult un om peste minim, apoi cel cu cei mai puțini sosiți recent,
// apoi cel mai puțin plin, apoi la întâmplare.
function chooseBlock(open, st) {
  const min = Math.min(...open.map(st.size));
  const cand = open.filter((b) => st.size(b) <= min + 1);
  const minRec = Math.min(...cand.map(st.rec));
  const c2 = cand.filter((b) => st.rec(b) === minRec);
  const minSize = Math.min(...c2.map(st.size));
  const c3 = c2.filter((b) => st.size(b) === minSize);
  return c3[Math.floor(Math.random() * c3.length)];
}
function firstFree(st, b) {
  const taken = st.used[b] || new Set();
  let slot = 0;
  while (taken.has(slot)) slot++;
  return slot;
}
// Două scanări în aceeași fracțiune de secundă citesc aceeași stare și pot alege același bloc. După alocare, persoana cu id-ul
// mai mare verifică dacă a nimerit în același bloc cu cineva sosit chiar atunci și, dacă există alt bloc mai liber de sosiți recent, se mută.
async function spreadFriends(env, id, pick) {
  const near = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM inscrieri WHERE eveniment=? AND bloc=? AND id<? AND prezent_la >= datetime('now','-20 seconds')"
  ).bind(EVENT, pick, id).first();
  if (!near || !near.n) return null;
  const st = await blitzState(env, id);
  const range = waveRanges().find(([f, t]) => pick >= f && pick <= t);
  const open = openIn(st, range).filter((b) => b !== pick);
  if (!open.length) return null;
  const better = open.filter((b) => st.rec(b) < st.rec(pick) && st.size(b) <= st.size(pick) + 1);
  if (!better.length) return null;
  const alt = chooseBlock(better, st);
  const slot = firstFree(st, alt);
  const cur = await env.DB.prepare("SELECT slot FROM inscrieri WHERE id=? AND bloc=?").bind(id, pick).first();
  if (!cur) return null;
  const r = await env.DB.prepare("UPDATE inscrieri SET bloc=?, slot=? WHERE id=? AND bloc=? AND slot=?").bind(alt, slot, id, pick, cur.slot).run();
  return r.meta && r.meta.changes ? blitzInfo(alt, slot) : null;
}
async function assignBlitz(env, id) {
  await ensureBlitzCols(env);
  const cur = await env.DB.prepare("SELECT bloc, slot FROM inscrieri WHERE id=?").bind(id).first();
  if (cur && cur.bloc) return blitzInfo(cur.bloc, cur.slot);
  for (let attempt = 0; attempt < 40; attempt++) {
    const st = await blitzState(env, id);
    // primul val care nu e plin
    let pick = 0;
    for (const range of waveRanges()) {
      const open = openIn(st, range);
      if (open.length) { pick = chooseBlock(open, st); break; }
    }
    if (!pick) return null;
    const slot = firstFree(st, pick);
    try {
      // Doar persoanele prezente primesc loc: o anulare făcută între timp nu lasă un loc ocupat degeaba.
      const r = await env.DB.prepare("UPDATE inscrieri SET bloc=?, slot=? WHERE id=? AND bloc IS NULL AND prezent_la IS NOT NULL").bind(pick, slot, id).run();
      if (r.meta && r.meta.changes === 0) {
        const c2 = await env.DB.prepare("SELECT bloc, slot FROM inscrieri WHERE id=?").bind(id).first();
        return c2 && c2.bloc ? blitzInfo(c2.bloc, c2.slot) : null;
      }
      try { const moved = await spreadFriends(env, id, pick); if (moved) return moved; } catch (e) { console.warn("spreadFriends", e && e.message); }
      return blitzInfo(pick, slot);
    } catch (e) {
      if (!/UNIQUE/i.test(String((e && e.message) || e))) throw e; // doar conflictul de loc se reîncearcă
    }
  }
  return null;
}

// ---------- sesiunea echipei ----------
function readCookie(request, name) {
  const c = request.headers.get("Cookie") || "";
  const m = c.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : null;
}
async function staffSession(request, env) {
  const v = readCookie(request, COOKIE);
  if (!v) return null;
  const [exp, who, sig] = v.split(".");
  if (!exp || !sig || Date.now() > Number(exp)) return null;
  const secret = await setting(env, "cookie_secret");
  if (!secret) return null;
  const good = await hmac(secret, exp + "." + who);
  return eqConst(good, sig) ? { who: decodeURIComponent(who || "") || "echipa" } : null;
}
async function makeSession(env, who) {
  const exp = String(Date.now() + SESSION_HOURS * 3600e3);
  const w = encodeURIComponent((who || "echipa").slice(0, 40));
  const sig = await hmac(await setting(env, "cookie_secret"), exp + "." + w);
  return `${COOKIE}=${encodeURIComponent(exp + "." + w + "." + sig)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}`;
}
function sameOrigin(request) {
  const o = request.headers.get("Origin");
  return !o || o === new URL(request.url).origin || /^https:\/\/(www\.)?jci-brasov\.com$/.test(o) || /^http:\/\/localhost:\d+$/.test(o);
}

// ---------- rutare ----------
export async function handleCheckin(request, env, url, overLimit) {
  const p = url.pathname;
  if (!env.DB) return null;
  const H = { json, html, shell, esc, sameOrigin };

  let m = p.match(/^\/bilet\/([a-f0-9]{32})\/?$/);
  if (m) return ticketPage(env, m[1]);

  m = p.match(/^\/confirma\/([a-f0-9]{32})\/?$/);
  if (m) return confirmReceipt(request, env, m[1]);

  m = p.match(/^\/c\/([a-f0-9]{32})\/?$/);
  if (m) {
    const s = await staffSession(request, env);
    if (!s) return Response.redirect(`${url.origin}/bilet/${m[1]}`, 302);
    return scanPage(env, m[1], s, url.searchParams.get("ok") === "1");
  }

  if (p === "/checkin/apeluri" || p === "/checkin/apeluri/") {
    const s = await staffSession(request, env);
    return s ? handleApeluri(request, env, url, s, H) : Response.redirect(`${url.origin}/checkin`, 302);
  }

  if (p === "/checkin" || p === "/checkin/") {
    const s = await staffSession(request, env);
    return s ? dashboardPage(s) : loginPage(url.searchParams.get("e") === "1", url.searchParams.get("n"));
  }

  if (p === "/api/echipa/login") {
    if (request.method !== "POST" || !sameOrigin(request)) return new Response("Forbidden", { status: 403 });
    if (await overLimit(request, env, "pin", 10, 30)) return Response.redirect(`${url.origin}/checkin?e=1`, 303);
    const f = await request.formData().catch(() => null);
    const pin = String((f && f.get("pin")) || "").replace(/\D/g, "").slice(0, 12);
    const who = String((f && f.get("nume")) || "").replace(/[^\p{L}\p{N} .-]/gu, "").trim().slice(0, 40);
    const next = String((f && f.get("next")) || "");
    const salt = await setting(env, "pin_salt"), hash = await setting(env, "pin_hash");
    if (!salt || !hash || !pin || !eqConst(await sha256(salt + ":" + pin), hash)) {
      return Response.redirect(`${url.origin}/checkin?e=1`, 303);
    }
    const dest = /^\/c\/[a-f0-9]{32}$/.test(next) ? next : "/checkin";
    return new Response(null, { status: 303, headers: { Location: url.origin + dest, "Set-Cookie": await makeSession(env, who), "Cache-Control": "no-store" } });
  }
  if (p === "/api/echipa/logout") {
    return new Response(null, { status: 303, headers: { Location: url.origin + "/checkin", "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } });
  }

  if (p.startsWith("/api/echipa/") || p === "/api/checkin") {
    const s = await staffSession(request, env);
    if (!s) return json({ error: "auth" }, 401);
    if (p === "/api/checkin") {
      if (request.method !== "POST" || !sameOrigin(request)) return json({ error: "method" }, 405);
      const b = await request.json().catch(() => ({}));
      return doCheckin(env, String(b.token || ""), b.undo === true, s);
    }
    if (p === "/api/echipa/stats") return stats(env);
    if (p === "/api/echipa/cauta") return search(env, url.searchParams.get("q") || "");
    if (p === "/api/echipa/export.csv") return exportCsv(env);
    const ap = await handleApeluri(request, env, url, s, H);
    if (ap) return ap;
    return json({ error: "not found" }, 404);
  }
  return null;
}

// ---------- operații ----------
async function doCheckin(env, token, undo, s) {
  const row = await findByToken(env, token);
  if (!row) return json({ ok: false, error: "Cod necunoscut" }, 404);
  if (row.status !== "confirmat" && row.status !== "test") return json({ ok: false, error: "Persoana nu are loc confirmat" }, 409);
  try { await ensureBlitzCols(env); } catch (e) { console.warn("ensureBlitzCols", e && e.message); }
  if (undo) {
    // Anularea eliberează și locul din bloc, ca următoarea persoană să îl primească.
    await env.DB.prepare("UPDATE inscrieri SET prezent_la=NULL, prezent_de=NULL, bloc=NULL, slot=NULL WHERE id=?").bind(row.id).run();
    await env.DB.prepare("INSERT INTO checkin_log (inscriere_id,actiune,de) VALUES (?,?,?)").bind(row.id, "anulare", s.who).run();
    return json({ ok: true, undone: true });
  }
  if (row.prezent_la) return json({ ok: false, already: true, ora: oraRo(row.prezent_la), de: row.prezent_de, nume: row.nume });
  const r = await env.DB.prepare("UPDATE inscrieri SET prezent_la=datetime('now'), prezent_de=? WHERE id=? AND prezent_la IS NULL").bind(s.who, row.id).run();
  if (!r.meta || r.meta.changes === 0) {
    const again = await findByToken(env, token);
    return json({ ok: false, already: true, ora: oraRo(again && again.prezent_la), de: again && again.prezent_de, nume: row.nume });
  }
  await env.DB.prepare("INSERT INTO checkin_log (inscriere_id,actiune,de) VALUES (?,?,?)").bind(row.id, "intrare", s.who).run();
  let loc = null;
  try { loc = await assignBlitz(env, row.id); } catch (e) { console.warn("assignBlitz", e && e.message); }
  return json({ ok: true, nume: row.nume, ora: oraRo(new Date().toISOString().slice(0, 19).replace("T", " ")), loc });
}

async function stats(env) {
  await ensureTokens(env);
  await ensureBlitzCols(env);
  const t = await env.DB.prepare(
    "SELECT SUM(CASE WHEN status='confirmat' THEN 1 ELSE 0 END) AS inscrisi, SUM(CASE WHEN prezent_la IS NOT NULL THEN 1 ELSE 0 END) AS prezenti, SUM(CASE WHEN status='asteptare' THEN 1 ELSE 0 END) AS asteptare, SUM(CASE WHEN status='confirmat' AND primire_confirmata IS NOT NULL THEN 1 ELSE 0 END) AS confirmari, SUM(CASE WHEN status='confirmat' AND invitatie_trimisa IS NOT NULL AND invitatie_trimisa NOT LIKE 'exclus%' AND invitatie_trimisa NOT LIKE 'eroare%' THEN 1 ELSE 0 END) AS trimise FROM inscrieri WHERE eveniment=?"
  ).bind(EVENT).first();
  const last = await env.DB.prepare(
    "SELECT nume, companie, prezent_la, prezent_de, token, bloc, slot FROM inscrieri WHERE eveniment=? AND prezent_la IS NOT NULL ORDER BY prezent_la DESC LIMIT 12"
  ).bind(EVENT).all();
  const blk = await env.DB.prepare("SELECT bloc, COUNT(*) AS n FROM inscrieri WHERE eveniment=? AND bloc IS NOT NULL GROUP BY bloc ORDER BY bloc").bind(EVENT).all();
  const locTxt = (r) => { const l = blitzInfo(r.bloc, r.slot); return l ? l.bloc + l.nr : ""; };
  return json({
    inscrisi: (t && t.inscrisi) || 0, confirmari: (t && t.confirmari) || 0, trimise: (t && t.trimise) || 0, prezenti: (t && t.prezenti) || 0, asteptare: (t && t.asteptare) || 0,
    ultimii: (last.results || []).map((r) => ({ nume: r.nume, companie: r.companie, ora: oraRo(r.prezent_la), de: r.prezent_de, token: r.token, loc: locTxt(r) })),
    blocuri: (blk.results || []).map((r) => ({ b: BLOC_LETTERS[r.bloc - 1], nume: BLOC_NAMES[r.bloc - 1] || "", n: r.n })),
  });
}

async function search(env, q) {
  q = q.trim().slice(0, 60);
  if (q.length < 2) return json({ rezultate: [] });
  await ensureTokens(env);
  await ensureBlitzCols(env);
  const like = "%" + q.replace(/[%_]/g, "") + "%";
  const digits = q.replace(/\D/g, "");
  const r = await env.DB.prepare(
    "SELECT nume, email, telefon, companie, status, sursa, prezent_la, primire_confirmata, token, bloc, slot FROM inscrieri WHERE eveniment=? AND (nume LIKE ? OR email LIKE ? OR companie LIKE ? OR (? <> '' AND replace(replace(replace(telefon,' ',''),'+',''),'-','') LIKE ?)) ORDER BY nume LIMIT 15"
  ).bind(EVENT, like, like, like, digits.length >= 4 ? digits : "", "%" + digits + "%").all();
  return json({
    rezultate: (r.results || []).map((x) => ({
      nume: x.nume, email: x.email, telefon: x.telefon, companie: x.companie, status: x.status,
      vip: (x.sursa || "").includes("VIP"), prezent: !!x.prezent_la, ora: oraRo(x.prezent_la), confirmat: !!x.primire_confirmata, token: x.token,
      loc: (() => { const l = blitzInfo(x.bloc, x.slot); return l ? l.bloc + l.nr : ""; })(),
    })),
  });
}

async function exportCsv(env) {
  await ensureBlitzCols(env);
  const r = await env.DB.prepare(
    "SELECT nume,email,telefon,companie,functie,profil,status,sursa,acord_bcr,creat,invitatie_trimisa,primire_confirmata,prezent_la,prezent_de,bloc,slot FROM inscrieri WHERE eveniment=? ORDER BY primire_confirmata IS NULL, nume"
  ).bind(EVENT).all();
  const cell = (v) => {
    let s = String(v == null ? "" : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const dataRo = (utc) => utc ? new Date(utc.replace(" ", "T") + "Z").toLocaleString("ro-RO", { timeZone: "Europe/Bucharest", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const head = ["Nume", "Email", "A confirmat primirea emailului", "Confirmat la", "Telefon", "Companie", "Funcție", "Profil", "Status", "Sursa", "Acord BCR", "Înscris la", "Invitație trimisă", "Prezent", "Ora intrării", "Confirmat de", "Bloc", "Nume bloc", "Nr. ecuson", "Runda 1", "Runda 2", "Runda 3", "Runda 4", "Runda 5", "Runda 6"];
  const lines = [head.map(cell).join(";")];
  for (const x of r.results || []) {
    const l = blitzInfo(x.bloc, x.slot);
    lines.push([x.nume, x.email, x.primire_confirmata ? "DA" : "NU", dataRo(x.primire_confirmata), x.telefon, x.companie, x.functie, x.profil, x.status, x.sursa, x.acord_bcr ? "DA" : "NU", dataRo(x.creat), dataRo(x.invitatie_trimisa),
      x.prezent_la ? "DA" : "NU", oraRo(x.prezent_la), x.prezent_de, l ? l.bloc : "", l ? l.nume : "", l ? l.nr : "", ...(l ? l.grupe.map((g) => l.bloc + g) : ["", "", "", "", "", ""])].map(cell).join(";"));
  }
  return new Response("﻿" + lines.join("\r\n"), {
    headers: { ...SEC_HEADERS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="prezenta-beyond-the-initiative.csv"' },
  });
}

// ---------- pagini ----------
const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
@font-face{font-family:P;src:url(/assets/fonts/plus-jakarta-sans-latin-wght-normal.woff2) format('woff2');font-weight:200 800;unicode-range:U+0000-00FF,U+2000-206F,U+20AC}
@font-face{font-family:P;src:url(/assets/fonts/plus-jakarta-sans-latin-ext-wght-normal.woff2) format('woff2');font-weight:200 800;unicode-range:U+0100-02AF,U+0218-021B,U+1E00-1EFF}
body{font-family:P,system-ui,sans-serif;background:#130F2D;color:#fff;min-height:100vh;-webkit-font-smoothing:antialiased;
 background-image:radial-gradient(700px 500px at 100% 0,rgba(0,151,215,.25),transparent 60%),linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:auto,44px 44px,44px 44px}
.w{max-width:520px;margin:0 auto;padding:28px 20px 48px}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:26px}
.top img{height:52px}
.pill{font-size:12px;font-weight:800;letter-spacing:.2em;color:#EFC40F;border:1.5px solid rgba(239,196,15,.55);border-radius:999px;padding:7px 14px}
.k{font-size:12px;font-weight:800;letter-spacing:.22em;color:#57BCBC;text-transform:uppercase}
h1{font-size:40px;line-height:1;font-weight:800;margin:10px 0 18px;letter-spacing:-.5px}
.t{background:#F5F7FB;color:#130F2D;border-radius:22px;overflow:hidden;box-shadow:0 30px 70px -20px rgba(0,0,0,.6)}
.t .in{padding:24px}
.lab{font-size:11px;font-weight:800;letter-spacing:.2em;color:#0097D7}
.val{font-size:20px;font-weight:800;margin-top:3px}
.name{font-size:28px;font-weight:800;color:#1F4789;line-height:1.15;margin-top:4px;word-break:break-word}
.grid2{display:grid;grid-template-columns:1fr auto;gap:16px;margin-top:18px}
.sep{border:0;border-top:2px dashed #C9D1E2;margin:0}
.qr{background:#fff;padding:22px;display:flex;flex-direction:column;align-items:center;gap:12px}
.qr #qr svg{width:240px;height:240px;display:block}
.qr p{font-size:14px;color:#4A5068;text-align:center}
.vip{display:inline-block;background:#EFC40F;color:#130F2D;font-weight:800;font-size:12px;letter-spacing:.15em;border-radius:999px;padding:5px 12px;margin-top:10px}
.muted{color:#B9BBD6;font-size:14px;line-height:1.5}
.btn{display:block;width:100%;text-align:center;border:0;border-radius:14px;padding:16px;font:inherit;font-weight:800;font-size:17px;cursor:pointer;text-decoration:none}
.b-blue{background:#0097D7;color:#fff}.b-green{background:#1FA463;color:#fff}.b-ghost{background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.3)}
.b-red{background:#D64545;color:#fff}
.mt{margin-top:14px}
.card{background:#1B1745;border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:20px}
.big{font-size:52px;font-weight:800;line-height:1}
.row{display:flex;gap:12px}.row>*{flex:1}
input{width:100%;font:inherit;font-size:18px;padding:15px 16px;border-radius:12px;border:1.5px solid rgba(255,255,255,.2);background:#0F0C26;color:#fff}
input:focus{outline:2px solid #0097D7;border-color:transparent}
.res{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.08)}
.res b{display:block;font-size:16px}.res small{color:#B9BBD6;font-size:13px}
.res button{flex:none;border:0;border-radius:10px;padding:10px 14px;font:inherit;font-weight:800;background:#0097D7;color:#fff;cursor:pointer}
.res .ok{flex:none;color:#4ED39A;font-weight:800;font-size:14px}
.state{border-radius:22px;padding:26px;text-align:center}
.s-ok{background:#123D2B;border:2px solid #1FA463}.s-warn{background:#47181C;border:2px solid #D64545}.s-wait{background:#1B1745;border:2px solid #0097D7}
.err{background:#47181C;border:1px solid #D64545;border-radius:12px;padding:12px 14px;font-size:14px;margin-bottom:14px}
body.vipb{background-color:#0B0920;background-image:radial-gradient(600px 420px at 85% 0,rgba(239,196,15,.18),transparent 60%),radial-gradient(500px 400px at 0 100%,rgba(0,151,215,.18),transparent 60%),linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:auto,auto,44px 44px,44px 44px}
.vipb .pill{color:#0B0920;border:0;background:linear-gradient(100deg,#B8860B,#EFC40F 40%,#FFF1A8 50%,#EFC40F 60%,#B8860B)}
.vipb .k{color:#EFC40F}
.vipb h1 em{font-style:normal;background:linear-gradient(100deg,#EFC40F,#FFF1A8,#EFC40F);-webkit-background-clip:text;background-clip:text;color:transparent}
@property --a{syntax:'<angle>';initial-value:0deg;inherits:false}
@keyframes vspin{to{--a:360deg}}
.vt{position:relative;border-radius:24px;padding:2px;background:conic-gradient(from var(--a,0deg),#B8860B,#EFC40F,#FFF1A8,#EFC40F,#B8860B,#EFC40F,#B8860B);box-shadow:0 40px 90px -30px rgba(239,196,15,.45);animation:vspin 8s linear infinite}
.vt-in{border-radius:22px;overflow:hidden;background:linear-gradient(160deg,#1E1A4D 0%,#130F2D 55%,#0E0B24 100%);position:relative}
.vt .holo{position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:.55;background:linear-gradient(115deg,transparent 30%,rgba(255,241,168,.25) 42%,rgba(87,188,188,.18) 50%,rgba(0,151,215,.15) 56%,transparent 68%);background-size:250% 250%;background-position:var(--hx,30%) var(--hy,30%)}
.vt .hd{padding:24px 24px 20px;position:relative}
.vt .r1{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.vt .lab{color:#EFC40F}
.vt .no{text-align:right;flex:none}.vt .no b{display:block;font-size:30px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}.vt .no small{font-size:12px;color:#A9ABC8;font-weight:600}
.vt .name{color:#fff;font-size:30px;margin-top:6px}
.vt .zone{display:inline-flex;align-items:center;gap:8px;margin-top:12px;background:rgba(239,196,15,.12);border:1px solid rgba(239,196,15,.45);color:#FFE27A;font-weight:700;font-size:13px;border-radius:999px;padding:6px 12px}
.vt .zone i{width:8px;height:8px;border-radius:50%;background:#EFC40F;box-shadow:0 0 10px #EFC40F}
.vt .lm{font-size:11px;font-weight:800;letter-spacing:.2em;color:#57BCBC}
.vt .val{font-size:17px;font-weight:700}
.vt .pk{margin:0 24px;padding:16px 0 4px;border-top:1px solid rgba(255,255,255,.1);position:relative}
.vt .pk ul{list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.vt .pk li{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:12px;font-size:13px;line-height:1.35;color:#E3E4F2}
.vt .pk svg{display:block;width:22px;height:22px;margin-bottom:8px;stroke:#EFC40F;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.vt .cut{position:relative;height:30px;margin-top:18px}
.vt .cut::before{content:"";position:absolute;left:22px;right:22px;top:50%;border-top:2px dashed rgba(239,196,15,.4)}
.vt .cut span{position:absolute;top:0;width:30px;height:30px;border-radius:50%;background:#0B0920}
.vt .cut .l{left:-17px}.vt .cut .r{right:-17px}
.vt .vq{padding:6px 24px 26px;display:flex;flex-direction:column;align-items:center;gap:14px;position:relative}
.vt .qb{background:#fff;border-radius:18px;padding:14px;box-shadow:0 0 0 3px rgba(239,196,15,.6),0 0 40px -6px rgba(239,196,15,.6)}
.vt .qb #qr svg{width:210px;height:210px;display:block}
.vt .vq p{font-size:13.5px;color:#B9BBD6;text-align:center;line-height:1.5}.vt .vq p b{color:#FFE27A}
.vt .ft{display:flex;justify-content:space-between;padding:12px 24px;background:rgba(239,196,15,.08);font-size:11px;font-weight:800;letter-spacing:.2em;color:#EFC40F;position:relative}
@media (prefers-reduced-motion:reduce){.vt{animation:none}}
.loc{background:#F5F7FB;color:#130F2D;border-radius:22px;padding:22px 20px;margin-top:14px;text-align:center;box-shadow:0 30px 70px -20px rgba(0,0,0,.6)}
.loc .lab{display:block}
.loc .big2{font-size:88px;font-weight:800;line-height:1;color:#1F4789;letter-spacing:-2px;margin:6px 0 2px}
.loc .sub{font-size:15px;font-weight:700;color:#4A5068}
.loc .rd{margin-top:18px;text-align:left}
.loc .rg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}
.loc .rg div{background:#fff;border:1.5px solid #C9D1E2;border-radius:14px;padding:10px 4px;text-align:center}
.loc .rg small{display:block;font-size:11px;font-weight:800;letter-spacing:.12em;color:#0097D7}
.loc .rg b{display:block;font-size:34px;font-weight:800;line-height:1.1;color:#130F2D}
.loc .txt{margin-top:16px;font-size:14px;font-weight:700;color:#130F2D;background:#EFC40F;border-radius:10px;padding:10px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.chip{border:1.5px solid rgba(255,255,255,.25);background:transparent;color:#fff;border-radius:999px;padding:8px 14px;font:inherit;font-weight:700;font-size:14px;cursor:pointer}
.chip.on{background:#0097D7;border-color:#0097D7}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.tag{font-size:12px;font-weight:700;border-radius:999px;padding:4px 10px;background:rgba(255,255,255,.08);color:#D5D7EA}
.tag.ok{background:#123D2B;color:#7BE0B1}.tag.warn{background:#47181C;color:#FF9C9C}.tag.info{background:#10324A;color:#8FD3F5}
.qbox{margin-top:12px;background:#0F0C26;border-left:3px solid #EFC40F;border-radius:8px;padding:10px 12px;font-size:14px;line-height:1.45;color:#E3E4F2}
.acts{display:flex;gap:8px;margin-top:14px}.acts>*{flex:1;padding:12px 8px;font-size:15px}
select,textarea{width:100%;font:inherit;font-size:17px;padding:14px 16px;border-radius:12px;border:1.5px solid rgba(255,255,255,.2);background:#0F0C26;color:#fff}
textarea{min-height:96px;resize:vertical}
.fl{display:block;margin-top:16px}
.chk{display:flex;gap:12px;align-items:flex-start;margin-top:14px;font-size:15px;line-height:1.4}
.chk input{width:22px;height:22px;flex:none;margin-top:2px;padding:0}
.ok-msg{background:#123D2B;border:1px solid #1FA463;border-radius:12px;padding:12px 14px;font-size:14px;margin-bottom:14px}
.bar{height:10px;background:rgba(255,255,255,.1);border-radius:99px;overflow:hidden;margin-top:14px}.bar i{display:block;height:100%;background:linear-gradient(90deg,#0097D7,#57BCBC)}
`;
function shell(title, inner, scripts = "", bodyClass = "") {
  return `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#130F2D"><title>${esc(title)}</title>
<link rel="icon" href="/assets/img/favicon-32.png"><style>${CSS}</style></head><body${bodyClass ? ` class="${bodyClass}"` : ""}><div class="w">
<div class="top"><img src="/assets/img/logo-jci-brasov-invers.png" alt="JCI Brașov"><span class="pill">BEYOND THE INITIATIVE</span></div>
${inner}</div>${scripts}</body></html>`;
}

async function ticketPage(env, token) {
  const row = await findByToken(env, token);
  if (!row) return html(shell("Bilet negăsit", `<h1>Biletul nu a fost găsit</h1><p class="muted">Verifică linkul primit sau scrie-ne la contact@jci-brasov.com.</p>`), 404);
  const en = row.limba === "en";
  const vip = await isVip(env, row);
  const T = en
    ? { k: "Your entry ticket", h: "See you on 26 November", g: "PERSONAL TICKET", d: "DATE", dv: "Thursday, 26 November 2026", o: "TIME", l: "VENUE", lv: "CATTIA Brașov, Strada Institutului 35", q: "Show this code at the entrance. Save a screenshot so you have it offline.", w: "You are on the waiting list. We will confirm your seat as soon as one becomes available." }
    : { k: "Biletul tău de intrare", h: "Ne vedem pe 26 noiembrie", g: "BILET NOMINAL", d: "DATA", dv: "Joi, 26 noiembrie 2026", o: "ORA", l: "LOCAȚIA", lv: "CATTIA Brașov, Strada Institutului 35", q: "Arată acest cod la intrare. Salvează o captură de ecran, ca să îl ai și fără internet.", w: "Ești pe lista de așteptare. Îți confirmăm locul imediat ce se eliberează unul." };
  if (row.status !== "confirmat" && row.status !== "test") {
    return html(shell("Listă de așteptare", `<p class="k">${T.k}</p><h1>${esc(row.nume)}</h1><div class="card"><p class="muted">${T.w}</p></div>`));
  }
  if (vip) return html(vipTicket(row, token, en, T, await vipNumber(env, row)));
  const inner = `<p class="k">${T.k}</p><h1>${T.h}</h1>
<div class="t"><div class="in"><p class="lab">${T.g}</p><p class="name">${esc(row.nume)}</p>${vip ? '<span class="vip">ACCES VIP</span>' : ""}
<div class="grid2"><div><p class="lab">${T.d}</p><p class="val">${T.dv}</p></div><div><p class="lab">${T.o}</p><p class="val">17:00</p></div></div>
<div class="mt"><p class="lab">${T.l}</p><p class="val">${T.lv}</p></div></div>
<hr class="sep"><div class="qr"><div id="qr" data-url="https://jci-brasov.com/c/${token}" role="img" aria-label="Cod QR de intrare"></div><p>${T.q}</p></div></div>
<p class="muted mt">${en ? "Everything offered at the Hillden stand is free. Drinks from the bar are paid separately." : "Tot ce se oferă la standul Hillden este gratuit. Consumația de la bar se achită separat."}</p>
<a class="btn b-ghost mt" href="/assets/beyond-the-initiative.ics">${en ? "Add to calendar" : "Adaugă în calendar"}</a>`;
  return html(shell(en ? "Your ticket" : "Biletul tău", inner, `<script src="/assets/js/qrcode.js"></script><script src="/assets/js/bilet.js"></script>`));
}

// Biletul VIP: ramă aurie animată, strat holografic (assets/js/bilet-vip.js), număr de serie, beneficiile incluse.
function vipTicket(row, token, en, T, no) {
  const nn = no ? String(no).padStart(2, "0") : "";
  const V = en
    ? { k: "VIP invitation", h: "Your seat is <em>in the front row</em>", g: "PERSONAL VIP TICKET", of: "of " + VIP_TOTAL, z: "VIP area, front rows", inc: "WHAT YOUR TICKET INCLUDES",
        p: ["Reserved seat in the front rows", "Meet the panel speakers in person", "Priority access to networking", "Wine and food tasting"],
        q: "Show this code at the <b>VIP entrance</b>. Save a screenshot so you have it offline." }
    : { k: "Invitație VIP", h: "Locul tău este <em>în primul rând</em>", g: "BILET VIP NOMINAL", of: "din " + VIP_TOTAL, z: "Zona VIP, primele rânduri", inc: "CE INCLUDE BILETUL TĂU",
        p: ["Loc rezervat în primele rânduri", "Întâlnire directă cu invitații din paneluri", "Acces prioritar la networking", "Degustare de vin și preparate culinare"],
        q: "Prezintă codul la <b>intrarea VIP</b>. Salvează o captură de ecran, ca să îl ai și fără internet." };
  const ic = [
    '<path d="M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M3 11h18v5H3zM6 16v3M18 16v3"/>',
    '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5M15 14.5c3 0 6 1.6 6 4.5"/>',
    '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    '<path d="M8 3h8l-1 7a3 3 0 0 1-6 0zM12 13v7M8 21h8"/>',
  ];
  const perks = V.p.map((t, i) => `<li><svg viewBox="0 0 24 24" aria-hidden="true">${ic[i]}</svg>${t}</li>`).join("");
  const inner = `<p class="k">${V.k}</p><h1>${V.h}</h1>
<div class="vt"><div class="vt-in"><div class="holo"></div>
<div class="hd"><div class="r1"><div><p class="lab">${V.g}</p><p class="name">${esc(row.nume)}</p></div>${nn ? `<div class="no"><b>${nn}</b><small>${V.of}</small></div>` : ""}</div>
<span class="zone"><i></i>${V.z}</span>
<div class="grid2"><div><p class="lm">${T.d}</p><p class="val">${T.dv}</p></div><div><p class="lm">${T.o}</p><p class="val">17:00</p></div></div>
<div class="mt"><p class="lm">${T.l}</p><p class="val">${T.lv}</p></div></div>
<div class="pk"><p class="lab">${V.inc}</p><ul>${perks}</ul></div>
<div class="cut"><span class="l"></span><span class="r"></span></div>
<div class="vq"><div class="qb"><div id="qr" data-url="https://jci-brasov.com/c/${token}" role="img" aria-label="Cod QR de intrare"></div></div><p>${V.q}</p></div>
<div class="ft"><span>LEAD CONNECT GROW</span><span>${nn ? "VIP " + nn : "VIP"}</span></div></div></div>
<p class="muted mt">${en ? "Everything offered at the Hillden stand is free. Drinks from the bar are paid separately." : "Tot ce se oferă la standul Hillden este gratuit. Consumația de la bar se achită separat."}</p>
<a class="btn b-ghost mt" href="/assets/beyond-the-initiative.ics">${en ? "Add to calendar" : "Adaugă în calendar"}</a>`;
  return shell(en ? "Your VIP ticket" : "Biletul tău VIP", inner, `<script src="/assets/js/qrcode.js"></script><script src="/assets/js/bilet.js"></script><script src="/assets/js/bilet-vip.js"></script>`, "vipb");
}

// Fișa de ecuson afișată echipei de la check-in după scanare: blocul, numărul și masa pentru fiecare dintre cele 6 runde.
function locCard(l) {
  if (!l) return `<div class="loc"><p class="lab">ECUSON</p><p class="sub" style="margin-top:8px">Nu s-a putut aloca un loc în bloc. Notează manual și anunță coordonatorul.</p></div>`;
  const cells = (from) => l.grupe.slice(from, from + 3).map((g, i) => `<div><small>RUNDA ${from + i + 1}</small><b>${l.bloc}${g}</b></div>`).join("");
  const mese = l.grupe.map((g) => l.bloc + g);
  return `<div class="loc"><p class="lab">SCRIE PE ECUSON</p><p class="big2">${l.bloc}${l.nr}</p><p class="sub">${l.nume ? `Blocul ${esc(l.nume)} (${l.bloc}), ` : `Blocul ${l.bloc}, `}numărul ${l.nr}</p>
<div class="rd"><span class="lab">BLITZ #1, MESELE</span><div class="rg">${cells(0)}</div></div>
<div class="rd"><span class="lab">BLITZ #2, MESELE</span><div class="rg">${cells(3)}</div></div>
<p class="txt">${l.bloc}${l.nr} | ${mese.slice(0, 3).join(" ")} | ${mese.slice(3).join(" ")}</p></div>`;
}

async function scanPage(env, token, s, fresh) {
  const row = await findByToken(env, token);
  if (!row) return html(shell("Cod necunoscut", `<div class="state s-warn"><p class="k" style="color:#fff">COD NECUNOSCUT</p><h1>Invitația nu există</h1><p class="muted">Caută persoana după nume.</p></div><a class="btn b-blue mt" href="/checkin">Înapoi la panou</a>`), 404);
  const vip = await isVip(env, row);
  const info = `<p class="name" style="color:#fff">${esc(row.nume)}</p>${row.companie ? `<p class="muted">${esc(row.companie)}</p>` : ""}${vip ? '<span class="vip">ACCES VIP</span>' : ""}`;
  let inner;
  if (row.status !== "confirmat" && row.status !== "test") {
    inner = `<div class="state s-warn"><p class="k" style="color:#fff">LISTĂ DE AȘTEPTARE</p>${info}<p class="muted mt">Persoana nu are loc confirmat.</p></div>`;
  } else if (row.prezent_la) {
    // Persoanele intrate înainte de introducerea blocurilor primesc loc la prima scanare ulterioară.
    let loc = null;
    try { loc = await assignBlitz(env, row.id); } catch (e) { console.warn("assignBlitz", e && e.message); }
    const recent = Date.now() - new Date(row.prezent_la.replace(" ", "T") + "Z").getTime() < 10 * 60e3;
    if (fresh && recent && row.prezent_de === s.who) {
      inner = `<div class="state s-ok"><p class="k" style="color:#fff">INTRARE CONFIRMATĂ, ORA ${oraRo(row.prezent_la)}</p>${info}</div>${locCard(loc)}`;
    } else {
      inner = `<div class="state s-warn"><p class="k" style="color:#fff">INVITAȚIE DEJA FOLOSITĂ</p>${info}<p class="muted mt">Intrare confirmată la ora <b>${oraRo(row.prezent_la)}</b>${row.prezent_de ? ` de ${esc(row.prezent_de)}` : ""}.</p></div>${locCard(loc)}`;
    }
  } else {
    inner = `<div class="state s-wait" id="st"><p class="k" style="color:#fff">INVITAȚIE VALIDĂ</p>${info}</div>
<button class="btn b-green mt" id="go" data-token="${token}">Confirmă intrarea</button>`;
  }
  inner += `<a class="btn b-ghost mt" href="/checkin">Panoul echipei</a><p class="muted mt" style="text-align:center">Conectat ca ${esc(s.who)}</p>`;
  return html(shell("Check-in", inner, `<script src="/assets/js/echipa.js"></script>`));
}

function loginPage(err, next) {
  const n = /^\/c\/[a-f0-9]{32}$/.test(next || "") ? next : "";
  return html(shell("Check-in JCI Brașov", `<p class="k">Acces echipă</p><h1>Check-in la intrare</h1>
${err ? '<div class="err">PIN greșit sau prea multe încercări. Încearcă din nou.</div>' : ""}
<form method="POST" action="/api/echipa/login" class="card">
<label class="lab" for="nume">NUMELE TĂU</label><input id="nume" name="nume" autocomplete="name" placeholder="ex. Alexandra" class="mt" required maxlength="40">
<label class="lab" for="pin" style="display:block;margin-top:18px">PIN</label><input id="pin" name="pin" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" class="mt" required>
<input type="hidden" name="next" value="${n}"><button class="btn b-blue mt" type="submit">Intră</button></form>
<p class="muted mt">După conectare, scanează QR-urile cu camera telefonului. Folosește același browser în care te-ai conectat.</p>`));
}

function dashboardPage(s) {
  return html(shell("Check-in Beyond the Initiative", `<p class="k">Panoul echipei</p><h1>Check-in</h1>
<div class="card"><div class="row"><div><p class="lab">AU INTRAT</p><p class="big" id="pz">0</p></div><div><p class="lab">ÎNSCRIȘI</p><p class="big" id="ins" style="color:#B9BBD6">0</p></div></div>
<div class="bar"><i id="bar" style="width:0"></i></div>
<div class="row mt"><div><p class="lab">INVITAȚII TRIMISE</p><p class="val" style="color:#fff" id="tr">0</p></div><div><p class="lab">AU CONFIRMAT PRIMIREA</p><p class="val" style="color:#fff" id="cf">0</p></div></div><p class="muted mt" id="upd">Se actualizează automat.</p></div>
<div class="card mt"><p class="lab">BLOCURI, CÂȚI AU PRIMIT ECUSON</p><p class="val" style="color:#fff" id="blk">Nimeni încă.</p></div>
<div class="card mt"><p class="lab">CAUTĂ DUPĂ NUME, EMAIL SAU TELEFON</p><input id="q" class="mt" placeholder="ex. Popescu" autocomplete="off" enterkeyhint="search"><div id="rez"></div></div>
<div class="card mt"><p class="lab">ULTIMELE INTRĂRI</p><div id="ult"><p class="muted mt">Nimeni încă.</p></div></div>
<a class="btn b-blue mt" href="/checkin/apeluri">Apeluri și contacte</a>
<a class="btn b-ghost mt" href="/api/echipa/export.csv">Descarcă lista de prezență (Excel)</a>
<form method="POST" action="/api/echipa/logout"><button class="btn b-ghost mt" type="submit">Deconectare (${esc(s.who)})</button></form>`,
    `<script src="/assets/js/echipa.js"></script>`));
}

// ---------- confirmarea primirii invitației (butonul din email) ----------
// GET afișează pagina, iar confirmarea se face prin POST (din buton sau automat, prin assets/js/confirma.js),
// ca scanerele de linkuri ale unor servere de email să nu confirme în locul persoanei.
async function confirmReceipt(request, env, token) {
  const row = await findByToken(env, token);
  if (!row) return html(shell("Invitație negăsită", `<h1>Invitația nu a fost găsită</h1><p class="muted">Verificați linkul primit sau scrieți-ne la contact@jci-brasov.com.</p>`), 404);
  const en = row.limba === "en";
  if (request.method === "POST") {
    if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
    await env.DB.prepare("UPDATE inscrieri SET primire_confirmata=datetime('now') WHERE id=? AND primire_confirmata IS NULL").bind(row.id).run();
    return Response.redirect(new URL(`/confirma/${token}`, request.url).toString(), 303);
  }
  const done = !!row.primire_confirmata || (await env.DB.prepare("SELECT primire_confirmata FROM inscrieri WHERE id=?").bind(row.id).first()).primire_confirmata;
  const T = en
    ? { k: "Beyond the Initiative", h1: "Thank you, see you on 26 November", p: "We have recorded that you received your invitation. Your seat is confirmed.", h0: "Confirm receipt of your invitation", b: "I confirm I received the invitation", t: "Open your QR ticket", i: "Thursday, 26 November 2026, 17:00, CATTIA Brașov, Strada Institutului 35" }
    : { k: "Beyond the Initiative", h1: "Vă mulțumim, ne vedem pe 26 noiembrie", p: "Am înregistrat că ați primit invitația. Locul dumneavoastră este confirmat.", h0: "Confirmați primirea invitației", b: "Confirm primirea invitației", t: "Deschideți biletul cu cod QR", i: "Joi, 26 noiembrie 2026, ora 17:00, CATTIA Brașov, Strada Institutului 35" };
  const inner = done
    ? `<p class="k">${T.k}</p><h1>${T.h1}</h1><div class="state s-ok"><p class="name" style="color:#fff">${esc(row.nume)}</p><p class="muted mt">${T.p}</p></div>
<p class="muted mt">${T.i}</p><a class="btn b-blue mt" href="/bilet/${token}">${T.t}</a>`
    : `<p class="k">${T.k}</p><h1>${T.h0}</h1><div class="card"><p class="name" style="color:#fff">${esc(row.nume)}</p><p class="muted mt">${T.i}</p></div>
<form method="POST" action="/confirma/${token}" id="cf-form"><button class="btn b-green mt" type="submit">${T.b}</button></form>
<a class="btn b-ghost mt" href="/bilet/${token}">${T.t}</a>`;
  return html(shell(en ? "Confirm receipt" : "Confirmare invitație", inner, done ? "" : `<script src="/assets/js/confirma.js"></script>`));
}
