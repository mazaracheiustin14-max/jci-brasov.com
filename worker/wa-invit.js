// Invitații trimise pe WhatsApp celor înscriși care nu au confirmat primirea invitației din email (19 nov 2026).
// Pagina /checkin/neconfirmate (doar echipa, cu PIN): câte un buton per persoană care deschide WhatsApp cu mesajul
// nominal și linkul biletului personal (/bilet/<cod>). Apăsarea se marchează în `inscrieri.wa_invit_trimis`;
// când persoana răspunde, colega apasă „A confirmat pe WhatsApp”, care completează `primire_confirmata`.
// Interfața: public/assets/js/wa-invit.js (fără script inline, CSP).
const EVENT = "beyond-2026";
const SITE = "https://jci-brasov.com";
const JS_VERSION = "3";

async function ensureCols(env) {
  for (const col of ["wa_invit_trimis TEXT", "wa_invit_de TEXT", "confirmat_prin TEXT", "wa_spam_trimis TEXT", "wa_spam_de TEXT", "wa_rem_trimis TEXT", "wa_rem_de TEXT"]) {
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

// Mesajul aprobat de Iustin pe 20 nov 2026 (textul și emoticoanele sunt ale lui), cu linkul biletului personal.
export function waMessage(row) {
  const bilet = `${SITE}/bilet/${row.token}`;
  if (row.limba === "en") {
    return [
      `Good day, ${row.nume}!`,
      "Your invitation to Beyond the Initiative may have ended up in SPAM, so we are attaching it here for check-in.",
      bilet,
      "Only 6 days left until the event and we would be grateful if you could confirm your attendance by tomorrow, 21 November.",
      "Venue: Cattia, Brașov",
      "Date: Thursday, 26 November",
      "Time: 17:00",
      "Let it be inspiring!",
    ].join("\n");
  }
  return [
    `Bună ziua, ${row.nume}!`,
    "Se poate ca invitația dumneavoastră la Beyond the Initiative să fi ajuns în SPAM. Așa că vă atașăm invitația aici, pentru a o folosi la check-in.",
    bilet,
    "Mai sunt doar 6 zile până la eveniment și v-am fi recunoscători să ne confirmați prezența până mâine, 21 noiembrie.",
    "Locație: Cattia, Brașov",
    "Data: Joi, 26 noiembrie",
    "Ora: 17:00",
    "Să fie inspirație!",
  ].join("\n");
}

function oraRo(utc) {
  if (!utc) return "";
  const d = new Date(String(utc).replace(" ", "T") + "Z");
  if (isNaN(d)) return "";
  return d.toLocaleString("ro-RO", { timeZone: "Europe/Bucharest", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Filtre (20 nov 2026): „formular” = ultimul chestionar (online sau completat la apel) are statusul „confirmat”;
// „gmail” = a confirmat primirea invitației (butonul din email sau, marcat de echipă, răspunsul pe WhatsApp);
// „rest” = toți ceilalți înscriși, cărora li se trimite mesajul pe WhatsApp.
async function lista(env) {
  await ensureCols(env);
  await env.DB.prepare("UPDATE inscrieri SET token = lower(hex(randomblob(16))) WHERE token IS NULL").run();
  const r = await env.DB.prepare(
    "SELECT i.id, i.nume, i.telefon, i.email, i.limba, i.token, i.sursa, i.invitatie_trimisa, i.primire_confirmata, i.confirmat_prin, i.wa_spam_trimis, i.wa_spam_de, " +
    "(SELECT l.status_final || '|' || l.apelant FROM call_logs l LEFT JOIN contacte c ON c.id=l.contact_id WHERE l.inscriere_id=i.id OR c.inscriere_id=i.id ORDER BY l.id DESC LIMIT 1) AS ultim " +
    "FROM inscrieri i WHERE i.eveniment=? AND i.status='confirmat' ORDER BY i.nume COLLATE NOCASE"
  ).bind(EVENT).all();
  return (r.results || []).map((x) => {
    const [st, cine] = String(x.ultim || "").split("|");
    x.formular = st === "confirmat" ? (cine === "Chestionar online" ? "chestionarul online" : "apel, " + cine) : "";
    x.gmail = !!x.primire_confirmata;
    return x;
  });
}

function card(x, esc, f) {
  const nr = waNumber(x.telefon);
  const info = [];
  if (x.formular) info.push("A confirmat în formular (" + esc(x.formular) + ")");
  if (x.gmail) info.push(String(x.confirmat_prin || "").startsWith("whatsapp") ? "A confirmat pe WhatsApp" : "A confirmat primirea pe Gmail");
  if (f === "rest") info.push(x.invitatie_trimisa && !/^(exclus|eroare)/.test(x.invitatie_trimisa) ? "Invitația pe email: trimisă, neconfirmată" : "Invitația pe email: netrimisă");
  const st = f === "rest" ? `<p class="muted mt" data-st="${x.id}">${x.wa_spam_trimis ? `Trimis pe WhatsApp: ${esc(oraRo(x.wa_spam_trimis))}${x.wa_spam_de ? ", de " + esc(x.wa_spam_de) : ""}` : ""}</p>` : "";
  let acts = "";
  if (f === "rest") {
    acts = nr
      ? `<div class="acts"><a class="btn ${x.wa_spam_trimis ? "b-ghost" : "b-green"}" data-wa="${x.id}" href="https://wa.me/${nr}?text=${encodeURIComponent(waMessage(x))}" target="_blank" rel="noopener">${x.wa_spam_trimis ? "Retrimite pe WhatsApp" : "Trimite invitația pe WhatsApp"}</a></div>`
      : `<p class="muted mt">Număr de telefon lipsă sau incomplet.</p>`;
    acts += `<form method="POST" action="/api/echipa/wa-confirmat" class="acts"><input type="hidden" name="id" value="${x.id}"><button class="btn b-blue" type="submit">A confirmat pe WhatsApp</button></form>`;
  }
  return `<div class="card mt" id="p${x.id}"><p class="val" style="color:#fff">${esc(x.nume)}${(x.sursa || "").includes("VIP") ? ' <span class="vip">VIP</span>' : ""}</p>
<p class="muted">${esc(x.telefon || "fără telefon")}${x.email ? ", " + esc(x.email) : ""}</p>${info.map((t) => `<p class="muted">${t}</p>`).join("")}${st}
${acts}<a class="btn b-ghost mt" href="/bilet/${x.token}" target="_blank" rel="noopener" style="padding:10px;font-size:14px">Vezi invitația</a></div>`;
}

export async function handleWaInvit(request, env, url, s, H) {
  const p = url.pathname;
  if (p === "/checkin/neconfirmate" || p === "/checkin/neconfirmate/") {
    const rows = await lista(env);
    const ok = url.searchParams.get("ok") === "1";
    const f = ["formular", "gmail"].includes(url.searchParams.get("f")) ? url.searchParams.get("f") : "rest";
    const G = {
      formular: rows.filter((x) => x.formular),
      gmail: rows.filter((x) => x.gmail),
      rest: rows.filter((x) => !x.formular && !x.gmail),
    };
    const sel = f === "rest" ? [...G.rest.filter((x) => !x.wa_spam_trimis), ...G.rest.filter((x) => x.wa_spam_trimis)] : G[f];
    const tab = (k, t) => `<a class="btn ${f === k ? "b-blue" : "b-ghost"}" href="/checkin/neconfirmate${k === "rest" ? "" : "?f=" + k}">${t} (${G[k].length})</a>`;
    const head = {
      rest: `<p class="muted mt">Înscriși care nu au confirmat nici în formular, nici pe Gmail. Butonul verde deschide WhatsApp cu mesajul și linkul invitației; apăsați Trimite în WhatsApp. Când persoana răspunde, apăsați „A confirmat pe WhatsApp”. Netrimise: ${G.rest.filter((x) => !x.wa_spam_trimis).length}.</p>`,
      formular: '<p class="muted mt">Au spus în chestionar (online sau la apel) că vin. Nu primesc mesajul.</p>',
      gmail: '<p class="muted mt">Au confirmat primirea invitației din email sau au răspuns pe WhatsApp. Nu primesc mesajul. Unele persoane apar și la Formular.</p>',
    }[f];
    const inner = `<p class="k">Panoul echipei</p><h1>Invitații pe WhatsApp</h1>
${ok ? '<div class="ok-msg">Confirmarea a fost salvată. Persoana a trecut la Gmail.</div>' : ""}
<div class="acts">${tab("formular", "Formular")}${tab("gmail", "Gmail")}</div>
<div class="acts">${tab("rest", "Restul, de trimis")}</div>
<div class="card mt"><p class="lab">${{ rest: "RESTUL, PRIMESC MESAJUL", formular: "AU CONFIRMAT ÎN FORMULAR CĂ VIN", gmail: "AU CONFIRMAT PE GMAIL" }[f]}</p><p class="big">${sel.length}<span style="font-size:18px;color:#B9BBD6"> din ${rows.length} înscriși</span></p>${head}</div>
${sel.map((x) => card(x, H.esc, f)).join("") || '<div class="card mt"><p class="val" style="color:#fff">Nicio persoană în această listă.</p></div>'}
<a class="btn b-ghost mt" href="/checkin">Înapoi la panou</a>`;
    return H.html(H.shell("Invitații pe WhatsApp", inner, `<script src="/assets/js/wa-invit.js?v=${JS_VERSION}"></script>`));
  }
  if (p === "/api/echipa/wa-trimis") {
    if (request.method !== "POST" || !H.sameOrigin(request)) return H.json({ error: "method" }, 405);
    const b = await request.json().catch(() => ({}));
    await ensureCols(env);
    await env.DB.prepare("UPDATE inscrieri SET wa_spam_trimis=datetime('now'), wa_spam_de=? WHERE id=? AND eveniment=?").bind(String(s.who || "").slice(0, 40), Number(b.id) || 0, EVENT).run();
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

// ---------- Reamintirea pe WhatsApp din ziua evenimentului (26 nov 2026) ----------
// Pagina /checkin/reamintire: toți înscrișii confirmați care nu au intrat încă, în afară de cei care au spus că nu vin
// (bifa „Nu participă” din Apeluri sau statusul „nu participă” din chestionar). Butonul deschide WhatsApp cu mesajul
// nominal și biletul; apăsarea se marchează în `inscrieri.wa_rem_trimis`.
function prenume(n) {
  let s = String(n || "").replace(/[^\p{L}\p{M}\s.\-]/gu, "").replace(/\s+/g, " ").trim();
  if (!s || /^invitat jci/i.test(s) || s.length < 3) return "";
  if (s === s.toUpperCase() || s === s.toLowerCase()) s = s.toLowerCase().replace(/(^|[\s\-])\p{L}/gu, (m) => m.toUpperCase());
  return s;
}
export function waReminder(row) {
  const n = prenume(row.nume);
  return [
    n ? `Bună ziua, ${n}!` : "Bună ziua!",
    "Vă reamintim că vă așteptăm în această seară, de la ora 17:00, la Beyond the Initiative, la CATTIA Brașov, Strada Institutului 35.",
    "Biletul dumneavoastră, cu codul QR pentru check-in:",
    `${SITE}/bilet/${row.token}`,
    "Vă așteptăm cu drag!",
    "Iustin Mazarache, JCI Brașov",
  ].join("\n");
}
async function listaReamintire(env) {
  await ensureCols(env);
  const r = await env.DB.prepare(
    "SELECT i.id, i.nume, i.telefon, i.email, i.token, i.sursa, i.wa_rem_trimis, i.wa_rem_de FROM inscrieri i WHERE i.eveniment=? AND i.status='confirmat' AND i.prezent_la IS NULL " +
    "AND NOT EXISTS (SELECT 1 FROM contacte c WHERE c.inscriere_id=i.id AND c.participa='nu') " +
    "AND NOT EXISTS (SELECT 1 FROM call_logs l LEFT JOIN contacte c ON c.id=l.contact_id WHERE (l.inscriere_id=i.id OR c.inscriere_id=i.id) AND l.status_final='nu_participa') " +
    "ORDER BY i.nume COLLATE NOCASE"
  ).bind(EVENT).all();
  return r.results || [];
}
export async function handleReamintire(request, env, url, s, H) {
  const p = url.pathname;
  if (p === "/api/echipa/wa-rem-trimis") {
    if (request.method !== "POST" || !H.sameOrigin(request)) return H.json({ error: "method" }, 405);
    const b = await request.json().catch(() => ({}));
    await ensureCols(env);
    await env.DB.prepare("UPDATE inscrieri SET wa_rem_trimis=datetime('now'), wa_rem_de=? WHERE id=? AND eveniment=?").bind(String(s.who || "").slice(0, 40), Number(b.id) || 0, EVENT).run();
    return H.json({ ok: true });
  }
  if (p !== "/checkin/reamintire" && p !== "/checkin/reamintire/") return null;
  const rows = await listaReamintire(env);
  const sel = [...rows.filter((x) => !x.wa_rem_trimis), ...rows.filter((x) => x.wa_rem_trimis)];
  const net = rows.filter((x) => !x.wa_rem_trimis).length;
  const esc = H.esc;
  const card = (x) => {
    const nr = waNumber(x.telefon);
    const btn = nr
      ? `<div class="acts"><a class="btn ${x.wa_rem_trimis ? "b-ghost" : "b-green"}" data-wa="${x.id}" data-api="/api/echipa/wa-rem-trimis" href="https://wa.me/${nr}?text=${encodeURIComponent(waReminder(x))}" target="_blank" rel="noopener">${x.wa_rem_trimis ? "Retrimite pe WhatsApp" : "Trimite reamintirea pe WhatsApp"}</a></div>`
      : `<p class="muted mt">Număr de telefon lipsă sau incomplet.</p>`;
    return `<div class="card mt" id="p${x.id}"><p class="val" style="color:#fff">${esc(x.nume)}${(x.sursa || "").includes("VIP") ? ' <span class="vip">VIP</span>' : ""}</p>
<p class="muted">${esc(x.telefon || "fără telefon")}</p><p class="muted mt" data-st="${x.id}">${x.wa_rem_trimis ? `Trimis: ${esc(oraRo(x.wa_rem_trimis))}${x.wa_rem_de ? ", de " + esc(x.wa_rem_de) : ""}` : ""}</p>${btn}</div>`;
  };
  const inner = `<p class="k">Panoul echipei</p><h1>Reamintire pe WhatsApp</h1>
<div class="card mt"><p class="lab">DE TRIMIS AZI</p><p class="big">${net}<span style="font-size:18px;color:#B9BBD6"> din ${rows.length}</span></p>
<p class="muted mt">Toți înscrișii care nu au intrat încă, fără cei care au spus că nu vin. Butonul verde deschide WhatsApp cu mesajul și biletul; apăsați Trimite în WhatsApp. Cei care intră la eveniment dispar din listă.</p></div>
${sel.map(card).join("") || '<div class="card mt"><p class="val" style="color:#fff">Nicio persoană în listă.</p></div>'}
<a class="btn b-ghost mt" href="/checkin">Înapoi la panou</a>`;
  return H.html(H.shell("Reamintire pe WhatsApp", inner, `<script src="/assets/js/wa-invit.js?v=${JS_VERSION}"></script>`));
}
