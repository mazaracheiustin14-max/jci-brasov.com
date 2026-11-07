// Invitații automate pe email pentru Beyond the Initiative.
// Modelul „pull”: un Google Apps Script din contul Gmail al JCI Brașov întreabă la câteva minute
// GET /api/invitatii/de-trimis?key=..., trimite fiecare email din Gmail și confirmă cu POST /api/invitatii/trimis.
// Emailul (subiect, HTML, text simplu) se construiește aici, deci designul se schimbă fără a modifica scriptul din Gmail.
// /bilet/<cod>/qr.png servește codul QR ca imagine PNG (Gmail nu afișează SVG).
// Setări în D1 (tabelul setari): invit_key (cheia scriptului), invit_mod („test” sau „live”), invit_test (adrese permise în modul test).
import qrcode from "./qrcode.mjs";

const EVENT = "beyond-2026";
const SITE = "https://jci-brasov.com";
const BATCH = 15;

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
function eqConst(a, b) {
  a = String(a || ""); b = String(b || "");
  if (!a || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function setting(env, k) {
  const r = await env.DB.prepare("SELECT valoare FROM setari WHERE cheie=?").bind(k).first();
  return r ? r.valoare : null;
}

// ---------- PNG pentru QR ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  const td = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i++) td[i] = type.charCodeAt(i);
  td.set(data, 4);
  out.set(td, 4);
  dv.setUint32(8 + data.length, crc32(td));
  return out;
}
async function deflate(bytes) {
  const cs = new CompressionStream("deflate");
  const w = cs.writable.getWriter(); w.write(bytes); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
export async function qrPng(text, scale = 10, margin = 3) {
  const qr = qrcode(0, "M"); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), size = (n + margin * 2) * scale;
  const raw = new Uint8Array(size * (size + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size + 1)] = 0;
    const my = Math.floor(y / scale) - margin;
    for (let x = 0; x < size; x++) {
      const mx = Math.floor(x / scale) - margin;
      const dark = my >= 0 && my < n && mx >= 0 && mx < n && qr.isDark(my, mx);
      raw[y * (size + 1) + 1 + x] = dark ? 0 : 255;
    }
  }
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, size); dv.setUint32(4, size); ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", await deflate(raw)), chunk("IEND", new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ---------- emailul ----------
export function buildEmail(row) {
  const en = row.limba === "en";
  const t = row.token;
  const bilet = `${SITE}/bilet/${t}`;
  const qr = `${SITE}/bilet/${t}/qr.png`;
  const nume = esc(row.nume);
  const L = en ? {
    subject: "Your invitation to Beyond the Initiative, 26 November",
    pre: "Your seat is confirmed. Your personal QR code for the entrance is inside.",
    hi: `Dear ${nume},`,
    p1: "Thank you for registering for <b>Beyond the Initiative</b>, the evening on which JCI Brașov becomes a full member organisation of JCI Romania. Your seat is confirmed.",
    kd: "DATE", vd: "Thursday, 26 November 2026", ko: "TIME", vo: "17:00", kl: "VENUE", vl: "CATTIA Brașov, Strada Institutului 35",
    prog: "Two panels with leaders from business and public administration, two Blitz Networking sessions and at least 24 new business contacts.",
    qrt: "Your personal entry code", qrp: "Show this code at the entrance. It is personal and valid once.",
    btn: "Open your ticket", cbtn: "I confirm I received the invitation", cnote: "One click lets us know the invitation reached you.", hill: "Everything offered at the Hillden stand is free. Drinks from the bar are paid separately.",
    tip: "Bring business cards and prepare a one-minute introduction of your work.",
    sign: "We look forward to welcoming you,", role: "President, JCI Brașov",
    foot: "You are receiving this email because you registered for Beyond the Initiative on jci-brasov.com.",
  } : {
    subject: "Invitația dumneavoastră la Beyond the Initiative, 26 noiembrie",
    pre: "Locul dumneavoastră este confirmat. În email găsiți codul QR personal pentru intrare.",
    hi: `Bună ziua, ${nume},`,
    p1: "Vă mulțumim pentru înscrierea la <b>Beyond the Initiative</b>, seara în care JCI Brașov devine organizație cu drepturi depline în JCI România. Locul dumneavoastră este confirmat.",
    kd: "DATA", vd: "Joi, 26 noiembrie 2026", ko: "ORA", vo: "17:00", kl: "LOCAȚIA", vl: "CATTIA Brașov, Strada Institutului 35",
    prog: "Două paneluri cu lideri din mediul de afaceri și din administrație, două sesiuni de Blitz Networking și cel puțin 24 de contacte noi de business.",
    qrt: "Codul dumneavoastră de intrare", qrp: "Prezentați acest cod la intrare. Este personal și valabil o singură dată.",
    btn: "Deschideți biletul", cbtn: "Confirm primirea invitației", cnote: "Un singur clic ne arată că invitația a ajuns la dumneavoastră.", hill: "Tot ce se oferă la standul Hillden este gratuit. Consumația de la bar se achită separat.",
    tip: "Vă recomandăm să aduceți cărți de vizită și să pregătiți o prezentare de un minut despre activitatea dumneavoastră.",
    sign: "Vă așteptăm cu drag,", role: "Președinte, JCI Brașov",
    foot: "Primiți acest email pentru că v-ați înscris la Beyond the Initiative pe jci-brasov.com.",
  };
  const F = "font-family:'Plus Jakarta Sans',Segoe UI,Helvetica,Arial,sans-serif";
  const lab = (s) => `<div style="${F};font-size:11px;font-weight:800;letter-spacing:2px;color:#0097D7">${s}</div>`;
  const val = (s) => `<div style="${F};font-size:18px;font-weight:800;color:#130F2D;margin-top:3px">${s}</div>`;
  const html = `<!DOCTYPE html><html lang="${en ? "en" : "ro"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(L.subject)}</title></head>
<body style="margin:0;padding:0;background:#ECEFF5">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(L.pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECEFF5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:18px;overflow:hidden">
<tr><td style="background:#130F2D;padding:28px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td><img src="${SITE}/assets/img/logo-jci-brasov-invers.png" width="120" alt="JCI Brașov" style="display:block;border:0;height:auto"></td>
<td align="right" style="${F};font-size:11px;font-weight:800;letter-spacing:3px;color:#EFC40F">${en ? "INVITATION" : "INVITAȚIE"}</td></tr></table>
<div style="${F};font-size:12px;font-weight:800;letter-spacing:3px;color:#57BCBC;margin-top:30px">${en ? "JCI BRAȘOV LAUNCH EVENT" : "EVENIMENTUL DE LANSARE JCI BRAȘOV"}</div>
<div style="${F};font-size:38px;line-height:1.05;font-weight:800;color:#FFFFFF;margin-top:10px">BEYOND<br>THE INITIATIVE</div>
</td></tr>
<tr><td style="padding:30px 32px 6px;${F};font-size:16px;line-height:1.6;color:#2A2F45">
<p style="margin:0 0 14px">${L.hi}</p><p style="margin:0">${L.p1}</p></td></tr>
<tr><td align="center" style="padding:20px 32px 4px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#1FA463;border-radius:12px">
<a href="${SITE}/confirma/${t}" style="display:inline-block;padding:15px 30px;${F};font-size:16px;font-weight:800;color:#FFFFFF;text-decoration:none">${L.cbtn}</a></td></tr></table>
<div style="${F};font-size:13px;color:#4A5068;margin-top:8px">${L.cnote}</div></td></tr>
<tr><td style="padding:18px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FB;border-radius:14px;border-left:5px solid #1F4789"><tr><td style="padding:20px 22px">
${lab(en ? "PERSONAL TICKET" : "BILET NOMINAL")}<div style="${F};font-size:22px;font-weight:800;color:#1F4789;margin:4px 0 16px">${nume}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td valign="top" style="padding-bottom:12px">${lab(L.kd)}${val(L.vd)}</td><td valign="top" style="padding-bottom:12px">${lab(L.ko)}${val(L.vo)}</td></tr>
<tr><td colspan="2">${lab(L.kl)}${val(L.vl)}</td></tr></table>
</td></tr></table></td></tr>
<tr><td align="center" style="padding:10px 32px 4px">
<div style="${F};font-size:13px;font-weight:800;letter-spacing:2px;color:#130F2D">${L.qrt.toUpperCase()}</div>
<img src="${SITE}/bilet/${t}/qr.png" width="200" height="200" alt="${esc(L.qrt)}" style="display:block;margin:12px auto;border:0">
<div style="${F};font-size:13px;color:#4A5068">${L.qrp}</div>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px auto 0"><tr><td style="background:#0097D7;border-radius:12px">
<a href="${bilet}" style="display:inline-block;padding:14px 28px;${F};font-size:16px;font-weight:800;color:#FFFFFF;text-decoration:none">${L.btn}</a></td></tr></table>
</td></tr>
<tr><td style="padding:24px 32px 8px;${F};font-size:15px;line-height:1.6;color:#2A2F45">
<p style="margin:0 0 12px">${L.prog}</p>
<p style="margin:0 0 12px;background:#FFF8DC;border-radius:10px;padding:12px 14px"><b>Hillden:</b> ${L.hill}</p>
<p style="margin:0 0 20px">${L.tip}</p>
<p style="margin:0">${L.sign}<br><b>Iustin Mazarache</b><br>${L.role}</p></td></tr>
<tr><td style="padding:22px 32px 28px;${F};font-size:12px;line-height:1.6;color:#7A7F96;border-top:1px solid #E3E7EF">
contact@jci-brasov.com | +40 790 827 426 | <a href="${SITE}/eveniment" style="color:#1F4789">jci-brasov.com</a><br>${L.foot}</td></tr>
</table></td></tr></table></body></html>`;
  const strip = (s) => s.replace(/<[^>]+>/g, "");
  const text = [strip(L.hi), "", strip(L.p1), "", `${L.cbtn}: ${SITE}/confirma/${t}`, "", `${L.kd}: ${L.vd}`, `${L.ko}: ${L.vo}`, `${L.kl}: ${L.vl}`, "",
    `${L.qrt}: ${bilet}`, strip(L.qrp), "", L.prog, "", `Hillden: ${L.hill}`, L.tip, "", L.sign, "Iustin Mazarache", L.role, "",
    "contact@jci-brasov.com | +40 790 827 426 | jci-brasov.com"].join("\n");
  return { subject: L.subject, html, text, qr };
}

// ---------- rutare ----------
export async function handleInvitatii(request, env, url) {
  const p = url.pathname;
  let m = p.match(/^\/bilet\/([a-f0-9]{32})\/qr\.png$/);
  if (m) {
    const row = await env.DB.prepare("SELECT 1 AS x FROM inscrieri WHERE token=?").bind(m[1]).first();
    if (!row) return new Response("Not found", { status: 404 });
    const png = await qrPng(`${SITE}/c/${m[1]}`);
    return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400", "X-Robots-Tag": "noindex" } });
  }
  if (p !== "/api/invitatii/de-trimis" && p !== "/api/invitatii/trimis") return null;

  const key = await setting(env, "invit_key");
  const given = url.searchParams.get("key") || request.headers.get("X-Invit-Key");
  const ok = eqConst(given, key);
  // Jurnal scurt, pentru diagnoză: cine a întrebat și dacă cheia a fost corectă (fără cheie, fără date personale)
  try {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS invit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, creat TEXT DEFAULT (datetime('now')), cale TEXT, cheie_ok INTEGER, agent TEXT)").run();
    await env.DB.prepare("INSERT INTO invit_log (cale, cheie_ok, agent) VALUES (?,?,?)").bind(p, ok ? 1 : 0, (request.headers.get("User-Agent") || "").slice(0, 120)).run();
  } catch (e) {}
  if (!ok) return json({ error: "auth" }, 401);

  if (p === "/api/invitatii/de-trimis") {
    await env.DB.prepare("UPDATE inscrieri SET token = lower(hex(randomblob(16))) WHERE token IS NULL").run();
    const mod = (await setting(env, "invit_mod")) || "test";
    const allowed = ((await setting(env, "invit_test")) || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    const r = await env.DB.prepare(
      "SELECT id, nume, email, limba, token, status FROM inscrieri WHERE eveniment=? AND status IN ('confirmat','test') AND invitatie_trimisa IS NULL ORDER BY id LIMIT 200"
    ).bind(EVENT).all();
    let rows = r.results || [];
    if (mod !== "live") rows = rows.filter((x) => allowed.includes(String(x.email).toLowerCase()));
    else rows = rows.filter((x) => x.status === "confirmat" || allowed.includes(String(x.email).toLowerCase()));
    rows = rows.slice(0, BATCH);
    return json({ mod, items: rows.map((x) => ({ id: x.id, email: x.email, nume: x.nume, ...buildEmail(x) })) });
  }

  // POST /api/invitatii/trimis  { id, ok, eroare }
  if (request.method !== "POST") return json({ error: "method" }, 405);
  const b = await request.json().catch(() => ({}));
  const id = Number(b.id);
  if (!Number.isInteger(id)) return json({ error: "id" }, 400);
  const val = b.ok ? new Date().toISOString().slice(0, 19).replace("T", " ") : "eroare: " + String(b.eroare || "").slice(0, 200);
  await env.DB.prepare("UPDATE inscrieri SET invitatie_trimisa=? WHERE id=? AND invitatie_trimisa IS NULL").bind(val, id).run();
  return json({ ok: true });
}
