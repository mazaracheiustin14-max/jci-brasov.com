// Contorul biletelor VIP (citește /api/stats la 15 secunde cât timp pagina e vizibilă)
(function () {
  var boxes = document.querySelectorAll('[data-vipbox],[data-ticketbox]');
  if (!boxes.length) return;
  var en = (document.documentElement.lang || '').indexOf('en') === 0, prevLeft = null, timer = null;
  function ago(iso) {
    var m = Math.max(0, Math.round((Date.now() - Date.parse(iso.replace(' ', 'T') + 'Z')) / 60000));
    if (m > 1440) return '';
    if (m < 1) return en ? 'Last VIP ticket bought just now' : 'Ultimul bilet VIP a fost cumpărat chiar acum';
    if (m < 60) return en ? 'Last VIP ticket bought ' + m + ' min ago' : 'Ultimul bilet VIP a fost cumpărat acum ' + m + ' min';
    var h = Math.round(m / 60);
    return en ? 'Last VIP ticket bought ' + h + ' h ago' : 'Ultimul bilet VIP a fost cumpărat acum ' + h + (h === 1 ? ' oră' : ' ore');
  }
  function set(sel, v) { document.querySelectorAll('[data-vip="' + sel + '"]').forEach(function (e) { e.textContent = v; }); }
  function apply(v) {
    if (!v || typeof v.total !== 'number') return;
    set('left', v.left); set('sold', v.sold);
    if (prevLeft !== null && v.left < prevLeft) document.querySelectorAll('[data-vip="left"]').forEach(function (e) { e.classList.remove('vip-bump'); void e.offsetWidth; e.classList.add('vip-bump'); });
    prevLeft = v.left;
    document.querySelectorAll('[data-vip="bar"]').forEach(function (e) { e.style.width = Math.min(100, v.sold * 100 / v.total) + '%'; });
    var last = v.last ? ago(v.last) : '';
    document.querySelectorAll('[data-vip="last"]').forEach(function (e) { e.textContent = last; e.hidden = !last; });
    document.querySelectorAll('[data-vip="buy"]').forEach(function (b) {
      if (v.left <= 0) { b.setAttribute('aria-disabled', 'true'); b.textContent = en ? 'VIP seats sold out' : 'Locurile VIP s-au epuizat'; b.removeAttribute('href'); }
    });
  }
  // Raportul biletelor nominale: emise din 150 și confirmări de venire
  function tickets(t) {
    if (!t || typeof t.total !== 'number') return;
    document.querySelectorAll('[data-tk="issued"]').forEach(function (e) { e.textContent = t.issued; });
    document.querySelectorAll('[data-tk="conf"]').forEach(function (e) { e.textContent = t.confirmed; });
    document.querySelectorAll('[data-tk="bar"]').forEach(function (e) { e.style.width = Math.min(100, t.issued * 100 / t.total) + '%'; });
    document.querySelectorAll('[data-tk="cbar"]').forEach(function (e) { e.style.width = Math.min(100, t.confirmed * 100 / t.total) + '%'; });
  }
  function load() {
    fetch('/api/stats', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) { apply(d.vip); tickets(d.tickets); }).catch(function () {});
  }
  function start() { if (!timer) { load(); timer = setInterval(load, 15000); } }
  function stop() { clearInterval(timer); timer = null; }
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  start();
})();
