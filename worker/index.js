// JCI Brașov: servește site-ul static și primește formularele pe același domeniu (/api/form).
// Trimitere: 1) direct prin Cloudflare Email Routing, dacă variabila DEST e setată în Cloudflare
//            (adresă de destinație verificată în Email Routing); 2) altfel, prin FormSubmit, de pe server.
import { EmailMessage } from "cloudflare:email";
import { systemPrompt } from "./kb.js";

const SITE = "https://jci-brasov.com";
const FROM = "formular@jci-brasov.com";
const FORMSUBMIT = "https://formsubmit.co/ajax/contact@jci-brasov.com";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/inscriere") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
      return handleEventSignup(request, env);
    }
    if (url.pathname === "/api/stats") return handleStats(env);
    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
      return handleChat(request, env, ctx);
    }
    if (url.pathname === "/api/form") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
      return handleForm(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};

function safeNext(v, lang) {
  const fallback = lang === "en" ? "/en/multumim.html" : "/multumim.html";
  if (typeof v !== "string") return fallback;
  return /^\/(en\/)?multumim\.html$/.test(v) ? v : fallback;
}

function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/.{1,76}/g, "$&\r\n").trim();
}

async function handleForm(request, env) {
  const origin = request.headers.get("Origin");
  if (origin && !/^https:\/\/(www\.)?jci-brasov\.com$/.test(origin)) return new Response("Forbidden", { status: 403 });

  let data;
  try { data = await request.formData(); } catch { return new Response("Bad Request", { status: 400 }); }

  const next = safeNext(data.get("_next"), (data.get("_next") || "").startsWith("/en/") ? "en" : "ro");
  const redirect = () => Response.redirect(SITE + next, 303);

  if ((data.get("_honey") || "").toString().trim() !== "") return redirect(); // robot

  const email = (data.get("email") || "").toString().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return new Response("Adresa de email nu este validă.", { status: 400 });

  const subject = (data.get("_subject") || "Mesaj nou de pe jci-brasov.com").toString().slice(0, 150);
  const fields = [];
  for (const [k, v] of data.entries()) {
    if (k.startsWith("_") || typeof v !== "string") continue;
    fields.push([k.slice(0, 60), v.slice(0, 4000)]);
  }
  if (fields.length > 40) return new Response("Bad Request", { status: 400 });
  const body = fields.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\n--\nTrimis de pe ${SITE}${next.includes("/en/") ? "/en/" : "/"}`;

  // 1) Cloudflare Email Routing
  if (env.MAIL && env.DEST) {
    try {
      const raw = [
        `From: "Formular JCI Brasov" <${FROM}>`,
        `To: <${env.DEST}>`,
        `Reply-To: <${email}>`,
        `Subject: =?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(subject)))}?=`,
        `Message-ID: <${crypto.randomUUID()}@jci-brasov.com>`,
        `Date: ${new Date().toUTCString()}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        b64(body),
      ].join("\r\n");
      await env.MAIL.send(new EmailMessage(FROM, env.DEST, raw));
      return redirect();
    } catch (e) {
      console.log("email routing failed, falling back:", e && e.message);
    }
  }

  // 2) FormSubmit, apelat de pe server (vizitatorul nu trimite date către alt domeniu)
  const payload = Object.fromEntries(fields);
  payload._subject = subject;
  payload._replyto = email;
  payload._template = "table";
  payload._captcha = "false";
  try {
    const r = await fetch(FORMSUBMIT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Origin: SITE, Referer: SITE + "/" },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && String(j.success) === "true") return redirect();
    console.log("formsubmit:", r.status, JSON.stringify(j));
  } catch (e) {
    console.log("formsubmit error:", e && e.message);
  }
  return new Response(
    "Mesajul nu a putut fi trimis acum. Vă rugăm să ne scrieți la contact@jci-brasov.com sau să ne sunați la +40 790 827 426.",
    { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}


// ===== Înscrieri la Beyond the Initiative (D1: jci-brasov-inscrieri) =====
const EVENT = "beyond-2026";
const CAPACITY = 150;
const DEADLINE = Date.UTC(2026, 10, 24, 21, 59, 59); // 24 noiembrie 2026, 23:59 ora României
const PROFILES = ["Antreprenor", "Manager", "Angajat", "Student", "Freelancer sau consultant", "ONG sau sector public", "Altul",
  "Entrepreneur", "Employee", "Freelancer or consultant", "NGO or public sector", "Other"];

async function countRegistrations(env) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM inscrieri WHERE eveniment = ? AND status = 'confirmat'").bind(EVENT).first();
  return (r && r.n) || 0;
}

async function handleStats(env) {
  let count = 0;
  try { count = await countRegistrations(env); } catch (e) { console.log("stats:", e && e.message); }
  const body = { count, capacity: CAPACITY, left: Math.max(0, CAPACITY - count), closed: Date.now() > DEADLINE, deadline: new Date(DEADLINE).toISOString() };
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=20" } });
}

function clean(v, max) { return (typeof v === "string" ? v : "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max); }

async function handleEventSignup(request, env) {
  const origin = request.headers.get("Origin");
  if (origin && !/^https:\/\/(www\.)?jci-brasov\.com$/.test(origin)) return new Response("Forbidden", { status: 403 });
  let data;
  try { data = await request.formData(); } catch { return new Response("Bad Request", { status: 400 }); }
  const en = clean(data.get("limba"), 2) === "en";
  const base = SITE + (en ? "/en" : "");
  const ok = (status) => Response.redirect(`${base}/inscriere-confirmata?s=${status}`, 303);
  if (clean(data.get("_honey"), 100) !== "") return ok("confirmat");

  const f = {
    nume: clean(data.get("nume"), 120), email: clean(data.get("email"), 160).toLowerCase(), telefon: clean(data.get("telefon"), 40),
    companie: clean(data.get("companie"), 160), functie: clean(data.get("functie"), 120), profil: clean(data.get("profil"), 60),
    intrebare: clean(data.get("intrebare"), 1500), sursa: clean(data.get("sursa"), 80),
  };
  const fail = (msg) => new Response(msg, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (f.nume.length < 3) return fail(en ? "Please enter your full name." : "Vă rugăm să completați numele complet.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) return fail(en ? "Please enter a valid email address." : "Adresa de email nu este validă.");
  if (f.telefon.replace(/\D/g, "").length < 9) return fail(en ? "Please enter a valid phone number." : "Numărul de telefon nu este valid.");
  if (f.profil && !PROFILES.includes(f.profil)) f.profil = "";
  if (!data.get("acord")) return fail(en ? "Please accept the data processing terms." : "Este necesar acordul pentru prelucrarea datelor.");
  if (Date.now() > DEADLINE) return Response.redirect(`${base}/inscriere-confirmata?s=inchis`, 303);

  let status = "confirmat";
  try {
    const n = await countRegistrations(env);
    if (n >= CAPACITY) status = "asteptare";
    const res = await env.DB.prepare(
      "INSERT OR IGNORE INTO inscrieri (eveniment,nume,email,telefon,companie,functie,profil,intrebare,sursa,limba,acord_marketing,status,tara) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(EVENT, f.nume, f.email, f.telefon, f.companie, f.functie, f.profil, f.intrebare, f.sursa, en ? "en" : "ro",
      data.get("acord_marketing") ? 1 : 0, status, (request.cf && request.cf.country) || null).run();
    if (!res.meta || res.meta.changes === 0) return ok("deja");
  } catch (e) {
    console.log("d1 insert failed:", e && e.message);
    // dacă baza de date nu răspunde, nu pierdem înscrierea: ajunge oricum pe email
  }

  const lines = [
    ["Nume", f.nume], ["Email", f.email], ["Telefon", f.telefon], ["Companie", f.companie], ["Funcție", f.functie],
    ["Profil", f.profil], ["Întrebare pentru invitați", f.intrebare], ["De unde a aflat", f.sursa], ["Status", status], ["Limba", en ? "EN" : "RO"],
  ].filter(([, v]) => v);
  await notify(env, `Înscriere nouă Beyond the Initiative: ${f.nume}`, lines, f.email);
  return ok(status);
}

async function notify(env, subject, lines, replyTo) {
  const body = lines.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\n--\n${SITE}`;
  if (env.MAIL && env.DEST) {
    try {
      const raw = [
        `From: "Formular JCI Brasov" <${FROM}>`, `To: <${env.DEST}>`, `Reply-To: <${replyTo}>`,
        `Subject: =?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(subject)))}?=`,
        `Message-ID: <${crypto.randomUUID()}@jci-brasov.com>`, `Date: ${new Date().toUTCString()}`,
        "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64(body),
      ].join("\r\n");
      await env.MAIL.send(new EmailMessage(FROM, env.DEST, raw));
      return true;
    } catch (e) { console.log("notify email routing:", e && e.message); }
  }
  try {
    const payload = Object.fromEntries(lines);
    Object.assign(payload, { _subject: subject, _replyto: replyTo, _template: "table", _captcha: "false" });
    const r = await fetch(FORMSUBMIT, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Origin: SITE, Referer: SITE + "/" }, body: JSON.stringify(payload) });
    return r.ok;
  } catch (e) { console.log("notify formsubmit:", e && e.message); return false; }
}


// ===== Asistentul de pe site (Workers AI) =====
// Răspunde doar din worker/kb.js. Întrebările se păstrează anonim 90 de zile în D1 (chat_log), ca să îmbunătățim răspunsurile.
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const CHAT_PER_HOUR = 20;   // mesaje pe vizitator pe oră
const CHAT_PER_DAY = 600;   // plafon zilnic pe tot site-ul, ca să nu apară costuri neprevăzute
const FALLBACK = {
  ro: "Momentan nu pot răspunde. Ne poți scrie la contact@jci-brasov.com sau ne poți suna la +40 790 827 426. Pentru eveniment, înscrierea este pe /eveniment#rezerva.",
  en: "I can't answer right now. Please email contact@jci-brasov.com or call +40 790 827 426. To register for the event, go to /en/eveniment#rezerva.",
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

async function sha(str) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function roDate(lang) {
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ro-RO", { timeZone: "Europe/Bucharest", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
}

function cleanAnswer(t) {
  return String(t || "").replace(/·/g, ",").replace(/https?:\/\/(www\.)?jci-brasov\.com(?=\/)/g, "").trim().slice(0, 1800);
}

async function handleChat(request, env, ctx) {
  const origin = request.headers.get("Origin");
  if (origin && !/^https:\/\/(www\.)?jci-brasov\.com$/.test(origin) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return json({ error: "forbidden" }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: "bad request" }, 400); }
  const lang = body.lang === "en" ? "en" : "ro";
  const page = String(body.page || "").slice(0, 80);
  const history = Array.isArray(body.messages) ? body.messages : [];
  const msgs = history.slice(-8)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, m.role === "user" ? 500 : 900) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return json({ error: "bad request" }, 400);
  const question = msgs[msgs.length - 1].content;

  const ip = request.headers.get("CF-Connecting-IP") || "0";
  const day = new Date().toISOString().slice(0, 10);
  const who = await sha(ip + "|" + day + "|jci");

  // limitare abuz
  if (env.DB) {
    try {
      const r = await env.DB.prepare(
        "SELECT SUM(CASE WHEN ip=? AND creat > datetime('now','-1 hour') THEN 1 ELSE 0 END) AS h, COUNT(*) AS d FROM chat_log WHERE creat > datetime('now','start of day')"
      ).bind(who).first();
      if (r && (r.h || 0) >= CHAT_PER_HOUR) return json({ answer: lang === "en" ? "You have sent many questions in a short time. Please try again in an hour or email contact@jci-brasov.com." : "Ai trimis multe întrebări într-un timp scurt. Încearcă din nou peste o oră sau scrie-ne la contact@jci-brasov.com.", limited: true });
      if (r && (r.d || 0) >= CHAT_PER_DAY) return json({ answer: FALLBACK[lang], limited: true });
    } catch (e) { console.log("chat limit:", e && e.message); }
  }

  let seats = "";
  try {
    const n = await countRegistrations(env);
    const left = Math.max(0, CAPACITY - n);
    if (Date.now() > DEADLINE) seats = " Înscrierile la Beyond the Initiative s-au închis.";
    else if (n >= 20) seats = ` Locuri rămase acum la Beyond the Initiative: ${left} din ${CAPACITY}.`;
  } catch {}

  let answer = "", ok = 1;
  try {
    if (!env.AI) throw new Error("no AI binding");
    const out = await env.AI.run(MODEL, {
      messages: [{ role: "system", content: systemPrompt(lang, roDate(lang), seats) }, ...msgs],
      max_tokens: 380,
      temperature: 0.2,
    });
    answer = cleanAnswer(typeof out === "string" ? out : out && (out.response ?? (out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content)));
    if (!answer) throw new Error("empty answer");
  } catch (e) {
    console.log("chat ai:", e && e.message);
    answer = FALLBACK[lang]; ok = 0;
  }

  if (env.DB) {
    const save = env.DB.prepare("INSERT INTO chat_log (ip,limba,pagina,intrebare,raspuns,ok) VALUES (?,?,?,?,?,?)")
      .bind(who, lang, page, question, answer, ok).run()
      .then(() => (Math.random() < 0.02 ? env.DB.prepare("DELETE FROM chat_log WHERE creat < datetime('now','-90 days')").run() : null))
      .catch((e) => console.log("chat log:", e && e.message));
    if (ctx && ctx.waitUntil) ctx.waitUntil(save); else await save;
  }
  return json({ answer });
}
