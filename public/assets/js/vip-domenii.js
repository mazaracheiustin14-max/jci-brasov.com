// Pagina /vip-confirmat: formularul „Networking curatoriat”. Cumpărătorul biletului VIP spune în ce domeniu activează
// și din ce domenii vrea să cunoască oameni la Blitz Networking (cel mult 3). Răspunsul pleacă la /api/vip-domenii.
// Lista de domenii vine din pagină (generată de src/domenii.py din aceeași listă ca worker/domenii.js).
(function () {
  var form = document.getElementById("vd-form");
  if (!form) return;
  var en = (document.documentElement.lang || "ro").slice(0, 2) === "en";
  var T = en
    ? { pick: "Please choose between one and three fields.", max: "You can choose at most three fields.", busy: "Sending…", send: "Send my answers",
        err: "We could not save your answers. Please try again.", net: "No connection. Please try again.",
        ok: "Thank you. We will seat you at Blitz Networking with participants from these fields, depending on the profile of those attending." }
    : { pick: "Alege între unul și trei domenii.", max: "Poți alege cel mult trei domenii.", busy: "Se trimite…", send: "Trimite răspunsurile",
        err: "Nu am putut salva răspunsurile. Te rugăm să încerci din nou.", net: "Fără conexiune. Te rugăm să încerci din nou.",
        ok: "Mulțumim. La Blitz Networking te așezăm la masă cu participanți din aceste domenii, în funcție de profilul participanților prezenți." };
  var msg = document.getElementById("vd-msg");
  var btn = form.querySelector("button[type=submit]");
  var boxes = Array.prototype.slice.call(form.querySelectorAll('input[name="tinte"]'));
  function say(t, bad) { msg.textContent = t; msg.hidden = !t; msg.style.color = bad ? "#FFB4A8" : "#fff"; }
  function chosen() { return boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }); }

  // Pe telefon, pagina deschide singură calendarul după 3 secunde; cine a început să completeze nu e întrerupt.
  function stopCalendar() {
    var box = document.getElementById("cal-auto"), stop = document.getElementById("cal-stop");
    if (box && stop && box.classList.contains("on")) stop.click();
  }
  form.addEventListener("focusin", stopCalendar);
  form.addEventListener("pointerdown", stopCalendar);

  boxes.forEach(function (b) {
    b.addEventListener("change", function () {
      if (chosen().length > 3) { b.checked = false; say(T.max, true); } else say("", false);
    });
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var t = chosen();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (t.length < 1 || t.length > 3) { say(T.pick, true); return; }
    btn.disabled = true; btn.textContent = T.busy; say("", false);
    fetch("/api/vip-domenii", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.elements.email.value.trim(), domeniu: form.elements.domeniu.value, tinte: t })
    }).then(function (r) { return r.json().catch(function () { return { ok: false }; }); }).then(function (j) {
      if (!j.ok) { btn.disabled = false; btn.textContent = T.send; say(T.err, true); return; }
      form.hidden = true; say(T.ok, false);
    }).catch(function () { btn.disabled = false; btn.textContent = T.send; say(T.net, true); });
  });
})();
