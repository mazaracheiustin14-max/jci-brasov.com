// Biletul VIP (pagina /bilet/<cod>): stratul holografic urmărește înclinarea telefonului sau cursorul.
// Arată la check-in că biletul e deschis live, nu o captură. Dezactivat când e setată reducerea animațiilor.
(function () {
  var h = document.querySelector(".vt .holo");
  if (!h || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
  function s(x, y) {
    h.style.setProperty("--hx", Math.max(0, Math.min(100, x)) + "%");
    h.style.setProperty("--hy", Math.max(0, Math.min(100, y)) + "%");
  }
  addEventListener("deviceorientation", function (e) {
    if (e.gamma == null) return;
    s(50 + e.gamma * 1.5, 50 + (e.beta - 45) * 1.2);
  });
  addEventListener("pointermove", function (e) {
    s((e.clientX / innerWidth) * 100, (e.clientY / innerHeight) * 100);
  });
})();
