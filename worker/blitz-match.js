// Potrivirea pe domenii la Blitz Networking: funcții pure, fără bază de date (folosite de worker/checkin.js și de teste).
// Într-un bloc, toți se întâlnesc cu toți pe parcursul celor 6 runde, deci potrivirea înseamnă alegerea blocului.
//  1) Cu o zi înainte: invitații VIP primesc loc rezervat în primele K blocuri; cei care se caută reciproc ajung împreună.
//  2) La scanare: participantul merge în blocul unde domeniul lui e cel mai cerut de VIP-ii de acolo, cât timp blocurile
//     rămân echilibrate. Cine nu are domeniu sau nu e cerut nicăieri urmează regula veche (blocul cel mai liber).

const usable = (d) => !!d && d !== "alt";

// Câte „întâlniri dorite” apar dacă a și b sunt în același bloc.
export function pairScore(a, b) {
  return (usable(b.dom) && a.tinte.includes(b.dom) ? 1 : 0) + (usable(a.dom) && b.tinte.includes(a.dom) ? 1 : 0);
}

// vips: [{ id, dom, tinte: [] }]; K blocuri; fixed: [{ bloc, dom, tinte }] = VIP deja așezați (rămân pe loc).
// Întoarce Map(id -> bloc); niciun bloc nu depășește total/K rotunjit în sus. Determinist.
export function preallocVip(vips, K, fixed = []) {
  const blocks = Array.from({ length: K }, () => []);
  for (const f of fixed) if (f.bloc >= 1 && f.bloc <= K) blocks[f.bloc - 1].push({ ...f, fixed: true });
  const total = vips.length + blocks.reduce((n, b) => n + b.length, 0);
  const cap = Math.ceil(total / K);
  const order = vips.slice().sort((a, b) => b.tinte.length - a.tinte.length || a.id - b.id);
  const gain = (v, blk) => blk.reduce((s, m) => s + pairScore(v, m), 0);
  for (const v of order) {
    let best = -1, bestG = -1;
    for (let i = 0; i < K; i++) {
      if (blocks[i].length >= cap) continue;
      const g = gain(v, blocks[i]);
      if (g > bestG || (g === bestG && best >= 0 && blocks[i].length < blocks[best].length)) { best = i; bestG = g; }
    }
    if (best < 0) best = blocks.reduce((m, b, i) => (b.length < blocks[m].length ? i : m), 0);
    blocks[best].push(v);
  }
  // Îmbunătățire prin schimburi între blocuri, cât timp crește numărul de întâlniri dorite.
  const without = (blk, x) => blk.filter((m) => m !== x);
  for (let pass = 0; pass < 20; pass++) {
    let improved = false;
    for (let i = 0; i < K; i++) for (let j = i + 1; j < K; j++) {
      for (const a of blocks[i].slice()) {
        if (a.fixed) continue;
        for (const b of blocks[j].slice()) {
          if (b.fixed || !blocks[i].includes(a) || !blocks[j].includes(b)) continue;
          const bi = without(blocks[i], a), bj = without(blocks[j], b);
          const delta = gain(a, bj) + gain(b, bi) - gain(a, bi) - gain(b, bj);
          if (delta > 0) {
            blocks[i] = bi.concat([b]); blocks[j] = bj.concat([a]); improved = true;
          }
        }
      }
    }
    if (!improved) break;
  }
  const out = new Map();
  blocks.forEach((blk, i) => { for (const m of blk) if (!m.fixed) out.set(m.id, i + 1); });
  return out;
}

// Scorul unui bloc pentru persoana care tocmai a sosit.
// members: [{ dom, tinte: [] }] = cei deja în bloc (prezenți sau cu loc rezervat).
//  - cerere: câți din bloc au cerut domeniul persoanei, împărțit la câți din același domeniu sunt deja acolo
//    (primul om dintr-un domeniu cerut valorează cel mai mult; următorii merg spre alte blocuri care îl cer);
//  - dacă persoana are și ea domenii țintă: câți din bloc sunt din acele domenii.
export function blockScore(person, members) {
  let demand = 0, have = 0, mine = 0;
  const d = usable(person.dom) ? person.dom : "";
  for (const m of members) {
    if (d && m.tinte.includes(d)) demand++;
    if (d && m.dom === d) have++;
    if (usable(m.dom) && person.tinte.includes(m.dom)) mine++;
  }
  return demand / (1 + have) + mine;
}

// Cât de mult poate depăși un bloc pe cel mai liber din valul lui, de dragul potrivirii.
export const BALANCE_SLACK = 3;

// open: blocurile deschise ale valului; sizeOf(b) și membersOf(b) dau starea.
// Întoarce blocurile cu scorul maxim (strict pozitiv) care nu strică echilibrul, sau [] dacă nu există potrivire.
export function domainCandidates(open, sizeOf, membersOf, person, slack = BALANCE_SLACK) {
  if (!usable(person.dom) && !person.tinte.length) return [];
  const min = Math.min(...open.map(sizeOf));
  let best = 0, cand = [];
  for (const b of open) {
    if (sizeOf(b) > min + slack) continue;
    const s = blockScore(person, membersOf(b));
    if (s > best + 1e-9) { best = s; cand = [b]; } else if (s > 0 && Math.abs(s - best) <= 1e-9) cand.push(b);
  }
  return cand;
}

// Câte blocuri primesc invitați VIP. Presupunere: vin aproximativ 70% dintre înscrișii confirmați (nu e măsurat pentru
// acest eveniment); blocurile VIP trebuie să fie cele care se umplu sigur. Cel mult 12 VIP într-un bloc de 25.
export const SHOW_RATE = 0.7;
export function suggestK(confirmed, vipCount, blocSize = 25, maxK = 6) {
  const byAttendance = Math.floor((confirmed * SHOW_RATE) / blocSize);
  const byVip = Math.ceil(vipCount / 12);
  return Math.max(1, Math.min(maxK, Math.max(byAttendance, byVip)));
}
