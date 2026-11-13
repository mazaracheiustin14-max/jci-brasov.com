// Domeniile de activitate folosite la potrivirea din Blitz Networking (aprobate de Iustin, 13 nov 2026).
// O singură listă pentru: domeniul propriu (toți participanții) și domeniile țintă (invitații VIP).
// Aceeași listă e copiată în public/assets/js/apeluri.js, public/assets/js/vip-domenii.js și în src/domenii.py
// (formularele publice); testul src/tests/blitz.test.mjs verifică faptul că listele coincid.
// „alt” = Alt domeniu: se salvează, dar nu intră în potrivire.

export const DOMENII = [
  ["it", "IT și tehnologie", "IT and technology"],
  ["marketing", "Marketing, comunicare și media", "Marketing, communication and media"],
  ["vanzari", "Vânzări și dezvoltare de afaceri", "Sales and business development"],
  ["financiar", "Financiar, contabilitate și asigurări", "Finance, accounting and insurance"],
  ["juridic", "Juridic și consultanță", "Legal and consulting"],
  ["horeca", "HoReCa și turism", "Hospitality and tourism"],
  ["imobiliare", "Imobiliare și construcții", "Real estate and construction"],
  ["productie", "Producție și industrie", "Manufacturing and industry"],
  ["comert", "Comerț și comerț online", "Retail and e-commerce"],
  ["transport", "Transport și logistică", "Transport and logistics"],
  ["sanatate", "Sănătate și wellness", "Health and wellness"],
  ["educatie", "Educație, training și resurse umane", "Education, training and human resources"],
  ["ong", "ONG și sector public", "NGO and public sector"],
  ["alt", "Alt domeniu", "Other field"],
];
export const DOM_CODES = DOMENII.map((d) => d[0]);
export const MAX_TINTE = 3;

export function domOk(c) { return DOM_CODES.includes(c); }
export function domClean(v) { const c = String(v == null ? "" : v).trim().toLowerCase(); return domOk(c) ? c : ""; }
export function domLabel(c, en) { const d = DOMENII.find((x) => x[0] === c); return d ? d[en ? 2 : 1] : ""; }
// Domeniile țintă: coduri valide, fără „alt”, fără dubluri, cel mult MAX_TINTE. Primește listă sau text cu virgule.
export function parseTinte(v) {
  const arr = Array.isArray(v) ? v : String(v == null ? "" : v).split(",");
  const out = [];
  for (const x of arr) {
    const c = domClean(x);
    if (c && c !== "alt" && !out.includes(c)) out.push(c);
  }
  return out.slice(0, MAX_TINTE);
}

const ready = new WeakSet();
// Coloanele inscrieri.domeniu și inscrieri.tinte (coduri separate prin virgulă) și tabelul vip_domenii,
// în care formularul de după plată salvează răspunsul pe email, chiar dacă înscrierea VIP nu a apărut încă din Stripe.
export async function ensureDomCols(env) {
  if (ready.has(env.DB)) return;
  for (const col of ["domeniu TEXT", "tinte TEXT"]) {
    try { await env.DB.prepare(`ALTER TABLE inscrieri ADD COLUMN ${col}`).run(); } catch (e) { /* există deja */ }
  }
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS vip_domenii (email TEXT PRIMARY KEY, domeniu TEXT, tinte TEXT, creat TEXT NOT NULL DEFAULT (datetime('now')))").run();
  await env.DB.prepare("SELECT domeniu, tinte FROM inscrieri LIMIT 1").first();
  ready.add(env.DB);
}
// Condiția SQL „are bilet VIP plătit”: sursa înscrierii sau emailul din tabelul vip (care apare la prima plată).
export async function paidVipCond(env, event) {
  const t = await env.DB.prepare("SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name='vip'").first();
  const ev = String(event).replace(/[^a-z0-9-]/gi, "");
  return "(sursa LIKE '%VIP%'" + (t ? ` OR lower(email) IN (SELECT lower(email) FROM vip WHERE eveniment='${ev}')` : "") + ")";
}
// Completează înscrierile VIP plătite care nu au încă domeniile cu ce s-a primit prin formularul de după plată.
// Doar pentru bilete plătite: altfel oricine ar putea trimite formularul și ar primi loc rezervat ca invitat VIP.
export async function syncVipDomenii(env, event) {
  await ensureDomCols(env);
  const paid = await paidVipCond(env, event);
  await env.DB.prepare(
    "UPDATE inscrieri SET domeniu = COALESCE(NULLIF(domeniu,''), (SELECT v.domeniu FROM vip_domenii v WHERE v.email = lower(inscrieri.email))), " +
    "tinte = COALESCE(NULLIF(tinte,''), (SELECT v.tinte FROM vip_domenii v WHERE v.email = lower(inscrieri.email))) " +
    "WHERE eveniment = ? AND lower(email) IN (SELECT email FROM vip_domenii) AND (domeniu IS NULL OR domeniu = '' OR tinte IS NULL OR tinte = '') AND " + paid
  ).bind(event).run();
}
