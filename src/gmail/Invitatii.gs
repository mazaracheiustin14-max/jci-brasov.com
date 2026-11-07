/**
 * JCI Brașov: trimiterea automată a invitațiilor la Beyond the Initiative, din Gmail (versiunea 2).
 * Rulează la 5 minute (declanșator creat de funcția instaleaza). La fiecare rulare:
 *  1. cere de la jci-brasov.com lista înscrierilor care nu au primit încă invitația;
 *  2. trimite fiecare email din acest cont Gmail; logo-ul și codul QR sunt atașate în email (nu încărcate de pe alt site),
 *     ceea ce reduce riscul ca emailul să ajungă în Spam;
 *  3. confirmă site-ului trimiterea, ca aceeași persoană să nu primească emailul de două ori.
 * Cheia de mai jos este secretă: nu o publica și nu o trimite altcuiva.
 */
var CHEIE = 'PUNE_AICI_CHEIA';
var SITE = 'https://jci-brasov.com';
var EXPEDITOR = 'Iustin Mazarache, JCI Brașov';

function trimiteInvitatii() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var r = UrlFetchApp.fetch(SITE + '/api/invitatii/de-trimis?v=2&key=' + encodeURIComponent(CHEIE), { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) { console.log('Site: ' + r.getResponseCode() + ' ' + r.getContentText()); return; }
    var data = JSON.parse(r.getContentText());
    for (var i = 0; i < data.items.length; i++) {
      var it = data.items[i];
      if (MailApp.getRemainingDailyQuota() < 1) { console.log('Limita zilnică Gmail atinsă; continuăm mâine.'); return; }
      try {
        var inline = {};
        if (it.inline) {
          Object.keys(it.inline).forEach(function (k) {
            inline[k] = UrlFetchApp.fetch(it.inline[k]).getBlob().setName(k + '.png');
          });
        }
        GmailApp.sendEmail(it.email, it.subject, it.text, { htmlBody: it.html, name: EXPEDITOR, inlineImages: inline });
        confirma(it.id, true, '');
        console.log('Trimis: ' + it.email);
        Utilities.sleep(1500); // pauză între emailuri, ca trimiterea să nu pară automată în masă
      } catch (e) {
        var msg = String(e && e.message || e);
        if (/invalid|address/i.test(msg)) confirma(it.id, false, msg);
        console.log('Eroare la ' + it.email + ': ' + msg);
      }
    }
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
