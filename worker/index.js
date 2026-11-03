// JCI Brașov: servește site-ul static și primește formularele pe același domeniu (/api/form).
// Trimitere: 1) direct prin Cloudflare Email Routing, dacă variabila DEST e setată în Cloudflare
//            (adresă de destinație verificată în Email Routing); 2) altfel, prin FormSubmit, de pe server.
import { EmailMessage } from "cloudflare:email";

const SITE = "https://jci-brasov.com";
const FROM = "formular@jci-brasov.com";
const FORMSUBMIT = "https://formsubmit.co/ajax/contact@jci-brasov.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
