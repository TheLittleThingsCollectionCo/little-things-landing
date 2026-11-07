/**
 * Waitlist collector for The Little Things Collection.
 *
 * The landing page POSTs application/x-www-form-urlencoded fields
 * (email, source, page, ts). This web app appends a row to the
 * bound spreadsheet. The response is ignored by the page (no-cors).
 *
 * Setup:
 * 1. Create a Google Sheet (any title).
 * 2. Extensions > Apps Script. Remove the default code, paste this file, and save.
 * 3. Deploy > New deployment > Select type: Web app.
 * 4. Execute as: Me. Who has access: Anyone.
 * 5. Authorize the deployment when Google asks.
 * 6. Copy the web app URL (it ends in /exec) into WAITLIST_ENDPOINT in index.html.
 *
 * Redeploy (Manage deployments > edit > New version) after any script change.
 * The page treats a completed request as success and does not read this body.
 */
function doPost(e) {
  var params = (e && e.parameter) || {};
  var email = String(params.email || '').trim();
  var source = String(params.source || '').trim();
  var page = String(params.page || '').trim();

  if (!isPlausibleEmail(email)) {
    return ContentService.createTextOutput('invalid');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Waitlist');
    if (!sheet) {
      sheet = ss.insertSheet('Waitlist');
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['timestamp', 'email', 'source', 'page']);
    }

    sheet.appendRow([new Date().toISOString(), email, source, page]);
    SpreadsheetApp.flush();

    // Optional: email the studio when someone joins the list.
    // MailApp.sendEmail(
    //   'hello@thelittlethingscollection.com',
    //   'New waitlist signup',
    //   email + (page ? '\n' + page : '')
    // );

    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

function isPlausibleEmail(email) {
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
