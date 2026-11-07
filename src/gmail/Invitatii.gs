/**
 * JCI Brașov: trimiterea automată a invitațiilor la Beyond the Initiative, din Gmail.
 * Rulează la 5 minute (declanșator creat de funcția instaleaza). La fiecare rulare:
 *  1. cere de la jci-brasov.com lista înscrierilor care nu au primit încă invitația;
 *  2. trimite fiecare email din acest cont Gmail (subiectul și conținutul vin gata făcute de pe site);
 *  3. confirmă site-ului trimiterea, ca aceeași persoană să nu primească emailul de două ori.
 * Cheia de mai jos este secretă: nu o publica și nu o trimite altcuiva.
 */
var CHEIE = 'PUNE_AICI_CHEIA';
var SITE = 'https://jci-brasov.com';
var EXPEDITOR = 'JCI Brașov';
var RASPUNS_LA = 'contact@jci-brasov.com';

function trimiteInvitatii() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // o rulare anterioară încă lucrează
  try {
    var r = UrlFetchApp.fetch(SITE + '/api/invitatii/de-trimis?key=' + encodeURIComponent(CHEIE), { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) { console.log('Site: ' + r.getResponseCode() + ' ' + r.getContentText()); return; }
    var data = JSON.parse(r.getContentText());
    data.items.forEach(function (it) {
      if (MailApp.getRemainingDailyQuota() < 1) { console.log('Limita zilnică Gmail atinsă; continuăm mâine.'); return; }
      try {
        GmailApp.sendEmail(it.email, it.subject, it.text, {
          htmlBody: it.html, name: EXPEDITOR, replyTo: RASPUNS_LA
        });
        confirma(it.id, true, '');
        console.log('Trimis: ' + it.email);
      } catch (e) {
        var msg = String(e && e.message || e);
        // Adresă invalidă: marcăm eroarea. Alte erori (limită, rețea): reîncercăm la rularea următoare.
        if (/invalid|address/i.test(msg)) confirma(it.id, false, msg);
        console.log('Eroare la ' + it.email + ': ' + msg);
      }
    });
  } finally {
    lock.releaseLock();
  }
}

function confirma(id, ok, eroare) {
  UrlFetchApp.fetch(SITE + '/api/invitatii/trimis?key=' + encodeURIComponent(CHEIE), {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ id: id, ok: ok, eroare: eroare })
  });
}

/** Rulează o singură dată: pornește trimiterea automată la fiecare 5 minute. */
function instaleaza() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'trimiteInvitatii') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('trimiteInvitatii').timeBased().everyMinutes(5).create();
  trimiteInvitatii();
}

/** Oprește trimiterea automată. */
function opreste() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
}
