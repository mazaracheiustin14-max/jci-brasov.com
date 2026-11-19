// Invitații trimise pe WhatsApp celor înscriși care nu au confirmat primirea invitației din email (19 nov 2026).
// Pagina /checkin/neconfirmate (doar echipa, cu PIN): câte un buton per persoană care deschide WhatsApp cu mesajul
// nominal și linkul biletului personal (/bilet/<cod>). Apăsarea se marchează în `inscrieri.wa_invit_trimis`;
// când persoana răspunde, colega apasă „A confirmat pe WhatsApp”, care completează `primire_confirmata`.
// Interfața: public/assets/js/wa-invit.js (fără script inline, CSP).
const EVENT = "beyond-2026";
const SITE = "https://jci-brasov.com";
const JS_VERSION = "1";

async function ensureCols(env) {
  for (const col of ["wa_invit_trimis TEXT", "wa_invit_de TEXT", "confirmat_prin TEXT"]) {
    try { await env.DB.prepare(`ALTER TABLE inscrieri ADD COLUMN ${col}`).run(); } catch (e) {}
  }
}

// Numărul în format internațional, doar cifre, pentru wa.me. Numerele românești scrise cu 0 în față primesc prefixul 40.
export function waNumber(tel) {
  let d = String(tel || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (/^0\d{9}$/.test(d)) d = "4" + d;
  if (/^7\d{8}$/.test(d)) d = "40" + d;
  return d.length >= 10 ? d : "";
}

export function waMessage(row) {
  const bilet = `${SITE}/bilet/${row.token}`;
  if (row.limba === "en") {
    return [
      `Good day, ${row.nume},`,
      "",
      "We noticed you have not yet confirmed receiving your invitation to Beyond the Initiative, so here it is on WhatsApp:",
      bilet,
      "",
      "Thursday, 26 November 2026, 17:00, CATTIA Brașov, Strada Institutului 35.",
      "",
      "We would be grateful if you could reply with a short confirmation message.",
      "",
      "Thank you,",
      "JCI Brașov",
    ].join("\n");
  }
  return [
    `Bună ziua, ${row.nume},`,
    "",
    "Am văzut că nu ați confirmat primirea invitației la Beyond the Initiative, așa că o aveți aici, pe WhatsApp:",
    bilet,
    "",
    "Joi, 26 noiembrie 2026, ora 17:00, CATTIA Brașov, Strada Institutului 35.",
    "",
    "V-am fi recunoscători dacă ne-ați da un mesaj de confirmare.",
    "",
    "Mulțumim,",
    "Echipa JCI Brașov",
  ].join("\n");
}

function oraRo(utc) {
  if (!utc) return "";
  const d = new Date(String(utc).replace(" ", "T") + "Z");
  if (isNaN(d)) return "";
  return d.toLocaleString("ro-RO", { timeZone: "Europe/Bucharest", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function lista(env) {
  await ensureCols(env);
  await env.DB.prepare("UPDATE inscrieri SET token = lower(hex(randomblob(16))) WHERE token IS NULL").run();
  const r = await env.DB.prepare(
    "SELECT id, nume, telefon, email, limba, token, sursa, invitatie_trimisa, wa_invit_trimis, wa_invit_de FROM inscrieri " +
    "WHERE eveniment=? AND status='confirmat' AND primire_confirmata IS NULL ORDER BY wa_invit_trimis IS NOT NULL, nume COLLATE NOCASE"
  ).bind(EVENT).all();
  return r.results || [];
}

function card(x, esc) {
  const nr = waNumber(x.telefon);
  const email = x.invitatie_trimisa && !/^(exclus|eroare)/.test(x.invitatie_trimisa) ? "Invitația pe email: trimisă, neconfirmată" : "Invitația pe email: netrimisă";
  const trimis = x.wa_invit_trimis ? `<p class="muted mt" data-st="${x.id}">Trimis pe WhatsApp: ${esc(oraRo(x.wa_invit_trimis))}${x.wa_invit_de ? ", de " + esc(x.wa_invit_de) : ""}</p>` : `<p class="muted mt" data-st="${x.id}"></p>`;
  const send = nr
    ? `<a class="btn ${x.wa_invit_trimis ? "b-ghost" : "b-green"}" data-wa="${x.id}" href="https://wa.me/${nr}?text=${encodeURIComponent(waMessage(x))}" target="_blank" rel="noopener">${x.wa_invit_trimis ? "Retrimite pe WhatsApp" : "Trimite invitația pe WhatsApp"}</a>`
    : `<p class="muted mt">Număr de telefon lipsă sau incomplet. Folosiți biletul: <a href="/bilet/${x.token}" target="_blank" rel="noopener" style="color:#57BCBC">/bilet/${x.token.slice(0, 8)}</a></p>`;
  return `<div class="card mt" id="p${x.id}"><p class="val" style="color:#fff">${esc(x.nume)}${(x.sursa || "").includes("VIP") ? ' <span class="vip">VIP</span>' : ""}</p>
<p class="muted">${esc(x.telefon || "fără telefon")}${x.email ? ", " + esc(x.email) : ""}</p><p class="muted">${email}</p>${trimis}
<div class="acts">${send}</div>
<form method="POST" action="/api/echipa/wa-confirmat" class="acts"><input type="hidden" name="id" value="${x.id}"><button class="btn b-blue" type="submit">A confirmat pe WhatsApp</button></form>
<a class="btn b-ghost mt" href="/bilet/${x.token}" target="_blank" rel="noopener" style="padding:10px;font-size:14px">Vezi invitația</a></div>`;
}

export async function handleWaInvit(request, env, url, s, H) {
  const p = url.pathname;
  if (p === "/checkin/neconfirmate" || p === "/checkin/neconfirmate/") {
    const rows = await lista(env);
    const ok = url.searchParams.get("ok") === "1";
    const deTrimis = rows.filter((x) => !x.wa_invit_trimis), trimise = rows.filter((x) => x.wa_invit_trimis);
    const inner = `<p class="k">Panoul echipei</p><h1>Invitații neconfirmate</h1>
${ok ? '<div class="ok-msg">Confirmarea a fost salvată. Persoana a ieșit din listă.</div>' : ""}
<div class="card"><div class="row"><div><p class="lab">DE TRIMIS PE WHATSAPP</p><p class="big">${deTrimis.length}</p></div><div><p class="lab">TRIMISE, FĂRĂ RĂSPUNS</p><p class="big" style="color:#B9BBD6">${trimise.length}</p></div></div>
<p class="muted mt">Înscriși care nu au apăsat „Confirm primirea invitației” în email. Butonul verde deschide WhatsApp cu mesajul nominal și linkul invitației; apăsați Trimite în WhatsApp. Când persoana răspunde, apăsați „A confirmat pe WhatsApp”.</p></div>
${deTrimis.length ? `<p class="lab mt" style="margin-top:26px">DE TRIMIS</p>${deTrimis.map((x) => card(x, H.esc)).join("")}` : ""}
${trimise.length ? `<p class="lab mt" style="margin-top:26px">TRIMISE PE WHATSAPP, AȘTEAPTĂ CONFIRMAREA</p>${trimise.map((x) => card(x, H.esc)).join("")}` : ""}
${rows.length ? "" : '<div class="card mt"><p class="val" style="color:#fff">Toți înscrișii au confirmat primirea invitației.</p></div>'}
<a class="btn b-ghost mt" href="/checkin">Înapoi la panou</a>`;
    return H.html(H.shell("Invitații neconfirmate", inner, `<script src="/assets/js/wa-invit.js?v=${JS_VERSION}"></script>`));
  }
  if (p === "/api/echipa/wa-trimis") {
    if (request.method !== "POST" || !H.sameOrigin(request)) return H.json({ error: "method" }, 405);
    const b = await request.json().catch(() => ({}));
    await ensureCols(env);
    await env.DB.prepare("UPDATE inscrieri SET wa_invit_trimis=datetime('now'), wa_invit_de=? WHERE id=? AND eveniment=?").bind(String(s.who || "").slice(0, 40), Number(b.id) || 0, EVENT).run();
    return H.json({ ok: true });
  }
  if (p === "/api/echipa/wa-confirmat") {
    if (request.method !== "POST" || !H.sameOrigin(request)) return H.json({ error: "method" }, 405);
    const f = await request.formData().catch(() => null);
    await ensureCols(env);
    await env.DB.prepare("UPDATE inscrieri SET primire_confirmata=datetime('now'), confirmat_prin=? WHERE id=? AND eveniment=? AND primire_confirmata IS NULL")
      .bind("whatsapp: " + String(s.who || "").slice(0, 40), Number(f && f.get("id")) || 0, EVENT).run();
    return Response.redirect(`${url.origin}/checkin/neconfirmate?ok=1`, 303);
  }
  return null;
}
