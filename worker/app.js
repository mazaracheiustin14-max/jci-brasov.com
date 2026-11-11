// JCI Business: aplicația pentru membri, la /app. Datele stau în D1 (tabelele app_*), iar accesul se verifică aici, pe server.
//  - Intrare cu cod de membru (generat de președintele filialei; conturile de conducere le creează administratorul tehnic și președintele național) sau cu cheia moderatorului.
//  - Sesiune în cookie HttpOnly (Path=/api/app), stocată în D1 doar ca amprentă SHA-256.
//  - Reguli: membrii văd directorul; conducerea unei filiale vede doar filiala ei; administratorul tehnic (mod) și președintele național
//    (national) nu văd datele interne ale filialelor, doar structura (filiale, președinți). Rolurile se schimbă doar prin /api/app/admin.
//  - Un membru a cărui valabilitate a expirat de peste 3 luni este exclus automat (nu mai primește date).
// Aplicația nu face legătura înapoi spre site; singura legătură este butonul de pe pagina Echipa.

const COOKIE = "jci_app";
const SESSION_DAYS = 60;
const MOD_SESSION_DAYS = 14;
const MAX_SESSIONS = 5;
const CODE_DAYS = 14;
const SEED_BRANCHES = ["Brașov", "Cluj", "București"];
const ROLES = ["national", "president", "treasurer", "board"];
const DEFAULT_TITLE = { national: "Președinte național", president: "Președinte", treasurer: "Vicepreședinte trezorier", board: "Conducere" };
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
  if (!row) return "none";
  if (row.excluded) return "excluded"; // suspendat de președinte
  if (!row.active) return "none";
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
    schemaReady = (async () => {
      await env.DB.batch(q.map((s) => env.DB.prepare(s)));
      // coloana de suspendare, într-un pas separat; dacă există deja, eroarea se ignoră
      try { await env.DB.prepare("ALTER TABLE app_state ADD COLUMN excluded INTEGER NOT NULL DEFAULT 0").run(); }
      catch (e) { if (!/duplicate column/i.test(String(e && e.message))) throw e; }
      // lista filialelor: la prima pornire se pun cele trei existente
      const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM app_docs WHERE path='branchlist'").first();
      if (!c || !c.n) {
        const now = new Date().toISOString();
        for (const name of SEED_BRANCHES) {
          await env.DB.prepare("INSERT OR IGNORE INTO app_docs (path, id, data, at, by_user) VALUES ('branchlist', ?, ?, ?, 'sistem')")
            .bind(slugOf(name), JSON.stringify({ name, createdAt: now, createdBy: "sistem" }), now).run();
        }
        await bump(env, "branchlist");
      }
    })().catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

// ---------- filiale ----------
const slugOf = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
let branchCache = null; // { at, list }
async function getBranches(env) {
  const now = Date.now();
  if (branchCache && now - branchCache.at < 30000) return branchCache.list;
  const r = await env.DB.prepare("SELECT data FROM app_docs WHERE path='branchlist'").all();
  const list = [];
  for (const x of (r.results || [])) { try { const o = JSON.parse(x.data); if (o && typeof o.name === "string" && o.name) list.push(o.name); } catch (e) { /* ignorat */ } }
  list.sort((a, b) => a.localeCompare(b, "ro"));
  branchCache = { at: now, list };
  return list;
}

// ---------- căi și reguli ----------
function parsePath(p, branches) {
  if (typeof p !== "string" || p.length > 120) return null;
  if (p === "profiles" || p === "badges" || p === "roles" || p === "audit" || p === "claims" || p === "branchlist") return { kind: p };
  let m = /^data\/users\/([A-Za-z0-9_-]{1,64})$/.exec(p);
  if (m) return { kind: "private", uid: m[1] };
  m = /^branches\/([^/]+)\/([a-z]+)$/.exec(p);
  if (m && branches.includes(m[1]) && COLLS.includes(m[2])) return { kind: "branch", b: m[1], coll: m[2] };
  return null;
}
const inApp = (u) => u && (u.mod || u.state === "active" || u.state === "grace");
const membersPath = (b) => "branches/" + b + "/members";
// funcții de conducere legate de o filială (mod și national nu au niciodată filială de conducere)
const presOf = (u, b) => u.role === "president" && !!u.branch && u.branch === b;
const leadOf = (u, b) => (u.role === "president" || u.role === "treasurer") && !!u.branch && u.branch === b;
const boardOf = (u, b) => (u.role === "president" || u.role === "treasurer" || u.role === "board") && !!u.branch && u.branch === b;

function canRead(u, pp) {
  if (!inApp(u)) return false;
  switch (pp.kind) {
    case "profiles": case "badges": case "roles": case "branchlist": return true;
    case "audit": return u.mod || u.role === "national" || u.role === "president" || u.role === "treasurer";
    case "private": return pp.uid === u.id;
    case "branch":
      if (pp.coll === "codes") return false;
      if (pp.coll === "donations" || pp.coll === "expenses") return boardOf(u, pp.b);
      return leadOf(u, pp.b); // members, fees, settings
    default: return false;
  }
}
function canWrite(u, pp, id, del) {
  if (!inApp(u)) return false;
  switch (pp.kind) {
    case "profiles": return (id === u.id && !u.mod) || (u.mod && del);
    case "audit": return (u.role === "president" || u.role === "treasurer") && !del;
    case "private": return pp.uid === u.id && !u.mod;
    case "branch":
      if (del) return false;
      if (pp.coll === "members" || pp.coll === "settings") return presOf(u, pp.b);
      if (pp.coll === "fees" || pp.coll === "donations" || pp.coll === "expenses") return leadOf(u, pp.b);
      return false; // codes
    default: return false; // roles, branchlist, badges: doar serverul, prin /api/app/admin
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
  if (s.user_id === "mod") return { id: "mod", mod: true, state: "active", role: "mod", title: "Administrator", branch: "", hash: h };
  const st = await env.DB.prepare("SELECT branch, valid_until, active, excluded FROM app_state WHERE member_id=?").bind(s.user_id).first();
  const rr = await env.DB.prepare("SELECT data FROM app_docs WHERE path='roles' AND id=?").bind(s.user_id).first();
  const own = st ? st.branch : "";
  let role = "member", title = "Membru";
  if (rr) {
    try {
      const o = JSON.parse(rr.data);
      // funcțiile de filială contează doar dacă filiala din rol coincide cu filiala omului
      if (ROLES.includes(o.role) && (o.role === "national" || (own && o.branch === own))) {
        role = o.role;
        title = typeof o.title === "string" && o.title.trim() ? o.title.trim().slice(0, 60) : DEFAULT_TITLE[o.role];
      }
    } catch (e) { /* rol invalid: rămâne membru */ }
  }
  return { id: s.user_id, mod: false, state: stateOf(st), reason: st && st.excluded ? "manual" : "expired", role, title, branch: own, ownBranch: own, validUntil: st ? st.valid_until : "", hash: h };
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
  // membrul nu e în această filială: se șterge doar starea legată de ea (un id din altă filială rămâne neatins)
  if (!m) { await env.DB.prepare("DELETE FROM app_state WHERE member_id=? AND branch=?").bind(memberId, b).run(); return; }
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
  await env.DB.prepare("INSERT INTO app_state (member_id, branch, valid_until, active, excluded) VALUES (?,?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET branch=excluded.branch, valid_until=excluded.valid_until, active=excluded.active, excluded=excluded.excluded")
    .bind(memberId, b, vu, m.userId ? 1 : 0, m.excluded ? 1 : 0).run();
  await bump(env, "badges");
}
async function auditLog(env, by, byName, path, docId, action, summary, branch) {
  const id = randHex(12);
  await putDoc(env, "audit", id, { at: new Date().toISOString(), by, byName, path, docId, action, summary, branch: branch || "", changes: [] }, by);
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
  if (u.state === "excluded") return fail(403, "Acces suspendat.", { excluded: true, reason: u.reason, validUntil: u.validUntil, branch: u.ownBranch });
  if (!inApp(u)) return fail(401, "Neautentificat.");

  if (p === "/api/app/me" && request.method === "GET") return me(env, u);
  if (p === "/api/app/pull" && request.method === "POST") return pull(env, u, body);
  if (p === "/api/app/write" && request.method === "POST") return write(env, u, body);
  if (p === "/api/app/code" && request.method === "POST") return makeCode(env, u, body);
  if (p === "/api/app/admin" && request.method === "POST") return admin(env, u, body);
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
  if (m.excluded) return fail(403, "Acces suspendat.", { excluded: true, reason: "manual", validUntil: m.validUntil || "", branch: c.branch });
  // starea după recalculare, înainte să consumăm codul
  const fut = Object.assign({}, m);
  if (!fut.validUntil) fut.validUntil = defaultValid();
  let vu = fut.validUntil;
  const fees = await env.DB.prepare("SELECT data FROM app_docs WHERE path=? AND json_extract(data,'$.memberId')=?").bind("branches/" + c.branch + "/fees", c.member_id).all();
  for (const r of (fees.results || [])) { try { const f = JSON.parse(r.data); if (!f.anulat && (f.state === "platita" || f.state === "avans" || f.state === "scutita")) { const e = parseInt(f.year, 10) + "-12-31"; if (e > vu) vu = e; } } catch (e) { /* ignorat */ } }
  if (stateOf({ active: 1, valid_until: vu }) === "excluded")
    return fail(403, "Acces suspendat.", { excluded: true, reason: "expired", validUntil: vu, branch: c.branch });
  const used = await env.DB.prepare("UPDATE app_codes SET used=? WHERE hash=? AND used IS NULL").bind(new Date().toISOString(), h).run();
  if (!used.meta || used.meta.changes !== 1) return bad();
  const first = !m.userId;
  if (first || !m.validUntil) {
    const mo = Object.assign({}, m, { userId: c.member_id, validUntil: m.validUntil || defaultValid() });
    await putDoc(env, path, c.member_id, mo, c.member_id);
  }
  await recomputeState(env, c.branch, c.member_id);
  const mname = String(m.name || "").slice(0, 100);
  await auditLog(env, c.member_id, mname, path, c.member_id, first ? "activate" : "relogin", (first ? "Cont activat prin cod: " : "Intrare cu un cod nou: ") + mname, c.branch);
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
  if (u.mod) return json({ id: "mod", isOwner: true, name: "Moderator", role: "mod", title: "Administrator" });
  const m = await getDoc(env, membersPath(u.ownBranch), u.id);
  return json({ id: u.id, isOwner: false, name: m ? String(m.name || "") : "", state: u.state, validUntil: u.validUntil, branch: u.ownBranch, role: u.role, title: u.title });
}

async function pull(env, u, body) {
  const paths = Array.isArray(body.paths) ? body.paths.slice(0, 40) : [];
  const revs = body.revs && typeof body.revs === "object" ? body.revs : {};
  const out = { rev: {}, data: {}, errors: {} };
  const known = [];
  const branches = await getBranches(env);
  for (const p of paths) {
    const pp = parsePath(p, branches);
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
      const r = await env.DB.prepare("SELECT member_id, branch, valid_until, excluded FROM app_state WHERE active=1").all();
      // ceilalți membri văd doar dacă insigna e activă; data de valabilitate o văd titularul și președintele sau trezorierul filialei lui
      rows = (r.results || []).map((x) => {
        const susp = x.excluded === 1;
        const o = { id: x.member_id, verified: true, active: !susp && (x.valid_until ? x.valid_until >= t : true), excluded: susp || (x.valid_until ? addMonths(x.valid_until, 3) < t : false), branch: x.branch };
        if (x.member_id === u.id || leadOf(u, x.branch)) o.validUntil = x.valid_until || "";
        return o;
      });
    } else if (pp.kind === "roles") {
      // numele vine din evidența filialei din rol: conducerea e publică în aplicație, restul evidenței nu
      const r = await env.DB.prepare("SELECT r.id AS id, r.data AS data, m.data AS mdata FROM app_docs r LEFT JOIN app_docs m ON m.id = r.id AND m.path = 'branches/' || json_extract(r.data,'$.branch') || '/members' WHERE r.path='roles'").all();
      for (const x of (r.results || [])) {
        try {
          const o = JSON.parse(x.data); if (!ROLES.includes(o.role)) continue;
          o.id = x.id; o.name = "";
          if (x.mdata) { try { o.name = String(JSON.parse(x.mdata).name || "").slice(0, 100); } catch (e) { /* fără nume */ } }
          rows.push(o);
        } catch (e) { /* ignorat */ }
      }
    } else if (pp.kind === "profiles") {
      // profilurile celor excluși dispar din director, pentru oricine în afară de titular
      const r = await env.DB.prepare("SELECT d.id AS id, d.data AS data, s.valid_until AS vu, s.active AS act, s.excluded AS ex FROM app_docs d LEFT JOIN app_state s ON s.member_id = d.id WHERE d.path='profiles'").all();
      for (const x of (r.results || [])) {
        const st = stateOf(x.act == null && x.ex == null ? null : { active: x.act, valid_until: x.vu, excluded: x.ex });
        if (st === "none" || st === "excluded") { if (x.id !== u.id) continue; }
        try {
          const o = JSON.parse(x.data); o.id = x.id;
          // fără acordul pentru director, profilul îl văd doar titularul și președintele sau trezorierul filialei lui
          const inDir = !!(o.consent && o.consent.directory);
          if (!inDir && x.id !== u.id && !leadOf(u, String(o.branch || ""))) continue;
          rows.push(o);
        } catch (e) { /* ignorat */ }
      }
    } else {
      const q = pp.kind === "audit"
        ? "SELECT id, data FROM app_docs WHERE path=? ORDER BY at DESC LIMIT 1500"
        : "SELECT id, data FROM app_docs WHERE path=?";
      const r = await env.DB.prepare(q).bind(p).all();
      // jurnalul: mod și national văd doar intrările de structură; președintele și trezorierul văd filiala lor și propriile acțiuni
      const auditStruct = pp.kind === "audit" && (u.mod || u.role === "national");
      const auditPrefix = "branches/" + u.branch + "/";
      const hideDonor = pp.kind === "branch" && pp.coll === "donations" && !leadOf(u, pp.b);
      for (const x of (r.results || [])) {
        try {
          const o = JSON.parse(x.data); o.id = x.id;
          if (pp.kind === "audit") {
            const ap = String(o.path || "");
            if (auditStruct) { if (ap !== "roles" && ap !== "branchlist") continue; }
            else if (o.by !== u.id && !ap.startsWith(auditPrefix) && !(ap === "roles" && o.branch === u.branch)) continue;
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
  const pp = parsePath(path, await getBranches(env));
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
  } else if (pp.kind === "audit") {
    const ex = await getDoc(env, "audit", id);
    if (ex) return fail(403, "Jurnalul nu se modifică.");
    const own = "branches/" + u.branch + "/";
    if (!str(d.path, 120).startsWith(own)) d.path = own;
    d = { at: new Date().toISOString(), by: u.id, byName: str(d.byName, 100), path: str(d.path, 120), branch: u.branch, docId: str(d.docId, 64), action: str(d.action, 40), summary: str(d.summary, 300), changes: Array.isArray(d.changes) ? d.changes.slice(0, 12).map((c) => ({ f: str(c && c.f, 40), o: str(c && c.o, 60), n: str(c && c.n, 60) })) : [] };
  } else if (pp.kind === "branch") {
    if (pp.coll === "members") {
      const ex = await getDoc(env, path, id);
      // un identificator aparține unei singure filiale: altfel un președinte ar putea „muta” la el contul cuiva din altă filială
      const owner = await env.DB.prepare("SELECT branch FROM app_state WHERE member_id=?").bind(id).first();
      if (owner && owner.branch !== pp.b) return fail(403, "Acest identificator aparține altei filiale.");
      d.name = str(d.name, 100).trim();
      if (!d.name) return fail(400, "Completează numele.");
      d.branch = pp.b;
      d.userId = ex && ex.userId ? ex.userId : ""; // activarea o face doar serverul, prin cod
      // suspendarea o face doar serverul, prin operația exclude
      delete d.excluded; delete d.excludedAt; delete d.excludedBy;
      if (ex && ex.excluded) { d.excluded = true; d.excludedAt = ex.excludedAt; d.excludedBy = ex.excludedBy; }
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

// cod de unică folosință; un singur cod activ pe membru
async function issueCode(env, createdBy, b, mid) {
  const code = genCode(); const h = await sha256("jci-app-code:" + code);
  const exp = addDays(today(), CODE_DAYS);
  await env.DB.prepare("DELETE FROM app_codes WHERE member_id=? AND used IS NULL").bind(mid).run();
  await env.DB.prepare("INSERT INTO app_codes (hash, member_id, branch, created_by, created, expires) VALUES (?,?,?,?,?,?)").bind(h, mid, b, createdBy, today(), exp).run();
  return { code, expires: exp };
}
async function actorName(env, u) {
  if (u.mod) return "Administrator";
  const m = await getDoc(env, membersPath(u.ownBranch), u.id);
  return m ? String(m.name || "").slice(0, 100) : "";
}

async function makeCode(env, u, body) {
  const b = body.branch, mid = body.memberId;
  if (!(await getBranches(env)).includes(b) || !ID_RE.test(String(mid || ""))) return fail(400, "Cerere invalidă.");
  if (!presOf(u, b)) return fail(403, "Codurile le generează președintele filialei.");
  const path = membersPath(b);
  const m = await getDoc(env, path, mid);
  if (!m) return fail(404, "Membrul nu există.");
  if (m.excluded) return fail(400, "Membrul este exclus din aplicație.");
  const { code, expires } = await issueCode(env, u.id, b, mid);
  await auditLog(env, u.id, await actorName(env, u), path, mid, "code", "Cod de înscriere generat pentru " + String(m.name || "").slice(0, 100), b);
  return json({ ok: true, code, expires });
}

// ---------- operații de structură ----------
const NAME_RE = /^[\p{L}\p{N} -]+$/u;
const trimName = (v) => String(v).trim().replace(/ {2,}/g, " ");
const ROLE_LEAD = ["national", "president", "treasurer", "board"];

async function rawRole(env, id) {
  const o = await getDoc(env, "roles", id);
  return o && ROLES.includes(o.role) ? o : null;
}
async function dropRole(env, id) {
  await env.DB.prepare("DELETE FROM app_docs WHERE path='roles' AND id=?").bind(id).run();
  await bump(env, "roles");
}
async function giveRole(env, id, role, branch, title, by) {
  await putDoc(env, "roles", id, { role, branch, title, since: today() }, by);
}
async function rolesWhere(env, role, branch) {
  const r = branch == null
    ? await env.DB.prepare("SELECT id FROM app_docs WHERE path='roles' AND json_extract(data,'$.role')=?").bind(role).all()
    : await env.DB.prepare("SELECT id FROM app_docs WHERE path='roles' AND json_extract(data,'$.role')=? AND json_extract(data,'$.branch')=?").bind(role, branch).all();
  return (r.results || []).map((x) => x.id);
}
// „alege persoana”: memberId existent și neexclus, sau name pentru un membru nou (creat abia după validări, cu ensureMember)
async function pickPerson(env, b, body) {
  if (body.memberId != null && body.memberId !== "") {
    const id = String(body.memberId);
    if (!ID_RE.test(id)) return { err: fail(400, "Cerere invalidă.") };
    const m = await getDoc(env, membersPath(b), id);
    if (!m) return { err: fail(404, "Persoana nu există în evidența filialei.") };
    if (m.excluded) return { err: fail(400, "Persoana este exclusă din aplicație.") };
    return { id, m, name: String(m.name || "").slice(0, 100) };
  }
  if (typeof body.name !== "string") return { err: fail(400, "Alege persoana sau completează numele.") };
  const name = trimName(body.name);
  if (name.length < 2 || name.length > 100) return { err: fail(400, "Numele trebuie să aibă între 2 și 100 de caractere.") };
  return { id: randHex(8), m: null, name };
}
async function ensureMember(env, b, pr, by) {
  if (pr.m) return;
  pr.m = { name: pr.name, branch: b, userId: "", validUntil: defaultValid() };
  await putDoc(env, membersPath(b), pr.id, pr.m, by);
  await recomputeState(env, b, pr.id);
}
// „întoarce cod”: doar dacă persoana nu are cont activat
async function codeIfNew(env, u, b, pr, out) {
  if (pr.m && pr.m.userId) return out;
  const c = await issueCode(env, u.id, b, pr.id);
  out.code = c.code; out.expires = c.expires;
  return out;
}
// ținta unei predări: cont activat, neexclus, neexpirat de peste 3 luni
const handoverOk = (st) => !!st && st.active === 1 && st.excluded !== 1 && stateOf(st) !== "excluded" && stateOf(st) !== "none";

async function admin(env, u, body) {
  const op = String(body.op || "");
  const branches = await getBranches(env);
  const by = u.id;
  const who = await actorName(env, u);
  const okJ = (o) => json(Object.assign({ ok: true }, o || {}));
  const nat = u.mod || u.role === "national";
  const rolePerson = (v) => (v && ID_RE.test(String(v)) ? String(v) : "");

  if (op === "setNational") {
    if (!u.mod) return fail(403, "Doar administratorul tehnic numește președintele național.");
    const b = String(body.branch || "");
    if (!branches.includes(b)) return fail(400, "Alege filiala.");
    const pr = await pickPerson(env, b, body); if (pr.err) return pr.err;
    await ensureMember(env, b, pr, by);
    for (const id of await rolesWhere(env, "national")) if (id !== pr.id) await dropRole(env, id);
    await giveRole(env, pr.id, "national", b, DEFAULT_TITLE.national, by);
    await auditLog(env, by, who, "roles", pr.id, "setNational", "Președinte național: " + pr.name, b);
    return okJ(await codeIfNew(env, u, b, pr, { memberId: pr.id, branch: b }));
  }

  if (op === "addBranch") {
    if (!nat) return fail(403, "Filialele le adaugă administratorul tehnic sau președintele național.");
    if (typeof body.name !== "string" || typeof body.presidentName !== "string") return fail(400, "Completează denumirea filialei și numele președintelui.");
    const name = trimName(body.name);
    if (name.length < 2 || name.length > 40 || !NAME_RE.test(name)) return fail(400, "Denumirea filialei are 2 până la 40 de caractere: litere, cifre, spațiu și cratimă.");
    const slug = slugOf(name);
    if (!slug) return fail(400, "Denumirea filialei nu este validă.");
    if (branches.some((x) => slugOf(x) === slug)) return fail(400, "Există deja o filială cu această denumire.");
    const pname = trimName(body.presidentName);
    if (pname.length < 2 || pname.length > 100) return fail(400, "Numele președintelui trebuie să aibă între 2 și 100 de caractere.");
    await putDoc(env, "branchlist", slug, { name, createdAt: new Date().toISOString(), createdBy: by }, by);
    branchCache = null;
    const pr = { id: randHex(8), m: null, name: pname };
    await ensureMember(env, name, pr, by);
    await giveRole(env, pr.id, "president", name, DEFAULT_TITLE.president, by);
    await auditLog(env, by, who, "branchlist", slug, "addBranch", "Filială nouă: " + name + ", președinte " + pname, name);
    return okJ(await codeIfNew(env, u, name, pr, { branch: name, memberId: pr.id }));
  }

  if (op === "setPresident") {
    if (!nat) return fail(403, "Președintele filialei îl schimbă administratorul tehnic sau președintele național.");
    const b = String(body.branch || "");
    if (!branches.includes(b)) return fail(400, "Alege filiala.");
    const pr = await pickPerson(env, b, body); if (pr.err) return pr.err;
    if (pr.m) { const r0 = await rawRole(env, pr.id); if (r0 && r0.role === "national") return fail(400, "Președintele național nu poate fi președinte de filială."); }
    await ensureMember(env, b, pr, by);
    for (const id of await rolesWhere(env, "president", b)) if (id !== pr.id) await dropRole(env, id);
    await giveRole(env, pr.id, "president", b, DEFAULT_TITLE.president, by);
    await auditLog(env, by, who, "roles", pr.id, "setPresident", "Președinte de filială: " + pr.name, b);
    return okJ(await codeIfNew(env, u, b, pr, { memberId: pr.id, branch: b }));
  }

  if (op === "leaderCode") {
    if (!nat) return fail(403, "Nu ai dreptul să generezi acest cod.");
    const mid = rolePerson(body.memberId);
    if (!mid) return fail(400, "Cerere invalidă.");
    const rr = await rawRole(env, mid);
    if (!rr) return fail(404, "Persoana nu are o funcție de conducere.");
    if (rr.role !== "national" && rr.role !== "president") return fail(403, "Nu ai dreptul să generezi codul acestei persoane.");
    if (!u.mod && rr.role !== "president") return fail(403, "Nu ai dreptul să generezi codul acestei persoane.");
    const b = String(rr.branch || "");
    const m = branches.includes(b) ? await getDoc(env, membersPath(b), mid) : null;
    if (!m) return fail(404, "Persoana nu există în evidența filialei.");
    if (m.excluded) return fail(400, "Persoana este exclusă din aplicație.");
    const c = await issueCode(env, by, b, mid);
    await auditLog(env, by, who, "roles", mid, "leaderCode", "Cod nou de intrare pentru " + String(m.name || "").slice(0, 100), b);
    return okJ({ memberId: mid, code: c.code, expires: c.expires });
  }

  if (op === "setRole") {
    if (u.role !== "president") return fail(403, "Funcțiile le numește președintele filialei.");
    const mid = rolePerson(body.memberId);
    const role = String(body.role || "");
    if (!mid || !["treasurer", "board", "member"].includes(role)) return fail(400, "Cerere invalidă.");
    if (mid === u.id) return fail(403, "Nu îți poți schimba propria funcție.");
    const m = await getDoc(env, membersPath(u.branch), mid);
    if (!m) return fail(404, "Membrul nu există în filiala ta.");
    const cur = await rawRole(env, mid);
    if (cur && (cur.role === "national" || cur.role === "president")) return fail(403, "Funcția acestei persoane nu se schimbă de aici.");
    const nm = String(m.name || "").slice(0, 100);
    if (role === "member") {
      if (cur) await dropRole(env, mid);
      await auditLog(env, by, who, "roles", mid, "setRole", "Funcție retrasă: " + nm, u.branch);
      return okJ();
    }
    if (m.excluded) return fail(400, "Membrul este exclus din aplicație.");
    let title = DEFAULT_TITLE[role];
    if (role === "board" || (body.title != null && body.title !== "")) {
      if (typeof body.title !== "string") return fail(400, "Completează titlul funcției.");
      const t = trimName(body.title);
      if (t.length < 2 || t.length > 60) return fail(400, "Titlul funcției trebuie să aibă între 2 și 60 de caractere.");
      title = t;
    }
    await giveRole(env, mid, role, u.branch, title, by);
    await auditLog(env, by, who, "roles", mid, "setRole", title + ": " + nm, u.branch);
    return okJ();
  }

  if (op === "handover") {
    if (!ROLE_LEAD.includes(u.role)) return fail(403, "Nu ai o funcție pe care să o predai.");
    const to = rolePerson(body.to);
    if (!to) return fail(400, "Alege persoana căreia îi predai funcția.");
    if (to === u.id) return fail(400, "Nu îți poți preda funcția ție însuți.");
    const st = await env.DB.prepare("SELECT branch, valid_until, active, excluded FROM app_state WHERE member_id=?").bind(to).first();
    if (!st) return fail(404, "Persoana nu există.");
    if (u.role !== "national" && st.branch !== u.branch) return fail(403, "Funcția se predă doar unui membru din aceeași filială.");
    if (!handoverOk(st)) return fail(400, "Persoana trebuie să aibă cont activat, neexclus și valabil.");
    const tr = await rawRole(env, to);
    if (tr && (tr.role === "national" || tr.role === "president")) return fail(400, "Persoana are deja o funcție de președinte.");
    const mine = await rawRole(env, u.id);
    const title = mine && typeof mine.title === "string" && mine.title ? mine.title : DEFAULT_TITLE[u.role];
    const tm = await getDoc(env, membersPath(st.branch), to);
    await giveRole(env, to, u.role, st.branch, title, by);
    await dropRole(env, u.id);
    await auditLog(env, by, who, "roles", to, "handover", title + " predată către " + String(tm && tm.name || "").slice(0, 100), st.branch);
    return okJ();
  }

  if (op === "exclude" || op === "reactivate") {
    if (u.role !== "president") return fail(403, "Excluderea o face președintele filialei.");
    const mid = rolePerson(body.memberId);
    if (!mid) return fail(400, "Cerere invalidă.");
    if (mid === u.id) return fail(403, "Nu te poți exclude pe tine însuți.");
    const path = membersPath(u.branch);
    const m = await getDoc(env, path, mid);
    if (!m) return fail(404, "Membrul nu există în filiala ta.");
    const nm = String(m.name || "").slice(0, 100);
    if (op === "exclude") {
      const cur = await rawRole(env, mid);
      if (cur && (cur.role === "national" || cur.role === "president")) return fail(403, "Această persoană nu poate fi exclusă de președintele filialei.");
      if (m.excluded) return fail(400, "Membrul este deja exclus.");
      await putDoc(env, path, mid, Object.assign({}, m, { excluded: true, excludedAt: new Date().toISOString(), excludedBy: by }), by);
      await recomputeState(env, u.branch, mid);
      // sesiunile rămân: orice cerere a celui exclus primește 403 cu reason "manual", iar aplicația îi arată ecranul de suspendare
      await env.DB.prepare("DELETE FROM app_codes WHERE member_id=? AND used IS NULL").bind(mid).run();
      if (cur) await dropRole(env, mid);
    } else {
      if (!m.excluded) return fail(400, "Membrul nu este exclus.");
      const d = Object.assign({}, m); delete d.excluded; delete d.excludedAt; delete d.excludedBy;
      await putDoc(env, path, mid, d, by);
      await recomputeState(env, u.branch, mid);
    }
    await bump(env, "profiles");
    // intrarea ține de evidența filialei, ca să o vadă conducerea ei și nu administratorul sau președintele național
    await auditLog(env, by, who, path, mid, op, (op === "exclude" ? "Exclus din aplicație: " : "Reactivat în aplicație: ") + nm, u.branch);
    return okJ();
  }

  if (op === "candidates") {
    const f = String(body.for || "");
    if (f === "handover") {
      if (!ROLE_LEAD.includes(u.role)) return fail(403, "Nu ai o funcție pe care să o predai.");
      const out = [];
      for (const b of (u.role === "national" ? branches : [u.branch])) {
        const r = await env.DB.prepare("SELECT d.id AS id, d.data AS data, s.valid_until AS valid_until, s.active AS active, s.excluded AS excluded FROM app_docs d JOIN app_state s ON s.member_id = d.id WHERE d.path=?").bind(membersPath(b)).all();
        for (const x of (r.results || [])) {
          if (x.id === u.id || !handoverOk(x)) continue;
          const tr = await rawRole(env, x.id);
          if (tr && (tr.role === "national" || tr.role === "president")) continue;
          try { out.push({ id: x.id, name: String(JSON.parse(x.data).name || ""), branch: b, active: true }); } catch (e) { /* ignorat */ }
        }
      }
      out.sort((a, c) => a.name.localeCompare(c.name, "ro"));
      return okJ({ list: out });
    }
    if (f === "president") {
      if (!nat) return fail(403, "Lista o văd administratorul tehnic și președintele național.");
      const b = String(body.branch || "");
      if (!branches.includes(b)) return fail(400, "Alege filiala.");
      const r = await env.DB.prepare("SELECT id, data FROM app_docs WHERE path=?").bind(membersPath(b)).all();
      const out = [];
      for (const x of (r.results || [])) {
        try { const m = JSON.parse(x.data); if (m.excluded) continue; out.push({ id: x.id, name: String(m.name || ""), branch: b, active: !!m.userId }); } catch (e) { /* ignorat */ }
      }
      out.sort((a, c) => a.name.localeCompare(c.name, "ro"));
      return okJ({ list: out });
    }
    return fail(400, "Cerere invalidă.");
  }

  return fail(400, "Operație necunoscută.");
}
