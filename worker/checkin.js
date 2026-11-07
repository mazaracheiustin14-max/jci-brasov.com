// Check-in cu QR pentru Beyond the Initiative.
// Fiecare înscriere are un cod secret (coloana token). QR-ul de pe invitație duce la /c/<token>:
//  - pentru echipă (autentificată cu PIN pe /echipa), se deschide fișa de check-in;
//  - pentru oricine altcineva, se deschide biletul (/bilet/<token>), fără să confirme nimic.
// PIN-ul (hash + sare) și secretul de semnare a sesiunii stau în D1, tabelul setari.

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

  let m = p.match(/^\/bilet\/([a-f0-9]{32})\/?$/);
  if (m) return ticketPage(env, m[1]);

  m = p.match(/^\/confirma\/([a-f0-9]{32})\/?$/);
  if (m) return confirmReceipt(request, env, m[1]);

  m = p.match(/^\/c\/([a-f0-9]{32})\/?$/);
  if (m) {
    const s = await staffSession(request, env);
    if (!s) return Response.redirect(`${url.origin}/bilet/${m[1]}`, 302);
    return scanPage(env, m[1], s);
  }

  if (p === "/echipa" || p === "/echipa/") {
    const s = await staffSession(request, env);
    return s ? dashboardPage(s) : loginPage(url.searchParams.get("e") === "1", url.searchParams.get("n"));
  }

  if (p === "/api/echipa/login") {
    if (request.method !== "POST" || !sameOrigin(request)) return new Response("Forbidden", { status: 403 });
    if (await overLimit(request, env, "pin", 10, 30)) return Response.redirect(`${url.origin}/echipa?e=1`, 303);
    const f = await request.formData().catch(() => null);
    const pin = String((f && f.get("pin")) || "").replace(/\D/g, "").slice(0, 12);
    const who = String((f && f.get("nume")) || "").replace(/[^\p{L}\p{N} .-]/gu, "").trim().slice(0, 40);
    const next = String((f && f.get("next")) || "");
    const salt = await setting(env, "pin_salt"), hash = await setting(env, "pin_hash");
    if (!salt || !hash || !pin || !eqConst(await sha256(salt + ":" + pin), hash)) {
      return Response.redirect(`${url.origin}/echipa?e=1`, 303);
    }
    const dest = /^\/c\/[a-f0-9]{32}$/.test(next) ? next : "/echipa";
    return new Response(null, { status: 303, headers: { Location: url.origin + dest, "Set-Cookie": await makeSession(env, who), "Cache-Control": "no-store" } });
  }
  if (p === "/api/echipa/logout") {
    return new Response(null, { status: 303, headers: { Location: url.origin + "/echipa", "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } });
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
    return json({ error: "not found" }, 404);
  }
  return null;
}

// ---------- operații ----------
async function doCheckin(env, token, undo, s) {
  const row = await findByToken(env, token);
  if (!row) return json({ ok: false, error: "Cod necunoscut" }, 404);
  if (undo) {
    await env.DB.prepare("UPDATE inscrieri SET prezent_la=NULL, prezent_de=NULL WHERE id=?").bind(row.id).run();
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
  return json({ ok: true, nume: row.nume, ora: oraRo(new Date().toISOString().slice(0, 19).replace("T", " ")) });
}

async function stats(env) {
  await ensureTokens(env);
  const t = await env.DB.prepare(
    "SELECT SUM(CASE WHEN status='confirmat' THEN 1 ELSE 0 END) AS inscrisi, SUM(CASE WHEN prezent_la IS NOT NULL THEN 1 ELSE 0 END) AS prezenti, SUM(CASE WHEN status='asteptare' THEN 1 ELSE 0 END) AS asteptare, SUM(CASE WHEN status='confirmat' AND primire_confirmata IS NOT NULL THEN 1 ELSE 0 END) AS confirmari, SUM(CASE WHEN status='confirmat' AND invitatie_trimisa IS NOT NULL AND invitatie_trimisa NOT LIKE 'exclus%' AND invitatie_trimisa NOT LIKE 'eroare%' THEN 1 ELSE 0 END) AS trimise FROM inscrieri WHERE eveniment=?"
  ).bind(EVENT).first();
  const last = await env.DB.prepare(
    "SELECT nume, companie, prezent_la, prezent_de, token FROM inscrieri WHERE eveniment=? AND prezent_la IS NOT NULL ORDER BY prezent_la DESC LIMIT 12"
  ).bind(EVENT).all();
  return json({
    inscrisi: (t && t.inscrisi) || 0, confirmari: (t && t.confirmari) || 0, trimise: (t && t.trimise) || 0, prezenti: (t && t.prezenti) || 0, asteptare: (t && t.asteptare) || 0,
    ultimii: (last.results || []).map((r) => ({ nume: r.nume, companie: r.companie, ora: oraRo(r.prezent_la), de: r.prezent_de, token: r.token })),
  });
}

async function search(env, q) {
  q = q.trim().slice(0, 60);
  if (q.length < 2) return json({ rezultate: [] });
  await ensureTokens(env);
  const like = "%" + q.replace(/[%_]/g, "") + "%";
  const digits = q.replace(/\D/g, "");
  const r = await env.DB.prepare(
    "SELECT nume, email, telefon, companie, status, sursa, prezent_la, primire_confirmata, token FROM inscrieri WHERE eveniment=? AND (nume LIKE ? OR email LIKE ? OR companie LIKE ? OR (? <> '' AND replace(replace(replace(telefon,' ',''),'+',''),'-','') LIKE ?)) ORDER BY nume LIMIT 15"
  ).bind(EVENT, like, like, like, digits.length >= 4 ? digits : "", "%" + digits + "%").all();
  return json({
    rezultate: (r.results || []).map((x) => ({
      nume: x.nume, email: x.email, telefon: x.telefon, companie: x.companie, status: x.status,
      vip: (x.sursa || "").includes("VIP"), prezent: !!x.prezent_la, ora: oraRo(x.prezent_la), confirmat: !!x.primire_confirmata, token: x.token,
    })),
  });
}

async function exportCsv(env) {
  const r = await env.DB.prepare(
    "SELECT nume,email,telefon,companie,functie,profil,status,sursa,creat,invitatie_trimisa,primire_confirmata,prezent_la,prezent_de FROM inscrieri WHERE eveniment=? ORDER BY nume"
  ).bind(EVENT).all();
  const cell = (v) => {
    let s = String(v == null ? "" : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const head = ["Nume", "Email", "Telefon", "Companie", "Funcție", "Profil", "Status", "Sursa", "Înscris la (UTC)", "Invitație trimisă (UTC)", "Primire confirmată (UTC)", "Prezent", "Ora intrării", "Confirmat de"];
  const lines = [head.map(cell).join(";")];
  for (const x of r.results || []) {
    lines.push([x.nume, x.email, x.telefon, x.companie, x.functie, x.profil, x.status, x.sursa, x.creat, x.invitatie_trimisa, x.primire_confirmata,
      x.prezent_la ? "DA" : "NU", oraRo(x.prezent_la), x.prezent_de].map(cell).join(";"));
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
.bar{height:10px;background:rgba(255,255,255,.1);border-radius:99px;overflow:hidden;margin-top:14px}.bar i{display:block;height:100%;background:linear-gradient(90deg,#0097D7,#57BCBC)}
`;
function shell(title, inner, scripts = "") {
  return `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#130F2D"><title>${esc(title)}</title>
<link rel="icon" href="/assets/img/favicon-32.png"><style>${CSS}</style></head><body><div class="w">
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
  const inner = `<p class="k">${T.k}</p><h1>${T.h}</h1>
<div class="t"><div class="in"><p class="lab">${T.g}</p><p class="name">${esc(row.nume)}</p>${vip ? '<span class="vip">ACCES VIP</span>' : ""}
<div class="grid2"><div><p class="lab">${T.d}</p><p class="val">${T.dv}</p></div><div><p class="lab">${T.o}</p><p class="val">17:00</p></div></div>
<div class="mt"><p class="lab">${T.l}</p><p class="val">${T.lv}</p></div></div>
<hr class="sep"><div class="qr"><div id="qr" data-url="https://jci-brasov.com/c/${token}" role="img" aria-label="Cod QR de intrare"></div><p>${T.q}</p></div></div>
<p class="muted mt">${en ? "Everything offered at the Hillden stand is free. Drinks from the bar are paid separately." : "Tot ce se oferă la standul Hillden este gratuit. Consumația de la bar se achită separat."}</p>
<a class="btn b-ghost mt" href="/assets/beyond-the-initiative.ics">${en ? "Add to calendar" : "Adaugă în calendar"}</a>`;
  return html(shell(en ? "Your ticket" : "Biletul tău", inner, `<script src="/assets/js/qrcode.js"></script><script src="/assets/js/bilet.js"></script>`));
}

async function scanPage(env, token, s) {
  const row = await findByToken(env, token);
  if (!row) return html(shell("Cod necunoscut", `<div class="state s-warn"><p class="k" style="color:#fff">COD NECUNOSCUT</p><h1>Invitația nu există</h1><p class="muted">Caută persoana după nume.</p></div><a class="btn b-blue mt" href="/echipa">Înapoi la panou</a>`), 404);
  const vip = await isVip(env, row);
  const info = `<p class="name" style="color:#fff">${esc(row.nume)}</p>${row.companie ? `<p class="muted">${esc(row.companie)}</p>` : ""}${vip ? '<span class="vip">ACCES VIP</span>' : ""}`;
  let inner;
  if (row.status !== "confirmat" && row.status !== "test") {
    inner = `<div class="state s-warn"><p class="k" style="color:#fff">LISTĂ DE AȘTEPTARE</p>${info}<p class="muted mt">Persoana nu are loc confirmat.</p></div>`;
  } else if (row.prezent_la) {
    inner = `<div class="state s-warn"><p class="k" style="color:#fff">INVITAȚIE DEJA FOLOSITĂ</p>${info}<p class="muted mt">Intrare confirmată la ora <b>${oraRo(row.prezent_la)}</b>${row.prezent_de ? ` de ${esc(row.prezent_de)}` : ""}.</p></div>`;
  } else {
    inner = `<div class="state s-wait" id="st"><p class="k" style="color:#fff">INVITAȚIE VALIDĂ</p>${info}</div>
<button class="btn b-green mt" id="go" data-token="${token}">Confirmă intrarea</button>`;
  }
  inner += `<a class="btn b-ghost mt" href="/echipa">Panoul echipei</a><p class="muted mt" style="text-align:center">Conectat ca ${esc(s.who)}</p>`;
  return html(shell("Check-in", inner, `<script src="/assets/js/echipa.js"></script>`));
}

function loginPage(err, next) {
  const n = /^\/c\/[a-f0-9]{32}$/.test(next || "") ? next : "";
  return html(shell("Echipa JCI Brașov", `<p class="k">Acces echipă</p><h1>Check-in la intrare</h1>
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
<div class="card mt"><p class="lab">CAUTĂ DUPĂ NUME, EMAIL SAU TELEFON</p><input id="q" class="mt" placeholder="ex. Popescu" autocomplete="off" enterkeyhint="search"><div id="rez"></div></div>
<div class="card mt"><p class="lab">ULTIMELE INTRĂRI</p><div id="ult"><p class="muted mt">Nimeni încă.</p></div></div>
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
