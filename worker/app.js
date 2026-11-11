// JCI Business: aplicația pentru membri, la /app. Datele stau în D1 (tabelele app_*), iar accesul se verifică aici, pe server.
//  - Intrare cu cod de membru (generat de președinte; conturile de președinte le creează moderatorul) sau cu cheia moderatorului.
//  - Sesiune în cookie HttpOnly (Path=/api/app), stocată în D1 doar ca amprentă SHA-256.
//  - Reguli: membrii văd directorul; conducerea unei filiale vede doar filiala ei; moderatorul vede tot și atribuie rolurile.
//  - Un membru a cărui valabilitate a expirat de peste 3 luni este exclus automat (nu mai primește date).
// Aplicația nu face legătura înapoi spre site; singura legătură este butonul de pe pagina Echipa.

const COOKIE = "jci_app";
const SESSION_DAYS = 60;
const MOD_SESSION_DAYS = 14;
const MAX_SESSIONS = 5;
const CODE_DAYS = 14;
const BRANCHES = ["Brașov", "Cluj", "București"];
const ROLES = ["president", "treasurer", "national", "member"];
const COLLS = ["members", "fees", "donations", "expenses", "settings", "codes"];
const CODE_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_DOC = 6000;

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sha256(s) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(s))); }
function randHex(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return hex(a); }
function eqConst(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function genCode() {
  const a = new Uint8Array(12); crypto.getRandomValues(a);
  let o = ""; for (let i = 0; i < 12; i++) o += CODE_ALPHA[a[i] % 32]; // 256 % 32 = 0, fără părtinire
  return o;
}
const normCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
};
function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...HEADERS, ...extra } });
}
const fail = (status, error, more) => json({ error, ...(more || {}) }, status);

// ---------- date ----------
function today() { return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" }); }
function addMonths(ds, n) {
  const p = String(ds).split("-"); const y = +p[0]; const m = +p[1] - 1 + n; const d = +p[2];
  const ny = y + Math.floor(m / 12); const nm = ((m % 12) + 12) % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return ny + "-" + String(nm + 1).padStart(2, "0") + "-" + String(Math.min(d, last)).padStart(2, "0");
}
function addDays(ds, n) { const d = new Date(ds + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const defaultValid = () => today().slice(0, 4) + "-12-31";
function stateOf(row) { // none | active | grace | excluded
  if (!row || !row.active) return "none";
  const t = today(); const vu = row.valid_until || "";
  if (!vu) return "active";
  if (addMonths(vu, 3) < t) return "excluded";
  if (vu < t) return "grace";
  return "active";
}

// ---------- limitarea încercărilor greșite ----------
// Se numără doar eșecurile (tabelul rate_log al site-ului), ca membrii care se conectează
// de pe aceeași rețea, de exemplu la o adunare generală, să nu se blocheze între ei.
async function visitor(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "0";
  const day = new Date().toISOString().slice(0, 10);
  return (await sha256(ip + "|" + day + "|" + (env.HASH_SALT || "jci"))).slice(0, 24);
}
async function tooManyFails(request, env, bucket, perHour, perDay) {
  try {
    const r = await env.DB.prepare(
      "SELECT SUM(CASE WHEN creat > datetime('now','-1 hour') THEN 1 ELSE 0 END) AS h, COUNT(*) AS d FROM rate_log WHERE bucket=? AND ip=? AND creat > datetime('now','-1 day')"
    ).bind(bucket, await visitor(request, env)).first();
    return !!(r && ((r.h || 0) >= perHour || (r.d || 0) >= perDay));
  } catch (e) { console.log("app rate:", e && e.message); return false; }
}
async function noteFail(request, env, bucket) {
  try { await env.DB.prepare("INSERT INTO rate_log (bucket, ip) VALUES (?, ?)").bind(bucket, await visitor(request, env)).run(); }
  catch (e) { console.log("app rate:", e && e.message); }
}

// ---------- schema ----------
let schemaReady = null;
function ensureSchema(env) {
  if (!schemaReady) {
    const q = [
      "CREATE TABLE IF NOT EXISTS app_docs (path TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, at TEXT, by_user TEXT, PRIMARY KEY (path, id))",
      "CREATE TABLE IF NOT EXISTS app_meta (path TEXT PRIMARY KEY, rev INTEGER NOT NULL DEFAULT 0)",
      "CREATE TABLE IF NOT EXISTS app_sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created TEXT NOT NULL, expires TEXT NOT NULL)",
      "CREATE INDEX IF NOT EXISTS app_sessions_user ON app_sessions (user_id)",
      "CREATE TABLE IF NOT EXISTS app_codes (hash TEXT PRIMARY KEY, member_id TEXT NOT NULL, branch TEXT NOT NULL, created_by TEXT, created TEXT, expires TEXT NOT NULL, used TEXT)",
      "CREATE TABLE IF NOT EXISTS app_state (member_id TEXT PRIMARY KEY, branch TEXT NOT NULL, valid_until TEXT, active INTEGER NOT NULL DEFAULT 0)",
    ];
    schemaReady = env.DB.batch(q.map((s) => env.DB.prepare(s))).catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

// ---------- căi și reguli ----------
function parsePath(p) {
  if (typeof p !== "string" || p.length > 120) return null;
  if (p === "profiles" || p === "badges" || p === "roles" || p === "audit" || p === "claims") return { kind: p };
  let m = /^data\/users\/([A-Za-z0-9_-]{1,64})$/.exec(p);
  if (m) return { kind: "private", uid: m[1] };
  m = /^branches\/([^/]+)\/([a-z]+)$/.exec(p);
  if (m && BRANCHES.includes(m[1]) && COLLS.includes(m[2])) return { kind: "branch", b: m[1], coll: m[2] };
  return null;
}
const inApp = (u) => u && (u.mod || u.state === "active" || u.state === "grace");
const isLeaderRole = (u) => u.mod || u.role === "national" || u.role === "president" || u.role === "treasurer";
const branchLeader = (u, b) => u.mod || u.role === "national" || ((u.role === "president" || u.role === "treasurer") && u.branch === b);
const branchWriter = (u, b) => (u.role === "president" || u.role === "treasurer") && u.branch === b;

function canRead(u, pp) {
  if (!inApp(u)) return false;
  switch (pp.kind) {
    case "profiles": case "badges": case "roles": return true;
    case "audit": return isLeaderRole(u);
    case "private": return pp.uid === u.id;
    case "branch": return pp.coll !== "codes" && branchLeader(u, pp.b);
    default: return false;
  }
}
function canWrite(u, pp, id, del) {
  if (!inApp(u)) return false;
  switch (pp.kind) {
    case "profiles": return (id === u.id && !u.mod) || (u.mod && del);
    case "roles": return !!u.mod;
    case "audit": return isLeaderRole(u) && !del;
    case "private": return pp.uid === u.id && !u.mod;
    case "branch":
      if (pp.coll === "codes") return false;
      if (pp.coll === "members") return branchLeader(u, pp.b) && !del;
      if (pp.coll === "settings") return !!(u.mod || u.role === "national") && !del;
      return branchWriter(u, pp.b) && !del; // fees, donations, expenses: fără ștergeri, doar anulare
    default: return false;
  }
}

// ---------- sesiune ----------
function readCookie(request, name) {
  const c = request.headers.get("Cookie") || "";
  for (const part of c.split(";")) { const i = part.indexOf("="); if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim(); }
  return "";
}
function cookieHeader(token, days) {
  return COOKIE + "=" + token + "; Path=/api/app; Max-Age=" + (days * 86400) + "; HttpOnly; Secure; SameSite=Strict";
}
const clearCookie = () => COOKIE + "=; Path=/api/app; Max-Age=0; HttpOnly; Secure; SameSite=Strict";

async function getUser(request, env) {
  const tok = readCookie(request, COOKIE);
  if (!/^[a-f0-9]{64}$/.test(tok)) return null;
  const h = await sha256("jci-app-session:" + tok);
  const s = await env.DB.prepare("SELECT user_id, expires FROM app_sessions WHERE hash=?").bind(h).first();
  if (!s || s.expires < new Date().toISOString()) return null;
  if (s.user_id === "mod") return { id: "mod", mod: true, state: "active", role: "national", branch: "", hash: h };
  const st = await env.DB.prepare("SELECT branch, valid_until, active FROM app_state WHERE member_id=?").bind(s.user_id).first();
  const rr = await env.DB.prepare("SELECT data FROM app_docs WHERE path='roles' AND id=?").bind(s.user_id).first();
  let role = "member", rbranch = "";
  if (rr) { try { const o = JSON.parse(rr.data); if (ROLES.includes(o.role)) { role = o.role; rbranch = BRANCHES.includes(o.branch) ? o.branch : ""; } } catch (e) { /* rol invalid: rămâne membru */ } }
  return { id: s.user_id, mod: false, state: stateOf(st), role, branch: rbranch, ownBranch: st ? st.branch : "", validUntil: st ? st.valid_until : "", hash: h };
}
async function newSession(env, userId, days) {
  const tok = randHex(32); const h = await sha256("jci-app-session:" + tok);
  const now = new Date(); const exp = new Date(now.getTime() + days * 86400000);
  await env.DB.prepare("DELETE FROM app_sessions WHERE user_id=? AND hash NOT IN (SELECT hash FROM app_sessions WHERE user_id=? ORDER BY created DESC LIMIT ?)").bind(userId, userId, MAX_SESSIONS - 1).run();
  await env.DB.prepare("INSERT INTO app_sessions (hash, user_id, created, expires) VALUES (?,?,?,?)").bind(h, userId, now.toISOString(), exp.toISOString()).run();
  if (Math.random() < 0.05) env.DB.prepare("DELETE FROM app_sessions WHERE expires < ?").bind(now.toISOString()).run().catch(() => {});
  return tok;
}

// ---------- date: stare membri, revizii ----------
async function bump(env, path) {
  await env.DB.prepare("INSERT INTO app_meta (path, rev) VALUES (?,1) ON CONFLICT(path) DO UPDATE SET rev = rev + 1").bind(path).run();
}
async function getDoc(env, path, id) {
  const r = await env.DB.prepare("SELECT data FROM app_docs WHERE path=? AND id=?").bind(path, id).first();
  if (!r) return null;
  try { return JSON.parse(r.data); } catch (e) { return null; }
}
async function putDoc(env, path, id, obj, by) {
  await env.DB.prepare("INSERT INTO app_docs (path, id, data, at, by_user) VALUES (?,?,?,?,?) ON CONFLICT(path,id) DO UPDATE SET data=excluded.data, at=excluded.at, by_user=excluded.by_user")
    .bind(path, id, JSON.stringify(obj), new Date().toISOString(), by).run();
  await bump(env, path);
}
async function recomputeState(env, b, memberId) {
  const m = await getDoc(env, "branches/" + b + "/members", memberId);
  if (!m) { await env.DB.prepare("DELETE FROM app_state WHERE member_id=?").bind(memberId).run(); return; }
  let vu = typeof m.validUntil === "string" ? m.validUntil : "";
  const fees = await env.DB.prepare("SELECT data FROM app_docs WHERE path=? AND json_extract(data,'$.memberId')=?").bind("branches/" + b + "/fees", memberId).all();
  for (const r of (fees.results || [])) {
    let f; try { f = JSON.parse(r.data); } catch (e) { continue; }
    if (f.anulat) continue;
    if (f.state === "platita" || f.state === "avans" || f.state === "scutita") {
      const y = parseInt(f.year, 10);
      if (y >= 2020 && y <= 2100) { const e = y + "-12-31"; if (e > vu) vu = e; }
    }
  }
  await env.DB.prepare("INSERT INTO app_state (member_id, branch, valid_until, active) VALUES (?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET branch=excluded.branch, valid_until=excluded.valid_until, active=excluded.active")
    .bind(memberId, b, vu, m.userId ? 1 : 0).run();
  await bump(env, "badges");
}
async function auditLog(env, by, byName, path, docId, action, summary) {
  const id = randHex(12);
  await putDoc(env, "audit", id, { at: new Date().toISOString(), by, byName, path, docId, action, summary, changes: [] }, by);
}

// ---------- puncte de intrare ----------
export async function handleApp(request, env, url) {
  const p = url.pathname;
  if (!env.DB) return fail(503, "Baza de date nu este disponibilă.");
  try { await ensureSchema(env); } catch (e) { console.log("app schema:", e && e.message); return fail(503, "Baza de date nu este disponibilă."); }

  if (request.method === "POST") {
    const origin = request.headers.get("Origin");
    if (origin !== url.origin) return fail(403, "Cerere respinsă.");
    if (Number(request.headers.get("Content-Length") || 0) > 40000) return fail(413, "Cerere prea mare.");
  }
  let body = {};
  if (request.method === "POST") {
    try { const raw = await request.text(); body = raw.trim() ? JSON.parse(raw) : {}; } catch (e) { return fail(400, "Cerere invalidă."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "Cerere invalidă.");
  }

  if (p === "/api/app/login" && request.method === "POST") return login(request, env, body);
  if (p === "/api/app/modlogin" && request.method === "POST") return modLogin(request, env, body);

  const u = await getUser(request, env);
  if (!u) return fail(401, "Neautentificat.");
  if (p === "/api/app/logout" && request.method === "POST") {
    await env.DB.prepare("DELETE FROM app_sessions WHERE hash=?").bind(u.hash).run();
    return json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
  }
  if (u.state === "excluded") return fail(403, "Acces suspendat.", { excluded: true, validUntil: u.validUntil, branch: u.ownBranch });
  if (!inApp(u)) return fail(401, "Neautentificat.");

  if (p === "/api/app/me" && request.method === "GET") return me(env, u);
  if (p === "/api/app/pull" && request.method === "POST") return pull(env, u, body);
  if (p === "/api/app/write" && request.method === "POST") return write(env, u, body);
  if (p === "/api/app/code" && request.method === "POST") return makeCode(env, u, body);
  return fail(404, "Negăsit.");
}

async function login(request, env, body) {
  if (await tooManyFails(request, env, "applogin", 10, 40)) return fail(429, "Prea multe încercări greșite. Încearcă din nou peste o oră.");
  const code = normCode(body.code);
  const bad = async () => { await noteFail(request, env, "applogin"); return fail(400, "Cod invalid sau expirat. Cere președintelui filialei un cod nou."); };
  if (code.length !== 12) return bad();
  const h = await sha256("jci-app-code:" + code);
  const c = await env.DB.prepare("SELECT member_id, branch, expires, used FROM app_codes WHERE hash=?").bind(h).first();
  if (!c || c.used || c.expires < today()) return bad();
  const path = "branches/" + c.branch + "/members";
  const m = await getDoc(env, path, c.member_id);
  if (!m) return bad();
  // starea după recalculare, înainte să consumăm codul
  const fut = Object.assign({}, m);
  if (!fut.validUntil) fut.validUntil = defaultValid();
  let vu = fut.validUntil;
  const fees = await env.DB.prepare("SELECT data FROM app_docs WHERE path=? AND json_extract(data,'$.memberId')=?").bind("branches/" + c.branch + "/fees", c.member_id).all();
  for (const r of (fees.results || [])) { try { const f = JSON.parse(r.data); if (!f.anulat && (f.state === "platita" || f.state === "avans" || f.state === "scutita")) { const e = parseInt(f.year, 10) + "-12-31"; if (e > vu) vu = e; } } catch (e) { /* ignorat */ } }
  if (stateOf({ active: 1, valid_until: vu }) === "excluded")
    return fail(403, "Acces suspendat.", { excluded: true, validUntil: vu, branch: c.branch });
  const used = await env.DB.prepare("UPDATE app_codes SET used=? WHERE hash=? AND used IS NULL").bind(new Date().toISOString(), h).run();
  if (!used.meta || used.meta.changes !== 1) return bad();
  const first = !m.userId;
  if (first || !m.validUntil) {
    const mo = Object.assign({}, m, { userId: c.member_id, validUntil: m.validUntil || defaultValid() });
    await putDoc(env, path, c.member_id, mo, c.member_id);
  }
  await recomputeState(env, c.branch, c.member_id);
  if (first) await auditLog(env, c.member_id, String(m.name || "").slice(0, 100), path, c.member_id, "activate", "Cont activat prin cod: " + String(m.name || "").slice(0, 100));
  const tok = await newSession(env, c.member_id, SESSION_DAYS);
  return json({ ok: true }, 200, { "Set-Cookie": cookieHeader(tok, SESSION_DAYS) });
}

async function modLogin(request, env, body) {
  if (await tooManyFails(request, env, "appmod", 5, 15)) return fail(429, "Prea multe încercări greșite. Încearcă din nou peste o oră.");
  const key = String(body.key || "");
  const salt = await env.DB.prepare("SELECT valoare FROM setari WHERE cheie='app_mod_salt'").first();
  const hash = await env.DB.prepare("SELECT valoare FROM setari WHERE cheie='app_mod_hash'").first();
  const badKey = async () => { await noteFail(request, env, "appmod"); return fail(400, "Cheie invalidă."); };
  if (!salt || !hash || key.length < 8 || key.length > 80) return badKey();
  const calc = await sha256(salt.valoare + ":" + key);
  if (!eqConst(calc, hash.valoare)) return badKey();
  const tok = await newSession(env, "mod", MOD_SESSION_DAYS);
  return json({ ok: true }, 200, { "Set-Cookie": cookieHeader(tok, MOD_SESSION_DAYS) });
}

async function me(env, u) {
  if (u.mod) return json({ id: "mod", isOwner: true, name: "Moderator" });
  const m = await getDoc(env, "branches/" + u.ownBranch + "/members", u.id);
  return json({ id: u.id, isOwner: false, name: m ? String(m.name || "") : "", state: u.state, validUntil: u.validUntil, branch: u.ownBranch });
}

async function pull(env, u, body) {
  const paths = Array.isArray(body.paths) ? body.paths.slice(0, 40) : [];
  const revs = body.revs && typeof body.revs === "object" ? body.revs : {};
  const out = { rev: {}, data: {}, errors: {} };
  const known = [];
  for (const p of paths) {
    const pp = parsePath(p);
    if (!pp) { out.errors[p] = 400; continue; }
    if (pp.kind === "claims" || (pp.kind === "branch" && pp.coll === "codes")) { out.data[p] = []; out.rev[p] = 0; continue; }
    if (!canRead(u, pp)) { out.errors[p] = 403; continue; }
    known.push([p, pp]);
  }
  if (!known.length) return json(out);
  const ph = known.map(() => "?").join(",");
  const rv = await env.DB.prepare("SELECT path, rev FROM app_meta WHERE path IN (" + ph + ")").bind(...known.map((k) => k[0])).all();
  const cur = {}; for (const r of (rv.results || [])) cur[r.path] = r.rev;
  const t = today();
  for (const [p, pp] of known) {
    const rev = cur[p] || 0;
    out.rev[p] = rev;
    if (revs[p] === rev) continue; // neschimbat
    let rows = [];
    if (pp.kind === "badges") {
      const r = await env.DB.prepare("SELECT member_id, branch, valid_until FROM app_state WHERE active=1").all();
      // ceilalți membri văd doar dacă insigna e activă; data de valabilitate o văd titularul și conducerea filialei lui
      rows = (r.results || []).map((x) => {
        const o = { id: x.member_id, verified: true, active: x.valid_until ? x.valid_until >= t : true, excluded: x.valid_until ? addMonths(x.valid_until, 3) < t : false, branch: x.branch };
        if (x.member_id === u.id || branchLeader(u, x.branch)) o.validUntil = x.valid_until || "";
        return o;
      });
    } else if (pp.kind === "profiles") {
      // profilurile celor excluși dispar din director
      const r = await env.DB.prepare("SELECT d.id AS id, d.data AS data, s.valid_until AS vu, s.active AS act FROM app_docs d LEFT JOIN app_state s ON s.member_id = d.id WHERE d.path='profiles'").all();
      for (const x of (r.results || [])) {
        const st = stateOf({ active: x.act, valid_until: x.vu });
        if (st === "none" || st === "excluded") { if (x.id !== u.id && !u.mod) continue; }
        try {
          const o = JSON.parse(x.data); o.id = x.id;
          // fără acordul pentru director, profilul îl văd doar titularul și conducerea filialei lui
          const inDir = !!(o.consent && o.consent.directory);
          if (!inDir && x.id !== u.id && !branchLeader(u, String(o.branch || ""))) continue;
          rows.push(o);
        } catch (e) { /* ignorat */ }
      }
    } else {
      const q = pp.kind === "audit"
        ? "SELECT id, data FROM app_docs WHERE path=? ORDER BY at DESC LIMIT 1500"
        : "SELECT id, data FROM app_docs WHERE path=?";
      const r = await env.DB.prepare(q).bind(p).all();
      // jurnalul: moderatorul și rolul național văd tot; conducerea unei filiale vede doar filiala ei și propriile acțiuni
      const auditAll = pp.kind === "audit" && (u.mod || u.role === "national");
      const auditPrefix = "branches/" + u.branch + "/";
      const hideDonor = pp.kind === "branch" && pp.coll === "donations" && !branchWriter(u, pp.b);
      for (const x of (r.results || [])) {
        try {
          const o = JSON.parse(x.data); o.id = x.id;
          if (pp.kind === "audit") {
            if (!auditAll && o.by !== u.id && !String(o.path || "").startsWith(auditPrefix)) continue;
            if (rows.length >= 300) break;
          }
          if (hideDonor && !o.anonymous) o.donor = "";
          if (hideDonor && o.anonymous) o.donor = "Anonim";
          rows.push(o);
        } catch (e) { /* ignorat */ }
      }
    }
    out.data[p] = rows;
  }
  return json(out);
}

function cleanDoc(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const d = {}; for (const k of Object.keys(o)) { if (k === "id" || k === "__proto__" || k === "constructor") continue; d[k] = o[k]; }
  const s = JSON.stringify(d);
  if (s.length > MAX_DOC) return null;
  return d;
}

async function write(env, u, body) {
  const path = body.path, id = body.id, del = body.del === true;
  const pp = parsePath(path);
  if (!pp || !ID_RE.test(String(id || ""))) return fail(400, "Cerere invalidă.");
  if (!canWrite(u, pp, id, del)) return fail(403, "Nu ai dreptul să modifici aceste date.");
  if (del) {
    await env.DB.prepare("DELETE FROM app_docs WHERE path=? AND id=?").bind(path, id).run();
    await bump(env, path);
    if (pp.kind === "profiles") { /* starea contului nu se schimbă */ }
    return json({ ok: true });
  }
  let d = cleanDoc(body.data);
  if (!d) return fail(400, "Date invalide sau prea mari.");
  const str = (v, n) => String(v == null ? "" : v).slice(0, n);

  if (pp.kind === "profiles") {
    d.branch = u.ownBranch || "";
  } else if (pp.kind === "roles") {
    if (!ROLES.includes(d.role) || d.role === "member") return fail(400, "Rol invalid.");
    d = { role: d.role, branch: d.role === "national" ? "" : (BRANCHES.includes(d.branch) ? d.branch : ""), since: str(d.since, 10), until: str(d.until, 10) };
    if (d.role !== "national" && !d.branch) return fail(400, "Alege filiala.");
  } else if (pp.kind === "audit") {
    const ex = await getDoc(env, "audit", id);
    if (ex) return fail(403, "Jurnalul nu se modifică.");
    d = { at: new Date().toISOString(), by: u.id, byName: str(d.byName, 100), path: str(d.path, 120), docId: str(d.docId, 64), action: str(d.action, 40), summary: str(d.summary, 300), changes: Array.isArray(d.changes) ? d.changes.slice(0, 12).map((c) => ({ f: str(c && c.f, 40), o: str(c && c.o, 60), n: str(c && c.n, 60) })) : [] };
  } else if (pp.kind === "branch") {
    if (pp.coll === "members") {
      const ex = await getDoc(env, path, id);
      d.name = str(d.name, 100).trim();
      if (!d.name) return fail(400, "Completează numele.");
      d.branch = pp.b;
      d.userId = ex && ex.userId ? ex.userId : ""; // activarea o face doar serverul, prin cod
      if (d.validUntil != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.validUntil))) delete d.validUntil;
      if (ex && !(ex.userId) && body.data && body.data.userId) { /* ignorat: nu se leagă conturi de mână */ }
    } else if (pp.coll === "fees" || pp.coll === "donations" || pp.coll === "expenses") {
      d.branch = pp.b;
    }
  }
  await putDoc(env, path, id, d, u.id);
  if (pp.kind === "branch" && pp.coll === "members") await recomputeState(env, pp.b, id);
  if (pp.kind === "branch" && pp.coll === "fees" && d.memberId && ID_RE.test(String(d.memberId))) await recomputeState(env, pp.b, String(d.memberId));
  return json({ ok: true });
}

async function makeCode(env, u, body) {
  const b = body.branch, mid = body.memberId;
  if (!BRANCHES.includes(b) || !ID_RE.test(String(mid || ""))) return fail(400, "Cerere invalidă.");
  if (!(u.mod || (u.role === "president" && u.branch === b))) return fail(403, "Codurile le generează președintele filialei sau moderatorul.");
  const path = "branches/" + b + "/members";
  const m = await getDoc(env, path, mid);
  if (!m) return fail(404, "Membrul nu există.");
  const code = genCode(); const h = await sha256("jci-app-code:" + code);
  const exp = addDays(today(), CODE_DAYS);
  await env.DB.prepare("DELETE FROM app_codes WHERE member_id=? AND used IS NULL").bind(mid).run(); // un singur cod activ pe membru
  await env.DB.prepare("INSERT INTO app_codes (hash, member_id, branch, created_by, created, expires) VALUES (?,?,?,?,?,?)").bind(h, mid, b, u.id, today(), exp).run();
  let who = "Moderator";
  if (!u.mod) { const me0 = await getDoc(env, "branches/" + u.ownBranch + "/members", u.id); who = me0 ? String(me0.name || "").slice(0, 100) : ""; }
  await auditLog(env, u.id, who, path, mid, "code", "Cod de înscriere generat pentru " + String(m.name || "").slice(0, 100));
  return json({ ok: true, code, expires: exp });
}
