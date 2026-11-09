/* Meta Pixel JCI Brașov (ID 1646950960458698): codul de bază e inline în <head>, blocat până la acordul vizitatorului (GDPR, ePrivacy).
   Alegerea se păstrează 6 luni în localStorage („jci_consent”); butonul [data-cookie-settings] din subsol redeschide bannerul.
   Fișier extern, ca CSP să rămână fără 'unsafe-inline'. */
(function () {
  var BANNER = false; // banner scos temporar (9 nov 2026); true = varianta cu acord
  var ID = '1646950960458698', K = 'jci_consent', MAX = 182 * 864e5;
  var en = (document.documentElement.lang || '').slice(0, 2) === 'en';
  var T = en ? {
    txt: 'We use marketing cookies (Meta Pixel) only with your consent, to measure the reach of JCI Brașov campaigns. The website works fully without them.',
    more: 'Privacy policy', href: '/en/confidentialitate', yes: 'Accept', no: 'Decline', aria: 'Cookie consent'
  } : {
    txt: 'Folosim cookie-uri de marketing (Meta Pixel) doar cu acordul tău, ca să măsurăm eficiența campaniilor JCI Brașov. Site-ul funcționează complet și fără ele.',
    more: 'Politica de confidențialitate', href: '/confidentialitate', yes: 'Accept', no: 'Refuz', aria: 'Acord pentru cookie-uri'
  };

  function get() {
    try { var v = JSON.parse(localStorage.getItem(K) || 'null'); if (v && Date.now() - v.t < MAX) return v.v; } catch (e) {}
    return null;
  }
  function set(v) { try { localStorage.setItem(K, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {} }

  // Codul de bază Meta e inline în <head>, blocat cu fbq('consent','revoke'). Aici doar îl deblocăm.
  function conversions() {
    var p = location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
    if (/(^|\/)inscriere-confirmata$/.test(p)) fbq('track', 'CompleteRegistration', { content_name: 'Inscriere eveniment' });
    else if (/(^|\/)vip-confirmat$/.test(p)) fbq('track', 'CompleteRegistration', { content_name: 'Bilet VIP' });
    else if (/(^|\/)multumim$/.test(p)) fbq('track', 'Lead');
  }
  function grantNow() {
    if (!window.fbq) return;
    fbq('consent', 'grant');
    fbq('track', 'PageView', {}, { eventID: window.jciPv }); // același eventID: Meta nu îl numără de două ori
    conversions();
  }

  function clearMeta() {
    var host = location.hostname.replace(/^www\./, '');
    ['_fbp', '_fbc'].forEach(function (n) {
      document.cookie = n + '=; Max-Age=0; path=/';
      document.cookie = n + '=; Max-Age=0; path=/; domain=.' + host;
    });
  }

  var box;
  function hide() { if (box) { box.remove(); box = null; } }
  function show() {
    if (box) return;
    box = document.createElement('div');
    box.className = 'ck';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', T.aria);
    var p = document.createElement('p');
    p.appendChild(document.createTextNode(T.txt + ' '));
    var a = document.createElement('a'); a.href = T.href; a.textContent = T.more; p.appendChild(a);
    var row = document.createElement('div'); row.className = 'ck-row';
    var no = document.createElement('button'); no.type = 'button'; no.className = 'ck-no'; no.textContent = T.no;
    var yes = document.createElement('button'); yes.type = 'button'; yes.className = 'ck-yes'; yes.textContent = T.yes;
    row.appendChild(no); row.appendChild(yes);
    box.appendChild(p); box.appendChild(row);
    document.body.appendChild(box);
    yes.addEventListener('click', function () { set('granted'); hide(); grantNow(); });
    no.addEventListener('click', function () {
      var had = get() === 'granted';
      set('denied'); hide(); clearMeta();
      if (window.fbq) fbq('consent', 'revoke');
      if (had) location.reload();
    });
  }

  function init() {
    if (!BANNER) { if (window.fbq) conversions(); return; }
    var c = get();
    if (c === 'granted') { if (window.fbq) conversions(); }
    else if (c === null) show();
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-cookie-settings]');
      if (t) { e.preventDefault(); show(); }
    });
  }

  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
