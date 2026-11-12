// Înscrierea la eveniment: logica comună formularului public (/api/inscriere) și apelurilor echipei (worker/apeluri.js).
// O singură sursă pentru eveniment, capacitate, termen și salvare, ca cele două căi să nu se abată una de alta.

export const EVENT = "beyond-2026";
export const CAPACITY = 150;
export const DEADLINE = Date.UTC(2026, 10, 24, 21, 59, 59); // 24 noiembrie 2026, 23:59 ora României
export const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/;

export async function countRegistrations(env) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM inscrieri WHERE eveniment = ? AND status = 'confirmat'").bind(EVENT).first();
  return (r && r.n) || 0;
}

// f: nume, email, telefon, companie, functie, profil, intrebare, sursa (deja curățate)
// o: limba ("ro" | "en"), acord_marketing (0/1), acord_bcr (0/1), tara
// Întoarce { inserted, status, token, id, existingStatus, existingId }. Aruncă eroare dacă baza de date nu răspunde.
export async function registerPerson(env, f, o) {
  let status = "confirmat";
  let token = null;
  const n = await countRegistrations(env);
  if (n >= CAPACITY) status = "asteptare";
  const res = await env.DB.prepare(
    "INSERT OR IGNORE INTO inscrieri (eveniment,nume,email,telefon,companie,functie,profil,intrebare,sursa,limba,acord_marketing,acord_bcr,status,tara) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).bind(EVENT, f.nume, f.email, f.telefon, f.companie || "", f.functie || "", f.profil || "", f.intrebare || "", f.sursa, o.limba || "ro",
    o.acord_marketing ? 1 : 0, o.acord_bcr ? 1 : 0, status, o.tara || null).run();
  const inserted = !!(res.meta && res.meta.changes > 0);
  if (inserted && status === "confirmat") {
    // Cod unic pentru biletul nominal cu QR (vezi worker/checkin.js)
    const tk = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
    try {
      await env.DB.prepare("UPDATE inscrieri SET token=? WHERE id=? AND token IS NULL").bind(tk, res.meta.last_row_id).run();
      token = tk;
    } catch (e) { console.log("token:", e && e.message); }
  }
  if (inserted) return { inserted, status, token, id: res.meta.last_row_id };
  const ex = await env.DB.prepare("SELECT id, status FROM inscrieri WHERE eveniment=? AND email=?").bind(EVENT, f.email).first();
  return { inserted: false, status, token: null, existingStatus: (ex && ex.status) || null, existingId: (ex && ex.id) || null };
}
