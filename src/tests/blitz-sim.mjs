// Simulare pentru potrivirea pe domenii la Blitz Networking. Rulare: node src/tests/blitz-sim.mjs
// Date inventate (nu avem încă domeniile participanților reali): 40 de invitați VIP cu 2 sau 3 domenii țintă,
// participanți care sosesc în ordine aleatorie. Compară alocarea pe domenii cu alocarea veche (doar echilibru).
// Măsoară, pentru invitații VIP: câte dintre domeniile cerute au cel puțin un om în blocul lor și câți oameni
// din domeniile cerute întâlnesc în medie.
import { DOM_CODES } from "../../worker/domenii.js";
import { preallocVip, domainCandidates } from "../../worker/blitz-match.js";

const DOMS = DOM_CODES.filter((d) => d !== "alt");
// Ponderi inventate: câteva domenii mai frecvente, câteva rare.
const W = [14, 12, 12, 9, 7, 9, 8, 5, 7, 4, 5, 6, 2];
let seed = 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const pickDom = () => { let x = rnd() * W.reduce((a, b) => a + b, 0); for (let i = 0; i < W.length; i++) { x -= W[i]; if (x < 0) return DOMS[i]; } return DOMS[0]; };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const SIZE = 25;
function waves(k) {
  const out = []; let from = 1;
  if (k > 3) { out.push([1, k]); from = k + 1; } else { out.push([1, 3], [4, 5]); from = 6; }
  for (; from <= 8; from++) out.push([from, from]);
  return out;
}
function run(N, K, fill, useDomain) {
  const vips = Array.from({ length: 40 }, (_, i) => {
    const dom = pickDom(); const t = [];
    while (t.length < 2 + (rnd() < 0.5 ? 1 : 0)) { const d = pickDom(); if (d !== dom && !t.includes(d)) t.push(d); }
    return { id: i + 1, vip: true, dom, tinte: t };
  });
  const blocks = {}; const M = (b) => blocks[b] || (blocks[b] = []);
  const pre = preallocVip(vips, K);
  for (const v of vips) M(pre.get(v.id)).push(v);
  const others = shuffle(Array.from({ length: N - 40 }, () => ({ dom: rnd() < fill ? pickDom() : "", tinte: [] })));
  for (const p of others) {
    for (const [f, t] of waves(K)) {
      const open = []; for (let b = f; b <= t; b++) if (M(b).length < SIZE) open.push(b);
      if (!open.length) continue;
      let cand = useDomain ? domainCandidates(open, (b) => M(b).length, M, p) : [];
      if (!cand.length) cand = open;
      const min = Math.min(...cand.map((b) => M(b).length));
      const c2 = cand.filter((b) => M(b).length <= min + (cand === open ? 0 : 1));
      M(c2[Math.floor(rnd() * c2.length)]).push(p); break;
    }
  }
  let asked = 0, met = 0, people = 0, small = 0;
  for (const v of vips) {
    const blk = M(pre.get(v.id));
    if (blk.length < 20) small++;
    for (const d of v.tinte) { asked++; const n = blk.filter((m) => m !== v && m.dom === d).length; if (n) met++; people += n; }
  }
  return { cover: met / asked, people: people / 40, small };
}
function avg(N, K, fill, useDomain, runs = 400) {
  let c = 0, p = 0, s = 0;
  for (let i = 0; i < runs; i++) { const r = run(N, K, fill, useDomain); c += r.cover; p += r.people; s += r.small; }
  return { cover: Math.round((c / runs) * 100), people: (p / runs).toFixed(1), small: (s / runs).toFixed(1) };
}
console.log("prezenți | blocuri VIP | cu domeniu | cereri acoperite: vechi -> nou | oameni căutați întâlniți de un VIP: vechi -> nou | VIP în bloc sub 20 de oameni");
for (const N of [90, 120, 150]) for (const K of [3, 4, 6]) for (const fill of [1, 0.6]) {
  seed = 7; const a = avg(N, K, fill, false); seed = 7; const b = avg(N, K, fill, true);
  console.log(`${N} | ${K} | ${fill * 100}% | ${a.cover}% -> ${b.cover}% | ${a.people} -> ${b.people} | ${b.small}`);
}
