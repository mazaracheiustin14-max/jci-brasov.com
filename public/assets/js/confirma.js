// Pagina /confirma/<cod>: confirmă automat primirea invitației când pagina e deschisă de o persoană (în browser).
(function () {
  var f = document.getElementById("cf-form");
  if (f) setTimeout(function () { f.submit(); }, 400);
})();
