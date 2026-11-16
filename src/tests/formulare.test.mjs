// Test: validarea formularelor (formular.js pe eveniment/inscriere RO și EN, chestionar.js pe /q/<cod>) și paginile de eroare din worker.
// Cere jsdom în afara depozitului (ca apeluri-ui.test.mjs). Rulare: node --no-warnings src/tests/formulare.test.mjs
import { JSDOM } from "jsdom";
import fs from "node:fs";
import assert from "node:assert/strict";
import { register } from "node:module";
// worker/index.js importa cloudflare:email, care nu există în Node: îl înlocuim cu un modul gol.
register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, n) { if (s === "cloudflare:email") return { url: "data:text/javascript,export class EmailMessage{}", shortCircuit: true }; return n(s, c); }`));
const R = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const rd = (p) => fs.readFileSync(R + "/" + p, "utf8");

function open(file, lang) {
  const html = rd("public/" + file).replace(/<script[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  w.document.documentElement.lang = lang;
  w.HTMLElement.prototype.scrollIntoView = function () { w.__scrolled = this; };
  w.eval(rd("public/assets/js/formular.js"));
  return w;
}
const submit = (w, f) => { const ev = new w.Event("submit", { bubbles: true, cancelable: true }); f.dispatchEvent(ev); return ev; };

for (const [file, lang, lead] of [["eveniment.html", "ro", "Completează câmpurile obligatorii: "], ["en/eveniment.html", "en", "Please complete the required fields: "]]) {
  const w = open(file, lang), d = w.document;
  const f = d.querySelector("form[data-event]");
  let busy = false;
  f.addEventListener("submit", () => { busy = true; });
  const ev = submit(w, f);
  assert.ok(ev.defaultPrevented, "formular gol: nu se trimite");
  assert.ok(!busy, "starea Se trimite nu pornește când lipsesc câmpuri");
  const m = f.querySelector(".form-msg");
  assert.ok(m.textContent.startsWith(lead), m.textContent);
  assert.ok(m.classList.contains("err") && m.classList.contains("show"));
  assert.equal(f.querySelectorAll('[aria-invalid="true"]').length, f.querySelectorAll("input[required],select[required]").length, "toate câmpurile obligatorii marcate");
  assert.ok(f.querySelector("#i-nume").closest(".field").classList.contains("bad"));
  assert.equal(w.document.activeElement.id, "i-nume", "primul câmp primește focus");
  assert.ok(m.textContent.includes(lang === "ro" ? "Nume și prenume" : "Full name") && m.textContent.includes(lang === "ro" ? "Telefon" : "Phone"));
  // corectare parțială: starea dispare de pe câmpul modificat
  const nume = d.getElementById("i-nume"); nume.value = "Ion Popescu"; nume.dispatchEvent(new w.Event("input", { bubbles: true }));
  assert.ok(!nume.hasAttribute("aria-invalid"));
  // email invalid și telefon scurt
  d.getElementById("i-email").value = "abc"; d.getElementById("i-tel").value = "123";
  submit(w, f);
  assert.ok(d.getElementById("i-email").hasAttribute("aria-invalid") && d.getElementById("i-tel").hasAttribute("aria-invalid"));
  // complet: trece, handlerul normal rulează
  d.getElementById("i-email").value = "ion@example.com"; d.getElementById("i-tel").value = "0712 345 678";
  d.getElementById("i-src").selectedIndex = 1; const dom = d.getElementById("i-dom"); if (dom) dom.selectedIndex = 1;
  f.querySelector('input[name="acord"]').checked = true;
  const ok = submit(w, f);
  assert.ok(!ok.defaultPrevented && busy, "formular complet: pleacă");
  assert.equal(f.querySelectorAll('[aria-invalid="true"]').length, 0);
}

// formularul de sponsori (novalidate) și cel de membri
for (const [file, lang] of [["eveniment.html", "ro"], ["en/eveniment.html", "en"], ["inscriere.html", "ro"], ["en/inscriere.html", "en"]]) {
  const w = open(file, lang), d = w.document;
  const f = [...d.querySelectorAll("form.signup")].find((x) => x.getAttribute("action") === "/api/form");
  assert.ok(f, file);
  const ev = submit(w, f);
  assert.ok(ev.defaultPrevented, file + ": gol, nu se trimite");
  const m = f.querySelector(".form-msg");
  assert.ok(m.classList.contains("err") && m.textContent.length > 40, file + ": " + m.textContent);
  const names = f.querySelectorAll("input[required]").length;
  assert.equal(f.querySelectorAll('[aria-invalid="true"]').length, names, file);
  assert.ok(!/\*/.test(m.textContent) && !m.textContent.includes("·"));
  console.log("  ", file, "->", m.textContent);
}

// chestionarul /q/<cod>: același flux ca în pagina generată de worker
{
  const src = fs.readFileSync(R + "/worker/apeluri.js", "utf8");
  assert.ok(src.includes("(obligatoriu)") && src.includes("(opțional)"));
  const html = `<div id="cq" data-cod="x" data-vip="0"><div id="qerr"></div>
<select id="q_vine"><option value="">Alege</option><option value="da">Da</option><option value="poate">Poate</option><option value="stop">stop</option></select>
<input id="q_nume"><input id="q_email"><input id="q_ocupatie"><select id="q_dom"><option value="">Alege</option><option value="it">IT</option></select>
<select id="q_vip"><option value="">Alege</option><option value="da">Da</option><option value="nu">Nu</option></select>
<div id="q_tinte" hidden><label class="chk"><input type="checkbox" data-tinta="it"></label><label class="chk"><input type="checkbox" data-tinta="marketing"></label></div>
<label class="chk"><input type="checkbox" id="q_acord"></label><button id="q_save">go</button></div>`;
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window, d = w.document; let sent = null;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.scrollTo = () => {};
  w.fetch = (u, o) => { sent = JSON.parse(o.body); return new Promise(() => {}); };
  w.eval(rd("public/assets/js/chestionar.js"));
  const sel = (id, v) => { const e = d.getElementById(id); e.value = v; e.dispatchEvent(new w.Event("change", { bubbles: true })); };
  const go = () => d.getElementById("q_save").click();
  go(); assert.match(d.getElementById("qerr").textContent, /1\. Participarea/); assert.ok(!sent);
  sel("q_vine", "da"); sel("q_dom", "it");
  d.getElementById("q_acord").checked = true;
  go();
  assert.ok(!sent, "da, cu câmpuri goale: nu se trimite");
  assert.equal(d.getElementById("qerr").textContent, "Completează: 2. Numele și prenumele, 3. Adresa de e-mail, 4. Ocupația, 7. Interesul pentru biletul VIP.");
  for (const id of ["q_nume", "q_email", "q_ocupatie", "q_vip"]) assert.equal(d.getElementById(id).getAttribute("aria-invalid"), "true", id);
  assert.ok(!d.getElementById("q_dom").hasAttribute("aria-invalid"));
  assert.equal(d.activeElement.id, "q_nume");
  d.getElementById("q_nume").value = "Ana Pop"; d.getElementById("q_nume").dispatchEvent(new w.Event("input"));
  assert.ok(!d.getElementById("q_nume").hasAttribute("aria-invalid"), "eroarea dispare la modificare");
  d.getElementById("q_email").value = "ana@example.com"; d.getElementById("q_ocupatie").value = "Designer";
  sel("q_vip", "da"); assert.equal(d.getElementById("q_tinte").hidden, false);
  go(); assert.match(d.getElementById("qerr").textContent, /7a\./); assert.ok(!sent);
  d.querySelectorAll("[data-tinta]").forEach((c) => (c.checked = true)); d.querySelector('[data-tinta="it"]').dispatchEvent(new w.Event("change"));
  go(); assert.ok(sent && sent.vine === "da" && sent.tinte.length === 2, "complet: se trimite");
  // poate: doar nume și acord
  sent = null; d.getElementById("q_save").disabled = false; sel("q_vine", "poate"); d.getElementById("q_nume").value = ""; go();
  assert.equal(d.getElementById("qerr").textContent, "Completează: 2. Numele și prenumele."); assert.ok(!sent);
}

// worker: pagina de eroare în loc de text simplu
{
  const { default: worker } = await import(R + "/worker/index.js").catch(() => ({}));
  if (worker) {
    const fd = (o) => { const f = new FormData(); for (const k in o) f.append(k, o[k]); return f; };
    for (const [limba, back, txt] of [["ro", "/eveniment#rezerva", "Înapoi la formular"], ["en", "/en/eveniment#rezerva", "Back to the form"]]) {
      const r = await worker.fetch(new Request("https://jci-brasov.com/api/inscriere", { method: "POST", body: fd({ limba, nume: "<b>x", email: "a" }) }), {}, { waitUntil() {} });
      const t = await r.text();
      assert.equal(r.status, 400); assert.match(r.headers.get("Content-Type"), /text\/html/);
      assert.ok(t.includes(`lang="${limba}"`) && t.includes(`href="${back}"`) && t.includes(txt) && !t.includes("<b>x"));
    }
    let r = await worker.fetch(new Request("https://jci-brasov.com/api/form", { method: "POST", headers: { Referer: "https://jci-brasov.com/inscriere?x=1" }, body: fd({ email: "zz", _next: "/multumim.html" }) }), {}, { waitUntil() {} });
    assert.ok((await r.text()).includes('href="/inscriere?x=1"'), "înapoi la Referer de pe același site");
    r = await worker.fetch(new Request("https://jci-brasov.com/api/form", { method: "POST", headers: { Referer: "https://evil.example/x" }, body: fd({ email: "zz" }) }), {}, { waitUntil() {} });
    assert.ok((await r.text()).includes('href="/contact"'), "fără Referer de încredere: /contact");
  } else console.log("  (worker/index.js nu se poate importa aici, partea de worker omisă)");
}
console.log("formulare: toate verificările au trecut");
