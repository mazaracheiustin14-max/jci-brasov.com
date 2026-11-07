// Pe pagina de confirmare a înscrierii: dacă adresa conține codul biletului (?t=...), afișează linkul către biletul nominal cu QR.
(function () {
  var t = new URLSearchParams(location.search).get("t");
  var box = document.getElementById("c-bilet");
  if (!box || !t || !/^[a-f0-9]{32}$/.test(t)) return;
  document.getElementById("bilet-a").href = "/bilet/" + t;
  box.hidden = false;
})();
