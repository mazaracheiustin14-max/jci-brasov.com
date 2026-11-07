// Desenează codul QR al biletului nominal (pagina /bilet/<cod>).
(function () {
  var el = document.getElementById("qr");
  if (!el || typeof qrcode === "undefined") return;
  var qr = qrcode(0, "M");
  qr.addData(el.getAttribute("data-url"));
  qr.make();
  el.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
})();
