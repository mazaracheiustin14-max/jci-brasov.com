"use strict";
/* ===================== utilitare ===================== */
var BRANCHES = ["Brașov", "Cluj", "București"];
var DOMAINS = [
  "IT și tehnologie",
  "Juridic",
  "Contabilitate și finanțe",
  "Marketing și comunicare",
  "Medical",
  "Construcții și imobiliare",
  "Turism și HoReCa",
  "Educație și training",
  "Producție și comerț",
  "Alte domenii",
];
var CATS = [
  "Evenimente și proiecte",
  "Training și dezvoltare membri",
  "Cotizații și taxe către organizația națională",
  "Comunicare, promovare și materiale tipărite",
  "Deplasări și transport",
  "Cazare și participare la conferințe",
  "Servicii digitale",
  "Taxe bancare și comisioane",
  "Servicii profesionale",
  "Birotică și consumabile",
  "Protocol și reprezentare",
  "Acțiuni caritabile și implicare comunitară",
  "Alte cheltuieli",
];
var ROLE_LABEL = { national: "Moderator", president: "Președinte", treasurer: "Trezorier", member: "Membru" };
var FEE_STATE = {
  neplatita: ["Neplătită", "warn", "clock"],
  platita: ["Plătită", "good", "check"],
  avans: ["Plătită în avans de terț", "warn", "clock"],
  scutita: ["Scutită", "neutral", "check"],
};
var EXP_STATE = {
  propusa: ["Propusă", "warn", "clock"],
  aprobata: ["Aprobată", "good", "check2"],
  respinsa: ["Respinsă", "crit", "x"],
  platita: ["Plătită", "good", "check"],
  anulata: ["Anulată", "neutral", "x"],
};
var THRESH = 50000; /* 500 RON in bani, Art. 31 */
var CONSENT_VERSION = "2026-11-11";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function norm(s) {
  return String(s || "")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ţ/g, "t")
    .replace(/Ţ/g, "T")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
function fmt(b) {
  return (b / 100).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function toBani(s) {
  s = String(s == null ? "" : s).trim();
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+(,\d{1,2})?$/.test(s)) s = s.replace(",", ".");
  else if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  var n = Math.round(parseFloat(s) * 100);
  return isFinite(n) && n <= 100000000000 ? n : NaN;
}
function amtMsg(raw, b) {
  if (!String(raw == null ? "" : raw).trim()) return "Completează câmpul Suma.";
  if (isNaN(b)) return "Introdu suma în lei, de exemplu 1.250,50.";
  if (!(b > 0)) return "Suma trebuie să fie mai mare ca zero.";
  return "";
}
function safe(fn) {
  try {
    return Promise.resolve(fn()).catch(function () {});
  } catch (e) {
    return Promise.resolve();
  }
}
function today() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function addMonths(ds, n) {
  var p = String(ds).split("-");
  var y = +p[0],
    m = +p[1] - 1 + n,
    d = +p[2];
  var ny = y + Math.floor(m / 12),
    nm = ((m % 12) + 12) % 12;
  var last = new Date(ny, nm + 1, 0).getDate();
  return ny + "-" + String(nm + 1).padStart(2, "0") + "-" + String(Math.min(d, last)).padStart(2, "0");
}
function addDays(ds, n) {
  var d = new Date(ds + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function defaultValid() {
  return new Date().getFullYear() + "-12-31";
}
function normCode(c) {
  return String(c || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
var CODE_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode() {
  var a = new Uint32Array(12);
  try {
    crypto.getRandomValues(a);
  } catch (e) {
    for (var i = 0; i < 12; i++) a[i] = Math.floor(Math.random() * 4294967296);
  }
  var o = "";
  for (var j = 0; j < 12; j++) o += CODE_ALPHA.charAt(a[j] % 32);
  return o;
}
function fmtCode(c) {
  return String(c).replace(/(.{4})(?=.)/g, "$1-");
}
function stripId(o) {
  var r = Object.assign({}, o);
  delete r.id;
  return r;
}
function fmtAt(iso) {
  var d = new Date(iso);
  if (!iso || isNaN(d))
    return String(iso || "")
      .slice(0, 16)
      .replace("T", " ");
  function z(n) {
    return String(n).padStart(2, "0");
  }
  return z(d.getDate()) + "." + z(d.getMonth() + 1) + "." + d.getFullYear() + " " + z(d.getHours()) + ":" + z(d.getMinutes());
}
function dro(d) {
  if (!d) return "";
  d = String(d);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return esc(d);
  var p = d.split("-");
  return p[2] + "." + p[1] + "." + p[0];
}
function uid() {
  try {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  } catch (e) {}
  var a = "";
  for (var i = 0; i < 4; i++) a += Math.random().toString(36).slice(2, 8);
  return Date.now().toString(36) + a;
}
function initials(n) {
  var p = String(n || "?")
    .trim()
    .split(/\s+/);
  return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}
function safeHttps(u) {
  return /^https:\/\//i.test(u) ? u : "";
}
