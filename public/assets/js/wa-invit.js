// Pagina /checkin/neconfirmate: la apăsarea butonului de WhatsApp marchează trimiterea (worker/wa-invit.js).
(function () {
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a[data-wa]") : null;
    if (!a) return;
    var id = a.getAttribute("data-wa");
    fetch("/api/echipa/wa-trimis", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: Number(id) }) })
      .then(function (r) {
        if (!r.ok) return;
        var st = document.querySelector('[data-st="' + id + '"]');
        if (st) st.textContent = "Trimis pe WhatsApp acum.";
        a.className = "btn b-ghost";
        a.textContent = "Retrimite pe WhatsApp";
      })
      .catch(function () {});
  });
})();
